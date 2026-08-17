/**
 * Schema Module
 *
 * **Details**
 *
 * Dynamic Effect Schema generation from ontology vocabularies with JSON Schema export
 * for LLM tool calling APIs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export { type EntityGraph, type EntityGraphSchema, makeEntitySchema } from "./EntityFactory.ts";
export { makeRelationSchema, type RelationGraph, type RelationGraphSchema } from "./RelationFactory.ts";
