/**
 * Complete source-record input to claim inspection, before normalization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";
import { PatentClaim } from "../PatentDocument/PatentDocument.model.ts";

const $I = $LawPracticeDomainId.create("values/ClaimElement/ClaimElement.input.model");

/**
 * Why a source record has no usable canonical text.
 *
 * **Example** (Recognize an empty source record)
 *
 * ```ts
 * import { ClaimInputTextFailure } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * console.log(ClaimInputTextFailure.is["empty-text"]("empty-text")) // true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const ClaimInputTextFailure = LiteralKit(["empty-text", "invalid-text"]).pipe(
  $I.annoteSchema("ClaimInputTextFailure", {
    description: "The source text is empty or could not be decoded, without inventing replacement claim text.",
  })
);

/**
 * Runtime source-text failure type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimInputTextFailure = typeof ClaimInputTextFailure.Type;

/**
 * Source extraction outcome, independent of claim normalization or checking.
 *
 * **Example** (Inspect extraction outcomes)
 *
 * ```ts
 * import { ClaimInputRecordKind } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * console.log(ClaimInputRecordKind.is.unavailable("unavailable")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimInputRecordKind = LiteralKit(["text", "unavailable"]).pipe(
  $I.annoteSchema("ClaimInputRecordKind", {
    description: "Canonical text was extracted, or the source record remains present with an extraction failure.",
  })
);

/**
 * Runtime extraction outcome type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimInputRecordKind = typeof ClaimInputRecordKind.Type;

const recordFields = {
  sourceOrdinal: PosInt.annotateKey({
    description: "One-based position in the source, independent of a missing, malformed or duplicated claim number.",
  }),
  numberText: S.OptionFromNullOr(S.String).annotateKey({
    description: "Literal source number when present; no number is inferred from the record position.",
  }),
  sourceText: S.String.annotateKey({
    description: "Unmodified source fragment, retained even when canonical text cannot be extracted.",
  }),
};

/**
 * One preserved source record. Extracted text does not imply a valid or checked claim.
 *
 * **Details**
 * Its collection's source key plus source ordinal identifies the record.
 * Number text can be missing or duplicated; those facts survive extraction.
 * Canonical text is decoded source text, never a repaired claim. Normalization,
 * dependency qualification and check coverage are separate subsequent outcomes.
 *
 * **Example** (Decode an unnumbered source record)
 *
 * ```ts
 * import { ClaimInputRecord } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 * const record = yield* S.decodeUnknownEffect(ClaimInputRecord)({
 *   kind: "text",
 *   sourceOrdinal: 1,
 *   numberText: null,
 *   sourceText: "A system comprising a sensor.",
 *   canonicalText: "A system comprising a sensor."
 * })
 * console.log(O.isNone(record.numberText)) // true
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimInputRecord = ClaimInputRecordKind.toTaggedUnion("kind")({
  text: {
    ...recordFields,
    canonicalText: S.NonEmptyString.annotateKey({
      description: "Extracted canonical source text, before patent-claim normalization.",
    }),
  },
  unavailable: {
    ...recordFields,
    reason: ClaimInputTextFailure.annotateKey({
      description: "Why this record has no canonical text; the source record is not dropped.",
    }),
  },
}).pipe(
  $I.annoteSchema("ClaimInputRecord", {
    description: "Preserved numbered or unnumbered source record with an explicit extraction outcome.",
  })
);

/**
 * Runtime source-record type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimInputRecord = typeof ClaimInputRecord.Type;

/**
 * Ordered source records for one document, including every failed extraction.
 *
 * **Details**
 * Ordinals are contiguous source positions; claim numbers are not renumbered
 * or required to be unique here. This is not a validated `PatentClaims` set.
 * Empty input cannot be represented as a successful collection.
 *
 * **Example** (Reject a missing source slot)
 *
 * ```ts
 * import { ClaimInputCollection } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimInputCollection)({ sourceKey: "public-document", records: [] })) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimInputCollection extends S.Opaque<ClaimInputCollection, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceKey: S.NonEmptyString.annotateKey({
      description: "Immutable document-version identity shared by the source records; supplied by the source adapter.",
    }),
    records: S.NonEmptyArray(ClaimInputRecord).annotateKey({
      description: "Every source record in original order, including extraction failures and duplicate numbers.",
    }),
  })
    .check(
      S.makeFilter(
        ({ records }) =>
          A.every(records, (record, index) => Num.Equivalence(record.sourceOrdinal, Num.increment(index))),
        $I.annote("ClaimInputCollectionSourceOrderCheck", {
          title: "Complete source order",
          description: "Source ordinals start at one and are consecutive in record order.",
          message: "Retain each source record in order, without missing, duplicated or reordered source ordinals.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("ClaimInputCollection", {
        description: "Complete source collection before claim normalization, with stable record identity and failures.",
      })
    )
) {}

const normalizationOutcome = LiteralKit(["normalized", "extraction-failed", "normalization-failed"]).pipe(
  $I.annoteSchema("ClaimInputNormalizationOutcome", {
    description:
      "A preserved source record normalized, failed extraction, or failed claim normalization; no case implies checking.",
  })
);

/**
 * Per-record normalization outcome, without claiming dependency completeness or checking.
 *
 * **Example** (Identify a preserved extraction failure)
 *
 * ```ts
 * import { ClaimInputNormalization } from "@beep/law-practice-domain/values/ClaimElement"
 * console.log(ClaimInputNormalization.guards["extraction-failed"]({})) // false
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const ClaimInputNormalization = normalizationOutcome
  .toTaggedUnion("status")({
    normalized: { record: ClaimInputRecord.cases.text, claim: PatentClaim },
    "extraction-failed": { record: ClaimInputRecord.cases.unavailable },
    "normalization-failed": {
      record: ClaimInputRecord.cases.text,
      message: S.NonEmptyString.annotateKey({
        description: "Why the preserved source record cannot normalize to a claim.",
      }),
    },
  })
  .pipe(
    $I.annoteSchema("ClaimInputNormalization", {
      description: "Exactly one normalization outcome per original source record, including every failure.",
    })
  );

/**
 * Runtime per-record normalization result type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimInputNormalization = typeof ClaimInputNormalization.Type;
