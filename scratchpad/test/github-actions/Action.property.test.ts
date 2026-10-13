import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { describeCause } from "../../effected/github-actions/Action.ts";
const runs = { arbitrary: fcRuns(100) };
// Diagnostic formatting accepts a Cause and returns text, so it has no
// self-composition or inverse parser. Its fidelity law preserves both fields.
it.effect.prop("tagged diagnostics preserve tag and message across failure and defect rendering", [Arbitrary.schema(S.String)], ([message]) => Effect.sync(() => {
  const error = { _tag: "Diagnostic", message };
  const rendered = describeCause(Cause.fail(error));
  const expected = message === "" ? "[Diagnostic]" : `[Diagnostic]: ${message}`;
  assert.strictEqual(rendered, expected);
  assert.strictEqual(describeCause(Cause.die(error)), `[defect] ${rendered}`);
  assert.strictEqual(describeCause(Cause.fail({ ...error })), rendered);
  assert.strictEqual(rendered.slice(message === "" ? 12 : 14), message);
}), runs);
