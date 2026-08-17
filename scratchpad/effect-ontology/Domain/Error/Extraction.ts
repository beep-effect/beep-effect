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
import {
  ErrorMessage,
  makeOntologyErrorClass,
  OptionalErrorCause,
  OptionalErrorMessage,
  OptionalNonNegativeInt,
} from "./Base.ts";

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
 * import { ExtractionError } from "@effect-ontology/Error/Extraction.ts"
 *
 * const error = ExtractionError.make({ message: "Extraction failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ExtractionError = makeOntologyErrorClass
  .make(
    $I`ExtractionError`,
    "ExtractionError",
    extractionFields,
    $I.annote("ExtractionError", {
      description: "General extraction-process failure.",
    })
  )
  .pipe(SchemaUtils.withStatics((schema) => ({ is: S.is(schema) })));

/** Runtime value decoded by {@link ExtractionError}.
 * **Example** (Use ExtractionError)
 * ```ts
 * import { ExtractionError, type ExtractionError as Failure } from "@effect-ontology/Error/Extraction.ts"
 * const error: Failure = ExtractionError.make({ message: "Failed." })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionError = typeof ExtractionError.Type;

/**
 * Failure to extract mention spans from source text.
 *
 * **Example** (Use MentionExtractionFailed)
 * ```ts
 * import { MentionExtractionFailed } from "@effect-ontology/Error/Extraction.ts"
 *
 * const error = MentionExtractionFailed.make({ message: "Mention extraction failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const MentionExtractionFailed = makeOntologyErrorClass.make(
  $I`MentionExtractionFailed`,
  "MentionExtractionFailed",
  extractionFields,
  $I.annote("MentionExtractionFailed", {
    description: "Failure to extract mention spans from source text.",
  })
);

/** Runtime value decoded by {@link MentionExtractionFailed}.
 * **Example** (Use MentionExtractionFailed)
 * ```ts
 * import { MentionExtractionFailed, type MentionExtractionFailed as Failure } from "@effect-ontology/Error/Extraction.ts"
 * const error: Failure = MentionExtractionFailed.make({ message: "Failed." })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type MentionExtractionFailed = typeof MentionExtractionFailed.Type;

/**
 * Failure to extract entities from source text.
 *
 * **Example** (Use EntityExtractionFailed)
 * ```ts
 * import { EntityExtractionFailed } from "@effect-ontology/Error/Extraction.ts"
 *
 * const error = EntityExtractionFailed.make({ message: "Entity extraction failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const EntityExtractionFailed = makeOntologyErrorClass.make(
  $I`EntityExtractionFailed`,
  "EntityExtractionFailed",
  extractionFields,
  $I.annote("EntityExtractionFailed", {
    description: "Failure to extract entities from source text.",
  })
);

/** Runtime value decoded by {@link EntityExtractionFailed}.
 * **Example** (Use EntityExtractionFailed)
 * ```ts
 * import { EntityExtractionFailed, type EntityExtractionFailed as Failure } from "@effect-ontology/Error/Extraction.ts"
 * const error: Failure = EntityExtractionFailed.make({ message: "Failed." })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type EntityExtractionFailed = typeof EntityExtractionFailed.Type;

/**
 * Failure to extract relations, optionally retaining partial entities.
 *
 * **Example** (Use RelationExtractionFailed)
 * ```ts
 * import { RelationExtractionFailed } from "@effect-ontology/Error/Extraction.ts"
 *
 * const error = RelationExtractionFailed.make({ message: "Relation extraction failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const RelationExtractionFailed = makeOntologyErrorClass.make(
  $I`RelationExtractionFailed`,
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
);

/** Runtime value decoded by {@link RelationExtractionFailed}.
 * **Example** (Use RelationExtractionFailed)
 * ```ts
 * import { RelationExtractionFailed, type RelationExtractionFailed as Failure } from "@effect-ontology/Error/Extraction.ts"
 * const error: Failure = RelationExtractionFailed.make({ message: "Failed." })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type RelationExtractionFailed = typeof RelationExtractionFailed.Type;

/**
 * Failure to derive the structured-output schema used by extraction.
 *
 * **Example** (Use SchemaGenerationFailed)
 * ```ts
 * import { SchemaGenerationFailed } from "@effect-ontology/Error/Extraction.ts"
 *
 * const error = SchemaGenerationFailed.make({ message: "Schema generation failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SchemaGenerationFailed = makeOntologyErrorClass.make(
  $I`SchemaGenerationFailed`,
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
);

/** Runtime value decoded by {@link SchemaGenerationFailed}.
 * **Example** (Use SchemaGenerationFailed)
 * ```ts
 * import { SchemaGenerationFailed, type SchemaGenerationFailed as Failure } from "@effect-ontology/Error/Extraction.ts"
 * const error: Failure = SchemaGenerationFailed.make({ message: "Failed." })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type SchemaGenerationFailed = typeof SchemaGenerationFailed.Type;

/**
 * Failure to validate a structured extraction payload.
 *
 * **Example** (Use ValidationFailed)
 * ```ts
 * import { ValidationFailed } from "@effect-ontology/Error/Extraction.ts"
 *
 * const error = ValidationFailed.make({ message: "Payload validation failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ValidationFailed = makeOntologyErrorClass.make(
  $I`ValidationFailed`,
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
);

/** Runtime value decoded by {@link ValidationFailed}.
 * **Example** (Use ValidationFailed)
 * ```ts
 * import { ValidationFailed, type ValidationFailed as Failure } from "@effect-ontology/Error/Extraction.ts"
 * const error: Failure = ValidationFailed.make({ message: "Invalid." })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ValidationFailed = typeof ValidationFailed.Type;

/**
 * Non-fatal per-row entity validation failure.
 *
 * **Details**
 *
 * * The raw entity is restricted to JSON so this diagnostic remains serializable.
 *
 * **Example** (Use EntityValidationFailed)
 * ```ts
 * import { EntityValidationFailed } from "@effect-ontology/Error/Extraction.ts"
 *
 * const error = EntityValidationFailed.make({
 *   reason: "Entity type is missing.",
 *   entityData: { label: "Alice" }
 * })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const EntityValidationFailed = makeOntologyErrorClass.make(
  $I`EntityValidationFailed`,
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
);

/** Runtime value decoded by {@link EntityValidationFailed}.
 * **Example** (Use EntityValidationFailed)
 * ```ts
 * import { EntityValidationFailed, type EntityValidationFailed as Failure } from "@effect-ontology/Error/Extraction.ts"
 * const error: Failure = EntityValidationFailed.make({ reason: "Invalid.", entityData: null })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type EntityValidationFailed = typeof EntityValidationFailed.Type;

/**
 * Non-fatal per-row relation validation failure.
 *
 * **Details**
 *
 * * The raw relation is restricted to JSON so this diagnostic remains serializable.
 *
 * **Example** (Use RelationValidationFailed)
 * ```ts
 * import { RelationValidationFailed } from "@effect-ontology/Error/Extraction.ts"
 *
 * const error = RelationValidationFailed.make({
 *   reason: "Relation target is missing.",
 *   relationData: { predicate: "knows" }
 * })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const RelationValidationFailed = makeOntologyErrorClass.make(
  $I`RelationValidationFailed`,
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
);

/** Runtime value decoded by {@link RelationValidationFailed}.
 * **Example** (Use RelationValidationFailed)
 * ```ts
 * import { RelationValidationFailed, type RelationValidationFailed as Failure } from "@effect-ontology/Error/Extraction.ts"
 * const error: Failure = RelationValidationFailed.make({ reason: "Invalid.", relationData: null })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type RelationValidationFailed = typeof RelationValidationFailed.Type;

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
 * import { AnyExtractionError, ExtractionError } from "@effect-ontology/Error/Extraction.ts"
 *
 * const error = ExtractionError.make({ message: "Failed." })
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
 * import { ExtractionError, type AnyExtractionError } from "@effect-ontology/Error/Extraction.ts"
 * const error: AnyExtractionError = ExtractionError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyExtractionError = typeof AnyExtractionError.Type;
