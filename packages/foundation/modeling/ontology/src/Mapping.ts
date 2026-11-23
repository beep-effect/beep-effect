/**
 * SKOS mapping relations between concepts and registry terms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/identity/Iri";
import { $OntologyId } from "@beep/identity/packages";
import * as Registry from "@beep/identity/Registry";
import { LiteralKit } from "@beep/schema/LiteralKit";

const $I = $OntologyId.create("Mapping");

/**
 * The five SKOS mapping relations, spelled as registry CURIEs.
 *
 * **Example** (Guard a mapping predicate)
 *
 * ```ts import.meta.vitest name="Guard a mapping predicate"
 * import { MappingPredicate } from "@beep/ontology/Mapping"
 *
 * MappingPredicate.is["skos:closeMatch"]("skos:closeMatch") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MappingPredicate = LiteralKit([
  "skos:exactMatch",
  "skos:closeMatch",
  "skos:broadMatch",
  "skos:narrowMatch",
  "skos:relatedMatch",
]).pipe(
  $I.annoteSchema("MappingPredicate", {
    description: "A SKOS mapping relation, as the registry CURIE of its predicate.",
  })
);

/**
 * Runtime type for {@link MappingPredicate}.
 *
 * **Example** (Type a mapping predicate)
 *
 * ```ts
 * import type { MappingPredicate } from "@beep/ontology/Mapping"
 *
 * const predicate: MappingPredicate = "skos:exactMatch"
 * console.log(predicate)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MappingPredicate = typeof MappingPredicate.Type;

/**
 * Expand a mapping predicate to its predicate IRI through the registry.
 *
 * **Example** (Expand closeMatch)
 *
 * ```ts import.meta.vitest name="Expand closeMatch"
 * import { mappingPredicateIri } from "@beep/ontology/Mapping"
 *
 * mappingPredicateIri("skos:closeMatch") // => "http://www.w3.org/2004/02/skos/core#closeMatch"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const mappingPredicateIri = (predicate: MappingPredicate): IRI => IRI.make(Registry.iri(predicate));
