/**
 * Canonical law citation semantics, adapted from eyecite 2.7.6 models.py.
 * Upstream: Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.law");

/**
 * Content identity of one immutable parser-publication edition artifact.
 *
 * Law publications are not case reporters and receive no invented ReporterId.
 * The owning engine artifact must resolve this reference and verify its kind.
 *
 * **Example** (Reference the frozen C.F.R. edition)
 *
 * ```ts
 * import { CitationEditionRef } from "@beep/law-practice-domain/values"
 * const edition = CitationEditionRef.make("b6293de3e161f1a649d897f5d5a099841074c14ebeee8e2996e7d2c172eefe4c")
 * console.log(edition.length) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitationEditionRef = Sha256Hex.pipe(
  S.brand("CitationEditionRef"),
  $I.annoteSchema("CitationEditionRef", {
    description:
      "SHA-256 identity of an immutable parser-edition artifact; resolution and source-kind checking belong to the engine.",
  })
);
/**
 * Schema-derived edition artifact reference.
 * @category models
 * @since 0.0.0
 */
export type CitationEditionRef = typeof CitationEditionRef.Type;

/**
 * Semantic law locator components with absent and explicit-null keys distinct.
 *
 * The oracle explicitly defines its group keys as non-exhaustive. Preserve
 * all string-valued legal components, including chapter versus title, without
 * guessing a numeric interpretation or dropping tokenizer-supplied keys.
 * Null values decode to None; a missing key remains missing.
 *
 * **Example** (Decode distinct locator components)
 *
 * ```ts
 * import { CitationLawComponents } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 * const decode = S.decodeEffect(CitationLawComponents)
 * const result = decode({ chapter: "37", reporter: "C.F.R.", section: "1.56" })
 * console.log(result !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitationLawComponents = S.Record(S.NonEmptyString, S.OptionFromNullOr(S.String)).pipe(
  S.brand("CitationLawComponents"),
  $I.annoteSchema("CitationLawComponents", {
    description:
      "Named legal locator components; preserves source-backed string values, missing keys and explicit nulls without occurrence state.",
  })
);
/**
 * Schema-derived law locator component map.
 * @category models
 * @since 0.0.0
 */
export type CitationLawComponents = typeof CitationLawComponents.Type;

const PublicationFields = S.Struct({
  editions: S.Array(CitationEditionRef).annotateKey({
    description: "Candidate edition identities, preserving multiplicity; exact/variation processing stays private.",
  }),
  selectedEdition: S.OptionFromNullOr(CitationEditionRef).annotateKey({
    description: "Selected edition when known; absence or ambiguity remains data.",
  }),
});

/**
 * Publication identity candidates for one law citation.
 *
 * **Example** (Represent an unknown publication)
 *
 * ```ts
 * import { CitationLawPublication } from "@beep/law-practice-domain/values"
 * import * as O from "effect/Option"
 * const publication = CitationLawPublication.make({ editions: [], selectedEdition: O.none() })
 * console.log(publication.editions.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CitationLawPublication extends S.Opaque<CitationLawPublication, { readonly brand: unique symbol }>()(
  PublicationFields.check(
    S.makeFilter(
      (publication) =>
        O.isNone(publication.selectedEdition) || A.contains(publication.editions, publication.selectedEdition.value),
      $I.annote("SelectedEditionMembership", {
        title: "Selected Edition Membership",
        description: "A selected edition must occur among the publication's candidate identities.",
        message: "Selected edition is absent from publication candidates.",
      })
    )
  ).pipe(
    $I.annoteSchema("CitationLawPublication", {
      description:
        "Law-publication candidate identities and optional selected member, separate from case-reporter vocabulary IDs.",
    })
  )
) {}

/**
 * Source-backed law metadata with textual date precision preserved.
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
    pinCite: S.OptionFromNullOr(S.String),
    publisher: S.OptionFromNullOr(S.String),
    year: S.OptionFromNullOr(S.String),
    month: S.OptionFromNullOr(S.String),
    day: S.OptionFromNullOr(S.String),
    parenthetical: S.OptionFromNullOr(S.String),
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
    components: CitationLawComponents,
    publication: CitationLawPublication,
    metadata: CitationLawMetadata,
  }).pipe(
    $I.annoteSchema("FullLawCitation", {
      description:
        "Full law citation semantics for canonical law publications, separate from mention evidence, document grouping and run diagnostics.",
    })
  )
) {}
