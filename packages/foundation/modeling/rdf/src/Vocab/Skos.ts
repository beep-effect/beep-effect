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
 * const conceptIri = `${SKOS_NAMESPACE}Concept`
 * const isSkosConcept = conceptIri === "http://www.w3.org/2004/02/skos/core#Concept"
 * console.log(isSkosConcept) // true
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const SKOS_NAMESPACE = "http://www.w3.org/2004/02/skos/core#" as const;

/**
 * Complete SKOS core local-name inventory mirrored by `@beep/identity`.
 *
 * @example
 * ```ts
 * import { SKOS_TERMS } from "@beep/rdf/Vocab/Skos"
 *
 * console.log(SKOS_TERMS.includes("prefLabel")) // true
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_TERMS = [
  "Collection",
  "Concept",
  "ConceptScheme",
  "OrderedCollection",
  "altLabel",
  "broadMatch",
  "broader",
  "broaderTransitive",
  "changeNote",
  "closeMatch",
  "definition",
  "editorialNote",
  "exactMatch",
  "example",
  "hasTopConcept",
  "hiddenLabel",
  "historyNote",
  "inScheme",
  "mappingRelation",
  "member",
  "memberList",
  "narrowMatch",
  "narrower",
  "narrowerTransitive",
  "notation",
  "note",
  "prefLabel",
  "related",
  "relatedMatch",
  "scopeNote",
  "semanticRelation",
  "topConceptOf",
] as const;

/**
 * `skos:Concept`
 *
 * @example
 * ```ts
 * import { SKOS_CONCEPT } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_CONCEPT.value
 * const termType = SKOS_CONCEPT.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_CONCEPT = makeNamedNode(`${SKOS_NAMESPACE}Concept`);

/**
 * `skos:ConceptScheme`
 *
 * @example
 * ```ts
 * import { SKOS_CONCEPT_SCHEME } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_CONCEPT_SCHEME.value
 * const termType = SKOS_CONCEPT_SCHEME.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_CONCEPT_SCHEME = makeNamedNode(`${SKOS_NAMESPACE}ConceptScheme`);

/**
 * `skos:prefLabel`
 *
 * @example
 * ```ts
 * import { SKOS_PREF_LABEL } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_PREF_LABEL.value
 * const termType = SKOS_PREF_LABEL.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_PREF_LABEL = makeNamedNode(`${SKOS_NAMESPACE}prefLabel`);

/**
 * `skos:altLabel`
 *
 * @example
 * ```ts
 * import { SKOS_ALT_LABEL } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_ALT_LABEL.value
 * const termType = SKOS_ALT_LABEL.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_ALT_LABEL = makeNamedNode(`${SKOS_NAMESPACE}altLabel`);

/**
 * `skos:hiddenLabel`
 *
 * @example
 * ```ts
 * import { SKOS_HIDDEN_LABEL } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_HIDDEN_LABEL.value
 * const termType = SKOS_HIDDEN_LABEL.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_HIDDEN_LABEL = makeNamedNode(`${SKOS_NAMESPACE}hiddenLabel`);

/**
 * `skos:definition`
 *
 * @example
 * ```ts
 * import { SKOS_DEFINITION } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_DEFINITION.value
 * const termType = SKOS_DEFINITION.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_DEFINITION = makeNamedNode(`${SKOS_NAMESPACE}definition`);

/**
 * `skos:scopeNote`
 *
 * @example
 * ```ts
 * import { SKOS_SCOPE_NOTE } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_SCOPE_NOTE.value
 * const termType = SKOS_SCOPE_NOTE.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_SCOPE_NOTE = makeNamedNode(`${SKOS_NAMESPACE}scopeNote`);

/**
 * `skos:editorialNote`
 *
 * @example
 * ```ts
 * import { SKOS_EDITORIAL_NOTE } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_EDITORIAL_NOTE.value
 * const termType = SKOS_EDITORIAL_NOTE.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_EDITORIAL_NOTE = makeNamedNode(`${SKOS_NAMESPACE}editorialNote`);

/**
 * `skos:historyNote`
 *
 * @example
 * ```ts
 * import { SKOS_HISTORY_NOTE } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_HISTORY_NOTE.value
 * const termType = SKOS_HISTORY_NOTE.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_HISTORY_NOTE = makeNamedNode(`${SKOS_NAMESPACE}historyNote`);

/**
 * `skos:broader`
 *
 * @example
 * ```ts
 * import { SKOS_BROADER } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_BROADER.value
 * const termType = SKOS_BROADER.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_BROADER = makeNamedNode(`${SKOS_NAMESPACE}broader`);

/**
 * `skos:narrower`
 *
 * @example
 * ```ts
 * import { SKOS_NARROWER } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_NARROWER.value
 * const termType = SKOS_NARROWER.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_NARROWER = makeNamedNode(`${SKOS_NAMESPACE}narrower`);

/**
 * `skos:related`
 *
 * @example
 * ```ts
 * import { SKOS_RELATED } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_RELATED.value
 * const termType = SKOS_RELATED.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_RELATED = makeNamedNode(`${SKOS_NAMESPACE}related`);

/**
 * `skos:exactMatch`
 *
 * @example
 * ```ts
 * import { SKOS_EXACT_MATCH } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_EXACT_MATCH.value
 * const termType = SKOS_EXACT_MATCH.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_EXACT_MATCH = makeNamedNode(`${SKOS_NAMESPACE}exactMatch`);

/**
 * `skos:closeMatch`
 *
 * @example
 * ```ts
 * import { SKOS_CLOSE_MATCH } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_CLOSE_MATCH.value
 * const termType = SKOS_CLOSE_MATCH.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_CLOSE_MATCH = makeNamedNode(`${SKOS_NAMESPACE}closeMatch`);

/**
 * `skos:broadMatch`
 *
 * @example
 * ```ts
 * import { SKOS_BROAD_MATCH } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_BROAD_MATCH.value
 * const termType = SKOS_BROAD_MATCH.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_BROAD_MATCH = makeNamedNode(`${SKOS_NAMESPACE}broadMatch`);

/**
 * `skos:narrowMatch`
 *
 * @example
 * ```ts
 * import { SKOS_NARROW_MATCH } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_NARROW_MATCH.value
 * const termType = SKOS_NARROW_MATCH.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_NARROW_MATCH = makeNamedNode(`${SKOS_NAMESPACE}narrowMatch`);

/**
 * `skos:relatedMatch`
 *
 * @example
 * ```ts
 * import { SKOS_RELATED_MATCH } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_RELATED_MATCH.value
 * const termType = SKOS_RELATED_MATCH.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_RELATED_MATCH = makeNamedNode(`${SKOS_NAMESPACE}relatedMatch`);

/**
 * `skos:inScheme`
 *
 * @example
 * ```ts
 * import { SKOS_IN_SCHEME } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_IN_SCHEME.value
 * const termType = SKOS_IN_SCHEME.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_IN_SCHEME = makeNamedNode(`${SKOS_NAMESPACE}inScheme`);

/**
 * `skos:hasTopConcept`
 *
 * @example
 * ```ts
 * import { SKOS_HAS_TOP_CONCEPT } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_HAS_TOP_CONCEPT.value
 * const termType = SKOS_HAS_TOP_CONCEPT.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_HAS_TOP_CONCEPT = makeNamedNode(`${SKOS_NAMESPACE}hasTopConcept`);

/**
 * `skos:topConceptOf`
 *
 * @example
 * ```ts
 * import { SKOS_TOP_CONCEPT_OF } from "@beep/rdf/Vocab/Skos"
 *
 * const iri = SKOS_TOP_CONCEPT_OF.value
 * const termType = SKOS_TOP_CONCEPT_OF.termType
 * console.log(termType, iri)
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const SKOS_TOP_CONCEPT_OF = makeNamedNode(`${SKOS_NAMESPACE}topConceptOf`);
