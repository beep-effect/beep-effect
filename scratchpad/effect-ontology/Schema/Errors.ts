/**
 * Schema Factory Errors
 *
 * Error types used by schema factories.
 *
 * @module Schema/Errors
 * @since 2.0.0
 */

import { Schema } from "effect"

/**
 * Error thrown when attempting to create a schema with empty vocabularies
 *
 * @category errors
 * @since 2.0.0
 */
export class EmptyVocabularyError extends Schema.TaggedError<EmptyVocabularyError>()(
  "EmptyVocabularyError",
  {
    message: Schema.String.annotate({
      title: "Error Message",
      description: "Human-readable error description"
    }),

    type: Schema.Literals(["classes", "properties"]).annotate({
      title: "Vocabulary Type",
      description: "Type of vocabulary that was empty"
    })
  }
) {}
