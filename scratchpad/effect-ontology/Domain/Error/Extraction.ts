/**
 * Schema-backed entity and relation extraction failures.
 *
 * **Details**
 *
 * * Diagnostic text and partial payloads normalize absence to `Option`. Raw
 * validation payloads use `Schema.Json`, keeping errors serializable and
 * suitable for structured logging.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ErrorMessage, OptionalErrorCause, OptionalErrorMessage, OptionalNonNegativeInt } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Extraction");

const OptionalExtractionJson = S.OptionFromNullishOr(S.Json)
  .pipe(SchemaUtils.withNoneDefault)
  .annotate({
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(S.Json)(fc).map(O.some)),
        terminal: none,
      };
    },
  })
  .pipe(
    $I.annoteSchema("OptionalExtractionJson", {
      description: "Optional serializable extraction payload normalized to an Effect Option.",
    })
  );

const ExtractionJsonArrayDefinition = S.Json.pipe(S.Array);

const ExtractionJsonArray = ExtractionJsonArrayDefinition.annotate({
  toArbitrary: () => S.toArbitrary(ExtractionJsonArrayDefinition),
}).pipe(
  $I.annoteSchema("ExtractionJsonArray", {
    description: "Readonly collection of serializable partial extraction payloads.",
  })
);

const OptionalExtractionJsonArray = S.OptionFromNullishOr(ExtractionJsonArray)
  .pipe(SchemaUtils.withNoneDefault)
  .annotate({
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(ExtractionJsonArray)(fc).map(O.some)),
        terminal: none,
      };
    },
  })
  .pipe(
    $I.annoteSchema("OptionalExtractionJsonArray", {
      description: "Optional collection of partial extraction payloads normalized to an Effect Option.",
    })
  );

const extractionFields = {
  message: ErrorMessage.annotateKey({
    description: "Human-readable extraction diagnostic.",
  }),
  cause: OptionalErrorCause.annotateKey({
    description: "Optional extraction engine defect.",
  }),
  text: OptionalErrorMessage.annotateKey({
    description: "Optional source-text excerpt, normalized to Option.",
  }),
};

/**
 * General extraction-process failure.
 *
 * **Example** (Use ExtractionError)
 * ```ts
 * import { ExtractionError } from "@effect-ontology/Error/Extraction"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ExtractionError)({
 *   _tag: "ExtractionError", message: "Extraction failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExtractionError extends S.TaggedError<ExtractionError>($I`ExtractionError`)(
  "ExtractionError",
  extractionFields,
  $I.annote("ExtractionError", {
    description: "General extraction-process failure.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * Failure to extract mention spans from source text.
 *
 * **Example** (Use MentionExtractionFailed)
 * ```ts
 * import { MentionExtractionFailed } from "@effect-ontology/Error/Extraction"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(MentionExtractionFailed)({
 *   _tag: "MentionExtractionFailed", message: "Mention extraction failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MentionExtractionFailed extends S.TaggedError<MentionExtractionFailed>($I`MentionExtractionFailed`)(
  "MentionExtractionFailed",
  extractionFields,
  $I.annote("MentionExtractionFailed", {
    description: "Failure to extract mention spans from source text.",
  })
) {}

/**
 * Failure to extract entities from source text.
 *
 * **Example** (Use EntityExtractionFailed)
 * ```ts
 * import { EntityExtractionFailed } from "@effect-ontology/Error/Extraction"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(EntityExtractionFailed)({
 *   _tag: "EntityExtractionFailed", message: "Entity extraction failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EntityExtractionFailed extends S.TaggedError<EntityExtractionFailed>($I`EntityExtractionFailed`)(
  "EntityExtractionFailed",
  extractionFields,
  $I.annote("EntityExtractionFailed", {
    description: "Failure to extract entities from source text.",
  })
) {}

/**
 * Failure to extract relations, optionally retaining partial entities.
 *
 * **Example** (Use RelationExtractionFailed)
 * ```ts
 * import { RelationExtractionFailed } from "@effect-ontology/Error/Extraction"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(RelationExtractionFailed)({
 *   _tag: "RelationExtractionFailed", message: "Relation extraction failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RelationExtractionFailed extends S.TaggedError<RelationExtractionFailed>($I`RelationExtractionFailed`)(
  "RelationExtractionFailed",
  {
    ...extractionFields,
    entities: OptionalExtractionJsonArray.annotateKey({
      description: "Optional serializable partial entities retained for diagnostics.",
    }),
  },
  $I.annote("RelationExtractionFailed", {
    description: "Failure to extract relations, optionally retaining partial entities.",
  })
) {}

/**
 * Failure to derive the structured-output schema used by extraction.
 *
 * **Example** (Use SchemaGenerationFailed)
 * ```ts
 * import { SchemaGenerationFailed } from "@effect-ontology/Error/Extraction"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(SchemaGenerationFailed)({
 *   _tag: "SchemaGenerationFailed", message: "Schema generation failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SchemaGenerationFailed extends S.TaggedError<SchemaGenerationFailed>($I`SchemaGenerationFailed`)(
  "SchemaGenerationFailed",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable schema-generation diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional schema generator defect.",
    }),
  },
  $I.annote("SchemaGenerationFailed", {
    description: "Failure to derive the structured-output schema used by extraction.",
  })
) {}

/**
 * Failure to validate a structured extraction payload.
 *
 * **Example** (Use ValidationFailed)
 * ```ts
 * import { ValidationFailed } from "@effect-ontology/Error/Extraction"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ValidationFailed)({
 *   _tag: "ValidationFailed", message: "Payload validation failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ValidationFailed extends S.TaggedError<ValidationFailed>($I`ValidationFailed`)(
  "ValidationFailed",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable payload-validation diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional schema decoder defect.",
    }),
    data: OptionalExtractionJson.annotateKey({
      description: "Optional serializable invalid payload, normalized to Option.",
    }),
  },
  $I.annote("ValidationFailed", {
    description: "Failure to validate a structured extraction payload.",
  })
) {}

/**
 * Non-fatal per-row entity validation failure.
 *
 * **Details**
 *
 * * The raw entity is restricted to JSON so this diagnostic remains serializable.
 *
 * **Example** (Use EntityValidationFailed)
 * ```ts
 * import { EntityValidationFailed } from "@effect-ontology/Error/Extraction"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(EntityValidationFailed)({
 *   _tag: "EntityValidationFailed",
 *   reason: "Entity type is missing.",
 *   entityData: { label: "Alice" }
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EntityValidationFailed extends S.TaggedError<EntityValidationFailed>($I`EntityValidationFailed`)(
  "EntityValidationFailed",
  {
    reason: ErrorMessage.annotateKey({
      description: "Stable explanation of the entity validation failure.",
    }),
    entityData: S.Json.annotateKey({
      description: "Serializable entity payload that failed validation.",
    }),
    chunkIndex: OptionalNonNegativeInt.annotateKey({
      description: "Optional zero-based extraction chunk index, normalized to Option.",
    }),
  },
  $I.annote("EntityValidationFailed", {
    description: "Non-fatal per-row entity validation failure.",
  })
) {}

/**
 * Non-fatal per-row relation validation failure.
 *
 * **Details**
 *
 * * The raw relation is restricted to JSON so this diagnostic remains serializable.
 *
 * **Example** (Use RelationValidationFailed)
 * ```ts
 * import { RelationValidationFailed } from "@effect-ontology/Error/Extraction"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(RelationValidationFailed)({
 *   _tag: "RelationValidationFailed",
 *   reason: "Relation target is missing.",
 *   relationData: { predicate: "knows" }
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RelationValidationFailed extends S.TaggedError<RelationValidationFailed>($I`RelationValidationFailed`)(
  "RelationValidationFailed",
  {
    reason: ErrorMessage.annotateKey({
      description: "Stable explanation of the relation validation failure.",
    }),
    relationData: S.Json.annotateKey({
      description: "Serializable relation payload that failed validation.",
    }),
    chunkIndex: OptionalNonNegativeInt.annotateKey({
      description: "Optional zero-based extraction chunk index, normalized to Option.",
    }),
  },
  $I.annote("RelationValidationFailed", {
    description: "Non-fatal per-row relation validation failure.",
  })
) {}

const AnyExtractionErrorDefinition = S.Union([
  ExtractionError,
  MentionExtractionFailed,
  EntityExtractionFailed,
  RelationExtractionFailed,
  SchemaGenerationFailed,
  ValidationFailed,
  EntityValidationFailed,
  RelationValidationFailed,
]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of extraction and row-validation failures.
 *
 * **Example** (Use AnyExtractionError)
 * ```ts
 * import { AnyExtractionError, ExtractionError } from "@effect-ontology/Error/Extraction"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ExtractionError)({
 *   _tag: "ExtractionError", message: "Failed." })
 * console.log(AnyExtractionError.guards.ExtractionError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AnyExtractionError = AnyExtractionErrorDefinition.pipe(
  $I.annoteSchema("AnyExtractionError", {
    description: "Exhaustive tagged union of extraction and row-validation failures.",
    toArbitrary: () => S.toArbitrary(AnyExtractionErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link AnyExtractionError}.
 *
 * **Example** (Use AnyExtractionError)
 * ```ts
 * import { ExtractionError, type AnyExtractionError } from "@effect-ontology/Error/Extraction"
 * const error: AnyExtractionError = ExtractionError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyExtractionError = typeof AnyExtractionError.Type;
