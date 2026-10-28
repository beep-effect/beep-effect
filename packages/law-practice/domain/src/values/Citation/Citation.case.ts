/**
 * Canonical case/reference citation semantics adapted from eyecite 2.7.6.
 * Upstream: Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CourtId, CourtReporterArtifactVersion, ReporterId } from "../CourtReporterVocabulary/index.ts";
import {
  CitationComponents,
  CitationDatedMetadata,
  CitationEditionRef,
  CitationLocatorMetadata,
} from "./Citation.resource.ts";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.case");

/**
 * Known court identity pinned to its public vocabulary artifact.
 * **Example** (Decode a stable court identity)
 * ```ts
 * import { CitationKnownCourt } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 * const result = S.decodeEffect(CitationKnownCourt)({
 *   status: "known", id: "scotus", vocabularyVersion: "crv1:f353e51400a5:fad63b383b92"
 * })
 * console.log(result !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationKnownCourt extends S.Opaque<CitationKnownCourt, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("known"), id: CourtId, vocabularyVersion: CourtReporterArtifactVersion }).pipe(
    $I.annoteSchema("CitationKnownCourt", {
      description: "Versioned stable court identity; the engine verifies vocabulary membership.",
    })
  )
) {}

/**
 * Court reference without an evidenced public vocabulary identity.
 * **Example** (Preserve unmapped metadata)
 * ```ts
 * import { CitationUnmappedCourt } from "@beep/law-practice-domain/values"
 * const court = CitationUnmappedCourt.make({ value: "unmapped court" })
 * console.log(court.status) // "unmapped"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationUnmappedCourt extends S.Opaque<CitationUnmappedCourt, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("unmapped"), value: S.String }).pipe(
    $I.annoteSchema("CitationUnmappedCourt", {
      description: "Unmapped court metadata retained as data, including an explicit empty value.",
    })
  )
) {}

/**
 * Court identity or an explicit unresolved textual reference.
 * **Example** (Use a schema-derived guard)
 * ```ts
 * import { CitationCourt, CitationUnmappedCourt } from "@beep/law-practice-domain/values"
 * console.log(CitationCourt.guards.unmapped(CitationUnmappedCourt.make({ value: "" }))) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationCourt = S.Union([CitationKnownCourt, CitationUnmappedCourt]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("CitationCourt", {
    description: "Known versioned court identity or preserved unmapped legal metadata.",
  })
);
/**
 * Schema-derived court reference.
 * @category models
 * @since 0.0.0
 */
export type CitationCourt = typeof CitationCourt.Type;

/**
 * Historical edition identity paired with its current public reporter identity.
 * **Example** (Inspect the identity fields)
 * ```ts
 * import { CitationCaseEdition } from "@beep/law-practice-domain/values"
 * console.log(CitationCaseEdition.fields.reporterId !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationCaseEdition extends S.Opaque<CitationCaseEdition, { readonly brand: unique symbol }>()(
  S.Struct({ edition: CitationEditionRef, reporterId: ReporterId }).pipe(
    $I.annoteSchema("CitationCaseEdition", {
      description:
        "Immutable historical edition identity and its public reporter mapping; merged aliases retain distinct edition refs.",
    })
  )
) {}

const CasePublicationFields = S.Struct({
  vocabularyVersion: CourtReporterArtifactVersion,
  editions: S.Array(CitationCaseEdition),
  selectedEdition: S.OptionFromNullOr(CitationEditionRef),
});

/**
 * Case publication candidates with a versioned reporter identity mapping.
 * **Example** (Represent unresolved publication identity)
 * ```ts
 * import { CitationCasePublication } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 * const result = S.decodeEffect(CitationCasePublication)({
 *   vocabularyVersion: "crv1:f353e51400a5:fad63b383b92", editions: [], selectedEdition: null
 * })
 * console.log(result !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationCasePublication extends S.Opaque<CitationCasePublication, { readonly brand: unique symbol }>()(
  CasePublicationFields.check(
    S.makeFilter(
      (publication) => {
        const selected = publication.selectedEdition;
        return O.isNone(selected) || A.some(publication.editions, (candidate) => candidate.edition === selected.value);
      },
      $I.annote("CaseEditionMembership", {
        title: "Case Edition Membership",
        description: "A selected edition must occur in the versioned case publication candidates.",
        message: "Selected edition is absent from case publication candidates.",
      })
    )
  ).pipe(
    $I.annoteSchema("CitationCasePublication", {
      description:
        "Case publication candidates, historical edition identity and selected member; vocabulary resolution stays at the engine boundary.",
    })
  )
) {}

/**
 * Metadata shared by full and short case citations.
 * **Example** (Inspect the court composition)
 * ```ts
 * import { CitationCaseMetadata } from "@beep/law-practice-domain/values"
 * console.log(CitationCaseMetadata.fields.court !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationCaseMetadata extends S.Opaque<CitationCaseMetadata, { readonly brand: unique symbol }>()(
  S.Struct({ ...CitationDatedMetadata.fields, court: S.OptionFromNullOr(CitationCourt) }).pipe(
    $I.annoteSchema("CitationCaseMetadata", {
      description: "Case locator/date semantics and optional known or unmapped court identity.",
    })
  )
) {}

/**
 * Full case party names, antecedent label and additional legal citation text.
 * **Example** (Inspect party-name fields)
 * ```ts
 * import { CitationFullCaseMetadata } from "@beep/law-practice-domain/values"
 * console.log(CitationFullCaseMetadata.fields.plaintiff !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationFullCaseMetadata extends S.Opaque<CitationFullCaseMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    ...CitationCaseMetadata.fields,
    plaintiff: S.OptionFromNullOr(S.String),
    defendant: S.OptionFromNullOr(S.String),
    additionalText: S.OptionFromNullOr(S.String),
    antecedentGuess: S.OptionFromNullOr(S.String),
    shortCaseName: S.OptionFromNullOr(S.String),
    caseName: S.OptionFromNullOr(S.String),
  }).pipe(
    $I.annoteSchema("CitationFullCaseMetadata", {
      description:
        "Full case legal metadata; normalized case names preserve oracle name enrichment without embedding resolution pointers.",
    })
  )
) {}

/**
 * Short-case locator metadata and its antecedent label.
 * **Example** (Inspect the antecedent field)
 * ```ts
 * import { CitationShortCaseMetadata } from "@beep/law-practice-domain/values"
 * console.log(CitationShortCaseMetadata.fields.antecedentGuess !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationShortCaseMetadata extends S.Opaque<CitationShortCaseMetadata, { readonly brand: unique symbol }>()(
  S.Struct({ ...CitationCaseMetadata.fields, antecedentGuess: S.OptionFromNullOr(S.String) }).pipe(
    $I.annoteSchema("CitationShortCaseMetadata", {
      description:
        "Short case metadata with a source-backed antecedent name; no resolved citation copy or array index.",
    })
  )
) {}

/**
 * Supra locator semantics, including textual volume and antecedent label.
 * **Example** (Inspect volume precision)
 * ```ts
 * import { CitationSupraMetadata } from "@beep/law-practice-domain/values"
 * console.log(CitationSupraMetadata.fields.volume !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationSupraMetadata extends S.Opaque<CitationSupraMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    ...CitationLocatorMetadata.fields,
    antecedentGuess: S.OptionFromNullOr(S.String),
    volume: S.OptionFromNullOr(S.String),
  }).pipe(
    $I.annoteSchema("CitationSupraMetadata", {
      description: "Supra antecedent, textual volume, pincite and explanatory parenthetical.",
    })
  )
) {}

/**
 * Named-reference semantics without a recursively embedded full citation.
 * **Example** (Inspect name fields)
 * ```ts
 * import { CitationReferenceMetadata } from "@beep/law-practice-domain/values"
 * console.log(CitationReferenceMetadata.fields.caseName !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationReferenceMetadata extends S.Opaque<CitationReferenceMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    ...CitationLocatorMetadata.fields,
    plaintiff: S.OptionFromNullOr(S.String),
    defendant: S.OptionFromNullOr(S.String),
    shortCaseName: S.OptionFromNullOr(S.String),
    caseName: S.OptionFromNullOr(S.String),
  }).pipe(
    $I.annoteSchema("CitationReferenceMetadata", {
      description: "Named reference metadata; authority and mention relationships belong to CitationDocument.",
    })
  )
) {}

/**
 * Full case authority semantics without occurrence state.
 *
 * **Example** (Inspect the semantic model)
 * ```ts
 * import { FullCaseCitation } from "@beep/law-practice-domain/values"
 * console.log(FullCaseCitation.fields.components !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class FullCaseCitation extends S.Opaque<FullCaseCitation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("case"),
    components: CitationComponents,
    publication: CitationCasePublication,
    metadata: CitationFullCaseMetadata,
  }).pipe(
    $I.annoteSchema("FullCaseCitation", { description: "Full case authority semantics without occurrence state." })
  )
) {}

/**
 * Canonical ShortCaseCitation semantics, retaining the existing repo semantic name.
 *
 * **Example** (Inspect the semantic model)
 * ```ts
 * import { ShortFormCaseCitation } from "@beep/law-practice-domain/values"
 * console.log(ShortFormCaseCitation.fields.components !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class ShortFormCaseCitation extends S.Opaque<ShortFormCaseCitation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("shortFormCase"),
    components: CitationComponents,
    publication: CitationCasePublication,
    metadata: CitationShortCaseMetadata,
  }).pipe(
    $I.annoteSchema("ShortFormCaseCitation", {
      description: "Canonical ShortCaseCitation semantics, retaining the existing repo semantic name.",
    })
  )
) {}

/**
 * Id/ibid reference semantics; occurrence uniqueness and antecedent resolution stay outside this value.
 *
 * **Example** (Inspect the semantic model)
 * ```ts
 * import { IdCitation } from "@beep/law-practice-domain/values"
 * console.log(IdCitation.fields.components !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class IdCitation extends S.Opaque<IdCitation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("id"),
    components: CitationComponents,
    metadata: CitationLocatorMetadata,
  }).pipe(
    $I.annoteSchema("IdCitation", {
      description:
        "Id/ibid reference semantics; occurrence uniqueness and antecedent resolution stay outside this value.",
    })
  )
) {}

/**
 * Supra reference semantics without an embedded antecedent citation.
 *
 * **Example** (Inspect the semantic model)
 * ```ts
 * import { SupraCitation } from "@beep/law-practice-domain/values"
 * console.log(SupraCitation.fields.components !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class SupraCitation extends S.Opaque<SupraCitation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("supra"),
    components: CitationComponents,
    metadata: CitationSupraMetadata,
  }).pipe(
    $I.annoteSchema("SupraCitation", {
      description: "Supra reference semantics without an embedded antecedent citation.",
    })
  )
) {}

/**
 * Named reference citation semantics; unresolved names remain data.
 *
 * **Example** (Inspect the semantic model)
 * ```ts
 * import { ReferenceCitation } from "@beep/law-practice-domain/values"
 * console.log(ReferenceCitation.fields.components !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class ReferenceCitation extends S.Opaque<ReferenceCitation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("reference"),
    components: CitationComponents,
    metadata: CitationReferenceMetadata,
  }).pipe(
    $I.annoteSchema("ReferenceCitation", {
      description: "Named reference citation semantics; unresolved names remain data.",
    })
  )
) {}

/**
 * Unknown citation semantics; exact source spelling belongs to its verified mention.
 *
 * **Example** (Inspect the semantic model)
 * ```ts
 * import { UnknownCitation } from "@beep/law-practice-domain/values"
 * console.log(UnknownCitation.fields.components !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class UnknownCitation extends S.Opaque<UnknownCitation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("unknown"),
    components: CitationComponents,
    metadata: CitationLocatorMetadata,
  }).pipe(
    $I.annoteSchema("UnknownCitation", {
      description: "Unknown citation semantics; exact source spelling belongs to its verified mention.",
    })
  )
) {}
