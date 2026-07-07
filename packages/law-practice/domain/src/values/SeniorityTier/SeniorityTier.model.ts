/**
 * Lawyer seniority tier value object.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/SeniorityTier.model");

/**
 * Lawyer seniority tier used for staffing and responsibility labels.
 *
 * @example
 * ```ts
 * import { SeniorityTier } from "@beep/law-practice-domain"
 *
 * console.log(SeniorityTier.is.partner("partner")) // true
 * console.log(SeniorityTier.is["senior-associate"]("senior-associate")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SeniorityTier = LiteralKit([
  "partner",
  "senior-associate",
  "associate",
  "junior",
  "specialist",
  "counsel",
]).pipe(
  $I.annoteSchema("SeniorityTier", {
    description: "The seniority tier of a lawyer.",
  })
);

/**
 * Decoded lawyer seniority tier.
 *
 * @example
 * ```ts
 * import type { SeniorityTier } from "@beep/law-practice-domain"
 *
 * const tier: SeniorityTier = "partner"
 * console.log(tier)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SeniorityTier = typeof SeniorityTier.Type;
