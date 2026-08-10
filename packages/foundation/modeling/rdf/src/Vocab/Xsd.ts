/**
 * XSD vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { makeNamedNode } from "../Rdf.ts";

/**
 * XSD namespace IRI.
 *
 * **Example** (Build string datatype IRI)
 *
 * ```ts
 * import { XSD_NAMESPACE } from "@beep/rdf/Vocab/Xsd"
 *
 * const stringDatatypeIri = `${XSD_NAMESPACE}string`
 * console.log(stringDatatypeIri) // "http://www.w3.org/2001/XMLSchema#string"
 * ```
 *
 * @see https://www.w3.org/2001/XMLSchema#
 * @category configuration
 * @since 0.0.0
 */
export const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema#" as const;

/**
 * `xsd:string`
 *
 * **Example** (Inspect string NamedNode)
 *
 * ```ts
 * import { XSD_STRING } from "@beep/rdf/Vocab/Xsd"
 *
 * console.log(XSD_STRING.value) // "http://www.w3.org/2001/XMLSchema#string"
 * console.log(XSD_STRING.termType) // "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const XSD_STRING = makeNamedNode(`${XSD_NAMESPACE}string`);

/**
 * `xsd:anyURI`
 *
 * **Example** (Inspect anyURI NamedNode)
 *
 * ```ts
 * import { XSD_ANY_URI } from "@beep/rdf/Vocab/Xsd"
 *
 * console.log(XSD_ANY_URI.value) // "http://www.w3.org/2001/XMLSchema#anyURI"
 * console.log(XSD_ANY_URI.termType) // "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const XSD_ANY_URI = makeNamedNode(`${XSD_NAMESPACE}anyURI`);

/**
 * `xsd:boolean`
 *
 * **Example** (Inspect boolean NamedNode)
 *
 * ```ts
 * import { XSD_BOOLEAN } from "@beep/rdf/Vocab/Xsd"
 *
 * console.log(XSD_BOOLEAN.value) // "http://www.w3.org/2001/XMLSchema#boolean"
 * console.log(XSD_BOOLEAN.termType) // "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const XSD_BOOLEAN = makeNamedNode(`${XSD_NAMESPACE}boolean`);

/**
 * `xsd:integer`
 *
 * **Example** (Inspect integer NamedNode)
 *
 * ```ts
 * import { XSD_INTEGER } from "@beep/rdf/Vocab/Xsd"
 *
 * console.log(XSD_INTEGER.value) // "http://www.w3.org/2001/XMLSchema#integer"
 * console.log(XSD_INTEGER.termType) // "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const XSD_INTEGER = makeNamedNode(`${XSD_NAMESPACE}integer`);

/**
 * `xsd:double`
 *
 * **Example** (Inspect double NamedNode)
 *
 * ```ts
 * import { XSD_DOUBLE } from "@beep/rdf/Vocab/Xsd"
 *
 * console.log(XSD_DOUBLE.value) // "http://www.w3.org/2001/XMLSchema#double"
 * console.log(XSD_DOUBLE.termType) // "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const XSD_DOUBLE = makeNamedNode(`${XSD_NAMESPACE}double`);
