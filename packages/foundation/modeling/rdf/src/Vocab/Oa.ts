/**
 * Web Annotation vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { makeNamedNode } from "../Rdf.ts";

/**
 * OA namespace IRI.
 *
 * **Example** (Build Annotation IRI)
 *
 * ```ts import.meta.vitest name="Build Annotation IRI"
 * import { OA_NAMESPACE } from "@beep/rdf/Vocab/Oa"
 *
 * const annotationIri = `${OA_NAMESPACE}Annotation`
 * annotationIri // => "http://www.w3.org/ns/oa#Annotation"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OA_NAMESPACE = "http://www.w3.org/ns/oa#" as const;

/**
 * `oa:Annotation`
 *
 * **Example** (Inspect Annotation NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect Annotation NamedNode"
 * import { OA_ANNOTATION } from "@beep/rdf/Vocab/Oa"
 *
 * OA_ANNOTATION.value // => "http://www.w3.org/ns/oa#Annotation"
 * OA_ANNOTATION.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OA_ANNOTATION = makeNamedNode(`${OA_NAMESPACE}Annotation`);

/**
 * `oa:hasTarget`
 *
 * **Example** (Inspect hasTarget NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect hasTarget NamedNode"
 * import { OA_HAS_TARGET } from "@beep/rdf/Vocab/Oa"
 *
 * OA_HAS_TARGET.value // => "http://www.w3.org/ns/oa#hasTarget"
 * OA_HAS_TARGET.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OA_HAS_TARGET = makeNamedNode(`${OA_NAMESPACE}hasTarget`);

/**
 * `oa:hasSelector`
 *
 * **Example** (Inspect hasSelector NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect hasSelector NamedNode"
 * import { OA_HAS_SELECTOR } from "@beep/rdf/Vocab/Oa"
 *
 * OA_HAS_SELECTOR.value // => "http://www.w3.org/ns/oa#hasSelector"
 * OA_HAS_SELECTOR.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OA_HAS_SELECTOR = makeNamedNode(`${OA_NAMESPACE}hasSelector`);
