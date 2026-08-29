/**
 * RDFS vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { makeNamedNode } from "../Rdf.ts";
import { RDFS_NAMESPACE } from "./generated/Rdfs.terms.ts";

/**
 * Generated namespace IRI and term inventory for this vocabulary.
 *
 * Single-sourced from the `@beep/identity` `CoreVocab` registry via
 * `bun run beep sync-data-to-ts --target vocab-terms`.
 *
 * @category constants
 * @since 0.0.0
 */
export { RDFS_NAMESPACE, RDFS_TERMS } from "./generated/Rdfs.terms.ts";

/**
 * `rdfs:label`
 *
 * **Example** (Inspect RDFS_LABEL NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect RDFS_LABEL NamedNode"
 * import { RDFS_LABEL } from "@beep/rdf/Vocab/Rdfs"
 *
 * RDFS_LABEL.value // => "http://www.w3.org/2000/01/rdf-schema#label"
 * RDFS_LABEL.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RDFS_LABEL = makeNamedNode(`${RDFS_NAMESPACE}label`);

/**
 * `rdfs:comment`
 *
 * **Example** (Inspect RDFS_COMMENT NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect RDFS_COMMENT NamedNode"
 * import { RDFS_COMMENT } from "@beep/rdf/Vocab/Rdfs"
 *
 * RDFS_COMMENT.value // => "http://www.w3.org/2000/01/rdf-schema#comment"
 * RDFS_COMMENT.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RDFS_COMMENT = makeNamedNode(`${RDFS_NAMESPACE}comment`);

/**
 * `rdfs:Class`
 *
 * **Example** (Inspect RDFS_CLASS NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect RDFS_CLASS NamedNode"
 * import { RDFS_CLASS } from "@beep/rdf/Vocab/Rdfs"
 *
 * RDFS_CLASS.value // => "http://www.w3.org/2000/01/rdf-schema#Class"
 * RDFS_CLASS.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RDFS_CLASS = makeNamedNode(`${RDFS_NAMESPACE}Class`);
