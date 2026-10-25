/**
 * A read-only, synchronous `FileSystem` over `node:fs`'s sync API, for
 * programs that must run under `Effect.runSync` — a config loader called from
 * a synchronous entry point, a build-script shim — yet still take
 * `FileSystem.FileSystem` from context.
 *
 * **Details**
 *
 * Deliberately a separate subpath (`@beep/memfs/NodeSyncFileSystem`): the main
 * entry imports nothing from `node:*`, and this module is the one place that
 * does. Import it only where Node's filesystem is the platform you mean.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $MemfsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as BI from "effect/BigInt";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { errnoTag } from "./internal/errno.ts";
import type * as PlatformErrorNs from "effect/PlatformError";

// Effect FileSystem cannot provide the synchronous operations required by Effect.runSync.
const NFS = process.getBuiltinModule("node:fs");

type PlatformErrorType = PlatformErrorNs.PlatformError;

const $I = $MemfsId.create("NodeSyncFileSystem");

class UnsafeIntegerError extends S.TaggedError<UnsafeIntegerError, { readonly brand: unique symbol }>(
  $I`UnsafeIntegerError`
)(
  "UnsafeIntegerError",
  {
    message: S.String.pipe(
      $I.annoteKey("UnsafeIntegerError.message", {
        description: "The filesystem stat field and value that exceed the safe integer range.",
      })
    ),
  },
  $I.annoteError<UnsafeIntegerError>("UnsafeIntegerError", {
    description: "A filesystem stat value cannot be represented as a safe integer.",
  })
) {}

class ReadOnlyFileSystemError extends S.TaggedError<ReadOnlyFileSystemError, { readonly brand: unique symbol }>(
  $I`ReadOnlyFileSystemError`
)(
  "ReadOnlyFileSystemError",
  {
    message: S.String.pipe(
      $I.annoteKey("ReadOnlyFileSystemError.message", {
        description: "The unsupported operation requested from the read-only filesystem.",
      })
    ),
  },
  $I.annoteError<ReadOnlyFileSystemError>("ReadOnlyFileSystemError", {
    description: "An operation is unsupported by the read-only synchronous filesystem.",
  })
) {}

class InvalidPathArgumentError extends S.TaggedError<InvalidPathArgumentError, { readonly brand: unique symbol }>(
  $I`InvalidPathArgumentError`
)(
  "InvalidPathArgumentError",
  {
    message: S.String.pipe(
      $I.annoteKey("InvalidPathArgumentError.message", {
        description: "The required path argument type and the received type.",
      })
    ),
    code: S.tag("ERR_INVALID_ARG_TYPE").pipe(
      $I.annoteKey("InvalidPathArgumentError.code", {
        description: "The Node.js error code for an invalid path argument type.",
      })
    ),
  },
  $I.annoteError<InvalidPathArgumentError>("InvalidPathArgumentError", {
    description: "The path argument supplied to the synchronous filesystem has an invalid type.",
  })
) {
  override readonly name = "TypeError";
}

// Mirrors @effect/platform-node-shared's `handleErrnoException`: the tag comes
// from the code through the shared `errnoTag` mapping (anything unmapped,
// including node's `ERR_*` argument codes, is Unknown) and the node error rides
// as `cause`.
const errnoException: {
  (method: string, path: string, err: unknown): PlatformErrorType;
  (path: string, err: unknown): (method: string) => PlatformErrorType;
} = dual(
  3,
  (method: string, path: string, err: unknown): PlatformErrorType =>
    PlatformError.systemError({
      _tag: errnoTag(P.hasProperty(err, "code") && P.isString(err.code) ? err.code : undefined),
      module: "FileSystem",
      method,
      pathOrDescriptor: path,
      syscall: P.hasProperty(err, "syscall") && P.isString(err.syscall) ? err.syscall : undefined,
      cause: err,
    })
);

// Mirrors the adapter's `effectify(…, handleErrnoException, handleBadArgument)`
// split: a failure from the syscall itself (it carries a numeric `errno` or a
// `syscall`) is a system error; anything node throws BEFORE the syscall — its
// argument validation, whose errors also carry string codes such as
// ERR_INVALID_ARG_VALUE (a NUL byte) or ERR_INVALID_ARG_TYPE — is BadArgument.
const fail: {
  (method: string, path: string, err: unknown): PlatformErrorType;
  (path: string, err: unknown): (method: string) => PlatformErrorType;
} = dual(
  3,
  (method: string, path: string, err: unknown): PlatformErrorType =>
    (P.hasProperty(err, "errno") && P.isNumber(err.errno)) ||
    (P.hasProperty(err, "syscall") && err.syscall !== undefined)
      ? errnoException(method, path, err)
      : PlatformError.badArgument({
          module: "FileSystem",
          method,
          description: P.hasProperty(err, "message") && P.isString(err.message) ? err.message : String(err),
        })
);

const attempt: {
  <A>(method: string, path: string, f: () => A): Effect.Effect<A, PlatformErrorType>;
  <A>(path: string, f: () => A): (method: string) => Effect.Effect<A, PlatformErrorType>;
} = dual(
  3,
  <A>(method: string, path: string, f: () => A): Effect.Effect<A, PlatformErrorType> =>
    Effect.try({ try: f, catch: (err) => fail(method, path, err) })
);

const bigintToNumber: {
  (value: bigint, field: string): number;
  (field: string): (value: bigint) => number;
} = dual(2, (value: bigint, field: string): number => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw UnsafeIntegerError.make({ message: `${field} exceeds the safe integer range: ${value}` });
  }
  return number;
});

const bigintToNumberOption = (value: bigint | undefined): O.Option<number> =>
  O.flatMap(O.fromNullishOr(value), BI.toNumber);

type NodeBigIntStats = import("node:fs").BigIntStats;

// The adapter's type cascade, in its order: the first matching predicate wins.
const fileTypeChecks: ReadonlyArray<readonly [(stat: NodeBigIntStats) => boolean, FileSystem.File.Type]> = [
  [(stat) => stat.isFile(), "File"],
  [(stat) => stat.isDirectory(), "Directory"],
  [(stat) => stat.isSymbolicLink(), "SymbolicLink"],
  [(stat) => stat.isBlockDevice(), "BlockDevice"],
  [(stat) => stat.isCharacterDevice(), "CharacterDevice"],
  [(stat) => stat.isFIFO(), "FIFO"],
  [(stat) => stat.isSocket(), "Socket"],
];

const fileType = (stat: NodeBigIntStats): FileSystem.File.Type =>
  O.getOrElse(
    O.map(
      A.findFirst(fileTypeChecks, ([is]) => is(stat)),
      ([, type]) => type
    ),
    (): FileSystem.File.Type => "Unknown"
  );

// The node adapter's `makeFileInfo`, field for field.
const fileInfo = (stat: NodeBigIntStats): FileSystem.File.Info => ({
  type: fileType(stat),
  mtime: O.fromNullishOr(stat.mtime),
  atime: O.fromNullishOr(stat.atime),
  birthtime: O.fromNullishOr(stat.birthtime),
  dev: stat.dev,
  rdev: O.fromNullishOr(stat.rdev),
  ino: O.fromNullishOr(stat.ino),
  mode: bigintToNumber(stat.mode, "mode"),
  nlink: O.fromNullishOr(stat.nlink),
  uid: bigintToNumberOption(stat.uid),
  gid: bigintToNumberOption(stat.gid),
  size: ByteSize.bytes(stat.size),
  blksize: O.map(O.fromUndefinedOr(stat.blksize), ByteSize.bytes),
  blocks: O.fromNullishOr(stat.blocks),
});

// Every member outside the read set is a DEFECT, never a typed failure: a
// program handed this filesystem that tries to write has a wiring bug, and a
// typed failure (what `FileSystem.makeNoop` answers) could be caught and
// silently absorbed as "not found".
const readOnly = (member: string) =>
  ReadOnlyFileSystemError.make({ message: `NodeSyncFileSystem is read-only: ${member} is not supported` });
const unsupported = (member: string) => () => Effect.die(readOnly(member));

// `stat` and `lstat` share one shape: the syscall's own failure is a system
// error, a stat field outside the safe integer range is BadArgument.
const statInfo =
  (method: "stat" | "lstat", read: (path: string) => NodeBigIntStats) =>
  (path: string): Effect.Effect<FileSystem.File.Info, PlatformErrorType> =>
    Effect.flatMap(
      attempt(method, path, () => read(path)),
      (stat) =>
        Effect.try({
          try: () => fileInfo(stat),
          catch: (err) =>
            PlatformError.badArgument({
              module: "FileSystem",
              method,
              description: P.hasProperty(err, "message") && P.isString(err.message) ? err.message : undefined,
            }),
        })
    );

const make: FileSystem.FileSystem = FileSystem.make({
  access: (path, options) =>
    attempt("access", path, () => {
      let mode = NFS.constants.F_OK;
      if (options?.readable === true) mode |= NFS.constants.R_OK;
      if (options?.writable === true) mode |= NFS.constants.W_OK;
      NFS.accessSync(path, mode);
    }),
  stat: statInfo("stat", (path) => NFS.statSync(path, { bigint: true })),
  lstat: statInfo("lstat", (path) => NFS.lstatSync(path, { bigint: true })),
  // The adapter's own value: node's Buffer (a Uint8Array), not a copy. A
  // non-string path never reaches `readFileSync`, which would read it as a
  // file DESCRIPTOR; the adapter's async `readFile` rejects it in its callback,
  // so it surfaces there as a system error (Unknown, ERR_INVALID_ARG_TYPE).
  readFile: (path) =>
    P.isString(path)
      ? attempt("readFile", path, () => NFS.readFileSync(path))
      : Effect.fail(
          errnoException(
            "readFile",
            path,
            InvalidPathArgumentError.make({
              message: `The "path" argument must be of type string. Received ${typeof path}`,
              code: "ERR_INVALID_ARG_TYPE",
            })
          )
        ),
  // The adapter wraps `readdir` in `Effect.tryPromise` whose catch is
  // `handleErrnoException` alone, so EVERY failure — argument errors too — is
  // a system error (an `ERR_*` code maps to Unknown). Matched here ON PURPOSE:
  // a NUL byte or non-string path is `Unknown`/`ERR_INVALID_ARG_*` for
  // readDirectory but `BadArgument` for every other member, exactly as on the
  // adapter. Do not "fix" it: it is the parity with the adapter.
  readDirectory: (path, options) =>
    Effect.try({
      try: () => NFS.readdirSync(path, { encoding: "utf8", recursive: options?.recursive === true }),
      catch: (err) => errnoException("readDirectory", path, err),
    }),
  readLink: (path) => attempt("readLink", path, () => NFS.readlinkSync(path)),
  // The JS `realpathSync`, NOT `.native`: the node adapter wraps the JS
  // `fs.realpath`, which resolves links but never canonicalizes case.
  realPath: (path) => attempt("realPath", path, () => NFS.realpathSync(path)),
  copy: unsupported("copy"),
  copyFile: unsupported("copyFile"),
  chmod: unsupported("chmod"),
  chown: unsupported("chown"),
  glob: unsupported("glob"),
  link: unsupported("link"),
  makeDirectory: unsupported("makeDirectory"),
  makeTempDirectory: unsupported("makeTempDirectory"),
  makeTempDirectoryScoped: unsupported("makeTempDirectoryScoped"),
  makeTempFile: unsupported("makeTempFile"),
  makeTempFileScoped: unsupported("makeTempFileScoped"),
  open: unsupported("open"),
  remove: unsupported("remove"),
  rename: unsupported("rename"),
  symlink: unsupported("symlink"),
  truncate: unsupported("truncate"),
  utimes: unsupported("utimes"),
  watch: () => Stream.die(readOnly("watch")),
  writeFile: unsupported("writeFile"),
});

/**
 * A read-only, synchronous `FileSystem` over `node:fs`.
 *
 * **Details**
 *
 * Every read member (`access`, `exists`, `stat`, `readFile`,
 * `readFileString`, `readDirectory`, `readLink`, `realPath`) calls `node:fs`'s
 * sync API, so a program using only those runs under `Effect.runSync`.
 * Successes and failures match `@effect/platform-node`'s `NodeFileSystem`:
 * the same `File.Info`, the same error tag, method and errno (on `cause`).
 * `realPath` resolves links but keeps the queried case, as the node adapter
 * does. The adapter's quirks are copied too: an invalid path argument (a NUL
 * byte, a non-string) is `BadArgument` for every member EXCEPT
 * `readDirectory`, which reports it as `Unknown` carrying node's
 * `ERR_INVALID_ARG_*` code, because that is what the adapter does. Every
 * other member — writes, `open` and the streams built on it, `glob`, `watch`,
 * temp files — is a defect (`Effect.die`), not a typed failure: this
 * filesystem never writes, and a caller that tries has a wiring bug
 * `Effect.catch` must not absorb.
 *
 * **Example** (Read a package manifest with Effect.runSync)
 *
 * ```ts
 * import { NodeSyncFileSystem } from "@beep/memfs/NodeSyncFileSystem";
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem;
 *   return yield* fs.readFileString("package.json");
 * });
 *
 * const text = Effect.runSync(program.pipe(Effect.provide(NodeSyncFileSystem.layer)));
 * console.log(text.length > 0); // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class NodeSyncFileSystem {
  /**
   * Provides the filesystem itself for code that takes a `FileSystem` argument.
   *
   * **Details**
   *
   * A plain value (not an `Effect`, unlike `MemoryFileSystem.make`): there is
   * no volume to build.
   *
   * **Example** (Construct a synchronous file read)
   *
   * ```ts
   * import { NodeSyncFileSystem } from "@beep/memfs/NodeSyncFileSystem";
   * import * as Effect from "effect/Effect";
   *
   * const program = NodeSyncFileSystem.fileSystem.readFileString("package.json");
   * console.log(Effect.isEffect(program)); // true
   * ```
   *
   * @category services
   * @since 0.0.0
   */
  static readonly fileSystem: FileSystem.FileSystem = make;

  /**
   * Provides `FileSystem.FileSystem` through a layer backed by synchronous
   * Node reads.
   *
   * **Example** (Provide the synchronous filesystem layer)
   *
   * ```ts
   * import { NodeSyncFileSystem } from "@beep/memfs/NodeSyncFileSystem";
   * import * as Effect from "effect/Effect";
   * import * as FileSystem from "effect/FileSystem";
   *
   * const program = Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString("package.json"));
   * const text = Effect.runSync(Effect.provide(program, NodeSyncFileSystem.layer));
   * console.log(text.length > 0); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<FileSystem.FileSystem> = Layer.succeed(FileSystem.FileSystem, make);

  private constructor() {}
}
