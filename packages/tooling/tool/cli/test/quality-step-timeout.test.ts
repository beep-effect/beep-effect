import { Git } from "@beep/git/Git";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { collectStepOutput, QualityTaskStep } from "@beep/repo-cli/test/Quality";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

// The StepExec capture lifecycle suite moved to @beep/repo-cli-kit with the module; this one case
// drives repo-cli's quality-step collector over the same capture deadline, so it stays here.

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" }));

const encoder = new TextEncoder();

// A child that prints once and never exits until killed; kill() closes its pipe and settles exit 143.
const makeNeverExitSpawner = Effect.fnUntraced(function* () {
  const closed = yield* Deferred.make<void>();
  const exited = yield* Deferred.make<ChildProcessSpawner.ExitCode>();
  const pipe = Stream.make(encoder.encode("started")).pipe(
    Stream.concat(closed.pipe(Deferred.await, Stream.fromEffect, Stream.drain))
  );
  const handle = ChildProcessSpawner.makeHandle({
    all: pipe,
    exitCode: Deferred.await(exited),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(true),
    kill: () =>
      Deferred.succeed(closed, void 0).pipe(
        Effect.andThen(Deferred.succeed(exited, ChildProcessSpawner.ExitCode(143))),
        Effect.asVoid
      ),
    pid: ChildProcessSpawner.ProcessId(2),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: pipe,
    unref: Effect.succeed(Effect.void),
  });
  return ChildProcessSpawner.make(() => Effect.succeed(handle));
});

describe("quality step capture timeout", () => {
  it.layer(Layer.mergeAll(BunCrypto.layer, MemoryFileSystem.layer, NodePath.layer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "maps a bounded quality-step timeout to exit code 124",
      Effect.fnUntraced(function* () {
        const spawner = yield* makeNeverExitSpawner();
        const fiber = yield* Effect.forkChild(
          collectStepOutput(
            QualityTaskStep.make({
              label: "fake-step",
              command: "fake-step",
              args: ["--flag"],
              cwd: process.cwd(),
              captureTimeoutMillis: PosInt.make(60_000),
            })
          ).pipe(
            Effect.provideServiceEffect(Git, Git.make),
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
          )
        );

        yield* TestClock.adjust("1 minute");

        const result = yield* Fiber.join(fiber);
        expect(result.exitCode).toBe(124);
        expect(result.output).toContain("fake-step --flag");
      })
    );
  });
});
