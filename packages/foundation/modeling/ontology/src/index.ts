/**
 * Package entry point for `@beep/ontology`.
 *
 * @since 0.0.0
 */

/**
 * @since 0.0.0
 * @category configuration
 */
export * as Ontology from "./Ontology.models.ts";
/**
 * Intake-serving semantic-foundation models and services.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./SemanticFoundation.models.ts";
/**
 * Committed repository-owned taxonomy seed.
 *
 * @category constants
 * @since 0.0.0
 */
export * from "./SemanticFoundation.seed.ts";
/**
 * Fail-closed taxonomy manifest loader.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./TaxonomyLoader.ts";
/**
 * Pure registry-backed librarian projections.
 *
 * @category workflows
 * @since 0.0.0
 */
export * from "./TaxonomyRegistry.ts";
