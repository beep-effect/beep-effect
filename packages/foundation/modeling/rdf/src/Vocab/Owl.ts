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
 * @example
 * ```ts
 * import { OWL_CLASS } from "@beep/rdf/Vocab/Owl"
 *
 * console.log(OWL_CLASS.value) // "http://www.w3.org/2002/07/owl#Class"
 * console.log(OWL_CLASS.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const OWL_CLASS = makeNamedNode(`${OWL_NAMESPACE}Class`);

/**
 * `owl:ObjectProperty`
 *
 * @example
 * ```ts
 * import { OWL_OBJECT_PROPERTY } from "@beep/rdf/Vocab/Owl"
 *
 * console.log(OWL_OBJECT_PROPERTY.value) // "http://www.w3.org/2002/07/owl#ObjectProperty"
 * console.log(OWL_OBJECT_PROPERTY.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const OWL_OBJECT_PROPERTY = makeNamedNode(`${OWL_NAMESPACE}ObjectProperty`);

/**
 * `owl:DatatypeProperty`
 *
 * @example
 * ```ts
 * import { OWL_DATATYPE_PROPERTY } from "@beep/rdf/Vocab/Owl"
 *
 * console.log(OWL_DATATYPE_PROPERTY.value) // "http://www.w3.org/2002/07/owl#DatatypeProperty"
 * console.log(OWL_DATATYPE_PROPERTY.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const OWL_DATATYPE_PROPERTY = makeNamedNode(`${OWL_NAMESPACE}DatatypeProperty`);
