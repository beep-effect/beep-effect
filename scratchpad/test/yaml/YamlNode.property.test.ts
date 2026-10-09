import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  AliasExpansionBudgetExceeded, CollectionStyle, QuoteCompat, QuoteStyle, ScalarChomp,
  ScalarStyle, YamlAlias, YamlMap, YamlNode, YamlPair, YamlScalar, YamlSeq,
} from "../../effected/yaml/YamlNode.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

describe("YamlNode schema round trips", () => {
  roundTrips("ScalarStyle", ScalarStyle);
  roundTrips("CollectionStyle", CollectionStyle);
  roundTrips("QuoteStyle", QuoteStyle);
  roundTrips("QuoteCompat", QuoteCompat);
  roundTrips("ScalarChomp", ScalarChomp);
  roundTrips("YamlScalar", YamlScalar);
  roundTrips("YamlAlias", YamlAlias);
  roundTrips("YamlPair", YamlPair);
  roundTrips("YamlMap", YamlMap);
  roundTrips("YamlSeq", YamlSeq);
  roundTrips("YamlNode", YamlNode);
  roundTrips("AliasExpansionBudgetExceeded", AliasExpansionBudgetExceeded);
});
