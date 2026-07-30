import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const encoder = new TextEncoder();
const largeStdout = Str.repeat(1024 * 1024)("x");
const largeStderr = Str.repeat(1024 * 1024)("e");

const MockSpawnerLayer = Layer.effect(
  ChildProcessSpawner.ChildProcessSpawner,
  Effect.gen(function* () {
    const stderrStarted = yield* Deferred.make<void>();

    return ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) {
        return Effect.die("Expected a standard Biome command");
      }

      expect(command.options.stdin).not.toBe("ignore");
      expect(command.options.stdout).toBe("pipe");
      expect(command.options.stderr).toBe("pipe");

      return Effect.succeed(
        ChildProcessSpawner.makeHandle({
          pid: ChildProcessSpawner.ProcessId(1),
          exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
          isRunning: Effect.succeed(false),
          kill: () => Effect.void,
          unref: Effect.succeed(Effect.void),
          stdin: Sink.drain,
          stdout: Stream.fromEffect(stderrStarted.pipe(Deferred.await)).pipe(
            Stream.flatMap(() => Stream.make(encoder.encode(largeStdout)))
          ),
          stderr: Stream.fromEffect(Deferred.succeed(stderrStarted, undefined)).pipe(
            Stream.flatMap(() => Stream.make(encoder.encode(largeStderr)))
          ),
          all: Stream.empty,
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
        })
      );
    });
  })
);

const TestLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, MockSpawnerLayer);
const provideTestLayer = provideScopedLayer(TestLayer);

describe("renderBiomeJson", () => {
  it.live(
    "drains high-volume stdout and stderr concurrently",
    Effect.fnUntraced(function* () {
      const rendered = yield* renderBiomeJson("package.json", { name: "@beep/example" }).pipe(
        Effect.timeout(Duration.seconds(2))
      );

      expect(Str.length(rendered)).toBe(1024 * 1024 + 1);
      expect(Str.endsWith("\n")(rendered)).toBe(true);
    }, provideTestLayer)
  );
});
