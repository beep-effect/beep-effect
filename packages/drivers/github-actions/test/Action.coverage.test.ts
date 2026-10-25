import { Action, ActionFailedError, ActionRuntime, describeCause } from "@beep/github-actions/Action";
import { assert, it, vi } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Runtime from "effect/Runtime";

/** `it.effect` installs a `TestConsole`; these tests spy on the real one. */
const onRealConsole = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<Exit.Exit<A, E>> =>
  effect.pipe(Effect.provideService(Console.Console, console), Effect.exit);

const exitCodeOf = (exit: Exit.Exit<unknown, unknown>): number => {
  const codes: Array<number> = [];
  Runtime.defaultTeardown(exit, (code) => codes.push(code));
  return codes[0] ?? -1;
};

it.effect("cause rendering distinguishes missing, nonstring and empty tagged messages", () =>
  Effect.sync(() => {
    assert.strictEqual(describeCause(Cause.fail({ _tag: "Missing" })), "[Missing]");
    assert.strictEqual(describeCause(Cause.fail({ _tag: "Numeric", message: 42 })), "[Numeric]");
    assert.strictEqual(describeCause(Cause.fail({ _tag: "Empty", message: "" })), "[Empty]");
    assert.strictEqual(describeCause(Cause.fail("plain")), "[unknown]: plain");
    assert.strictEqual(describeCause(Cause.empty), "the action failed with no diagnostic information");
  })
);
it.effect("a broken failure console still fails the step", () =>
  Effect.gen(function* () {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("console failed");
    });
    yield* Effect.acquireUseRelease(
      Effect.void,
      () =>
        Effect.gen(function* () {
          const exit = yield* onRealConsole(Action.main(Effect.fail("failed")));
          assert.strictEqual(exitCodeOf(exit), 1);
          assert.deepStrictEqual(
            Exit.findErrorOption(exit),
            O.some(ActionFailedError.make({ summary: "the failure could not be rendered" }))
          );
          assert.isAbove(spy.mock.calls.length, 0);
        }),
      () => Effect.sync(() => spy.mockRestore())
    );
  })
);

it.effect("runtime construction exposes the static entry points without instance state", () =>
  Effect.sync(() => {
    assert.isTrue(Reflect.construct(Action, []) instanceof Action);
    assert.isTrue(Reflect.construct(ActionRuntime, []) instanceof ActionRuntime);
  })
);
it.effect("an empty failure emits an error without an empty debug line", () =>
  Effect.gen(function* () {
    const lines: Array<string> = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    yield* Effect.acquireUseRelease(
      Effect.void,
      () =>
        Effect.gen(function* () {
          const exit = yield* onRealConsole(Action.main(Effect.failCause(Cause.empty)));
          assert.strictEqual(exitCodeOf(exit), 1);
          assert.deepStrictEqual(lines, ["::error::Action failed: the action failed with no diagnostic information"]);
        }),
      () => Effect.sync(() => spy.mockRestore())
    );
  })
);
