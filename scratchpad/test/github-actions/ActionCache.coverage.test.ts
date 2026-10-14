import { BlobClient, BlockBlobClient } from "@azure/storage-blob";
import { assert, describe, it, vi } from "@effect/vitest";
import { assertSome, assertExitFailure } from "@effect/vitest/utils";
import * as Exit from "effect/Exit";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { FetchHttpClient } from "effect/http";
import { ChildProcessSpawner } from "effect/process";
import { ActionCache, ActionCacheError } from "../../effected/github-actions/ActionCache.ts";
import { BlobTransferError } from "../../effected/github-actions/BlobTransfer.ts";
import type { FileBlobTransfer } from "../../effected/github-actions/BlobTransfer.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { json, resultsEnv, twirpFetch } from "./results.ts";

const fault = PlatformError.badArgument({ module: "FileSystem", method: "test", description: "injected failure" });
interface Options {
  readonly responses?: Parameters<typeof twirpFetch>[0];
  readonly env?: Readonly<Record<string, string>>;
  readonly fs?: (fs: FileSystem.FileSystem) => FileSystem.FileSystem;
  readonly azure?: boolean;
  readonly spawnFails?: boolean;
  readonly code?: number;
  readonly expectedPath?: string;
}
const fixture = (options: Options = {}) => {
  const rpc = twirpFetch({
    CreateCacheEntry: () => json({ ok: true, signedUploadUrl: "https://blob.example/container/cache?sig=test" }),
    FinalizeCacheEntryUpload: () => json({ ok: true }),
    GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: "https://blob.example/container/cache?sig=test" }),
    ...options.responses,
  });
  const fsLayer = Layer.effect(FileSystem.FileSystem, Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.makeDirectory("/work", { recursive: true });
    yield* fs.writeFileString("/work/a.txt", "payload");
    yield* fs.makeDirectory("/work/sub");
    yield* fs.writeFileString("/work/sub/b.txt", "nested payload");
    return options.fs === undefined ? fs : options.fs(fs);
  })).pipe(Layer.provide(MemoryFileSystem.layer));
  const spawner = Layer.effect(ChildProcessSpawner.ChildProcessSpawner, Effect.map(FileSystem.FileSystem, (fs) =>
    ChildProcessSpawner.make((command) => Effect.gen(function* () {
      if (options.spawnFails === true) return yield* fault;
      if ("args" in command && command.args[0] === "czPf") {
        const destination = command.args[1];
        if (destination === undefined) return yield* Effect.die("missing archive destination");
        const manifest = command.args[3];
        if (manifest === undefined) return yield* Effect.die("missing manifest");
        const contents = yield* fs.readFileString(manifest);
        assert.isTrue(contents.endsWith("\n"));
        if (options.expectedPath !== undefined) assert.deepStrictEqual(contents.split("\n"), [options.expectedPath, ""]);
        yield* fs.writeFileString(destination, "archive bytes");
      }
      return ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(42), exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(options.code ?? 0)),
        isRunning: Effect.succeed(false), kill: () => Effect.void, stdin: Sink.drain,
        stdout: Stream.empty, stderr: Stream.make(new TextEncoder().encode("tar complaint")), all: Stream.empty,
        getInputFd: () => Sink.drain, getOutputFd: () => Stream.empty, unref: Effect.succeed(Effect.void),
      });
    })))).pipe(Layer.provide(fsLayer));
  const transfer: FileBlobTransfer = { uploadFile: () => Effect.void, downloadToFile: () => Effect.void };
  return (options.azure === true ? ActionCache.layer : ActionCache.layerWith(transfer)).pipe(
    Layer.provideMerge(Layer.mergeAll(fsLayer, Path.layer, spawner,
      resultsEnv({ GITHUB_WORKSPACE: "/work", ...options.env }),
      FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(rpc.fetch))))));
};
const failed = (name: string, options: Options, operation: (cache: ActionCache["Service"]) => Effect.Effect<void | import("effect/Option").Option<string>, ActionCacheError>, reason: ActionCacheError["reason"]) => {
  it.layer(fixture(options), { timeout: "30 seconds" })((it) => {
    it.effect(name, () => Effect.gen(function* () {
      const error = yield* Effect.flip(operation(yield* ActionCache));
      assert.strictEqual(error.reason, reason);
      assert.strictEqual(error.key, "key");
    }));
  });
};
const save = (cache: ActionCache["Service"]) => cache.save(["a.txt"], "key");
const restore = (cache: ActionCache["Service"]) => cache.restore(["a.txt"], "key");
describe("cache supplemental failure paths", () => {
  failed("archive temp directory failure", { fs: (fs) => ({ ...fs, makeTempDirectory: () => Effect.fail(fault) }) }, save, "archiveFailed");
  failed("manifest write failure", { fs: (fs) => ({ ...fs, writeFileString: () => Effect.fail(fault) }) }, save, "archiveFailed");
  failed("selected path inspection failure", { fs: (fs) => ({ ...fs, stat: (path) => path === "/work/a.txt" ? Effect.fail(fault) : fs.stat(path) }) }, (cache) => cache.save(["/work/*.txt"], "key"), "archiveFailed");
  failed("archive stat failure", { fs: (fs) => ({ ...fs, stat: (path) => path.endsWith("cache.tar.gz") ? Effect.fail(fault) : fs.stat(path) }) }, save, "archiveFailed");
  failed("archive subprocess failure", { spawnFails: true }, save, "archiveFailed");
  failed("archive nonzero status", { code: 2 }, save, "archiveFailed");
  failed("Windows fatal extraction status", { code: 2, env: { RUNNER_OS: "Windows" } }, restore, "archiveFailed");
  failed("enumeration failure", { fs: (fs) => ({ ...fs, readDirectory: () => Effect.fail(fault) }) }, (cache) => cache.save(["**/*.txt"], "key"), "archiveFailed");
  failed("missing home expansion", { env: { HOME: "", USERPROFILE: "" } }, (cache) => cache.save(["~/a.txt"], "key"), "archiveFailed");
  failed("invalid glob", {}, (cache) => cache.save(["["], "key"), "archiveFailed");
  for (const response of [() => json({}, 403), () => json({ ok: false })]) {
    failed("finalize refusal", { responses: { FinalizeCacheEntryUpload: response } }, save, "refused");
  }
  it.layer(fixture({ env: { HOME: "", USERPROFILE: "/work" }, expectedPath: "/work/a.txt" }), { timeout: "30 seconds" })((it) => {
    it.effect("USERPROFILE supplies the home fallback", () => Effect.gen(function* () { yield* (yield* ActionCache).save(["~/a.txt"], "key"); }));
  });
  it.layer(fixture({ azure: true }), { timeout: "30 seconds" })((it) => {
    it.effect("Azure failures retain typed transfer errors", () => Effect.gen(function* () {
      const upload = vi.spyOn(BlockBlobClient.prototype, "uploadFile").mockRejectedValue(new Error("upload refused"));
      const download = vi.spyOn(BlobClient.prototype, "downloadToFile").mockRejectedValue(new Error("download refused"));
      yield* Effect.acquireUseRelease(Effect.void, () => Effect.gen(function* () {
        const cache = yield* ActionCache;
        for (const operation of [save(cache), restore(cache)]) {
          const error = yield* Effect.flip(operation);
          assert.strictEqual(error.reason, "transferFailed");
          assert.instanceOf(error.cause, BlobTransferError);
        }
        assert.strictEqual(upload.mock.calls.length, 1);
        assert.strictEqual(download.mock.calls.length, 1);
      }), () => Effect.sync(() => { upload.mockRestore(); download.mockRestore(); }));
    }));
  });
  it.layer(fixture({ code: 1, env: { RUNNER_OS: "Windows" } }), { timeout: "30 seconds" })((it) => {
    it.effect("Windows extraction tolerates warnings and returns primary key", () => Effect.gen(function* () {
      assertSome(yield* restore(yield* ActionCache), "key");
    }));
  });
});
it.effect("error messages retain every reason and optional context", () => Effect.sync(() => {
  for (const [reason, message] of [
    ["misconfigured", "The Actions cache is not reachable from here"],
    ["unreachable", "The Actions cache could not be reached"],
    ["refused", "The Actions cache refused the request"],
    ["archiveFailed", "The cache archive could not be built or extracted"],
    ["transferFailed", "The cache archive did not transfer"],
  ] as const) assert.strictEqual(ActionCacheError.make({ reason }).message, message);
  assert.strictEqual(ActionCacheError.make({ reason: "refused", key: "key", status: 403, detail: "denied" }).message, 'The Actions cache refused the request for "key" with status 403: denied');
  assert.strictEqual(ActionCacheError.make({ reason: "archiveFailed", key: "key", stderr: "disk full" }).message, 'The cache archive could not be built or extracted for "key": disk full');
}));

it.effect("unstubbed saves die and identify their missing override", () => Effect.gen(function* () {
  const exit = yield* Effect.exit(ActionCache.makeTest().save([], "key"));
  assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : assert.fail("expected defect"));
  if (Exit.isFailure(exit)) assert.include(String(exit.cause), "save");
}));
it.layer(fixture(), { timeout: "30 seconds" })((it) => {
  it.effect("root wildcard folds descendants and repeated include roots", () => Effect.gen(function* () {
    yield* (yield* ActionCache).save(["/*", "/work", "/work/*", "/work/*.txt"], "key");
    assertSome(yield* restore(yield* ActionCache), "key");
  }));
});
it.layer(fixture({ env: { GITHUB_WORKSPACE: "" } }), { timeout: "30 seconds" })((it) => {
  it.effect("missing workspace falls back to the filesystem working directory", () => Effect.gen(function* () {
    yield* (yield* ActionCache).save(["/work/a.txt"], "key");
    assertSome(yield* restore(yield* ActionCache), "key");
  }));
});

it.layer(fixture({ expectedPath: "/work" }), { timeout: "30 seconds" })((it) => {
  it.effect("a literal ancestor covers its wildcard descendants with one recursive tar input", () => Effect.gen(function* () {
    yield* (yield* ActionCache).save(["/work", "/work/sub/*.txt"], "key");
    assertSome(yield* restore(yield* ActionCache), "key");
  }));
});

it.layer(fixture({ env: { RUNNER_OS: "Windows" }, expectedPath: "/work/a.txt" }), { timeout: "5 seconds" })((it) => {
  it.effect("Windows path normalization preserves the resolved manifest path", () => Effect.gen(function* () {
    yield* (yield* ActionCache).save(["/work/a.txt"], "windows-key");
  }));
});
