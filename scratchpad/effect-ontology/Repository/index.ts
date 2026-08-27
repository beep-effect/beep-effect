/**
 * Repository Module
 *
 * **Details**
 *
 * Effect-native repository layer for claims metadata using Drizzle ORM.
 * Provides typed access to PostgreSQL tables for claims, articles, and corrections.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PgClient } from "@effect/sql-pg";
import { Layer, Redacted } from "effect";
import {
  DrizzleLive as CanonicalDrizzleLive,
  PgClientLive as CanonicalPgClientLive,
  DatabaseReadyLive,
} from "../Runtime/Persistence/PostgresLayer.ts";
import { ArticleRepository } from "./Article.ts";
import { ClaimRepository } from "./Claim.ts";
import { ConflictRepository } from "./Conflict.ts";
import { EmbeddingRepository } from "./Embedding.ts";
import { EntityRegistryRepository } from "./EntityRegistry.ts";

export { type ArticleFilter, ArticleRepository } from "./Article.ts";
export { type ClaimFilter, ClaimRepository, type ConflictCandidate } from "./Claim.ts";
export {
  ConflictRecord,
  ConflictRepository,
  canonicalConflictPair,
  detectConflictKind,
} from "./Conflict.ts";
export {
  type EmbeddingEntityType,
  EmbeddingRepository,
  type HybridSearchOptions,
  type HybridSearchResult,
  type SimilarityResult,
  type SimilaritySearchOptions,
} from "./Embedding.ts";
export { type BlockingCandidate, EntityRegistryRepository } from "./EntityRegistry.ts";
export * from "./schema.ts";

// =============================================================================
// Layer Composition
// =============================================================================

/**
 * Drizzle client layer constructed from environment config.
 *
 * **Details**
 *
 * Requires SqlClient from `@effect/sql-pg`.
 *
 * **Example** (Compose Drizzle with Postgres)
 *
 * ```ts
 * import { DrizzleLive, DrizzleWithPgLive, PgClientLive } from "@effect-ontology/Repository/index"
 * import { Layer } from "effect"
 *
 * const drizzle = Layer.provide(DrizzleLive, PgClientLive)
 * console.log(drizzle !== DrizzleLive) // true
 * console.log(DrizzleWithPgLive !== PgClientLive) // true
 * ```
 *
 * @see {@link PgClientLive} for the Postgres connection this Drizzle layer consumes.
 * @category layers
 * @since 0.0.0
 */
export const DrizzleLive = CanonicalDrizzleLive;

/**
 * Postgres client layer constructed from environment variables.
 *
 * **Gotchas**
 *
 * `POSTGRES_PASSWORD` is required. Host defaults to `localhost`, port `5432`,
 * database and user `workflow`, SSL off unless `POSTGRES_SSL` is set.
 *
 * **Example** (Provide Postgres under Drizzle)
 *
 * ```ts
 * import { DrizzleLive, PgClientLive } from "@effect-ontology/Repository/index"
 * import { Layer } from "effect"
 *
 * const withPg = Layer.provide(DrizzleLive, PgClientLive)
 * console.log(withPg !== PgClientLive) // true
 * ```
 *
 * @see {@link makeTestRepositoriesLayer} for an explicit host/port/password constructor.
 * @category layers
 * @since 0.0.0
 */
export const PgClientLive = CanonicalPgClientLive;

/**
 * Database-ready Drizzle layer with a live Postgres connection.
 *
 * **Example** (Use the combined Postgres Drizzle layer)
 *
 * ```ts
 * import { DrizzleWithPgLive, PgClientLive } from "@effect-ontology/Repository/index"
 *
 * console.log(DrizzleWithPgLive !== PgClientLive) // true
 * ```
 *
 * @see {@link PgClientLive} for the env-driven connection this layer includes.
 * @category layers
 * @since 0.0.0
 */
export const DrizzleWithPgLive = DatabaseReadyLive;

/**
 * {@link ClaimRepository} provided with the live Drizzle/Postgres stack.
 *
 * **Example** (Acquire the live claim repository)
 *
 * ```ts
 * import { ClaimRepositoryLive, RepositoriesLive } from "@effect-ontology/Repository/index"
 *
 * console.log(ClaimRepositoryLive !== RepositoriesLive) // true
 * ```
 *
 * @see {@link RepositoriesLive} for merging this layer with the other repositories.
 * @category layers
 * @since 0.0.0
 */
export const ClaimRepositoryLive = ClaimRepository.Default.pipe(Layer.provide(DatabaseReadyLive));

/**
 * {@link ConflictRepository} provided with the live Drizzle/Postgres stack.
 *
 * **Example** (Acquire the live conflict repository)
 *
 * ```ts
 * import { ClaimRepositoryLive, ConflictRepositoryLive } from "@effect-ontology/Repository/index"
 *
 * console.log(ConflictRepositoryLive !== ClaimRepositoryLive) // true
 * ```
 *
 * @see {@link RepositoriesLive} for merging this layer with the other repositories.
 * @category layers
 * @since 0.0.0
 */
export const ConflictRepositoryLive = ConflictRepository.Default.pipe(Layer.provide(DatabaseReadyLive));

/**
 * {@link ArticleRepository} provided with the live Drizzle/Postgres stack.
 *
 * **Example** (Acquire the live article repository)
 *
 * ```ts
 * import { ArticleRepositoryLive, ClaimRepositoryLive } from "@effect-ontology/Repository/index"
 *
 * console.log(ArticleRepositoryLive !== ClaimRepositoryLive) // true
 * ```
 *
 * @see {@link RepositoriesLive} for merging this layer with the other repositories.
 * @category layers
 * @since 0.0.0
 */
export const ArticleRepositoryLive = ArticleRepository.Default.pipe(Layer.provide(DatabaseReadyLive));

/**
 * {@link EntityRegistryRepository} provided with the live Drizzle/Postgres stack.
 *
 * **Gotchas**
 *
 * PostgreSQL must have the pgvector extension enabled.
 *
 * **Example** (Acquire the live entity registry)
 *
 * ```ts
 * import { ClaimRepositoryLive, EntityRegistryRepositoryLive } from "@effect-ontology/Repository/index"
 *
 * console.log(EntityRegistryRepositoryLive !== ClaimRepositoryLive) // true
 * ```
 *
 * @see {@link RepositoriesLive} for merging this layer with the other repositories.
 * @category layers
 * @since 0.0.0
 */
export const EntityRegistryRepositoryLive = EntityRegistryRepository.Default.pipe(Layer.provide(DatabaseReadyLive));

/**
 * {@link EmbeddingRepository} provided with the live Drizzle/Postgres stack.
 *
 * **Gotchas**
 *
 * PostgreSQL must have the pgvector extension enabled for hybrid search.
 *
 * **Example** (Acquire the live embedding repository)
 *
 * ```ts
 * import { ClaimRepositoryLive, EmbeddingRepositoryLive } from "@effect-ontology/Repository/index"
 *
 * console.log(EmbeddingRepositoryLive !== ClaimRepositoryLive) // true
 * ```
 *
 * @see {@link RepositoriesLive} for merging this layer with the other repositories.
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingRepositoryLive = EmbeddingRepository.Default.pipe(Layer.provide(DatabaseReadyLive));

/**
 * Merges claim, conflict, article, entity-registry, and embedding live
 * repositories onto one Postgres/Drizzle stack.
 *
 * **Example** (Compose the repository family)
 *
 * ```ts
 * import {
 *   ArticleRepositoryLive,
 *   ClaimRepositoryLive,
 *   ConflictRepositoryLive,
 *   EmbeddingRepositoryLive,
 *   EntityRegistryRepositoryLive,
 *   RepositoriesLive
 * } from "@effect-ontology/Repository/index"
 * import { Layer } from "effect"
 *
 * const composed = Layer.mergeAll(
 *   ClaimRepositoryLive,
 *   ConflictRepositoryLive,
 *   ArticleRepositoryLive,
 *   EntityRegistryRepositoryLive,
 *   EmbeddingRepositoryLive
 * )
 * console.log(composed !== ClaimRepositoryLive) // true
 * console.log(RepositoriesLive !== ClaimRepositoryLive) // true
 * ```
 *
 * @see {@link makeTestRepositoriesLayer} for the explicit-config test twin.
 * @category layers
 * @since 0.0.0
 */
export const RepositoriesLive = Layer.mergeAll(
  ClaimRepositoryLive,
  ConflictRepositoryLive,
  ArticleRepositoryLive,
  EntityRegistryRepositoryLive,
  EmbeddingRepositoryLive
);

/**
 * Builds the full repository family against an explicit Postgres connection.
 *
 * **Gotchas**
 *
 * Entity-registry and embedding repositories still require pgvector on that
 * database.
 *
 * **Example** (Construct a test repository layer)
 *
 * ```ts
 * import { makeTestRepositoriesLayer, RepositoriesLive } from "@effect-ontology/Repository/index"
 *
 * const config = {
 *   host: "127.0.0.1",
 *   port: 5432,
 *   database: "ontology_test",
 *   username: "ontology",
 *   password: "secret"
 * }
 * const testLayer = makeTestRepositoriesLayer(config)
 * console.log(config.host) // "127.0.0.1"
 * console.log(config.database) // "ontology_test"
 * console.log(testLayer !== RepositoriesLive) // true
 * ```
 *
 * @see {@link RepositoriesLive} for the env-driven production merge.
 * @category layers
 * @since 0.0.0
 */
export const makeTestRepositoriesLayer = (config: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}) =>
  Layer.mergeAll(
    ClaimRepository.Default,
    ConflictRepository.Default,
    ArticleRepository.Default,
    EntityRegistryRepository.Default,
    EmbeddingRepository.Default
  ).pipe(
    Layer.provide(DrizzleLive),
    Layer.provide(
      PgClient.layer({
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: Redacted.make(config.password),
        ssl: false,
      })
    )
  );
