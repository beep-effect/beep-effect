import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SectionKey, SectionId, Section, PlacedSection } from "../../effected/templates/Section.ts";
const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(name + " decodes its encoded values without failure", [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(equivalent(decoded, value));
    }), runs);
};

describe("Section schema properties", () => {
  roundTrips("SectionKey", SectionKey);
  roundTrips("SectionId", SectionId);
  roundTrips("Section", Section);
  roundTrips("PlacedSection", PlacedSection);
});
