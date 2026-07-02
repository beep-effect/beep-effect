/**
 * RDFS vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { makeNamedNode } from "../Rdf.ts";

/**
 * RDFS namespace IRI.
 *
 * @example
 * ```ts
 * import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs"
 *
 * const labelIri = `${RDFS_NAMESPACE}label`
 * console.log(labelIri) // "http://www.w3.org/2000/01/rdf-schema#label"
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const RDFS_NAMESPACE = "http://www.w3.org/2000/01/rdf-schema#" as const;

/**
 * Complete RDFS local-name inventory mirrored by `@beep/identity`.
 *
 * @example
 * ```ts
 * import { RDFS_TERMS } from "@beep/rdf/Vocab/Rdfs"
 *
 * console.log(RDFS_TERMS.includes("subClassOf")) // true
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const RDFS_TERMS = [
  "Class",
  "Container",
  "ContainerMembershipProperty",
  "Datatype",
  "Literal",
  "Resource",
  "comment",
  "domain",
  "isDefinedBy",
  "label",
  "member",
  "range",
  "seeAlso",
  "subClassOf",
  "subPropertyOf",
] as const;

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
