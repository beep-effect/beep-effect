/**
 * IR-to-law mapping implementation.
 *
 * **Details**
 *
 * Maps the verified annotation handoff for one office action into the
 * five law-practice domain entities. Each label selects a Mention of its
 * office-action class by the least (start, end, annotation id); its first
 * reading supplies the model text. The distinction takes the receipt's anchor.
 * The §102 rejection cites the prior-art reference by its fixture key.
 *
 * Entities are decoded through their schemas with a spike audit envelope (see
 * {@link spikeEntityInput}) — a spike affordance, not the production id/audit
 * path. The mapping is effectful and fails typed when required extraction labels
 * are missing, unaligned or otherwise residual before any law entity is decoded.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { iri } from "@beep/identity/Registry";
import { ResidualReason } from "@beep/langextract/Handoff";
import { Claim, Distinction, OfficeAction, PriorArtReference, Rejection } from "@beep/law-practice-domain";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { spikeEntityInput } from "../internal/spikeEntity.ts";
import { OfficeActionExtractionLabel } from "../OfficeActionReview/OfficeActionExtractionLabel.ts";
import { IrToLawExtractionError } from "./IrToLaw.errors.ts";
import { IrToLawShape } from "./IrToLaw.ports.ts";
import type { ExtractionHandoff } from "@beep/langextract/Handoff";
import type { OfficeActionExtractionLabel as OfficeActionExtractionLabelValue } from "../OfficeActionReview/OfficeActionExtractionLabel.ts";
import type { LawEntities } from "./IrToLaw.ports.ts";

const orDieOnConstructionDefect = Effect.orDie;
const decodeOfficeAction = S.decodeUnknownEffect(OfficeAction);
const decodeClaim = S.decodeUnknownEffect(Claim);
const decodePriorArtReference = S.decodeUnknownEffect(PriorArtReference);
const decodeRejection = S.decodeUnknownEffect(Rejection);
const decodeDistinction = S.decodeUnknownEffect(Distinction);

const missingExtraction = (label: OfficeActionExtractionLabelValue): IrToLawExtractionError =>
  IrToLawExtractionError.fromReason("required-extraction-missing", {
    label,
    message: `Office-action extraction output is missing required label "${label}".`,
  });

/**
 * The grounded extraction a label maps from: the first mention of that label
 * by anchor position, with its annotation id, target occurrence, anchor, first
 * reading text and alignment status.
 *
 * **Example** (Select the distinction extraction)
 *
 * ```ts
 * import { requiredExtraction } from "@beep/law-practice-use-cases/IrToLaw"
 * import type { ExtractionHandoff } from "@beep/langextract/Handoff"
 *
 * const distinction = (handoff: ExtractionHandoff) => requiredExtraction(handoff, "distinction")
 * console.log(typeof distinction) // "function"
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const requiredExtraction = Effect.fn("law_practice.ir_to_law.required_extraction")(function* (
  handoff: ExtractionHandoff,
  label: OfficeActionExtractionLabelValue
) {
  const candidates = handoff.document.annotations.pipe(
    HashMap.toEntries,
    A.map(([id, annotation]) => {
      if (annotation._tag !== "Mention" || annotation.body.class !== iri(`office-action:${label}`)) return O.none();
      const occurrence = annotation.targets.pipe(A.fromIterable, A.head, O.getOrThrow);
      const anchor = HashMap.getUnsafe(handoff.document.anchors, occurrence).receipt.anchor;
      const readings = HashMap.get(handoff.readings, id);
      return O.map(readings, (readings) => ({
        id,
        occurrence,
        anchor,
        text: A.headNonEmpty(readings).text,
        alignment: A.headNonEmpty(readings).alignment,
      }));
    }),
    A.getSomes
  );
  const sorted = A.sort(
    candidates,
    Order.combineAll([
      Order.mapInput(Order.Number, (value: (typeof candidates)[number]) => value.anchor.startChar),
      Order.mapInput(Order.Number, (value: (typeof candidates)[number]) => value.anchor.endChar),
      Order.mapInput(Order.String, (value: (typeof candidates)[number]) => value.id),
    ])
  );
  const selected = A.head(sorted);
  if (O.isSome(selected)) return selected.value;
  const residual = A.findFirst(handoff.residual, (candidate) => candidate.label === label);
  return yield* O.match(residual, {
    onNone: () => Effect.fail(missingExtraction(label)),
    onSome: (candidate) =>
      Effect.fail(
        ResidualReason.is.unaligned(candidate.reason)
          ? IrToLawExtractionError.fromReason("required-extraction-unaligned", {
              alignmentStatus: candidate.alignment,
              label,
              message: `Office-action extraction label "${label}" is not source-grounded.`,
              residualReason: candidate.reason,
            })
          : IrToLawExtractionError.fromReason("required-extraction-residual", {
              alignmentStatus: candidate.alignment,
              label,
              message: `Office-action extraction label "${label}" stayed residual (${candidate.reason}).`,
              residualReason: candidate.reason,
            })
      ),
  });
});
const textOf = Effect.fn("law_practice.ir_to_law.text_of")(function* (
  handoff: ExtractionHandoff,
  label: OfficeActionExtractionLabelValue
) {
  return (yield* requiredExtraction(handoff, label)).text;
});
const anchorOf = Effect.fn("law_practice.ir_to_law.anchor_of")(function* (
  handoff: ExtractionHandoff,
  label: OfficeActionExtractionLabelValue
) {
  return (yield* requiredExtraction(handoff, label)).anchor;
});

const officeActionFixtureKey = "office-action.spike";
const patentAssetFixtureKey = "patent-asset.spike";
const claimFixtureKey = "claim.spike";
const referenceFixtureKey = "prior-art.spike";
const rejectionFixtureKey = "rejection.spike";
const distinctionFixtureKey = "distinction.spike";

const buildLawEntities = Effect.fn("law_practice.ir_to_law.build_entities")(function* (
  extractions: ExtractionHandoff
): Effect.fn.Return<LawEntities, IrToLawExtractionError> {
  const officeActionText = yield* textOf(extractions, OfficeActionExtractionLabel.Enum.office_action);
  const claimText = yield* textOf(extractions, OfficeActionExtractionLabel.Enum.claim);
  const referenceText = yield* textOf(extractions, OfficeActionExtractionLabel.Enum.rejection_reference);
  const distinctionText = yield* textOf(extractions, OfficeActionExtractionLabel.Enum.distinction);
  const distinctionAnchor = yield* anchorOf(extractions, OfficeActionExtractionLabel.Enum.distinction);

  return {
    claim: yield* decodeClaim({
      ...spikeEntityInput("LawPracticeClaim", 2),
      claimNumber: 1,
      fixtureKey: claimFixtureKey,
      independent: true,
      patentAssetFixtureKey,
      text: claimText,
    }).pipe(orDieOnConstructionDefect),
    distinction: yield* decodeDistinction({
      ...spikeEntityInput("LawPracticeDistinction", 5),
      anchor: distinctionAnchor,
      claimFixtureKey,
      detail: { kind: "missing_limitation", limitation: distinctionText },
      fixtureKey: distinctionFixtureKey,
      lifecycleState: "candidate",
      rejectionFixtureKey,
    }).pipe(orDieOnConstructionDefect),
    officeAction: yield* decodeOfficeAction({
      ...spikeEntityInput("LawPracticeOfficeAction", 1),
      applicationNumber: officeActionText,
      fixtureKey: officeActionFixtureKey,
      matterFixtureKey: "matter.spike",
      patentAssetFixtureKey,
    }).pipe(orDieOnConstructionDefect),
    priorArtReference: yield* decodePriorArtReference({
      ...spikeEntityInput("LawPracticePriorArtReference", 3),
      documentNumber: "US 0,000,000 B2",
      fixtureKey: referenceFixtureKey,
      officeActionFixtureKey,
      title: referenceText,
    }).pipe(orDieOnConstructionDefect),
    rejection: yield* decodeRejection({
      ...spikeEntityInput("LawPracticeRejection", 4),
      claimFixtureKey,
      fixtureKey: rejectionFixtureKey,
      ground: { referenceFixtureKey, statute: "102" },
      officeActionFixtureKey,
    }).pipe(orDieOnConstructionDefect),
  };
});

/**
 * Build the pure IR-to-law mapping shape.
 *
 * **Example** (Map a checked handoff)
 *
 * ```ts
 * import { makeIrToLaw } from "@beep/law-practice-use-cases/IrToLaw"
 * import type { ExtractionHandoff } from "@beep/langextract/Handoff"
 *
 * const mapChecked = (handoff: ExtractionHandoff) => makeIrToLaw().toLaw(handoff)
 * console.log(typeof mapChecked)
 * ```
 *
 * @effects The returned `toLaw` method validates required grounded extraction
 * labels, decodes the law-practice entity bundle, and reports missing or
 * unaligned labels through the typed `IrToLawExtractionError` channel.
 * @category constructors
 * @since 0.0.0
 */
export const makeIrToLaw = (): IrToLawShape =>
  IrToLawShape.make({
    toLaw: (extractions: ExtractionHandoff): Effect.Effect<LawEntities, IrToLawExtractionError> =>
      buildLawEntities(extractions),
  });
