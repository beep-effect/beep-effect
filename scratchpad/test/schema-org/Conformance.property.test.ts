import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { TermKind, UnknownTerm, PropertyNotOnType, DeprecatedType, DeprecatedProperty, DanglingReference, ConformanceIssue, NonConformantGraphError, ConformanceOptions } from "../../effected/schema-org/Conformance.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves the value`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }),
    runs,
  );
};

describe("Conformance property floor", () => {
  roundTrips("TermKind", TermKind);
  roundTrips("UnknownTerm", UnknownTerm);
  roundTrips("PropertyNotOnType", PropertyNotOnType);
  roundTrips("DeprecatedType", DeprecatedType);
  roundTrips("DeprecatedProperty", DeprecatedProperty);
  roundTrips("DanglingReference", DanglingReference);
  roundTrips("ConformanceIssue", ConformanceIssue);
  roundTrips("NonConformantGraphError", NonConformantGraphError);
  roundTrips("ConformanceOptions", ConformanceOptions);
});
