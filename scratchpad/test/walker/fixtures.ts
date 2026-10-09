// These platform factories are internal test helpers with direct-call contracts.
// @effect-diagnostics missingPipeableSignature:skip-file
// In-memory filesystem fixtures for the descend suite.
//
// The volume is `@effected/memfs` — a real virtual POSIX filesystem — rather
// than a hand-rolled `FileSystem.layerNoop` answering the three methods
// `descend` happens to call. That distinction matters: a stub only implements
// the semantics its author remembered, so a walker bug that depends on
// anything else (mode bits, parent-directory creation, a symlink hop the stub
// resolved in one step) cannot show up in a test. memfs still needs no
// platform package, so the "no `@effect/platform-node`, even in tests" rule
// holds.
//
// Symlinks are seeded; the two misbehaviors are injected as faults, which is
// the sanctioned way to reach a permission failure (memfs records modes but
// never enforces them).

import type { MemoryFileSystemSeedEntry } from "../../effected/memfs/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import type * as FileSystem from "effect/FileSystem";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";

/** A virtual tree: absolute path → file contents. Directories are implied by their files. */
export type Tree = Readonly<Record<string, string>>;

/** Knobs for making a fixture tree misbehave in specific, realistic ways. */
export interface FileSystemOptions {
	/** Directories whose `readDirectory` fails with `PermissionDenied` — the unreadable-subtree case. */
	readonly unreadable?: ReadonlySet<string>;
	/**
	 * Symlinks: link path → absolute target. The link appears in its parent's
	 * listing; `stat` resolves through it (a missing target is a dangling link
	 * and stats NotFound); `readLink` succeeds on it and nothing else.
	 */
	readonly symlinks?: Readonly<Record<string, string>>;
	/**
	 * Directories that vanish between their parent's listing and their own
	 * read: they appear in listings and `stat` as directories, but
	 * `readDirectory` fails NotFound — the benign-race case.
	 */
	readonly vanished?: ReadonlySet<string>;
	/**
	 * Paths whose `realPath` fails with the given reason — the
	 * `followSymlinks` counterpart of `unreadable` / `vanished`. Seeded
	 * symlinks still list and `stat` normally; only the resolve the cycle
	 * guard performs is intercepted, so the walk's answer to an unresolvable
	 * link is exercised in isolation from its answer to an unreadable one.
	 */
	readonly unresolvable?: Readonly<Record<string, "NotFound" | "PermissionDenied">>;
}

// The v4 constructor is `PlatformError.systemError`, not a `new SystemError` —
// `SystemError` is the reason payload, `PlatformError` is the failure.
const failure = (method: "readDirectory" | "realPath", reason: "NotFound" | "PermissionDenied", path: string) =>
	Effect.fail(
		PlatformError.systemError({
			_tag: reason,
			module: "FileSystem",
			method,
			pathOrDescriptor: path,
		}),
	);

/**
 * A `FileSystem` over a virtual tree. Files and symlinks are seeded into the
 * volume; `unreadable` and `vanished` directories are seeded too (so they
 * appear in their parent's listing and stat as directories) and then have
 * their `readDirectory` intercepted.
 */
export const fileSystem = (tree: Tree, options: FileSystemOptions = {}): Layer.Layer<FileSystem.FileSystem> => {
	const unreadable = options.unreadable ?? new Set<string>();
	const vanished = options.vanished ?? new Set<string>();
	const unresolvable = options.unresolvable ?? {};

	const seed: Record<string, MemoryFileSystemSeedEntry> = {};
	for (const [path, contents] of Object.entries(tree)) seed[path] = contents;
	for (const [link, target] of Object.entries(options.symlinks ?? {})) seed[link] = MemoryFileSystem.symlink(target);
	// Seeded as real (empty) directories: the misbehavior is on the read, not on
	// their existence — both cases must still be listed by their parent.
	for (const dir of [...unreadable, ...vanished]) seed[dir] ??= MemoryFileSystem.directory();

	return MemoryFileSystem.layerWith(seed, {
		faults: {
			readDirectory: (path: string) => {
				if (unreadable.has(path)) return failure("readDirectory", "PermissionDenied", path);
				if (vanished.has(path)) return failure("readDirectory", "NotFound", path);
				return undefined; // delegate to the real volume
			},
			realPath: (path: string) => {
				const reason = unresolvable[path];
				return reason === undefined ? undefined : failure("realPath", reason, path);
			},
		},
	});
};

/** A `FileSystem` + `Path` layer over a virtual tree — the platform half of every suite. */
export const platform = (tree: Tree, options: FileSystemOptions = {}): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
	Layer.mergeAll(fileSystem(tree, options), Path.layer);
