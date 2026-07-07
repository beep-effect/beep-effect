/**
 * Shared law-practice entity field schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("entities/LawPracticeEntity.fields");

/**
 * Stable non-empty fixture key used to link law-practice proof entities.
 *
 * @example
 * ```ts
 * import { LawPracticeFixtureKey } from "@beep/law-practice-domain"
 *
 * const fixtureKey = LawPracticeFixtureKey.make("claim.1")
 * console.log(fixtureKey)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LawPracticeFixtureKey = S.NonEmptyString.pipe(
  $I.annoteSchema("LawPracticeFixtureKey", {
    description: "Stable non-empty fixture key used to link law-practice proof entities.",
  })
);

/**
 * Type-level string accepted by {@link LawPracticeFixtureKey}.
 *
 * @example
 * ```ts
 * import { LawPracticeFixtureKey, type LawPracticeFixtureKey as LawPracticeFixtureKeyType } from "@beep/law-practice-domain"
 *
 * const fixtureKey: LawPracticeFixtureKeyType = LawPracticeFixtureKey.make("claim.1")
 * console.log(fixtureKey)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LawPracticeFixtureKey = typeof LawPracticeFixtureKey.Type;

/**
 * Non-empty legal text stored on law-practice proof entities.
 *
 * @example
 * ```ts
 * import { LawPracticeText } from "@beep/law-practice-domain"
 *
 * const text = LawPracticeText.make("A widget comprising a hinge.")
 * console.log(text)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LawPracticeText = S.NonEmptyString.pipe(
  $I.annoteSchema("LawPracticeText", {
    description: "Non-empty legal text stored on law-practice proof entities.",
  })
);

/**
 * Type-level string accepted by {@link LawPracticeText}.
 *
 * @example
 * ```ts
 * import { LawPracticeText, type LawPracticeText as LawPracticeTextType } from "@beep/law-practice-domain"
 *
 * const text: LawPracticeTextType = LawPracticeText.make("A widget comprising a hinge.")
 * console.log(text)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LawPracticeText = typeof LawPracticeText.Type;

/**
 * One-based patent claim number.
 *
 * @example
 * ```ts
 * import { ClaimNumber } from "@beep/law-practice-domain"
 *
 * const claimNumber = ClaimNumber.make(1)
 * console.log(claimNumber)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimNumber = NonNegativeInt.check(
  S.isGreaterThan(0).annotate({
    message: "Expected a positive claim number",
    description: "A one-based patent claim number.",
  })
).pipe(
  $I.annoteSchema("ClaimNumber", {
    description: "One-based patent claim number.",
  })
);

/**
 * Type-level number accepted by {@link ClaimNumber}.
 *
 * @example
 * ```ts
 * import { ClaimNumber, type ClaimNumber as ClaimNumberType } from "@beep/law-practice-domain"
 *
 * const claimNumber: ClaimNumberType = ClaimNumber.make(1)
 * console.log(claimNumber)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimNumber = typeof ClaimNumber.Type;
