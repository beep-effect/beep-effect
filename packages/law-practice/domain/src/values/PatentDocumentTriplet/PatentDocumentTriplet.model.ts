/**
 * Canonical patent document triplet value object.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { KindCode } from "../KindCode/index.js";
import { OfficeCode } from "../OfficeCode/index.js";

const $I = $LawPracticeDomainId.create("values/PatentDocumentTriplet/PatentDocumentTriplet");
const canonicalPatentDocumentNumberPattern =
  /^(?:[0-9]{1,3}|[0-9]{1,3},[0-9]{3}|[0-9]{1,3},[0-9]{3},[0-9]{3}|[0-9]{1,3},[0-9]{3},[0-9]{3},[0-9]{3}|[0-9],[0-9]{3},[0-9]{3},[0-9]{3},[0-9]{3})$/u;

const CanonicalPatentDocumentNumber = S.String.check(
  S.isPattern(canonicalPatentDocumentNumberPattern, {
    identifier: $I`CanonicalPatentDocumentNumberPatternCheck`,
    title: "Canonical Patent Document Number",
    description:
      "A display-form WIPO ST.6 publication number using comma digit grouping and at most 13 digits when commas are removed.",
    message: "Patent document number must be comma-grouped with at most 13 digits.",
  })
);

/**
 * Canonical display triplet for identifying a published patent document.
 *
 * WIPO ST.1 defines the minimum data elements for identifying a patent
 * document as the ST.3 office code, the ST.6 publication number, the ST.16
 * kind-of-document code, and the publication date. This value object captures
 * the common citation/display triplet of office code, publication number, and
 * kind code. Publication date remains separate metadata.
 *
 * This schema intentionally uses the repo's canonical display presentation:
 * a valid ST.3 office code, a comma-grouped ST.6 publication number containing
 * at most 13 digits, and a valid ST.16 kind code separated by single spaces.
 *
 * @example
 * ```ts
 * import { PatentDocumentTriplet } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PatentDocumentTriplet)("US 7,654,321 B2")) // true
 * console.log(S.is(PatentDocumentTriplet)("EP 4,181,262 A1")) // true
 * console.log(S.is(PatentDocumentTriplet)("US 7654321 B2")) // false
 * ```
 *
 * @see https://www.wipo.int/export/sites/www/standards/en/pdf/03-01-01.pdf
 * @see https://www.wipo.int/documents/d/standards/docs-en-03-03-01.pdf
 * @see https://www.wipo.int/documents/d/standards/docs-en-03-06-01.pdf
 * @see https://www.wipo.int/documents/d/standards/docs-en-03-16-01.pdf
 * @category value-objects
 * @since 0.0.0
 */
export const PatentDocumentTriplet = S.TemplateLiteral([
  OfficeCode,
  " ",
  CanonicalPatentDocumentNumber,
  " ",
  KindCode,
]).pipe(
  S.brand("PatentDocumentTriplet"),
  $I.annoteSchema("PatentDocumentTriplet", {
    description:
      "Canonical display triplet for a published patent document: ST.3 office code, comma-grouped ST.6 publication number, and ST.16 kind code.",
  })
);

/**
 * Type-level brand produced by {@link PatentDocumentTriplet}.
 *
 * @example
 * ```ts
 * import type { PatentDocumentTriplet } from "@beep/law-practice-domain"
 *
 * declare const triplet: PatentDocumentTriplet
 * console.log(triplet)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PatentDocumentTriplet = typeof PatentDocumentTriplet.Type;
