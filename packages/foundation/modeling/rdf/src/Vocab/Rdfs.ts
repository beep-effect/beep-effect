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
 * @example
 * ```ts
 * import { RDFS_LABEL } from "@beep/rdf/Vocab/Rdfs"
 *
 * console.log(RDFS_LABEL.value) // "http://www.w3.org/2000/01/rdf-schema#label"
 * console.log(RDFS_LABEL.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const RDFS_LABEL = makeNamedNode(`${RDFS_NAMESPACE}label`);

/**
 * `rdfs:comment`
 *
 * @example
 * ```ts
 * import { RDFS_COMMENT } from "@beep/rdf/Vocab/Rdfs"
 *
 * console.log(RDFS_COMMENT.value) // "http://www.w3.org/2000/01/rdf-schema#comment"
 * console.log(RDFS_COMMENT.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const RDFS_COMMENT = makeNamedNode(`${RDFS_NAMESPACE}comment`);

/**
 * `rdfs:Class`
 *
 * @example
 * ```ts
 * import { RDFS_CLASS } from "@beep/rdf/Vocab/Rdfs"
 *
 * console.log(RDFS_CLASS.value) // "http://www.w3.org/2000/01/rdf-schema#Class"
 * console.log(RDFS_CLASS.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const RDFS_CLASS = makeNamedNode(`${RDFS_NAMESPACE}Class`);
