import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  ConformanceIssue,
  DanglingReference,
  DeprecatedProperty,
  DeprecatedType,
  JsonLdDocument,
  NonConformantGraphError,
  PropertyNotOnType,
  TermKind,
  UnknownTerm,
} from "../../effected/schema-org/conformance-entry.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name} through conformance-entry: encoded values decode successfully and preserve their value`,
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

describe("conformance entrypoint property floor", () => {
  roundTrips("ConformanceIssue", ConformanceIssue);
  roundTrips("DanglingReference", DanglingReference);
  roundTrips("DeprecatedProperty", DeprecatedProperty);
  roundTrips("DeprecatedType", DeprecatedType);
  roundTrips("JsonLdDocument", JsonLdDocument);
  roundTrips("NonConformantGraphError", NonConformantGraphError);
  roundTrips("PropertyNotOnType", PropertyNotOnType);
  roundTrips("TermKind", TermKind);
  roundTrips("UnknownTerm", UnknownTerm);
});
