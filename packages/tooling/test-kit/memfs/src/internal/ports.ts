import { $MemfsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { constant, dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fallbackErrnoForTag, nodeErrno } from "./errno.ts";
import { assertKnownFaultKeys } from "./faults.ts";
import type * as PlatformError from "effect/PlatformError";
import type {
  MemoryFileSystemPromisesFileSystem,
  MemoryFileSystemReadFileEncoding,
  MemoryFileSystemSyncFileSystem,
  MemoryFileSystemVolume,
} from "../MemoryFileSystem.ts";

const MAX_LINK_HOPS = 40;

const $I = $MemfsId.create("internal/ports");
const $Facade = $MemfsId.create("MemoryFileSystem");
const ResolutionErrno = LiteralKit(["ENOENT", "ENOTDIR", "ELOOP"]).pipe(
  $I.annoteSchema("ResolutionErrno", { description: "Failures of component-wise path resolution." })
);
/**
 * Recognizes the literal entry kinds reported by the volume inspection view.
 *
 * **Example** (Recognize a symbolic link kind)
 *
 * ```ts
 * import { StatKind } from "@beep/memfs/internal/ports";
 *
 * console.log(StatKind.is.symlink("symlink")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StatKind = LiteralKit(["file", "directory", "symlink"]).pipe(
  $I.annoteSchema("StatKind", { description: "The literal volume entry kinds." })
);
/**
 * The literal kind of a file, directory, or symbolic link in the volume.
 *
 * @category type-level
 * @since 0.0.0
 */
export type StatKind = typeof StatKind.Type;

/**
 * The answer of `MemoryFileSystemVolume.lstat`: the literal kind, modification
 * time and size of one volume entry.
 *
 * **Example** (Construct literal file metadata)
 *
 * ```ts
 * import { MemoryFileSystemVolumeStat } from "@beep/memfs/MemoryFileSystem";
 *
 * const stat = MemoryFileSystemVolumeStat.make({ kind: "file", mtimeMs: 0, size: 3 });
 * console.log(stat.size); // 3
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class MemoryFileSystemVolumeStat extends S.Opaque<
  MemoryFileSystemVolumeStat,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    /** What lives at the path — a link is `"symlink"`, never its target's kind. */
    kind: StatKind.pipe(
      $Facade.annoteKey("MemoryFileSystemVolumeStat.kind", { description: "The literal entry kind." })
    ),
    /** The entry's modification time as epoch milliseconds. */
    mtimeMs: S.Finite.pipe(
      $Facade.annoteKey("MemoryFileSystemVolumeStat.mtimeMs", {
        description: "The epoch-millisecond modification time.",
      })
    ),
    /** File byte length, symlink target UTF-8 byte length, or `0` for a directory. */
    size: S.Finite.pipe(
      $Facade.annoteKey("MemoryFileSystemVolumeStat.size", { description: "The entry byte length." })
    ),
  }).pipe(
    $Facade.annoteSchema("MemoryFileSystemVolumeStat", {
      description: "The upstream MemoryFileSystemVolumeStat plain-object payload.",
    })
  )
) {}

/**
 * The stats a `MemoryFileSystemSyncFileSystem` `stat`/`lstat` answers — the
 * `node:fs` `Stats` subset a port consumer reads.
 *
 * **Details**
 *
 * `isDirectory`, `isFile` and `isSymbolicLink` are methods derived from the
 * stored `kind`, as on node's own `Stats`; `isSymbolicLink` is only ever true
 * for `lstat`.
 *
 * **Example** (Read a directory's stats)
 *
 * ```ts
 * import { MemoryFileSystemPortStats } from "@beep/memfs/MemoryFileSystem";
 *
 * const stats = MemoryFileSystemPortStats.make({ kind: "directory", mtimeMs: 0, size: 0 });
 * console.log(stats.isDirectory()); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class MemoryFileSystemPortStats extends S.Class<MemoryFileSystemPortStats, { readonly brand: unique symbol }>(
  $Facade`MemoryFileSystemPortStats`
)(
  {
    kind: StatKind.pipe(
      $Facade.annoteKey("MemoryFileSystemPortStats.kind", { description: "The entry kind the stats describe." })
    ),
    mtimeMs: S.Finite.pipe(
      $Facade.annoteKey("MemoryFileSystemPortStats.mtimeMs", {
        description: "The epoch-millisecond modification time.",
      })
    ),
    size: S.Finite.pipe(
      $Facade.annoteKey("MemoryFileSystemPortStats.size", {
        description: "File byte length, symlink target UTF-8 byte length, or 0 for a directory.",
      })
    ),
  },
  $Facade.annote("MemoryFileSystemPortStats", {
    description: "The node:fs Stats subset a synchronous or promises port answers.",
  })
) {
  /**
   * Whether the entry is a directory.
   *
   * @since 0.0.0
   */
  isDirectory(): boolean {
    return StatKind.is.directory(this.kind);
  }
  /**
   * Whether the entry is a regular file.
   *
   * @since 0.0.0
   */
  isFile(): boolean {
    return StatKind.is.file(this.kind);
  }
  /**
   * Whether the entry is a symbolic link (only ever true for `lstat`).
   *
   * @since 0.0.0
   */
  isSymbolicLink(): boolean {
    return StatKind.is.symlink(this.kind);
  }
}

/**
 * A directory entry as `readdir(path, { withFileTypes: true })` answers it.
 * Literal: a symbolic link is a symbolic link, never its target's kind.
 *
 * **Details**
 *
 * `kind` is absent when the entry vanished between listing and inspection;
 * every kind predicate then answers `false`.
 *
 * **Example** (Inspect a file dirent)
 *
 * ```ts
 * import { MemoryFileSystemDirent } from "@beep/memfs/MemoryFileSystem";
 *
 * const dirent = MemoryFileSystemDirent.make({ name: "a.txt", kind: "file" });
 * console.log(dirent.isFile()); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class MemoryFileSystemDirent extends S.Class<MemoryFileSystemDirent, { readonly brand: unique symbol }>(
  $Facade`MemoryFileSystemDirent`
)(
  {
    name: S.String.pipe(
      $Facade.annoteKey("MemoryFileSystemDirent.name", { description: "The entry name (not the path)." })
    ),
    kind: S.UndefinedOr(StatKind).pipe(
      $Facade.annoteKey("MemoryFileSystemDirent.kind", {
        description: "The literal entry kind, or undefined when the entry is gone.",
      })
    ),
  },
  $Facade.annote("MemoryFileSystemDirent", {
    description: "A literal directory entry with its kind, as readdir withFileTypes answers it.",
  })
) {
  /**
   * Whether the entry is a directory.
   *
   * @since 0.0.0
   */
  isDirectory(): boolean {
    return this.kind === "directory";
  }
  /**
   * Whether the entry is a regular file.
   *
   * @since 0.0.0
   */
  isFile(): boolean {
    return this.kind === "file";
  }
  /**
   * Whether the entry is a symbolic link.
   *
   * @since 0.0.0
   */
  isSymbolicLink(): boolean {
    return this.kind === "symlink";
  }
}
const MutationMethod = LiteralKit(["writeFile", "makeDirectory", "remove", "symlink"]).pipe(
  $I.annoteSchema("MutationMethod", { description: "The synchronous handle mutation methods." })
);
type MutationMethod = typeof MutationMethod.Type;
/**
 * Represents a resolved absolute path or the exact errno that prevented resolution.
 *
 * **Example** (Inspect a successful resolution)
 *
 * ```ts
 * import { Resolved } from "@beep/memfs/internal/ports";
 *
 * const resolved = Resolved.cases.Success.make({ path: "/hello.txt" });
 * console.log(resolved.path) // /hello.txt
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Resolved = S.TaggedUnion({
  Success: {
    path: S.String.pipe($I.annoteKey("Resolved.Success.path", { description: "The resolved absolute path." })),
  },
  Failure: {
    code: ResolutionErrno.pipe($I.annoteKey("Resolved.Failure.code", { description: "The resolution errno." })),
  },
}).pipe($I.annoteSchema("Resolved", { description: "A resolved path or the exact resolution failure." }));
type Resolved = typeof Resolved.Type;

interface HopBudget {
  hops: number;
}

const resolutionFailure = (code: typeof ResolutionErrno.Type): Resolved => Resolved.cases.Failure.make({ code });

const isUnderNonDirectory = (volume: MemoryFileSystemVolume, current: string): boolean => {
  const here = volume.lstat(current === "" ? "/" : current);
  return here !== undefined && here.kind !== "directory";
};

const followLinks = (volume: MemoryFileSystemVolume, current: string, start: string, budget: HopBudget): Resolved => {
  let candidate = start;
  for (let target = volume.readLink(candidate); target !== undefined; target = volume.readLink(candidate)) {
    budget.hops += 1;
    if (budget.hops > MAX_LINK_HOPS) return resolutionFailure("ELOOP");
    const resolved = walk(volume, Str.startsWith("/")(target) ? target : `${current}/${target}`, true, budget);
    if (Resolved.guards.Failure(resolved)) return resolved;
    candidate = resolved.path;
  }
  return Resolved.cases.Success.make({ path: candidate });
};

const stepComponent = (
  volume: MemoryFileSystemVolume,
  current: string,
  part: string,
  follow: boolean,
  budget: HopBudget
): Resolved => {
  if (isUnderNonDirectory(volume, current)) return resolutionFailure("ENOTDIR");
  if (part === "..")
    return Resolved.cases.Success.make({
      path: Str.slice(0, Math.max(0, pipe(current, Str.lastIndexOf("/"), O.getOrElse(constant(-1)))))(current),
    });
  const candidate = `${current}/${part}`;
  const next = follow
    ? followLinks(volume, current, candidate, budget)
    : Resolved.cases.Success.make({ path: candidate });
  if (Resolved.guards.Failure(next)) return next;
  return volume.lstat(next.path) === undefined ? resolutionFailure("ENOENT") : next;
};

const walk: {
  (volume: MemoryFileSystemVolume, path: string, followFinal: boolean, budget: HopBudget): Resolved;
  (path: string, followFinal: boolean, budget: HopBudget): (volume: MemoryFileSystemVolume) => Resolved;
} = dual(4, (volume: MemoryFileSystemVolume, path: string, followFinal: boolean, budget: HopBudget): Resolved => {
  let current = "";
  const parts = A.filter(Str.split("/")(path), (part) => part !== "" && part !== ".");
  for (const [i, part] of parts.entries()) {
    const step = stepComponent(volume, current, part, i < parts.length - 1 || followFinal, budget);
    if (Resolved.guards.Failure(step)) return step;
    current = step.path;
  }
  return Resolved.cases.Success.make({ path: current === "" ? "/" : current });
});

/**
 * Resolves `path` the way `stat` (or, with `followFinal: false`, `lstat`) does, reporting WHY it is absent: `ENOENT`, `ENOTDIR` (a component under a non-directory) or `ELOOP` (too many links).
 *
 * **Details**
 *
 * Links are followed in every component, not only the final one: `/links/pkg/a.json` follows the link at `/links/pkg` before it can see `a.json`, as a real filesystem walks a path. Unlike the literal inspection view under it, the resolver is defined in `stat` terms.
 *
 * **Gotchas**
 *
 * - `..` ascends from the RESOLVED location, so after a link it leaves the link's target, not the link's parent; `..` under a non-directory is `ENOTDIR`, as the kernel reports it.
 * - The link budget (40 hops, the kernel's `ELOOP` guard) is ONE counter for the whole resolution, nested target walks included, so a cycle spread across link targets still ends in `ELOOP`.
 * - A trailing slash asserts a directory, as on node: the final link is followed even for `lstat`, and a resolved non-directory is `ENOTDIR`, never the file itself.
 *
 * **Example** (Resolve a seeded file)
 *
 * ```ts
 * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
 * import { Resolved, resolvePath } from "@beep/memfs/internal/ports";
 *
 * const handle = MemoryFileSystem.makeSync({ "/hello.txt": "hello" });
 * const resolved = resolvePath(handle.volume, "/hello.txt");
 * console.log(Resolved.guards.Success(resolved)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolvePath: {
  (path: string, followFinal?: boolean): (volume: MemoryFileSystemVolume) => Resolved;
  (volume: MemoryFileSystemVolume, path: string, followFinal?: boolean): Resolved;
} = dual(
  (args) => P.isObject(args[0]),
  (volume: MemoryFileSystemVolume, path: string, followFinal = true): Resolved => {
    const trailingSlash = path.length > 1 && Str.endsWith("/")(path);
    const r = walk(volume, path, followFinal || trailingSlash, { hops: 0 });
    if (trailingSlash && Resolved.guards.Success(r) && volume.lstat(r.path)?.kind !== "directory")
      return Resolved.cases.Failure.make({ code: "ENOTDIR" });
    return r;
  }
);

const portStats = ({ kind, mtimeMs, size }: MemoryFileSystemVolumeStat): MemoryFileSystemPortStats =>
  MemoryFileSystemPortStats.make({ kind, mtimeMs, size });

const resolvedPath: {
  (resolved: Resolved, syscall: string, path: string): string;
  (syscall: string, path: string): (resolved: Resolved) => string;
} = dual(3, (resolved: Resolved, syscall: string, path: string): string =>
  Resolved.match(resolved, {
    Failure: ({ code }) => {
      throw nodeErrno(code, syscall, path);
    },
    Success: ({ path }) => path,
  })
);

const statOf: {
  (volume: MemoryFileSystemVolume, path: string, syscall: "stat" | "lstat", follow: boolean): MemoryFileSystemPortStats;
  (
    path: string,
    syscall: "stat" | "lstat",
    follow: boolean
  ): (volume: MemoryFileSystemVolume) => MemoryFileSystemPortStats;
} = dual(
  4,
  (
    volume: MemoryFileSystemVolume,
    path: string,
    syscall: "stat" | "lstat",
    follow: boolean
  ): MemoryFileSystemPortStats => {
    const resolved = resolvedPath(resolvePath(volume, path, follow), syscall, path);
    const s = volume.lstat(resolved);
    if (s === undefined) throw nodeErrno("ENOENT", syscall, path);
    return portStats(s);
  }
);

const isEncoded = (options: unknown): boolean =>
  P.isString(options) ||
  (P.isObjectOrArray(options) && P.hasProperty(options, "encoding") && P.isString(options.encoding));

const settle = <A>(f: () => A): Promise<A> => Effect.runPromise(Effect.sync(f));

/**
 * Wraps each named member of `port` so its handler runs first: a handler may throw, return a replacement, or return `undefined` to delegate.
 *
 * **Details**
 *
 * With `async`, the whole interception runs inside `settle`, so a handler that throws synchronously REJECTS — as a real `fs/promises` call does — instead of throwing.
 *
 * **Gotchas**
 *
 * An unknown member name throws `UnknownFaultKeyError` at construction.
 *
 * **Example** (Replace a port result)
 *
 * ```ts
 * import { withFaults } from "@beep/memfs/internal/ports";
 *
 * const port = withFaults({ read: () => "original" }, { read: () => "replacement" }, "example");
 * console.log(port.read()) // replacement
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const withFaults: {
  <Port extends object>(
    faults: Partial<Record<keyof Port, (...args: never) => unknown>> | undefined,
    subject: string,
    async?: boolean
  ): (port: Port) => Port;
  <Port extends object>(
    port: Port,
    faults: Partial<Record<keyof Port, (...args: never) => unknown>> | undefined,
    subject: string,
    async?: boolean
  ): Port;
} = dual(
  (args) => P.isString(args[1]) === false,
  <Port extends object>(
    port: Port,
    faults: Partial<Record<keyof Port, (...args: never) => unknown>> | undefined,
    subject: string,
    async = false
  ): Port => {
    if (faults === undefined) return port;
    assertKnownFaultKeys(faults, port, subject);
    const entries: ReadonlyArray<readonly [string, unknown]> = R.toEntries(faults);
    const intercepted = R.fromEntries(
      A.flatMap(entries, ([name, handler]) => {
        if (!P.hasProperty(port, name)) return [];
        const original = port[name];
        if (!P.isFunction(handler) || !P.isFunction(original)) return [];
        const intercept = (...args: ReadonlyArray<unknown>): unknown => {
          const replaced: unknown = handler(...args);
          return replaced === undefined ? original(...args) : replaced;
        };
        return [
          [name, async ? (...args: ReadonlyArray<unknown>) => settle(() => intercept(...args)) : intercept] as const,
        ];
      })
    );
    return { ...port, ...intercepted };
  }
);

const decoder = new TextDecoder();

const readBytes: {
  (volume: MemoryFileSystemVolume, path: string): Uint8Array;
  (path: string): (volume: MemoryFileSystemVolume) => Uint8Array;
} = dual(2, (volume: MemoryFileSystemVolume, path: string): Uint8Array => {
  const resolved = resolvedPath(resolvePath(volume, path), "open", path);
  const bytes = volume.bytes(resolved);
  if (bytes === undefined) {
    throw volume.isDirectory(resolved) ? nodeErrno("EISDIR", "read", undefined) : nodeErrno("ENOTDIR", "open", path);
  }
  return bytes;
});

/**
 * Builds a read-only synchronous filesystem port over the volume, following symbolic links for reads and `stat`.
 *
 * **Details**
 *
 * `lstat` reports the final link itself. Resolution failures become node-shaped errors with the syscall and caller path.
 *
 * **Gotchas**
 *
 * Each thrown error names the syscall node reports for the same call: `open` for `readFile`, `scandir` for `readDirectory`, `stat`/`lstat` for the stat pair. `readFile` answers the bytes of the regular file the path resolves to or node's error, never fabricated content: a directory is `EISDIR` from `read`, with no path because `read` works on a descriptor, and any other non-file is `ENOTDIR` from `open`.
 *
 * **Example** (Read a seeded file synchronously)
 *
 * ```ts
 * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
 * import { makeSyncFileSystem } from "@beep/memfs/internal/ports";
 *
 * const handle = MemoryFileSystem.makeSync({ "/hello.txt": "hello" });
 * const fs = makeSyncFileSystem(handle.volume);
 * console.log(fs.readFile("/hello.txt")) // hello
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeSyncFileSystem = (volume: MemoryFileSystemVolume): MemoryFileSystemSyncFileSystem => ({
  exists: (path) => Resolved.match(resolvePath(volume, path), { Failure: () => false, Success: () => true }),
  readFile: (path) => decoder.decode(readBytes(volume, path)),
  readDirectory: (path) => {
    const resolved = resolvedPath(resolvePath(volume, path), "scandir", path);
    const names = volume.readDirectory(resolved);
    if (names === undefined) throw nodeErrno("ENOTDIR", "scandir", path);
    return names;
  },
  isDirectory: (path) => {
    const r = resolvePath(volume, path);
    return Resolved.match(r, { Failure: () => false, Success: ({ path }) => volume.isDirectory(path) });
  },
  stat: (path) => statOf(volume, path, "stat", true),
  lstat: (path) => statOf(volume, path, "lstat", false),
});

/**
 * Builds a read-only promise-based filesystem port that rejects when volume operations fail.
 *
 * **Details**
 *
 * Reading without an encoding returns bytes. Directory entries requested with `withFileTypes` describe symbolic links literally, while `stat` follows them.
 *
 * **Gotchas**
 *
 * Only a string encoding, or `{ encoding: string }`, reads a string, as node does; `{ flag: "r" }`, `null` or `undefined` read bytes. A failure rejects with the raw node-shaped error, never a wrapper: `Effect.runPromise` squashes the cause.
 *
 * **Example** (Read a seeded file with an encoding)
 *
 * ```ts
 * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
 * import { makePromisesFileSystem } from "@beep/memfs/internal/ports";
 *
 * const handle = MemoryFileSystem.makeSync({ "/hello.txt": "hello" });
 * const fs = makePromisesFileSystem(handle.volume);
 * const text = await fs.readFile("/hello.txt", "utf8");
 * console.log(text) // hello
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makePromisesFileSystem = (volume: MemoryFileSystemVolume): MemoryFileSystemPromisesFileSystem => {
  const sync = makeSyncFileSystem(volume);
  function readdir(path: string): Promise<ReadonlyArray<string>>;
  function readdir(
    path: string,
    options: { readonly withFileTypes: true }
  ): Promise<ReadonlyArray<MemoryFileSystemDirent>>;
  function readdir(
    path: string,
    options?: { readonly withFileTypes?: boolean }
  ): Promise<ReadonlyArray<string> | ReadonlyArray<MemoryFileSystemDirent>> {
    return settle(() => {
      const names = sync.readDirectory(path);
      if (options?.withFileTypes !== true) return names;
      const r = resolvePath(volume, path);
      const base = Resolved.match(r, { Failure: () => path, Success: ({ path }) => path });
      return A.map(names, (name): MemoryFileSystemDirent => {
        const kind = volume.lstat(`${base === "/" ? "" : base}/${name}`)?.kind;
        return MemoryFileSystemDirent.make({ name, kind });
      });
    });
  }
  function readFile(path: string): Promise<Uint8Array>;
  function readFile(path: string, encoding: MemoryFileSystemReadFileEncoding): Promise<string>;
  function readFile(path: string, encoding?: MemoryFileSystemReadFileEncoding): Promise<Uint8Array | string> {
    return settle(() => (isEncoded(encoding) ? sync.readFile(path) : readBytes(volume, path)));
  }
  return {
    readdir,
    stat: (path) => settle(() => sync.stat(path)),
    lstat: (path) => settle(() => sync.lstat(path)),
    readFile,
  };
};

const methodSyscall: { readonly [method: string]: string | undefined } = {
  writeFile: "open",
  makeDirectory: "mkdir",
  symlink: "symlink",
  chmod: "chmod",
  utimes: "utime",
  remove: "lstat",
};

/**
 * Returns node's syscall for a `FileSystem` method; a method with no node twin (the seed's own `root` check) keeps its name.
 *
 * **Gotchas**
 *
 * `remove` maps to `lstat`: `rmSync` fails in the `lstat` it opens with (host-probed), not in `rm`.
 *
 * **Example** (Translate a removal syscall)
 *
 * ```ts
 * import { syscallForMethod } from "@beep/memfs/internal/ports";
 *
 * console.log(syscallForMethod("remove")) // lstat
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const syscallForMethod = (method: string): string => methodSyscall[method] ?? method;

/**
 * Runs an effect synchronously and translates typed `PlatformError` failures into node-shaped errors.
 *
 * **Details**
 *
 * A typed `PlatformError` failure is rethrown as the node-shaped error a `node:fs` call would throw (`code`, `syscall`, `path`) — never a `FiberFailure` wrapper. The code is the failure's own errno when it carries one, else derived from its tag (`BadArgument` is `EINVAL`).
 *
 * **Gotchas**
 *
 * A defect is rethrown unchanged, never converted into an errno.
 *
 * **Example** (Return a successful effect value)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { runNode } from "@beep/memfs/internal/ports";
 *
 * const value = runNode(Effect.succeed("hello"), () => ({ syscall: "open", path: "/hello.txt" }));
 * console.log(value) // hello
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runNode: {
  (
    describe: (error: PlatformError.PlatformError) => { readonly syscall: string; readonly path: string }
  ): <A>(effect: Effect.Effect<A, PlatformError.PlatformError>) => A;
  <A>(
    effect: Effect.Effect<A, PlatformError.PlatformError>,
    describe: (error: PlatformError.PlatformError) => { readonly syscall: string; readonly path: string }
  ): A;
} = dual(
  2,
  <A>(
    effect: Effect.Effect<A, PlatformError.PlatformError>,
    describe: (error: PlatformError.PlatformError) => { readonly syscall: string; readonly path: string }
  ): A => {
    const exit = Effect.runSyncExit(effect);
    if (Exit.isSuccess(exit)) return exit.value;
    const error = Cause.findErrorOption(exit.cause);
    if (O.isNone(error)) throw Cause.squash(exit.cause);
    const reason = error.value.reason;
    const code =
      reason._tag === "BadArgument"
        ? "EINVAL"
        : P.hasProperty(reason.cause, "code") && P.isString(reason.cause.code)
          ? reason.cause.code
          : fallbackErrnoForTag(reason._tag);
    const { syscall, path } = describe(error.value);
    throw nodeErrno(code, syscall, path);
  }
);

/**
 * Runs a handle mutator through {@link runNode}, using node's syscall for the `FileSystem` method and the CALLER's path.
 *
 * **Example** (Run a successful write mutation)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { runMutation } from "@beep/memfs/internal/ports";
 *
 * const result = runMutation(Effect.void, "writeFile", "/hello.txt");
 * console.log(result) // undefined
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runMutation: {
  (method: MutationMethod, path: string): (effect: Effect.Effect<void, PlatformError.PlatformError>) => void;
  (effect: Effect.Effect<void, PlatformError.PlatformError>, method: MutationMethod, path: string): void;
} = dual(3, (effect: Effect.Effect<void, PlatformError.PlatformError>, method: MutationMethod, path: string): void =>
  runNode(effect, () => ({ syscall: syscallForMethod(method), path }))
);
