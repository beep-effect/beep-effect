/**
 * Canonical RDF/JS terms and ontology vocabulary constants.
 *
 * @remarks
 * Types are owned by `@beep/rdf`; this experiment adds only its graph-free
 * triple adapter and effect-ontology-specific vocabularies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Experiment-owned RDF vocabulary constants.
 *
 * @example
 * ```ts
 * import { CLAIMS } from "@effect-ontology/Rdf/index.ts"
 * console.log(CLAIMS.Claim.value)
 * ```
 *
 * @category rdf
 * @since 0.0.0
 */
export * from "./Constants.ts";
/**
 * Graph-free RDF statement adapter.
 *
 * @example
 * ```ts
 * import { Triple } from "@effect-ontology/Rdf/index.ts"
 * console.log(Triple)
 * ```
 *
 * @category rdf
 * @since 0.0.0
 */
export * from "./Types.ts";
