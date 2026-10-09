// The synchronous escape hatch over the async loader pipeline: consumers in
// sync-only host APIs (bundler plugin hooks, config factories) supply their
// OWN file and path operations, this module adapts them into the core
// `FileSystem`/`Path` services, and the UNCHANGED `TsconfigLoader` pipeline
// runs under `Effect.runSyncExit` — zero logic duplication, no `node:*`
// import, no posix assumption. Windows correctness comes from the consumer
// passing a win32-appropriate `path` implementation (`node:path` on Windows,
// or `node:path/win32` explicitly).
//
// Failure contract: exactly the async pipeline's typed errors, thrown —
// `TsconfigParseError`, `TsconfigExtendsError`, or a `PlatformError` wrapping
// what the consumer's `readFile` threw. Defects rethrow as-is; a caller never
// sees a fiber-failure wrapper. The services are built per call from the
// consumer's functions (plain service values via `Effect.provideService`, not
// layers, so there is no memoization to poison across calls with different
// options).

import { $ScratchpadId } from "@beep/identity/packages";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { CompilerOptions } from "./CompilerOptions.ts";
import type { ResolvedTsconfig } from "./ResolvedTsconfig.ts";
import type { TsconfigJson } from "./TsconfigJson.ts";
import { TsconfigLoader } from "./TsconfigLoader.ts";

const $I = $ScratchpadId.create("effected/tsconfig-json/TsconfigLoaderSync");

/** Defect raised when the sync path adapter receives an unsupported operation. */
class UnsupportedPathOperationError extends S.TaggedError<UnsupportedPathOperationError>($I`UnsupportedPathOperationError`)(
	"UnsupportedPathOperationError",
	{ message: S.String },
	$I.annote("UnsupportedPathOperationError", {
		description: "A path operation outside the synchronous loader adapter's supported operations was invoked.",
	}),
) {}

/**
 * The synchronous file operations {@link TsconfigLoaderSync} needs, supplied
 * by the consumer. Node's built-ins satisfy it directly:
 *
 * ```ts
 * import { existsSync, readFileSync } from "node:fs";
 *
 * const fileSystem: SyncFileSystem = {
 * 	exists: existsSync,
 * 	readFile: (p) => readFileSync(p, "utf8"),
 * };
 * ```
 *
 * `readFile` returns the file's text and may throw on failure (a missing
 * file, a permission error); the throw is wrapped in a `PlatformError` and
 * rethrown through the loader's typed channel.
 *
 * @public
 */
export interface SyncFileSystem {
	/** Whether a file exists at `path`. Directory hits follow the loader's documented file-only contract. */
	readonly exists: (path: string) => boolean;
	/** Read the file at `path` as text. May throw; the throw surfaces as a `PlatformError`. */
	readonly readFile: (path: string) => string;
}

/**
 * The synchronous path operations {@link TsconfigLoaderSync} needs, supplied
 * by the consumer. Deliberately a structural subset of `node:path`, so the
 * built-in module (and its `win32` / `posix` variants, or a Bun / Deno
 * equivalent) satisfies it verbatim:
 *
 * ```ts
 * import * as path from "node:path";
 *
 * const options: TsconfigLoaderSyncOptions = {
 * 	fileSystem: { exists: existsSync, readFile: (p) => readFileSync(p, "utf8") },
 * 	path, // node:path IS a SyncPath
 * };
 * ```
 *
 * The loader passes these through untouched — Windows correctness comes from
 * supplying a win32-appropriate implementation, not from anything here.
 *
 * @public
 */
export interface SyncPath {
	/** Resolve segments to an absolute path (rightmost-wins, like `path.resolve`). */
	readonly resolve: (...segments: ReadonlyArray<string>) => string;
	/** The directory portion of `p` (like `path.dirname`). */
	readonly dirname: (p: string) => string;
	/** Join segments with the implementation's separator (like `path.join`). */
	readonly join: (...segments: ReadonlyArray<string>) => string;
	/** Whether `p` is absolute under this implementation's convention. */
	readonly isAbsolute: (p: string) => boolean;
	/** The final segment of `p` (like `path.basename`). */
	readonly basename: (p: string) => string;
}

/**
 * The consumer-supplied operations backing one {@link TsconfigLoaderSync}
 * call: the file operations and the path implementation. Both are required —
 * this package never imports `node:*` and never assumes posix, so the
 * platform binding is entirely the caller's.
 *
 * @public
 */
export interface TsconfigLoaderSyncOptions {
	/** The synchronous file operations (Node: `existsSync` / `readFileSync`). */
	readonly fileSystem: SyncFileSystem;
	/** The synchronous path implementation (Node: the `node:path` module itself). */
	readonly path: SyncPath;
}

/** A `Path.Path` member the loader pipeline never calls: throw an informative defect if something reaches it. */
const unsupported = (member: string): never => {
	throw UnsupportedPathOperationError.make({
		message: `Path.${member} is not supported by TsconfigLoaderSync — its SyncPath adapter only carries resolve/dirname/join/isAbsolute/basename`,
	});
};

/** Adapt the consumer's `SyncPath` into a core `Path.Path` service value. */
const makePathService = (path: SyncPath): Path.Path =>
	Path.Path.of({
		[Path.TypeId]: Path.TypeId,
		get sep(): string {
			return unsupported("sep");
		},
		basename: (p: string) => path.basename(p),
		dirname: (p: string) => path.dirname(p),
		extname: () => unsupported("extname"),
		format: () => unsupported("format"),
		fromFileUrl: () => unsupported("fromFileUrl"),
		isAbsolute: (p: string) => path.isAbsolute(p),
		join: (...segments: ReadonlyArray<string>) => path.join(...segments),
		normalize: () => unsupported("normalize"),
		parse: () => unsupported("parse"),
		relative: () => unsupported("relative"),
		resolve: (...segments: ReadonlyArray<string>) => path.resolve(...segments),
		toFileUrl: () => unsupported("toFileUrl"),
		toNamespacedPath: () => unsupported("toNamespacedPath"),
	});

/**
 * Adapt the consumer's `SyncFileSystem` into a core `FileSystem` service
 * value. A `readFile` throw is wrapped exactly as a platform filesystem would
 * report it: a `PlatformError` whose `SystemError` reason carries module
 * `"FileSystem"`, method `"readFileString"`, and the original throw as
 * `cause`.
 *
 * NOTE the deliberate asymmetry with `makePathService`: an unsupported `Path`
 * member throws a named defect, but an unsupported `FileSystem` member
 * inherits `FileSystem.makeNoop`'s behavior — a TYPED `NotFound` failure. If
 * a future loader change reaches for a filesystem operation not overridden
 * here, it surfaces as a spurious `NotFound` (not a crash), and this adapter
 * must be extended to cover the new operation.
 */
const makeFileSystemService = (fileSystem: SyncFileSystem): FileSystem.FileSystem =>
	FileSystem.makeNoop({
		exists: (path) => Effect.sync(() => fileSystem.exists(path)),
		readFileString: (path) =>
			Effect.try({
				try: () => fileSystem.readFile(path),
				catch: (cause) =>
					PlatformError.systemError({
						_tag: "Unknown",
						module: "FileSystem",
						method: "readFileString",
						pathOrDescriptor: path,
						cause,
					}),
			}),
	});

/**
 * Run one loader effect synchronously against the consumer-supplied services,
 * unwrapping the result: a typed failure is thrown as itself, a defect is
 * rethrown as-is — never a fiber-failure wrapper.
 */
const runWith = <A, E>(
	options: TsconfigLoaderSyncOptions,
	effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
): A => {
	const exit = Effect.runSyncExit(
		effect.pipe(
			Effect.provideService(FileSystem.FileSystem, makeFileSystemService(options.fileSystem)),
			Effect.provideService(Path.Path, makePathService(options.path)),
		),
	);
	if (Exit.isSuccess(exit)) return exit.value;
	const failure = Cause.findErrorOption(exit.cause);
	if (O.isSome(failure)) throw failure.value;
	const defect = Cause.findDefect(exit.cause);
	if (Result.isSuccess(defect)) throw defect.success;
	throw Cause.squash(exit.cause);
};

// Implementation of TsconfigLoaderSync.load; the public contract lives on the static.
const load = (configPath: string, options: TsconfigLoaderSyncOptions): TsconfigJson.Type =>
	runWith(options, TsconfigLoader.load(configPath));

// Implementation of TsconfigLoaderSync.resolve; the public contract lives on the static.
const resolve = (configPath: string, options: TsconfigLoaderSyncOptions): ResolvedTsconfig =>
	runWith(options, TsconfigLoader.resolve(configPath));

// Implementation of TsconfigLoaderSync.compilerOptions; the public contract lives on the static.
const compilerOptions = (configPath: string, options: TsconfigLoaderSyncOptions): CompilerOptions.Type =>
	resolve(configPath, options).compilerOptions;

/**
 * The synchronous tsconfig.json loader facade: the {@link TsconfigLoader}
 * pipeline run under `Effect.runSyncExit` against consumer-supplied
 * {@link SyncFileSystem} and {@link SyncPath} operations. For sync-only host
 * APIs (bundler plugin hooks, config factories); everything else should use
 * {@link TsconfigLoader} with real platform layers.
 *
 * @remarks
 * The two adapters treat unsupported members asymmetrically: a `Path` member
 * the loader pipeline never calls throws a named defect on contact, while a
 * `FileSystem` member outside the two overridden here (`exists`,
 * `readFileString`) inherits `FileSystem.makeNoop`'s typed `NotFound`
 * failure. A loader change that starts using a new filesystem operation
 * therefore surfaces as a `NotFound` rather than a defect — extend the
 * adapter when that happens.
 *
 * ```ts
 * import { existsSync, readFileSync } from "node:fs";
 * import * as path from "node:path";
 * import { TsconfigLoaderSync } from "./index.ts";
 *
 * const resolved = TsconfigLoaderSync.resolve("./tsconfig.json", {
 * 	fileSystem: { exists: existsSync, readFile: (p) => readFileSync(p, "utf8") },
 * 	path,
 * });
 * ```
 *
 * @public
 */
export class TsconfigLoaderSync {
	private constructor() {}

	/**
	 * {@link TsconfigLoader.load}, synchronously: read and decode one config
	 * file through the consumer-supplied operations. Throws
	 * `TsconfigParseError` or a `PlatformError` — the async pipeline's exact
	 * typed failures.
	 */
	static readonly load = load;

	/**
	 * {@link TsconfigLoader.resolve}, synchronously: the full load -\>
	 * extends -\> merge -\> `${configDir}` pipeline through the
	 * consumer-supplied operations. Throws `TsconfigParseError`,
	 * `TsconfigExtendsError` or a `PlatformError` — the async pipeline's exact
	 * typed failures.
	 */
	static readonly resolve = resolve;

	/**
	 * {@link TsconfigLoader.compilerOptions}, synchronously: resolve the full
	 * `extends` chain and project out the merged `compilerOptions`. Throws
	 * the same typed failures as {@link TsconfigLoaderSync.resolve}.
	 */
	static readonly compilerOptions = compilerOptions;
}
