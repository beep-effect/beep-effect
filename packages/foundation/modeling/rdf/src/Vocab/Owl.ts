/**
 * OWL vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { makeNamedNode } from "../Rdf.ts";
import { OWL_NAMESPACE } from "./generated/Owl.terms.ts";

/**
 * Generated namespace IRI and term inventory for this vocabulary.
 *
 * Single-sourced from the `@beep/identity` `CoreVocab` registry via
 * `bun run beep sync-data-to-ts --target vocab-terms`.
 *
 * @category constants
 * @since 0.0.0
 */
export { OWL_NAMESPACE, OWL_TERMS } from "./generated/Owl.terms.ts";

/**
 * `owl:Class`
 *
 * **Example** (Inspect Class NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect Class NamedNode"
 * import { OWL_CLASS } from "@beep/rdf/Vocab/Owl"
 *
 * OWL_CLASS.value // => "http://www.w3.org/2002/07/owl#Class"
 * OWL_CLASS.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OWL_CLASS = makeNamedNode(`${OWL_NAMESPACE}Class`);

/**
 * `owl:ObjectProperty`
 *
 * **Example** (Inspect ObjectProperty NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect ObjectProperty NamedNode"
 * import { OWL_OBJECT_PROPERTY } from "@beep/rdf/Vocab/Owl"
 *
 * OWL_OBJECT_PROPERTY.value // => "http://www.w3.org/2002/07/owl#ObjectProperty"
 * OWL_OBJECT_PROPERTY.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OWL_OBJECT_PROPERTY = makeNamedNode(`${OWL_NAMESPACE}ObjectProperty`);

/**
 * `owl:DatatypeProperty`
 *
 * **Example** (Inspect DatatypeProperty NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect DatatypeProperty NamedNode"
 * import { OWL_DATATYPE_PROPERTY } from "@beep/rdf/Vocab/Owl"
 *
 * OWL_DATATYPE_PROPERTY.value // => "http://www.w3.org/2002/07/owl#DatatypeProperty"
 * OWL_DATATYPE_PROPERTY.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OWL_DATATYPE_PROPERTY = makeNamedNode(`${OWL_NAMESPACE}DatatypeProperty`);
