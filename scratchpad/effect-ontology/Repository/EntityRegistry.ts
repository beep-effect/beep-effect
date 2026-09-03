/**
 * Entity Registry Repository
 *
 * **Details**
 *
 * Effect-native repository for the entity registry using Drizzle ORM.
 * Provides typed access to canonical entities, aliases, and blocking tokens
 * with support for pgvector similarity search.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { DrizzleError } from "@beep/drizzle";
import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { NonNegativeInt, PosInt, SchemaUtils, UUID } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Context, Effect, flow, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effect-ontology/Repository/EntityRegistry");

import { PostgresDrizzle } from "@beep/postgres";
import { and, sql as drizzleSql, eq, inArray } from "drizzle-orm";
import { dual } from "effect/Function";
import { SqlClient } from "effect/unstable/sql";
import { formatPgVector, normalizeDrizzleError } from "../Utils/Sql.ts";
import { tokenizeMentionForBlocking } from "../Utils/Text.ts";
import type {
  CanonicalEntityInsertRow,
  CanonicalEntityRow,
  EntityAliasInsertRow,
  EntityAliasRow,
  EntityBlockingTokenInsertRow,
} from "./schema.ts";
import { CanonicalEntities, canonicalEntities, EntityAliases, entityAliases, entityBlockingTokens } from "./schema.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Database identity of a canonical entity in the persistent registry.
 *
 * **Example** (Create CanonicalEntityId)
 *
 * ```ts
 * import { CanonicalEntityId } from "@effect-ontology/Repository/EntityRegistry"
 *
 * const canonicalEntityId = CanonicalEntityId.make("00000000-0000-4000-8000-000000000001")
 * console.log(canonicalEntityId)
 * ```
 *
 * @see {@link EntityRegistryRepository} for lookups that consume this identifier.
 * @category schemas
 * @since 0.0.0
 */
export const CanonicalEntityId = UUID.pipe(
  S.brand("EntityRegistryCanonicalEntityId"),
  SchemaUtils.withCodecStatics(["decodeEffect"]),
  $I.annoteSchema("CanonicalEntityId", {
    description: "Database identity of a canonical entity in the persistent registry.",
  })
);

/**
 * Decoded database identity accepted by {@link CanonicalEntityId}.
 *
 * @see {@link CanonicalEntityId} for the branded UUID schema.
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalEntityId = typeof CanonicalEntityId.Type;
/**
 * Database identity of an entity alias in the persistent registry.
 *
 * **Example** (Create EntityAliasId)
 *
 * ```ts
 * import { EntityAliasId } from "@effect-ontology/Repository/EntityRegistry"
 *
 * const entityAliasId = EntityAliasId.make("00000000-0000-4000-8000-000000000002")
 * console.log(entityAliasId)
 * ```
 *
 * @see {@link EntityRegistryRepository} for alias writes that consume this identifier.
 * @category schemas
 * @since 0.0.0
 */
export const EntityAliasId = UUID.pipe(
  S.brand("EntityRegistryEntityAliasId"),
  $I.annoteSchema("EntityAliasId", {
    description: "Database identity of an entity alias in the persistent registry.",
  })
);

/**
 * Decoded database identity accepted by {@link EntityAliasId}.
 *
 * @see {@link EntityAliasId} for the branded UUID schema.
 * @category type-level
 * @since 0.0.0
 */
export type EntityAliasId = typeof EntityAliasId.Type;

/**
 * A candidate entity returned from blocking/similarity search
 *
 * **Example** (Create a blocking candidate)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { BlockingCandidate, CanonicalEntityId } from "@effect-ontology/Repository/EntityRegistry"
 *
 * const candidate = BlockingCandidate.make({
 *   canonicalEntityId: CanonicalEntityId.make("00000000-0000-4000-8000-000000000001"),
 *   iri: IRI.make("https://example.org/entities/ada"),
 *   mention: "Ada",
 *   types: [IRI.make("https://schema.org/Person")],
 *   similarity: UnitInterval.make(0.9)
 * })
 * console.log(candidate.mention) // "Ada"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlockingCandidate extends S.Class<BlockingCandidate>($I`BlockingCandidate`)(
  {
    canonicalEntityId: CanonicalEntityId,
    iri: IRI,
    mention: S.NonEmptyString,
    types: S.Array(IRI),
    similarity: UnitInterval,
  },
  $I.annote("BlockingCandidate", {
    description: "Ontology-scoped canonical entity candidate returned by token or embedding blocking.",
  })
) {}

/**
 * Normalizes an entity mention for alias identity and lookup.
 *
 * **Example** (Normalize an alias mention)
 *
 * ```ts
 * import { normalizeEntityMention } from "@effect-ontology/Repository/EntityRegistry"
 *
 * console.log(normalizeEntityMention("  Ada LOVELACE ")) // "ada lovelace"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeEntityMention = flow(Str.toLowerCase, Str.trim);

/**
 * Ontology-scoped query input for listing canonical entities by type.
 *
 * **Example** (Filter canonical entities)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { PosInt } from "@beep/schema"
 * import { CanonicalEntityFilter } from "@effect-ontology/Repository/EntityRegistry"
 *
 * const filter = CanonicalEntityFilter.make({
 *   ontologyId: "claims",
 *   types: [IRI.make("https://schema.org/Person")],
 *   limit: PosInt.make(20)
 * })
 * console.log(filter.limit) // 20
 * ```
 *
 * @see {@link EntityRegistryRepository} for listing methods that consume this filter.
 * @category models
 * @since 0.0.0
 */
export class CanonicalEntityFilter extends S.Class<CanonicalEntityFilter>($I`CanonicalEntityFilter`)(
  {
    ontologyId: S.NonEmptyString,
    types: S.Array(IRI).pipe(SchemaUtils.withEmptyArrayDefaults()),
    limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
    offset: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  },
  $I.annote("CanonicalEntityFilter", {
    description: "Ontology-scoped canonical-entity filters with schema-owned type and pagination defaults.",
  })
) {}

const PgVector = S.Finite.pipe(
  S.Array,
  S.fromJsonString,
  $I.annoteSchema("PgVector", {
    description: "PostgreSQL pgvector text decoded to a finite numeric vector.",
  })
);

const CanonicalEntitySqlRow = S.Struct({
  id: CanonicalEntityId,
  ontologyId: S.String,
  iri: IRI,
  canonicalMention: S.String,
  types: S.String.pipe(S.Array, S.mutable),
  embedding: PgVector,
  mergeCount: S.NullOr(S.Int),
  confidenceAvg: S.NullOr(S.String),
  firstSeenAt: S.NullOr(S.Date),
  lastSeenAt: S.NullOr(S.Date),
  createdAt: S.NullOr(S.Date),
  updatedAt: S.NullOr(S.Date),
}).pipe(
  $I.annoteSchema("CanonicalEntitySqlRow", {
    description: "Decoded canonical-entity row returned by raw PostgreSQL queries.",
  })
);

const EntityAliasSqlRow = S.Struct({
  id: EntityAliasId,
  ontologyId: S.String,
  canonicalEntityId: CanonicalEntityId,
  mention: S.String,
  mentionNormalized: S.String,
  embedding: S.NullOr(PgVector),
  resolutionMethod: S.String,
  resolutionConfidence: S.String,
  firstBatchId: S.NullOr(S.String),
  sourceArticleId: S.NullOr(S.String),
  createdAt: S.NullOr(S.Date),
}).pipe(
  $I.annoteSchema("EntityAliasSqlRow", {
    description: "Decoded entity-alias row returned by raw PostgreSQL queries.",
  })
);

const BlockingCandidateSqlRow = S.Struct({
  canonicalEntityId: CanonicalEntityId,
  iri: IRI,
  mention: S.NonEmptyString,
  types: S.Array(IRI),
  similarity: UnitInterval,
}).pipe(
  $I.annoteSchema("BlockingCandidateSqlRow", {
    description: "Decoded blocking or vector-search candidate returned by PostgreSQL.",
  })
);

const CountSqlRow = S.Struct({ count: S.Int }).pipe(
  $I.annoteSchema("CountSqlRow", {
    description: "Decoded integer count projection returned by PostgreSQL.",
  })
);

const RegistryStatsSqlRow = S.Struct({
  entityCount: S.Int,
  aliasCount: S.Int,
  tokenCount: S.Int,
  totalMerges: S.Int,
}).pipe(
  $I.annoteSchema("RegistryStatsSqlRow", {
    description: "Decoded aggregate statistics for the entity registry.",
  })
);

const OneCanonicalEntitySqlRow = S.Tuple([CanonicalEntitySqlRow]).pipe(SchemaUtils.withCodecStatics(["decodeUnknownEffect"]));
const OneEntityAliasSqlRow = S.Tuple([EntityAliasSqlRow]).pipe(SchemaUtils.withCodecStatics(["decodeUnknownEffect"]));
const OneCountSqlRow = S.Tuple([CountSqlRow]).pipe(SchemaUtils.withCodecStatics(["decodeUnknownEffect"]));
const OneRegistryStatsSqlRow = S.Tuple([RegistryStatsSqlRow]).pipe(SchemaUtils.withCodecStatics(["decodeUnknownEffect"]));

const normalizeDecodedRows = normalizeDrizzleError("decodeRows");
const decodeOneCanonicalEntitySqlRow = (rows: unknown) =>
  normalizeDecodedRows(OneCanonicalEntitySqlRow.decodeUnknownEffect(rows));
const decodeOneEntityAliasSqlRow = (rows: unknown) =>
  normalizeDecodedRows(OneEntityAliasSqlRow.decodeUnknownEffect(rows));
const decodeCanonicalEntityDrizzleRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(CanonicalEntities.select.pipe(S.Array, S.mutable))(rows));
const decodeEntityAliasDrizzleRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(EntityAliases.select.pipe(S.Array, S.mutable))(rows));
const decodeBlockingCandidateSqlRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(BlockingCandidateSqlRow.pipe(S.Array, S.mutable))(rows));
const decodeOneCountSqlRow = (rows: unknown) => normalizeDecodedRows(OneCountSqlRow.decodeUnknownEffect(rows));
const decodeOneRegistryStatsSqlRow = (rows: unknown) =>
  normalizeDecodedRows(OneRegistryStatsSqlRow.decodeUnknownEffect(rows));

// =============================================================================
// Service
// =============================================================================

type EntityRegistryRepositoryError = DrizzleError;

interface EntityRegistryRepositoryShape {
  readonly insertCanonicalEntity: (
    entity: CanonicalEntityInsertRow
  ) => Effect.Effect<CanonicalEntityRow, EntityRegistryRepositoryError>;
  readonly insertCanonicalEntityWithAlias: {
    (
      entity: CanonicalEntityInsertRow,
      initialAlias: Omit<EntityAliasInsertRow, "canonicalEntityId">,
      tokens: ReadonlyArray<string>
    ): Effect.Effect<CanonicalEntityRow, EntityRegistryRepositoryError>;
    (
      initialAlias: Omit<EntityAliasInsertRow, "canonicalEntityId">,
      tokens: ReadonlyArray<string>
    ): (entity: CanonicalEntityInsertRow) => Effect.Effect<CanonicalEntityRow, EntityRegistryRepositoryError>;
  };
  readonly getCanonicalEntity: {
    (
      ontologyId: string,
      id: CanonicalEntityId
    ): Effect.Effect<O.Option<CanonicalEntityRow>, EntityRegistryRepositoryError>;
    (
      id: CanonicalEntityId
    ): (ontologyId: string) => Effect.Effect<O.Option<CanonicalEntityRow>, EntityRegistryRepositoryError>;
  };
  readonly getCanonicalEntityByIri: {
    (ontologyId: string, iri: string): Effect.Effect<O.Option<CanonicalEntityRow>, EntityRegistryRepositoryError>;
    (iri: string): (ontologyId: string) => Effect.Effect<O.Option<CanonicalEntityRow>, EntityRegistryRepositoryError>;
  };
  readonly findSimilarEntities: {
    (
      ontologyId: string,
      embedding: ReadonlyArray<number>,
      options?: { types?: ReadonlyArray<string>; k?: number; minSimilarity?: number }
    ): Effect.Effect<ReadonlyArray<BlockingCandidate>, EntityRegistryRepositoryError>;
    (
      embedding: ReadonlyArray<number>,
      options?: { types?: ReadonlyArray<string>; k?: number; minSimilarity?: number }
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<BlockingCandidate>, EntityRegistryRepositoryError>;
  };
  readonly findCandidatesByTokens: {
    (
      ontologyId: string,
      tokens: ReadonlyArray<string>,
      k?: number
    ): Effect.Effect<ReadonlyArray<BlockingCandidate>, EntityRegistryRepositoryError>;
    (
      tokens: ReadonlyArray<string>,
      k?: number
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<BlockingCandidate>, EntityRegistryRepositoryError>;
  };
  readonly mergeIntoCanonical: {
    (
      ontologyId: string,
      id: CanonicalEntityId,
      updates: { mergeCount?: number; confidenceAvg?: number }
    ): Effect.Effect<void, EntityRegistryRepositoryError>;
    (
      id: CanonicalEntityId,
      updates: { mergeCount?: number; confidenceAvg?: number }
    ): (ontologyId: string) => Effect.Effect<void, EntityRegistryRepositoryError>;
  };
  readonly touchCanonicalEntity: {
    (ontologyId: string, id: CanonicalEntityId): Effect.Effect<void, EntityRegistryRepositoryError>;
    (id: CanonicalEntityId): (ontologyId: string) => Effect.Effect<void, EntityRegistryRepositoryError>;
  };
  readonly countCanonicalEntities: (ontologyId: string) => Effect.Effect<number, EntityRegistryRepositoryError>;
  readonly insertCanonicalEntitiesBatch: (
    entities: Array<CanonicalEntityInsertRow>
  ) => Effect.Effect<ReadonlyArray<CanonicalEntityRow>, EntityRegistryRepositoryError>;
  readonly getCanonicalEntitiesByIds: {
    (
      ontologyId: string,
      ids: Array<CanonicalEntityId>
    ): Effect.Effect<ReadonlyArray<CanonicalEntityRow>, EntityRegistryRepositoryError>;
    (
      ids: Array<CanonicalEntityId>
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<CanonicalEntityRow>, EntityRegistryRepositoryError>;
  };
  readonly insertAlias: (alias: EntityAliasInsertRow) => Effect.Effect<EntityAliasRow, EntityRegistryRepositoryError>;
  readonly findAliasByMention: {
    (ontologyId: string, mention: string): Effect.Effect<O.Option<EntityAliasRow>, EntityRegistryRepositoryError>;
    (mention: string): (ontologyId: string) => Effect.Effect<O.Option<EntityAliasRow>, EntityRegistryRepositoryError>;
  };
  readonly getAliasesForCanonical: {
    (
      ontologyId: string,
      canonicalId: CanonicalEntityId
    ): Effect.Effect<ReadonlyArray<EntityAliasRow>, EntityRegistryRepositoryError>;
    (
      canonicalId: CanonicalEntityId
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<EntityAliasRow>, EntityRegistryRepositoryError>;
  };
  readonly countAliases: {
    (ontologyId: string, canonicalId: CanonicalEntityId): Effect.Effect<number, EntityRegistryRepositoryError>;
    (canonicalId: CanonicalEntityId): (ontologyId: string) => Effect.Effect<number, EntityRegistryRepositoryError>;
  };
  readonly insertBlockingTokens: {
    (
      ontologyId: string,
      canonicalId: CanonicalEntityId,
      tokens: ReadonlyArray<string>
    ): Effect.Effect<void, EntityRegistryRepositoryError>;
    (
      canonicalId: CanonicalEntityId,
      tokens: ReadonlyArray<string>
    ): (ontologyId: string) => Effect.Effect<void, EntityRegistryRepositoryError>;
  };
  readonly deleteBlockingTokens: {
    (ontologyId: string, canonicalId: CanonicalEntityId): Effect.Effect<void, EntityRegistryRepositoryError>;
    (canonicalId: CanonicalEntityId): (ontologyId: string) => Effect.Effect<void, EntityRegistryRepositoryError>;
  };
  readonly rebuildBlockingTokens: {
    (
      ontologyId: string,
      canonicalId: CanonicalEntityId,
      mention: string
    ): Effect.Effect<void, EntityRegistryRepositoryError>;
    (
      canonicalId: CanonicalEntityId,
      mention: string
    ): (ontologyId: string) => Effect.Effect<void, EntityRegistryRepositoryError>;
  };
  readonly getStats: (
    ontologyId: string
  ) => Effect.Effect<typeof RegistryStatsSqlRow.Type, EntityRegistryRepositoryError>;
}

/**
 * Persists canonical entities, aliases, and blocking tokens with pgvector
 * similarity search.
 *
 * **Example** (Read registry stats and blocking candidates)
 *
 * ```ts
 * import { EntityRegistryRepository } from "@effect-ontology/Repository/EntityRegistry"
 * import { Effect } from "effect"
 *
 * const inspectRegistry = Effect.gen(function* () {
 *   const registry = yield* EntityRegistryRepository
 *   const stats = yield* registry.getStats("people")
 *   return stats
 * })
 * console.log(typeof inspectRegistry) // "object"
 * ```
 *
 * @see {@link BlockingCandidate} for the payload returned by token or embedding blocking.
 * @category repositories
 * @since 0.0.0
 */
export class EntityRegistryRepository extends Context.Service<
  EntityRegistryRepository,
  EntityRegistryRepositoryShape
>()($I`EntityRegistryRepository`, {
  make: Effect.gen(function* () {
    const drizzle = yield* PostgresDrizzle;
    const sql = yield* SqlClient.SqlClient;
    const normalizeQueryError = normalizeDrizzleError("execute");

    // -------------------------------------------------------------------------
    // Canonical Entity Operations
    // -------------------------------------------------------------------------

    /**
     * Insert a new canonical entity
     */
    const insertCanonicalEntity: EntityRegistryRepositoryShape["insertCanonicalEntity"] = Effect.fn(
      "insertCanonicalEntity"
    )(function* (entity: CanonicalEntityInsertRow): Effect.fn.Return<CanonicalEntityRow, DrizzleError> {
      const result = yield* normalizeQueryError(
        drizzle
          .insert(canonicalEntities)
          .values({
            ontologyId: O.getOrElse(O.fromUndefinedOr(entity.ontologyId), () => "default"),
            iri: entity.iri,
            canonicalMention: entity.canonicalMention,
            types: A.fromIterable(O.getOrElse(O.fromUndefinedOr(entity.types), A.empty)),
            embedding: formatPgVector(entity.embedding),
            mergeCount: O.getOrElse(O.fromNullishOr(entity.mergeCount), () => 1),
            confidenceAvg: O.getOrNull(O.fromNullishOr(entity.confidenceAvg)),
          })
          .returning()
      );
      const [row] = yield* decodeOneCanonicalEntitySqlRow(result);
      return row;
    });

    /**
     * Get canonical entity by ID
     */
    const getCanonicalEntity: EntityRegistryRepositoryShape["getCanonicalEntity"] = dual(
      2,
      Effect.fn("getCanonicalEntity")(function* (ontologyId: string, id: CanonicalEntityId) {
        const rows = yield* normalizeQueryError(
          drizzle
            .select()
            .from(canonicalEntities)
            .where(and(eq(canonicalEntities.ontologyId, ontologyId), eq(canonicalEntities.id, id)))
            .limit(1)
        );
        return A.head(yield* decodeCanonicalEntityDrizzleRows(rows));
      })
    );

    /**
     * Get canonical entity by IRI
     */
    const getCanonicalEntityByIri: EntityRegistryRepositoryShape["getCanonicalEntityByIri"] = dual(
      2,
      Effect.fn("getCanonicalEntityByIri")(function* (ontologyId: string, iri: string) {
        const rows = yield* normalizeQueryError(
          drizzle
            .select()
            .from(canonicalEntities)
            .where(and(eq(canonicalEntities.ontologyId, ontologyId), eq(canonicalEntities.iri, iri)))
            .limit(1)
        );
        return A.head(yield* decodeCanonicalEntityDrizzleRows(rows));
      })
    );

    /**
     * Find similar canonical entities using pgvector ANN search
     *
     * @param ontologyId - Ontology scope for the search
     * @param embedding - Query embedding vector (768 dimensions)
     * @param options
     * @param options.types - Optional type filter (entities must have at least one matching type)
     * @param options.k - Number of candidates to return (default: 10)
     * @param options.minSimilarity - Minimum cosine similarity threshold (default: 0.7)
     */
    const findSimilarEntities: EntityRegistryRepositoryShape["findSimilarEntities"] = dual(
      3,
      Effect.fn("EntityRegistryRepository.findSimilarEntities")(function* (
        ontologyId: string,
        embedding: ReadonlyArray<number>,
        options: {
          types?: ReadonlyArray<string>;
          k?: number;
          minSimilarity?: number;
        } = {}
      ): Effect.fn.Return<Array<BlockingCandidate>, DrizzleError> {
        const { k = 10, minSimilarity = 0.7, types } = options;
        const vectorStr = formatPgVector(embedding);

        // Build query with ontology scoping and optional type filter
        const results =
          P.isNotUndefined(types) && types.length > 0
            ? yield* normalizeQueryError(sql`
                SELECT id                                       as "canonicalEntityId",
                       iri,
                       canonical_mention                        as mention,
                       types,
                       1 - (embedding <=> ${vectorStr}::vector) as similarity
                FROM canonical_entities
                WHERE ontology_id = ${ontologyId}
                  AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
                  AND types && ${types}::text[]
                ORDER BY embedding <=> ${vectorStr}::vector
                  LIMIT ${k}
              `)
            : yield* normalizeQueryError(sql`
                SELECT id                                       as "canonicalEntityId",
                       iri,
                       canonical_mention                        as mention,
                       types,
                       1 - (embedding <=> ${vectorStr}::vector) as similarity
                FROM canonical_entities
                WHERE ontology_id = ${ontologyId}
                  AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
                ORDER BY embedding <=> ${vectorStr}::vector
                  LIMIT ${k}
              `);

        return yield* decodeBlockingCandidateSqlRows(results);
      })
    );

    /**
     * Find candidates via token blocking
     *
     * @param ontologyId - Ontology scope for the search
     * @param tokens - Blocking tokens to search for
     * @param k - Maximum number of candidates to return (default: 50)
     */
    const findCandidatesByTokens: EntityRegistryRepositoryShape["findCandidatesByTokens"] = dual(
      3,
      Effect.fn("EntityRegistryRepository.findCandidatesByTokens")(function* (
        ontologyId: string,
        tokens: ReadonlyArray<string>,
        k: number = 50
      ): Effect.fn.Return<Array<BlockingCandidate>, DrizzleError> {
        if (A.isReadonlyArrayEmpty(tokens)) return [];

        const results = yield* normalizeQueryError(sql`
            SELECT DISTINCT ce.id                as "canonicalEntityId",
                            ce.iri,
                            ce.canonical_mention as mention,
                            ce.types,
                            0.0::double precision as similarity
            FROM entity_blocking_tokens bt
              JOIN canonical_entities ce
            ON bt.canonical_entity_id = ce.id
            WHERE bt.ontology_id = ${ontologyId}
              AND bt.token = ANY (${tokens}::text[])
              LIMIT ${k}
          `);

        return yield* decodeBlockingCandidateSqlRows(results);
      })
    );

    /**
     * Update canonical entity after merge
     */
    const mergeIntoCanonical: EntityRegistryRepositoryShape["mergeIntoCanonical"] = dual(
      3,
      Effect.fn("mergeIntoCanonical")(function* (
        ontologyId: string,
        id: CanonicalEntityId,
        updates: {
          mergeCount?: number;
          confidenceAvg?: number;
        }
      ) {
        yield* normalizeQueryError(
          drizzle
            .update(canonicalEntities)
            .set({
              lastSeenAt: drizzleSql`NOW()`,
              updatedAt: drizzleSql`NOW()`,
              ...O.getOrElse(
                O.map(O.fromUndefinedOr(updates.mergeCount), (mergeCount) => ({ mergeCount })),
                () => ({})
              ),
              ...O.getOrElse(
                O.map(O.fromUndefinedOr(updates.confidenceAvg), (confidenceAvg) => ({
                  confidenceAvg: drizzleSql`${confidenceAvg}`,
                })),
                () => ({})
              ),
            })
            .where(and(eq(canonicalEntities.ontologyId, ontologyId), eq(canonicalEntities.id, id)))
        );
      })
    );

    /**
     * Update last seen timestamp
     */
    const touchCanonicalEntity: EntityRegistryRepositoryShape["touchCanonicalEntity"] = dual(
      2,
      Effect.fn("touchCanonicalEntity")((ontologyId: string, id: CanonicalEntityId) =>
        normalizeQueryError(
          drizzle
            .update(canonicalEntities)
            .set({
              lastSeenAt: drizzleSql`NOW()`,
              updatedAt: drizzleSql`NOW()`,
            })
            .where(and(eq(canonicalEntities.ontologyId, ontologyId), eq(canonicalEntities.id, id)))
        ).pipe(Effect.asVoid)
      )
    );

    /**
     * Count total canonical entities
     */
    const countCanonicalEntities: EntityRegistryRepositoryShape["countCanonicalEntities"] = Effect.fn(
      "countCanonicalEntities"
    )(function* (ontologyId: string) {
      const result = yield* normalizeQueryError(sql`SELECT COUNT(*) ::int as count
                                  FROM canonical_entities WHERE ontology_id = ${ontologyId}`);
      const [row] = yield* decodeOneCountSqlRow(result);
      return row.count;
    });

    // -------------------------------------------------------------------------
    // Alias Operations
    // -------------------------------------------------------------------------

    /**
     * Insert an entity alias (upsert on ontology_id + mention_normalized)
     */
    const insertAlias: EntityRegistryRepositoryShape["insertAlias"] = Effect.fn("insertAlias")(function* (
      alias: EntityAliasInsertRow
    ): Effect.fn.Return<EntityAliasRow, DrizzleError> {
      const embeddingValue = O.map(O.fromNullishOr(alias.embedding), formatPgVector).pipe(O.getOrNull);
      const result = yield* normalizeQueryError(
        drizzle
          .insert(entityAliases)
          .values({
            ontologyId: O.getOrElse(O.fromUndefinedOr(alias.ontologyId), () => "default"),
            canonicalEntityId: alias.canonicalEntityId,
            mention: alias.mention,
            mentionNormalized: alias.mentionNormalized,
            embedding: embeddingValue,
            resolutionMethod: alias.resolutionMethod,
            resolutionConfidence: alias.resolutionConfidence,
            firstBatchId: O.getOrNull(O.fromNullishOr(alias.firstBatchId)),
            sourceArticleId: O.getOrNull(O.fromNullishOr(alias.sourceArticleId)),
          })
          .onConflictDoUpdate({
            target: [entityAliases.ontologyId, entityAliases.mentionNormalized],
            set: {
              canonicalEntityId: drizzleSql`excluded.canonical_entity_id`,
              resolutionConfidence: drizzleSql`GREATEST(${entityAliases.resolutionConfidence}, excluded.resolution_confidence)`,
            },
          })
          .returning()
      );
      const [row] = yield* decodeOneEntityAliasSqlRow(result);
      return row;
    });

    /**
     * Creates a canonical entity together with its first alias and blocking tokens.
     *
     * The canonical row is never observable without the alias that established it.
     */
    const insertCanonicalEntityWithAlias: EntityRegistryRepositoryShape["insertCanonicalEntityWithAlias"] = dual(
      3,
      Effect.fn("insertCanonicalEntityWithAlias")(function* (
        entity: CanonicalEntityInsertRow,
        initialAlias: Omit<EntityAliasInsertRow, "canonicalEntityId">,
        tokens: ReadonlyArray<string>
      ): Effect.fn.Return<CanonicalEntityRow, DrizzleError> {
        return yield* normalizeQueryError(
          drizzle.transaction(
            Effect.fnUntraced(function* (tx) {
              const canonicalRows = yield* tx
                .insert(canonicalEntities)
                .values({
                  ontologyId: O.getOrElse(O.fromUndefinedOr(entity.ontologyId), () => "default"),
                  iri: entity.iri,
                  canonicalMention: entity.canonicalMention,
                  types: A.fromIterable(O.getOrElse(O.fromUndefinedOr(entity.types), A.empty)),
                  embedding: formatPgVector(entity.embedding),
                  mergeCount: O.getOrElse(O.fromNullishOr(entity.mergeCount), () => 1),
                  confidenceAvg: O.getOrNull(O.fromNullishOr(entity.confidenceAvg)),
                })
                .returning();
              const [canonical] = yield* decodeOneCanonicalEntitySqlRow(canonicalRows);
              const embeddingValue = O.map(O.fromNullishOr(initialAlias.embedding), formatPgVector).pipe(O.getOrNull);
              yield* tx.insert(entityAliases).values({
                ontologyId: O.getOrElse(O.fromUndefinedOr(initialAlias.ontologyId), () => "default"),
                canonicalEntityId: canonical.id,
                mention: initialAlias.mention,
                mentionNormalized: initialAlias.mentionNormalized,
                embedding: embeddingValue,
                resolutionMethod: initialAlias.resolutionMethod,
                resolutionConfidence: initialAlias.resolutionConfidence,
                firstBatchId: O.getOrNull(O.fromNullishOr(initialAlias.firstBatchId)),
                sourceArticleId: O.getOrNull(O.fromNullishOr(initialAlias.sourceArticleId)),
              });
              if (A.isReadonlyArrayNonEmpty(tokens)) {
                yield* tx.insert(entityBlockingTokens).values(
                  A.map(
                    tokens,
                    (token): EntityBlockingTokenInsertRow => ({
                      ontologyId: canonical.ontologyId,
                      canonicalEntityId: canonical.id,
                      token: Str.toLowerCase(token),
                      tokenType: "mention",
                    })
                  )
                );
              }
              return canonical;
            })
          )
        );
      })
    );

    /**
     * Find alias by exact mention (normalized) within an ontology
     *
     * @param ontologyId - Ontology scope for the search
     * @param mention - The mention to look up
     */
    const findAliasByMention: EntityRegistryRepositoryShape["findAliasByMention"] = dual(
      2,
      Effect.fn("findAliasByMention")(function* (ontologyId: string, mention: string) {
        const normalized = normalizeEntityMention(mention);
        const rows = yield* normalizeQueryError(
          drizzle
            .select()
            .from(entityAliases)
            .where(and(eq(entityAliases.ontologyId, ontologyId), eq(entityAliases.mentionNormalized, normalized)))
            .limit(1)
        );
        return A.head(yield* decodeEntityAliasDrizzleRows(rows));
      })
    );

    /**
     * Get all aliases for a canonical entity
     */
    const getAliasesForCanonical: EntityRegistryRepositoryShape["getAliasesForCanonical"] = dual(
      2,
      (ontologyId: string, canonicalId: CanonicalEntityId) =>
        normalizeQueryError(
          drizzle
            .select()
            .from(entityAliases)
            .where(and(eq(entityAliases.ontologyId, ontologyId), eq(entityAliases.canonicalEntityId, canonicalId)))
        ).pipe(Effect.flatMap(decodeEntityAliasDrizzleRows))
    );

    /**
     * Count aliases for a canonical entity
     */
    const countAliases: EntityRegistryRepositoryShape["countAliases"] = dual(
      2,
      Effect.fn("countAliases")(function* (ontologyId: string, canonicalId: CanonicalEntityId) {
        const result = yield* normalizeQueryError(sql`
          SELECT COUNT(*) ::int as count
          FROM entity_aliases
          WHERE ontology_id = ${ontologyId} AND canonical_entity_id = ${canonicalId}
        `);
        const [row] = yield* decodeOneCountSqlRow(result);
        return row.count;
      })
    );

    // -------------------------------------------------------------------------
    // Blocking Token Operations
    // -------------------------------------------------------------------------

    /**
     * Insert blocking tokens for a canonical entity
     *
     * @param ontologyId - Ontology scope for the tokens
     * @param canonicalId - The canonical entity ID
     * @param tokens - Tokens to insert
     */
    const insertBlockingTokens: EntityRegistryRepositoryShape["insertBlockingTokens"] = dual(
      3,
      Effect.fn("insertBlockingTokens")(function* (
        ontologyId: string,
        canonicalId: CanonicalEntityId,
        tokens: ReadonlyArray<string>
      ) {
        if (A.isReadonlyArrayEmpty(tokens)) return;
        const values: Array<EntityBlockingTokenInsertRow> = A.map(tokens, (token) => ({
          ontologyId,
          canonicalEntityId: canonicalId,
          token: Str.toLowerCase(token),
          tokenType: "mention",
        }));
        yield* drizzle.insert(entityBlockingTokens).values(values).onConflictDoNothing();
      })
    );

    /**
     * Delete all blocking tokens for a canonical entity
     */
    const deleteBlockingTokens: EntityRegistryRepositoryShape["deleteBlockingTokens"] = dual(
      2,
      (ontologyId: string, canonicalId: CanonicalEntityId) =>
        drizzle
          .delete(entityBlockingTokens)
          .where(
            and(
              eq(entityBlockingTokens.ontologyId, ontologyId),
              eq(entityBlockingTokens.canonicalEntityId, canonicalId)
            )
          )
          .pipe(Effect.asVoid)
    );

    /**
     * Rebuild blocking tokens for a canonical entity from its mention
     *
     * @param ontologyId - Ontology scope for the tokens
     * @param canonicalId - The canonical entity ID
     * @param mention - The mention to tokenize
     */
    const rebuildBlockingTokens: EntityRegistryRepositoryShape["rebuildBlockingTokens"] = dual(
      3,
      Effect.fn("rebuildBlockingTokens")(function* (
        ontologyId: string,
        canonicalId: CanonicalEntityId,
        mention: string
      ) {
        yield* deleteBlockingTokens(ontologyId, canonicalId);
        const tokens = tokenize(mention);
        yield* insertBlockingTokens(ontologyId, canonicalId, tokens);
      })
    );

    // -------------------------------------------------------------------------
    // Bulk Operations
    // -------------------------------------------------------------------------

    /**
     * Insert multiple canonical entities in a batch
     */
    const insertCanonicalEntitiesBatch: EntityRegistryRepositoryShape["insertCanonicalEntitiesBatch"] = Effect.fn(
      "insertCanonicalEntitiesBatch"
    )(function* (entities: Array<CanonicalEntityInsertRow>) {
      if (A.isReadonlyArrayEmpty(entities)) return [];
      return yield* Effect.forEach(entities, insertCanonicalEntity, { concurrency: 10 });
    });

    /**
     * Get multiple canonical entities by IDs
     */
    const getCanonicalEntitiesByIds: EntityRegistryRepositoryShape["getCanonicalEntitiesByIds"] = dual(
      2,
      Effect.fn("getCanonicalEntitiesByIds")(function* (ontologyId: string, ids: Array<CanonicalEntityId>) {
        if (ids.length === 0) return [];
        const rows = yield* normalizeQueryError(
          drizzle
            .select()
            .from(canonicalEntities)
            .where(and(eq(canonicalEntities.ontologyId, ontologyId), inArray(canonicalEntities.id, ids)))
        );
        return yield* decodeCanonicalEntityDrizzleRows(rows);
      })
    );

    /**
     * Get statistics about the entity registry
     *
     * @param ontologyId - Optional ontology scope. If provided, returns stats for that ontology only.
     */
    const getStats: EntityRegistryRepositoryShape["getStats"] = Effect.fn("getStats")(function* (ontologyId: string) {
      const result = yield* normalizeQueryError(sql`
            SELECT (SELECT COUNT(*) ::int
                    FROM canonical_entities
                    WHERE ontology_id = ${ontologyId}) as "entityCount",
                   (SELECT COUNT(*) ::int
                    FROM entity_aliases
                    WHERE ontology_id = ${ontologyId}) as "aliasCount",
                   (SELECT COUNT(*) ::int
                    FROM entity_blocking_tokens
                    WHERE ontology_id = ${ontologyId}) as "tokenCount",
                   (SELECT COALESCE(SUM(merge_count), 0) ::int
                    FROM canonical_entities
                    WHERE ontology_id = ${ontologyId}) as "totalMerges"
          `);
      const [row] = yield* decodeOneRegistryStatsSqlRow(result);
      return row;
    });

    return {
      // Canonical entities
      insertCanonicalEntity,
      insertCanonicalEntityWithAlias,
      getCanonicalEntity,
      getCanonicalEntityByIri,
      findSimilarEntities,
      findCandidatesByTokens,
      mergeIntoCanonical,
      touchCanonicalEntity,
      countCanonicalEntities,
      insertCanonicalEntitiesBatch,
      getCanonicalEntitiesByIds,

      // Aliases
      insertAlias,
      findAliasByMention,
      getAliasesForCanonical,
      countAliases,

      // Blocking tokens
      insertBlockingTokens: dual(
        3,
        Effect.fn("EntityRegistryRepository.insertBlockingTokens")(
          (ontologyId: string, canonicalId: CanonicalEntityId, tokens: ReadonlyArray<string>) =>
            normalizeQueryError(insertBlockingTokens(ontologyId, canonicalId, tokens))
        )
      ),
      deleteBlockingTokens: dual(
        2,
        Effect.fn("EntityRegistryRepository.deleteBlockingTokens")(
          (ontologyId: string, canonicalId: CanonicalEntityId) =>
            normalizeQueryError(deleteBlockingTokens(ontologyId, canonicalId))
        )
      ),
      rebuildBlockingTokens: dual(
        3,
        Effect.fn("EntityRegistryRepository.rebuildBlockingTokens")(
          (ontologyId: string, canonicalId: CanonicalEntityId, mention: string) =>
            normalizeQueryError(rebuildBlockingTokens(ontologyId, canonicalId, mention))
        )
      ),

      // Stats
      getStats,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format a vector array as PostgreSQL vector literal
 */

/**
 * Tokenize a mention for blocking index
 * - Lowercase
 * - Split on whitespace and punctuation
 * - Filter stop words and short tokens
 */
function tokenize(mention: string): Array<string> {
  return tokenizeMentionForBlocking(mention);
}
