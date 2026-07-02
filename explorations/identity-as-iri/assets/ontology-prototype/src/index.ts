/**
 * Schema-backed ontology authoring for Effect Schema models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Package version.
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Ontology authoring scope factory.
 *
 * @category constructors
 * @since 0.0.0
 */
export { Ontology } from "./create.ts";
/**
 * Annotation display-map readers and draft guards.
 *
 * @category utilities
 * @since 0.0.0
 */
export {
  getOntologyKeyMetadata,
  getOntologyMetadata,
  isOntologyClassAnnotationDraft,
  isOntologyPredicateAnnotationDraft,
  OntologyAssemblyError,
} from "./model.ts";
/**
 * JSON-LD projection helpers.
 *
 * @category projections
 * @since 0.0.0
 */
export { parseJsonLdOntology, projectJsonLdContext, projectJsonLdOntology } from "./projections/jsonld.ts";
/**
 * Markdown documentation projection helper.
 *
 * @category projections
 * @since 0.0.0
 */
export { projectMarkdown } from "./projections/markdown.ts";
/**
 * Turtle projection helper.
 *
 * @category projections
 * @since 0.0.0
 */
export { projectTurtle } from "./projections/turtle.ts";
