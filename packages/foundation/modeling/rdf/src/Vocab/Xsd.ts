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
 * ```ts import.meta.vitest name="Build string datatype IRI"
 * import { XSD_NAMESPACE } from "@beep/rdf/Vocab/Xsd"
 *
 * const stringDatatypeIri = `${XSD_NAMESPACE}string`
 * stringDatatypeIri // => "http://www.w3.org/2001/XMLSchema#string"
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
 * ```ts import.meta.vitest name="Inspect string NamedNode"
 * import { XSD_STRING } from "@beep/rdf/Vocab/Xsd"
 *
 * XSD_STRING.value // => "http://www.w3.org/2001/XMLSchema#string"
 * XSD_STRING.termType // => "NamedNode"
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
 * ```ts import.meta.vitest name="Inspect anyURI NamedNode"
 * import { XSD_ANY_URI } from "@beep/rdf/Vocab/Xsd"
 *
 * XSD_ANY_URI.value // => "http://www.w3.org/2001/XMLSchema#anyURI"
 * XSD_ANY_URI.termType // => "NamedNode"
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
 * ```ts import.meta.vitest name="Inspect boolean NamedNode"
 * import { XSD_BOOLEAN } from "@beep/rdf/Vocab/Xsd"
 *
 * XSD_BOOLEAN.value // => "http://www.w3.org/2001/XMLSchema#boolean"
 * XSD_BOOLEAN.termType // => "NamedNode"
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
 * ```ts import.meta.vitest name="Inspect integer NamedNode"
 * import { XSD_INTEGER } from "@beep/rdf/Vocab/Xsd"
 *
 * XSD_INTEGER.value // => "http://www.w3.org/2001/XMLSchema#integer"
 * XSD_INTEGER.termType // => "NamedNode"
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
 * ```ts import.meta.vitest name="Inspect double NamedNode"
 * import { XSD_DOUBLE } from "@beep/rdf/Vocab/Xsd"
 *
 * XSD_DOUBLE.value // => "http://www.w3.org/2001/XMLSchema#double"
 * XSD_DOUBLE.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const XSD_DOUBLE = makeNamedNode(`${XSD_NAMESPACE}double`);

/**
 * `xsd:dateTime`.
 *
 * **Example** (Inspect date-time NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect date-time NamedNode"
 * import { XSD_DATE_TIME } from "@beep/rdf/Vocab/Xsd"
 *
 * XSD_DATE_TIME.value // => "http://www.w3.org/2001/XMLSchema#dateTime"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const XSD_DATE_TIME = makeNamedNode(`${XSD_NAMESPACE}dateTime`);
