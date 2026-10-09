// Duplicate-resolution detection over a parsed lockfile — a pure VALUE, not a
// service. No IO, nothing in `R`, no error channel. PeerCheck's sibling, on
// the same posture: format-free, over `@effected/lockfiles`' normalized
// instances, walking `resolved` edges from each importer's roots.
//
// The question it answers is the one issue #298 could not get from a type
// error and issue #603 could not get without looping `pnpm why` by hand:
// "which names resolve at more than one version, and who pulls each copy?"
// The answer is provenance plus a diff-able version list, not a boolean — a
// duplicate is harmless while the copies' shapes agree, and what makes them
// disagree is a stale transitive inside one copy, so the dependent that holds
// each copy is the actionable part.
//
// `instanceId` is OPAQUE here — looked up, never parsed. Splitting one on "@"
// or "(" would re-introduce the format knowledge this module exists without.

import { $ScratchpadId } from "@beep/identity/packages";
import type { Lockfile, ResolvedPackage } from "../lockfiles/index.ts";
import * as S from "effect/Schema";
import { indexInstances, rootInstances } from "./internal/roots.ts";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/workspaces/DuplicateCheck");

/**
 * Options for {@link DuplicateCheck.run}.
 *
 * @public
 */
export interface DuplicateCheckOptions {
	/**
	 * Which package names to REPORT on. Defaults to every name.
	 *
	 * @remarks
	 * The predicate narrows the report, never the walk: a package it rejects is
	 * still followed and still appears as a dependent wherever it pulls a copy
	 * of a package it accepts. Pruning the walk instead would drop exactly the
	 * culprit a consumer needs named — the untouched third package holding the
	 * stale copy. {@link DuplicateCheck.kit} is the predicate every consumer of
	 * this kit wants.
	 */
	readonly names?: (name: string) => boolean;
}

/**
 * Who pulls one resolved instance into the graph.
 *
 * @remarks
 * A tagged union a renderer narrows with `switch (dependent._tag)`:
 *
 * - `"importer"` — a workspace importer takes the instance directly; `path`
 *   is the importer path (`"."` for the root).
 * - `"package"` — a resolved package's own dependency edge points at the
 *   instance; `name` and `version` are that package's.
 *
 * An importer's dependencies are attributed to the importer by path even when
 * the lockfile records a workspace row for it — that row IS the importer, and
 * reporting it as a `"package"` would name a directory with a placeholder
 * version rather than the project that took the dependency.
 *
 * @public
 */
export const Dependent = S.Union([
	/** A workspace importer takes the instance directly. */
	S.TaggedStruct("importer", { path: S.NonEmptyString }),
	/** A resolved package's dependency edge points at the instance. */
	S.TaggedStruct("package", { name: S.NonEmptyString, version: S.String }),
]).pipe($I.annoteSchema("Dependent", { description: "Who pulls one resolved instance into the graph." }));

/**
 * The decoded form of {@link (Dependent:variable)}: who pulls one resolved
 * instance, as a tagged union a renderer narrows with `switch (dependent._tag)`.
 *
 * @public
 */
export type Dependent = typeof Dependent.Type;

/**
 * One resolved instance of a duplicated version, with everything that pulls it.
 *
 * @remarks
 * `dependents` is deduplicated and in lockfile order: importers first, in the
 * order the lockfile lists them, then packages in the order the lockfile lists
 * them. Two instances of one `name@version` that differ only by peer suffix
 * each get their own row, so the dependents of each variant stay attributed to
 * the variant they actually took.
 *
 * @public
 */
export class DuplicateInstance extends S.Class<DuplicateInstance>($I`DuplicateInstance`)({
	/** The opaque instance id, as `@effected/lockfiles` records it. */
	instanceId: S.NonEmptyString.annotateKey({ description: "The opaque instance id, as `@effected/lockfiles` records it." }),
	/** Every importer and package that pulls THIS copy. */
	dependents: S.Array(Dependent).annotateKey({ description: "Every importer and package that pulls THIS copy." }),
}, $I.annote("DuplicateInstance", { description: "One resolved instance of a duplicated version, with everything that pulls it." })) {}

/**
 * One version a duplicated package resolved at.
 *
 * @public
 */
export class DuplicatedVersion extends S.Class<DuplicatedVersion>($I`DuplicatedVersion`)({
	/** The resolved version. */
	version: S.String.annotateKey({ description: "The resolved version." }),
	/** Every instance at this version — more than one when peer suffixes differ. */
	instances: S.Array(DuplicateInstance).annotateKey({ description: "Every instance at this version — more than one when peer suffixes differ." }),
}, $I.annote("DuplicatedVersion", { description: "One version a duplicated package resolved at." })) {}

/**
 * One package name reached at two or more distinct versions.
 *
 * @remarks
 * `versions` always has at least two entries: a name resolved at one version
 * is never a duplicate, however many peer-suffix instances that version has.
 * Two instances of the same version load identical code and cannot produce the
 * type-identity skew this check exists to catch, so counting them would report
 * a problem nobody has.
 *
 * @public
 */
export class DuplicatedPackage extends S.Class<DuplicatedPackage>($I`DuplicatedPackage`)({
	/** The package name. */
	name: S.NonEmptyString.annotateKey({ description: "The package name." }),
	/** Every version it resolved at, in lockfile order. Never fewer than two. */
	versions: S.Array(DuplicatedVersion).annotateKey({ description: "Every version it resolved at, in lockfile order. Never fewer than two." }),
}, $I.annote("DuplicatedPackage", { description: "One package name reached at two or more distinct versions." })) {}

/**
 * The result of checking a lockfile for packages resolved at more than one
 * version.
 *
 * @remarks
 * A report rather than a bare array, for the reason `PeerCheck` is one: an
 * empty array is indistinguishable from "this importer could not be looked
 * at". `unresolvedImporters` makes that difference legible.
 *
 * Pure and total — construct it with {@link DuplicateCheck.run}, which never
 * fails.
 *
 * @example
 * ```ts
 * import { Lockfile } from "../lockfiles/index.ts";
 * import { DuplicateCheck } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * declare const text: string; // the text of a pnpm-lock.yaml
 *
 * const program = Effect.gen(function* () {
 *   const lockfile = yield* Lockfile.parse(text, { format: "pnpm" });
 *   const report = DuplicateCheck.run(lockfile, { names: DuplicateCheck.kit });
 *   for (const pkg of report.duplicates) {
 *     for (const version of pkg.versions) {
 *       for (const instance of version.instances) {
 *         console.log(pkg.name, version.version, instance.dependents);
 *       }
 *     }
 *   }
 *   return report.isClean;
 * });
 * ```
 *
 * @public
 */
export class DuplicateCheck extends S.Class<DuplicateCheck>($I`DuplicateCheck`)({
	/**
	 * Every reported name resolved at two or more distinct versions, in
	 * lockfile order.
	 */
	duplicates: S.Array(DuplicatedPackage).annotateKey({ description: "Every reported name resolved at two or more distinct versions, in lockfile order." }),
	/**
	 * Importers whose dependencies could not be resolved to instances, so
	 * nothing reachable only through them was counted.
	 *
	 * @remarks
	 * In practice this is the **root importer under npm and bun**: neither
	 * records a resolved version per importer dependency, and neither emits a
	 * package row for the root, so there is nothing to join on. pnpm records a
	 * version per importer dependency and is unaffected. `PeerCheck` reports the
	 * same limitation.
	 *
	 * Reported rather than silently skipped: a gate that sees no duplicates is
	 * entitled to know whether that means "clean" or "not looked at".
	 */
	unresolvedImporters: S.Array(S.String).annotateKey({ description: "Importers whose dependencies could not be resolved to instances, so nothing reachable only through them was counted." }),
}, $I.annote("DuplicateCheck", { description: "The result of checking a lockfile for packages resolved at more than one version." })) {
	/**
	 * Whether no reported name is duplicated.
	 *
	 * @remarks
	 * Answers for the names asked about, not for the whole graph: with a
	 * `names` filter, a duplicated name the filter rejects does not make the
	 * report unclean. It says nothing about `unresolvedImporters` — a gate
	 * wanting a proven-clean answer checks both.
	 */
	get isClean(): boolean {
		return this.duplicates.length === 0;
	}

	/**
	 * The names every consumer of this kit asks about: `effect` itself and every
	 * `@effected/*` package.
	 *
	 * @remarks
	 * Exactly those — not `@effect/*`, and not names merely starting with
	 * `effect`. A duplicated kit package presents as a `Layer` requirement that
	 * looks provided yet cannot be satisfied, at the entry point, naming neither
	 * the package nor the skew; this predicate is the check that names both.
	 *
	 * @param name - a package name
	 * @returns whether the name belongs to the kit
	 */
	static kit(name: string): boolean {
		return name === "effect" || name.startsWith("@effected/");
	}

	/**
	 * Compute which packages a parsed lockfile resolves at more than one
	 * version, and who pulls each copy.
	 *
	 * @remarks
	 * Pure, total and format-free: no IO, no error channel, and no knowledge of
	 * which package manager wrote the file.
	 *
	 * The walk starts at each importer's resolved dependencies and follows
	 * `resolved` edges, so only instances some importer actually reaches are
	 * counted — a stale row the lockfile still carries but nothing depends on is
	 * not a duplicate. A name is a duplicate when the walk reaches it at **two
	 * or more distinct versions**; peer-suffix instances of one version are
	 * listed under that version but never make a name a duplicate on their own.
	 *
	 * Each instance's `dependents` are every importer whose roots include it and
	 * every reached package whose `resolved` map points at it, deduplicated, in
	 * lockfile order. `options.names` narrows what is reported, never what is
	 * walked, so a filtered-out package still appears as a dependent where it
	 * pulls a reported copy.
	 *
	 * The one limit it does not paper over is the npm and bun root importer
	 * (see `unresolvedImporters`).
	 *
	 * @param lockfile - a lockfile parsed by `@effected/lockfiles`
	 * @param options - see {@link DuplicateCheckOptions}
	 * @returns the report; never fails
	 */
	static run(lockfile: Lockfile, options?: DuplicateCheckOptions): DuplicateCheck {
		const names = options?.names ?? (() => true);
		const index = indexInstances(lockfile);
		const { byId } = index;

		// Roots taken directly by an importer entry (no workspace row), keyed by
		// the instance they resolved to. A workspace row's edges are attributed
		// below, when the walk leaves the row.
		const importerRoots = new Map<string, Array<string>>();
		const unresolved: Array<string> = [];
		const queue: Array<ResolvedPackage> = [];

		for (const importer of lockfile.importers) {
			const roots = rootInstances(lockfile, importer.path, index);
			if (roots === undefined) {
				unresolved.push(importer.path);
				continue;
			}
			if (roots._tag === "own") {
				queue.push(roots.instance);
				continue;
			}
			for (const instance of roots.instances) {
				const paths = importerRoots.get(instance.instanceId) ?? [];
				paths.push(importer.path);
				importerRoots.set(instance.instanceId, paths);
				queue.push(instance);
			}
		}

		// One global walk: reachability is a property of the graph, not of any
		// single importer, and every reached edge is a dependent to record.
		const reached = new Set<string>();
		while (queue.length > 0) {
			const current = queue.shift();
			if (current === undefined) break;
			if (reached.has(current.instanceId)) continue;
			reached.add(current.instanceId);
			for (const targetId of R.values(current.resolved)) {
				const next = byId.get(targetId);
				if (next !== undefined && !reached.has(targetId)) queue.push(next);
			}
		}

		// Dependents, in lockfile order: importer roots first, then every reached
		// package's edges in the order the lockfile lists the packages. Built from
		// the lockfile rather than from the walk so the order never depends on
		// which importer happened to reach an instance first.
		const dependents = new Map<string, Array<Dependent>>();
		const seen = new Set<string>();
		const record = (targetId: string, dependent: Dependent): void => {
			const key = `${targetId}\0${renderKey(dependent)}`;
			if (seen.has(key)) return;
			seen.add(key);
			const list = dependents.get(targetId) ?? [];
			list.push(dependent);
			dependents.set(targetId, list);
		};
		for (const importer of lockfile.importers) {
			for (const [instanceId, paths] of importerRoots) {
				if (paths.includes(importer.path)) record(instanceId, { _tag: "importer", path: importer.path });
			}
		}
		for (const pkg of lockfile.packages) {
			if (!reached.has(pkg.instanceId)) continue;
			const from = dependentOf(pkg);
			for (const targetId of R.values(pkg.resolved)) {
				if (byId.has(targetId)) record(targetId, from);
			}
		}

		// Group reached instances by name, then by version, keeping lockfile
		// order on both axes.
		const byName = new Map<string, Map<string, Array<ResolvedPackage>>>();
		for (const pkg of lockfile.packages) {
			if (!reached.has(pkg.instanceId)) continue;
			const versions = byName.get(pkg.name) ?? new Map<string, Array<ResolvedPackage>>();
			const instances = versions.get(pkg.version) ?? [];
			instances.push(pkg);
			versions.set(pkg.version, instances);
			byName.set(pkg.name, versions);
		}

		const duplicates: Array<DuplicatedPackage> = [];
		for (const [name, versions] of byName) {
			// Two or more DISTINCT VERSIONS is the rule. Instance count is not:
			// peer-suffix variants of one version are the same code.
			if (versions.size < 2) continue;
			if (!names(name)) continue;
			duplicates.push(
				DuplicatedPackage.make({
					name,
					versions: [...versions].map(([version, instances]) =>
						DuplicatedVersion.make({
							version,
							instances: instances.map((instance) =>
								DuplicateInstance.make({
									instanceId: instance.instanceId,
									dependents: dependents.get(instance.instanceId) ?? [],
								}),
							),
						}),
					),
				}),
			);
		}

		return DuplicateCheck.make({ duplicates, unresolvedImporters: unresolved });
	}
}

/**
 * The dependent an edge leaving `from` is attributed to.
 *
 * A workspace row standing for an importer is that importer: its edges are the
 * project's own dependencies, so they are attributed by path. A workspace row
 * the lockfile records without a path (npm can) falls back to the package
 * form, which is at least truthful about the name.
 *
 * @internal
 */
const dependentOf = (from: ResolvedPackage): Dependent =>
	from.isWorkspace && from.relativePath !== undefined
		? { _tag: "importer", path: from.relativePath }
		: { _tag: "package", name: from.name, version: from.version };

/** @internal */
const renderKey = (dependent: Dependent): string =>
	dependent._tag === "importer" ? `importer\0${dependent.path}` : `package\0${dependent.name}\0${dependent.version}`;
