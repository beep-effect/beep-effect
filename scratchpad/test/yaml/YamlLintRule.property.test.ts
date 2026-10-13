import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LintLine, YamlLintSeverity, YamlLintDiagnostic, StyleVote, StyleFloor } from "../../effected/yaml/YamlLintRule.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and decoding never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("YamlLintRule schema property floor", () => {
  roundTrips("LintLine", LintLine);
  roundTrips("YamlLintSeverity", YamlLintSeverity);
  roundTrips("YamlLintDiagnostic", YamlLintDiagnostic);
  roundTrips("StyleVote", StyleVote);
  roundTrips("StyleFloor", StyleFloor);
});
