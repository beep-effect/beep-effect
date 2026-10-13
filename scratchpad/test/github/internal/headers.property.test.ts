import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { headerNumber, headerString, retryAfterMillisFrom } from "../../../effected/github/internal/headers.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("string headers retain canonical text through parsing and rendering", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const parsed = headerString({ value: text }, "value");
  assert.strictEqual(parsed, text === "" ? undefined : text);
  assert.strictEqual(headerString("value")({ value: parsed }), parsed);
  assert.strictEqual(headerString({ value: parsed === undefined ? "" : String(parsed) }, "value"), parsed);
}), runs);

it.effect.prop("numeric header parsing is idempotent and faithful through decimal rendering", [Arbitrary.schema(S.Finite)], ([number]) => Effect.sync(() => {
  const parsed = headerNumber({ value: number }, "value");
  assert.strictEqual(parsed, Math.trunc(number));
  assert.strictEqual(headerNumber("value")({ value: parsed }), parsed);
  assert.strictEqual(headerNumber({ value: String(parsed) }, "value"), parsed);
}), runs);

it.effect.prop("retry delay preserves seconds through rendering and overrides the reset", [Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 1000000 })))], ([seconds]) => Effect.sync(() => {
  const delay = retryAfterMillisFrom({ "retry-after": seconds, "x-ratelimit-remaining": 0, "x-ratelimit-reset": 9999999 }, 0);
  assert.strictEqual(delay, seconds * 1000);
  assert.strictEqual(retryAfterMillisFrom(0)({ "retry-after": String(seconds) }), delay);
  assert.strictEqual(retryAfterMillisFrom({ "retry-after": Number(delay) / 1000 }, 0), delay);
}), runs);
