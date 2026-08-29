/**
 * Type-level ontology of text-processing categories.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * The 11-stratum text-kind ontology, typed-text payloads, smart constructors,
 * and the containment poset.
 *
 * **Example** (Checking kind containment)
 *
 * ```ts import.meta.vitest name="Checking kind containment"
 * import { Kind } from "@beep/nlp/Ontology"
 *
 * Kind.canContain("Document", "Sentence") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * as Kind from "./Kind.ts";
