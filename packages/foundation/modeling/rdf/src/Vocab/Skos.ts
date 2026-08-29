/**
 * SKOS vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeNamedNode } from "../Rdf.ts";

/**
 * SKOS namespace IRI.
 *
 * @see https://www.w3.org/TR/skos-reference/
 * @example
 * ```ts
 * import { SKOS_NAMESPACE } from "@beep/rdf/Vocab/Skos"
 *
 * console.log(SKOS_NAMESPACE)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const SKOS_NAMESPACE = "http://www.w3.org/2004/02/skos/core#" as const;

/**
 * `skos:Concept`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_CONCEPT = makeNamedNode(`${SKOS_NAMESPACE}Concept`);

/**
 * `skos:ConceptScheme`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_CONCEPT_SCHEME = makeNamedNode(`${SKOS_NAMESPACE}ConceptScheme`);

/**
 * `skos:prefLabel`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_PREF_LABEL = makeNamedNode(`${SKOS_NAMESPACE}prefLabel`);

/**
 * `skos:altLabel`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_ALT_LABEL = makeNamedNode(`${SKOS_NAMESPACE}altLabel`);

/**
 * `skos:hiddenLabel`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_HIDDEN_LABEL = makeNamedNode(`${SKOS_NAMESPACE}hiddenLabel`);

/**
 * `skos:definition`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_DEFINITION = makeNamedNode(`${SKOS_NAMESPACE}definition`);

/**
 * `skos:scopeNote`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_SCOPE_NOTE = makeNamedNode(`${SKOS_NAMESPACE}scopeNote`);

/**
 * `skos:editorialNote`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_EDITORIAL_NOTE = makeNamedNode(`${SKOS_NAMESPACE}editorialNote`);

/**
 * `skos:historyNote`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_HISTORY_NOTE = makeNamedNode(`${SKOS_NAMESPACE}historyNote`);

/**
 * `skos:broader`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_BROADER = makeNamedNode(`${SKOS_NAMESPACE}broader`);

/**
 * `skos:narrower`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_NARROWER = makeNamedNode(`${SKOS_NAMESPACE}narrower`);

/**
 * `skos:related`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_RELATED = makeNamedNode(`${SKOS_NAMESPACE}related`);

/**
 * `skos:exactMatch`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_EXACT_MATCH = makeNamedNode(`${SKOS_NAMESPACE}exactMatch`);

/**
 * `skos:closeMatch`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_CLOSE_MATCH = makeNamedNode(`${SKOS_NAMESPACE}closeMatch`);

/**
 * `skos:broadMatch`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_BROAD_MATCH = makeNamedNode(`${SKOS_NAMESPACE}broadMatch`);

/**
 * `skos:narrowMatch`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_NARROW_MATCH = makeNamedNode(`${SKOS_NAMESPACE}narrowMatch`);

/**
 * `skos:relatedMatch`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_RELATED_MATCH = makeNamedNode(`${SKOS_NAMESPACE}relatedMatch`);

/**
 * `skos:inScheme`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_IN_SCHEME = makeNamedNode(`${SKOS_NAMESPACE}inScheme`);

/**
 * `skos:hasTopConcept`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_HAS_TOP_CONCEPT = makeNamedNode(`${SKOS_NAMESPACE}hasTopConcept`);

/**
 * `skos:topConceptOf`
 *
 * @since 0.0.0
 * @category models
 */
export const SKOS_TOP_CONCEPT_OF = makeNamedNode(`${SKOS_NAMESPACE}topConceptOf`);
