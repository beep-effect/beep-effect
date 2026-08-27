/**
 * Examples Repository
 *
 * **Details**
 *
 * Effect-native repository for LLM few-shot examples using Drizzle ORM.
 * Provides hybrid retrieval (vector similarity + lexical search) for
 * ontology-scoped examples.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DrizzleError } from "@beep/drizzle";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Context, Effect, Layer, SchemaTransformation } from "effect";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effect-ontology/Repository/Examples");

import { PostgresDrizzle } from "@beep/postgres";
import { and, desc, sql as drizzleSql, eq } from "drizzle-orm";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { SqlClient } from "effect/unstable/sql";
import { formatPgVector, normalizeDrizzleError } from "../Utils/Sql.ts";
import type { LlmExampleRow } from "./schema.ts";
import { LlmExamples, llmExamples } from "./schema.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Non-empty identifier of a stored few-shot example.
 *
 * **Example** (Create ExampleId)
 *
 * ```ts
 * import { ExampleId } from "@effect-ontology/Repository/Examples"
 *
 * console.log(ExampleId.make("example-id-1"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExampleId = S.NonEmptyString.pipe(
  $I.annoteSchema("ExampleId", {
    description: "Non-empty identifier of a stored few-shot example.",
  })
);

/**
 * Runtime value accepted by {@link ExampleId}.
 *
 * **Example** (Use an example identifier)
 *
 * ```ts
 * import type { ExampleId } from "@effect-ontology/Repository/Examples"
 *
 * const id: ExampleId = "example-id-1"
 * console.log(id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExampleId = typeof ExampleId.Type;

/**
 * Closed set of few-shot example tasks stored by the repository.
 *
 * **Example** (Recognize an extraction task)
 *
 * ```ts
 * import { ExampleType } from "@effect-ontology/Repository/Examples"
 *
 * console.log(ExampleType.is.entity_extraction("entity_extraction")) // true
 * console.log(ExampleType.is.entity_extraction("negative")) // false
 * ```
 *
 * @see {@link ExamplesRepository} for retrieval scoped by this task type.
 * @category schemas
 * @since 0.0.0
 */
export const ExampleType = LiteralKit(["entity_extraction", "relation_extraction", "entity_linking", "negative"]).pipe(
  $I.annoteSchema("ExampleType", {
    description: "Closed set of few-shot example tasks stored by the repository.",
  })
);

/**
 * Runtime value accepted by {@link ExampleType}.
 *
 * @see {@link ExampleType} for the closed literal set and guards.
 * @category type-level
 * @since 0.0.0
 */
export type ExampleType = typeof ExampleType.Type;

/**
 * Closed set of provenance sources for few-shot examples.
 *
 * **Example** (Recognize a manual example)
 *
 * ```ts
 * import { ExampleSource } from "@effect-ontology/Repository/Examples"
 *
 * console.log(ExampleSource.is.manual("manual")) // true
 * console.log(ExampleSource.is.manual("validated")) // false
 * ```
 *
 * @see {@link CreateExampleInput} for the creation payload that stores this source.
 * @category schemas
 * @since 0.0.0
 */
export const ExampleSource = LiteralKit(["manual", "validated", "auto_generated"]).pipe(
  $I.annoteSchema("ExampleSource", {
    description: "Closed set of provenance sources for few-shot examples.",
  })
);

/**
 * Runtime value accepted by {@link ExampleSource}.
 *
 * @see {@link ExampleSource} for the closed literal set and guards.
 * @category type-level
 * @since 0.0.0
 */
export type ExampleSource = typeof ExampleSource.Type;

/**
 * A scored example from retrieval
 */
const PromptMessage = S.Struct({
  role: S.String,
  content: S.String,
}).pipe(
  $I.annoteSchema("PromptMessage", {
    description: "One preformatted prompt message stored with an LLM example.",
  })
);

const PromptMessages = PromptMessage.pipe(S.Array);

/**
 * Retrieval hit for a stored few-shot example, including similarity and usage.
 *
 * **Example** (Reject an incomplete scored example)
 *
 * ```ts
 * import { ScoredExample } from "@effect-ontology/Repository/Examples"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ScoredExample)({})) // false
 * ```
 *
 * @see {@link ExamplesRepository} for scored retrieval that produces this payload.
 * @category schemas
 * @since 0.0.0
 */
export const ScoredExample = S.Struct({
  id: S.String,
  ontologyId: S.String,
  exampleType: ExampleType,
  inputText: S.String,
  expectedOutput: S.Record(S.String, S.Unknown),
  promptMessages: PromptMessages.pipe(S.OptionFromNullOr),
  explanation: S.String.pipe(S.OptionFromNullOr),
  isNegative: S.Boolean,
  similarity: S.Finite,
  usageCount: S.Int,
}).pipe(
  $I.annoteSchema("ScoredExample", {
    description: "Decoded retrieval result with database nulls represented as Options.",
  })
);

/**
 * Runtime value decoded by {@link ScoredExample}.
 *
 * @see {@link ScoredExample} for the runtime schema and Option-normalized fields.
 * @category type-level
 * @since 0.0.0
 */
export type ScoredExample = typeof ScoredExample.Type;

/**
 * Validated retrieval count, threshold, optional ontology filters, and
 * negative-example policy.
 *
 * **Example** (Use retrieval defaults)
 *
 * ```ts
 * import { ExampleRetrievalOptions } from "@effect-ontology/Repository/Examples"
 *
 * const options = ExampleRetrievalOptions.make({})
 * console.log(options.k) // 5
 * ```
 *
 * @see {@link ExamplesRepository} for scored retrieval that consumes these options.
 * @category configuration
 * @since 0.0.0
 */
export class ExampleRetrievalOptions extends S.Class<ExampleRetrievalOptions>($I`ExampleRetrievalOptions`)(
  {
    k: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(5))),
    minSimilarity: UnitInterval.pipe(SchemaUtils.withKeyDefaults(UnitInterval.make(0.6))),
    targetClass: S.optionalKey(S.NonEmptyString),
    targetPredicate: S.optionalKey(S.NonEmptyString),
    includeNegatives: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("ExampleRetrievalOptions", {
    description: "Validated retrieval count, threshold, optional ontology filters, and negative-example policy.",
  })
) {}

/**
 * Constructor input accepted by {@link ExampleRetrievalOptions}.
 *
 * @see {@link ExampleRetrievalOptions} for the runtime schema and constructor defaults.
 * @category type-level
 * @since 0.0.0
 */
export type ExampleRetrievalOptionsInput = (typeof ExampleRetrievalOptions)["~type.make.in"];

/**
 * Validated repository input for creating a few-shot example.
 *
 * **Example** (Construct a manual entity-extraction example)
 *
 * ```ts
 * import { CreateExampleInput, ExampleSource, ExampleType } from "@effect-ontology/Repository/Examples"
 *
 * const input = CreateExampleInput.make({
 *   ontologyId: "people",
 *   exampleType: ExampleType.Enum.entity_extraction,
 *   source: ExampleSource.Enum.manual,
 *   inputText: "Ada Lovelace was a mathematician.",
 *   expectedOutput: { mention: "Ada Lovelace" },
 *   embedding: [0.1, 0.2]
 * })
 * console.log(input.isNegative) // false
 * ```
 *
 * @see {@link ExamplesRepository} for the insert method that consumes this payload.
 * @category models
 * @since 0.0.0
 */
export class CreateExampleInput extends S.Class<CreateExampleInput>($I`CreateExampleInput`)(
  {
    ontologyId: S.NonEmptyString,
    exampleType: ExampleType,
    source: ExampleSource.pipe(SchemaUtils.withKeyDefaults(ExampleSource.Enum.manual)),
    inputText: S.NonEmptyString,
    targetClass: S.optionalKey(S.NonEmptyString),
    targetPredicate: S.optionalKey(S.NonEmptyString),
    evidenceText: S.optionalKey(S.NonEmptyString),
    evidenceStartOffset: S.optionalKey(NonNegativeInt),
    evidenceEndOffset: S.optionalKey(NonNegativeInt),
    expectedOutput: S.Record(S.String, S.Unknown),
    promptMessages: S.optionalKey(PromptMessages),
    explanation: S.optionalKey(S.NonEmptyString),
    embedding: S.Array(S.Finite),
    isNegative: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    negativePattern: S.optionalKey(S.NonEmptyString),
    createdBy: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("CreateExampleInput", {
    description: "Validated repository input for creating a few-shot example.",
  })
) {}

/**
 * Constructor input accepted by {@link CreateExampleInput}.
 *
 * @see {@link CreateExampleInput} for the runtime schema and default source.
 * @category type-level
 * @since 0.0.0
 */
export type CreateExampleInputInput = (typeof CreateExampleInput)["~type.make.in"];

const ExampleCounts = S.Record(S.String, S.Int);

const ExampleCountsFromNullable = ExampleCounts.pipe(
  S.NullOr,
  S.decodeTo(
    ExampleCounts,
    SchemaTransformation.transform({
      decode: (counts) => (P.isNull(counts) ? {} : counts),
      encode: (counts) => counts,
    })
  ),
  $I.annoteSchema("ExampleCountsFromNullable", {
    description: "Example counts with a null SQL aggregate decoded to an empty record.",
  })
);

const ExampleStatsSqlRow = S.Struct({
  total: S.Int,
  byType: ExampleCountsFromNullable,
  negativeCount: S.Int,
  avgSuccessRate: S.Finite.pipe(S.NullOr),
}).pipe(
  $I.annoteSchema("ExampleStatsSqlRow", {
    description: "Decoded aggregate statistics for stored LLM examples.",
  })
);

const normalizeDecodedRows = normalizeDrizzleError("decodeRows");
const normalizeQueryError = normalizeDrizzleError("execute");
const LlmExampleRows = S.Tuple([LlmExamples.select]).pipe(SchemaUtils.withEffectCodecStatics);
const ExampleStatsRows = S.Tuple([ExampleStatsSqlRow]).pipe(SchemaUtils.withEffectCodecStatics);

const decodeOneLlmExampleRow = (rows: unknown) => normalizeDecodedRows(LlmExampleRows.decodeUnknownEffect(rows));
const decodeLlmExampleRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(LlmExamples.select.pipe(S.Array, S.mutable))(rows));
const decodeScoredExampleSqlRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(ScoredExample.pipe(S.Array, S.mutable))(rows));
const decodeOneExampleStatsSqlRow = (rows: unknown) => normalizeDecodedRows(ExampleStatsRows.decodeUnknownEffect(rows));

// =============================================================================
// Service
// =============================================================================

type ExamplesRepositoryError = DrizzleError;

interface ExamplesRepositoryShape {
  readonly create: (input: CreateExampleInputInput) => Effect.Effect<LlmExampleRow, ExamplesRepositoryError>;
  readonly getById: (id: ExampleId) => Effect.Effect<O.Option<LlmExampleRow>, ExamplesRepositoryError>;
  readonly findSimilar: {
    (
      ontologyId: string,
      embedding: ReadonlyArray<number>,
      options?: ExampleRetrievalOptionsInput
    ): Effect.Effect<ReadonlyArray<ScoredExample>, ExamplesRepositoryError>;
    (
      embedding: ReadonlyArray<number>,
      options?: ExampleRetrievalOptionsInput
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<ScoredExample>, ExamplesRepositoryError>;
  };
  readonly findNegatives: {
    (
      ontologyId: string,
      queryText: string,
      k?: number
    ): Effect.Effect<ReadonlyArray<ScoredExample>, ExamplesRepositoryError>;
    (
      queryText: string,
      k?: number
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<ScoredExample>, ExamplesRepositoryError>;
  };
  readonly getByType: {
    (
      ontologyId: string,
      exampleType: ExampleType,
      limit?: number
    ): Effect.Effect<ReadonlyArray<LlmExampleRow>, ExamplesRepositoryError>;
    (
      exampleType: ExampleType,
      limit?: number
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<LlmExampleRow>, ExamplesRepositoryError>;
  };
  readonly recordUsage: {
    (id: ExampleId, wasSuccessful: boolean): Effect.Effect<void, ExamplesRepositoryError>;
    (wasSuccessful: boolean): (id: ExampleId) => Effect.Effect<void, ExamplesRepositoryError>;
  };
  readonly deactivate: (id: ExampleId) => Effect.Effect<void, ExamplesRepositoryError>;
  readonly getStats: (ontologyId: string) => Effect.Effect<typeof ExampleStatsSqlRow.Type, ExamplesRepositoryError>;
}

/**
 * Stores and retrieves ontology-scoped few-shot examples with hybrid scoring.
 *
 * **Example** (Read example-store stats)
 *
 * ```ts
 * import { ExamplesRepository } from "@effect-ontology/Repository/Examples"
 * import { Effect } from "effect"
 *
 * const stats = Effect.gen(function* () {
 *   const examples = yield* ExamplesRepository
 *   return yield* examples.getStats("people")
 * })
 * console.log(typeof stats) // "object"
 * ```
 *
 * @see {@link ScoredExample} for the retrieval payload returned by hybrid search.
 * @see {@link ExampleRetrievalOptions} for scored retrieval bounds.
 * @category repositories
 * @since 0.0.0
 */
export class ExamplesRepository extends Context.Service<ExamplesRepository, ExamplesRepositoryShape>()(
  $I`ExamplesRepository`,
  {
    make: Effect.gen(function* () {
      const drizzle = yield* PostgresDrizzle;
      const sql = yield* SqlClient.SqlClient;

      // -------------------------------------------------------------------------
      // Insert Operations
      // -------------------------------------------------------------------------

      /**
       * Create a new example
       */
      const create: ExamplesRepositoryShape["create"] = Effect.fn("ExamplesRepository.create")(function* (
        input: CreateExampleInputInput
      ): Effect.fn.Return<LlmExampleRow, DrizzleError> {
        const resolvedInput = CreateExampleInput.make(input);
        const result = yield* normalizeQueryError(
          drizzle
            .insert(llmExamples)
            .values({
              ontologyId: resolvedInput.ontologyId,
              exampleType: resolvedInput.exampleType,
              source: resolvedInput.source,
              inputText: resolvedInput.inputText,
              targetClass: O.getOrNull(O.fromUndefinedOr(resolvedInput.targetClass)),
              targetPredicate: O.getOrNull(O.fromUndefinedOr(resolvedInput.targetPredicate)),
              evidenceText: O.getOrNull(O.fromUndefinedOr(resolvedInput.evidenceText)),
              evidenceStartOffset: O.getOrNull(O.fromUndefinedOr(resolvedInput.evidenceStartOffset)),
              evidenceEndOffset: O.getOrNull(O.fromUndefinedOr(resolvedInput.evidenceEndOffset)),
              expectedOutput: resolvedInput.expectedOutput,
              promptMessages: O.getOrNull(O.fromUndefinedOr(resolvedInput.promptMessages)),
              explanation: O.getOrNull(O.fromUndefinedOr(resolvedInput.explanation)),
              embedding: formatPgVector(resolvedInput.embedding),
              isNegative: resolvedInput.isNegative,
              negativePattern: O.getOrNull(O.fromUndefinedOr(resolvedInput.negativePattern)),
              createdBy: O.getOrNull(O.fromUndefinedOr(resolvedInput.createdBy)),
            })
            .returning()
        );
        const [row] = yield* decodeOneLlmExampleRow(result);
        return row;
      });

      // -------------------------------------------------------------------------
      // Read Operations
      // -------------------------------------------------------------------------

      /**
       * Get example by ID
       */
      const getById: ExamplesRepositoryShape["getById"] = Effect.fn("ExamplesRepository.getById")(function* (
        id: ExampleId
      ) {
        const rows = yield* normalizeQueryError(
          drizzle.select().from(llmExamples).where(eq(llmExamples.id, id)).limit(1)
        );
        return A.head(yield* decodeLlmExampleRows(rows));
      });

      /**
       * Find similar examples using vector search
       */
      const findSimilar: ExamplesRepositoryShape["findSimilar"] = dual(
        (args) => P.isString(args[0]),
        (ontologyId: string, embedding: ReadonlyArray<number>, options: ExampleRetrievalOptionsInput = {}) =>
          Effect.gen(function* () {
            const { includeNegatives, k, minSimilarity, targetClass, targetPredicate } =
              ExampleRetrievalOptions.make(options);
            const vectorStr = formatPgVector(embedding);

            const conditions = [
              sql`ontology_id = ${ontologyId}`,
              sql`is_active = true`,
              sql`1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}`,
              ...(includeNegatives ? [] : [sql`is_negative = false`]),
              ...(P.isNotUndefined(targetClass) ? [sql`target_class = ${targetClass}`] : []),
              ...(P.isNotUndefined(targetPredicate) ? [sql`target_predicate = ${targetPredicate}`] : []),
            ];
            const results = yield* normalizeQueryError(sql`
          SELECT id,
                 ontology_id as "ontologyId",
                 example_type as "exampleType",
                 input_text as "inputText",
                 expected_output as "expectedOutput",
                 prompt_messages as "promptMessages",
                 explanation,
                 is_negative as "isNegative",
                 COALESCE(usage_count, 0)::int as "usageCount",
                 1 - (embedding <=> ${vectorStr}::vector) as similarity
          FROM llm_examples
          WHERE ${sql.and(conditions)}
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${k}
        `);
            return yield* decodeScoredExampleSqlRows(results);
          })
      );

      /**
       * Find negative examples using lexical search (for pattern matching)
       */
      const findNegatives: ExamplesRepositoryShape["findNegatives"] = dual(
        (args) => P.isString(args[1]),
        (ontologyId: string, queryText: string, k: number = 5) =>
          Effect.gen(function* () {
            // Use trigram similarity for fuzzy matching
            const results = yield* normalizeQueryError(sql`
          SELECT
            id, ontology_id as "ontologyId", example_type as "exampleType",
            input_text as "inputText", expected_output as "expectedOutput",
            prompt_messages as "promptMessages", explanation,
            is_negative as "isNegative", COALESCE(usage_count, 0)::int as "usageCount",
            similarity(input_text, ${queryText}) as similarity
          FROM llm_examples
          WHERE ontology_id = ${ontologyId}
            AND is_active = true
            AND is_negative = true
            AND similarity(input_text, ${queryText}) > 0.1
          ORDER BY similarity(input_text, ${queryText}) DESC
          LIMIT ${k}
        `);
            return yield* decodeScoredExampleSqlRows(results);
          })
      );

      /**
       * Get examples by type for an ontology
       */
      const getByType: ExamplesRepositoryShape["getByType"] = dual(
        (args) => P.isString(args[1]),
        (ontologyId: string, exampleType: ExampleType, limit: number = 100) =>
          normalizeQueryError(
            drizzle
              .select()
              .from(llmExamples)
              .where(
                and(
                  eq(llmExamples.ontologyId, ontologyId),
                  eq(llmExamples.exampleType, exampleType),
                  eq(llmExamples.isActive, true)
                )
              )
              .orderBy(desc(llmExamples.usageCount))
              .limit(limit)
          ).pipe(Effect.flatMap(decodeLlmExampleRows))
      );

      // -------------------------------------------------------------------------
      // Update Operations
      // -------------------------------------------------------------------------

      /**
       * Record example usage and update success rate
       */
      const recordUsage: ExamplesRepositoryShape["recordUsage"] = dual(2, (id: ExampleId, wasSuccessful: boolean) =>
        Effect.asVoid(
          normalizeQueryError(
            drizzle
              .update(llmExamples)
              .set({
                usageCount: drizzleSql`${llmExamples.usageCount} + 1`,
                successRate: drizzleSql`CASE
                WHEN ${llmExamples.usageCount} = 0 THEN ${wasSuccessful ? 1 : 0}::numeric(4,3)
                ELSE (${llmExamples.successRate} * ${llmExamples.usageCount} + ${wasSuccessful ? 1 : 0}) /
                  (${llmExamples.usageCount} + 1)
              END`,
              })
              .where(eq(llmExamples.id, id))
          )
        )
      );

      /**
       * Deactivate an example (soft delete)
       */
      const deactivate: ExamplesRepositoryShape["deactivate"] = (id: ExampleId) =>
        drizzle
          .update(llmExamples)
          .set({ isActive: false })
          .where(eq(llmExamples.id, id))
          .pipe(
            Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)),
            Effect.asVoid
          );

      // -------------------------------------------------------------------------
      // Stats
      // -------------------------------------------------------------------------

      /**
       * Get example statistics for an ontology
       */
      const getStats: ExamplesRepositoryShape["getStats"] = Effect.fn("ExamplesRepository.getStats")(function* (
        ontologyId: string
      ) {
        const result = yield* normalizeQueryError(sql`
          SELECT
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE is_negative)::int as "negativeCount",
            AVG(success_rate)::double precision as "avgSuccessRate",
            (
              SELECT jsonb_object_agg(example_type, type_count)
              FROM (
                SELECT example_type, COUNT(*)::int as type_count
                FROM llm_examples
                WHERE ontology_id = ${ontologyId} AND is_active = true
                GROUP BY example_type
              ) by_type_rows
            ) as "byType"
          FROM llm_examples
          WHERE ontology_id = ${ontologyId} AND is_active = true
        `);
        const [row] = yield* decodeOneExampleStatsSqlRow(result);
        return row;
      });

      return {
        create,
        getById,
        findSimilar,
        findNegatives,
        getByType,
        recordUsage,
        deactivate,
        getStats,
      };
    }),
  }
) {
  static readonly Default = Layer.effect(this, this.make);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format a vector array as PostgreSQL vector literal
 */
