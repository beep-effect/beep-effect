import { MemoryFileSystem } from "@beep/memfs";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import type { MemoryFileSystemSeedEntry } from "@beep/memfs";
import type * as FileSystem from "effect/FileSystem";

/** A virtual tree: absolute path → file contents. Directories are implied by their files. */
export type Tree = Readonly<Record<string, string>>;

/** Knobs for making a fixture tree misbehave in specific, realistic ways. */
export interface FileSystemOptions {
  /**
   * Symlinks: link path → absolute target. The link appears in its parent's
   * listing; `stat` resolves through it (a missing target is a dangling link
   * and stats NotFound); `readLink` succeeds on it and nothing else.
   */
  readonly symlinks?: Readonly<Record<string, string>>;
  /**
   * Directories whose `readDirectory` fails with `PermissionDenied` — the unreadable-subtree case.
   * They are seeded as real directories, so their parent still lists them and they stat as
   * directories.
   */
  readonly unreadable?: HashSet.HashSet<string>;
  /**
   * Paths whose `realPath` fails with the given reason — the
   * `followSymlinks` counterpart of `unreadable` / `vanished`. Seeded
   * symlinks still list and `stat` normally; only the resolve the cycle
   * guard performs is intercepted, so the walk's answer to an unresolvable
   * link is exercised in isolation from its answer to an unreadable one.
   */
  readonly unresolvable?: Readonly<Record<string, "NotFound" | "PermissionDenied">>;
  /**
   * Directories that vanish between their parent's listing and their own
   * read: they appear in listings and `stat` as directories, but
   * `readDirectory` fails NotFound — the benign-race case.
   */
  readonly vanished?: HashSet.HashSet<string>;
}

const failure = (method: "readDirectory" | "realPath", reason: "NotFound" | "PermissionDenied", path: string) =>
  Effect.fail(
    PlatformError.systemError({
      _tag: reason,
      module: "FileSystem",
      method,
      pathOrDescriptor: path,
    })
  );

const fileSystem = (tree: Tree, options: FileSystemOptions = {}): Layer.Layer<FileSystem.FileSystem> => {
  const unreadable = options.unreadable ?? HashSet.empty<string>();
  const vanished = options.vanished ?? HashSet.empty<string>();
  const unresolvable = options.unresolvable ?? {};

  const seed: Record<string, MemoryFileSystemSeedEntry> = {};
  for (const [path, contents] of R.toEntries(tree)) seed[path] = contents;
  for (const [link, target] of R.toEntries(options.symlinks ?? {})) seed[link] = MemoryFileSystem.symlink(target);
  for (const dir of HashSet.union(unreadable, vanished)) seed[dir] ??= MemoryFileSystem.directory();

  return MemoryFileSystem.layerWith(seed, {
    faults: {
      readDirectory: (path: string) => {
        if (HashSet.has(unreadable, path)) return failure("readDirectory", "PermissionDenied", path);
        if (HashSet.has(vanished, path)) return failure("readDirectory", "NotFound", path);
        return undefined;
      },
      realPath: (path: string) => {
        const reason = unresolvable[path];
        return reason === undefined ? undefined : failure("realPath", reason, path);
      },
    },
  });
};

/** A `FileSystem` + `Path` layer over a virtual tree that misbehaves as `options` describes. */
export const platformWith: {
  (options: FileSystemOptions): (tree: Tree) => Layer.Layer<FileSystem.FileSystem | Path.Path>;
  (tree: Tree, options: FileSystemOptions): Layer.Layer<FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  (tree: Tree, options: FileSystemOptions): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
    Layer.mergeAll(fileSystem(tree, options), Path.layer)
);

/** A `FileSystem` + `Path` layer over a well-behaved virtual tree — the platform half of every suite. */
export const platform = (tree: Tree): Layer.Layer<FileSystem.FileSystem | Path.Path> => platformWith(tree, {});
