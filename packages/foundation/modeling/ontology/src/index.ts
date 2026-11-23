/**
 * Package entry point for `@beep/ontology`.
 *
 * @since 0.0.0
 */

/**
 * Edition-pinned classification identifiers and immutable SKOS snapshots.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Classification.models.ts";
/**
 * Fail-closed classification loading and hierarchy lookup.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./ClassificationRegistry.ts";
/**
 * Generic SKOS concept schemes, edition pins and the broader profile.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./ConceptScheme.ts";
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
 * The ground RDF dataset projection of an assembled ontology.
 *
 * @category projections
 * @since 0.0.0
 */
export * from "./Fold.projections.ts";
/**
 * gUFO typing of registry terms and the audit of a typed specialization hierarchy.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Gufo.ts";
/**
 * The repository-owned annotation-to-DoCO and NIF mapping set.
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./Mapping.annotation.ts";
/**
 * SKOS mapping predicates and their registry expansion.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Mapping.ts";
/**
 * Fail-closed taxonomy manifest loader.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./TaxonomyLoader.ts";
