/**
 * Schema Module
 *
 * Dynamic Effect Schema generation from ontology vocabularies with JSON Schema export
 * for LLM tool calling APIs.
 *
 * @module Schema
 * @since 2.0.0
 */

export { type EntityGraphSchema, type EntityGraphType, makeEntitySchema } from "./EntityFactory.ts"
export { EmptyVocabularyError } from "./Errors.ts"
export { makeRelationSchema, type RelationGraphSchema, type RelationGraphType } from "./RelationFactory.ts"
