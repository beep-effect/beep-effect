import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as O from "effect/Option";
import { Distribution, DistributionField, distributionSuffix } from "../../effected/engine/Distribution.ts";

const runs = { arbitrary: fcRuns(100) };

describe("Distribution property floor", () => {
  it.effect.prop(
    "Distribution encoding decodes successfully to an equivalent value",
    [Arbitrary.schema(Distribution)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(Distribution)(value);
      const decoded = yield* S.decodeEffect(Distribution)(encoded);
      assert.strictEqual(S.toEquivalence(Distribution)(decoded, value), true);
    }),
    runs,
  );
  it.effect.prop(
    "DistributionField encoding decodes successfully to an equivalent value",
    [Arbitrary.schema(DistributionField)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(DistributionField)(value);
      const decoded = yield* S.decodeEffect(DistributionField)(encoded);
      assert.strictEqual(S.toEquivalence(DistributionField)(decoded, value), true);
    }),
    runs,
  );
  it.effect.prop(
    "suffix preserves the README's carrier text and is stable through carrier serialization",
    [Arbitrary.schema(DistributionField)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(DistributionField)(value);
      const decoded = yield* S.decodeEffect(DistributionField)(encoded);
      const suffix = distributionSuffix(O.fromNullishOr(value));
      assert.strictEqual(suffix, value === null ? "" : ` via ${value.name} ${value.version}`);
      assert.strictEqual(distributionSuffix(O.fromNullishOr(decoded)), suffix);
    }),
    runs,
  );
});
