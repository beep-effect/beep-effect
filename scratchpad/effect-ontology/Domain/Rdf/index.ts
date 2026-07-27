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
 * Standard and experiment-specific RDF vocabulary constants.
 *
 * @example
 * ```ts
 * import { RDF } from "@effect-ontology/Rdf/index.ts"
 * console.log(RDF.type.value)
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
