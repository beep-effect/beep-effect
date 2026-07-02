/**
 * RDF vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { makeNamedNode } from "../Rdf.ts";

/**
 * RDF namespace IRI.
 *
 * @example
 * ```ts
 * import { RDF_NAMESPACE } from "@beep/rdf/Vocab/Rdf"
 *
 * const typeIri = `${RDF_NAMESPACE}type`
 * console.log(typeIri) // "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const RDF_NAMESPACE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#" as const;

/**
 * Finite RDF local-name inventory mirrored by `@beep/identity`.
 *
 * @example
 * ```ts
 * import { RDF_TERMS } from "@beep/rdf/Vocab/Rdf"
 *
 * console.log(RDF_TERMS.includes("type")) // true
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const RDF_TERMS = [
  "Alt",
  "Bag",
  "HTML",
  "List",
  "Property",
  "Seq",
  "Statement",
  "XMLLiteral",
  "first",
  "langString",
  "nil",
  "object",
  "predicate",
  "rest",
  "subject",
  "type",
  "value",
] as const;

/**
 * `rdf:type`
 *
 * @example
 * ```ts
 * import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf"
 *
 * console.log(RDF_TYPE.value) // "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
 * console.log(RDF_TYPE.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const RDF_TYPE = makeNamedNode(`${RDF_NAMESPACE}type`);

/**
 * `rdf:first`
 *
 * @example
 * ```ts
 * import { RDF_FIRST } from "@beep/rdf/Vocab/Rdf"
 *
 * console.log(RDF_FIRST.value) // "http://www.w3.org/1999/02/22-rdf-syntax-ns#first"
 * console.log(RDF_FIRST.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const RDF_FIRST = makeNamedNode(`${RDF_NAMESPACE}first`);

/**
 * `rdf:rest`
 *
 * @example
 * ```ts
 * import { RDF_REST } from "@beep/rdf/Vocab/Rdf"
 *
 * console.log(RDF_REST.value) // "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest"
 * console.log(RDF_REST.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const RDF_REST = makeNamedNode(`${RDF_NAMESPACE}rest`);

/**
 * `rdf:nil`
 *
 * @example
 * ```ts
 * import { RDF_NIL } from "@beep/rdf/Vocab/Rdf"
 *
 * console.log(RDF_NIL.value) // "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil"
 * console.log(RDF_NIL.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const RDF_NIL = makeNamedNode(`${RDF_NAMESPACE}nil`);
