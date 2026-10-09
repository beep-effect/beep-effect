import { assert, describe, it, vi } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Scheduler from "effect/Scheduler";
import * as Stream from "effect/Stream";
import * as Scope from "effect/Scope";
import { make, makeInspectableWith } from "../../../effected/memfs/internal/volume.ts";
import { deliberatelyInvalid } from "../deliberatelyInvalid.ts";
import { collectWatch } from "../helpers.ts";

const fails = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const result = yield* Effect.result(effect);
  const failure = Result.isFailure(result);
  assert(failure);
  return result.failure;
});

describe("volume uncovered contracts", () => {
  it.effect("rejects malformed namespace operations without mutation", () => Effect.gen(function* () {
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
    yield* fails(fs.utimes("/tmp", NaN, 0));
    yield* fails(fs.utimes("/tmp", 0, Infinity));
    assert.deepStrictEqual(yield* fs.readDirectory("/"), ["empty", "tmp"]);
  }));

  it.effect("creates through dangling absolute and relative symbolic links", () => Effect.gen(function* () {
    const fs = yield* make;
    yield* fs.writeFileString("/source", "payload");
    yield* fs.symlink("/target", "/absolute");
    yield* fs.symlink("relative", "/relative-link");
    yield* fs.copyFile("/source", "/absolute");
    yield* fs.copyFile("/source", "/relative-link");
    assert.strictEqual(yield* fs.readFileString("/target"), "payload");
    assert.strictEqual(yield* fs.readFileString("/relative"), "payload");
    yield* fs.symlink("/opened", "/open-link");
    const file = yield* fs.open("/open-link", { flag: "w", mode: 0o600 });
    yield* file.writeAll(new Uint8Array([7]));
    assert.deepStrictEqual(yield* fs.readFile("/opened"), new Uint8Array([7]));
    yield* fs.symlink("/missing", "/dangling");
    yield* fails(fs.makeDirectory("/dangling", { recursive: true }));
    yield* fails(fs.makeDirectory("/dangling"));
    yield* fails(fs.makeDirectory("/dangling/child", { recursive: true }));
    yield* fs.symlink("/cycle", "/cycle");
    yield* fails(fs.makeDirectory("/cycle/child", { recursive: true }));
  }));

  it.effect("copies link text and merges directory contents preserving timestamps", () => Effect.gen(function* () {
    const fs = yield* make;
    yield* fs.makeDirectory("/src/sub", { recursive: true });
    yield* fs.makeDirectory("/dest/sub", { recursive: true });
    yield* fs.writeFileString("/src/sub/a", "a");
    yield* fs.writeFileString("/dest/sub/a", "old");
    yield* fs.symlink("sub/a", "/src/link");
    yield* fs.copy("/src", "/dest", { overwrite: true, preserveTimestamps: true });
    assert.strictEqual(yield* fs.readLink("/dest/link"), "sub/a");
    assert.strictEqual(yield* fs.readFileString("/dest/sub/a"), "a");
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
    assert.strictEqual(yield* fs.readFileString("/new"), "x");
  }));

  it.effect("validates glob syntax and expands braces, escapes and character classes", () => Effect.gen(function* () {
    const fs = yield* make;
    for (const name of ["a", "b", "c", "A", "-", "]", "{x}", ".hidden", "ab", "abc"]) yield* fs.writeFileString(`/${name}`, name);
    yield* fs.makeDirectory("/dir/sub", { recursive: true });
    const cases: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
      ["{a,b}", ["a", "b"]], ["{a,{b,c}}", ["a", "b", "c"]], ["[a-c]", ["a", "b", "c"]],
      ["[a\\-]", ["-", "a"]], ["[]]", ["]"]], ["?", ["-", "A", "]", "a", "b", "c"]],
      ["a*c", ["abc"]], ["a*", ["a", "ab", "abc"]], ["\\{x\\}", ["{x}"]], ["dir/", ["dir"]],
      ["[!a-c]", ["-", "A", "]"]], ["[a--]", ["-", "a"]], ["[\\]]", ["]"]],
    ];
    for (const [pattern, expected] of cases) assert.deepStrictEqual(yield* fs.glob(pattern), expected);
    assert.deepStrictEqual(yield* fs.glob("**", { exclude: ["**"] }), []);
    assert.deepStrictEqual(yield* fs.glob("**", { root: "/missing" }), []);
    assert.deepStrictEqual(yield* fs.glob("**", { root: "/a" }), []);
    yield* fails(fs.glob("*", { root: "/bad\0root" }));
    for (const pattern of ["[", "[]", "[a\\", "[z-a]", "a\\", "a//b", "./a", "../a", "", "{".repeat(257), `{${"a,".repeat(1025)}b}`]) yield* fails(fs.glob(pattern));
    assert.deepStrictEqual(yield* fs.glob("\\*"), []);
    assert.deepStrictEqual(yield* fs.glob("{a}"), []);
    assert.deepStrictEqual(yield* fs.glob("[{}]"), []);
  }));

  it.effect("folds glob classes and keeps literal inspection entries", () => Effect.gen(function* () {
    const engine = yield* makeInspectableWith({ caseSensitive: false });
    const fs = engine.fileSystem;
    yield* fs.makeDirectory("/Dir/Sub", { recursive: true });
    yield* fs.writeFileString("/Dir/Sub/Z", "z");
    yield* fs.symlink("Dir", "/alias");
    assert.deepStrictEqual(yield* fs.glob("dir/sub/[a-z]"), ["Dir/Sub/Z"]);
    assert.deepStrictEqual(yield* fs.glob("DIR/SUB/[Z]"), ["Dir/Sub/Z"]);
    assert.strictEqual(engine.lookup("/alias/Sub"), undefined);
    assert.strictEqual(engine.list("/alias"), undefined);
    assert.strictEqual(engine.lookup("/missing"), undefined);
    assert.deepStrictEqual(engine.entries().map((entry) => entry.path), ["/", "/Dir", "/Dir/Sub", "/Dir/Sub/Z", "/alias", "/tmp"]);
  }));

  it.effect("delivers root metadata and direct child watch events", () => Effect.gen(function* () {
    const fs = yield* make;
    const root = yield* collectWatch(fs, "/", undefined, 1, fs.chmod("/", 0o700));
    assert.deepStrictEqual(root, [{ _tag: "Update", path: "/" }]);
    const child = yield* collectWatch(fs, "/", undefined, 1, fs.writeFileString("/child", "x"));
    assert.deepStrictEqual(child, [{ _tag: "Create", path: "/child" }]);
  }));

  it.effect("checks descriptor reads, seeks, zero writes and allocation failures", () => Effect.gen(function* () {
    const fs = yield* make;
    yield* fs.writeFile("/file", new Uint8Array([1, 2]));
    const file = yield* fs.open("/file", { flag: "r+" });
    assert.strictEqual(yield* file.read(new Uint8Array()), 0);
    assert.strictEqual(yield* file.write(new Uint8Array()), 0);
    yield* fails(file.seek(-1n, "start"));
    assert.strictEqual(yield* file.seek(BigInt(Number.MAX_SAFE_INTEGER) + 1n, "start"), BigInt(Number.MAX_SAFE_INTEGER) + 1n);
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
    assert.strictEqual(yield* closed.seek(1n, "current"), 0n);
    yield* Scope.close(scope, Exit.succeed(undefined));
    yield* fs.writeFileString("/file-copy", "old");
    yield* Effect.acquireUseRelease(
      Effect.sync(() => vi.spyOn(Uint8Array.prototype, "slice").mockImplementation(() => { throw new RangeError("allocation"); })),
      () => fails(fs.copyFile("/file", "/file-copy")),
      (spy) => Effect.sync(() => spy.mockRestore()),
    );
    assert.strictEqual(yield* fs.readFileString("/file-copy"), "old");
    assert.deepStrictEqual(yield* fs.readFile("/file"), new Uint8Array([1, 2]));
  }));

  it.effect("cleans temporary files and attributes missing custom directories", () => Effect.gen(function* () {
    const fs = yield* make;
    yield* fails(fs.makeTempFile({ directory: "/missing" }));
    yield* fails(fs.makeTempDirectory({ directory: "/missing" }));
    const scope = yield* Scope.make();
    const temp = yield* fs.makeTempFileScoped().pipe(Effect.provideService(Scope.Scope, scope));
    yield* Scope.close(scope, Exit.succeed(undefined));
    assert.strictEqual(yield* fs.exists(temp), false);
    const custom = yield* fs.makeTempFile({ directory: "/tmp", suffix: ".txt" });
    assert.strictEqual(yield* fs.exists(custom), true);
    const result = yield* Effect.result(fs.readFile(custom));
    assertSuccess(result, new Uint8Array());
    assert.deepStrictEqual(result.success, new Uint8Array());
  }));
  it.effect("covers namespace edge cases, metadata modes and temporary collisions", () => Effect.gen(function* () {
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
    assert.strictEqual(yield* fs.exists("/other/file"), true);
    assert.strictEqual(yield* fs.exists("/other/child"), true);
    yield* fails(fs.copyFile("/other/file", "/other/file/leaf/"));
    yield* fails(fs.symlink("x", "/other/file/leaf/"));
    yield* fails(fs.copyFile("/other/file", "/other/file/leaf"));
    yield* fs.symlink("/other", "/dir-link");
    yield* fs.symlink("missing-target", "/other/dangling");
    yield* fs.copyFile("/other/file", "/other/dangling");
    assert.strictEqual(yield* fs.readFileString("/other/missing-target"), "x");
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
    assert.deepStrictEqual(yield* fs.glob("**", { root: "/other/child" }), ["."]);
    for (const pattern of ["{a\\*,b}", "{[a,b],c}", "{{a,b}}", "{unclosed", "\\a"]) assert.deepStrictEqual(yield* fs.glob(pattern, { root: "/other/child" }), []);
  }));

  it.effect("bounds deep copy validation, cloning and removal atomically", () => Effect.gen(function* () {
    const fs = yield* make;
    const components = Array.from({ length: 259 }, () => "d");
    const tail = components.join("/");
    yield* fs.makeDirectory(`/deep/${tail}`, { recursive: true });
    yield* fs.makeDirectory(`/existing/${tail}`, { recursive: true });
    yield* fails(fs.copy("/deep", "/new"));
    yield* fails(fs.copy("/deep", "/existing", { overwrite: true }));
    yield* fails(fs.remove("/deep", { recursive: true }));
    assert.strictEqual(yield* fs.exists(`/deep/${tail}`), true);
    assert.strictEqual(yield* fs.exists("/new"), false);
    yield* fs.makeDirectory("/src/nested", { recursive: true });
    yield* fs.makeDirectory("/dest");
    yield* fs.copy("/src", "/dest", { overwrite: true });
    assert.strictEqual(yield* fs.exists("/dest/nested"), true);
  }));

  it.effect("retains watch events before callback queue attachment", () => Effect.gen(function* () {
    const fs = yield* make;
    const watcher = yield* fs.watch("/").pipe(Stream.take(1), Stream.runCollect, Effect.provideService(Scheduler.MaxOpsBeforeYield, 16), Effect.forkChild({ startImmediately: true }));
    for (let index = 0; index < 300; index++) {
      yield* Effect.yieldNow;
      yield* fs.writeFileString(`/event-${index}`, "x");
    }
    const events = yield* Fiber.join(watcher);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0]?._tag, "Create");
  }));

});
