import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as MutableHashMap from "effect/MutableHashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { dual } from "effect/Function";
import { LockfileImporter } from "../LockfileImporter.ts";
import { PnpmExtension } from "../PnpmExtension.ts";
import { ResolvedPackage } from "../ResolvedPackage.ts";
import { splitPnpmStream } from "./documents.ts";
import type { LockfileFields, ParseFailure, WorkspaceEntry } from "./shared.ts";
import {
	extractWorkspaceDeps,
	framingFailure,
	gatePnpmVersion,
	importerDependencies,
	peerDeclarations,
	splitNameVersion,
	splitPeerSuffix,
	toIntegrityHash,
	validationFailure,
} from "./shared.ts";
import * as R from "effect/Record";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/lockfiles/internal/pnpm");

// ── Raw schema (permissive validation scaffolding, not API) ────────────────

const PnpmImporterDeps = S.optionalKey(
	S.Record(S.String, S.Struct({ specifier: S.String.annotateKey({ description: "Dependency specifier declared by the importer or catalog" }), version: S.String.annotateKey({ description: "Recorded package version or resolved dependency version" }) })),
).annotate($I.annote("PnpmImporterDeps", { description: "Optional pnpm importer dependency map containing declared specifiers and resolved versions" }));

const PnpmImporter = S.Struct({
	dependencies: PnpmImporterDeps.annotateKey({ description: "Declared runtime dependencies keyed by package name" }),
	devDependencies: PnpmImporterDeps.annotateKey({ description: "Declared development dependencies keyed by package name" }),
	peerDependencies: PnpmImporterDeps.annotateKey({ description: "Declared peer dependencies keyed by package name" }),
	optionalDependencies: PnpmImporterDeps.annotateKey({ description: "Declared optional dependencies keyed by package name" }),
	// `publishConfig.directory` surfaces here: pnpm records the directory a
	// workspace package's links actually point AT, importer-relative. It is the
	// exact evidence that lets a `link:<importer>/<publishDirectory>` edge name
	// its importer.
	publishDirectory: S.optionalKey(S.String).annotateKey({ description: "Importer-relative published directory targeted by workspace links" }),
}).annotate($I.annote("PnpmImporter", { description: "Permissive pnpm importer with declared dependency sections and optional published directory" }));

const PnpmLockfileRaw = S.Struct({
	// The version gate owns non-finite rejection and preserves the recorded value in its typed cause.
	lockfileVersion: S.Union([S.String, S.Finite]).annotateKey({ description: "Recorded format version, preserved verbatim before gating or string conversion" }),
	settings: S.optionalKey(
		S.Struct({
			autoInstallPeers: S.optionalKey(S.Boolean).annotateKey({ description: "Whether pnpm automatically installs peer dependencies" }),
			excludeLinksFromLockfile: S.optionalKey(S.Boolean).annotateKey({ description: "Whether pnpm excludes linked dependencies from the lockfile" }),
		}),
	).annotateKey({ description: "Optional settings recorded by pnpm" }),
	overrides: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Dependency resolution overrides preserved as recorded" }),
	catalogs: S.optionalKey(
		S.Record(
			S.String,
			S.Record(
				S.String,
				S.Union([S.String, S.Struct({ specifier: S.String.annotateKey({ description: "Dependency specifier declared by the importer or catalog" }), version: S.String.annotateKey({ description: "Recorded package version or resolved dependency version" }) })]),
			),
		),
	).annotateKey({ description: "Named dependency catalogs preserved as recorded" }),
	importers: S.Record(S.String, PnpmImporter).annotateKey({ description: "Workspace importer entries recorded by the lockfile" }),
	packages: S.optionalKey(
		S.Record(
			S.String,
			S.Struct({
				resolution: S.optionalKey(S.Struct({ integrity: S.optionalKey(S.String).annotateKey({ description: "Recorded subresource integrity hash" }) })).annotateKey({ description: "Optional package resolution metadata" }),
				peerDependencies: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Declared peer dependencies keyed by package name" }),
				peerDependenciesMeta: S.optionalKey(
					S.Record(S.String, S.Struct({ optional: S.optionalKey(S.Boolean).annotateKey({ description: "Whether this peer dependency is optional" }) })),
				).annotateKey({ description: "Optionality metadata keyed by peer dependency name" }),
				// Pre-v9 lockfiles carry resolution inline here, since they have no
				// `snapshots:` section to carry it.
				dependencies: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Declared runtime dependencies keyed by package name" }),
				optionalDependencies: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Declared optional dependencies keyed by package name" }),
			}),
		),
	).annotateKey({ description: "Resolved package entries in lockfile traversal order" }),
	// Lockfile v9 split per-*instance* resolution out of `packages:` into its
	// own section; earlier versions carry both in `packages:`.
	snapshots: S.optionalKey(
		S.Record(
			S.String,
			S.Struct({
				dependencies: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Declared runtime dependencies keyed by package name" }),
				optionalDependencies: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Declared optional dependencies keyed by package name" }),
			}),
		),
	).annotateKey({ description: "Per-instance dependency sections keyed by pnpm snapshot identity" }),
}).annotate($I.annote("PnpmLockfileRaw", { description: "Supported pnpm document with importer entries, version metadata and per-instance snapshots" }));

type PnpmLockfileRawType = typeof PnpmLockfileRaw.Type;
type PnpmImporterType = typeof PnpmImporter.Type;
type PnpmPackageEntry = NonNullable<PnpmLockfileRawType["packages"]>[string];

/**
 * Parse pnpm `pnpm-lock.yaml` content into the unified field bundle.
 *
 * `pnpm-lock.yaml` is a YAML *stream*, not a single document: a workspace
 * using `configDependencies` gets a config-dependencies preamble document
 * ahead of the lockfile. {@link splitPnpmStream} locates the lockfile
 * deterministically (it is the last document); the preamble is never read as
 * the lockfile.
 *
 * An empty main document after a preamble is **ambiguous**: pnpm 11 and 12
 * write exactly those bytes both for a config-dependency-only workspace with
 * no root `package.json` and for a workspace whose first install failed after
 * its config dependencies were installed. The bytes cannot tell the two apart,
 * so the parser does not decide: only when the caller asserts `configOnly`
 * (it knows the root has no `package.json`) does the stream read as an empty
 * lockfile — no packages, importers or workspace edges, versioned by the
 * preamble's `lockfileVersion` after the preamble passes the same version
 * gate. The preamble's own packages are config dependencies, not the
 * workspace's, so none of them is reported. Without the assertion, and always
 * when there is no preamble to vouch for the stream, an empty main document
 * fails `noLockfileDocument`. The flag loosens nothing else.
 *
 * Workspace packages are keyed by importer *path* with version `"0.0.0"`;
 * `Lockfile#withImporterNames` is the explicit second stage that rewrites
 * them to real names.
 *
 * @internal
 */
export const parsePnpm: {
	(configOnly: boolean): (content: string) => Effect.Effect<LockfileFields, ParseFailure>;
	(content: string, configOnly: boolean): Effect.Effect<LockfileFields, ParseFailure>;
} = dual(2, Effect.fnUntraced(function* (content: string, configOnly: boolean) {
	const { preamble, main: document, documents } = yield* splitPnpmStream(content);
	if (document === undefined) {
		if (preamble === undefined || !configOnly) {
			return yield* Effect.fail(framingFailure("noLockfileDocument", documents));
		}
		const lockfileVersion = yield* gatePnpmVersion(preamble);
		return {
			lockfileVersion,
			packages: [],
			workspaceDependencies: [],
			importers: [],
			extension: PnpmExtension.make({}),
		};
	}
	// Format-version gate. Deliberately NOT a check for `snapshots:` being
	// present or populated: a dependency-free v9 workspace legitimately has
	// zero snapshot entries, so an emptiness guard would reject a valid
	// lockfile. Version is the format's own identity; emptiness is a
	// coincidence of content.
	//
	// It runs BEFORE the shape decode, and must: a pre-v9 single-project
	// lockfile carries no `importers` map, so decoding first would report a
	// too-old lockfile as malformed — losing the distinction the
	// `UnsupportedLockfileVersion` cause exists to carry.
	yield* gatePnpmVersion(document);
	const validated = yield* S.decodeUnknownEffect(PnpmLockfileRaw)(document).pipe(
		Effect.mapError(validationFailure),
	);
	// pnpm always records at least the root importer ".", so a lockfile
	// document declaring no importers at all describes no workspace. Fail
	// typed rather than hand back an empty Lockfile — an empty result is
	// indistinguishable from "this workspace has no packages", which is the
	// shape that kept the multi-document bug invisible.
	if (R.keys(validated.importers).length === 0) {
		return yield* Effect.fail(framingFailure("noImporters", documents));
	}
	return yield* toFields(validated);
}));

// ── Transform ──────────────────────────────────────────────────────────────

/**
 * Resolve one instance's outgoing edges to instance ids.
 *
 * pnpm names a resolved dependency as `name` → `version`, where the version may
 * itself carry a peer suffix (`1.6.0(react@17.0.2)`); the referenced instance's
 * key is those two composed back together. The composition is *verified*
 * against the lockfile's own key set rather than trusted — the composed key is
 * v9's bare `name@version` and nothing else, because the format gate admits no
 * lockfile that spells keys the pre-v9 leading-slash way — and an edge that
 * matches nothing is **omitted**. That is what keeps a `link:`/`file:`
 * resolution, which names no instance in this lockfile, from becoming a
 * plausible lie.
 *
 * A failed composition gets one second reading: the recorded version ITSELF as
 * an instance id. That is how pnpm spells an `npm:` alias — the dependency
 * `typescript-classic: npm:typescript@^6.0.3` is recorded as
 * `typescript-classic: typescript@6.0.3`, the referenced instance's own key,
 * peer suffix included when one applies. Still compose-then-verify, not a
 * guess: a plain version (`6.0.3`) can never be an instance id, because ids
 * always carry a name, so the reading admits exactly the alias shape.
 *
 * Unlike {@link resolveImporterEdges}, there is no `workspace:`-specifier
 * ancestor walk here — a snapshot body records no specifier, so that evidence
 * does not exist on this path. The publish-directory map needs no specifier:
 * the importer entry's own `publishDirectory` declaration is exact evidence,
 * available to both paths, and is consulted unconditionally.
 *
 * @internal
 */
const resolveEdges = (
	sections: ReadonlyArray<Readonly<Record<string, string>> | undefined>,
	instanceIds: MutableHashSet.MutableHashSet<string>,
	publishDirTargets: MutableHashMap.MutableHashMap<string, string>,
): ResolvedEdges => {
	const edges = MutableHashMap.empty<string, string>();
	const unnameable = MutableHashSet.empty<string>();
	for (const section of sections) {
		if (section === undefined) continue;
		for (const [name, version] of R.toEntries(section)) {
			if (name === "") continue;
			// A `link:` resolution names a directory, not a registry version, so
			// `name@link:...` composes to nothing. pnpm records the same edge twice
			// in two spellings: the snapshot body keeps the readable `link:<path>`
			// while the peer suffix carries a MANGLED identity
			// (`react@packages+fakereact`) that appears nowhere as a key. Neither
			// spelling composes, and a dropped edge for a peer reads one layer up as
			// an unsatisfied peer, turning a satisfied `link:` into a false positive,
			// so the edge is resolved explicitly.
			//
			// A snapshot's `link:` target is recorded relative to the workspace
			// ROOT (importer sections record theirs relative to the importer), so
			// it is normalized against the root and matched against the instance
			// ids, where a workspace importer's id is its path.
			if (version.startsWith(LINK_PREFIX)) {
				const target = resolveLinkTarget("", version.slice(LINK_PREFIX.length));
				const publishDirTarget = target === undefined ? undefined : O.getOrUndefined(MutableHashMap.get(publishDirTargets, target));
				if (target !== undefined && MutableHashSet.has(instanceIds, target)) MutableHashMap.set(edges, name, target);
				// A target that is no importer may still be one's DECLARED publish
				// directory — `link:packages/lib/dist/dev/pkg` where `packages/lib`
				// declares `publishDirectory: dist/dev/pkg`. The declaration is exact
				// evidence, so the map is consulted unconditionally.
				else if (publishDirTarget !== undefined) {
					MutableHashMap.set(edges, name, publishDirTarget);
				}
				// A `link:` into a directory that is no importer and no declared
				// publish directory — a build output, a vendored stub — names no
				// instance in this lockfile. The edge is RECORDED, so its absence from
				// `resolved` must not read as "nothing resolved".
				else MutableHashSet.add(unnameable, name);
				continue;
			}
			const bare = `${name}@${version}`;
			if (MutableHashSet.has(instanceIds, bare)) MutableHashMap.set(edges, name, bare);
			// The alias reading: the recorded version is the referenced instance's
			// own key (`realname@realversion(peers)`), which a plain version never is.
			else if (MutableHashSet.has(instanceIds, version)) MutableHashMap.set(edges, name, version);
			else MutableHashSet.add(unnameable, name);
		}
	}
	// Map-backed until the last step: `Object.fromEntries` defines own data
	// properties, so a "__proto__" dependency name neither pollutes nor drops.
	return { resolved: R.fromEntries(edges), unresolvedEdges: A.sort(unnameable, Order.String) };
};

/**
 * One instance's outgoing edges, split: those that could be named, and those
 * the lockfile records but this model could not name.
 *
 * @internal
 */
const ResolvedEdges = S.Struct({
	resolved: S.Record(S.String, S.String).annotateKey({ description: "Recorded resolution location or resolved instance ids keyed by dependency name" }),
	unresolvedEdges: S.Array(S.String).annotateKey({ description: "Unresolved dependency names in ascending UTF-16 order" }),
}).annotate($I.annote("ResolvedEdges", { description: "Resolved instance ids by dependency name and the sorted names of edges that could not be resolved" }));
type ResolvedEdges = typeof ResolvedEdges.Type;

/** The protocol pnpm records a workspace-directory resolution under. @internal */
const LINK_PREFIX = "link:";

/**
 * Normalize a `link:` target against the linking importer's path, so a
 * workspace edge can name the workspace importer's instance id.
 * Total: a target that walks above the root yields `undefined`.
 *
 * A target that normalizes to NOTHING — `link:.` recorded root-relative —
 * also yields `undefined` rather than the root importer's ".": the root
 * importer deliberately emits no `ResolvedPackage` row (its path cannot serve
 * as a package name), so mapping the empty target to "." would hand back an id
 * no row carries, and no pnpm output recording that shape has been observed.
 * The edge stays honestly unnameable instead.
 *
 * @internal
 */
const resolveLinkTarget = (importerPath: string, target: string): string | undefined => {
	const segments: Array<string> = [];
	for (const segment of `${importerPath}/${target}`.split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			if (segments.pop() === undefined) return undefined;
			continue;
		}
		segments.push(segment);
	}
	return segments.length === 0 ? undefined : segments.join("/");
};

/** The specifier protocol pnpm resolves through the workspace itself. @internal */
const WORKSPACE_PREFIX = "workspace:";

/**
 * The importer a `link:` target lands INSIDE, longest path first.
 *
 * pnpm's `publishConfig.linkDirectory` makes a workspace link point at the
 * package's publish directory rather than its root — `link:../bundler/dist/dev/pkg`
 * where `packages/bundler` is the importer — so the target itself is a build
 * output that is no importer and never will be. The owning importer is the
 * longest ancestor of the target that IS one; longest-first so a nested importer
 * beats its parent.
 *
 * The root importer (`"."`) is deliberately unreachable here: it is an ancestor
 * of every path in the workspace, so admitting it would resolve every stray link
 * to the root rather than leaving it unnamed.
 *
 * @internal
 */
const owningImporter = (target: string, importerPaths: MutableHashSet.MutableHashSet<string>): string | undefined => {
	const segments = target.split("/");
	for (let end = segments.length - 1; end > 0; end--) {
		const candidate = segments.slice(0, end).join("/");
		if (MutableHashSet.has(importerPaths, candidate)) return candidate;
	}
	return undefined;
};

/**
 * Resolve one importer's outgoing edges. pnpm records `{ specifier, version }`
 * per importer dependency, where the version is either a registry version (the
 * instance-id composition {@link resolveEdges} performs) or a `link:` target
 * naming another importer — normalized against this importer's own path. Both
 * are checked against the lockfile's instance ids before being emitted.
 *
 * A `link:` target that is no importer gets two further chances. First the
 * publish-directory map: an importer that DECLARES `publishDirectory` has told
 * the lockfile exactly which build directory its links point at, so a target
 * matching a declared publish directory names that importer on evidence, no
 * specifier required — {@link resolveEdges} consults the same map for the same
 * reason. Then, and only under a `workspace:` SPECIFIER, the ancestor walk:
 * pnpm resolved that edge through the workspace, so the target directory is
 * known to belong to a workspace package, and {@link owningImporter} names it.
 * The specifier is what makes the walk a resolution rather than a guess — a
 * hand-written `link:../vendor/stub` specifier names a directory pnpm never
 * claimed was a workspace package, and attributing it to whichever importer
 * happens to contain it would answer with the wrong package's peers instead of
 * admitting it could not name the edge. The snapshot path has no specifier and
 * therefore no walk; the publish-directory map is the evidence it does get.
 *
 * A failed `name@version` composition gets the same alias reading as
 * {@link resolveEdges}: the recorded version itself as an instance id, which is
 * how pnpm spells `npm:` aliases.
 *
 * @internal
 */
const resolveImporterEdges = (
	importer: PnpmImporterType,
	importerPath: string,
	instanceIds: MutableHashSet.MutableHashSet<string>,
	importerPaths: MutableHashSet.MutableHashSet<string>,
	publishDirTargets: MutableHashMap.MutableHashMap<string, string>,
): ResolvedEdges => {
	const edges = MutableHashMap.empty<string, string>();
	const unnameable = MutableHashSet.empty<string>();
	for (const group of importerDepGroups(importer)) {
		if (group === undefined) continue;
		for (const [name, info] of R.toEntries(group)) {
			if (name === "") continue;
			if (info.version.startsWith(LINK_PREFIX)) {
				const target = resolveLinkTarget(importerPath, info.version.slice(LINK_PREFIX.length));
				const owner =
					target === undefined
						? undefined
						: MutableHashSet.has(instanceIds, target)
							? target
							: (O.getOrUndefined(MutableHashMap.get(publishDirTargets, target)) ??
								(info.specifier.startsWith(WORKSPACE_PREFIX) ? owningImporter(target, importerPaths) : undefined));
				if (owner !== undefined) MutableHashMap.set(edges, name, owner);
				else MutableHashSet.add(unnameable, name);
				continue;
			}
			const bare = `${name}@${info.version}`;
			if (MutableHashSet.has(instanceIds, bare)) MutableHashMap.set(edges, name, bare);
			// The alias reading: the recorded version is the referenced instance's
			// own key (`realname@realversion(peers)`), which a plain version never is.
			else if (MutableHashSet.has(instanceIds, info.version)) MutableHashMap.set(edges, name, info.version);
			else MutableHashSet.add(unnameable, name);
		}
	}
	// Map-backed until the last step: `Object.fromEntries` defines own data
	// properties, so a "__proto__" dependency name neither pollutes nor drops.
	return { resolved: R.fromEntries(edges), unresolvedEdges: A.sort(unnameable, Order.String) };
};

const toVersionMap = (
	deps: Record<string, { readonly specifier: string; readonly version: string }> | undefined,
): Record<string, string> | undefined => {
	if (deps === undefined) return undefined;
	// Object.fromEntries defines own data properties, so a "__proto__" key
	// neither pollutes nor drops.
	return R.fromEntries(R.toEntries(deps).map(([name, info]) => [name, info.specifier]));
};

const importerDepGroups = (importer: PnpmImporterType) =>
	[importer.dependencies, importer.devDependencies, importer.peerDependencies, importer.optionalDependencies] as const;

const toFields = Effect.fn("toFields")(function* (raw: PnpmLockfileRawType): Effect.fn.Return<LockfileFields, ParseFailure> {
	const workspaceEntries = MutableHashMap.empty<string, WorkspaceEntry>();
	let workspaceNames = HashSet.fromIterable<string>([]);
	const importers: Array<LockfileImporter> = [];

	for (const [importerPath, importer] of R.toEntries(raw.importers)) {
		if (importerPath === "") continue; // a nameless importer cannot be modeled; skip, never throw

		// pnpm records `{ specifier, version }` per importer dependency; a blank
		// version means the section carries only a specifier. The recorded
		// version may carry a peer-disambiguation suffix — the shared builder
		// splits it (splitPeerSuffix) into `version` + `peerSuffix`.
		importers.push(
			LockfileImporter.make({
				path: importerPath,
				dependencies: importerDependencies(importer, (info) => ({
					specifier: info.specifier,
					version: info.version,
				})),
			}),
		);

		const deps = toVersionMap(importer.dependencies);
		const devDeps = toVersionMap(importer.devDependencies);
		const peerDeps = toVersionMap(importer.peerDependencies);
		const optDeps = toVersionMap(importer.optionalDependencies);
		MutableHashMap.set(workspaceEntries, importerPath, {
			...O.getSomesStruct({ dependencies: O.fromUndefinedOr(deps) }),
			...O.getSomesStruct({ devDependencies: O.fromUndefinedOr(devDeps) }),
			...O.getSomesStruct({ peerDependencies: O.fromUndefinedOr(peerDeps) }),
			...O.getSomesStruct({ optionalDependencies: O.fromUndefinedOr(optDeps) }),
		});

		for (const group of importerDepGroups(importer)) {
			if (group === undefined) continue;
			for (const [name, info] of R.toEntries(group)) {
				if (name !== "" && info.version.startsWith("link:")) {
					workspaceNames = HashSet.add(workspaceNames, name);
				}
			}
		}
	}

	for (const path of R.keys(raw.importers)) {
		if (path !== "." && path !== "") {
			workspaceNames = HashSet.add(workspaceNames, path);
		}
	}

	const packages: Array<ResolvedPackage> = [];

	// One row per *instance*: one per `snapshots:` entry, because `packages:`
	// is per-*version* metadata and collapses every peer-resolved variant onto
	// one key. An empty (or absent) `snapshots:` map is valid — a workspace
	// with no dependencies has no instances to record — and simply yields no
	// snapshot rows. Importer paths join the id space because a `link:` edge
	// names one.
	const snapshots = raw.snapshots;
	const instanceIds = MutableHashSet.fromIterable<string>([
		...(snapshots !== undefined ? R.keys(snapshots) : []),
		...(raw.packages !== undefined ? R.keys(raw.packages) : []),
		...R.keys(raw.importers),
	]);
	// Importer paths alone — the ancestor walk that resolves a `linkDirectory`
	// target must not match a `name@version` key, and must not treat the root
	// importer as every path's owner.
	const importerPaths = MutableHashSet.fromIterable<string>(R.keys(raw.importers).filter((path) => path !== "." && path !== ""));
	// Normalized `<importerPath>/<publishDirectory>` → importer instance id,
	// for every importer that declares one. This is the exact evidence that
	// names a `link:` into a publish directory: the importer itself declared
	// which build directory its links point at, so consulting the map is a
	// lookup of the lockfile's own claim, not a guess — which is why even the
	// root importer "." participates (its key is the normalized
	// publishDirectory alone), despite being excluded from the ancestor walk.
	const publishDirTargets = MutableHashMap.empty<string, string>();
	for (const [importerPath, importer] of R.toEntries(raw.importers)) {
		if (importerPath === "") continue;
		if (importer.publishDirectory === undefined) continue;
		// The root importer's path is "." — resolveLinkTarget skips "." segments,
		// so passing it through normalizes both shapes identically.
		const key = resolveLinkTarget(importerPath, importer.publishDirectory);
		if (key !== undefined) MutableHashMap.set(publishDirTargets, key, importerPath);
	}
	const emitted = MutableHashSet.empty<string>();

	for (const [importerPath, importer] of R.toEntries(raw.importers)) {
		if (importerPath === "." || importerPath === "") continue;
		// No peers here by design: a pnpm lockfile records a workspace
		// project's *resolved* dependencies only, never its own peer
		// declarations — probed against pnpm 11.22.0 both with and without
		// autoInstallPeers. Workspace rows keep the empty peer defaults, and the
		// importer path is both the name and the instance id.
		packages.push(
			ResolvedPackage.make({
				name: importerPath,
				version: "0.0.0",
				instanceId: importerPath,
				isWorkspace: true,
				relativePath: importerPath,
				...resolveImporterEdges(importer, importerPath, instanceIds, importerPaths, publishDirTargets),
			}),
		);
	}

	const emit = Effect.fnUntraced(function*(
		instanceId: string,
		meta: PnpmPackageEntry | undefined,
		edges: ReadonlyArray<Readonly<Record<string, string>> | undefined>,
	) {
		// Keys may carry a peer-resolution suffix — "fdir@6.5.0(picomatch@4.0.4)",
		// "lib@file:vendor/lib(react@18.3.1)" — whose inner "@" would corrupt
		// the split; splitPeerSuffix (the one stripping implementation, shared
		// with the importer path) drops it first.
		const split = splitNameVersion(splitPeerSuffix(instanceId).plain);
		if (split === undefined) return; // malformed "name@version" keys are skipped, never thrown on
		const { name, version } = split;
		const integrity = yield* toIntegrityHash(meta?.resolution?.integrity);
		MutableHashSet.add(emitted, instanceId);
		packages.push(
			ResolvedPackage.make({
				name,
				version,
				instanceId,
				...O.getSomesStruct({ integrity: O.fromUndefinedOr(integrity) }),
				isWorkspace: false,
				...peerDeclarations(meta?.peerDependencies, meta?.peerDependenciesMeta, undefined),
				...resolveEdges(edges, instanceIds, publishDirTargets),
			}),
		);
	});

	if (snapshots !== undefined) {
		for (const [key, snapshot] of R.toEntries(snapshots)) {
			// Peer declarations live on the matching per-version `packages:` entry,
			// which is keyed by the plain "name@version" the suffix hangs off.
			// Own-property lookup, matching the rest of this package: a key-shaped
			// intermediate is never read through the prototype chain.
			const plain = splitPeerSuffix(key).plain;
			const meta = raw.packages !== undefined && R.has(raw.packages, plain) ? raw.packages[plain] : undefined;
			yield* emit(key, meta, [snapshot.dependencies, snapshot.optionalDependencies]);
		}
	}

	// Which `packages:` keys a snapshot already spoke for.
	const covered = MutableHashSet.fromIterable([...emitted].map((key) => splitPeerSuffix(key).plain));

	if (raw.packages !== undefined) {
		for (const [key, pkg] of R.toEntries(raw.packages)) {
			// A `packages:` entry no snapshot covers is an orphan — still emitted
			// rather than dropped, since an unexplained disappearance is the worse
			// failure. It carries no resolution, which is honest: none was recorded.
			if (MutableHashSet.has(covered, key)) continue;
			yield* emit(key, pkg, [pkg.dependencies, pkg.optionalDependencies]);
		}
	}

	const workspaceDependencies = extractWorkspaceDeps(workspaceEntries, workspaceNames);

	const extension = PnpmExtension.make({
		...O.getSomesStruct({ catalogs: O.fromUndefinedOr(raw.catalogs) }),
		...O.getSomesStruct({ overrides: O.fromUndefinedOr(raw.overrides) }),
		...O.getSomesStruct({ settings: O.fromUndefinedOr(raw.settings) }),
	});

	return {
		lockfileVersion: String(raw.lockfileVersion),
		packages,
		workspaceDependencies,
		importers,
		extension,
	};
});
