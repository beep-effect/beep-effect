import { fileURLToPath } from "node:url";
import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const encoder = new TextEncoder();
const largeStdout = Str.repeat(1024 * 1024)("x");
const largeStderr = Str.repeat(1024 * 1024)("e");

const targetPathFrom = (command: ChildProcess.StandardCommand) => O.getOrElse(A.last(command.args), () => "");

const processHandle = (
  stdout: Stream.Stream<Uint8Array>,
  stderr: Stream.Stream<Uint8Array>
): ChildProcessSpawner.ChildProcessHandle =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout,
    stderr,
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });

const ConcurrentOutputSpawnerLayer = Layer.effect(
  ChildProcessSpawner.ChildProcessSpawner,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const stderrStarted = yield* Deferred.make<void>();
    const stdoutStarted = yield* Deferred.make<void>();

    return ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) {
        return Effect.die("Expected a standard Biome command");
      }

      const targetPath = targetPathFrom(command);
      expect(Str.isNonEmpty(targetPath)).toBe(true);
      expect(command.options.stdin).toBe("ignore");
      expect(command.options.stdout).toBe("pipe");
      expect(command.options.stderr).toBe("pipe");

      return fs
        .writeFileString(targetPath, '{ "name": "@beep/example" }\n')
        .pipe(
          Effect.as(
            processHandle(
              Stream.fromEffect(
                Deferred.succeed(stdoutStarted, undefined).pipe(Effect.andThen(Deferred.await(stderrStarted)))
              ).pipe(Stream.flatMap(() => Stream.make(encoder.encode(largeStdout)))),
              Stream.fromEffect(
                Deferred.succeed(stderrStarted, undefined).pipe(Effect.andThen(Deferred.await(stdoutStarted)))
              ).pipe(Stream.flatMap(() => Stream.make(encoder.encode(largeStderr))))
            )
          )
        );
    });
  })
);

const EmptyOutputSpawnerLayer = Layer.effect(
  ChildProcessSpawner.ChildProcessSpawner,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    return ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) {
        return Effect.die("Expected a standard Biome command");
      }

      const targetPath = targetPathFrom(command);
      return fs.writeFileString(targetPath, "").pipe(Effect.as(processHandle(Stream.empty, Stream.empty)));
    });
  })
);

// Seed the renderer's module-relative root lookup in the same isolated volume
// that the controlled spawner reads and writes.
const MockFileSystemLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const moduleDir = fileURLToPath(new URL("../../src/schemas", import.meta.url));
    yield* fs.makeDirectory(moduleDir, { recursive: true });
    yield* fs.writeFileString(`${moduleDir}/bun.lock`, "");
  })
).pipe(Layer.provideMerge(MemoryFileSystem.layer));
const MockPlatformLayer = Layer.mergeAll(MockFileSystemLayer, Path.layer);
const ConcurrentOutputTestLayer = ConcurrentOutputSpawnerLayer.pipe(Layer.provideMerge(MockPlatformLayer));
const EmptyOutputTestLayer = EmptyOutputSpawnerLayer.pipe(Layer.provideMerge(MockPlatformLayer));

describe("renderBiomeJson", () => {
  it.layer(NodeServices.layer, {
    timeout: "10 seconds",
    excludeTestServices: true,
  })((it) => {
    it.effect(
      "formats JSON when the requested target is excluded by repository Biome rules",
      Effect.fnUntraced(function* () {
        yield* Effect.logInfo("repo-utils.biome.native.render.start");
        const rendered = yield* renderBiomeJson("scratchpad/docgen.json", {
          name: "@beep/example",
        });

        yield* Effect.logInfo("repo-utils.biome.native.render.complete");
        expect(rendered).toBe('{ "name": "@beep/example" }\n');
      })
    );
  });

  it.layer(ConcurrentOutputTestLayer, {
    timeout: "10 seconds",
    excludeTestServices: true,
  })((it) => {
    it.effect(
      "drains high-volume stdout and stderr concurrently",
      Effect.fnUntraced(function* () {
        yield* Effect.logInfo("repo-utils.biome.duplex.render.start");
        const rendered = yield* renderBiomeJson("package.json", {
          name: "@beep/example",
        }).pipe(Effect.timeout(Duration.seconds(2)));

        yield* Effect.logInfo("repo-utils.biome.duplex.render.complete");
        expect(rendered).toBe('{ "name": "@beep/example" }\n');
      })
    );
  });

  it.layer(EmptyOutputTestLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails closed when Biome leaves an empty rendered file",
      Effect.fnUntraced(function* () {
        yield* Effect.logInfo("repo-utils.biome.empty-output.render.start");
        const error = yield* renderBiomeJson("scratchpad/docgen.json", {
          name: "@beep/example",
        }).pipe(Effect.flip);

        yield* Effect.logInfo("repo-utils.biome.empty-output.render.complete");
        expect(error.message).toBe('Biome produced empty output for "scratchpad/docgen.json".');
      })
    );
  });
});
