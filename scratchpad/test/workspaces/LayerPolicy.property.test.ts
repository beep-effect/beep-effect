import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LayerPolicy, LayerPolicyError } from "../../effected/workspaces/LayerPolicy.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("LayerPolicy property floor", () => {
  roundTrips("LayerPolicy", LayerPolicy);
  roundTrips("LayerPolicyError", LayerPolicyError);
});

it.effect.prop("policy decoding survives JSON stringify/parse without changing policy or selected fields", [Arbitrary.schema(LayerPolicy)], ([policy]) =>
  Effect.gen(function* () {
    const json = S.fromJsonString(S.Unknown);
    const input = yield* S.encodeEffect(LayerPolicy)(policy);
    const decoded = yield* LayerPolicy.decode(input);
    const text = yield* S.encodeEffect(json)(yield* S.encodeEffect(LayerPolicy)(decoded));
    const reparsed = yield* LayerPolicy.decode(yield* S.decodeEffect(json)(text));
    assert.isTrue(S.toEquivalence(LayerPolicy)(decoded, policy));
    assert.isTrue(S.toEquivalence(LayerPolicy)(reparsed, decoded));
    assert.deepStrictEqual(reparsed.effectiveFields, decoded.effectiveFields);
    assert.strictEqual(yield* S.encodeEffect(json)(yield* S.encodeEffect(LayerPolicy)(reparsed)), text);
  }), runs);
