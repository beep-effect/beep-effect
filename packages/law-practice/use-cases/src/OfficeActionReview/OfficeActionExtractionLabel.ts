/**
 * Office-action extraction label vocabulary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeUseCasesId.create("OfficeActionReview/OfficeActionExtractionLabel");

/**
 * Labels the office-action review loop requests from LangExtract and the
 * IR-to-law mapper consumes as required grounded extractions.
 *
 * @example
 * ```ts
 * import { OfficeActionExtractionLabel } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * console.log(OfficeActionExtractionLabel.Enum.distinction) // "distinction"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OfficeActionExtractionLabel = LiteralKit([
  "office_action",
  "claim",
  "rejection_reference",
  "distinction",
]).pipe(
  $I.annoteSchema("OfficeActionExtractionLabel", {
    description: "Labels shared by office-action extraction targets and IR-to-law mapping.",
  })
);

/**
 * Type for {@link OfficeActionExtractionLabel}.
 *
 * @example
 * ```ts
 * import type { OfficeActionExtractionLabel } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * const label: OfficeActionExtractionLabel = "claim"
 * console.log(label)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type OfficeActionExtractionLabel = typeof OfficeActionExtractionLabel.Type;
