import { assert, it, vi } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { Action, ActionRuntime, describeCause } from "../../effected/github-actions/Action.ts";
it.effect("cause rendering distinguishes missing, nonstring and empty tagged messages", () => Effect.sync(() => {
  assert.strictEqual(describeCause(Cause.fail({ _tag: "Missing" })), "[Missing]");
  assert.strictEqual(describeCause(Cause.fail({ _tag: "Numeric", message: 42 })), "[Numeric]");
  assert.strictEqual(describeCause(Cause.fail({ _tag: "Empty", message: "" })), "[Empty]");
  assert.strictEqual(describeCause(Cause.fail("plain")), "[unknown]: plain");
  assert.strictEqual(describeCause(Cause.empty), "the action failed with no diagnostic information");
}));
it.effect("a broken failure console still sets exitCode and resolves", () => Effect.gen(function* () {
  const previous = process.exitCode;
  const spy = vi.spyOn(console, "log").mockImplementation(() => { throw new Error("console failed"); });
  yield* Effect.acquireUseRelease(Effect.void, () => Effect.gen(function* () {
    yield* Effect.promise(() => Action.run(Effect.fail("failed")));
    assert.strictEqual(process.exitCode, 1);
    assert.isAbove(spy.mock.calls.length, 0);
  }), () => Effect.sync(() => { spy.mockRestore(); process.exitCode = previous; }));
}));

it.effect("runtime construction exposes the static entry points without instance state", () => Effect.sync(() => {
  assert.isTrue(Reflect.construct(Action, []) instanceof Action);
  assert.isTrue(Reflect.construct(ActionRuntime, []) instanceof ActionRuntime);
}));
it.effect("an empty failure emits an error without an empty debug line", () => Effect.gen(function* () {
  const previous = process.exitCode;
  const lines: Array<string> = [];
  const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => { lines.push(String(line)); });
  yield* Effect.acquireUseRelease(Effect.void, () => Effect.gen(function* () {
    yield* Effect.promise(() => Action.run(Effect.failCause(Cause.empty)));
    assert.strictEqual(process.exitCode, 1);
    assert.deepStrictEqual(lines, ["::error::Action failed: the action failed with no diagnostic information"]);
  }), () => Effect.sync(() => { spy.mockRestore(); process.exitCode = previous; }));
}));
