/**
 * VoID vocabulary helpers, built from the `void` namespace of the identity
 * registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeNamedNode } from "../Rdf.ts";
import { VOID_NAMESPACE } from "./generated/Void.terms.ts";
import type { VOID_TERMS } from "./generated/Void.terms.ts";

/**
 * VoID namespace IRI and its registered term locals, read from the identity registry.
 *
 * **Example** (Read the VoID namespace)
 *
 * ```ts import.meta.vitest name="Read the VoID namespace"
 * import { VOID_NAMESPACE } from "@beep/rdf/Vocab/Void"
 *
 * VOID_NAMESPACE // => "http://rdfs.org/ns/void#"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export { VOID_NAMESPACE, VOID_TERMS } from "./generated/Void.terms.ts";

const voidTerm = (local: (typeof VOID_TERMS)[number]) => makeNamedNode(`${VOID_NAMESPACE}${local}`);

/**
 * `void:Dataset`
 *
 * **Example** (Inspect Dataset NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect Dataset NamedNode"
 * import { VOID_DATASET } from "@beep/rdf/Vocab/Void"
 *
 * VOID_DATASET.value // => "http://rdfs.org/ns/void#Dataset"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VOID_DATASET = voidTerm("Dataset");

/**
 * `void:triples`
 *
 * **Example** (Inspect triples NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect triples NamedNode"
 * import { VOID_TRIPLES } from "@beep/rdf/Vocab/Void"
 *
 * VOID_TRIPLES.value // => "http://rdfs.org/ns/void#triples"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VOID_TRIPLES = voidTerm("triples");
