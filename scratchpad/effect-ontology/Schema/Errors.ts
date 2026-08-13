/**
 * Schema Factory Errors
 *
 * Error types used by schema factories.
 *
 * @module Schema/Errors
 * @since 2.0.0
 */

import * as S from "effect/Schema";

/**
 * Error thrown when attempting to create a schema with empty vocabularies
 *
 * @category errors
 * @since 2.0.0
 */
export class EmptyVocabularyError extends S.TaggedError<EmptyVocabularyError>()("EmptyVocabularyError", {
  message: S.String.annotate({
    title: "Error Message",
    description: "Human-readable error description",
  }),

  type: S.Literals(["classes", "properties"]).annotate({
    title: "Vocabulary Type",
    description: "Type of vocabulary that was empty",
  }),
}) {}
