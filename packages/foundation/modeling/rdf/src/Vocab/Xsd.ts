/**
 * XSD vocabulary helpers, built from the pinned `xsd` namespace of the
 * identity registry (the RDF-compatible XSD datatypes of RDF 1.1 Concepts).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeNamedNode } from "../Rdf.ts";
import { XSD_NAMESPACE } from "./generated/Xsd.terms.ts";
import type { XSD_TERMS } from "./generated/Xsd.terms.ts";

/**
 * XSD namespace IRI and its registered datatype locals, read from the identity registry.
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
 * @see {@link https://www.w3.org/2001/XMLSchema#} W3C XML Schema namespace document.
 * @category configuration
 * @since 0.0.0
 */
export { XSD_NAMESPACE, XSD_TERMS } from "./generated/Xsd.terms.ts";

const xsdTerm = (local: (typeof XSD_TERMS)[number]) => makeNamedNode(`${XSD_NAMESPACE}${local}`);

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
export const XSD_STRING = xsdTerm("string");

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
export const XSD_ANY_URI = xsdTerm("anyURI");

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
export const XSD_BOOLEAN = xsdTerm("boolean");

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
export const XSD_INTEGER = xsdTerm("integer");

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
export const XSD_DOUBLE = xsdTerm("double");

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
export const XSD_DATE_TIME = xsdTerm("dateTime");
