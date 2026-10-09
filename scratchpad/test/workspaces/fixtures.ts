// In-memory filesystem fixtures.
//
// The volume is `@effected/memfs`, a real virtual POSIX filesystem, so the
// package still tests without `@effect/platform-node`. It replaces a stub that
// implemented the four operations this package happens to call — and a stub
// only ever implements the semantics its author remembered, so a bug that
// depends on anything else cannot surface in a test. Directories are created
// by the volume rather than derived from file keys here.
//
// A suite-boundary `layer(...)` cannot vary per test, so each distinct tree
// gets its own `layer(...)` block — that is the house shape.

import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import type { FileSystem } from "effect";
import { Effect, Layer, Path, PlatformError } from "effect";

/** A virtual tree: absolute path → file contents. Directories are implied by their files. */
export type Tree = Readonly<Record<string, string>>;

/** Knobs for making a fixture tree misbehave in specific, realistic ways. */
export interface FileSystemOptions {
	/**
	 * Directories whose `readDirectory` fails with `PermissionDenied` — the case
	 * a "treat every failure as an empty directory" enumerator silently loses.
	 */
	readonly unreadable?: ReadonlySet<string>;
	/**
	 * Files that EXIST but whose `readFileString` fails with `PermissionDenied` —
	 * the case a `orElseSucceed(() => "")` fallback makes indistinguishable from
	 * an empty file.
	 */
	readonly unreadableFiles?: ReadonlySet<string>;
	/**
	 * Paths whose `exists` PROBE fails with a non-NotFound `PlatformError`
	 * (`PermissionDenied`) — the case a `orElseSucceed(() => false)` fallback makes
	 * indistinguishable from genuine absence. Faithful to core's default `exists`,
	 * which maps NotFound to `false` internally but re-fails any other
	 * `PlatformError`.
	 */
	readonly unreadableExists?: ReadonlySet<string>;
}

/**
 * A `FileSystem` over a virtual tree, implementing exactly the four operations
 * this package uses: `exists`, `readFileString`, `readDirectory`, `stat`.
 */
export const fileSystem = (tree: Tree, options: FileSystemOptions = {}): Layer.Layer<FileSystem.FileSystem> => {
	const unreadable = options.unreadable ?? new Set<string>();
	const unreadableFiles = options.unreadableFiles ?? new Set<string>();
	const unreadableExists = options.unreadableExists ?? new Set<string>();

	// The v4 constructor is `PlatformError.systemError`, not a `new SystemError` —
	// `SystemError` is the reason payload, `PlatformError` is the failure.
	const denied = (method: string, path: string) =>
		Effect.fail(
			PlatformError.systemError({
				_tag: "PermissionDenied",
				module: "FileSystem",
				method,
				pathOrDescriptor: path,
			}),
		);

	// Each handler declines (returns `undefined`) for every path it does not
	// name, delegating to the volume — so presence, directory listings and stat
	// are the volume's real answers and only the misbehavior is simulated.
	return MemoryFileSystem.layerWith(tree, {
		faults: {
			exists: (path: string) => (unreadableExists.has(path) ? denied("access", path) : undefined),
			readFileString: (path: string) => (unreadableFiles.has(path) ? denied("readFileString", path) : undefined),
			readDirectory: (path: string) => (unreadable.has(path) ? denied("readDirectory", path) : undefined),
		},
	});
};

/** A `FileSystem` + `Path` layer over a virtual tree — the platform half of every suite. */
export const platform = (tree: Tree, options: FileSystemOptions = {}): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
	Layer.mergeAll(fileSystem(tree, options), Path.layer);

/** A root `package.json` declaring npm-style workspaces. */
export const rootManifest = (patterns: ReadonlyArray<string>, extra: Record<string, unknown> = {}): string =>
	JSON.stringify({ name: "root", version: "0.0.0", private: true, workspaces: patterns, ...extra });

/** A member `package.json`. */
export const manifest = (name: string, fields: Record<string, unknown> = {}): string =>
	JSON.stringify({ name, version: "1.0.0", ...fields });
