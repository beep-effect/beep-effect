// Workspace discovery: read the `packages:` patterns, enumerate them, decode a
// WorkspacePackage per directory.
//
// It also owns file → owning-package resolution (longest-prefix), which is a
// lookup over discovery output rather than a concern of its own.
//
// It is also where `@effected/npm`'s `WorkspaceResolver` contract is
// implemented: `versionOf` is a lookup over the discovered package list.

import { GlobSet } from "../glob/index.ts";
import { DependencyResolutionError, WorkspaceResolver } from "../npm/index.ts";
import { Context, Duration, Effect, Exit, FileSystem, Layer, Option, Path, Schema } from "effect";
import type { EnumerationFailureKind } from "./internal/enumerate.ts";
import { enumerate } from "./internal/enumerate.ts";
import { findLayerRoot } from "./internal/layerRoot.ts";
import { readPatterns } from "./internal/patterns.ts";
import { WorkspacePackage } from "./WorkspacePackage.ts";
import type { WorkspaceRootNotFoundError } from "./WorkspaceRoot.ts";
import { WorkspaceRoot } from "./WorkspaceRoot.ts";

/**
 * Raised when a workspace member's `package.json` cannot be read, parsed, or
 * used — it is missing, malformed, or lacks a `name`.
 *
 * @remarks
 * `kind` is the discriminant a caller branches on; `cause` preserves the
 * originating failure rather than flattening it into a sentence.
 *
 * A manifest with no `version` is NOT a failure: pnpm accepts a version-less
 * private package and a private monorepo root without one is the ordinary
 * shape, so the member is discovered with `WorkspacePackage.version` absent.
 * Only ABSENCE is tolerated: a
 * `version` that is present but not a string — or present and `""`, which pnpm
 * never wrote and which would resolve `workspace:^` to a bare `"^"` — is the
 * manifest's shape being wrong and reports `invalidShape`.
 *
 * @public
 */
export class WorkspaceDiscoveryError extends Schema.TaggedError<WorkspaceDiscoveryError>()("WorkspaceDiscoveryError", {
	/** The workspace root discovery was running against. */
	root: Schema.String,
	/** The file that failed. */
	path: Schema.String,
	/** What went wrong with it. */
	kind: Schema.Literals(["read", "invalidJson", "invalidShape", "invalidYaml", "missingName"]),
	/** The originating failure, if there was one. */
	cause: Schema.Defect(),
}) {
	/** Renders the failing file and kind into a one-line message. */
	override get message(): string {
		return `Workspace discovery failed at ${this.path} (${this.kind})`;
	}
}

/**
 * Raised when a `packages:` pattern cannot be enumerated: its base directory is
 * absent (usually a typo), the descent exceeded its depth cap, or the visit
 * budget was exhausted.
 *
 * @public
 */
export class WorkspacePatternError extends Schema.TaggedError<WorkspacePatternError>()("WorkspacePatternError", {
	/** The workspace root the patterns were expanded against. */
	root: Schema.String,
	/** The offending pattern, verbatim. */
	pattern: Schema.String,
	/** Why it could not be enumerated. */
	kind: Schema.Literals(["missingBaseDir", "uncompilable", "depthExceeded", "budgetExceeded", "unreadableDirectory"]),
	/** A short, structured detail — the missing directory, or the bound exceeded. */
	detail: Schema.String,
}) {
	/** Renders the pattern and failure kind into a one-line message. */
	override get message(): string {
		return `Workspace pattern "${this.pattern}" could not be enumerated (${this.kind}: ${this.detail})`;
	}
}

/**
 * Raised when a workspace package is requested by a name no member carries.
 *
 * @remarks
 * `available` lists every known member, which is what makes the error
 * actionable — a typo is obvious next to the list it missed.
 *
 * @public
 */
export class PackageNotFoundError extends Schema.TaggedError<PackageNotFoundError>()("PackageNotFoundError", {
	/** The name that was requested. */
	name: Schema.String,
	/** Every workspace package name that does exist. */
	available: Schema.Array(Schema.String),
}) {
	/** Renders the requested name into a one-line message. */
	override get message(): string {
		return `No workspace package named "${this.name}"`;
	}
}

/**
 * Top-level facts about a workspace: where it is, what manages it, and the
 * patterns that define its membership.
 *
 * @public
 */
export class WorkspaceInfo extends Schema.Class<WorkspaceInfo>("WorkspaceInfo")({
	/** Absolute path to the workspace root. */
	root: Schema.String,
	/** The `packages:` patterns, verbatim. */
	patterns: Schema.Array(Schema.String),
}) {}

/**
 * Every failure `WorkspaceDiscovery.getPackage` can surface: the discovery
 * failures plus a name that matches no member.
 *
 * @public
 */
export type WorkspaceLookupFailure =
	| WorkspaceRootNotFoundError
	| WorkspaceDiscoveryError
	| WorkspacePatternError
	| PackageNotFoundError;

/**
 * The error channel of the discovery methods that do not look a package up by
 * name — everything except `getPackage`.
 *
 * @public
 */
export type WorkspaceDiscoveryFailure = Exclude<WorkspaceLookupFailure, PackageNotFoundError>;

/** The enumeration failure kinds map straight onto the pattern-error kinds. */
const patternKindOf = (
	kind: EnumerationFailureKind,
): "missingBaseDir" | "depthExceeded" | "budgetExceeded" | "unreadableDirectory" => kind;

/**
 * Options for the {@link WorkspaceDiscovery} layer.
 *
 * @public
 */
export interface WorkspaceDiscoveryOptions {
	/**
	 * The directory the workspace root is resolved from.
	 *
	 * @defaultValue `process.cwd()`, read lazily on first use — so a
	 *   `process.chdir` between providing the layer and the first call is
	 *   honoured.
	 */
	readonly cwd?: string;
	/**
	 * A ceiling for the layer-bound root ascent from `cwd`, passed straight
	 * through to the `stopAt` of {@link WorkspaceRoot}'s `find`.
	 *
	 * @remarks
	 * Inclusive: the ceiling itself is probed, so a `cwd` that is its own
	 * workspace root still resolves with `stopAt: cwd`. A relative ceiling is
	 * resolved against the process working directory, exactly as `cwd` is. When
	 * no root is found at or below the ceiling, the methods fail with
	 * {@link WorkspaceRootNotFoundError} carrying the resolved `stopAt`, rather
	 * than adopting an enclosing directory's workspace — pass `stopAt: cwd` for
	 * a checkout nested inside someone else's monorepo.
	 *
	 * Applies ONLY to the layer-bound methods (`info`, `listPackages`,
	 * `importerMap`, `getPackage`, `resolveFile`, `resolveFiles`). The per-call
	 * `infoIn`, `listPackagesIn` and `refreshIn` resolve from an arbitrary
	 * directory the caller names, which a single layer-level ceiling cannot
	 * sensibly bound, so they ascend unbounded.
	 *
	 * `LockfileReader`, `WorkspaceCatalogs` and `WorkspaceSnapshots` each
	 * take the same option; give them the same value when wiring by hand, or let a `Workspaces.*` composite forward one
	 * `stopAt` to all of them, so no service adopts a root another refused.
	 *
	 * @defaultValue no ceiling — the ascent runs to the filesystem root.
	 */
	readonly stopAt?: string | undefined;
	/** Descent cap for segment-crossing patterns. Defaults to 32. */
	readonly maxDepth?: number;
}

/**
 * The {@link WorkspaceDiscovery} service shape.
 *
 * @public
 */
export interface WorkspaceDiscoveryShape {
	/** Facts about the resolved workspace. */
	readonly info: () => Effect.Effect<WorkspaceInfo, WorkspaceDiscoveryFailure>;
	/** Every workspace package, root first, then the rest sorted by relative path. */
	readonly listPackages: () => Effect.Effect<ReadonlyArray<WorkspacePackage>, WorkspaceDiscoveryFailure>;
	/** The discovered packages keyed by their root-relative importer path. */
	readonly importerMap: () => Effect.Effect<ReadonlyMap<string, WorkspacePackage>, WorkspaceDiscoveryFailure>;
	/** A single package by name. */
	readonly getPackage: (name: string) => Effect.Effect<WorkspacePackage, WorkspaceLookupFailure>;
	/** The package owning an absolute file path, by longest-prefix match. */
	readonly resolveFile: (filePath: string) => Effect.Effect<Option.Option<WorkspacePackage>, WorkspaceDiscoveryFailure>;
	/** The distinct packages owning any of `filePaths`. */
	readonly resolveFiles: (
		filePaths: ReadonlyArray<string>,
	) => Effect.Effect<ReadonlyArray<WorkspacePackage>, WorkspaceDiscoveryFailure>;
	/**
	 * Facts about the workspace containing `directory`, discovered against THAT
	 * root rather than the layer-bound one.
	 */
	readonly infoIn: (directory: string) => Effect.Effect<WorkspaceInfo, WorkspaceDiscoveryFailure>;
	/**
	 * Every package of the workspace containing `directory`, discovered against
	 * THAT root rather than the layer-bound one.
	 *
	 * @remarks
	 * For a **long-lived host serving many roots** — an MCP server or a language
	 * server that resolves one workspace at startup and then answers calls
	 * scoped to a git worktree, a nested repository, or another project
	 * entirely. The layer-bound {@link WorkspaceDiscoveryShape.listPackages}
	 * answers about the root discovered from `options.cwd`, which such a host
	 * has no way to vary per call without building a fresh layer.
	 *
	 * **This re-reads; it does not re-root.** The tempting cheap fix — take the
	 * layer's package list and rewrite each `path` onto the caller's directory —
	 * produces correct-looking paths over the ORIGINAL root's manifests, so a
	 * worktree whose branch adds, removes or renames a package reports the other
	 * branch's membership with no error. Patterns, member manifests, names and
	 * versions all come from beneath `directory`'s own root here.
	 *
	 * `directory` may be the workspace root or anything inside it: the root is
	 * resolved by the same upward walk the layer-bound path uses, and results are
	 * memoized per RESOLVED root, so many directories in one workspace share one
	 * discovery. The memo holds one entry per distinct root for the layer's
	 * lifetime; {@link WorkspaceDiscoveryShape.refresh} drops all of them.
	 *
	 * @param directory - Absolute path to the workspace root, or to any
	 *   directory inside it.
	 */
	readonly listPackagesIn: (
		directory: string,
	) => Effect.Effect<ReadonlyArray<WorkspacePackage>, WorkspaceDiscoveryFailure>;
	/**
	 * Drop every memoized discovery — the layer-bound one and each per-root memo
	 * — so the next call re-reads the filesystem.
	 */
	readonly refresh: () => Effect.Effect<void>;
	/**
	 * Drop only the memo for the workspace containing `directory`, leaving the
	 * layer-bound memo and every other root's untouched.
	 *
	 * @remarks
	 * The precise counterpart to {@link WorkspaceDiscoveryShape.refresh} for a
	 * host serving several roots: refreshing one worktree because it changed
	 * should not discard sibling worktrees that did not, which is all `refresh`
	 * can do.
	 *
	 * **Fails typed on a directory in no workspace**, exactly as
	 * {@link WorkspaceDiscoveryShape.listPackagesIn} does for the same input —
	 * the three per-root methods answer a bad path the same way, and a caller
	 * that would rather treat it as a no-op writes `Effect.ignore`. Refreshing a
	 * root that HAS no memo is an ordinary no-op and not an error.
	 *
	 * @param directory - Absolute path to the workspace root, or to any
	 *   directory inside it.
	 */
	readonly refreshIn: (directory: string) => Effect.Effect<void, WorkspaceRootNotFoundError>;
}

/**
 * Discovers the packages of a workspace.
 *
 * @remarks
 * Layer construction is O(1): the root walk, pattern read, enumeration and
 * per-package decode all happen on the first method call and are memoized for
 * the lifetime of the layer. A Vitest reporter that builds the layer per call
 * site and never queries it pays nothing.
 *
 * The memo is **success-only**: a failure or interrupt is not cached, so an
 * init interrupted by an unrelated timeout cannot brick the layer, and the next
 * call retries.
 *
 * @example
 * ```ts
 * import { WorkspaceDiscovery } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const discovery = yield* WorkspaceDiscovery;
 *   const packages = yield* discovery.listPackages();
 *   return packages.map((p) => p.name);
 * });
 * ```
 *
 * @public
 */
export class WorkspaceDiscovery extends Context.Service<WorkspaceDiscovery, WorkspaceDiscoveryShape>()(
	"@effected/workspaces/WorkspaceDiscovery",
) {
	/**
	 * Builds the service. Root resolution is one explicit concern: `cwd` is an
	 * option here, never an ambient `process.cwd()` read inside a method.
	 */
	static readonly make = (
		options?: WorkspaceDiscoveryOptions,
	): Effect.Effect<WorkspaceDiscoveryShape, never, WorkspaceRoot | FileSystem.FileSystem | Path.Path> =>
		Effect.gen(function* () {
			const roots = yield* WorkspaceRoot;
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;

			/** Read one `package.json` into the tolerant discovery projection. */
			const readPackage = (
				root: string,
				directory: string,
				relativePath: string,
			): Effect.Effect<WorkspacePackage, WorkspaceDiscoveryError> =>
				Effect.gen(function* () {
					const packageJsonPath = path.join(directory, "package.json");
					const content = yield* fs
						.readFileString(packageJsonPath)
						.pipe(
							Effect.mapError(
								(cause) => new WorkspaceDiscoveryError({ root, path: packageJsonPath, kind: "read", cause }),
							),
						);
					const parsed = yield* Effect.try({
						try: () => JSON.parse(content) as unknown,
						catch: (cause) => new WorkspaceDiscoveryError({ root, path: packageJsonPath, kind: "invalidJson", cause }),
					});

					// `JSON.parse` never returns `undefined`, so a guard on `undefined`
					// alone does not cover a manifest whose entire content is `null`, `42`
					// or `"x"` — all of which parse fine. Reading `.name` off `null` would
					// throw a TypeError, i.e. malformed input escaping as a DEFECT.
					//
					// This is `invalidShape`, NOT `invalidJson`: the text is perfectly valid
					// JSON. What is wrong is that it does not denote an object.
					if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
						return yield* Effect.fail(
							new WorkspaceDiscoveryError({
								root,
								path: packageJsonPath,
								kind: "invalidShape",
								cause: new Error("package.json is not a JSON object"),
							}),
						);
					}
					const raw = parsed as Record<string, unknown>;

					const name = raw.name;
					if (typeof name !== "string" || name.length === 0) {
						return yield* Effect.fail(
							new WorkspaceDiscoveryError({
								root,
								path: packageJsonPath,
								kind: "missingName",
								cause: undefined,
							}),
						);
					}
					// `version` is optional, and optional means ABSENT — not "any present
					// value counts". A present non-string is the manifest's shape being
					// wrong, and so is `""`: pnpm never wrote that shape, and admitting
					// it resolves `workspace:^` to a bare `"^"` and makes `versionOf`
					// answer `some("")`, which every consumer downstream reads as a real
					// version. Both are `invalidShape`, with the sentence the sync facade
					// attaches to the same skip.
					const version = raw.version;
					if (version !== undefined && typeof version !== "string") {
						return yield* Effect.fail(
							new WorkspaceDiscoveryError({
								root,
								path: packageJsonPath,
								kind: "invalidShape",
								cause: new Error(`version must be a string, got ${typeof version}`),
							}),
						);
					}
					if (version === "") {
						return yield* Effect.fail(
							new WorkspaceDiscoveryError({
								root,
								path: packageJsonPath,
								kind: "invalidShape",
								cause: new Error("version must be a non-empty string"),
							}),
						);
					}
					// The tolerant projection: decoded through the schema, so a malformed
					// field fails typed rather than corrupting the model — but never
					// through package-json's strict semver `Package`, which would fail
					// discovery for the whole repo over one odd version string. `version`
					// rides through as the manifest has it: absent stays absent (pnpm
					// accepts a version-less private package; a private root without one
					// is the ordinary shape), a non-empty string verbatim.
					return yield* Schema.decodeUnknownEffect(WorkspacePackage)({
						name,
						...(version !== undefined ? { version } : {}),
						path: directory,
						packageJsonPath,
						relativePath,
						// The root the ascent already resolved, carried rather than dropped
						// for consumers to reconstruct by segment arithmetic.
						workspaceRoot: root,
						// The as-read record rides along so consumers reach fields outside
						// the discovery slice without a second file read.
						manifestRecord: raw,
						...(typeof raw.private === "boolean" ? { private: raw.private } : {}),
						...(isStringRecord(raw.dependencies) ? { dependencies: raw.dependencies } : {}),
						...(isStringRecord(raw.devDependencies) ? { devDependencies: raw.devDependencies } : {}),
						...(isStringRecord(raw.peerDependencies) ? { peerDependencies: raw.peerDependencies } : {}),
						...(isStringRecord(raw.optionalDependencies) ? { optionalDependencies: raw.optionalDependencies } : {}),
						...(raw.publishConfig !== undefined && raw.publishConfig !== null
							? { publishConfig: raw.publishConfig }
							: {}),
					}).pipe(
						Effect.catchTag(
							"SchemaError",
							// A well-formed JSON document whose SHAPE the schema rejects — not a
							// syntax error. A consumer branching on `kind` must be able to tell
							// "this file is not JSON" from "this file is JSON I cannot use".
							(cause) => new WorkspaceDiscoveryError({ root, path: packageJsonPath, kind: "invalidShape", cause }),
						),
					);
				});

			/**
			 * Discovery for ONE already-resolved root — the whole read, with the root
			 * as a parameter rather than a closed-over constant.
			 *
			 * Everything derived here (patterns, member manifests, names, versions) is
			 * read beneath `root`, which is what makes the per-call-root methods
			 * honest: re-rooting an already-discovered package list onto a different
			 * directory rewrites paths but keeps the ORIGINAL root's manifests, so a
			 * branch that adds or removes a package stays invisible. This re-reads.
			 */
			const discoverAt = (
				root: string,
			): Effect.Effect<
				{ readonly info: WorkspaceInfo; readonly packages: ReadonlyArray<WorkspacePackage> },
				WorkspaceDiscoveryFailure
			> =>
				Effect.gen(function* () {
					const patterns = yield* readPatterns(root).pipe(
						Effect.mapError(
							(failure) =>
								new WorkspaceDiscoveryError({
									root,
									path: failure.path,
									kind: failure.kind,
									cause: failure.cause,
								}),
						),
					);

					const globs = yield* GlobSet.compile(patterns).pipe(
						Effect.mapError(
							(error) =>
								new WorkspacePatternError({
									root,
									pattern: error.pattern,
									kind: "uncompilable",
									detail: error.message,
								}),
						),
					);

					const directories = yield* enumerate(root, globs, { maxDepth: options?.maxDepth ?? 32 }).pipe(
						Effect.mapError(
							(failure) =>
								new WorkspacePatternError({
									root,
									pattern: failure.pattern,
									kind: patternKindOf(failure.kind),
									detail: failure.detail,
								}),
						),
					);

					const members = yield* Effect.forEach(
						directories.filter((entry) => entry.relativePath !== "." && entry.path !== root),
						(entry) => readPackage(root, entry.path, entry.relativePath),
						{ concurrency: 10 },
					);

					const rootPackage = yield* readPackage(root, root, ".");
					const packages = [rootPackage, ...members];

					yield* Effect.logDebug("Workspace packages discovered").pipe(
						Effect.annotateLogs({ "workspace.root": root, "workspace.packages.count": packages.length }),
					);

					return { info: WorkspaceInfo.make({ root, patterns }), packages };
				}).pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path));

			const discover: Effect.Effect<
				{ readonly info: WorkspaceInfo; readonly packages: ReadonlyArray<WorkspacePackage> },
				WorkspaceDiscoveryFailure
			> = Effect.gen(function* () {
				// The ambient cwd is read at first use, not at layer construction
				// (`findLayerRoot` suspends).
				const root = yield* findLayerRoot(roots, options);
				return yield* discoverAt(root);
			});

			// Success-only memoization. See the class remarks: a bare `Effect.cached`
			// would memoize an interrupt and permanently brick the layer.
			const [resolveOnce, invalidate] = yield* Effect.cachedInvalidateWithTTL(discover, Duration.infinity);
			const memo = Effect.onExit(resolveOnce, (exit) => (Exit.isSuccess(exit) ? Effect.void : invalidate));

			/**
			 * Per-resolved-root memos for the `…In` methods, each success-only on the
			 * same discipline as the layer-bound one above.
			 *
			 * Deliberately SEPARATE from that memo rather than replacing it: the
			 * layer-bound path resolves its root once, at first use, and folding it
			 * into this map would make every call re-run the root ascent. A caller
			 * that asks for the layer's own root through `listPackagesIn` pays one
			 * extra discovery — the honest price for not changing what the existing
			 * methods do.
			 *
			 * The map grows one entry per distinct root, which is the point for a
			 * long-lived host serving many worktrees, and is why `refresh()` clears
			 * it wholesale rather than invalidating one cell.
			 */
			const rootMemos = new Map<
				string,
				{
					readonly memo: Effect.Effect<
						{ readonly info: WorkspaceInfo; readonly packages: ReadonlyArray<WorkspacePackage> },
						WorkspaceDiscoveryFailure
					>;
					readonly invalidate: Effect.Effect<void>;
				}
			>();

			/** The memoized discovery for the workspace root containing `directory`. */
			const memoIn = Effect.fn("WorkspaceDiscovery.memoIn")(function* (directory: string) {
				// Resolved FIRST, so two directories inside one workspace share a
				// single memo — keying on the caller's path would discover the same
				// workspace once per subdirectory it happens to ask from.
				const root = yield* roots.find(directory);
				const existing = rootMemos.get(root);
				if (existing !== undefined) return yield* existing.memo;
				const [resolveOnce, invalidateOne] = yield* Effect.cachedInvalidateWithTTL(discoverAt(root), Duration.infinity);
				const built = Effect.onExit(resolveOnce, (exit) => (Exit.isSuccess(exit) ? Effect.void : invalidateOne));
				// Re-check under the benign concurrent-miss race: keep whichever cell
				// landed first so callers dedupe onto one.
				const raced = rootMemos.get(root);
				if (raced !== undefined) return yield* raced.memo;
				rootMemos.set(root, { memo: built, invalidate: invalidateOne });
				return yield* built;
			});

			const packages = memo.pipe(Effect.map((state) => state.packages));

			/**
			 * The longest-prefix index, built once per package list.
			 *
			 * Keyed on the package array's identity: the memo hands back the *same*
			 * array on every call, so this is a hit for the whole life of the memo, and
			 * `refresh()` produces a fresh array — a cache miss — which is exactly the
			 * invalidation we want. No staleness is representable.
			 */
			const ownerIndexes = new WeakMap<
				ReadonlyArray<WorkspacePackage>,
				ReadonlyArray<{ readonly prefix: string; readonly package: WorkspacePackage }>
			>();

			const owners = (
				all: ReadonlyArray<WorkspacePackage>,
			): ReadonlyArray<{ readonly prefix: string; readonly package: WorkspacePackage }> => {
				const cached = ownerIndexes.get(all);
				if (cached !== undefined) return cached;
				const index = all
					.map((pkg) => ({
						prefix: pkg.path.endsWith(path.sep) ? pkg.path : pkg.path + path.sep,
						package: pkg,
					}))
					.sort((a, b) => b.prefix.length - a.prefix.length);
				ownerIndexes.set(all, index);
				return index;
			};

			const ownerOf = (
				filePath: string,
				index: ReadonlyArray<{ readonly prefix: string; readonly package: WorkspacePackage }>,
			): Option.Option<WorkspacePackage> => {
				for (const entry of index) {
					if (filePath.startsWith(entry.prefix)) return Option.some(entry.package);
				}
				return Option.none();
			};

			const packageIndexes = new WeakMap<ReadonlyArray<WorkspacePackage>, ReadonlyMap<string, WorkspacePackage>>();

			const packagesByName = (all: ReadonlyArray<WorkspacePackage>): ReadonlyMap<string, WorkspacePackage> => {
				const cached = packageIndexes.get(all);
				if (cached !== undefined) return cached;
				// First-write-wins, matching the `all.find` this index replaced: discovery does not
				// reject duplicate names, and a plain `new Map(all.map(...))` would keep the last.
				const index = new Map<string, WorkspacePackage>();
				for (const pkg of all) {
					if (!index.has(pkg.name)) index.set(pkg.name, pkg);
				}
				packageIndexes.set(all, index);
				return index;
			};

			return {
				info: Effect.fn("WorkspaceDiscovery.info")(function* () {
					const state = yield* memo;
					return state.info;
				}),

				listPackages: Effect.fn("WorkspaceDiscovery.listPackages")(function* () {
					return yield* packages;
				}),

				importerMap: Effect.fn("WorkspaceDiscovery.importerMap")(function* () {
					const all = yield* packages;
					return new Map(all.map((pkg) => [pkg.relativePath, pkg]));
				}),

				getPackage: Effect.fn("WorkspaceDiscovery.getPackage")(function* (name: string) {
					const all = yield* packages;
					const found = packagesByName(all).get(name);
					if (found !== undefined) return found;
					return yield* Effect.fail(new PackageNotFoundError({ name, available: all.map((pkg) => pkg.name) }));
				}),

				resolveFile: Effect.fn("WorkspaceDiscovery.resolveFile")(function* (filePath: string) {
					const all = yield* packages;
					return ownerOf(filePath, owners(all));
				}),

				infoIn: Effect.fn("WorkspaceDiscovery.infoIn")(function* (directory: string) {
					const state = yield* memoIn(directory);
					return state.info;
				}),

				listPackagesIn: Effect.fn("WorkspaceDiscovery.listPackagesIn")(function* (directory: string) {
					const state = yield* memoIn(directory);
					return state.packages;
				}),

				resolveFiles: Effect.fn("WorkspaceDiscovery.resolveFiles")(function* (filePaths: ReadonlyArray<string>) {
					const all = yield* packages;
					const index = owners(all);
					const seen = new Map<string, WorkspacePackage>();
					for (const filePath of filePaths) {
						const owner = ownerOf(filePath, index);
						if (Option.isSome(owner)) seen.set(owner.value.name, owner.value);
					}
					return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
				}),

				refreshIn: Effect.fn("WorkspaceDiscovery.refreshIn")(function* (directory: string) {
					const root = yield* roots.find(directory);
					const cell = rootMemos.get(root);
					if (cell === undefined) return;
					// Invalidate the cell BEFORE dropping the reference: a fiber already
					// holding this memo keeps its own reference, and leaving the cached
					// value live would let that fiber replay a discovery this call was
					// asked to discard.
					yield* cell.invalidate;
					rootMemos.delete(root);
				}),

				refresh: () =>
					Effect.flatMap(
						Effect.forEach([...rootMemos.values()], (cell) => cell.invalidate, { discard: true }),
						() => {
							rootMemos.clear();
							return invalidate;
						},
					),
			};
		});

	/**
	 * The live layer, discovering the workspace from `options.cwd`.
	 *
	 * @remarks
	 * A parameterized layer factory mints a **fresh reference per call**, and
	 * layers memoize by reference — bind the result to a `const` and reuse it
	 * rather than calling `layer(...)` at each composition site.
	 *
	 * @param options - Root resolution and enumeration bounds.
	 */
	static readonly layer = (
		options?: WorkspaceDiscoveryOptions,
	): Layer.Layer<WorkspaceDiscovery, never, WorkspaceRoot | FileSystem.FileSystem | Path.Path> =>
		Layer.effect(WorkspaceDiscovery, WorkspaceDiscovery.make(options));

	/**
	 * An in-memory test double of the service shape, with every method
	 * defaulted so a test stubs only what it exercises.
	 *
	 * @remarks
	 * The defaults model an **empty workspace**, and the derived methods run
	 * over the *effective* `listPackages` — the override when one is supplied —
	 * so stubbing only `listPackages` yields a consistent double:
	 *
	 * - `listPackages` — succeeds with `[]`.
	 * - `importerMap` — derived: the packages keyed by `relativePath`.
	 * - `getPackage` — derived: a name lookup that fails with the service's own
	 *   typed {@link PackageNotFoundError} on a miss, exactly as the live
	 *   implementation does.
	 * - `resolveFile` / `resolveFiles` — derived: longest-prefix ownership over
	 *   `pkg.path`, POSIX-terminated (`"/"`); supply a win32 double explicitly
	 *   if your fixture paths are win32.
	 * - `refresh` — a no-op (`Effect.void`); there is nothing memoized to drop.
	 * - `info` — **dies** with an explanatory defect. No honest default exists
	 *   (a fabricated root path would leak into consumer path logic), so an
	 *   unstubbed `info()` call is a test-wiring mistake and fails loudly as a
	 *   defect rather than succeeding with a lie or failing with a dishonest
	 *   typed error. A defect is not absorbed by `Effect.catch` or any
	 *   typed-error handler — deliberately, so code under test with a
	 *   best-effort `catch` cannot make the mandatory stub look optional; the
	 *   unstubbed call still fails the test.
	 *
	 * @example
	 * ```ts
	 * import { WorkspaceDiscovery, WorkspacePackage } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const double = WorkspaceDiscovery.makeTest({
	 *   listPackages: () =>
	 *     Effect.succeed([
	 *       WorkspacePackage.make({
	 *         name: "@my-org/utils",
	 *         version: "1.0.0",
	 *         path: "/repo/packages/utils",
	 *         packageJsonPath: "/repo/packages/utils/package.json",
	 *         relativePath: "packages/utils",
	 *         workspaceRoot: "/repo",
	 *       }),
	 *     ]),
	 * });
	 * // `getPackage`, `importerMap`, `resolveFile(s)` now answer consistently.
	 * ```
	 */
	static readonly makeTest = (overrides: Partial<WorkspaceDiscoveryShape> = {}): WorkspaceDiscoveryShape => {
		const listPackages = overrides.listPackages ?? (() => Effect.succeed([]));

		// POSIX-terminated longest-prefix ownership, mirroring the live
		// `resolveFile` semantics minus the platform `Path` service.
		const ownerOf = (filePath: string, all: ReadonlyArray<WorkspacePackage>): Option.Option<WorkspacePackage> => {
			let best: WorkspacePackage | undefined;
			let bestLength = 0;
			for (const pkg of all) {
				const prefix = pkg.path.endsWith("/") ? pkg.path : `${pkg.path}/`;
				if (filePath.startsWith(prefix) && prefix.length > bestLength) {
					best = pkg;
					bestLength = prefix.length;
				}
			}
			return Option.fromUndefinedOr(best);
		};

		return {
			listPackages,
			info: () =>
				Effect.die(
					new Error(
						"WorkspaceDiscovery.makeTest: info() was called but not stubbed — no honest default WorkspaceInfo exists for a test double; pass an `info` override.",
					),
				),
			importerMap: () => Effect.map(listPackages(), (all) => new Map(all.map((pkg) => [pkg.relativePath, pkg]))),
			getPackage: (name: string) =>
				Effect.flatMap(listPackages(), (all) => {
					const found = all.find((pkg) => pkg.name === name);
					return found !== undefined
						? Effect.succeed(found)
						: Effect.fail(new PackageNotFoundError({ name, available: all.map((pkg) => pkg.name) }));
				}),
			resolveFile: (filePath: string) => Effect.map(listPackages(), (all) => ownerOf(filePath, all)),
			resolveFiles: (filePaths: ReadonlyArray<string>) =>
				Effect.map(listPackages(), (all) => {
					const seen = new Map<string, WorkspacePackage>();
					for (const filePath of filePaths) {
						const owner = ownerOf(filePath, all);
						if (Option.isSome(owner)) seen.set(owner.value.name, owner.value);
					}
					return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
				}),
			// Both per-root methods DIE unstubbed rather than deriving from
			// `listPackages`. Deriving would model a world in which every root holds
			// the same members — which is exactly the confusion these methods exist to
			// remove, so a double that fabricated it could not discriminate a consumer
			// calling the wrong one. There is no honest default for "what does that
			// OTHER workspace contain".
			infoIn: () =>
				Effect.die(
					new Error(
						"WorkspaceDiscovery.makeTest: infoIn() was called but not stubbed — a double cannot know what another root's workspace looks like; pass an `infoIn` override.",
					),
				),
			listPackagesIn: () =>
				Effect.die(
					new Error(
						"WorkspaceDiscovery.makeTest: listPackagesIn() was called but not stubbed — deriving it from `listPackages` would model every root as identical, which is the bug this method exists to prevent; pass a `listPackagesIn` override.",
					),
				),
			refresh: () => Effect.void,
			// Nothing is memoized in a double, so dropping one root's memo is honestly
			// a no-op — unlike the two reads above, which have no honest default.
			refreshIn: () => Effect.void,
			...overrides,
		};
	};

	/**
	 * The test layer: {@link WorkspaceDiscovery.makeTest} behind
	 * `Layer.succeed`, so a suite provides only the methods it exercises.
	 *
	 * @remarks
	 * A parameterized layer factory mints a **fresh reference per call**, and
	 * layers memoize by reference — bind the result to a `const` and reuse it
	 * rather than calling `layerTest(...)` at each composition site.
	 *
	 * @example
	 * ```ts
	 * import { WorkspaceDiscovery } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const TestDiscovery = WorkspaceDiscovery.layerTest({
	 *   listPackages: () => Effect.succeed([]),
	 * });
	 * // program.pipe(Effect.provide(TestDiscovery))
	 * ```
	 */
	static readonly layerTest = (overrides: Partial<WorkspaceDiscoveryShape> = {}): Layer.Layer<WorkspaceDiscovery> =>
		Layer.succeed(WorkspaceDiscovery, WorkspaceDiscovery.makeTest(overrides));

	/**
	 * The real implementation of `@effected/npm`'s `WorkspaceResolver` contract
	 * — the one `@effected/package-json` declares but cannot fill.
	 *
	 * @remarks
	 * `versionOf` returns `Option.none()` for a name that is not a workspace
	 * member, per the contract's convention; the `DependencyResolutionError`
	 * channel is reserved for a failure of the resolution *mechanism* (an
	 * unfindable root, an unreadable manifest), never an ordinary miss.
	 *
	 * A member that declares **no `version`** is neither: it is a known member
	 * with nothing for `workspace:` to resolve to. Answering `none` would read
	 * as "not a member" downstream, so it fails typed instead, naming the
	 * specifier — the same channel a consumer already handles for an
	 * unresolvable workspace.
	 *
	 * @example
	 * ```ts
	 * import { Package } from "../package-json/index.ts";
	 * import { WorkspaceDiscovery } from "./index.ts";
	 * import { Layer } from "effect";
	 *
	 * const resolvers = WorkspaceDiscovery.workspaceResolver.pipe(
	 *   Layer.provide(WorkspaceDiscovery.layer()),
	 * );
	 * // `Package.resolve` now resolves `workspace:*` for real.
	 * ```
	 */
	static readonly workspaceResolver: Layer.Layer<WorkspaceResolver, never, WorkspaceDiscovery> = Layer.effect(
		WorkspaceResolver,
		Effect.gen(function* () {
			const discovery = yield* WorkspaceDiscovery;
			// Name → version, where a version-less member is present with `undefined`:
			// membership and version are two different questions here, and `has` is
			// what tells them apart.
			const versionIndexes = new WeakMap<ReadonlyArray<WorkspacePackage>, ReadonlyMap<string, string | undefined>>();
			const versionsByName = (all: ReadonlyArray<WorkspacePackage>): ReadonlyMap<string, string | undefined> => {
				const cached = versionIndexes.get(all);
				if (cached !== undefined) return cached;
				// First-write-wins, matching the `all.find` this index replaced.
				const index = new Map<string, string | undefined>();
				for (const pkg of all) {
					if (!index.has(pkg.name)) index.set(pkg.name, pkg.version);
				}
				versionIndexes.set(all, index);
				return index;
			};
			return {
				versionOf: (packageName: string) => {
					const specifier = `workspace:${packageName}`;
					return discovery.listPackages().pipe(
						Effect.mapError((cause) => new DependencyResolutionError({ specifier, cause })),
						Effect.flatMap((all) => {
							const index = versionsByName(all);
							if (!index.has(packageName)) return Effect.succeed(Option.none<string>());
							const version = index.get(packageName);
							return version === undefined
								? Effect.fail(
										// A domain condition read from structured data, not a foreign
										// failure: typed by `reason`, with nothing to carry as `cause`.
										new DependencyResolutionError({ specifier, reason: "no-version", cause: undefined }),
									)
								: Effect.succeed(Option.some(version));
						}),
					);
				},
			};
		}),
	);
}

const isStringRecord = (value: unknown): value is Record<string, string> =>
	value !== null &&
	typeof value === "object" &&
	!Array.isArray(value) &&
	Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "string");
