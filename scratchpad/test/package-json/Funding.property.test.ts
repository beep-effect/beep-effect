import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, sample: S.Codec<T, unknown> = schema, equivalent = S.toEquivalence(schema)): void => {
  it.effect.prop(name, [Arbitrary.schema(sample)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(equivalent(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import * as A from "effect/Array";
import * as Getter from "effect/SchemaGetter";
import { Funding } from "../../effected/package-json/Funding.ts";
const FieldsSample = S.Struct({ url: S.String, type: S.optionalKey(S.String), rest: S.optionalKey(S.Record(S.String.check(S.isPattern(/^x-[a-z]+$/)), S.Unknown)) });
const FundingSample = S.instanceOf(Funding, {
  toCodecArbitrary: () => S.link<Funding>()(FieldsSample, {decode: Getter.transform(Funding.make), encode: Getter.transform((entry) => ({...entry}))}),
});
const equivalentEntry = (left: Funding, right: Funding): boolean => S.toEquivalence(Funding)(Funding.make({...left, rest: left.rest ?? {}}), Funding.make({...right, rest: right.rest ?? {}}));
const equivalentField = (left: ReadonlyArray<Funding>, right: ReadonlyArray<Funding>): boolean => S.toEquivalence(S.Array(Funding))(A.map(left, (entry) => Funding.make({...entry, rest: entry.rest ?? {}})), A.map(right, (entry) => Funding.make({...entry, rest: entry.rest ?? {}})));
describe("Funding property floor", () => {
  roundTrips("Funding", Funding);
  roundTrips("Funding.FromValue", Funding.FromValue, FundingSample, equivalentEntry);
  roundTrips("Funding.FromField", Funding.FromField, S.Array(FundingSample), equivalentField);
});
it.effect.prop("wire fidelity retains bare strings, objects and mixed arrays", [Arbitrary.schema(S.Union([S.String, S.Struct({url: S.String, type: S.optionalKey(S.String), "x-note": S.Json}), S.Array(S.Union([S.String, S.Struct({url: S.String, "x-note": S.Json})]))]))], ([wire]) => Effect.gen(function* () {
  const entries = yield* S.decodeEffect(Funding.FromField)(wire);
  assert.deepStrictEqual(yield* S.encodeEffect(Funding.FromField)(entries), wire);
}), runs);
