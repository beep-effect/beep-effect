/**
 * Domain-safe RDF and linked-data value models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Package version.
 *
 * **Example** (Check package version)
 *
 * ```ts import.meta.vitest name="Check package version"
 * import { VERSION } from "@beep/rdf"
 *
 * const isInitialVersion = VERSION === "0.0.0"
 * isInitialVersion // => true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

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
 * Effect Schema annotation helpers for RDF metadata.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./SemanticSchemaMetadata.ts";
/**
 * URI schema and branded URI helpers.
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./Uri.ts";
