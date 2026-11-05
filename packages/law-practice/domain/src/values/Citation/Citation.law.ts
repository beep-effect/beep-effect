/**
 * Canonical law citation semantics, adapted from eyecite 2.7.6 models.py.
 * Upstream: Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { CitationComponents, CitationDatedMetadata, CitationPublication } from "./Citation.resource.ts";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.law");

/**
 * Source-backed law metadata with textual date precision preserved.
 *
 * **Details**
 *
 * Parsed-year validity, inferred editions and raw component anchors are
 * processing/evidence concerns. Do not coerce these strings into integers or
 * put pin-cite span coordinates into the semantic citation.
 *
 * **Example** (Decode law metadata)
 *
 * ```ts
 * import { CitationLawMetadata } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 * const result = S.decodeEffect(CitationLawMetadata)({
 *   pinCite: "(a)", publisher: "West", year: "2020", month: "Jan.", day: "2", parenthetical: "disclosure"
 * })
 * console.log(result !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CitationLawMetadata extends S.Opaque<CitationLawMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    ...CitationDatedMetadata.fields,
    publisher: S.OptionFromNullOr(S.String),
  }).pipe(
    $I.annoteSchema("CitationLawMetadata", {
      description:
        "Law pincite, publisher, textual date and explanatory parenthetical; no raw-source coordinates or parser telemetry.",
    })
  )
) {}

/**
 * Canonical semantic law citation, including U.S.C. and C.F.R. authorities.
 *
 * **Example** (Decode a C.F.R. law citation)
 *
 * ```ts
 * import { FullLawCitation } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 * const result = S.decodeEffect(FullLawCitation)({
 *   type: "law",
 *   components: { chapter: "37", reporter: "C.F.R.", section: "1.56" },
 *   publication: { editions: [], selectedEdition: null },
 *   metadata: { pinCite: null, publisher: null, year: "2020", month: null, day: null, parenthetical: null }
 * })
 * console.log(result !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FullLawCitation extends S.Opaque<FullLawCitation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("law"),
    components: CitationComponents,
    publication: CitationPublication,
    metadata: CitationLawMetadata,
  }).pipe(
    $I.annoteSchema("FullLawCitation", {
      description:
        "Full law citation semantics for canonical law publications, separate from mention evidence, document grouping and run diagnostics.",
    })
  )
) {}
