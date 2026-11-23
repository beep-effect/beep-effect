/**
 * Web Annotation vocabulary helpers, built from the pinned `oa` namespace of
 * the identity registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeNamedNode } from "../Rdf.ts";
import { OA_NAMESPACE } from "./generated/Oa.terms.ts";
import type { OA_TERMS } from "./generated/Oa.terms.ts";

/**
 * OA namespace IRI and its registered term locals, read from the identity registry.
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
export { OA_NAMESPACE, OA_TERMS } from "./generated/Oa.terms.ts";

const oaTerm = (local: (typeof OA_TERMS)[number]) => makeNamedNode(`${OA_NAMESPACE}${local}`);

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
export const OA_ANNOTATION = oaTerm("Annotation");

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
export const OA_HAS_TARGET = oaTerm("hasTarget");

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
export const OA_HAS_SELECTOR = oaTerm("hasSelector");
