/**
 * Canonical RDF/JS terms and ontology vocabulary constants.
 *
 * **Details**
 *
 * * Types are owned by `@beep/rdf`; this experiment adds only its graph-free
 * triple adapter and effect-ontology-specific vocabularies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Experiment-owned RDF vocabulary constants.
 *
 * **Example** (Use index)
 * ```ts
 * import { CLAIMS } from "@effect-ontology/Rdf/index.ts"
 * console.log(CLAIMS.Claim.value)
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * from "./Constants.ts";
/**
 * Graph-free RDF statement adapter.
 *
 * **Example** (Use index)
 * ```ts
 * import { Triple } from "@effect-ontology/Rdf/index.ts"
 * console.log(Triple)
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * from "./Types.ts";
