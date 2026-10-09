// The synchronous escape hatch — over CONSUMER-SUPPLIED operations.
//
// Vitest's config-time project discovery cannot await, and it is the reason
// this module exists — a Vitest plugin building its project list has nowhere to
// run an Effect. It imports NOTHING platform-shaped: the caller passes the file and path
// operations (`node:fs` / `node:path` satisfy them one-liner each), so the kit
// source never touches `node:*` and never assumes posix. Windows correctness is
// the consumer passing a win32-appropriate `path` (`node:path` on Windows, or
// `node:path/win32` explicitly) — the `TsconfigLoaderSync` convention.
//
// It does not keep a second pattern semantic: it compiles through the same
// `GlobSet` and walks the same worklist as the Effect enumerator, so
// `packages/**` means the same thing in both worlds.

import { GlobSet } from "../glob/index.ts";
import { Yaml } from "../yaml/index.ts";
import { Effect, Exit, Schema } from "effect";
import { MAX_ENUMERATION_DEPTH } from "./internal/limits.ts";
import { manifestPatternsOf, pnpmPatternsOf } from "./internal/patterns.ts";
import { Traversal, badMaxDepthMessage, isPruned, isValidMaxDepth, joinRelative } from "./internal/traverse.ts";
import type { WorkspaceDiscoveryError } from "./WorkspaceDiscovery.ts";
import { PublishConfig, WorkspacePackage } from "./WorkspacePackage.ts";

/**
 * The synchronous file operations the sync entry points need, supplied by the
 * consumer. Node's built-ins satisfy it directly:
 *
 * ```ts
 * import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
 *
 * const fileSystem: SyncFileSystem = {
 * 	exists: existsSync,
 * 	readFile: (p) => readFileSync(p, "utf8"),
 * 	readDirectory: (p) => readdirSync(p),
 * 	isDirectory: (p) => statSync(p).isDirectory(),
 * };
 * ```
 *
 * `exists` must return a boolean and not throw (Node's `existsSync` never
 * does). The other three may throw — `statSync` on a missing path, a
 * permission error mid-read — and every throw is absorbed into the documented
 * degraded-skip semantics: a throwing `readFile` reads as an unusable
 * manifest, a throwing `readDirectory` as an unreadable directory, a throwing
 * `isDirectory` as "not a directory". Nothing propagates.
 *
 * @public
 */
export interface SyncFileSystem {
	/** Whether a file or directory exists at `path`. Must not throw. */
	readonly exists: (path: string) => boolean;
	/** Read the file at `path` as text. May throw; a throw degrades to a skip. */
	readonly readFile: (path: string) => string;
	/** The entry names inside the directory at `path`. May throw; a throw skips the directory. */
	readonly readDirectory: (path: string) => ReadonlyArray<string>;
	/** Whether `path` is a directory. May throw; a throw reads as `false`. */
	readonly isDirectory: (path: string) => boolean;
	/**
	 * Optional fast path: the entries inside `path` with their types already
	 * known, in ONE call.
	 *
	 * @remarks
	 * Package enumeration otherwise costs a `readDirectory` plus one
	 * `isDirectory` per entry — the readdir-then-stat-per-entry shape, which on
	 * a large workspace is a syscall per file. Supplying this collapses that to
	 * a single `readdirSync(path, { withFileTypes: true })`; `nodeFileSystem`
	 * does. Omit it and enumeration falls back to the four required operations
	 * with identical results, so this is purely a cost optimization and never a
	 * behavior switch.
	 *
	 * May throw; a throw skips the directory, exactly like `readDirectory`.
	 */
	readonly readDirectoryWithTypes?: ((path: string) => ReadonlyArray<SyncDirectoryEntry>) | undefined;
}

/**
 * One directory entry with its type resolved, as the optional
 * {@link SyncFileSystem.readDirectoryWithTypes} fast path reports it. Node's
 * `Dirent` satisfies it after mapping its predicate methods to booleans.
 *
 * @remarks
 * `isSymbolicLink` is not decoration. A `Dirent` describes the entry ITSELF, so
 * a symbolic link pointing at a directory reports `isDirectory: false` — while
 * the `stat`-based slow path, which resolves the link, calls the same entry a
 * directory. Enumeration therefore re-resolves links through `isDirectory`
 * rather than trusting `isDirectory` on a link, which is what keeps the fast
 * and slow paths in agreement on a workspace whose packages are symlinked.
 *
 * Which behavior is *correct* is domain-dependent, so the flag is reported
 * rather than resolved away. Enumeration follows links because a symlinked
 * package is still a package. A test-file discovery walk usually must NOT: in a
 * pnpm workspace `node_modules` is a farm of links into the content-addressed
 * store, and following them walks the whole store or hits a cycle. A consumer
 * building its own walker on this shape wants `isDirectory` verbatim — there,
 * not following is the requirement, not the hazard.
 *
 * @public
 */
export interface SyncDirectoryEntry {
	/** The entry's own name, not a path. */
	readonly name: string;
	/** Whether the entry itself is a directory. `false` for a symbolic link, even one targeting a directory. */
	readonly isDirectory: boolean;
	/** Whether the entry itself is a symbolic link. */
	readonly isSymbolicLink: boolean;
}

/**
 * The synchronous path operations the sync entry points need, supplied by the
 * consumer. Deliberately a structural subset of `node:path`, so the built-in
 * module (and its `win32` / `posix` variants, or a Bun / Deno equivalent)
 * satisfies it verbatim:
 *
 * ```ts
 * import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
 * import * as path from "node:path";
 * import type { WorkspacesSyncOptions } from "./index.ts";
 *
 * const options: WorkspacesSyncOptions = {
 * 	fileSystem: { exists: existsSync, readFile: (p) => readFileSync(p, "utf8"), readDirectory: (p) => readdirSync(p), isDirectory: (p) => statSync(p).isDirectory() },
 * 	path, // node:path IS a SyncPath
 * };
 * ```
 *
 * These operations shape only the ABSOLUTE paths handed back to the consumer
 * (and to its own `fileSystem`); workspace-relative pattern matching is POSIX
 * by the `packages:` contract and never routes through here. Windows
 * correctness comes from supplying a win32-appropriate implementation, not
 * from anything in this module.
 *
 * @public
 */
export interface SyncPath {
	/** Join segments with the implementation's separator (like `path.join`). */
	readonly join: (...segments: ReadonlyArray<string>) => string;
	/** The directory portion of `p` (like `path.dirname`). */
	readonly dirname: (p: string) => string;
	/** Resolve segments to an absolute path (rightmost-wins, like `path.resolve`). */
	readonly resolve: (...segments: ReadonlyArray<string>) => string;
}

/**
 * The consumer-supplied operations backing one sync call: the file operations
 * and the path implementation. Both are required — this package never imports
 * `node:*` and never assumes posix, so the platform binding is entirely the
 * caller's.
 *
 * @public
 */
export interface WorkspacesSyncOptions {
	/** The synchronous file operations (Node: `existsSync` / `readFileSync` / `readdirSync` / `statSync`). */
	readonly fileSystem: SyncFileSystem;
	/** The synchronous path implementation (Node: the `node:path` module itself). */
	readonly path: SyncPath;
}

/**
 * Why {@link getWorkspacePackagesSync} left a manifest out of its result — the
 * `WorkspaceDiscoveryError.kind` values a single manifest read can produce.
 *
 * @remarks
 * The same vocabulary the Effect surface fails with, deliberately: a member the
 * async `listPackages()` rejects as `missingName` is the member the sync facade
 * reports as `missingName`. `invalidYaml` is excluded because it describes the
 * `pnpm-workspace.yaml` read, not a manifest. A version-less manifest is a
 * member on both surfaces.
 *
 * The vocabulary is shared; the CHECKS are shared only as far as this list.
 * Both surfaces perform the same five: the file read (`read`), `JSON.parse`
 * (`invalidJson`), the parsed value being a non-null non-array object
 * (`invalidShape`), a non-empty string `name` (`missingName`), and a `version`
 * that is either absent or a non-empty string (`invalidShape`). Beyond them
 * they diverge, and one divergence is deliberate: a malformed `publishConfig`
 * FAILS the async surface, because it reaches the decode, while the sync facade
 * drops the field and keeps the member. A consumer that must reject such a
 * manifest has to use the Effect surface.
 *
 * @public
 */
export type WorkspaceDiscoverySkipKind = Exclude<WorkspaceDiscoveryError["kind"], "invalidYaml">;

/**
 * One manifest {@link getWorkspacePackagesSync} skipped, reported through
 * {@link GetWorkspacePackagesSyncOptions.onSkip}.
 *
 * @remarks
 * The sync facade is total, so it cannot fail the way `WorkspaceDiscovery`
 * does — but a skipped member must still be observable. Without a report, a
 * hand-written fixture with one unusable manifest would enumerate as a
 * plausible empty array indistinguishable from "no workspaces configured". The
 * fields mirror
 * `WorkspaceDiscoveryError`: `root`, `path`, `kind`, and on `cause` either the
 * caught throwable (`read` / `invalidJson`) or an `Error` carrying the same
 * sentence the Effect surface fails with (`invalidShape`). Only `missingName`
 * has `cause: undefined` — the field is simply absent, and nothing threw.
 *
 * @public
 */
export interface WorkspaceDiscoverySkip {
	/** The workspace root the enumeration ran against. */
	readonly root: string;
	/** Absolute path to the `package.json` that was skipped. */
	readonly path: string;
	/** Why it was skipped. */
	readonly kind: WorkspaceDiscoverySkipKind;
	/**
	 * The thrown value for `read` and `invalidJson`, an `Error` whose message
	 * matches the Effect surface's for `invalidShape`, and `undefined` for
	 * `missingName` alone.
	 */
	readonly cause: unknown;
}

/** A manifest read that either yields the parsed record or names why it cannot. */
type ManifestRead =
	| { readonly raw: Record<string, unknown> }
	| { readonly kind: "read" | "invalidJson" | "invalidShape"; readonly cause: unknown };

/**
 * Read one `package.json` into a plain record, or say why not. Never throws.
 *
 * The three failures are kept apart — a throwing consumer `readFile`, a JSON
 * syntax error, and valid JSON that is not an object — because the skip report
 * carries the distinction; the two other callers of {@link readJson} do not
 * need it and keep the collapsed form.
 */
const readManifest = (fileSystem: SyncFileSystem, file: string): ManifestRead => {
	let text: string;
	try {
		text = fileSystem.readFile(file);
	} catch (cause) {
		return { kind: "read", cause };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (cause) {
		return { kind: "invalidJson", cause };
	}
	// `JSON.parse` returns `null` / a number / a string for VALID input; only a
	// non-null, non-array object is a manifest.
	return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
		? { raw: parsed as Record<string, unknown> }
		: { kind: "invalidShape", cause: new Error("package.json is not a JSON object") };
};

/**
 * Read and JSON-parse a file into a plain object, or `undefined`. Never throws.
 *
 * The non-object check is load-bearing, not defensive noise. `JSON.parse`
 * returns `undefined` for *nothing* — a `package.json` whose entire content is
 * `null`, `42` or `"x"` parses successfully to that value, so a caller guarding
 * only on `undefined` sails straight into `raw.name` and throws a `TypeError`.
 * These functions are documented as total and are reached from a Vitest config,
 * which has nowhere to put a crash: malformed input must be *skipped*, never a
 * defect. A throwing consumer `readFile` lands in the same catch as a JSON
 * syntax error — an unusable manifest either way.
 */
const readJson = (fileSystem: SyncFileSystem, file: string): Record<string, unknown> | undefined => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(fileSystem.readFile(file));
	} catch {
		return undefined;
	}
	return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
		? (parsed as Record<string, unknown>)
		: undefined;
};

/** Whether `dir` is a directory. Never throws — a throwing consumer op reads as `false`. */
const isDirectory = (fileSystem: SyncFileSystem, dir: string): boolean => {
	try {
		return fileSystem.isDirectory(dir);
	} catch {
		return false;
	}
};

/** One enumerated child, with directory-ness resolved under `stat` semantics. */
interface ResolvedEntry {
	readonly name: string;
	readonly directory: boolean;
}

/**
 * The entries of `absoluteDir`, each carrying whether it is a directory, or
 * `undefined` when the directory could not be read at all (the degraded-skip
 * case). Uses {@link SyncFileSystem.readDirectoryWithTypes} when the consumer
 * supplied it and the four-operation fallback otherwise — the two agree by
 * construction, including on symbolic links, which are always re-resolved
 * through `isDirectory` because a `Dirent` describes the link and not its
 * target.
 */
const readResolvedEntries = (
	options: WorkspacesSyncOptions,
	absoluteDir: string,
): ReadonlyArray<ResolvedEntry> | undefined => {
	const { fileSystem, path } = options;
	const withTypes = fileSystem.readDirectoryWithTypes;
	if (withTypes !== undefined) {
		try {
			return withTypes(absoluteDir).map((entry) => ({
				name: entry.name,
				directory: entry.isSymbolicLink
					? isDirectory(fileSystem, path.join(absoluteDir, entry.name))
					: entry.isDirectory,
			}));
		} catch {
			return undefined;
		}
	}
	let names: ReadonlyArray<string>;
	try {
		names = fileSystem.readDirectory(absoluteDir);
	} catch {
		return undefined;
	}
	return names.map((name) => ({
		name,
		directory: isDirectory(fileSystem, path.join(absoluteDir, name)),
	}));
};

/** Whether `dir` holds a `package.json`. */
const isPackage = (options: WorkspacesSyncOptions, dir: string): boolean =>
	options.fileSystem.exists(options.path.join(dir, "package.json"));

/**
 * Options for {@link findWorkspaceRootSync}: the consumer-supplied operations
 * plus the ascent's ceiling.
 *
 * @public
 */
export interface FindWorkspaceRootSyncOptions extends WorkspacesSyncOptions {
	/**
	 * A ceiling directory, with the semantics of `FindWorkspaceRootOptions.stopAt`
	 * on the Effect surface. The ascent stops after probing it, so an unmarked
	 * `stopAt` returns `null` rather than silently adopting an enclosing
	 * repository's workspace.
	 *
	 * @remarks
	 * Inclusive: a ceiling that is itself a workspace root is returned. The
	 * ceiling is resolved through the supplied {@link SyncPath.resolve} at
	 * lookup time, so a relative one is taken against the process working
	 * directory when the call runs (with `node:path`). A ceiling that names no
	 * ancestor of `cwd` never matches, and the ascent runs to the filesystem
	 * root. Omit it for the unbounded ascent.
	 *
	 * Pass `stopAt: cwd` for a checkout nested inside someone else's workspace
	 * (a self-hosted runner, `actions/checkout` with `path:`): a checkout that is
	 * itself a root still resolves, and one that is not returns `null`.
	 */
	readonly stopAt?: string | undefined;
}

/**
 * The nearest workspace root at or above `cwd`, or `null`.
 *
 * @remarks
 * **Synchronous.** The Effect surface is `WorkspaceRoot`; reach for this one
 * only where you genuinely cannot run an Effect — a Vitest config being the
 * motivating case. The file and path operations are the caller's
 * ({@link WorkspacesSyncOptions}); this module imports no `node:*` and
 * assumes no posix.
 *
 * The signature is path-first, options second — the same shape as
 * {@link getWorkspacePackagesSync} and the rest of the kit's sync facades
 * (`TsconfigLoaderSync.load(configPath, options)`). `cwd` is required and
 * positional, so the function reads no ambient `process.cwd()`.
 *
 * Markers match the async service exactly: a `pnpm-workspace.yaml`, or a
 * `package.json` carrying a `workspaces` field.
 *
 * The ascent is unbounded unless `options.stopAt` names a ceiling
 * ({@link FindWorkspaceRootSyncOptions.stopAt}), with the Effect surface's
 * semantics: inclusive, resolved at lookup time. Where `WorkspaceRoot.find`
 * fails `WorkspaceRootNotFoundError` carrying the resolved ceiling, this
 * returns `null` — the facade is total and has no error channel, and the
 * caller already holds the ceiling it passed.
 *
 * @param cwd - Where to start the ascent (typically `process.cwd()`),
 *   matching the Effect layers' `{ cwd }` option.
 * @param options - The consumer-supplied file and path operations, plus an
 *   optional `stopAt` ceiling.
 *
 * @example
 * ```ts
 * import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
 * import * as path from "node:path";
 * import { findWorkspaceRootSync } from "./index.ts";
 *
 * const root = findWorkspaceRootSync(process.cwd(), {
 * 	fileSystem: {
 * 		exists: existsSync,
 * 		readFile: (p) => readFileSync(p, "utf8"),
 * 		readDirectory: (p) => readdirSync(p),
 * 		isDirectory: (p) => statSync(p).isDirectory(),
 * 	},
 * 	path,
 * });
 * ```
 *
 * @public
 */
export const findWorkspaceRootSync = (cwd: string, options: FindWorkspaceRootSyncOptions): string | null => {
	const { fileSystem, path } = options;
	let current = path.resolve(cwd);
	// Resolved at lookup time, exactly as `WorkspaceRoot.find` resolves it: the
	// comparison below is string equality, so an unresolved ceiling would never
	// match and would silently degrade to the unbounded ascent it exists to stop.
	const ceiling = options.stopAt === undefined ? undefined : path.resolve(options.stopAt);
	// Bounded twice over: `dirname` is a fixpoint at the filesystem root, and the
	// depth cap guards a pathological path implementation that never reaches one.
	for (let depth = 0; depth < MAX_ENUMERATION_DEPTH * 8; depth++) {
		if (fileSystem.exists(path.join(current, "pnpm-workspace.yaml"))) return current;
		const manifest = readJson(fileSystem, path.join(current, "package.json"));
		if (manifest?.workspaces !== undefined && manifest.workspaces !== null) return current;
		// Inclusive: the ceiling itself was just probed. A ceiling naming no
		// ancestor never matches and the ascent runs to the filesystem root —
		// walker's rule, which the Effect surface inherits.
		if (ceiling !== undefined && current === ceiling) return null;
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
	return null;
};

/** The workspace `packages:` patterns for `root`, matching `internal/patterns.ts`'s precedence. */
const readPatternsSync = (options: WorkspacesSyncOptions, root: string): ReadonlyArray<string> => {
	const { fileSystem, path } = options;
	const workspaceYaml = path.join(root, "pnpm-workspace.yaml");
	if (fileSystem.exists(workspaceYaml)) {
		let text = "";
		try {
			text = fileSystem.readFile(workspaceYaml);
		} catch {
			text = "";
		}
		// `Yaml.parse` is an Effect and this function is not; the parse is pure and
		// synchronous underneath, so running it to an Exit here is the one honest
		// bridge. A parse failure is an empty pattern list, not a throw.
		const exit = Effect.runSyncExit(Yaml.parse(text));
		if (Exit.isSuccess(exit)) {
			const patterns = pnpmPatternsOf(exit.value);
			if (patterns.length > 0) return patterns;
		}
	}
	return manifestPatternsOf(readJson(fileSystem, path.join(root, "package.json")) ?? {});
};

/**
 * Build a `WorkspacePackage` from a directory, or a {@link WorkspaceDiscoverySkip}
 * saying why its manifest is unusable — never `null`, so a skip cannot go
 * unreported.
 */
const readPackageSync = (
	options: WorkspacesSyncOptions,
	root: string,
	directory: string,
	relativePath: string,
): WorkspacePackage | WorkspaceDiscoverySkip => {
	const packageJsonPath = options.path.join(directory, "package.json");
	const read = readManifest(options.fileSystem, packageJsonPath);
	if (!("raw" in read)) return { root, path: packageJsonPath, kind: read.kind, cause: read.cause };
	const raw = read.raw;

	const name = raw.name;
	if (typeof name !== "string" || name.length === 0) {
		return { root, path: packageJsonPath, kind: "missingName", cause: undefined };
	}
	// Absent stays absent — pnpm accepts a version-less private package, and the
	// Effect enumerator carries the same shape. Optional means ABSENT, though,
	// not "any present value counts": a present non-string is the manifest's
	// shape being wrong, and so is `""`, which pnpm never wrote and which would
	// resolve `workspace:^` to a bare `"^"`. The Effect surface fails both as
	// `invalidShape` with these exact sentences; here they are the same kind and
	// the same sentence, reported rather than raised.
	const version = raw.version;
	if (version !== undefined && typeof version !== "string") {
		return {
			root,
			path: packageJsonPath,
			kind: "invalidShape",
			cause: new Error(`version must be a string, got ${typeof version}`),
		};
	}
	if (version === "") {
		return {
			root,
			path: packageJsonPath,
			kind: "invalidShape",
			cause: new Error("version must be a non-empty string"),
		};
	}

	const stringRecord = (value: unknown): Record<string, string> | undefined =>
		value !== null &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "string")
			? (value as Record<string, string>)
			: undefined;

	const publishConfig = raw.publishConfig;
	const config =
		publishConfig !== null && typeof publishConfig === "object"
			? Effect.runSyncExit(Schema.decodeUnknownEffect(PublishConfig)(publishConfig))
			: undefined;

	return WorkspacePackage.make({
		name,
		...(version !== undefined ? { version } : {}),
		path: directory,
		packageJsonPath,
		relativePath,
		// Carried exactly as the Effect enumerator carries it — the two entry
		// points must not disagree about what a discovered package knows.
		workspaceRoot: root,
		private: raw.private === true,
		dependencies: stringRecord(raw.dependencies) ?? {},
		devDependencies: stringRecord(raw.devDependencies) ?? {},
		peerDependencies: stringRecord(raw.peerDependencies) ?? {},
		optionalDependencies: stringRecord(raw.optionalDependencies) ?? {},
		// The as-read record rides along, exactly as the Effect enumerator's
		// projection does — one read, tolerant access to the rest of the manifest.
		manifestRecord: raw,
		...(config !== undefined && Exit.isSuccess(config) ? { publishConfig: config.value } : {}),
	});
};

/**
 * Options for {@link getWorkspacePackagesSync}: the required consumer-supplied
 * operations plus the traversal bound.
 *
 * @public
 */
export interface GetWorkspacePackagesSyncOptions extends WorkspacesSyncOptions {
	/**
	 * Descent cap below a wildcard's enumeration prefix, mirroring
	 * `WorkspaceDiscovery.layer({ maxDepth })`.
	 *
	 * @defaultValue 32
	 */
	readonly maxDepth?: number;
	/**
	 * Called once for every manifest the enumeration found and could not use,
	 * with the file and the reason — so a skipped member is observable even
	 * though this function is total and has no error channel to raise it on.
	 *
	 * @remarks
	 * Omit it and skips are simply not reported; nothing is logged in its
	 * place. The callback is invoked synchronously, before the result is
	 * returned, in enumeration order — members first, then the root, which is
	 * read last even though it is returned first. Its result is discarded, and a throw from it propagates: the facade is total
	 * over *data*, not over caller mistakes, exactly as a bad `maxDepth` is.
	 */
	readonly onSkip?: ((skip: WorkspaceDiscoverySkip) => void) | undefined;
}

/**
 * Every workspace package under `root`, root package first.
 *
 * @remarks
 * **Synchronous.** The Effect surface is `WorkspaceDiscovery`. The file and
 * path operations are the caller's ({@link GetWorkspacePackagesSyncOptions}
 * extends {@link WorkspacesSyncOptions}); this module imports no `node:*` and
 * assumes no posix.
 *
 * Pattern semantics are not merely "shared" with the Effect enumerator — both
 * drive the **same traversal state machine** (`internal/traverse.ts`), so the
 * dequeue order, the depth rule, the visit budget and the prune list cannot
 * drift apart. A `packages/**` finds exactly the same packages here as there,
 * including at the depth boundary.
 *
 * The one deliberate difference is what happens at a bound: the Effect surface
 * fails typed (`depthExceeded` / `budgetExceeded`), while this one is **total**
 * and truncates. An unenumerable pattern or an unreadable manifest is skipped,
 * not raised — a function with no error channel should not pretend to have one,
 * and a Vitest config has nowhere to put a failure. Totality covers *data*, not
 * caller mistakes: a `maxDepth` that is not a positive integer throws, matching
 * the enumerator's defect.
 *
 * **A skip is never silent.** Every manifest left out is reported through
 * `onSkip` with its path and the same `kind` the Effect surface would have
 * failed with (a `WorkspaceDiscoverySkip`), so "no packages" and "packages
 * rejected" stay distinguishable. A manifest with no `version` is NOT skipped:
 * pnpm accepts a version-less private package, so it is a member with
 * `version` absent — on both surfaces.
 *
 * @param root - The workspace root, from {@link findWorkspaceRootSync}.
 * @param options - The consumer-supplied operations and traversal bounds; see
 *   {@link GetWorkspacePackagesSyncOptions}.
 *
 * @example
 * ```ts
 * import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
 * import * as path from "node:path";
 * import { findWorkspaceRootSync, getWorkspacePackagesSync } from "./index.ts";
 *
 * const ops = {
 * 	fileSystem: {
 * 		exists: existsSync,
 * 		readFile: (p: string) => readFileSync(p, "utf8"),
 * 		readDirectory: (p: string) => readdirSync(p),
 * 		isDirectory: (p: string) => statSync(p).isDirectory(),
 * 	},
 * 	path,
 * };
 * const root = findWorkspaceRootSync(process.cwd(), ops);
 * const packages = root === null ? [] : getWorkspacePackagesSync(root, ops);
 * ```
 *
 * @public
 */
export const getWorkspacePackagesSync = (
	root: string,
	options: GetWorkspacePackagesSyncOptions,
): ReadonlyArray<WorkspacePackage> => {
	const { fileSystem, path } = options;
	const maxDepth = options.maxDepth ?? MAX_ENUMERATION_DEPTH;
	// A bad bound is a PROGRAMMER error, not a data condition. This function is
	// total over *data*, not over caller mistakes — so it throws here, mirroring
	// the enumerator's `Effect.die`. Same predicate, same message, one rule.
	if (!isValidMaxDepth(maxDepth)) {
		throw new RangeError(`getWorkspacePackagesSync: ${badMaxDepthMessage(maxDepth)}`);
	}

	const patterns = readPatternsSync(options, root);

	// The same GlobSet the async enumerator compiles. An uncompilable set yields
	// no members rather than throwing — see the totality note above.
	const compiled = Effect.runSyncExit(GlobSet.compile(patterns));
	if (Exit.isFailure(compiled)) return [];
	const globs = compiled.value;
	const excludes = globs.excludes;
	const isExcluded =
		excludes.length === 0
			? (_: string): boolean => false
			: (relative: string): boolean => excludes.some((exclude) => exclude.matches(relative));

	const included = new Map<string, string>();

	for (const literal of globs.literals) {
		if (isExcluded(literal)) continue;
		const absolute = path.join(root, literal);
		if (isPackage(options, absolute)) included.set(literal, absolute);
	}

	for (const wildcard of globs.wildcards) {
		const base = wildcard.enumerationPrefix.replace(/\/$/, "");
		const absoluteBase = path.join(root, base);
		if (!isDirectory(fileSystem, absoluteBase)) continue;

		// THE shared traversal — the same state machine `internal/enumerate.ts`
		// drives. The ONLY difference between the two entry points is what happens
		// to a `TraversalStop`: the Effect path fails typed, this one truncates,
		// because a Vitest config has nowhere to put an error. Depth, budget,
		// prune and dequeue are not re-decided here.
		const traversal = new Traversal(base, absoluteBase, maxDepth);

		let stopped = false;
		for (let current = traversal.next(); current !== undefined && !stopped; current = traversal.next()) {
			if (traversal.charge() !== undefined) break;

			const entries = readResolvedEntries(options, current.absolute);
			if (entries === undefined) continue;

			for (const entry of entries) {
				if (isPruned(entry.name)) continue;
				const relative = joinRelative(current.relative, entry.name);
				const absolute = path.join(current.absolute, entry.name);
				if (!entry.directory) continue;

				// Depth BEFORE acceptance, exactly as the Effect enumerator does it.
				// Gating only the descent is what made this function return a package
				// one level beyond the cap that the Effect API rejected on the same
				// tree — the drift that motivated the shared traversal.
				if (wildcard.crossesSegments && !traversal.admits(current)) {
					stopped = true;
					break;
				}

				if (wildcard.matches(relative) && !isExcluded(relative) && isPackage(options, absolute)) {
					included.set(relative, absolute);
				}
				if (!wildcard.crossesSegments) continue;

				traversal.push(current, relative, absolute);
			}
		}
	}

	const members: Array<WorkspacePackage> = [];
	const admit = (read: WorkspacePackage | WorkspaceDiscoverySkip): void => {
		if (read instanceof WorkspacePackage) members.push(read);
		else options.onSkip?.(read);
	};
	for (const [relativePath, absolute] of [...included.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
		if (relativePath === "." || absolute === root) continue;
		admit(readPackageSync(options, root, absolute, relativePath));
	}

	const rootPackage = readPackageSync(options, root, root, ".");
	if (rootPackage instanceof WorkspacePackage) return [rootPackage, ...members];
	options.onSkip?.(rootPackage);
	return members;
};
