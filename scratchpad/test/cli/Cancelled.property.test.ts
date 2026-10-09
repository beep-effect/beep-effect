import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import { Cancelled } from "../../effected/cli/Cancelled.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("Cancelled encodes and decodes without failure and retains its runtime markers", [Arbitrary.schema(Cancelled)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(Cancelled)(value);
  const decoded = yield* S.decodeEffect(Cancelled)(encoded);
  assert.isTrue(S.toEquivalence(Cancelled)(value, decoded));
  assert.deepStrictEqual(yield* S.encodeEffect(Cancelled)(decoded), encoded);
  assert.strictEqual(decoded.message, "cancelled; nothing written");
  assert.strictEqual(decoded[Runtime.errorExitCode], 130);
  decoded.message = "changed";
  assert.strictEqual(decoded.message, value.message);
}), runs);
