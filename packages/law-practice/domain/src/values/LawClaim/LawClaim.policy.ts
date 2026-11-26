/**
 * The office-action assessment profile: three coordinates and the gate a
 * distinction claim must pass before an attorney may admit it.
 *
 * **Details**
 *
 * Profiles are keyed by {@link LawAuthorityType}, so a new authority type adds
 * a literal and a profile (decision
 * `office-action-assessment-profile-and-attorney-admission`). `Unassessed`
 * never passes.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { makeAssessmentArrows } from "@beep/epistemics/Assessments";
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import type { AssessmentsOf, Gate } from "@beep/epistemics/Assessments";
import type { LawAuthorityType } from "./LawClaim.model.ts";

const $I = $LawPracticeDomainId.create("values/LawClaim/LawClaim.policy");

/**
 * Whether the claim's support was verified against current source text.
 *
 * **Example** (Check a support value)
 *
 * ```ts import.meta.vitest name="Check a support value"
 * import { SupportAssessment } from "@beep/law-practice-domain/values/LawClaim"
 *
 * SupportAssessment.is.verified("verified") // => true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SupportAssessment = LiteralKit(["verified", "unverified"]).pipe(
  $I.annoteSchema("SupportAssessment", { description: "Whether a claim's support was verified." })
);

/**
 * @category value-objects
 * @since 0.0.0
 */
export type SupportAssessment = typeof SupportAssessment.Type;

/**
 * How closely the claim's support aligned with its source span, in the
 * handoff's alignment vocabulary.
 *
 * **Example** (Check an alignment value)
 *
 * ```ts import.meta.vitest name="Check an alignment value"
 * import { AlignmentAssessment } from "@beep/law-practice-domain/values/LawClaim"
 *
 * AlignmentAssessment.is.fuzzy("fuzzy") // => true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const AlignmentAssessment = LiteralKit(["exact", "lesser", "fuzzy", "unaligned"]).pipe(
  $I.annoteSchema("AlignmentAssessment", { description: "How closely a claim's support aligned with its source." })
);

/**
 * @category value-objects
 * @since 0.0.0
 */
export type AlignmentAssessment = typeof AlignmentAssessment.Type;

/**
 * **Example** (Check a reference value)
 *
 * ```ts import.meta.vitest name="Check a reference value"
 * import { ReferenceAssessment } from "@beep/law-practice-domain/values/LawClaim"
 *
 * ReferenceAssessment.is.identified("identified") // => true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ReferenceAssessment = LiteralKit(["identified", "unidentified"]).pipe(
  $I.annoteSchema("ReferenceAssessment", { description: "Whether a claim's cited reference was identified." })
);

/**
 * @category value-objects
 * @since 0.0.0
 */
export type ReferenceAssessment = typeof ReferenceAssessment.Type;

const coordinates = {
  support: SupportAssessment,
  alignment: AlignmentAssessment,
  reference: ReferenceAssessment,
};

/**
 * The office-action coordinates, their state schema and the update arrow.
 *
 * **Example** (Read the coordinate names)
 *
 * ```ts
 * import { OfficeActionAssessmentArrows } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(Object.keys(OfficeActionAssessmentArrows.Assessments.fields)) // ["support", "alignment", "reference"]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const OfficeActionAssessmentArrows = makeAssessmentArrows({ $I, coordinates });

/**
 * Every office-action coordinate, each assessed or carrying its absence
 * reason.
 *
 * **Example** (Read the office-action coordinates)
 *
 * ```ts
 * import { OfficeActionAssessments } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(Object.keys(OfficeActionAssessments.fields)) // ["support", "alignment", "reference"]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const OfficeActionAssessments = OfficeActionAssessmentArrows.Assessments;

/**
 * Type of {@link OfficeActionAssessments}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type OfficeActionAssessments = AssessmentsOf<typeof coordinates>;

const supportOrder = Order.mapInput(Order.Number, SupportAssessment.match({ verified: () => 1, unverified: () => 0 }));

const alignmentOrder = Order.mapInput(
  Order.Number,
  AlignmentAssessment.match({ exact: () => 3, lesser: () => 2, fuzzy: () => 1, unaligned: () => 0 })
);

const referenceOrder = Order.mapInput(
  Order.Number,
  ReferenceAssessment.match({ identified: () => 1, unidentified: () => 0 })
);

const requiredCoordinates: ReadonlyArray<keyof typeof coordinates> = ["support", "alignment", "reference"];

/**
 * The office-action distinction gate: every coordinate assessed, support
 * verified, reference identified and alignment anything but unaligned.
 *
 * **Example** (Refuse an unassessed record)
 *
 * ```ts
 * import { OfficeActionDistinctionGate } from "@beep/law-practice-domain/values/LawClaim"
 *
 * const passes = OfficeActionDistinctionGate.passes({
 *   support: { _tag: "Assessed", value: "verified" },
 *   alignment: { _tag: "Unassessed", reason: "unavailable" },
 *   reference: { _tag: "Assessed", value: "identified" },
 * })
 *
 * console.log(passes) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const OfficeActionDistinctionGate: Gate<typeof coordinates> = {
  name: "office-action-distinction",
  version: "1",
  order: {
    support: supportOrder,
    alignment: alignmentOrder,
    reference: referenceOrder,
  },
  requiredCoordinates: HashSet.fromIterable(requiredCoordinates),
  passes: (record) =>
    record.support._tag === "Assessed" &&
    record.alignment._tag === "Assessed" &&
    record.reference._tag === "Assessed" &&
    SupportAssessment.is.verified(record.support.value) &&
    ReferenceAssessment.is.identified(record.reference.value) &&
    !AlignmentAssessment.is.unaligned(record.alignment.value),
};

/**
 * The assessment profile of each law authority type.
 *
 * **Example** (Read the office-action gate)
 *
 * ```ts import.meta.vitest name="Read the office-action gate"
 * import { LawAssessmentProfiles } from "@beep/law-practice-domain/values/LawClaim"
 *
 * LawAssessmentProfiles["office-action"].gate.name // => "office-action-distinction"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LawAssessmentProfiles: {
  readonly [K in LawAuthorityType]: {
    readonly arrows: typeof OfficeActionAssessmentArrows;
    readonly gate: Gate<typeof coordinates>;
  };
} = {
  "office-action": { arrows: OfficeActionAssessmentArrows, gate: OfficeActionDistinctionGate },
};
