import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { NotInteractive } from "../../effected/cli/NotInteractive.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("NotInteractive encodes and decodes without failure or loss", [Arbitrary.schema(NotInteractive)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(NotInteractive)(value);
    const decoded = yield* S.decodeEffect(NotInteractive)(encoded);
    assertTrue(S.toEquivalence(NotInteractive)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(NotInteractive)(decoded), encoded);
  }), runs);

it.effect.prop("guidance survives attempted message rewrites", [Arbitrary.schema(S.String)], ([message]) => Effect.sync(() => {
  const error = NotInteractive.make({});
  const guidance = error.message;
  error.message = message;
  assert.strictEqual(error.message, guidance);
}), runs);
