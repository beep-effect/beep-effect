/**
 * Package entry point for `@beep/ontology`.
 *
 * @since 0.0.0
 */

/**
 * Assembly walk and fold entrypoint for the identity-backed ontology fold.
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./Fold.assembly.ts";
/**
 * Pure Markdown projection over assembled ontologies.
 *
 * @category projections
 * @since 0.0.0
 */
export * from "./Fold.markdown.ts";
/**
 * Schema-first models for the ontology fold.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Fold.models.ts";
/**
 * Pure JSON-LD, context, and Turtle projections over assembled ontologies.
 *
 * @category projections
 * @since 0.0.0
 */
export * from "./Fold.projections.ts";
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
