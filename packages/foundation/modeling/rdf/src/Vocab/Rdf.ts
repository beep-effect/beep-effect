/**
 * RDF vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { makeNamedNode } from "../Rdf.ts";
import { RDF_NAMESPACE } from "./generated/Rdf.terms.ts";

/**
 * Generated namespace IRI and term inventory for this vocabulary.
 *
 * Single-sourced from the `@beep/identity` `CoreVocab` registry via
 * `bun run beep sync-data-to-ts --target vocab-terms`.
 *
 * @category constants
 * @since 0.0.0
 */
export { RDF_NAMESPACE, RDF_TERMS } from "./generated/Rdf.terms.ts";

/**
 * `rdf:type`
 *
 * **Example** (Inspect type NamedNode)
 *
 * ```ts
 * import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf"
 *
 * console.log(RDF_TYPE.value) // "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
 * console.log(RDF_TYPE.termType) // "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RDF_TYPE = makeNamedNode(`${RDF_NAMESPACE}type`);

/**
 * `rdf:first`
 *
 * **Example** (Inspect first NamedNode)
 *
 * ```ts
 * import { RDF_FIRST } from "@beep/rdf/Vocab/Rdf"
 *
 * console.log(RDF_FIRST.value) // "http://www.w3.org/1999/02/22-rdf-syntax-ns#first"
 * console.log(RDF_FIRST.termType) // "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RDF_FIRST = makeNamedNode(`${RDF_NAMESPACE}first`);

/**
 * `rdf:rest`
 *
 * **Example** (Inspect rest NamedNode)
 *
 * ```ts
 * import { RDF_REST } from "@beep/rdf/Vocab/Rdf"
 *
 * console.log(RDF_REST.value) // "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest"
 * console.log(RDF_REST.termType) // "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RDF_REST = makeNamedNode(`${RDF_NAMESPACE}rest`);

/**
 * `rdf:nil`
 *
 * **Example** (Inspect nil NamedNode)
 *
 * ```ts
 * import { RDF_NIL } from "@beep/rdf/Vocab/Rdf"
 *
 * console.log(RDF_NIL.value) // "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil"
 * console.log(RDF_NIL.termType) // "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RDF_NIL = makeNamedNode(`${RDF_NAMESPACE}nil`);
