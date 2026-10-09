import * as MutableHashMap from "effect/MutableHashMap";
import * as Match from "effect/Match";
import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { dual } from "effect/Function";
import { BunExtension } from "./BunExtension.ts";
import { parseBun } from "./internal/bun.ts";
import { parseNpm } from "./internal/npm.ts";
import { parsePnpm } from "./internal/pnpm.ts";
import type { LockfileFields, ParseFailure } from "./internal/shared.ts";
import { parseYarn } from "./internal/yarn.ts";
import { LockfileFormat } from "./LockfileFormat.ts";
import { LockfileImporter } from "./LockfileImporter.ts";
import { PnpmExtension } from "./PnpmExtension.ts";
import { ResolvedPackage } from "./ResolvedPackage.ts";
import { WorkspaceDependency } from "./WorkspaceDependency.ts";

const $I = $ScratchpadId.create("effected/lockfiles/Lockfile");

const EMPTY_IMPORTERS: ReadonlyArray<LockfileImporter> = [];

/**
 * Failure of `Lockfile.parse`: the given content is not a valid lockfile of
 * the requested format.
 *
 * @remarks
 * - `format` — which format was being parsed.
 * - `stage` — `"syntax"` when the text itself failed to parse (YAML, JSON,
 *   JSONC), `"validation"` when the text parsed but did not have the
 *   format's expected shape.
 * - `cause` — the underlying jsonc/yaml/JSON/Schema error, preserved
 *   structurally.
 *
 * Malformed input always exits through this typed failure, never as a
 * defect. Parse takes content, not a path — the caller that did the IO owns
 * any path context.
 *
 * @public
 */
export class LockfileParseError extends S.TaggedError<LockfileParseError>($I`LockfileParseError`)("LockfileParseError", {
	/** The lockfile format that was being parsed. */
	format: LockfileFormat.annotateKey({ description: "The lockfile format that was being parsed." }),
	/** Whether the text itself failed to parse (`"syntax"`) or parsed but had the wrong shape (`"validation"`). */
	stage: S.Literals(["syntax", "validation"]).annotateKey({ description: "Whether the text itself failed to parse (`\"syntax\"`) or parsed but had the wrong shape (`\"validation\"`)." }),
	/** The underlying engine or schema failure, preserved structurally. */
	cause: S.Defect().annotateKey({ description: "The underlying engine or schema failure, preserved structurally." }),
}, $I.annote("LockfileParseError", { description: "Failure of `Lockfile.parse`: the given content is not a valid lockfile of the requested format." })) {
	override get message(): string {
		return this.stage === "syntax"
			? `Failed to parse ${this.format} lockfile: the content is not well-formed`
			: `Failed to parse ${this.format} lockfile: the content does not have the expected ${this.format} shape`;
	}
}

/**
 * Failure of `Lockfile.parse`: the content parsed as text, but no single
 * lockfile document could be located in it.
 *
 * @remarks
 * `pnpm-lock.yaml` is a YAML **stream**. pnpm writes an env preamble document
 * ahead of the lockfile whenever the workspace declares `configDependencies`
 * or `devEngines.packageManager`, so the file holds two documents. The
 * lockfile is the last one — pnpm composes the preamble as a prefix — and a
 * parser that read only the first document would get the preamble: a document
 * that *validates*, yielding a lockfile with an empty workspace. This error
 * makes that case fail instead of succeeding quietly.
 *
 * - `format` — which format was being parsed.
 * - `documents` — how many YAML documents the stream carried.
 * - `reason`:
 *   - `"noLockfileDocument"` — the stream carries no lockfile document:
 *     empty content, or a pnpm stream whose lockfile position is empty. That
 *     includes an env preamble followed by an empty document unless the
 *     caller passes `configOnly`: pnpm writes those same bytes for a
 *     config-dependency-only workspace with no root `package.json` *and* for
 *     a workspace whose first install failed after its config dependencies
 *     were installed, so only the caller can say which it is. With
 *     `configOnly`, `Lockfile.parse` reads that stream as an empty lockfile
 *     versioned by the preamble; an empty lockfile position with no preamble
 *     fails either way.
 *   - `"noImporters"` — the located document declares no importers, so it
 *     describes no workspace. pnpm always records at least the root importer.
 *   - `"unexpectedDocuments"` — the stream carries more documents than the
 *     format's framing defines: several in a format that defines none
 *     (yarn), or more than the env preamble and the lockfile in a pnpm
 *     stream. Rather than silently picking one, parsing refuses to guess.
 *     `Lockfile.parse` and `PnpmEnvLockfile` share one pnpm splitter, so
 *     both enforce the same at-most-two limit.
 *
 * It carries typed fields rather than a `cause`: unlike
 * {@link LockfileParseError}, there is no underlying engine failure to wrap —
 * the text parsed fine.
 *
 * @public
 */
export class LockfileFramingError extends S.TaggedError<LockfileFramingError>($I`LockfileFramingError`)("LockfileFramingError", {
	/** The lockfile format that was being parsed. */
	format: LockfileFormat.annotateKey({ description: "The lockfile format that was being parsed." }),
	/** Which framing check failed; see the class remarks for each. */
	reason: S.Literals(["noLockfileDocument", "noImporters", "unexpectedDocuments"]).annotateKey({ description: "Which framing check failed; see the class remarks for each." }),
	/** How many YAML documents the stream carried. */
	documents: S.Int.annotateKey({ description: "How many YAML documents the stream carried." }),
}, $I.annote("LockfileFramingError", { description: "Failure of `Lockfile.parse`: the content parsed as text, but no single lockfile document could be located in it." })) {
	override get message(): string {
		const detail =
			this.reason === "noImporters"
				? "the lockfile document declares no importers, so it describes no workspace"
				: this.reason === "unexpectedDocuments"
					? this.format === "pnpm"
						? `expected at most two YAML documents (an env preamble and the lockfile) but the content carries ${this.documents}`
						: `expected a single YAML document but the content carries ${this.documents}`
					: `the content carries no lockfile document (${this.documents} YAML document(s) found)`;
		return `Failed to parse ${this.format} lockfile: ${detail}`;
	}
}

/**
 * Materialize an internal {@link ParseFailure} record into the public error
 * union — the one mapping every public fallible boundary shares, so
 * `Lockfile.parse` and `PnpmEnvLockfile.packageManager` cannot disagree about
 * which failure is which.
 *
 * @internal
 */
export const materializeFailure: {
	(failure: ParseFailure): (format: LockfileFormat) => LockfileParseError | LockfileFramingError;
	(format: LockfileFormat, failure: ParseFailure): LockfileParseError | LockfileFramingError;
} = dual(2, (
	format: LockfileFormat,
	failure: ParseFailure,
): LockfileParseError | LockfileFramingError =>
	failure.stage === "framing"
		? LockfileFramingError.make({ format, reason: failure.reason, documents: failure.documents })
		: LockfileParseError.make({ format, stage: failure.stage, cause: failure.cause }));

const dispatch = (
	format: LockfileFormat,
	content: string,
	configOnly: boolean,
): Effect.Effect<LockfileFields, ParseFailure> =>
	Match.value(format).pipe(
		Match.when("bun", () => parseBun(content)),
		Match.when("npm", () => parseNpm(content)),
		Match.when("pnpm", () => parsePnpm(content, configOnly)),
		Match.when("yarn", () => parseYarn(content)),
		Match.exhaustive,
	);

/**
 * The unified lockfile model all four formats normalize into.
 *
 * @remarks
 * - `format` — which lockfile format produced the data.
 * - `lockfileVersion` — the lockfile format version string.
 * - `packages` — every resolved package.
 * - `workspaceDependencies` — inter-workspace dependency edges.
 * - `importers` — each workspace importer's declared dependencies
 *   ({@link LockfileImporter}), keyed by importer path. Populated by the pnpm,
 *   bun and npm parsers; always empty for yarn, which records no importers.
 * - `extension` — format-specific residue (`PnpmExtension` or
 *   `BunExtension`) when the format records any.
 *
 * For pnpm, `Lockfile.parse` emits the honest importer-path-keyed model
 * (workspace packages named by importer path, version `"0.0.0"`);
 * {@link Lockfile.withImporterNames} is the explicit, pure second stage
 * that rewrites those names once the caller has read the workspace
 * manifests. npm, yarn and bun lockfiles carry real names and need no
 * second stage.
 *
 * @public
 */
export class Lockfile extends S.Class<Lockfile>($I`Lockfile`)({
	format: LockfileFormat.annotateKey({ description: "Lockfile format that produced the normalized data: bun, npm, pnpm or yarn Berry" }),
	lockfileVersion: S.String.annotateKey({ description: "Format version recorded by the lockfile" }),
	packages: S.Array(ResolvedPackage).annotateKey({ description: "Resolved package instances, including workspace packages and separate instances for different peer contexts" }),
	workspaceDependencies: S.Array(WorkspaceDependency).annotateKey({ description: "Directed dependency edges between workspace packages, carrying their declared constraints and dependency sections" }),
	importers: S.Array(LockfileImporter).pipe(
		// The decoding default is the *encoded* empty array (a fresh `[]` literal,
		// which is assignable to the encoded side); the constructor default is the
		// decoded empty array. Both are empty, so the runtime value is identical.
		S.withDecodingDefaultKey(Effect.succeed([])),
		S.withConstructorDefault(Effect.succeed(EMPTY_IMPORTERS)),
	).annotateKey({ description: "Workspace importers and their declared dependencies, identified by root-relative path; empty for yarn" }),
	extension: S.optionalKey(S.Union([PnpmExtension, BunExtension])).annotateKey({ description: "Optional pnpm- or bun-specific metadata preserved alongside the normalized lockfile model" }),
}, $I.annote("Lockfile", { description: "The unified lockfile model all four formats normalize into." })) {
	/** Lazily built name → packages index; deliberately outside the schema, never encodes. */
	#nameIndex: MutableHashMap.MutableHashMap<string, ReadonlyArray<ResolvedPackage>> | undefined;

	/** Lazily built importer-path → importer index; deliberately outside the schema, never encodes. */
	#importerIndex: MutableHashMap.MutableHashMap<string, LockfileImporter> | undefined;

	/** Lazily built instance-id → package index; deliberately outside the schema, never encodes. */
	#instanceIndex: MutableHashMap.MutableHashMap<string, ResolvedPackage> | undefined;

	/**
	 * Parse lockfile content of a known format into the unified model — the
	 * package's only fallible boundary.
	 *
	 * @param content - The lockfile text (this package does no IO; the caller
	 *   reads the file).
	 * @param options - `format` is the lockfile format to parse as.
	 *   `configOnly` is the caller's assertion that the workspace has **no root
	 *   `package.json`**, so a pnpm env preamble followed by an empty main
	 *   document is a config-dependency-only workspace and reads as an empty
	 *   lockfile versioned by the preamble. Without it that stream fails
	 *   {@link LockfileFramingError} with `noLockfileDocument`, because the same
	 *   bytes are also what an interrupted first install leaves behind. It
	 *   loosens nothing else, and is ignored for non-pnpm formats.
	 * @returns An `Effect` succeeding with the {@link Lockfile}, or failing
	 *   with {@link LockfileParseError} (malformed text or the wrong shape) or
	 *   {@link LockfileFramingError} (the text parsed, but no lockfile document
	 *   could be located in the stream — see that error for why a
	 *   multi-document `pnpm-lock.yaml` needs it).
	 */
	static readonly parse = Effect.fn("Lockfile.parse")(function* (
		content: string,
		options: { readonly format: LockfileFormat; readonly configOnly?: boolean | undefined },
	) {
		const fields = yield* dispatch(options.format, content, options.configOnly === true).pipe(
			Effect.mapError((failure) => materializeFailure(options.format, failure)),
		);
		return Lockfile.make({
			format: options.format,
			lockfileVersion: fields.lockfileVersion,
			packages: fields.packages,
			workspaceDependencies: fields.workspaceDependencies,
			importers: fields.importers,
			...O.getSomesStruct({ extension: O.fromUndefinedOr(fields.extension) }),
		});
	});

	/**
	 * Rewrite pnpm importer-path names to real package names — the explicit
	 * second stage of pnpm parsing. Total and pure.
	 *
	 * @remarks
	 * Workspace packages whose `relativePath` appears in `names` are renamed;
	 * dependency edge ends are rewritten through the same map. Entries not in
	 * the map keep their path name, and non-pnpm lockfiles are unaffected (no
	 * key matches). Versions are not touched — pnpm workspace packages keep
	 * `"0.0.0"` (the lockfile does not record their real versions).
	 *
	 * @param names - Importer path → real package name.
	 * @returns A new {@link Lockfile} with names rewritten.
	 */
	withImporterNames(names: ReadonlyMap<string, string>): Lockfile {
		const packages = this.packages.map((pkg) => {
			if (!pkg.isWorkspace || pkg.relativePath === undefined) return pkg;
			const realName = names.get(pkg.relativePath);
			if (realName === undefined || realName === "" || realName === pkg.name) return pkg;
			// Every field carries over: this rewrites the *name*, and dropping any
			// other field here would be silent data loss (the peer and resolved
			// maps in particular are what a peer check reads).
			return ResolvedPackage.make({
				name: realName,
				version: pkg.version,
				instanceId: pkg.instanceId,
				...O.getSomesStruct({ integrity: O.fromUndefinedOr(pkg.integrity) }),
				isWorkspace: pkg.isWorkspace,
				relativePath: pkg.relativePath,
				dependencies: pkg.dependencies,
				peerDependencies: pkg.peerDependencies,
				peerDependenciesMeta: pkg.peerDependenciesMeta,
				resolved: pkg.resolved,
				unresolvedEdges: pkg.unresolvedEdges,
			});
		});
		const workspaceDependencies = this.workspaceDependencies.map((dep) => {
			const mappedFrom = names.get(dep.from);
			const mappedTo = names.get(dep.to);
			const from = mappedFrom === undefined || mappedFrom === "" ? dep.from : mappedFrom;
			const to = mappedTo === undefined || mappedTo === "" ? dep.to : mappedTo;
			if (from === dep.from && to === dep.to) return dep;
			return WorkspaceDependency.make({ from, to, depType: dep.depType, constraint: dep.constraint });
		});
		// Importers stay untouched: they are keyed by importer path, not by
		// package name, so a name-rewrite does not apply to them.
		return Lockfile.make({
			format: this.format,
			lockfileVersion: this.lockfileVersion,
			packages,
			workspaceDependencies,
			importers: this.importers,
			...O.getSomesStruct({ extension: O.fromUndefinedOr(this.extension) }),
		});
	}

	/**
	 * Every resolved package with the given name — one entry per resolved
	 * version. Backed by a lazily built index, so repeated lookups are O(1).
	 *
	 * @param name - The package name to look up.
	 * @returns The matching packages, empty when the name is not in the
	 *   lockfile.
	 */
	packagesNamed(name: string): ReadonlyArray<ResolvedPackage> {
		if (this.#nameIndex === undefined) {
			const index = MutableHashMap.empty<string, Array<ResolvedPackage>>();
			for (const pkg of this.packages) {
				const bucket = O.getOrUndefined(MutableHashMap.get(index, pkg.name));
				if (bucket === undefined) {
					MutableHashMap.set(index, pkg.name, [pkg]);
				} else {
					bucket.push(pkg);
				}
			}
			this.#nameIndex = index;
		}
		return O.getOrUndefined(MutableHashMap.get(this.#nameIndex, name)) ?? [];
	}

	/**
	 * The importer at the given path — `"."` for the workspace root — or
	 * `Option.none()` when the lockfile records no importer there. Backed by a
	 * lazily built index, so repeated lookups are O(1). The index is a `Map`,
	 * so an attacker-adjacent path (`__proto__`, `constructor`) neither pollutes
	 * nor collides.
	 *
	 * @param path - The importer path to look up.
	 * @returns The matching {@link LockfileImporter}, or `Option.none()`.
	 */
	importer(path: string): O.Option<LockfileImporter> {
		if (this.#importerIndex === undefined) {
			const index = MutableHashMap.empty<string, LockfileImporter>();
			for (const imp of this.importers) MutableHashMap.set(index, imp.path, imp);
			this.#importerIndex = index;
		}
		return MutableHashMap.get(this.#importerIndex, path);
	}

	/**
	 * The resolved package with the given instance id, or `Option.none()` when
	 * the lockfile records none. Backed by a lazily built index, so repeated
	 * lookups are O(1) and a consumer that never walks edges pays nothing.
	 *
	 * @remarks
	 * `ResolvedPackage.instanceId` is what a resolved edge points at, so peer and
	 * dependency resolution is a lookup through this index rather than a scan
	 * over `packages`.
	 *
	 * The index is a `Map`, so an instance id that collides with an `Object`
	 * member name (`__proto__`, `constructor`) neither pollutes nor
	 * false-matches, exactly as for {@link Lockfile.importer}.
	 *
	 * @param instanceId - The instance id to look up.
	 * @returns The matching {@link ResolvedPackage}, or `Option.none()`.
	 */
	packageByInstanceId(instanceId: string): O.Option<ResolvedPackage> {
		if (this.#instanceIndex === undefined) {
			const index = MutableHashMap.empty<string, ResolvedPackage>();
			// First wins, so the answer is stable if a malformed lockfile repeats
			// an id rather than depending on iteration order.
			for (const pkg of this.packages) {
				if (!MutableHashMap.has(index, pkg.instanceId)) MutableHashMap.set(index, pkg.instanceId, pkg);
			}
			this.#instanceIndex = index;
		}
		return MutableHashMap.get(this.#instanceIndex, instanceId);
	}

	/** The workspace-local packages. */
	get workspacePackages(): ReadonlyArray<ResolvedPackage> {
		return this.packages.filter((pkg) => pkg.isWorkspace);
	}
}
