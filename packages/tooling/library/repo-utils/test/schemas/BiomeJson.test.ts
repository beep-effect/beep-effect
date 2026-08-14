import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as O from "effect/Option";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

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
              Stream.fromEffect(stderrStarted.pipe(Deferred.await)).pipe(
                Stream.flatMap(() => Stream.make(encoder.encode(largeStdout)))
              ),
              Stream.fromEffect(Deferred.succeed(stderrStarted, undefined)).pipe(
                Stream.flatMap(() => Stream.make(encoder.encode(largeStderr)))
              )
            )
          )
        );
    });
  })
).pipe(Layer.provide(NodeFileSystem.layer));

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
).pipe(Layer.provide(NodeFileSystem.layer));

const ConcurrentOutputTestLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, ConcurrentOutputSpawnerLayer);
const EmptyOutputTestLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, EmptyOutputSpawnerLayer);
const provideConcurrentOutputTestLayer = provideScopedLayer(ConcurrentOutputTestLayer);
const provideEmptyOutputTestLayer = provideScopedLayer(EmptyOutputTestLayer);

describe("renderBiomeJson", () => {
  it.live(
    "formats JSON when the requested target is excluded by repository Biome rules",
    Effect.fnUntraced(function* () {
      const rendered = yield* renderBiomeJson("scratchpad/docgen.json", { name: "@beep/example" });

      expect(rendered).toBe('{ "name": "@beep/example" }\n');
    }, provideScopedLayer(NodeServices.layer))
  );

  it.live(
    "drains high-volume stdout and stderr concurrently",
    Effect.fnUntraced(function* () {
      const rendered = yield* renderBiomeJson("package.json", { name: "@beep/example" }).pipe(
        Effect.timeout(Duration.seconds(2))
      );

      expect(rendered).toBe('{ "name": "@beep/example" }\n');
    }, provideConcurrentOutputTestLayer)
  );

  it.live(
    "fails closed when Biome leaves an empty rendered file",
    Effect.fnUntraced(function* () {
      const error = yield* renderBiomeJson("scratchpad/docgen.json", { name: "@beep/example" }).pipe(Effect.flip);

      expect(error.message).toBe('Biome produced empty output for "scratchpad/docgen.json".');
    }, provideEmptyOutputTestLayer)
  );
});
