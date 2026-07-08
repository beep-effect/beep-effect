/**
 * Patent publication number value object.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/PatentNumber/PatentNumber");
const patentNumberDigitsPattern = /^[0-9]+$/;

/**
 * Canonical WIPO ST.6 patent publication number.
 *
 * WIPO ST.6 recommends that the publication number itself contain digits only
 * and no more than 13 digits. ST.3 office codes and ST.16 kind codes are
 * associated metadata and are intentionally not part of this value.
 *
 * @example
 * ```ts
 * import { PatentNumber } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PatentNumber)("1234567890123")) // true
 * console.log(S.is(PatentNumber)("US1234567B2")) // false
 * ```
 *
 * @see https://www.wipo.int/documents/d/standards/docs-en-03-06-01.pdf
 * @category value-objects
 * @since 0.0.0
 */
export const PatentNumber = S.String.check(
  S.isPattern(patentNumberDigitsPattern, {
    identifier: $I`PatentNumberDigitsCheck`,
    title: "Patent Number Digits",
    description: "A WIPO ST.6 publication number containing only ASCII digits.",
    message: "Patent publication number must contain digits only.",
  }),
  S.isLengthBetween(1, 13, {
    identifier: $I`PatentNumberLengthCheck`,
    title: "Patent Number Length",
    description: "A WIPO ST.6 publication number containing between 1 and 13 digits.",
    message: "Patent publication number must contain 1 to 13 digits.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(/^[0-9]{1,13}$/),
  })
  .pipe(
    S.brand("PatentNumber"),
    $I.annoteSchema("PatentNumber", {
      description:
        "Canonical WIPO ST.6 patent publication number: digits only, 1 to 13 digits, excluding ST.3 office and ST.16 kind metadata.",
    })
  );

/**
 * Type-level brand produced by {@link PatentNumber}.
 *
 * @example
 * ```ts
 * import { PatentNumber } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const patentNumber: PatentNumber = S.decodeUnknownSync(PatentNumber)("1234567890123")
 * console.log(patentNumber)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PatentNumber = typeof PatentNumber.Type;
