import { ErrnoException } from "@beep/memfs/internal/errno";
import { EngineOptions, make, makeInspectableWith, VolumeEntrySnapshot } from "@beep/memfs/internal/volume";
import { assert, describe, it, vi } from "@effect/vitest";
import { assertSome, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Result from "effect/Result";
import * as Scheduler from "effect/Scheduler";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { deliberatelyInvalid } from "../deliberatelyInvalid.ts";
import { collectWatch } from "../helpers.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as PlatformError from "effect/PlatformError";

const fails = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const result = yield* Effect.result(effect);
  const failure = Result.isFailure(result);
  assert(failure);
  return result.failure;
});

const assertEbadf = Effect.fnUntraced(function* <A>(effect: Effect.Effect<A, PlatformError.PlatformError>) {
  const error = yield* fails(effect);
  assert.strictEqual(error.reason._tag, "Unknown");
  const cause = error.reason.cause;
  assert(S.is(ErrnoException)(cause));
  assert.strictEqual(cause.code, "EBADF");
});

const isReadableFlag = (flag: FileSystem.OpenFlag) => flag === "r" || Str.endsWith("+")(flag);

const contentAfterWrite = (flag: FileSystem.OpenFlag, exclusive: boolean, initialSize: number) => {
  if (Str.startsWith("a")(flag) && !exclusive) return new Uint8Array([1, 2, 3]);
  return initialSize === 2 ? new Uint8Array([3, 2]) : new Uint8Array([3]);
};

const assertFlagRead = Effect.fnUntraced(function* (
  file: FileSystem.File,
  flag: FileSystem.OpenFlag,
  initialSize: number
) {
  if (!isReadableFlag(flag)) {
    yield* assertEbadf(file.read(new Uint8Array(1)));
    return;
  }
  const buffer = new Uint8Array(2);
  const read1 = yield* file.read(buffer);
  assert.strictEqual(read1, initialSize);
});

const assertFlagWrite = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  file: FileSystem.File,
  path: string,
  flag: FileSystem.OpenFlag,
  initialSize: number
) {
  if (flag === "r") {
    yield* assertEbadf(file.writeAll(new Uint8Array([3])));
    return;
  }
  yield* file.writeAll(new Uint8Array([3]));
  const readFile2 = yield* fs.readFile(path);
  assert.deepStrictEqual(readFile2, contentAfterWrite(flag, Str.includes("x")(flag), initialSize));
});

const exerciseOpenFlag = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, flag: FileSystem.OpenFlag) {
  const path = `/flag-${flag}`;
  const exclusive = Str.includes("x")(flag);
  if (!exclusive) {
    yield* fs.writeFile(path, new Uint8Array([1, 2]));
  }
  const file = yield* fs.open(path, { flag });
  const initialSize = exclusive || Str.startsWith("w")(flag) ? 0 : 2;
  assert.strictEqual(Number((yield* file.stat).size), initialSize);
  yield* assertFlagRead(file, flag, initialSize);
  yield* file.seek(0n, "start");
  yield* assertFlagWrite(fs, file, path, flag, initialSize);
  if (exclusive) {
    assert.strictEqual((yield* fails(fs.open(path, { flag }))).reason._tag, "AlreadyExists");
  }
});

const assertInvalidFlagRejected = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, flag: unknown) {
  const error = yield* fails(fs.open("/invalid-flag", { flag: deliberatelyInvalid(flag) }));
  assert.strictEqual(error.reason._tag, "BadArgument");
  assert.strictEqual(error.reason.method, "open");
  assert.strictEqual(error.reason.description, "flag must be a supported file-open flag");
  const exists3 = yield* fs.exists("/invalid-flag");
  assert.strictEqual(exists3, false);
});

describe("volume uncovered contracts", () => {
  it.effect("owns plain engine options and required inspection keys with executable schemas", () =>
    Effect.gen(function* () {
      const isOptions = S.is(EngineOptions);
      assert.strictEqual(isOptions({ caseSensitive: true }), true);
      assert.strictEqual(isOptions({ caseSensitive: false }), true);
      for (const options of [{}, { caseSensitive: undefined }, { caseSensitive: "false" }, { caseSensitive: 0 }]) {
        assert.strictEqual(isOptions(options), false);
      }
      const value4 = yield* S.decodeEffect(EngineOptions)({ caseSensitive: false });
      assert.deepStrictEqual(value4, EngineOptions.make({ caseSensitive: false }));

      const engine = yield* makeInspectableWith(EngineOptions.make({ caseSensitive: true }));
      const root = engine.lookup("/");
      assert(root !== undefined);
      const isSnapshot = S.is(VolumeEntrySnapshot);
      assert.strictEqual(isSnapshot(root), true);
      assert.deepStrictEqual(
        root,
        VolumeEntrySnapshot.make({
          path: "/",
          type: "Directory",
          data: undefined,
          mtime: root.mtime,
          target: undefined,
          size: 0,
        })
      );
      const { data, target, ...metadata } = root;
      assert.strictEqual(data, undefined);
      assert.strictEqual(target, undefined);
      assert.strictEqual(isSnapshot({ ...metadata, target }), false);
      assert.strictEqual(isSnapshot({ ...metadata, data }), false);
      for (const payload of [
        { ...root, path: 0 },
        { ...root, type: "Other" },
        { ...root, data: [1] },
        { ...root, mtime: "0" },
        { ...root, target: null },
        { ...root, size: "0" },
        { ...root, mtime: Number.NaN },
        { ...root, mtime: Number.POSITIVE_INFINITY },
        { ...root, size: Number.NEGATIVE_INFINITY },
      ])
        assert.strictEqual(isSnapshot(payload), false);
      assert.strictEqual(isSnapshot({ ...root, mtime: -0.5, size: -0.5 }), true);
    })
  );

  it.effect("retains live file bytes across snapshots, hard links and schema validation", () =>
    Effect.gen(function* () {
      const engine = yield* makeInspectableWith(EngineOptions.make({ caseSensitive: true }));
      const fs = engine.fileSystem;
      yield* fs.writeFile("/file", new Uint8Array([1, 2]));
      yield* fs.link("/file", "/alias");
      yield* fs.symlink("file", "/symbolic");
      const file = engine.lookup("/file");
      const alias = engine.lookup("/alias");
      const symbolic = engine.lookup("/symbolic");
      assert(file !== undefined && file.data !== undefined && alias !== undefined && symbolic !== undefined);
      assert.strictEqual(alias.data, file.data);
      assert.strictEqual(engine.lookup("/file")?.data, file.data);
      assert.deepStrictEqual(
        symbolic,
        VolumeEntrySnapshot.make({
          path: "/symbolic",
          type: "SymbolicLink",
          data: undefined,
          mtime: symbolic.mtime,
          target: "file",
          size: 4,
        })
      );
      for (const entry of engine.entries()) {
        assert.strictEqual(S.is(VolumeEntrySnapshot)(entry), true);
        if (entry.type === "File") assert.strictEqual(entry.data, file.data);
      }
      const decoded = yield* S.decodeEffect(VolumeEntrySnapshot)(file);
      assert.strictEqual(decoded.data, file.data);
      file.data[0] = 9;
      const readFile5 = yield* fs.readFile("/alias");
      assert.deepStrictEqual(readFile5, new Uint8Array([9, 2]));
      assert.strictEqual(engine.lookup("/file")?.data, file.data);
    })
  );

  it.effect("accepts unsigned 32-bit mode and owner boundaries and omitted modes", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      yield* fs.makeDirectory("/default-mode", { mode: undefined });
      assert.strictEqual((yield* fs.stat("/default-mode")).mode & 0o7777, 0o755);
      const defaultFile = yield* fs.open("/default-mode/file", { flag: "w", mode: undefined });
      assert.strictEqual((yield* defaultFile.stat).mode & 0o7777, 0o644);
      for (const value of [0, 0xffff_ffff]) {
        const path = `/mode-${value}`;
        yield* fs.makeDirectory(path, { mode: value });
        assert.strictEqual((yield* fs.stat(path)).mode & 0o7777, value & 0o7777);
        const file = yield* fs.open(`${path}/file`, { flag: "w", mode: value });
        assert.strictEqual((yield* file.stat).mode & 0o7777, value & 0o7777);
        yield* fs.chmod(`${path}/file`, value);
        assert.strictEqual((yield* file.stat).mode & 0o7777, value & 0o7777);
        yield* fs.chown(`${path}/file`, value, value);
        const info = yield* file.stat;
        assertSome(info.uid, value);
        assertSome(info.gid, value);
      }
    })
  );

  it.effect("rejects invalid modes and owners with exact BadArgument descriptions without mutation", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      yield* fs.writeFile("/file", new Uint8Array([1, 2]));
      const before = yield* fs.stat("/file");
      const invalid = [
        -1,
        0.5,
        0x1_0000_0000,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        null,
        "0",
        false,
        {},
      ];
      for (const value of invalid) {
        const mode = deliberatelyInvalid<number>(value);
        for (const [method, operation] of [
          ["makeDirectory", fs.makeDirectory("/invalid-mode", { mode })],
          ["open", fs.open("/invalid-mode", { flag: "w", mode })],
          ["chmod", fs.chmod("/file", mode)],
        ] as const) {
          const error = yield* fails(operation);
          assert.strictEqual(error.reason._tag, "BadArgument");
          assert.strictEqual(error.reason.method, method);
          assert.strictEqual(error.reason.description, "mode must be an unsigned 32-bit integer");
        }
        const exists6 = yield* fs.exists("/invalid-mode");
        assert.strictEqual(exists6, false);
      }
      for (const value of [...invalid, undefined]) {
        const owner = deliberatelyInvalid<number>(value);
        for (const [name, operation] of [
          ["uid", fs.chown("/file", owner, 0)],
          ["gid", fs.chown("/file", 0, owner)],
        ] as const) {
          const error = yield* fails(operation);
          assert.strictEqual(error.reason._tag, "BadArgument");
          assert.strictEqual(error.reason.method, "chown");
          assert.strictEqual(error.reason.description, `${name} must be an unsigned 32-bit integer`);
        }
      }
      const stat7 = yield* fs.stat("/file");
      assert.deepStrictEqual(stat7, before);
      const readFile8 = yield* fs.readFile("/file");
      assert.deepStrictEqual(readFile8, new Uint8Array([1, 2]));
    })
  );

  it.effect("keeps invalid entry-name errors in the typed channel with the caller path", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      const error = yield* fails(fs.writeFile("/missing/.", new Uint8Array([1])));
      assert.strictEqual(error.reason._tag, "InvalidData");
      assert.strictEqual(error.reason.method, "writeFile");
      assert.strictEqual(error.reason.description, "Invalid directory entry name");
      assert.strictEqual(error.reason.cause, undefined);
      if (error.reason._tag === "BadArgument") assert.fail("Expected a system error");
      assert.strictEqual(error.reason.pathOrDescriptor, "/missing/.");
      const exists9 = yield* fs.exists("/missing");
      assert.strictEqual(exists9, false);
    })
  );

  it.effect("keeps allocation failures typed and leaves existing bytes unchanged", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      const original = new Uint8Array([1]);
      const replacement = new Uint8Array([2, 3]);
      yield* fs.writeFile("/allocation", original);
      const error = yield* Effect.acquireUseRelease(
        Effect.sync(() =>
          vi.spyOn(globalThis, "Uint8Array").mockImplementation(() => {
            throw new RangeError("allocation");
          })
        ),
        (spy) =>
          Effect.gen(function* () {
            const failure = yield* fails(fs.writeFile("/allocation", replacement, { flag: "r+" }));
            assert.strictEqual(spy.mock.calls.length, 1);
            assert.deepStrictEqual(spy.mock.calls[0], [2]);
            return failure;
          }),
        (spy) => Effect.sync(() => spy.mockRestore())
      );
      assert.strictEqual(error.reason._tag, "BadResource");
      assert.strictEqual(error.reason.method, "writeFile");
      assert.strictEqual(error.reason.description, "Unable to allocate file bytes");
      assert.strictEqual(error.reason.cause, undefined);
      if (error.reason._tag === "BadArgument") assert.fail("Expected a system error");
      assert.strictEqual(error.reason.pathOrDescriptor, "/allocation");
      const readFile10 = yield* fs.readFile("/allocation");
      assert.deepStrictEqual(readFile10, original);
    })
  );

  it.effect("accepts all ten open flags and rejects unsupported runtime flags without mutation", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      const flags: ReadonlyArray<FileSystem.OpenFlag> = ["r", "r+", "w", "wx", "w+", "wx+", "a", "ax", "a+", "ax+"];
      for (const flag of flags) {
        yield* exerciseOpenFlag(fs, flag);
      }
      for (const flag of ["", "rs", "as", "wxx", "R", 0, false, {}]) {
        yield* assertInvalidFlagRejected(fs, flag);
      }
    })
  );

  it.effect("preserves descriptor and namespace operations across high-fanout directories", () =>
    Effect.gen(function* () {
      const engine = yield* makeInspectableWith(EngineOptions.make({ caseSensitive: true }));
      const fs = engine.fileSystem;
      yield* fs.makeDirectory("/wide/nested", { recursive: true });
      const names: Array<string> = [];
      for (let index = 255; index >= 0; index--) {
        const name = `entry-${Str.padStart(3, "0")(String(index))}`;
        names.unshift(name);
        yield* fs.writeFile(`/wide/${name}`, new Uint8Array([index]));
      }
      const target = "/wide/entry-128";
      const file = yield* fs.open(target, { flag: "r+" });
      yield* fs.chmod(target, 0o600);
      yield* fs.link(target, "/wide/nested/link");
      yield* fs.rename(target, "/wide/nested/moved");
      yield* fs.remove("/wide/nested/moved");
      assertSome((yield* file.stat).nlink, 1n);
      const buffer = new Uint8Array(1);
      const read11 = yield* file.read(buffer);
      assert.strictEqual(read11, 1);
      assert.deepStrictEqual(buffer, new Uint8Array([128]));
      yield* file.seek(0n, "start");
      yield* file.writeAll(new Uint8Array([9, 8]));
      const readFile12 = yield* fs.readFile("/wide/nested/link");
      assert.deepStrictEqual(readFile12, new Uint8Array([9, 8]));
      assert.deepStrictEqual(engine.list("/wide"), [...A.filter(names, (name) => name !== "entry-128"), "nested"]);
      yield* fails(fs.rename("/wide", "/wide/nested/descendant"));
      yield* fs.rename("/wide/nested", "/moved");
      const readDirectory13 = yield* fs.readDirectory("/moved");
      assert.deepStrictEqual(readDirectory13, ["link"]);
      const readDirectory14 = yield* fs.readDirectory("/wide");
      assert.deepStrictEqual(
        readDirectory14,
        A.filter(names, (name) => name !== "entry-128")
      );
      const readFile15 = yield* fs.readFile("/wide/entry-255");
      assert.deepStrictEqual(readFile15, new Uint8Array([255]));
      assert.deepStrictEqual(engine.lookup("/moved/link")?.data, new Uint8Array([9, 8]));
      assert.deepStrictEqual(
        A.map(engine.entries(), (entry) => entry.path),
        [
          "/",
          "/moved",
          "/moved/link",
          "/tmp",
          "/wide",
          ...A.map(
            A.filter(names, (name) => name !== "entry-128"),
            (name) => `/wide/${name}`
          ),
        ]
      );
    })
  );

  it.effect("rejects malformed namespace operations without mutation", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      for (const path of ["", "/bad\0name", "/missing/../x"]) {
        yield* fails(fs.writeFileString(path, "x"));
        yield* fails(fs.makeDirectory(path));
        yield* fails(fs.symlink("target", path));
      }
      yield* fails(fs.symlink("bad\0target", "/link"));
      yield* fails(fs.writeFileString("/.", "x"));
      yield* fails(fs.writeFileString("/..", "x"));
      yield* fails(fs.writeFileString("/", "x"));
      yield* fs.symlink("", "/empty");
      yield* fails(fs.readFile("/empty"));
      yield* fails(fs.copyFile("/empty", "/copy"));
      yield* fails(fs.truncate("/tmp"));
      yield* fails(fs.utimes("/tmp", 1e20, 0));
      yield* fails(fs.utimes("/tmp", Number.NaN, 0));
      yield* fails(fs.utimes("/tmp", 0, Number.POSITIVE_INFINITY));
      const readDirectory16 = yield* fs.readDirectory("/");
      assert.deepStrictEqual(readDirectory16, ["empty", "tmp"]);
    })
  );

  it.effect("creates through dangling absolute and relative symbolic links", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      yield* fs.writeFileString("/source", "payload");
      yield* fs.symlink("/target", "/absolute");
      yield* fs.symlink("relative", "/relative-link");
      yield* fs.copyFile("/source", "/absolute");
      yield* fs.copyFile("/source", "/relative-link");
      const readFileString17 = yield* fs.readFileString("/target");
      assert.strictEqual(readFileString17, "payload");
      const readFileString18 = yield* fs.readFileString("/relative");
      assert.strictEqual(readFileString18, "payload");
      yield* fs.symlink("/opened", "/open-link");
      const file = yield* fs.open("/open-link", { flag: "w", mode: 0o600 });
      yield* file.writeAll(new Uint8Array([7]));
      const readFile19 = yield* fs.readFile("/opened");
      assert.deepStrictEqual(readFile19, new Uint8Array([7]));
      yield* fs.symlink("/missing", "/dangling");
      yield* fails(fs.makeDirectory("/dangling", { recursive: true }));
      yield* fails(fs.makeDirectory("/dangling"));
      yield* fails(fs.makeDirectory("/dangling/child", { recursive: true }));
      yield* fs.symlink("/cycle", "/cycle");
      yield* fails(fs.makeDirectory("/cycle/child", { recursive: true }));
    })
  );

  it.effect("copies link text and merges directory contents preserving timestamps", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      yield* fs.makeDirectory("/src/sub", { recursive: true });
      yield* fs.makeDirectory("/dest/sub", { recursive: true });
      yield* fs.writeFileString("/src/sub/a", "a");
      yield* fs.writeFileString("/dest/sub/a", "old");
      yield* fs.symlink("sub/a", "/src/link");
      yield* fs.copy("/src", "/dest", { overwrite: true, preserveTimestamps: true });
      const readLink20 = yield* fs.readLink("/dest/link");
      assert.strictEqual(readLink20, "sub/a");
      const readFileString21 = yield* fs.readFileString("/dest/sub/a");
      assert.strictEqual(readFileString21, "a");
      const source = yield* fs.stat("/src/sub/a");
      const copied = yield* fs.stat("/dest/sub/a");
      assert.deepStrictEqual(copied.mtime, source.mtime);
      yield* fails(fs.copy("/src", "/dest"));
      yield* fs.makeDirectory("/conflict/sub/a", { recursive: true });
      yield* fails(fs.copy("/src", "/conflict", { overwrite: true }));
      yield* fs.writeFileString("/file", "x");
      yield* fails(fs.rename("/file", "/dest"));
      yield* fails(fs.rename("/src", "/file"));
      yield* fs.copyFile("/file", "/new");
      yield* fs.copyFile("/file", "/new");
      const readFileString22 = yield* fs.readFileString("/new");
      assert.strictEqual(readFileString22, "x");
    })
  );

  it.effect("validates glob syntax and expands braces, escapes and character classes", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      for (const name of ["a", "b", "c", "A", "-", "]", "{x}", ".hidden", "ab", "abc"]) {
        yield* fs.writeFileString(`/${name}`, name);
      }
      yield* fs.makeDirectory("/dir/sub", { recursive: true });
      const cases: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
        ["{a,b}", ["a", "b"]],
        ["{a,{b,c}}", ["a", "b", "c"]],
        ["[a-c]", ["a", "b", "c"]],
        ["[a\\-]", ["-", "a"]],
        ["[]]", ["]"]],
        ["?", ["-", "A", "]", "a", "b", "c"]],
        ["a*c", ["abc"]],
        ["a*", ["a", "ab", "abc"]],
        ["\\{x\\}", ["{x}"]],
        ["dir/", ["dir"]],
        ["[!a-c]", ["-", "A", "]"]],
        ["[a--]", ["-", "a"]],
        ["[\\]]", ["]"]],
      ];
      for (const [pattern, expected] of cases) {
        const glob1 = yield* fs.glob(pattern);
        assert.deepStrictEqual(glob1, expected);
      }
      const glob23 = yield* fs.glob("**", { exclude: ["**"] });
      assert.deepStrictEqual(glob23, []);
      const glob24 = yield* fs.glob("**", { root: "/missing" });
      assert.deepStrictEqual(glob24, []);
      const glob25 = yield* fs.glob("**", { root: "/a" });
      assert.deepStrictEqual(glob25, []);
      yield* fails(fs.glob("*", { root: "/bad\0root" }));
      for (const pattern of [
        "[",
        "[]",
        "[a\\",
        "[z-a]",
        "a\\",
        "a//b",
        "./a",
        "../a",
        "",
        Str.repeat(257)("{"),
        `{${Str.repeat(1025)("a,")}b}`,
      ]) {
        yield* fails(fs.glob(pattern));
      }
      const glob26 = yield* fs.glob("\\*");
      assert.deepStrictEqual(glob26, []);
      const glob27 = yield* fs.glob("{a}");
      assert.deepStrictEqual(glob27, []);
      const glob28 = yield* fs.glob("[{}]");
      assert.deepStrictEqual(glob28, []);
    })
  );

  it.effect("folds glob classes and keeps literal inspection entries", () =>
    Effect.gen(function* () {
      const engine = yield* makeInspectableWith(EngineOptions.make({ caseSensitive: false }));
      const fs = engine.fileSystem;
      yield* fs.makeDirectory("/Dir/Sub", { recursive: true });
      yield* fs.writeFileString("/Dir/Sub/Z", "z");
      yield* fs.symlink("Dir", "/alias");
      const glob29 = yield* fs.glob("dir/sub/[a-z]");
      assert.deepStrictEqual(glob29, ["Dir/Sub/Z"]);
      const glob30 = yield* fs.glob("DIR/SUB/[Z]");
      assert.deepStrictEqual(glob30, ["Dir/Sub/Z"]);
      assert.strictEqual(engine.lookup("/alias/Sub"), undefined);
      assert.strictEqual(engine.list("/alias"), undefined);
      assert.strictEqual(engine.lookup("/missing"), undefined);
      assert.deepStrictEqual(
        A.map(engine.entries(), (entry) => entry.path),
        ["/", "/Dir", "/Dir/Sub", "/Dir/Sub/Z", "/alias", "/tmp"]
      );
    })
  );

  it.effect("delivers root metadata and direct child watch events", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      const root = yield* collectWatch(fs, "/", undefined, 1, fs.chmod("/", 0o700));
      assert.deepStrictEqual(root, [{ _tag: "Update", path: "/" }]);
      const child = yield* collectWatch(fs, "/", undefined, 1, fs.writeFileString("/child", "x"));
      assert.deepStrictEqual(child, [{ _tag: "Create", path: "/child" }]);
    })
  );

  it.effect("checks descriptor reads, seeks, zero writes and allocation failures", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      yield* fs.writeFile("/file", new Uint8Array([1, 2]));
      const file = yield* fs.open("/file", { flag: "r+" });
      const read31 = yield* file.read(new Uint8Array());
      assert.strictEqual(read31, 0);
      const write32 = yield* file.write(new Uint8Array());
      assert.strictEqual(write32, 0);
      yield* fails(file.seek(-1n, "start"));
      const seek33 = yield* file.seek(BigInt(Number.MAX_SAFE_INTEGER) + 1n, "start");
      assert.strictEqual(seek33, BigInt(Number.MAX_SAFE_INTEGER) + 1n);
      yield* fails(file.read(new Uint8Array([0])));
      yield* fails(file.write(new Uint8Array([0])));
      yield* file.seek(0n, "start");
      yield* fails(file.readAlloc(-1));
      yield* fails(file.readAlloc(2 ** 53));
      yield* fails(file.readAlloc(Number.MAX_SAFE_INTEGER));
      yield* fails(fs.truncate("/file", 2 ** 53));
      yield* fails(fs.truncate("/file", Number.MAX_SAFE_INTEGER));
      const reader = yield* fs.open("/file");
      yield* fails(reader.truncate());
      const scope = yield* Scope.make();
      const closed = yield* fs.open("/file").pipe(Effect.provideService(Scope.Scope, scope));
      yield* Scope.close(scope, Exit.succeed(undefined));
      yield* fails(closed.stat);
      const seek34 = yield* closed.seek(1n, "current");
      assert.strictEqual(seek34, 0n);
      yield* Scope.close(scope, Exit.succeed(undefined));
      yield* fs.writeFileString("/file-copy", "old");
      yield* Effect.acquireUseRelease(
        Effect.sync(() =>
          vi.spyOn(Uint8Array.prototype, "slice").mockImplementation(() => {
            throw new RangeError("allocation");
          })
        ),
        () => fails(fs.copyFile("/file", "/file-copy")),
        (spy) => Effect.sync(() => spy.mockRestore())
      );
      const readFileString35 = yield* fs.readFileString("/file-copy");
      assert.strictEqual(readFileString35, "old");
      const readFile36 = yield* fs.readFile("/file");
      assert.deepStrictEqual(readFile36, new Uint8Array([1, 2]));
    })
  );

  it.effect("cleans temporary files and attributes missing custom directories", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      yield* fails(fs.makeTempFile({ directory: "/missing" }));
      yield* fails(fs.makeTempDirectory({ directory: "/missing" }));
      const scope = yield* Scope.make();
      const temp = yield* fs.makeTempFileScoped().pipe(Effect.provideService(Scope.Scope, scope));
      yield* Scope.close(scope, Exit.succeed(undefined));
      const exists37 = yield* fs.exists(temp);
      assert.strictEqual(exists37, false);
      const custom = yield* fs.makeTempFile({ directory: "/tmp", suffix: ".txt" });
      const exists38 = yield* fs.exists(custom);
      assert.strictEqual(exists38, true);
      const result = yield* Effect.result(fs.readFile(custom));
      assertSuccess(result, new Uint8Array());
      assert.deepStrictEqual(result.success, new Uint8Array());
    })
  );
  it.effect("covers namespace edge cases, metadata modes and temporary collisions", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      yield* fails(fs.symlink("target", "/."));
      yield* fails(fs.symlink("target", "/.."));
      yield* fails(fs.symlink("target", "/"));
      yield* fs.makeDirectory("relative/child", { recursive: true, mode: 0o700 });
      assert.strictEqual((yield* fs.stat("/relative/child")).mode & 0o777, 0o700);
      yield* fs.writeFileString("relative/child/file", "x");
      yield* fs.copyFile("/relative/child/file", "/relative/child/file");
      yield* fs.makeDirectory("/other");
      yield* fs.rename("/relative/child/file", "/other/file");
      yield* fs.rename("/relative/child", "/other/child");
      const exists39 = yield* fs.exists("/other/file");
      assert.strictEqual(exists39, true);
      const exists40 = yield* fs.exists("/other/child");
      assert.strictEqual(exists40, true);
      yield* fails(fs.copyFile("/other/file", "/other/file/leaf/"));
      yield* fails(fs.symlink("x", "/other/file/leaf/"));
      yield* fails(fs.copyFile("/other/file", "/other/file/leaf"));
      yield* fs.symlink("/other", "/dir-link");
      yield* fs.symlink("missing-target", "/other/dangling");
      yield* fs.copyFile("/other/file", "/other/dangling");
      const readFileString41 = yield* fs.readFileString("/other/missing-target");
      assert.strictEqual(readFileString41, "x");
      yield* fails(fs.copyFile("/other/file", "/dir-link"));
      yield* fs.symlink("/loop", "/loop");
      yield* fails(fs.copyFile("/other/file", "/loop"));
      yield* fs.symlink("", "/empty-link");
      yield* fails(fs.open("/empty-link", { flag: "w" }));
      yield* fails(fs.open("/loop", { flag: "w" }));
      yield* fails(fs.open("/other/file", { flag: deliberatelyInvalid("invalid") }));
      yield* fails(fs.chown("/other/file", 0x1_0000_0000, 0));
      yield* fails(fs.makeTempDirectory({ prefix: "bad/" }));
      yield* fails(fs.makeTempFile({ suffix: "bad\0" }));
      yield* fs.makeDirectory("/tmp/00000001");
      const temporary = yield* fs.makeTempDirectory();
      assert.strictEqual(temporary, "/tmp/00000002");
      yield* fs.remove("/tmp", { recursive: true });
      yield* fails(fs.makeTempFile());
      yield* fails(fs.makeTempFile({ directory: "/bad\0dir" }));
      const glob42 = yield* fs.glob("**", { root: "/other/child" });
      assert.deepStrictEqual(glob42, ["."]);
      for (const pattern of ["{a\\*,b}", "{[a,b],c}", "{{a,b}}", "{unclosed", "\\a"]) {
        const glob2 = yield* fs.glob(pattern, { root: "/other/child" });
        assert.deepStrictEqual(glob2, []);
      }
    })
  );

  it.effect("bounds deep copy validation, cloning and removal atomically", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      const components = Array.from({ length: 259 }, () => "d");
      const tail = A.join(components, "/");
      yield* fs.makeDirectory(`/deep/${tail}`, { recursive: true });
      yield* fs.makeDirectory(`/existing/${tail}`, { recursive: true });
      yield* fails(fs.copy("/deep", "/new"));
      yield* fails(fs.copy("/deep", "/existing", { overwrite: true }));
      yield* fails(fs.remove("/deep", { recursive: true }));
      const exists43 = yield* fs.exists(`/deep/${tail}`);
      assert.strictEqual(exists43, true);
      const exists44 = yield* fs.exists("/new");
      assert.strictEqual(exists44, false);
      yield* fs.makeDirectory("/src/nested", { recursive: true });
      yield* fs.makeDirectory("/dest");
      yield* fs.copy("/src", "/dest", { overwrite: true });
      const exists45 = yield* fs.exists("/dest/nested");
      assert.strictEqual(exists45, true);
    })
  );

  it.effect("retains watch events before callback queue attachment", () =>
    Effect.gen(function* () {
      const fs = yield* make;
      const watcher = yield* fs
        .watch("/")
        .pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.provideService(Scheduler.MaxOpsBeforeYield, 16),
          Effect.forkChild({ startImmediately: true })
        );
      for (let index = 0; index < 300; index++) {
        yield* Effect.yieldNow;
        yield* fs.writeFileString(`/event-${index}`, "x");
      }
      const events = yield* Fiber.join(watcher);
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0]?._tag, "Create");
    })
  );
});
