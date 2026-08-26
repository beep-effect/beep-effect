/**
 * Handoff - the product-neutral generic graph IR emitted for downstream consumers.
 *
 * The versioned handoff contract (chunks, mentions, entities, relations with
 * spans + PROV-O provenance) that `@beep/nlp` produces and the
 * `ip-law-knowledge-graph` initiative (and other consumers) decode.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Numeric value between 0 and 1 inclusive, shared by handoff confidence fields.
 *
 * **Example** (Log UnitInterval value)
 *
 * ```ts
 * import { UnitInterval } from "@beep/nlp/Handoff"
 *
 * console.log(UnitInterval)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export { UnitInterval } from "@beep/schema/UnitInterval";
/**
 * The generic IR handoff contract schemas (Span/Provenance/TextChunk/Mention/
 * Entity/Relation/AnnotatedDocument + branded ids).
 *
 * **Example** (Log AnnotatedDocument schema)
 *
 * ```ts
 * import { Contract } from "@beep/nlp/Handoff"
 *
 * console.log(Contract.AnnotatedDocument)
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * as Contract from "./Contract.ts";
