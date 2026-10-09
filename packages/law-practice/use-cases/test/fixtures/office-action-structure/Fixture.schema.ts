import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const Outcome = S.Union([
  S.Struct({
    status: S.Literal("recognized"),
    finality: S.Literals(["FINAL", "NON-FINAL"]),
    finalityQuote: S.NonEmptyString,
    periodQuote: S.NonEmptyString,
  }),
  S.Struct({
    status: S.Literal("abstained"),
    code: S.Literals(["absent", "ambiguous", "unsupported", "low-quality-source", "rule-not-covered"]),
  }),
]);
export const Fixture = S.Struct({
  id: S.NonEmptyString,
  modality: S.Literals(["public-form-language", "ocr-derived", "layout-derived"]),
  family: S.NonEmptyString,
  evaluationLane: S.Literals(["oracle-upstream", "full-pipeline"]),
  heldOut: S.Boolean,
  provenanceRow: S.NonEmptyString,
  diagnostic: S.Literals(["correct", "miss", "false-alarm", "split", "merge", "many-to-many"]),
  relationships: S.Array(S.Literals(["same-paragraph", "sibling", "continuation", "reading-order"])),
  outcome: Outcome,
});
export type Fixture = typeof Fixture.Type;

/** Decodes the inventory's JSON boundary with its single fixture schema. */
const FixtureJson = S.fromJsonString(Fixture);
export const decodeFixtureJson = Effect.fn("OfficeActionFixture.decodeJson")((input: string) =>
  S.decodeEffect(FixtureJson)(input)
);
