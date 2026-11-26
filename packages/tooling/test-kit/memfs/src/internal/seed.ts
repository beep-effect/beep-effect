import { $MemfsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { constant, dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import { badArgument } from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import type * as FileSystem from "effect/FileSystem";
import type { PlatformError } from "effect/PlatformError";
import type { MemoryFileSystemOptionsInput } from "../MemoryFileSystem.ts";

const $I = $MemfsId.create("internal/seed");
const $Facade = $MemfsId.create("MemoryFileSystem");

/**
 * A seed entry describing a file, optionally carrying its initial permission
 * mode — built with `MemoryFileSystem.file`.
 *
 * **Example** (Construct a file seed)
 *
 * ```ts
 * import { MemoryFileSystemSeedFile } from "@beep/memfs/MemoryFileSystem";
 *
 * const entry = MemoryFileSystemSeedFile.make({ content: "hello", mode: 0o644 });
 * console.log(entry.content); // hello
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class MemoryFileSystemSeedFile extends S.Opaque<MemoryFileSystemSeedFile, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MemoryFileSystemSeedFile", {
    /** File contents; strings are UTF-8 encoded, `Uint8Array`s written verbatim. */
    content: S.Union([S.String, S.Uint8Array]).pipe(
      $Facade.annoteKey("MemoryFileSystemSeedFile.content", { description: "UTF-8 text or verbatim file bytes." })
    ),
    /** Initial permission bits (defaults to the volume's `0o644`). */
    mode: S.optionalKey(S.Finite).pipe(
      $Facade.annoteKey("MemoryFileSystemSeedFile.mode", { description: "Initial permission bits." })
    ),
    /**
     * Initial modification time as epoch milliseconds. Defaults to the volume's
     * clock at seed time, which makes every seeded entry effectively
     * simultaneous — set this when a test needs one file to read as older than
     * another.
     */
    mtime: S.optionalKey(S.Finite).pipe(
      $Facade.annoteKey("MemoryFileSystemSeedFile.mtime", {
        description: "Initial epoch-millisecond modification time.",
      })
    ),
  }).pipe(
    $Facade.annoteSchema("MemoryFileSystemSeedFile", {
      description: "The upstream MemoryFileSystemSeedFile plain-object payload.",
    })
  )
) {}

/**
 * A seed entry describing a directory — built with
 * `MemoryFileSystem.directory`. The only way a seed can express an *empty*
 * directory, and the way a directory receives an initial permission mode.
 *
 * **Example** (Construct an empty directory seed)
 *
 * ```ts
 * import { MemoryFileSystemSeedDirectory } from "@beep/memfs/MemoryFileSystem";
 *
 * const entry = MemoryFileSystemSeedDirectory.make({ mode: 0o755 });
 * console.log(entry.mode); // 493
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class MemoryFileSystemSeedDirectory extends S.Opaque<
  MemoryFileSystemSeedDirectory,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("MemoryFileSystemSeedDirectory", {
    /** Initial permission bits (defaults to the volume's `0o755`). */
    mode: S.optionalKey(S.Finite).pipe(
      $Facade.annoteKey("MemoryFileSystemSeedDirectory.mode", { description: "Initial permission bits." })
    ),
  }).pipe(
    $Facade.annoteSchema("MemoryFileSystemSeedDirectory", {
      description: "The upstream MemoryFileSystemSeedDirectory plain-object payload.",
    })
  )
) {}

/**
 * A seed entry describing a symbolic link — built with
 * `MemoryFileSystem.symlink`.
 *
 * **Example** (Construct a dangling link seed)
 *
 * ```ts
 * import { MemoryFileSystemSeedSymlink } from "@beep/memfs/MemoryFileSystem";
 *
 * const entry = MemoryFileSystemSeedSymlink.make({ target: "/later.txt" });
 * console.log(entry.target); // /later.txt
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class MemoryFileSystemSeedSymlink extends S.Opaque<
  MemoryFileSystemSeedSymlink,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("MemoryFileSystemSeedSymlink", {
    /** The link target, stored verbatim; it may dangle. */
    target: S.String.pipe(
      $Facade.annoteKey("MemoryFileSystemSeedSymlink.target", { description: "The stored link target." })
    ),
  }).pipe(
    $Facade.annoteSchema("MemoryFileSystemSeedSymlink", {
      description: "The upstream MemoryFileSystemSeedSymlink plain-object payload.",
    })
  )
) {}

/**
 * One value in a `MemoryFileSystemSeed`: plain file contents
 * (`string | Uint8Array`, unchanged from the original seed shape), or a tagged
 * entry describing a file with a mode, a directory, or a symbolic link.
 *
 * **Example** (Decode plain file content)
 *
 * ```ts
 * import { MemoryFileSystemSeedEntry } from "@beep/memfs/MemoryFileSystem";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(MemoryFileSystemSeedEntry)("hello")); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MemoryFileSystemSeedEntry = S.Union([
  S.String,
  S.Uint8Array,
  MemoryFileSystemSeedFile,
  MemoryFileSystemSeedDirectory,
  MemoryFileSystemSeedSymlink,
]).pipe(
  $Facade.annoteSchema("MemoryFileSystemSeedEntry", { description: "File contents or a tagged upstream seed entry." })
);
/**
 * @see {@link MemoryFileSystemSeedEntry} for the runtime schema and accepted values.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryFileSystemSeedEntry = typeof MemoryFileSystemSeedEntry.Type;

/**
 * A volume seed: absolute POSIX paths mapped to seed entries.
 *
 * **Details**
 *
 * Plain `string` values are UTF-8 encoded; `Uint8Array` values are written
 * verbatim. Tagged entries built with `MemoryFileSystem.file`,
 * `MemoryFileSystem.directory` and `MemoryFileSystem.symlink` let one
 * seed literal describe a whole tree — empty directories, symbolic links, and
 * initial permission modes included. Parent directories are created
 * recursively before each entry, so a seed never has to list them.
 *
 * Entries are applied in the seed's own key order; a symlink may target a path
 * seeded later (or never — dangling links are legal).
 *
 * **Example** (Recognize a path-to-content seed)
 *
 * ```ts
 * import { MemoryFileSystemSeed } from "@beep/memfs/MemoryFileSystem";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(MemoryFileSystemSeed)({ "/hello.txt": "hello" })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MemoryFileSystemSeed = S.Record(S.String, MemoryFileSystemSeedEntry).pipe(
  $Facade.annoteSchema("MemoryFileSystemSeed", { description: "Paths mapped to seed entries in application order." })
);
/**
 * @see {@link MemoryFileSystemSeed} for the runtime schema and accepted values.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryFileSystemSeed = typeof MemoryFileSystemSeed.Type;

const encoder = new TextEncoder();

const seedParent = (fs: FileSystem.FileSystem, path: string): Effect.Effect<void, PlatformError> => {
  const separator = pipe(path, Str.lastIndexOf("/"), O.getOrElse(constant(-1)));
  const parent = separator <= 0 ? "/" : Str.slice(0, separator)(path);
  return parent === "/" ? Effect.void : fs.makeDirectory(parent, { recursive: true });
};

const seedEntry = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: string,
  entry: MemoryFileSystemSeedEntry
) {
  if (P.isString(entry) || entry instanceof Uint8Array) {
    return yield* fs.writeFile(path, P.isString(entry) ? encoder.encode(entry) : entry);
  }
  return yield* Match.valueTags(entry, {
    MemoryFileSystemSeedFile: Effect.fnUntraced(function* (entry) {
      const data = P.isString(entry.content) ? encoder.encode(entry.content) : entry.content;
      yield* fs.writeFile(path, data, entry.mode !== undefined ? { mode: entry.mode } : undefined);
      if (entry.mtime !== undefined) {
        const millisecondStamp = DateTime.toDateUtc(DateTime.makeUnsafe(0));
        millisecondStamp.setTime(entry.mtime);
        yield* fs.utimes(path, millisecondStamp, millisecondStamp);
      }
    }),
    MemoryFileSystemSeedDirectory: Effect.fnUntraced(function* (entry) {
      yield* fs.makeDirectory(path, { recursive: true });
      if (entry.mode !== undefined) {
        yield* fs.chmod(path, entry.mode);
      }
    }),
    MemoryFileSystemSeedSymlink: (entry) => fs.symlink(entry.target, path),
  });
});

/**
 * Populates a filesystem from seed entries, creating their parent directories before writing files or links.
 *
 * **Details**
 *
 * Strings are encoded as UTF-8. File metadata is applied after writing; a supplied modification time sets both access and modification times. Directory modes are applied even when a directory already exists.
 *
 * **Gotchas**
 *
 * A file's `mtime` is applied after the write, which stamps the volume's clock, and sets atime too because `utimes` takes the pair. It is passed as a `Date`, never the bare number: `utimes` reads a number as Unix seconds (as `fs.utimesSync` does) while the option is epoch milliseconds. A directory mode is applied through `chmod`, not `makeDirectory`'s mode option, so it also lands on a directory an earlier entry created as its parent.
 *
 * **Example** (Seed a nested file)
 *
 * ```ts
 * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
 * import * as Effect from "effect/Effect";
 * import { seedVolume } from "@beep/memfs/internal/seed";
 *
 * const handle = MemoryFileSystem.makeSync();
 * Effect.runSync(seedVolume(handle.fileSystem, { "/nested/hello.txt": "hello" }));
 * console.log(handle.volume.text("/nested/hello.txt")) // hello
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const seedVolume: {
  (fs: FileSystem.FileSystem, seed: MemoryFileSystemSeed): Effect.Effect<void, PlatformError>;
  (seed: MemoryFileSystemSeed): (fs: FileSystem.FileSystem) => Effect.Effect<void, PlatformError>;
} = dual(
  2,
  Effect.fnUntraced(function* (fs: FileSystem.FileSystem, seed: MemoryFileSystemSeed) {
    for (const [path, entry] of R.toEntries(seed)) {
      yield* seedParent(fs, path);
      yield* seedEntry(fs, path, entry);
    }
  })
);

/**
 * Normalizes a path lexically to the volume's canonical absolute spelling.
 *
 * **Details**
 *
 * Collapses repeated separators and `.` segments, applies `..`, and resolves relative paths from the virtual root.
 *
 * **Gotchas**
 *
 * Deliberately does not follow symbolic links.
 *
 * **Example** (Normalize a relative path)
 *
 * ```ts
 * import { normalizeAbsolute } from "@beep/memfs/internal/seed";
 *
 * console.log(normalizeAbsolute("a//b/../c")) // /a/c
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeAbsolute = (path: string): string => {
  const segments: Array<string> = [];
  for (const segment of Str.split("/")(path)) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${A.join(segments, "/")}`;
};

/**
 * Describes what was wrong with a seed's `root` or one of its keys, retaining the offending root or key.
 *
 * **Example** (Describe a relative root)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { SeedRootError } from "@beep/memfs/internal/seed";
 *
 * console.log(S.is(SeedRootError)({ description: 'root must be absolute, got "repo"', subject: "repo" })); // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SeedRootError extends S.Opaque<SeedRootError, { readonly brand: unique symbol }>()(
  S.Struct({
    description: S.String.pipe(
      $I.annoteKey("SeedRootError.description", { description: "The root or seed-key validation failure." })
    ),
    subject: S.String.pipe($I.annoteKey("SeedRootError.subject", { description: "The offending root or seed key." })),
  }).pipe(
    $I.annoteSchema("SeedRootError", { description: "The plain-object failure payload from applying a seed root." })
  )
) {}

const SeedEntryTag = S.Literals([
  "MemoryFileSystemSeedFile",
  "MemoryFileSystemSeedDirectory",
  "MemoryFileSystemSeedSymlink",
]).pipe($I.annoteSchema("SeedEntryTag", { description: "The tags of the structured seed entries." }));
const isSeedShape = S.is(
  S.Record(S.String, S.Union([S.String, S.Uint8Array, S.Struct({ _tag: SeedEntryTag })])).pipe(
    $I.annoteSchema("SeedShape", {
      description:
        "Paths mapped to plain contents or tagged seed entries; entry fields are left for the volume to reject.",
    })
  )
);

const SeedReference = S.declare((u: unknown): u is MemoryFileSystemSeed => isSeedShape(u)).pipe(
  $I.annoteSchema("SeedReference", {
    description: "A MemoryFileSystemSeed held by reference, never rebuilt the way a structural Record would be.",
    toCodecArbitrary: () =>
      S.link<MemoryFileSystemSeed>()(MemoryFileSystemSeed, SchemaTransformation.passthroughSupertype()),
  })
);

/**
 * The seed and normalized join base returned after root application.
 *
 * **Details**
 *
 * The root key is required even when its value is undefined. Without a root, the seed retains its identity.
 *
 * **Example** (Validate an unrooted seed payload)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { AppliedSeed } from "@beep/memfs/internal/seed";
 *
 * console.log(S.is(AppliedSeed)({ seed: { "/hello.txt": "hello" }, root: undefined })); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppliedSeed extends S.Opaque<AppliedSeed, { readonly brand: unique symbol }>()(
  S.Struct({
    seed: SeedReference.pipe(
      $I.annoteKey("AppliedSeed.seed", { description: "The original seed or its lexically rooted entries." })
    ),
    root: S.UndefinedOr(S.String).pipe(
      $I.annoteKey("AppliedSeed.root", {
        description: "The normalized absolute join base, or undefined when no root was supplied.",
      })
    ),
  }).pipe(
    $I.annoteSchema("AppliedSeed", { description: "The plain-object success payload from applying a seed root." })
  )
) {}

/**
 * Re-keys a seed under `root`.
 *
 * **Details**
 *
 * The root is a JOIN BASE, not a jail: a relative key is joined to it lexically (as `path.posix.join` does), so a key with `..` may land outside it — `root: "/ws/repo"` with `"../extra/a.ts"` is `/ws/extra/a.ts`.
 *
 * **Gotchas**
 *
 * A relative root, or an absolute key alongside a root, is an error naming the offending value.
 *
 * **Example** (Join a seed key outside the root)
 *
 * ```ts
 * import * as Result from "effect/Result";
 * import { applyRoot } from "@beep/memfs/internal/seed";
 *
 * const applied = applyRoot({ "../extra/a.ts": "hello" }, "/ws/repo");
 * console.log(Result.isSuccess(applied) ? applied.success.seed["/ws/extra/a.ts"] : applied.failure.subject) // hello
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const applyRoot: {
  (root: string | undefined): (seed: MemoryFileSystemSeed) => Result.Result<AppliedSeed, SeedRootError>;
  (seed: MemoryFileSystemSeed, root: string | undefined): Result.Result<AppliedSeed, SeedRootError>;
} = dual(2, (seed: MemoryFileSystemSeed, root: string | undefined): Result.Result<AppliedSeed, SeedRootError> => {
  if (root === undefined) return Result.succeed(AppliedSeed.make({ seed, root: undefined }));
  if (!Str.startsWith("/")(root))
    return Result.fail(SeedRootError.make({ description: `root must be absolute, got "${root}"`, subject: root }));
  const base = normalizeAbsolute(root);
  const rooted: Record<string, MemoryFileSystemSeedEntry> = {};
  for (const [key, entry] of R.toEntries(seed)) {
    if (Str.startsWith("/")(key)) {
      return Result.fail(
        SeedRootError.make({
          description: `seed key "${key}" is absolute but a root "${root}" was given`,
          subject: key,
        })
      );
    }
    rooted[key === "" ? base : normalizeAbsolute(`${base}/${key}`)] = entry;
  }
  return Result.succeed(AppliedSeed.make({ seed: rooted, root: base }));
});

/**
 * Applies the root, creates it, then seeds.
 *
 * **Gotchas**
 *
 * A root error is a typed `BadArgument`.
 *
 * **Example** (Seed under a newly created root)
 *
 * ```ts
 * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
 * import * as Effect from "effect/Effect";
 * import { seedWith } from "@beep/memfs/internal/seed";
 *
 * const handle = MemoryFileSystem.makeSync();
 * Effect.runSync(seedWith(handle.fileSystem, { "hello.txt": "hello" }, { root: "/repo" }));
 * console.log(handle.volume.text("/repo/hello.txt")) // hello
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const seedWith: {
  (
    fs: FileSystem.FileSystem,
    seed: MemoryFileSystemSeed,
    options: MemoryFileSystemOptionsInput | undefined
  ): Effect.Effect<undefined, PlatformError>;
  (
    seed: MemoryFileSystemSeed,
    options: MemoryFileSystemOptionsInput | undefined
  ): (fs: FileSystem.FileSystem) => Effect.Effect<undefined, PlatformError>;
} = dual(
  3,
  Effect.fnUntraced(function* (
    fs: FileSystem.FileSystem,
    seed: MemoryFileSystemSeed,
    options: MemoryFileSystemOptionsInput | undefined
  ) {
    const applied = applyRoot(seed, options?.root);
    if (Result.isFailure(applied)) {
      return yield* badArgument({ module: "FileSystem", method: "seed", description: applied.failure.description });
    }
    if (applied.success.root !== undefined) {
      yield* fs.makeDirectory(applied.success.root, { recursive: true });
    }
    yield* seedVolume(fs, applied.success.seed);
  })
);
