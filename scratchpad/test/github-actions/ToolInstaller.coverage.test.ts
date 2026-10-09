import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertFailure, assertNone } from "@effect/vitest/utils";
import * as Clock from "effect/Clock";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import { ChildProcessSpawner } from "effect/process";
import * as TestClock from "effect/testing/TestClock";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { ActionEnvironment } from "../../effected/github-actions/ActionEnvironment.ts";
import { ToolInstaller, ToolInstallerError } from "../../effected/github-actions/ToolInstaller.ts";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";
import { settle } from "./results.ts";
const refused = PlatformError.badArgument({ module: "FileSystem", method: "test", description: "refused" });
const successHttp = HttpClient.make((request) =>
  Effect.succeed(HttpClientResponse.fromWeb(request, new Response("payload"))),
);
const spawner = ChildProcessSpawner.make(() =>
  Effect.succeed(
    ChildProcessSpawner.makeHandle({
      pid: ChildProcessSpawner.ProcessId(42),
      exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
      isRunning: Effect.succeed(false),
      kill: () => Effect.void,
      stdin: Sink.drain,
      stdout: Stream.empty,
      stderr: Stream.empty,
      all: Stream.empty,
      getInputFd: () => Sink.drain,
      getOutputFd: () => Stream.empty,
      unref: Effect.succeed(Effect.void),
    }),
  ),
);
const runtime = (
  mutate: (fs: FileSystem.FileSystem) => FileSystem.FileSystem,
  http = successHttp,
  processes = spawner,
) => {
  const fsLayer = Layer.effect(FileSystem.FileSystem, Effect.map(FileSystem.FileSystem, mutate)).pipe(
    Layer.provide(MemoryFileSystem.layer),
  );
  const dependencies = Layer.mergeAll(
    fsLayer,
    Path.layer,
    ActionEnvironment.layerTest({ RUNNER_TOOL_CACHE: "/cache" }),
    Layer.succeed(HttpClient.HttpClient, http),
    Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, processes),
  );
  return Layer.merge(fsLayer, ToolInstaller.layer.pipe(Layer.provide(dependencies)));
};
const unchanged = (fs: FileSystem.FileSystem) => fs;
const expectError = Effect.fn("expectError")(function* (
  operation: Effect.Effect<unknown, ToolInstallerError>,
  reason: ToolInstallerError["reason"],
  subject: string,
) {
  const result = yield* Effect.result(operation);
  const error = Result.match(result, {
    onFailure: (error) => error,
    onSuccess: () => assert.fail("expected an installer failure"),
  });
  assert.strictEqual(error.reason, reason);
  assert.strictEqual(error.subject, subject);
  assertFailure(result, error);
});
describe("ToolInstaller failure boundaries", () => {
  for (const [name, mutate] of [
    [
      "temporary extraction directory",
      (fs: FileSystem.FileSystem) => ({ ...fs, makeTempDirectory: () => Effect.fail(refused) }),
    ],
    [
      "requested extraction directory",
      (fs: FileSystem.FileSystem) => ({ ...fs, makeDirectory: () => Effect.fail(refused) }),
    ],
  ] as const) {
    it.layer(runtime(mutate), { timeout: "30 seconds" })((it) => {
      it.effect(name, () =>
        Effect.gen(function* () {
          const tool = yield* ToolInstaller;
          const destination = name === "requested extraction directory" ? "/extract" : undefined;
          yield* expectError(
            tool.extractTar("/archive", { destination }),
            "extractFailed",
            destination ?? "a temporary extraction directory",
          );
        }),
      );
    });
  }
  it.layer(
    runtime(
      unchanged,
      successHttp,
      ChildProcessSpawner.make(() => Effect.fail(refused)),
    ),
    { timeout: "30 seconds" },
  )((it) => {
    it.effect("spawn failure carries its cause and archive", () =>
      Effect.gen(function* () {
        const tool = yield* ToolInstaller;
        yield* expectError(tool.extractZip("/archive", { destination: "/extract" }), "extractFailed", "/archive");
      }),
    );
  });
  for (const [name, mutate] of [
    ["staging creation", (fs: FileSystem.FileSystem) => ({ ...fs, makeTempDirectory: () => Effect.fail(refused) })],
    [
      "cache parent creation",
      (fs: FileSystem.FileSystem) => ({
        ...fs,
        makeDirectory: (path: string, options?: Parameters<FileSystem.FileSystem["makeDirectory"]>[1]) =>
          path === "/cache" ? fs.makeDirectory(path, options) : Effect.fail(refused),
      }),
    ],
    ["cache rename", (fs: FileSystem.FileSystem) => ({ ...fs, rename: () => Effect.fail(refused) })],
    ["file copy", (fs: FileSystem.FileSystem) => ({ ...fs, copyFile: () => Effect.fail(refused) })],
  ] as const) {
    it.layer(runtime(mutate), { timeout: "30 seconds" })((it) => {
      it.effect(name, () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString("/source", "payload");
          const tool = yield* ToolInstaller;
          yield* expectError(tool.cacheFile("/source", "bin", "tool", "1"), "cacheFailed", "tool");
          assertNone(yield* tool.find("tool", "1"));
          assert.strictEqual(yield* fs.readFileString("/source"), "payload");
        }),
      );
    });
  }
  for (const [name, mutate] of [
    [
      "download temp creation",
      (fs: FileSystem.FileSystem) => ({ ...fs, makeTempDirectory: () => Effect.fail(refused) }),
    ],
    ["download sink", (fs: FileSystem.FileSystem) => ({ ...fs, sink: () => Sink.fail(refused) })],
  ] as const) {
    // Each retry test owns a fresh clock; the shared layer clock is never advanced.
    it.layer(runtime(mutate), { timeout: "30 seconds" })((it) => {
      it.effect(name, () =>
        Effect.gen(function* () {
          const tool = yield* ToolInstaller;
          const clock = yield* TestClock.make();
          const exit = yield* settle(
            Effect.result(tool.download("https://example/tool")).pipe(Effect.provideService(Clock.Clock, clock)),
            clock.adjust("10 seconds"),
          );
          const result = yield* exit;
          assertFailure(
            result,
            ToolInstallerError.make({ reason: "downloadFailed", subject: "https://example/tool", cause: refused }),
          );
        }),
      );
    });
  }
  let transportAttempts = 0;
  const brokenHttp = HttpClient.make((request) => {
    transportAttempts += 1;
    return Effect.fail(
      new HttpClientError.HttpClientError({
        reason: new HttpClientError.TransportError({ request, cause: "offline" }),
      }),
    );
  });
  it.layer(runtime(unchanged, brokenHttp), { timeout: "30 seconds" })((it) => {
    it.effect("transport errors are typed and retried to the configured limit", () =>
      Effect.gen(function* () {
        const tool = yield* ToolInstaller;
        const clock = yield* TestClock.make();
        const exit = yield* settle(
          Effect.result(tool.download("https://example/tool")).pipe(Effect.provideService(Clock.Clock, clock)),
          clock.adjust("10 seconds"),
        );
        const completed = yield* exit;
        const error = Result.match(completed, {
          onFailure: (error) => error,
          onSuccess: () => assert.fail("expected a transport failure"),
        });
        assert.strictEqual(error.reason, "downloadFailed");
        assert.strictEqual(error.subject, "https://example/tool");
        assert.strictEqual(error.retryable, true);
        assert.strictEqual(transportAttempts, 3);
      }),
    );
  });
});
it.effect("every unstubbed installer member dies with its member-specific diagnostic", () =>
  Effect.gen(function* () {
    const tool = ToolInstaller.makeTest();
    const operations: ReadonlyArray<readonly [string, Effect.Effect<unknown, ToolInstallerError>]> = [
      ["find", tool.find("tool", "1")],
      ["download", tool.download("url")],
      ["extractTar", tool.extractTar("archive")],
      ["extractZip", tool.extractZip("archive")],
      ["cacheDir", tool.cacheDir("source", "tool", "1")],
      ["cacheFile", tool.cacheFile("source", "bin", "tool", "1")],
      ["provisionFile", tool.provisionFile({ tool: "tool", version: "1", url: "url", binary: "bin" })],
    ];
    for (const [name, operation] of operations)
      assertExitFailure(
        yield* Effect.exit(operation),
        Cause.die(
          UnstubbedMemberError.make({
            message: `ToolInstaller.makeTest: ${name}() was called but not stubbed — pass a \`${name}\` override.`,
          }),
        ),
      );
  }),
);
it.layer(ToolInstaller.layerTest({ find: () => Effect.succeedNone }), { timeout: "30 seconds" })((it) => {
  it.effect("layerTest provides the requested override", () =>
    Effect.gen(function* () {
      assertNone(yield* (yield* ToolInstaller).find("tool", "1"));
    }),
  );
});
