/**
 * IR-to-law mapping implementation.
 *
 * Maps the span-bearing `GroundedExtraction[]` for one office action into the
 * five law-practice domain entities, keyed by the extraction `label`
 * vocabulary (`"office_action"`, `"claim"`, `"rejection_reference"`,
 * `"distinction"`). The `"distinction"` extraction's aligned `span` +
 * `matchedText` ground the required `Distinction.anchor` (`TextAnchor`); the
 * §102 rejection cites the prior-art reference by its fixture key.
 *
 * Entities are decoded through their schemas with a spike audit envelope (see
 * {@link spikeEntityInput}) — a spike affordance, not the production id/audit
 * path. The mapping is effectful and fails typed when required extraction labels
 * are missing or unaligned before any law entity is decoded.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AlignedStatus } from "@beep/langextract/Alignment";
import { GroundedExtraction } from "@beep/langextract/Extraction";
import { Claim, Distinction, OfficeAction, PriorArtReference, Rejection } from "@beep/law-practice-domain";
import { TextAnchor } from "@beep/provenance";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { spikeEntityInput } from "../internal/spikeEntity.ts";
import { OfficeActionExtractionLabel } from "../OfficeActionReview/OfficeActionExtractionLabel.ts";
import { IrToLawExtractionError } from "./IrToLaw.errors.ts";
import type { OfficeActionExtractionLabel as OfficeActionExtractionLabelValue } from "../OfficeActionReview/OfficeActionExtractionLabel.ts";
import type { IrToLawShape, LawEntities } from "./IrToLaw.ports.ts";

// Module-scope sync decoders: the spike builds these entities from statically
// known-good shapes (fixed fixture keys/literals + unconstrained extraction
// strings), so a decode failure here is a construction defect, not input error —
// matching the ClaimGate/ClaimProjection precedent. Binding the decoders at
// module scope (not inside an Effect) also satisfies the `schemaSyncInEffect` lint.
const decodeOfficeAction = S.decodeUnknownSync(OfficeAction);
const decodeClaim = S.decodeUnknownSync(Claim);
const decodePriorArtReference = S.decodeUnknownSync(PriorArtReference);
const decodeRejection = S.decodeUnknownSync(Rejection);
const decodeDistinction = S.decodeUnknownSync(Distinction);

const missingExtraction = (label: OfficeActionExtractionLabelValue): IrToLawExtractionError =>
  IrToLawExtractionError.fromReason("required-extraction-missing", {
    label,
    message: `Office-action extraction output is missing required label "${label}".`,
  });

const unalignedExtraction = (extraction: GroundedExtraction): IrToLawExtractionError =>
  IrToLawExtractionError.fromReason("required-extraction-unaligned", {
    alignmentStatus: extraction.alignmentStatus,
    label: extraction.label,
    message: `Office-action extraction label "${extraction.label}" is not source-grounded.`,
  });

type AlignedGroundedExtraction = Exclude<GroundedExtraction, { readonly alignmentStatus: "unaligned" }>;

const isAlignedExtraction = GroundedExtraction.isAnyOf(AlignedStatus.Options);

const requiredExtraction = Effect.fn("law_practice.ir_to_law.required_extraction")(function* (
  extractions: ReadonlyArray<GroundedExtraction>,
  label: OfficeActionExtractionLabelValue
): Effect.fn.Return<AlignedGroundedExtraction, IrToLawExtractionError> {
  const extraction = yield* pipe(
    A.findFirst(extractions, (extraction) => Eq.equals(extraction.label, label)),
    Effect.fromOption(() => missingExtraction(label))
  );

  return yield* pipe(
    O.liftPredicate(isAlignedExtraction)(extraction),
    Effect.fromOption(() => unalignedExtraction(extraction))
  );
});

const textOf = Effect.fn("law_practice.ir_to_law.text_of")(function* (
  extractions: ReadonlyArray<GroundedExtraction>,
  label: OfficeActionExtractionLabelValue
): Effect.fn.Return<string, IrToLawExtractionError> {
  const extraction = yield* requiredExtraction(extractions, label);
  return extraction.text;
});

const anchorOf = Effect.fn("law_practice.ir_to_law.anchor_of")(function* (
  extractions: ReadonlyArray<GroundedExtraction>,
  label: OfficeActionExtractionLabelValue
): Effect.fn.Return<TextAnchor, IrToLawExtractionError> {
  const extraction = yield* requiredExtraction(extractions, label);
  return TextAnchor.make({
    endChar: extraction.span.end,
    quote: extraction.matchedText,
    startChar: extraction.span.start,
  });
});

const officeActionFixtureKey = "office-action.spike";
const patentAssetFixtureKey = "patent-asset.spike";
const claimFixtureKey = "claim.spike";
const referenceFixtureKey = "prior-art.spike";
const rejectionFixtureKey = "rejection.spike";
const distinctionFixtureKey = "distinction.spike";

const buildLawEntities = Effect.fn("law_practice.ir_to_law.build_entities")(function* (
  extractions: ReadonlyArray<GroundedExtraction>
): Effect.fn.Return<LawEntities, IrToLawExtractionError> {
  const officeActionText = yield* textOf(extractions, OfficeActionExtractionLabel.Enum.office_action);
  const claimText = yield* textOf(extractions, OfficeActionExtractionLabel.Enum.claim);
  const referenceText = yield* textOf(extractions, OfficeActionExtractionLabel.Enum.rejection_reference);
  const distinctionText = yield* textOf(extractions, OfficeActionExtractionLabel.Enum.distinction);
  const distinctionAnchor = yield* anchorOf(extractions, OfficeActionExtractionLabel.Enum.distinction);

  return {
    claim: decodeClaim({
      ...spikeEntityInput("LawPracticeClaim", 2),
      claimNumber: 1,
      fixtureKey: claimFixtureKey,
      independent: true,
      patentAssetFixtureKey,
      text: claimText,
    }),
    distinction: decodeDistinction({
      ...spikeEntityInput("LawPracticeDistinction", 5),
      anchor: distinctionAnchor,
      claimFixtureKey,
      detail: { kind: "missing_limitation", limitation: distinctionText },
      fixtureKey: distinctionFixtureKey,
      lifecycleState: "candidate",
      rejectionFixtureKey,
    }),
    officeAction: decodeOfficeAction({
      ...spikeEntityInput("LawPracticeOfficeAction", 1),
      applicationNumber: officeActionText,
      fixtureKey: officeActionFixtureKey,
      matterFixtureKey: "matter.spike",
      patentAssetFixtureKey,
    }),
    priorArtReference: decodePriorArtReference({
      ...spikeEntityInput("LawPracticePriorArtReference", 3),
      documentNumber: "US 0,000,000 B2",
      fixtureKey: referenceFixtureKey,
      officeActionFixtureKey,
      title: referenceText,
    }),
    rejection: decodeRejection({
      ...spikeEntityInput("LawPracticeRejection", 4),
      claimFixtureKey,
      fixtureKey: rejectionFixtureKey,
      ground: { referenceFixtureKey, statute: "102" },
      officeActionFixtureKey,
    }),
  };
});

/**
 * Build the pure IR-to-law mapping shape.
 *
 * **Example** (Fail empty toLaw mapping)
 *
 * ```ts
 * import { makeIrToLaw } from "@beep/law-practice-use-cases/IrToLaw"
 * import { Effect, Exit } from "effect"
 *
 * const mapper = makeIrToLaw()
 * const program = Effect.exit(mapper.toLaw([]))
 *
 * Effect.runPromise(program).then((exit) => console.log(Exit.isFailure(exit))) // true
 * ```
 *
 * @effects The returned `toLaw` method validates required grounded extraction
 * labels, decodes the law-practice entity bundle, and reports missing or
 * unaligned labels through the typed `IrToLawExtractionError` channel.
 * @category constructors
 * @since 0.0.0
 */
export const makeIrToLaw = (): IrToLawShape => ({
  toLaw: (extractions: ReadonlyArray<GroundedExtraction>): Effect.Effect<LawEntities, IrToLawExtractionError> =>
    buildLawEntities(extractions),
});
