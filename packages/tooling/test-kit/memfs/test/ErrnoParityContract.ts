import { currentHostPlatform, HostProcessPlatform } from "@beep/utils/HostProcess";
import { assert, describe, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import type { Vitest } from "@effect/vitest";
import type * as Layer from "effect/Layer";
import type * as PlatformError from "effect/PlatformError";
import type * as Scope from "effect/Scope";

type Implementation = "memory" | "node";

interface Failure {
  readonly code?: string;
  readonly method: string;
  readonly tag: PlatformError.SystemErrorTag | "BadArgument";
}

type Outcome = "success" | Failure;

// decision: errno-parity-expectation-shapes
type Expectation =
  | Outcome
  | { readonly linux: Outcome; readonly darwin: Outcome }
  | { readonly memory: Outcome; readonly node: Outcome };

interface Case {
  readonly check?: (
    value: unknown,
    fs: FileSystem.FileSystem,
    path: (...segments: ReadonlyArray<string>) => string
  ) => Effect.Effect<void, PlatformError.PlatformError>;
  readonly expect: Expectation;
  readonly name: string;
  readonly run: (
    fs: FileSystem.FileSystem,
    path: (...segments: ReadonlyArray<string>) => string
  ) => Effect.Effect<unknown, PlatformError.PlatformError, Scope.Scope>;
}

const fail = (tag: Failure["tag"], method: string, code?: string): Failure =>
  code === undefined ? { tag, method } : { tag, method, code };

const resolveExpectation = (expectation: Expectation, implementation: Implementation, platform: string): Outcome => {
  if (expectation === "success" || "tag" in expectation) return expectation;
  if ("memory" in expectation) return expectation[implementation];
  if (implementation === "memory" || platform === "linux") return expectation.linux;
  if (platform === "darwin") return expectation.darwin;
  throw new Error(`no errno expectation for platform ${platform}`);
};

const infoType = (value: unknown) => (P.hasProperty(value, "type") ? value.type : undefined);

const bytes = new Uint8Array([1, 2, 3, 4]);

const withHandle = (
  fs: FileSystem.FileSystem,
  file: string,
  flag: FileSystem.OpenFlag,
  use: (handle: FileSystem.File) => Effect.Effect<unknown, PlatformError.PlatformError>
) => Effect.flatMap(fs.open(file, { flag }), use);

const closedHandle = (fs: FileSystem.FileSystem, file: string) => Effect.scoped(fs.open(file, { flag: "r" }));

const fileIsEmpty: NonNullable<Case["check"]> = (_, fs, p) =>
  Effect.map(fs.readFile(p("file")), (contents) => assert.strictEqual(contents.length, 0));

const cases: ReadonlyArray<Case> = [
  {
    name: "readLink on a regular file",
    run: (fs, p) => fs.readLink(p("file")),
    expect: fail("Unknown", "readLink", "EINVAL"),
  },
  {
    name: "readLink on a directory",
    run: (fs, p) => fs.readLink(p("dir")),
    expect: fail("Unknown", "readLink", "EINVAL"),
  },
  {
    name: "readLink on a missing path",
    run: (fs, p) => fs.readLink(p("missing")),
    expect: fail("NotFound", "readLink", "ENOENT"),
  },
  {
    name: "readLink through a symlink loop",
    run: (fs, p) => fs.readLink(p("loop1", "x")),
    expect: fail("BadResource", "readLink", "ELOOP"),
  },

  {
    name: "remove a non-empty directory without recursive",
    run: (fs, p) => fs.remove(p("full")),
    expect: fail("Unknown", "remove", "ERR_FS_EISDIR"),
  },
  {
    name: "remove an empty directory without recursive",
    run: (fs, p) => fs.remove(p("empty")),
    expect: fail("Unknown", "remove", "ERR_FS_EISDIR"),
  },
  {
    name: "remove an empty directory with force but without recursive",
    run: (fs, p) => fs.remove(p("empty"), { force: true }),
    expect: fail("Unknown", "remove", "ERR_FS_EISDIR"),
  },
  {
    name: "remove an empty directory named with a trailing slash",
    run: (fs, p) => fs.remove(`${p("empty")}/`),
    expect: fail("Unknown", "remove", "ERR_FS_EISDIR"),
  },
  {
    name: "remove a directory named with a trailing slash recursively",
    run: (fs, p) => fs.remove(`${p("full")}/`, { recursive: true }),
    expect: "success",
    check: (_, fs, p) => Effect.map(fs.exists(p("full")), (exists) => assert.isFalse(exists)),
  },
  {
    name: "remove a file named with a trailing slash",
    run: (fs, p) => fs.remove(`${p("file")}/`),
    expect: fail("BadResource", "remove", "ENOTDIR"),
  },

  {
    name: "makeDirectory beneath a file",
    run: (fs, p) => fs.makeDirectory(p("file", "child")),
    expect: fail("BadResource", "makeDirectory", "ENOTDIR"),
  },
  {
    name: "makeDirectory recursively beneath a file",
    run: (fs, p) => fs.makeDirectory(p("file", "child", "grandchild"), { recursive: true }),
    expect: fail("BadResource", "makeDirectory", "ENOTDIR"),
  },
  {
    name: "makeDirectory onto a file",
    run: (fs, p) => fs.makeDirectory(p("file")),
    expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
  },
  {
    name: "makeDirectory of the root",
    run: (fs) => fs.makeDirectory("/"),
    expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
  },
  {
    name: "makeDirectory of the root recursively",
    run: (fs) => fs.makeDirectory("/", { recursive: true }),
    expect: "success",
  },

  // decision: engine-errno-reference-is-adapter-callback
  {
    name: "makeDirectory recursively onto a dangling symlink",
    run: (fs, p) => fs.makeDirectory(p("dangling"), { recursive: true }),
    expect: fail("NotFound", "makeDirectory", "ENOENT"),
  },
  {
    name: "makeDirectory recursively beneath a dangling symlink",
    run: (fs, p) => fs.makeDirectory(p("dangling", "a", "b"), { recursive: true }),
    expect: fail("BadResource", "makeDirectory", "ENOTDIR"),
  },
  {
    name: "makeDirectory recursively onto a dangling symlink named with a trailing slash",
    run: (fs, p) => fs.makeDirectory(`${p("dangling")}/`, { recursive: true }),
    expect: { linux: fail("NotFound", "makeDirectory", "ENOENT"), darwin: "success" },
  },
  {
    name: "makeDirectory onto a dangling symlink",
    run: (fs, p) => fs.makeDirectory(p("dangling")),
    expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
  },
  {
    name: "makeDirectory beneath a dangling symlink",
    run: (fs, p) => fs.makeDirectory(p("dangling", "a")),
    expect: fail("NotFound", "makeDirectory", "ENOENT"),
  },
  {
    name: "makeDirectory recursively onto a symlink loop",
    run: (fs, p) => fs.makeDirectory(p("loop1"), { recursive: true }),
    expect: fail("BadResource", "makeDirectory", "ELOOP"),
  },
  {
    name: "makeDirectory recursively beneath a symlink loop",
    run: (fs, p) => fs.makeDirectory(p("loop1", "a", "b"), { recursive: true }),
    expect: fail("BadResource", "makeDirectory", "ELOOP"),
  },
  {
    name: "makeDirectory onto a symlink loop",
    run: (fs, p) => fs.makeDirectory(p("loop1")),
    expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
  },
  {
    name: "makeDirectory recursively onto a file",
    run: (fs, p) => fs.makeDirectory(p("file"), { recursive: true }),
    expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
  },
  {
    name: "makeDirectory recursively onto a symlink to a file",
    run: (fs, p) => fs.makeDirectory(p("filesym"), { recursive: true }),
    expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
  },
  {
    name: "makeDirectory recursively beneath a symlink to a file",
    run: (fs, p) => fs.makeDirectory(p("filesym", "a", "b"), { recursive: true }),
    expect: fail("BadResource", "makeDirectory", "ENOTDIR"),
  },
  {
    name: "makeDirectory recursively onto a symlink to a directory",
    run: (fs, p) => fs.makeDirectory(p("dirsym"), { recursive: true }),
    expect: "success",
  },
  {
    name: "makeDirectory recursively beneath a symlink to a directory",
    run: (fs, p) => fs.makeDirectory(p("dirsym", "a", "b"), { recursive: true }),
    expect: "success",
    check: (_, fs, p) => Effect.map(fs.exists(p("dir", "a", "b")), (exists) => assert.isTrue(exists)),
  },

  {
    name: "rename a directory into itself",
    run: (fs, p) => fs.rename(p("dir"), p("dir", "sub")),
    expect: fail("Unknown", "rename", "EINVAL"),
  },
  {
    name: "rename a directory over a file",
    run: (fs, p) => fs.rename(p("dir"), p("file")),
    expect: fail("BadResource", "rename", "ENOTDIR"),
  },
  {
    name: "rename a file over a directory",
    run: (fs, p) => fs.rename(p("file"), p("dir")),
    expect: fail("BadResource", "rename", "EISDIR"),
  },
  {
    name: "rename a directory over a non-empty directory",
    run: (fs, p) => fs.rename(p("dir"), p("full")),
    expect: fail("Unknown", "rename", "ENOTEMPTY"),
  },
  {
    name: "rename a file beneath a file",
    run: (fs, p) => fs.rename(p("file"), p("file2", "x")),
    expect: fail("BadResource", "rename", "ENOTDIR"),
  },
  {
    name: "rename a directory named with a trailing slash",
    run: (fs, p) => fs.rename(`${p("dir")}/`, p("moved")),
    expect: "success",
  },
  {
    name: "rename a directory onto a new trailing-slash path",
    run: (fs, p) => fs.rename(p("dir"), `${p("moved")}/`),
    expect: "success",
  },
  {
    name: "rename a file named with a trailing slash",
    run: (fs, p) => fs.rename(`${p("file")}/`, p("moved")),
    expect: fail("BadResource", "rename", "ENOTDIR"),
  },
  {
    name: "rename a file onto a new trailing-slash path",
    run: (fs, p) => fs.rename(p("file"), `${p("moved")}/`),
    expect: { linux: fail("BadResource", "rename", "ENOTDIR"), darwin: fail("NotFound", "rename", "ENOENT") },
  },

  {
    name: "copyFile from a directory",
    run: (fs, p) => fs.copyFile(p("dir"), p("out")),
    expect: { linux: fail("BadResource", "copyFile", "EISDIR"), darwin: fail("Unknown", "copyFile", "ENOTSUP") },
  },
  {
    name: "copyFile onto a directory",
    run: (fs, p) => fs.copyFile(p("file"), p("dir")),
    expect: fail("BadResource", "copyFile", "EISDIR"),
  },
  {
    name: "copyFile onto a new trailing-slash path",
    run: (fs, p) => fs.copyFile(p("file"), `${p("out")}/`),
    expect: { linux: fail("BadResource", "copyFile", "EISDIR"), darwin: fail("NotFound", "copyFile", "ENOENT") },
  },

  {
    name: "copy a directory into itself",
    run: (fs, p) => fs.copy(p("full"), p("full", "sub")),
    expect: fail("Unknown", "copy", "ERR_FS_CP_EINVAL"),
  },
  {
    name: "copy a directory onto itself",
    run: (fs, p) => fs.copy(p("full"), p("full"), { overwrite: true }),
    expect: fail("Unknown", "copy", "ERR_FS_CP_EINVAL"),
  },
  {
    name: "copy a file onto itself",
    run: (fs, p) => fs.copy(p("file"), p("file")),
    expect: fail("Unknown", "copy", "ERR_FS_CP_EINVAL"),
  },
  {
    name: "copy a file onto its own hard link",
    run: (fs, p) =>
      Effect.andThen(fs.link(p("file"), p("hardlink")), fs.copy(p("file"), p("hardlink"), { overwrite: true })),
    expect: fail("Unknown", "copy", "ERR_FS_CP_EINVAL"),
  },
  {
    name: "copy a directory onto a file",
    run: (fs, p) => fs.copy(p("full"), p("file")),
    expect: fail("Unknown", "copy", "ERR_FS_CP_DIR_TO_NON_DIR"),
  },
  {
    name: "copy a directory onto a file with overwrite",
    run: (fs, p) => fs.copy(p("full"), p("file"), { overwrite: true }),
    expect: fail("Unknown", "copy", "ERR_FS_CP_DIR_TO_NON_DIR"),
  },
  {
    name: "copy a file onto a directory",
    run: (fs, p) => fs.copy(p("file"), p("dir")),
    expect: fail("Unknown", "copy", "ERR_FS_CP_NON_DIR_TO_DIR"),
  },
  {
    name: "copy a file onto a directory with overwrite",
    run: (fs, p) => fs.copy(p("file"), p("dir"), { overwrite: true }),
    expect: fail("Unknown", "copy", "ERR_FS_CP_NON_DIR_TO_DIR"),
  },
  {
    name: "copy a tree whose file lands on a nested directory",
    run: (fs, p) =>
      Effect.andThen(
        fs.makeDirectory(p("shadow", "a"), { recursive: true }),
        fs.copy(p("full"), p("shadow"), { overwrite: true })
      ),
    expect: fail("Unknown", "copy", "ERR_FS_CP_NON_DIR_TO_DIR"),
  },
  {
    name: "copy a tree whose directory lands on a nested file",
    run: (fs, p) =>
      Effect.andThen(
        fs.makeDirectory(p("shadow", "a"), { recursive: true }),
        fs.copy(p("shadow"), p("full"), { overwrite: true })
      ),
    expect: fail("Unknown", "copy", "ERR_FS_CP_DIR_TO_NON_DIR"),
  },
  {
    name: "copy a tree with a nested kind mismatch without overwrite",
    run: (fs, p) =>
      Effect.andThen(fs.makeDirectory(p("shadow", "a"), { recursive: true }), fs.copy(p("full"), p("shadow"))),
    expect: fail("Unknown", "copy", "ERR_FS_CP_NON_DIR_TO_DIR"),
  },
  {
    name: "copy a file onto an existing file without overwrite",
    run: (fs, p) => fs.copy(p("file"), p("file2")),
    expect: { memory: fail("AlreadyExists", "copy", "EEXIST"), node: "success" },
  },
  {
    name: "copy a directory onto an existing directory without overwrite",
    run: (fs, p) => fs.copy(p("full"), p("full2")),
    expect: { memory: fail("AlreadyExists", "copy", "EEXIST"), node: "success" },
  },
  {
    name: "copy into a missing parent directory",
    run: (fs, p) => fs.copy(p("file"), p("missing", "out")),
    expect: { memory: fail("NotFound", "copy", "ENOENT"), node: "success" },
  },

  {
    name: "open a directory for writing",
    run: (fs, p) => fs.open(p("dir"), { flag: "w" }),
    expect: fail("BadResource", "open", "EISDIR"),
  },
  {
    name: "open a directory for reading",
    run: (fs, p) => fs.open(p("dir"), { flag: "r" }),
    expect: "success",
  },
  {
    name: "sync a directory opened for reading",
    run: (fs, p) => withHandle(fs, p("dir"), "r", (h) => h.sync),
    expect: "success",
  },
  {
    name: "read from a directory opened for reading",
    run: (fs, p) => withHandle(fs, p("dir"), "r", (h) => h.readAlloc(4)),
    expect: fail("BadResource", "readAlloc", "EISDIR"),
  },
  {
    name: "open a directory for writing",
    run: (fs, p) => fs.open(p("dir"), { flag: "r+" }),
    expect: fail("BadResource", "open", "EISDIR"),
  },
  {
    name: "stream a directory",
    run: (fs, p) => Stream.runDrain(fs.stream(p("dir"))),
    expect: fail("BadResource", "readAlloc", "EISDIR"),
  },
  {
    name: "read from a write-only handle",
    run: (fs, p) => withHandle(fs, p("file"), "w", (h) => h.read(new Uint8Array(4))),
    expect: fail("Unknown", "read", "EBADF"),
  },
  {
    name: "readAlloc from a write-only handle",
    run: (fs, p) => withHandle(fs, p("file"), "w", (h) => h.readAlloc(4)),
    expect: fail("Unknown", "readAlloc", "EBADF"),
  },
  {
    name: "write to a read-only handle",
    run: (fs, p) => withHandle(fs, p("file"), "r", (h) => h.write(bytes)),
    expect: fail("Unknown", "write", "EBADF"),
  },
  {
    name: "writeAll to a read-only handle",
    run: (fs, p) => withHandle(fs, p("file"), "r", (h) => h.writeAll(bytes)),
    expect: fail("Unknown", "writeAll", "EBADF"),
  },
  {
    name: "truncate a read-only handle",
    run: (fs, p) => withHandle(fs, p("file"), "r", (h) => h.truncate(0)),
    expect: fail("Unknown", "truncate", "EINVAL"),
  },
  {
    name: "read from a closed handle",
    run: (fs, p) => Effect.flatMap(closedHandle(fs, p("file")), (h) => h.read(new Uint8Array(4))),
    expect: fail("Unknown", "read", "EBADF"),
  },
  {
    name: "stat a closed handle",
    run: (fs, p) => Effect.flatMap(closedHandle(fs, p("file")), (h) => h.stat),
    expect: fail("Unknown", "stat", "EBADF"),
  },

  {
    name: "link to a directory",
    run: (fs, p) => fs.link(p("dir"), p("dirlink")),
    expect: fail("PermissionDenied", "link", "EPERM"),
  },
  {
    name: "link onto an existing entry",
    run: (fs, p) => fs.link(p("file"), p("file2")),
    expect: fail("AlreadyExists", "link", "EEXIST"),
  },
  {
    name: "link onto a new trailing-slash path",
    run: (fs, p) => fs.link(p("file"), `${p("new")}/`),
    expect: fail("NotFound", "link", "ENOENT"),
  },
  {
    name: "symlink onto an existing entry",
    run: (fs, p) => fs.symlink(p("file"), p("file2")),
    expect: fail("AlreadyExists", "symlink", "EEXIST"),
  },
  {
    name: "symlink onto a directory named with a trailing slash",
    run: (fs, p) => fs.symlink(p("file"), `${p("dir")}/`),
    expect: fail("AlreadyExists", "symlink", "EEXIST"),
  },
  {
    name: "symlink onto a new trailing-slash path",
    run: (fs, p) => fs.symlink(p("file"), `${p("new")}/`),
    expect: fail("NotFound", "symlink", "ENOENT"),
  },

  {
    name: "writeFile onto a directory named with a trailing slash",
    run: (fs, p) => fs.writeFileString(`${p("dir")}/`, "x"),
    expect: fail("BadResource", "writeFile", "EISDIR"),
  },
  {
    name: "writeFile onto a new trailing-slash path",
    run: (fs, p) => fs.writeFileString(`${p("new")}/`, "x"),
    expect: { linux: fail("BadResource", "writeFile", "EISDIR"), darwin: fail("NotFound", "writeFile", "ENOENT") },
  },
  {
    name: "readFile a path with a NUL byte",
    run: (fs, p) => fs.readFile(p("a\u0000b")),
    expect: fail("BadArgument", "readFile"),
  },
  {
    name: "writeFile a path with a NUL byte",
    run: (fs, p) => fs.writeFileString(p("a\u0000b"), "x"),
    expect: fail("BadArgument", "writeFile"),
  },
  {
    name: "readFile a directory",
    run: (fs, p) => fs.readFile(p("dir")),
    expect: fail("BadResource", "readFile", "EISDIR"),
  },
  {
    name: "readDirectory a file",
    run: (fs, p) => fs.readDirectory(p("file")),
    expect: fail("BadResource", "readDirectory", "ENOTDIR"),
  },
  { name: "stat a symlink loop", run: (fs, p) => fs.stat(p("loop1")), expect: fail("BadResource", "stat", "ELOOP") },
  {
    name: "lstat a symlink loop",
    run: (fs, p) => fs.lstat(p("loop1")),
    expect: "success",
    check: (value) => Effect.sync(() => assert.strictEqual(infoType(value), "SymbolicLink")),
  },
  {
    name: "lstat a dangling symlink",
    run: (fs, p) => fs.lstat(p("dangling")),
    expect: "success",
    check: (value) => Effect.sync(() => assert.strictEqual(infoType(value), "SymbolicLink")),
  },
  {
    name: "lstat beneath a file",
    run: (fs, p) => fs.lstat(p("file", "x")),
    expect: fail("BadResource", "lstat", "ENOTDIR"),
  },
  {
    name: "utimes beneath a file",
    run: (fs, p) => fs.utimes(p("file", "x"), 0, 0),
    expect: fail("BadResource", "utime", "ENOTDIR"),
  },
  {
    name: "makeTempDirectory inside a file",
    run: (fs, p) => fs.makeTempDirectory({ directory: p("file") }),
    expect: fail("BadResource", "makeTempDirectory", "ENOTDIR"),
  },
  {
    name: "truncate to a negative length",
    run: (fs, p) => fs.truncate(p("file"), -1),
    expect: "success",
    check: fileIsEmpty,
  },

  {
    name: "truncate a handle to a negative length",
    run: (fs, p) => withHandle(fs, p("file"), "r+", (h) => h.truncate(-1)),
    expect: "success",
    check: fileIsEmpty,
  },

  {
    name: "glob from a missing root",
    run: (fs, p) => fs.glob("*", { root: p("missing") }),
    expect: "success",
    check: (value) => Effect.sync(() => assert.deepStrictEqual(value, [])),
  },
  {
    name: "glob from a file root",
    run: (fs, p) => fs.glob("*", { root: p("file") }),
    expect: "success",
    check: (value) => Effect.sync(() => assert.deepStrictEqual(value, [])),
  },
  {
    name: "glob from a symlink-loop root",
    run: (fs, p) => fs.glob("*", { root: p("loop1") }),
    expect: "success",
    check: (value) => Effect.sync(() => assert.deepStrictEqual(value, [])),
  },
];

const seedTree = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  p: (...segments: ReadonlyArray<string>) => string
) {
  yield* fs.writeFileString(p("file"), "x");
  yield* fs.writeFileString(p("file2"), "y");
  yield* fs.makeDirectory(p("dir"));
  yield* fs.makeDirectory(p("empty"));
  yield* fs.makeDirectory(p("full"));
  yield* fs.writeFileString(p("full", "a"), "a");
  yield* fs.makeDirectory(p("full2"));
  yield* fs.writeFileString(p("full2", "b"), "b");
  yield* fs.symlink(p("loop2"), p("loop1"));
  yield* fs.symlink(p("loop1"), p("loop2"));
  yield* fs.symlink(p("nowhere"), p("dangling"));
  yield* fs.symlink(p("file"), p("filesym"));
  yield* fs.symlink(p("dir"), p("dirsym"));
});

const assertOutcome = (exit: Exit.Exit<unknown, PlatformError.PlatformError>, expected: Outcome): void => {
  if (expected === "success") {
    assert.isTrue(Exit.isSuccess(exit), Exit.isFailure(exit) ? `expected success, got ${String(exit.cause)}` : "");
    return;
  }
  if (Exit.isSuccess(exit)) {
    assert.fail(`expected a ${expected.tag} failure, got success`);
  }
  const found = Cause.findError(exit.cause);
  if (Result.isFailure(found)) {
    assert.fail(`expected a typed failure, got ${String(exit.cause)}`);
  }
  const error = found.success;
  assert.strictEqual(error._tag, "PlatformError");
  assert.strictEqual(error.reason._tag, expected.tag);
  assert.strictEqual(error.reason.method, expected.method);
  if (expected.code !== undefined) {
    const cause = error.reason.cause;
    assert(P.hasProperty(cause, "code"), "a system error carries its errno code on reason.cause; a BadArgument none");
    assert.strictEqual(
      cause.code,
      expected.code,
      "the errno node reports rides on reason.cause, as the node adapter sets it"
    );
  }
};

type Harness = Vitest.MethodsNonLive<FileSystem.FileSystem>;

export const errnoCases: {
  (implementation: Implementation): (it: Harness) => void;
  (it: Harness, implementation: Implementation): void;
} = dual(2, (it: Harness, implementation: Implementation): void => {
  describe("failure shape matches the node adapter", () => {
    for (const testCase of cases) {
      it.effect(testCase.name, () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-filesystem-errno-" });
          const p = (...segments: ReadonlyArray<string>) => A.join([root, ...segments], "/");
          yield* seedTree(fs, p);
          const exit = yield* testCase.run(fs, p).pipe(Effect.exit);
          const HostProcessPlatform1 = yield* HostProcessPlatform;
          assertOutcome(exit, resolveExpectation(testCase.expect, implementation, HostProcessPlatform1));
          if (testCase.check !== undefined && Exit.isSuccess(exit)) {
            yield* testCase.check(exit.value, fs, p);
          }
        }).pipe(Effect.provideService(HostProcessPlatform, currentHostPlatform))
      );
    }
  });
});

export const errnoSuite: {
  <E>(fsLayer: Layer.Layer<FileSystem.FileSystem, E>): (implementation: Implementation) => void;
  <E>(implementation: Implementation, fsLayer: Layer.Layer<FileSystem.FileSystem, E>): void;
} = dual(2, <E>(implementation: Implementation, fsLayer: Layer.Layer<FileSystem.FileSystem, E>) =>
  layer(fsLayer, { timeout: "30 seconds" })(`FileSystem errno parity (${implementation})`, (it) =>
    errnoCases(it, implementation)
  )
);
