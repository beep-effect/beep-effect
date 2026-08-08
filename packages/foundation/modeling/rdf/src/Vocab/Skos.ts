/**
 * SKOS vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeNamedNode } from "../Rdf.ts";
import { SKOS_NAMESPACE } from "./generated/Skos.terms.ts";

/**
 * Generated namespace IRI and term inventory for this vocabulary.
 *
 * Single-sourced from the `@beep/identity` `CoreVocab` registry via
 * `bun run beep sync-data-to-ts --target vocab-terms`.
 *
 * @category constants
 * @since 0.0.0
 */
export { SKOS_NAMESPACE, SKOS_TERMS } from "./generated/Skos.terms.ts";

/**
 * `skos:Concept`
 *
 * **Example** (Access concept IRI)
 *
 * ```ts
 * import { SKOS_CONCEPT } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_CONCEPT.value
 * const termType = SKOS_CONCEPT.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_CONCEPT = makeNamedNode(`${SKOS_NAMESPACE}Concept`);

/**
 * `skos:ConceptScheme`
 *
 * **Example** (Access concept scheme IRI)
 *
 * ```ts
 * import { SKOS_CONCEPT_SCHEME } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_CONCEPT_SCHEME.value
 * const termType = SKOS_CONCEPT_SCHEME.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_CONCEPT_SCHEME = makeNamedNode(`${SKOS_NAMESPACE}ConceptScheme`);

/**
 * `skos:prefLabel`
 *
 * **Example** (Access prefLabel IRI)
 *
 * ```ts
 * import { SKOS_PREF_LABEL } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_PREF_LABEL.value
 * const termType = SKOS_PREF_LABEL.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_PREF_LABEL = makeNamedNode(`${SKOS_NAMESPACE}prefLabel`);

/**
 * `skos:altLabel`
 *
 * **Example** (Access altLabel IRI)
 *
 * ```ts
 * import { SKOS_ALT_LABEL } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_ALT_LABEL.value
 * const termType = SKOS_ALT_LABEL.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_ALT_LABEL = makeNamedNode(`${SKOS_NAMESPACE}altLabel`);

/**
 * `skos:hiddenLabel`
 *
 * **Example** (Access hiddenLabel IRI)
 *
 * ```ts
 * import { SKOS_HIDDEN_LABEL } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_HIDDEN_LABEL.value
 * const termType = SKOS_HIDDEN_LABEL.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_HIDDEN_LABEL = makeNamedNode(`${SKOS_NAMESPACE}hiddenLabel`);

/**
 * `skos:definition`
 *
 * **Example** (Access definition IRI)
 *
 * ```ts
 * import { SKOS_DEFINITION } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_DEFINITION.value
 * const termType = SKOS_DEFINITION.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_DEFINITION = makeNamedNode(`${SKOS_NAMESPACE}definition`);

/**
 * `skos:scopeNote`
 *
 * **Example** (Access scopeNote IRI)
 *
 * ```ts
 * import { SKOS_SCOPE_NOTE } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_SCOPE_NOTE.value
 * const termType = SKOS_SCOPE_NOTE.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_SCOPE_NOTE = makeNamedNode(`${SKOS_NAMESPACE}scopeNote`);

/**
 * `skos:editorialNote`
 *
 * **Example** (Access editorialNote IRI)
 *
 * ```ts
 * import { SKOS_EDITORIAL_NOTE } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_EDITORIAL_NOTE.value
 * const termType = SKOS_EDITORIAL_NOTE.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_EDITORIAL_NOTE = makeNamedNode(`${SKOS_NAMESPACE}editorialNote`);

/**
 * `skos:historyNote`
 *
 * **Example** (Access historyNote IRI)
 *
 * ```ts
 * import { SKOS_HISTORY_NOTE } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_HISTORY_NOTE.value
 * const termType = SKOS_HISTORY_NOTE.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_HISTORY_NOTE = makeNamedNode(`${SKOS_NAMESPACE}historyNote`);

/**
 * `skos:broader`
 *
 * **Example** (Access broader IRI)
 *
 * ```ts
 * import { SKOS_BROADER } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_BROADER.value
 * const termType = SKOS_BROADER.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_BROADER = makeNamedNode(`${SKOS_NAMESPACE}broader`);

/**
 * `skos:narrower`
 *
 * **Example** (Access narrower IRI)
 *
 * ```ts
 * import { SKOS_NARROWER } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_NARROWER.value
 * const termType = SKOS_NARROWER.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_NARROWER = makeNamedNode(`${SKOS_NAMESPACE}narrower`);

/**
 * `skos:related`
 *
 * **Example** (Access related IRI)
 *
 * ```ts
 * import { SKOS_RELATED } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_RELATED.value
 * const termType = SKOS_RELATED.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_RELATED = makeNamedNode(`${SKOS_NAMESPACE}related`);

/**
 * `skos:exactMatch`
 *
 * **Example** (Access exactMatch IRI)
 *
 * ```ts
 * import { SKOS_EXACT_MATCH } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_EXACT_MATCH.value
 * const termType = SKOS_EXACT_MATCH.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_EXACT_MATCH = makeNamedNode(`${SKOS_NAMESPACE}exactMatch`);

/**
 * `skos:closeMatch`
 *
 * **Example** (Access closeMatch IRI)
 *
 * ```ts
 * import { SKOS_CLOSE_MATCH } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_CLOSE_MATCH.value
 * const termType = SKOS_CLOSE_MATCH.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_CLOSE_MATCH = makeNamedNode(`${SKOS_NAMESPACE}closeMatch`);

/**
 * `skos:broadMatch`
 *
 * **Example** (Access broadMatch IRI)
 *
 * ```ts
 * import { SKOS_BROAD_MATCH } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_BROAD_MATCH.value
 * const termType = SKOS_BROAD_MATCH.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_BROAD_MATCH = makeNamedNode(`${SKOS_NAMESPACE}broadMatch`);

/**
 * `skos:narrowMatch`
 *
 * **Example** (Access narrowMatch IRI)
 *
 * ```ts
 * import { SKOS_NARROW_MATCH } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_NARROW_MATCH.value
 * const termType = SKOS_NARROW_MATCH.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_NARROW_MATCH = makeNamedNode(`${SKOS_NAMESPACE}narrowMatch`);

/**
 * `skos:relatedMatch`
 *
 * **Example** (Access relatedMatch IRI)
 *
 * ```ts
 * import { SKOS_RELATED_MATCH } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_RELATED_MATCH.value
 * const termType = SKOS_RELATED_MATCH.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_RELATED_MATCH = makeNamedNode(`${SKOS_NAMESPACE}relatedMatch`);

/**
 * `skos:inScheme`
 *
 * **Example** (Access inScheme IRI)
 *
 * ```ts
 * import { SKOS_IN_SCHEME } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_IN_SCHEME.value
 * const termType = SKOS_IN_SCHEME.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_IN_SCHEME = makeNamedNode(`${SKOS_NAMESPACE}inScheme`);

/**
 * `skos:hasTopConcept`
 *
 * **Example** (Access hasTopConcept IRI)
 *
 * ```ts
 * import { SKOS_HAS_TOP_CONCEPT } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_HAS_TOP_CONCEPT.value
 * const termType = SKOS_HAS_TOP_CONCEPT.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_HAS_TOP_CONCEPT = makeNamedNode(`${SKOS_NAMESPACE}hasTopConcept`);

/**
 * `skos:topConceptOf`
 *
 * **Example** (Access topConceptOf IRI)
 *
 * ```ts
 * import { SKOS_TOP_CONCEPT_OF } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_TOP_CONCEPT_OF.value
 * const termType = SKOS_TOP_CONCEPT_OF.termType
 * console.log(termType, iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKOS_TOP_CONCEPT_OF = makeNamedNode(`${SKOS_NAMESPACE}topConceptOf`);
