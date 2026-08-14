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
 * Canonical RDF/JS terms, datasets, prefix maps, and graph-free triples.
 *
 * @example
 * ```ts
 * import { IRI } from "@effect-ontology/Rdf/index.ts"
 * console.log(IRI.is("https://schema.org/Person")) // true
 * ```
 *
 * @category rdf
 * @since 0.0.0
 */
export * from "./Types.ts";
