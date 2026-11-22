/**
 * Lossless annotation handoff, its producer and candidate readings.
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeDocumentCodec } from "@beep/annotation/AnnotationDocument";
import { AnnotationId } from "@beep/annotation/AnnotationId";
import { ExtractionDocument, ExtractionKinds } from "@beep/annotation/Kinds";
import { $LangExtractId } from "@beep/identity/packages";
import { ActivityStart } from "@beep/jsonc/ActivityStart";
import { ActivityId } from "@beep/schema/ContentHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { TextAnchor } from "@beep/text/TextAnchor";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { AlignmentStatus, ExtractionCandidate } from "../Extraction/Extraction.model.ts";

const $I = $LangExtractId.create("Handoff/Handoff.model");

/**
 * Reasons a candidate did not become an annotation.
 * **Example** (Inspect residual reasons)
 * ```ts
 * import { ResidualReason } from "@beep/langextract/Handoff"
 * console.log(ResidualReason.is.unaligned("unaligned"))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ResidualReason = LiteralKit([
  "unaligned",
  "unmapped-label",
  "verification-refused",
  "relation-attribute-missing",
  "unmapped-predicate",
  "relation-endpoint-unresolved",
  "over-extraction-cap",
]).pipe($I.annoteSchema("ResidualReason", { description: "Why an extraction candidate remains residual." }));
/**
 * Type of a residual reason.
 * @category models
 * @since 0.0.0
 */
export type ResidualReason = typeof ResidualReason.Type;

const CandidateFields = { candidate: S.Natural, ...ExtractionCandidate.fields };

/**
 * What one aligned candidate read, outside the content hash.
 * **Example** (Read a candidate)
 * ```ts
 * import { ExtractionReading } from "@beep/langextract/Handoff"
 * console.log(ExtractionReading.make({ candidate: 0, label: "person", text: "Ada", alignment: "match_exact" }).candidate)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ExtractionReading extends S.Opaque<ExtractionReading, { readonly brand: unique symbol }>()(
  S.Struct({
    ...CandidateFields,
    alignment: AlignmentStatus.pick(["match_exact", "match_lesser", "match_minimal_fold", "match_fuzzy"]),
  }).pipe($I.annoteSchema("ExtractionReading", { description: "The model reading that became one annotation." }))
) {}

/**
 * A candidate that became no annotation, retaining its aligned anchor when present.
 *
 * **Details**
 *
 * Alignment is `unaligned` when there is no aligned proof. For an `over-extraction-cap`
 * reason, alignment was not attempted; the reason distinguishes it from a failed alignment.
 * **Example** (Keep an unaligned candidate)
 * ```ts
 * import { ResidualCandidate } from "@beep/langextract/Handoff"
 * console.log(ResidualCandidate.make({ candidate: 0, label: "person", text: "Ada", alignment: "unaligned", reason: "unaligned" }).reason)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResidualCandidate extends S.Opaque<ResidualCandidate, { readonly brand: unique symbol }>()(
  S.Struct({
    ...CandidateFields,
    alignment: AlignmentStatus,
    anchor: TextAnchor.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    reason: ResidualReason,
  })
    .check(
      S.makeFilter(
        (candidate) => O.isSome(candidate.anchor) === (candidate.alignment !== "unaligned"),
        $I.annote("ResidualAnchorMatchesAlignment", {
          title: "Residual Anchor Matches Alignment",
          description: "Exactly aligned residuals retain their anchor.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("ResidualCandidate", { description: "An unrepresented extraction candidate and its refusal." })
    )
) {}

/**
 * A run's minted activity id and start-time facts.
 * **Example** (Read an activity id)
 * ```ts
 * import type { ExtractionActivity } from "@beep/langextract/Handoff"
 * const idOf = (activity: ExtractionActivity) => activity.id
 * console.log(typeof idOf)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ExtractionActivity extends S.Opaque<ExtractionActivity, { readonly brand: unique symbol }>()(
  S.Struct({ id: ActivityId, start: ActivityStart }).pipe(
    $I.annoteSchema("ExtractionActivity", { description: "The extraction activity minted before the model call." })
  )
) {}

const HandoffFields = {
  document: ExtractionDocument,
  activity: ExtractionActivity,
  candidateCount: S.Natural,
  readings: S.HashMap(AnnotationId, S.NonEmptyArray(ExtractionReading)),
  residual: S.Array(ResidualCandidate),
};
const HandoffShape = S.Struct(HandoffFields);
const keepsCandidates = (handoff: typeof HandoffShape.Type): boolean => {
  const indices = A.sort(
    A.appendAll(
      A.flatMap(HashMap.toValues(handoff.readings), (readings) => A.map(readings, (reading) => reading.candidate)),
      A.map(handoff.residual, (candidate) => candidate.candidate)
    ),
    Order.Number
  );
  return indices.length === handoff.candidateCount && A.every(indices, (index, position) => index === position);
};

/**
 * A checked document, its activity, readings and residual, accounting for every parsed candidate.
 * **Example** (Count candidates)
 * ```ts
 * import type { ExtractionHandoff } from "@beep/langextract/Handoff"
 * const count = (handoff: ExtractionHandoff) => handoff.candidateCount
 * console.log(typeof count)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ExtractionHandoff extends S.Opaque<ExtractionHandoff, { readonly brand: unique symbol }>()(
  HandoffShape.check(
    S.makeFilter(
      (handoff) => HashMap.every(handoff.readings, (_, key) => HashMap.has(handoff.document.annotations, key)),
      $I.annote("ReadingsResolve", { title: "Readings Resolve", description: "Each reading key is an annotation." })
    ),
    S.makeFilter(
      (handoff) =>
        HashMap.every(handoff.document.attribution, (generations) =>
          HashSet.every(generations, (generation) => generation.activity === handoff.activity.id)
        ),
      $I.annote("GenerationsNameActivity", {
        title: "Generations Name Activity",
        description: "Every generation names this run.",
      })
    ),
    S.makeFilter(
      keepsCandidates,
      $I.annote("CandidatesLossless", {
        title: "Candidates Lossless",
        description: "Candidate indices are exactly zero through candidateCount minus one, each once.",
      })
    )
  ).pipe(
    $I.annoteSchema("ExtractionHandoff", {
      description: "Verified annotations and lossless per-candidate readings and residual.",
    })
  )
) {}

/**
 * Failures of the checked handoff wire decoder.
 * **Example** (Inspect wire refusals)
 * ```ts
 * import { HandoffRefusal } from "@beep/langextract/Handoff"
 * console.log(HandoffRefusal.literals)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const HandoffRefusal = LiteralKit(["activity-id-mismatch", "readings-key-repeated"]).pipe(
  $I.annoteSchema("HandoffRefusal", { description: "Why checked handoff decoding refused the wire input." })
);
/**
 * Type of a wire refusal.
 * @category models
 * @since 0.0.0
 */
export type HandoffRefusal = typeof HandoffRefusal.Type;

/**
 * A handoff wire key failed its integrity check.
 * **Example** (Inspect a refusal)
 * ```ts
 * import { HandoffRefused } from "@beep/langextract/Handoff"
 * console.log(HandoffRefused.make({ reason: "readings-key-repeated", key: "duplicate" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class HandoffRefused extends S.TaggedError<HandoffRefused, { readonly brand: unique symbol }>(
  $I`HandoffRefused`
)(
  "HandoffRefused",
  { reason: HandoffRefusal, key: S.String },
  $I.annoteError<HandoffRefused>("HandoffRefused", {
    description: "A handoff's activity or readings keys failed verification.",
  })
) {}

/**
 * The document codec used by both the producer and the wire path.
 * **Example** (Inspect the checked codec)
 * ```ts
 * import { extractionDocumentCodec } from "@beep/langextract/Handoff"
 * console.log(typeof extractionDocumentCodec.decode)
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const extractionDocumentCodec = makeDocumentCodec({ schema: ExtractionDocument, kinds: ExtractionKinds });
