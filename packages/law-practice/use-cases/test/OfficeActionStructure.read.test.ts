import { GroundedExtraction } from "@beep/langextract/Extraction";
import { DocStructureDocument, DocStructureRuleFamily } from "@beep/law-practice-domain";
import { fixtureSource, TestCrypto } from "@beep/law-practice-domain/test";
import {
  OfficeActionStoredOutcome,
  OfficeActionStructureAttempt,
  OfficeActionStructureAttemptRead,
} from "@beep/law-practice-use-cases/OfficeActionStructure";
import { fcRuns } from "@beep/test-utils";
import { TextAnchor } from "@beep/text/TextAnchor";
import { expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const encodeV2 = S.encodeEffect(OfficeActionStructureAttempt);
const read = S.decodeUnknownEffect(OfficeActionStructureAttemptRead);
const encodeRead = S.encodeEffect(OfficeActionStructureAttemptRead);
const sameAttempt = S.toEquivalence(OfficeActionStructureAttempt);

type EncodedExtraction = (typeof OfficeActionStructureAttempt.Encoded)["extractions"][number];

const extractionWithAnchorAsV1SpanAndMatchedText = (extraction: EncodedExtraction) => {
  if (!("anchor" in extraction)) return extraction;
  const { anchor, ...rest } = extraction;
  return { ...rest, matchedText: anchor.quote, span: { end: anchor.endChar, start: anchor.startChar } };
};
const asV1 = (row: typeof OfficeActionStructureAttempt.Encoded) => ({
  ...row,
  schemaVersion: "1",
  extractions: A.map(row.extractions, extractionWithAnchorAsV1SpanAndMatchedText),
});

const fixtureAttempt = Effect.gen(function* () {
  const { source } = yield* fixtureSource("THIS ACTION IS MADE FINAL. Reply within THREE MONTHS.");
  return OfficeActionStructureAttempt.make({
    schemaVersion: "2",
    attemptId: "a-1",
    document: DocStructureDocument.make({
      documentId: "fixture",
      sourceVersion: "1",
      modality: "public-form-language",
    }),
    expectedSource: source,
    source,
    rule: DocStructureRuleFamily.make({ id: "uspto-oa-finality-ssp", version: 1 }),
    extractions: [
      GroundedExtraction.cases.match_exact.make({
        label: "action-finality",
        text: "THIS ACTION IS MADE FINAL",
        anchor: TextAnchor.make({ startChar: 0, endChar: 25, quote: "THIS ACTION IS MADE FINAL" }),
      }),
      GroundedExtraction.cases.unaligned.make({ label: "shortened-statutory-period", text: "SIX MONTHS" }),
    ],
    outcome: OfficeActionStoredOutcome.cases.failed.make({ reason: "invalid-anchor" }),
  });
});

it.effect.prop(
  "reads every v1 row to the v2 attempt it was written from, and every v2 row as stored",
  { attempt: Arbitrary.schema(OfficeActionStructureAttempt) },
  ({ attempt }) =>
    Effect.gen(function* () {
      const v2 = yield* encodeV2(attempt);
      const fromV1 = yield* read(asV1(v2));
      const fromV2 = yield* read(v2);
      assertTrue(sameAttempt(fromV1, attempt));
      assertTrue(sameAttempt(fromV2, attempt));
    }),
  { arbitrary: fcRuns(50) }
);

it.layer(TestCrypto, { timeout: "10 seconds" })("office-action attempt read codec", (it) => {
  it.effect("encodes every row as v2, never as v1", () =>
    Effect.gen(function* () {
      const attempt = yield* fixtureAttempt;
      const v2 = yield* encodeV2(attempt);
      const fromV1 = yield* read(asV1(v2));
      const encoded = yield* encodeRead(fromV1);
      expect(encoded).toEqual(v2);
      expect(encoded.schemaVersion).toBe("2");
    })
  );

  it.effect("refuses a v1 row whose span is empty or inverted before any rule reads it", () =>
    Effect.gen(function* () {
      const attempt = yield* fixtureAttempt;
      const v2 = yield* encodeV2(attempt);
      const v1 = asV1(v2);
      const withSpan = (span: { readonly end: number; readonly start: number }) => ({
        ...v1,
        extractions: A.map(v1.extractions, (extraction) =>
          "span" in extraction ? { ...extraction, span } : extraction
        ),
      });
      const empty = yield* read(withSpan({ end: 0, start: 0 })).pipe(Effect.flip);
      const inverted = yield* read(withSpan({ end: 0, start: 25 })).pipe(Effect.flip);
      expect(empty._tag).toBe("SchemaError");
      expect(inverted._tag).toBe("SchemaError");
    })
  );
});
