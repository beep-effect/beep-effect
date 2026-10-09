/**
 * Atomic verification of deterministic span-bearing office-action extractions.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { GroundedExtraction } from "@beep/langextract/Extraction";
import {
  DocStructureAbstention,
  OfficeActionFinalityCandidate,
  OfficeActionRecognizedPair,
  recognizeOfficeActionPair,
  ShortenedStatutoryPeriodCandidate,
} from "@beep/law-practice-domain";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  VerifiedTextAnchorError,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { OfficeActionRawPair } from "@beep/law-practice-domain";
import type { OfficeActionStructureInput, OfficeActionStructureShape } from "./OfficeActionStructure.ports.ts";

const $I = $LawPracticeUseCasesId.create("OfficeActionStructure/OfficeActionStructure.service");
const ExtractionLabel = LiteralKit(["action-finality", "shortened-statutory-period"]).pipe(
  $I.annoteSchema("ExtractionLabel", {
    description: "Exact paired extraction labels accepted by the v1 span-preserving adapter.",
  })
);
const prior = UnitInterval.make(0.95);
const labels = ExtractionLabel.literals;
const anchorEquivalent = S.toEquivalence(TextAnchor);
const rawRecognition = (input: OfficeActionStructureInput) =>
  recognizeOfficeActionPair(
    input.verifiedSource.sourceText,
    A.isReadonlyArrayEmpty(input.ocrPages) ? input.document.modality : "ocr-derived",
    input.rule
  );
const grounded = (pair: OfficeActionRawPair): ReadonlyArray<GroundedExtraction> =>
  A.map([pair.finalityAnchor, pair.periodAnchor], (anchor, i) =>
    GroundedExtraction.cases.match_exact.make({
      label: O.getOrElse(A.get(labels, i), () => "uncovered"),
      text: anchor.quote,
      matchedText: anchor.quote,
      span: { start: anchor.startChar, end: anchor.endChar },
    })
  );
const fromExtractions = Effect.fn("OfficeActionStructure.fromExtractions")(function* (
  input: OfficeActionStructureInput,
  extractions: ReadonlyArray<GroundedExtraction>
) {
  const raw = rawRecognition(input);
  if (raw.status === "abstained") return raw;
  if (A.length(extractions) !== 2)
    return DocStructureAbstention.make({ rule: input.rule, code: A.length(extractions) > 2 ? "ambiguous" : "absent" });
  const first = yield* Effect.fromOption(
    A.findFirst(extractions, (x) => x.label === "action-finality"),
    () => VerifiedTextAnchorError.fromReason("invalid-anchor")
  );
  const second = yield* Effect.fromOption(
    A.findFirst(extractions, (x) => x.label === "shortened-statutory-period"),
    () => VerifiedTextAnchorError.fromReason("invalid-anchor")
  );
  if (!GroundedExtraction.guards.match_exact(first) || !GroundedExtraction.guards.match_exact(second)) {
    return DocStructureAbstention.make({ rule: input.rule, code: "rule-not-covered" });
  }
  const finalityAnchor = yield* S.decodeEffect(TextAnchor)({
    startChar: first.span.start,
    endChar: first.span.end,
    quote: first.matchedText,
  }).pipe(Effect.mapError(() => VerifiedTextAnchorError.fromReason("invalid-anchor")));
  const periodAnchor = yield* S.decodeEffect(TextAnchor)({
    startChar: second.span.start,
    endChar: second.span.end,
    quote: second.matchedText,
  }).pipe(Effect.mapError(() => VerifiedTextAnchorError.fromReason("invalid-anchor")));
  const finalityProof = yield* verifyTextAnchorAgainstVerifiedSource(
    VerifyTextAnchorAgainstVerifiedSourceInput.make({ anchor: finalityAnchor, verifiedSource: input.verifiedSource })
  );
  const periodProof = yield* verifyTextAnchorAgainstVerifiedSource(
    VerifyTextAnchorAgainstVerifiedSourceInput.make({ anchor: periodAnchor, verifiedSource: input.verifiedSource })
  );
  if (!anchorEquivalent(finalityAnchor, raw.finalityAnchor) || !anchorEquivalent(periodAnchor, raw.periodAnchor)) {
    return DocStructureAbstention.make({ rule: input.rule, code: "rule-not-covered" });
  }
  const common = {
    schemaVersion: "1",
    source: input.verifiedSource.source,
    document: input.document,
    rule: input.rule,
    confidence: prior,
  };
  return OfficeActionRecognizedPair.make({
    candidates: [
      OfficeActionFinalityCandidate.make({
        ...common,
        schemaVersion: "1",
        anchor: finalityProof,
        finality: raw.finality,
      }),
      ShortenedStatutoryPeriodCandidate.make({ ...common, schemaVersion: "1", anchor: periodProof, months: 3 }),
    ],
  });
});
/**
 * Builds the pure deterministic workflow and explicit GroundedExtraction array adapter.
 *
 * **Example** (Inspect makeOfficeActionStructure)
 *
 * ```ts
 * import { makeOfficeActionStructure } from "@beep/law-practice-use-cases/OfficeActionStructure"
 * import * as P from "effect/Predicate"
 * const service = makeOfficeActionStructure()
 * console.log(P.isFunction(service.fromExtractions)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeOfficeActionStructure = (): OfficeActionStructureShape => ({
  fromExtractions,
  extract: Effect.fn("OfficeActionStructure.extract")(function* (input: OfficeActionStructureInput) {
    const raw = rawRecognition(input);
    return raw.status === "abstained" ? raw : yield* fromExtractions(input, grounded(raw));
  }),
});
