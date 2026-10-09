import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MemoryFileSystem } from "../../../effected/memfs/MemoryFileSystem.ts";
import { makeSyncFileSystem, makePromisesFileSystem, withFaults, syscallForMethod } from "../../../effected/memfs/internal/ports.ts";
import { deliberatelyInvalid } from "../deliberatelyInvalid.ts";

it.effect("stat reports disappearance between path resolution and metadata inspection", () => Effect.gen(function* () {
  const handle = yield* MemoryFileSystem.makeHandle({ "/file": "content" });
  let reads = 0;
  const volume = { ...handle.volume, lstat: (path: string) => {
    if (path === "/file") {
      reads += 1;
      if (reads > 1) return undefined;
    }
    return handle.volume.lstat(path);
  } };
  assert.throws(() => makeSyncFileSystem(volume).stat("/file"), /ENOENT/);
}));

it.effect("readFile reports ENOTDIR when a resolved file loses its readable bytes", () => Effect.gen(function* () {
  const handle = yield* MemoryFileSystem.makeHandle({ "/file": "content" });
  const port = makeSyncFileSystem({ ...handle.volume, bytes: () => undefined });
  assert.throws(() => port.readFile("/file"), /ENOTDIR/);
  assert.strictEqual(handle.volume.text("/file"), "content");
}));

it.effect("fault wrappers delegate nonfunction handlers and preserve data members", () => Effect.sync(() => {
  const port = { read: () => "content", version: 1 };
  const faults = { read: deliberatelyInvalid<() => string>(42) };
  const wrapped = withFaults<typeof port>(port, faults, "test port");
  assert.strictEqual(wrapped.read(), "content");
  assert.strictEqual(wrapped.version, 1);
}));

it.effect("readFile uses bytes for options lacking a string encoding", () => Effect.gen(function* () {
  const handle = yield* MemoryFileSystem.makeHandle({ "/file": "content" });
  for (const options of [{}, { encoding: 42 }, 42] as const) {
    const result: unknown = yield* Effect.promise(() => handle.promises.readFile("/file", deliberatelyInvalid<"utf8">(options)));
    assert.deepStrictEqual(result, new TextEncoder().encode("content"));
  }
}));

it.effect("dirent inspection preserves an entry that disappears after directory listing", () => Effect.gen(function* () {
  const handle = yield* MemoryFileSystem.makeHandle({ "/file": "content" });
  const volume = { ...handle.volume, lstat: (path: string) => path === "/file" ? undefined : handle.volume.lstat(path) };
  const entries = yield* Effect.promise(() => makePromisesFileSystem(volume).readdir("/", { withFileTypes: true }));
  const entry = entries.find((entry) => entry.name === "file");
  assert.isDefined(entry);
  if (entry === undefined) return assert.fail("the listing must retain the entry name");
  assert.isFalse(entry.isFile());
  assert.isFalse(entry.isDirectory());
  assert.isFalse(entry.isSymbolicLink());
}));

it.effect("parent traversal from the virtual root remains at root", () => Effect.gen(function* () {
  const handle = yield* MemoryFileSystem.makeHandle({ "/file": "content" });
  assert.strictEqual(handle.sync.readFile("../../file"), "content");
}));

it.effect("fault wrappers skip members removed during handler enumeration", () => Effect.sync(() => {
  const port: { read?: () => string } = { read: () => "content" };
  const faults = { get read() { delete port.read; return () => "replacement"; } };
  const wrapped = withFaults<typeof port>(port, faults, "mutable port");
  assert.strictEqual(wrapped.read, undefined);
}));

it.effect("fault wrappers skip a member that stops being callable after validation", () => Effect.sync(() => {
  let reads = 0;
  const port = { get read() { reads += 1; return reads === 1 ? () => "content" : 42; } };
  const wrapped = withFaults<typeof port>(port, { read: () => "replacement" }, "accessor port");
  assert.strictEqual(wrapped.read, 42);
}));

it.effect("dirent listing survives a directory disappearing after its names were read", () => Effect.gen(function* () {
  const handle = yield* MemoryFileSystem.makeHandle({ "/dir/file": "content" });
  let reads = 0;
  const volume = { ...handle.volume, lstat: (path: string) => {
    if (path === "/dir") {
      reads += 1;
      if (reads > 1) return undefined;
    }
    return handle.volume.lstat(path);
  } };
  const entries = yield* Effect.promise(() => makePromisesFileSystem(volume).readdir("/dir", { withFileTypes: true }));
  assert.strictEqual(entries.length, 1);
  const entry = entries[0];
  assert.isDefined(entry);
  if (entry === undefined) return assert.fail("the listing must retain the entry");
  assert.strictEqual(entry.name, "file");
  assert.isTrue(entry.isFile());
}));

it.effect("unknown methods retain their syscall name", () => Effect.sync(() => {
  assert.strictEqual(syscallForMethod("customRead"), "customRead");
}));
