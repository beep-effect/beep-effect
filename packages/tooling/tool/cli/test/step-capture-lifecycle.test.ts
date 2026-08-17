import { runCaptured } from "@beep/repo-cli/test/Process";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Ref, Sink, Stream } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { ChildProcessSpawner } from "effect/unstable/process";

const encoder = new TextEncoder();

// A spawner whose child "exits" immediately but whose output pipe stays open until kill is called
// (killEndsStream: true — the straggler dies with the group reap and the kernel delivers EOF), or
// forever (killEndsStream: false — a descendant escaped the process group too). This is the shape
// of the Lint Policy success-exit hang: jobs 94646234791 and 95354812245 logged every policy step
// done, then sat silent for 29-40 minutes because an orphaned grandchild held the inherited pipe
// write end and nothing reaped it after a successful exit.
const makeStuckSpawner = Effect.fnUntraced(function* (options: {
  readonly output: string;
  readonly killEndsStream: boolean;
}) {
  const closed = yield* Deferred.make<void>();
  const killCount = yield* Ref.make(0);
  const pipe = Stream.make(encoder.encode(options.output)).pipe(
    Stream.concat(Stream.fromEffect(Deferred.await(closed)).pipe(Stream.drain))
  );
  const handle = ChildProcessSpawner.makeHandle({
    all: pipe,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () =>
      Ref.update(killCount, (count) => count + 1).pipe(
        Effect.andThen(options.killEndsStream ? Deferred.succeed(closed, void 0) : Effect.void),
        Effect.asVoid
      ),
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: pipe,
    unref: Effect.succeed(Effect.void),
  });
  const spawner = ChildProcessSpawner.make(() => Effect.succeed(handle));
  return { spawner, killCount, closed } as const;
});

describe("StepExec capture pipe lifecycle", () => {
  it.effect(
    "reaps the child's group when a straggler holds the pipe open after exit, keeping captured text",
    Effect.fnUntraced(function* () {
      const { killCount, spawner } = yield* makeStuckSpawner({ output: "partial output", killEndsStream: true });
      const fiber = yield* Effect.forkChild(
        runCaptured({ command: "fake-step", args: ["--flag"] }).pipe(
          provideScopedLayer(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner))
        )
      );

      yield* TestClock.adjust("2 seconds");

      const result = yield* Fiber.join(fiber);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("partial output");
      expect(yield* Ref.get(killCount)).toBe(1);
    })
  );

  it.effect(
    "dies loudly naming the command when even the group reap cannot close the pipe",
    Effect.fnUntraced(function* () {
      const { killCount, spawner } = yield* makeStuckSpawner({ output: "partial", killEndsStream: false });
      const fiber = yield* Effect.forkChild(
        runCaptured({ command: "fake-step", args: ["--flag"] }).pipe(
          provideScopedLayer(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner))
        )
      );

      yield* TestClock.adjust("2 seconds");
      yield* TestClock.adjust("3 seconds");

      const exit = yield* Fiber.await(fiber);
      expect(Exit.isFailure(exit)).toBe(true);
      const rendered = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "";
      expect(rendered).toContain("CapturePipeWedgedError");
      expect(rendered).toContain("fake-step --flag");
      expect(yield* Ref.get(killCount)).toBe(1);
    })
  );

  it.effect(
    "never kills a child whose stream closes on its own",
    Effect.fnUntraced(function* () {
      const { closed, killCount, spawner } = yield* makeStuckSpawner({ output: "clean", killEndsStream: false });
      yield* Deferred.succeed(closed, void 0);

      const result = yield* runCaptured({ command: "fake-step", args: [] }).pipe(
        provideScopedLayer(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner))
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toBe("clean");
      expect(yield* Ref.get(killCount)).toBe(0);
    })
  );
});
