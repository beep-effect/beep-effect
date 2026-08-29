/**
 * Patent application number value object.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/ApplicationNumber/ApplicationNumber");
const applicationNumberPattern = /^(?:1[0-9]|91)[0-9]{4}[A-Z0-9]{2}[0-9]{7}$/u;

/**
 * Validates canonical WIPO ST.13 patent application numbers in machine-readable
 * form.
 *
 * **When to use**
 *
 * Use when a patent application identifier must cross a domain or persistence
 * boundary in its separator-free ST.13 representation.
 *
 * **Details**
 *
 * The schema models the 15-character ST.13 form for patent applications:
 * two numeric type characters, four year-designation digits, and nine serial
 * positions. It accepts patent type codes `10` through `19` and WIPO
 * International Bureau code `91` for PCT international-phase applications.
 * The first two serial positions may be alphanumeric for office-internal
 * regional filing information; the remaining serial positions are digits.
 *
 * **Gotchas**
 *
 * ST.3 office codes and separators are presentation metadata and are
 * intentionally not part of this value.
 *
 * **Example** (Distinguish canonical and presented numbers)
 *
 * ```ts
 * import { ApplicationNumber } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ApplicationNumber)("102014000345678")) // true
 * console.log(S.is(ApplicationNumber)("XX 10 2014 345678")) // false
 * ```
 *
 * @see {@link https://www.wipo.int/documents/d/standards/docs-en-03-13-01.pdf} for the WIPO ST.13 specification.
 * @category value-objects
 * @since 0.0.0
 */
export const ApplicationNumber = S.String.check(
  S.isLengthBetween(15, 15, {
    identifier: $I`ApplicationNumberLengthCheck`,
    title: "Application Number Length",
    description: "A WIPO ST.13 machine-readable application number containing exactly 15 characters.",
    message: "Patent application number must contain exactly 15 characters.",
  }),
  S.isPattern(applicationNumberPattern, {
    identifier: $I`ApplicationNumberPatternCheck`,
    title: "Application Number Pattern",
    description:
      "A WIPO ST.13 patent application number with patent type code 10-19 or 91, four year digits, and nine serial positions.",
    message: "Patent application number must match the WIPO ST.13 machine-readable patent application format.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(/^(?:1[0-9]|91)[0-9]{4}[A-Z0-9]{2}[0-9]{7}$/u),
  })
  .pipe(
    S.brand("ApplicationNumber"),
    $I.annoteSchema("ApplicationNumber", {
      description:
        "Canonical WIPO ST.13 patent application number in machine-readable form: patent type code, year designation, and serial positions.",
    })
  );

/**
 * Type-level brand produced by {@link ApplicationNumber}.
 *
 * **Example** (Annotate a decoded application number)
 *
 * ```ts
 * import { ApplicationNumber } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const applicationNumber: ApplicationNumber = S.decodeUnknownSync(ApplicationNumber)("102014000345678")
 * console.log(applicationNumber)
 * ```
 *
 * @see {@link ApplicationNumber} for the runtime schema and validation behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ApplicationNumber = typeof ApplicationNumber.Type;
