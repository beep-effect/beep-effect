/**
 * Shared canonical resource citation primitives, adapted from eyecite 2.7.6.
 * Upstream: Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.resource");

/**
 * Content identity of one immutable parser-publication edition artifact.
 *
 * Law/journal publications receive no invented case ReporterId.
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
 * Semantic legal locator components with absent and explicit-null keys distinct.
 *
 * The oracle explicitly defines its group keys as non-exhaustive. Preserve
 * all string-valued legal components, including chapter versus title, without
 * guessing a numeric interpretation or dropping tokenizer-supplied keys.
 * Null values decode to None; a missing key remains missing.
 *
 * **Example** (Decode distinct locator components)
 *
 * ```ts
 * import { CitationComponents } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 * const decode = S.decodeEffect(CitationComponents)
 * const result = decode({ chapter: "37", reporter: "C.F.R.", section: "1.56" })
 * console.log(result !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitationComponents = S.Record(S.NonEmptyString, S.OptionFromNullOr(S.String)).pipe(
  S.brand("CitationComponents"),
  $I.annoteSchema("CitationComponents", {
    description:
      "Named legal locator components; preserves source-backed string values, missing keys and explicit nulls without occurrence state.",
  })
);
/**
 * Schema-derived legal locator component map.
 * @category models
 * @since 0.0.0
 */
export type CitationComponents = typeof CitationComponents.Type;

const PublicationFields = S.Struct({
  editions: S.Array(CitationEditionRef).annotateKey({
    description: "Candidate edition identities, preserving multiplicity; exact/variation processing stays private.",
  }),
  selectedEdition: S.OptionFromNullOr(CitationEditionRef).annotateKey({
    description: "Selected edition when known; absence or ambiguity remains data.",
  }),
});

/**
 * Publication identity candidates for one resource citation.
 *
 * **Example** (Represent an unknown publication)
 *
 * ```ts
 * import { CitationPublication } from "@beep/law-practice-domain/values"
 * import * as O from "effect/Option"
 * const publication = CitationPublication.make({ editions: [], selectedEdition: O.none() })
 * console.log(publication.editions.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CitationPublication extends S.Opaque<CitationPublication, { readonly brand: unique symbol }>()(
  PublicationFields.pipe(
    $I.annoteSchema("CitationPublication", {
      description:
        "Publication candidates and an independent selected identity retained across source candidate mutations; no case-reporter IDs.",
    })
  )
) {}

/**
 * Legal locator and explanatory text shared by reference and resource forms.
 *
 * **Example** (Decode a reference pincite)
 * ```ts
 * import { CitationLocatorMetadata } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 * const result = S.decodeEffect(CitationLocatorMetadata)({ pinCite: "240", parenthetical: null })
 * console.log(result !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationLocatorMetadata extends S.Opaque<CitationLocatorMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    pinCite: S.OptionFromNullOr(S.String),
    parenthetical: S.OptionFromNullOr(S.String),
  }).pipe(
    $I.annoteSchema("CitationLocatorMetadata", {
      description: "Semantic pincite and explanatory parenthetical, with all source positions kept on mentions.",
    })
  )
) {}

/**
 * Textual date metadata preserving the oracle's precision and spelling.
 *
 * **Example** (Decode a journal date)
 * ```ts
 * import { CitationDatedMetadata } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 * const result = S.decodeEffect(CitationDatedMetadata)({
 *   pinCite: null, parenthetical: null, year: "2020", month: null, day: null
 * })
 * console.log(result !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationDatedMetadata extends S.Opaque<CitationDatedMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    ...CitationLocatorMetadata.fields,
    year: S.OptionFromNullOr(S.String),
    month: S.OptionFromNullOr(S.String),
    day: S.OptionFromNullOr(S.String),
  }).pipe(
    $I.annoteSchema("CitationDatedMetadata", {
      description: "Legal locator metadata and uncoerced date components; numeric year validation stays private.",
    })
  )
) {}
