import { available, Collected, OutputTooLarge, runCollected } from "@beep/git/internal/run";
import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { scripted } from "./fixtures.ts";

const command = ChildProcess.make("git", ["rev-parse", "--verify", "HEAD"], {});

const provideSpawner =
  (layer: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>) =>
  <A, E>(program: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>) =>
    Effect.scopedWith((scope) =>
      Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(program, context))
    );

describe("runCollected", () => {
  it.effect("returns stdout, stderr, and exitCode together, even on a non-zero exit", () =>
    Effect.gen(function* () {
      const collected = yield* runCollected(command).pipe(
        provideSpawner(scripted(() => ({ stdout: "abc123\n", exit: 1 })))
      );
      assert.deepStrictEqual(collected, Collected.make({ stdout: "abc123\n", stderr: "", exitCode: 1 }));
    })
  );

  it.effect("captures stdout and stderr from the same run", () =>
    Effect.gen(function* () {
      const collected = yield* runCollected(command).pipe(
        provideSpawner(scripted(() => ({ stdout: "out-line\n", stderr: "err-line\n", exit: 0 })))
      );
      assert.strictEqual(collected.stdout, "out-line\n");
      assert.strictEqual(collected.stderr, "err-line\n");
      assert.strictEqual(collected.exitCode, 0);
    })
  );

  it.effect("fails OutputTooLarge naming the stream once a stream passes the byte ceiling, and kills the child", () =>
    Effect.gen(function* () {
      let killed = 0;
      const chunky = Layer.succeed(
        ChildProcessSpawner.ChildProcessSpawner,
        ChildProcessSpawner.make(() =>
          Effect.succeed(
            ChildProcessSpawner.makeHandle({
              pid: ChildProcessSpawner.ProcessId(1),
              exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
              isRunning: Effect.succeed(true),
              kill: () =>
                Effect.sync(() => {
                  killed += 1;
                }),
              stdin: Sink.drain,
              stdout: Stream.make(new TextEncoder().encode("ok\n")),
              // Three 4-byte chunks: the ceiling is crossed mid-stream, not on a finished string.
              stderr: Stream.make(
                new TextEncoder().encode("eeee"),
                new TextEncoder().encode("eeee"),
                new TextEncoder().encode("eeee")
              ),
              all: Stream.empty,
              getInputFd: () => Sink.drain,
              getOutputFd: () => Stream.empty,
              unref: Effect.succeed(Effect.void),
            })
          )
        )
      );
      const failure = yield* runCollected(command, 10).pipe(provideSpawner(chunky), Effect.flip);
      assert.isTrue(S.is(OutputTooLarge)(failure));
      if (S.is(OutputTooLarge)(failure)) {
        assert.strictEqual(failure.stream, "stderr");
        assert.strictEqual(failure.limit, 10);
      }
      assert.strictEqual(killed, 1);
    })
  );

  it.effect("collects a stream exactly at the ceiling, and defaults the ceiling to 16 MiB", () =>
    Effect.gen(function* () {
      const exact = yield* runCollected(command, 8).pipe(
        provideSpawner(scripted(() => ({ stdout: Str.repeat(8)("a"), exit: 0 })))
      );
      assert.strictEqual(exact.stdout, Str.repeat(8)("a"));
      const large = yield* runCollected(command).pipe(
        provideSpawner(scripted(() => ({ stdout: Str.repeat(100_000)("a"), exit: 0 })))
      );
      assert.strictEqual(large.stdout.length, 100_000);
    })
  );

  it.effect("propagates a PlatformError from the spawner", () =>
    Effect.gen(function* () {
      const failure = PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" });
      const exit = yield* command.pipe(runCollected, provideSpawner(scripted(() => failure)), Effect.exit);
      assert.strictEqual(exit._tag, "Failure");
    })
  );
});

describe("available", () => {
  it.effect("is true on a non-zero exit — any completed run proves existence", () =>
    Effect.gen(function* () {
      const result = yield* available(command).pipe(provideSpawner(scripted(() => ({ exit: 1 }))));
      assert.isTrue(result);
    })
  );

  it.effect("is false when the spawner fails with a PlatformError", () =>
    Effect.gen(function* () {
      const failure = PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" });
      const result = yield* available(command).pipe(provideSpawner(scripted(() => failure)));
      assert.isFalse(result);
    })
  );

  it.effect("lets a defect propagate — only a typed PlatformError is absorbed", () =>
    Effect.gen(function* () {
      const dying = Layer.succeed(
        ChildProcessSpawner.ChildProcessSpawner,
        ChildProcessSpawner.make(() => Effect.die(new Error("boom")))
      );
      const exit = yield* command.pipe(available, provideSpawner(dying), Effect.exit);
      if (Exit.isFailure(exit)) {
        assert.isTrue(Cause.hasDies(exit.cause));
        assert.isFalse(Cause.hasFails(exit.cause));
      } else {
        assert.fail("expected available to fail with a defect, but it succeeded");
      }
    })
  );
});
