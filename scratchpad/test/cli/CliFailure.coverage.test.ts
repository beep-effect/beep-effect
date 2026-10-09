import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CliFailure } from "../../effected/cli/CliFailure.ts";

it.effect("CliFailure retains its runtime class identity", () => Effect.sync(() => {
  assert.isTrue(Reflect.construct(CliFailure, []) instanceof CliFailure);
}));

import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { Render } from "../../effected/cli/Render.ts";
const plain = (cause: Cause.Cause<unknown>, options?: Parameters<typeof CliFailure.toDoc>[1]) => Render.plain(CliFailure.toDoc(cause, options), Render.contextOf({ audience: "agent" }));

it.effect("plain object failures use a string message and otherwise describe the object", () => Effect.sync(() => {
  assert.include(plain(Cause.fail({ message: "read failed" })), "read failed");
  assert.include(plain(Cause.fail({ message: 42 })), "[object Object]");
  assert.include(plain(Cause.fail({})), "[object Object]");
}));
it.effect("schema issues without a message use the invalid-value heading", () => Effect.sync(() => {
  const result = S.decodeUnknownResult(S.Finite)("wrong");
  if (Result.isFailure(result)) {
    for (const error of [result.failure.issue, { issue: result.failure.issue }, { issue: result.failure.issue, message: null }]) {
      assert.include(plain(Cause.fail(error)), "invalid value (1 problem)");
    }
  }
}));
it.effect("malformed file URLs and positionless application frames remain reportable", () => Effect.sync(() => {
  const defect = new Error("boom");
  defect.stack = "Error: boom\n at file:///%zz\n at /repo/no-position.ts\n at file:///C:/app/main.ts:1:2";
  const rendered = plain(Cause.die(defect), { stackFrames: "all" });
  assert.include(rendered, "file:///%zz");
  assert.include(rendered, "/repo/no-position.ts");
  assert.include(rendered, "C:/app/main.ts:1:2");
}));
it.effect("unknown span stacks fail open, and a non-stack location is accepted", () => Effect.sync(() => {
  for (const stack of [undefined, "/repo/main.ts:1:2", "a non-location"]) {
    const frame = { name: "operation", parent: undefined, stack: () => stack };
    assert.include(plain(Cause.annotate(Cause.fail("failed"), Context.make(Cause.StackTrace, frame))), "in: operation");
  }
}));

import { Cancelled } from "../../effected/cli/Cancelled.ts";
it.effect("cancellation failures keep the fixed line and empty failures retain a status", () => Effect.sync(() => {
  for (const reason of ["escape", "interrupt"] as const) {
    const cancelled = Cancelled.make({ reason });
    assert.strictEqual(cancelled.pipe(Cause.fail, plain), "cancelled; nothing written");
  }
  assert.isAbove(plain(Cause.fail("")).length, 0);
  const defect = new Error("");
  delete defect.stack;
  defect.cause = "";
  assert.include(plain(Cause.die(defect)), "no stack");
}));
