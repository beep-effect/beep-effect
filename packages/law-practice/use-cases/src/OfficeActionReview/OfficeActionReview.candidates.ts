/**
 * Fixed office-action extraction candidates used by tests for the spike mapping.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExtractionCandidate } from "@beep/langextract/Extraction";
import { OfficeActionExtractionLabel } from "./OfficeActionExtractionLabel.ts";

/**
 * Fixed candidate set for the office-action review spike mapping tests.
 *
 * This is retained through the package test surface so integration tests can
 * assert grounding for the same synthetic office-action phrases without
 * coupling the production loop back to fixed candidates.
 *
 * @example
 * ```ts
 * import { OfficeActionReviewSpikeCandidates } from "@beep/law-practice-use-cases/test"
 *
 * const labels = OfficeActionReviewSpikeCandidates.map((candidate) => candidate.label)
 * console.log(labels.includes("rejection_reference")) // true
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const OfficeActionReviewSpikeCandidates = [
  ExtractionCandidate.make({ label: OfficeActionExtractionLabel.Enum.office_action, text: "Office Action" }),
  ExtractionCandidate.make({
    label: OfficeActionExtractionLabel.Enum.claim,
    text: "A widget comprising a lid and a base.",
  }),
  ExtractionCandidate.make({ label: OfficeActionExtractionLabel.Enum.rejection_reference, text: "Smith" }),
  ExtractionCandidate.make({
    label: OfficeActionExtractionLabel.Enum.distinction,
    text: "a hinge coupling the lid to the base",
  }),
];
