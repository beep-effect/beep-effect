import { pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import type {
  AssembledOntologyClass,
  OntologyLanguageLiteral,
  OntologyReference,
  OntologySkosConceptProfile,
  OntologySkosConceptSchemeProfile,
  OntologySkosProfile,
} from "../model.js";

/**
 * Selects language literals from a class SKOS profile when present.
 *
 * @example
 * ```ts
 * const labels = skosProfileLiterals(ontologyClass, (profile) => profile.prefLabels)
 * ```
 * @category projections
 * @since 0.0.0
 */
export const skosProfileLiterals: {
  (
    ontologyClass: AssembledOntologyClass,
    select: (profile: OntologySkosProfile) => ReadonlyArray<OntologyLanguageLiteral>
  ): ReadonlyArray<OntologyLanguageLiteral>;
  (
    select: (profile: OntologySkosProfile) => ReadonlyArray<OntologyLanguageLiteral>
  ): (ontologyClass: AssembledOntologyClass) => ReadonlyArray<OntologyLanguageLiteral>;
} = dual(2, (ontologyClass: AssembledOntologyClass, select) =>
  pipe(ontologyClass.skosProfile, O.map(select), O.getOrElse(A.empty<OntologyLanguageLiteral>))
);

/**
 * Selects references from a class SKOS concept profile when present.
 *
 * @example
 * ```ts
 * const broader = skosConceptReferences(ontologyClass, (profile) => profile.broader)
 * ```
 * @category projections
 * @since 0.0.0
 */
export const skosConceptReferences: {
  (
    ontologyClass: AssembledOntologyClass,
    select: (profile: OntologySkosConceptProfile) => ReadonlyArray<OntologyReference>
  ): ReadonlyArray<OntologyReference>;
  (
    select: (profile: OntologySkosConceptProfile) => ReadonlyArray<OntologyReference>
  ): (ontologyClass: AssembledOntologyClass) => ReadonlyArray<OntologyReference>;
} = dual(2, (ontologyClass: AssembledOntologyClass, select) =>
  pipe(
    ontologyClass.skosProfile,
    O.flatMap((profile) => (profile.kind === "concept" ? O.some(select(profile)) : O.none())),
    O.getOrElse(A.empty<OntologyReference>)
  )
);

/**
 * Selects references from a class SKOS concept scheme profile when present.
 *
 * @example
 * ```ts
 * const topConcepts = skosSchemeReferences(ontologyClass, (profile) => profile.hasTopConcept)
 * ```
 * @category projections
 * @since 0.0.0
 */
export const skosSchemeReferences: {
  (
    ontologyClass: AssembledOntologyClass,
    select: (profile: OntologySkosConceptSchemeProfile) => ReadonlyArray<OntologyReference>
  ): ReadonlyArray<OntologyReference>;
  (
    select: (profile: OntologySkosConceptSchemeProfile) => ReadonlyArray<OntologyReference>
  ): (ontologyClass: AssembledOntologyClass) => ReadonlyArray<OntologyReference>;
} = dual(2, (ontologyClass: AssembledOntologyClass, select) =>
  pipe(
    ontologyClass.skosProfile,
    O.flatMap((profile) => (profile.kind === "conceptScheme" ? O.some(select(profile)) : O.none())),
    O.getOrElse(A.empty<OntologyReference>)
  )
);
