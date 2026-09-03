/**
 * Domain-safe RDF and linked-data value models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Web Annotation value models.
 *
 * @category models
 * @since 0.0.0
 */
export * as WebAnnotation from "./Adapters/WebAnnotation.ts";
/**
 * RDF-facing evidence selector and target models.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Evidence.ts";
/**
 * IRI schema and branded IRI helpers.
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./Iri.ts";
/**
 * JSON-LD schema models.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./JsonLd.ts";
/**
 * PROV value models.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Prov.ts";
/**
 * Pure PROV-O to RDF dataset codecs.
 *
 * @category codecs
 * @since 0.0.0
 */
export * from "./ProvRdf.ts";
/**
 * RDF/JS schema models.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Rdf.ts";
/**
 * RDF projection adapters for shared conformance metadata.
 *
 * @category projections
 * @since 0.0.0
 */
export * from "./SemanticSchemaConformance.ts";
/**
 * Effect Schema annotation helpers for RDF metadata.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./SemanticSchemaMetadata/index.ts";
/**
 * URI schema and branded URI helpers.
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./Uri.ts";
/**
 * Current `@beep/rdf` package version.
 *
 * @category configuration
 * @since 0.0.0
 */
export { VERSION } from "./Version.ts";
