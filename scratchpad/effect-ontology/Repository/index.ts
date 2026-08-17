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

import { makeDrizzleLayer } from "@beep/postgres";
import { PgClient } from "@effect/sql-pg";
import { Config, Layer, Redacted } from "effect";
import { ArticleRepository } from "./Article.ts";
import { ClaimRepository } from "./Claim.ts";
import { EmbeddingRepository } from "./Embedding.ts";
import { EntityRegistryRepository } from "./EntityRegistry.ts";

export { type ArticleFilter, ArticleRepository } from "./Article.ts";
export { type ClaimFilter, ClaimRepository, type ConflictCandidate } from "./Claim.ts";
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
export * from "./types.ts";

// =============================================================================
// Layer Composition
// =============================================================================

/**
 * Drizzle client layer from environment config
 *
 * **Details**
 *
 * Requires SqlClient from @effect/sql-pg
 *
 * **Example** (Inspect drizzle live)
 *
 * ```ts
 * import { DrizzleLive } from "@effect-ontology/Repository/index"
 *
 * console.log(DrizzleLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DrizzleLive = makeDrizzleLayer();

/**
 * PgClient layer from environment variables
 *
 * **Details**
 *
 * Environment variables:
 * - POSTGRES_HOST: Database host (default: localhost)
 * - POSTGRES_PORT: Database port (default: 5432)
 * - POSTGRES_DATABASE: Database name (default: workflow)
 * - POSTGRES_USER: Database username (default: workflow)
 * - POSTGRES_PASSWORD: Database password (required)
 * - POSTGRES_SSL: Enable SSL (default: false)
 *
 * **Example** (Inspect pg client live)
 *
 * ```ts
 * import { PgClientLive } from "@effect-ontology/Repository/index"
 *
 * console.log(PgClientLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PgClientLive = PgClient.layerConfig({
  host: Config.string("POSTGRES_HOST").pipe(Config.withDefault("localhost")),
  port: Config.number("POSTGRES_PORT").pipe(Config.withDefault(5432)),
  database: Config.string("POSTGRES_DATABASE").pipe(Config.withDefault("workflow")),
  username: Config.string("POSTGRES_USER").pipe(Config.withDefault("workflow")),
  password: Config.redacted("POSTGRES_PASSWORD"),
  ssl: Config.boolean("POSTGRES_SSL").pipe(Config.withDefault(false)),
});

/**
 * Full Drizzle layer with Postgres connection
 *
 * **Example** (Inspect drizzle with pg live)
 *
 * ```ts
 * import { DrizzleWithPgLive } from "@effect-ontology/Repository/index"
 *
 * console.log(DrizzleWithPgLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DrizzleWithPgLive = DrizzleLive.pipe(Layer.provide(PgClientLive));

/**
 * ClaimRepository with Drizzle
 *
 * **Example** (Inspect claim repository live)
 *
 * ```ts
 * import { ClaimRepositoryLive } from "@effect-ontology/Repository/index"
 *
 * console.log(ClaimRepositoryLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ClaimRepositoryLive = ClaimRepository.Default.pipe(Layer.provide(DrizzleLive));

/**
 * ArticleRepository with Drizzle
 *
 * **Example** (Inspect article repository live)
 *
 * ```ts
 * import { ArticleRepositoryLive } from "@effect-ontology/Repository/index"
 *
 * console.log(ArticleRepositoryLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ArticleRepositoryLive = ArticleRepository.Default.pipe(Layer.provide(DrizzleLive));

/**
 * EntityRegistryRepository with Drizzle
 *
 * **Details**
 *
 * Requires pgvector extension to be enabled in PostgreSQL.
 *
 * **Example** (Inspect entity registry repository live)
 *
 * ```ts
 * import { EntityRegistryRepositoryLive } from "@effect-ontology/Repository/index"
 *
 * console.log(EntityRegistryRepositoryLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EntityRegistryRepositoryLive = EntityRegistryRepository.Default.pipe(Layer.provide(DrizzleLive));

/**
 * EmbeddingRepository with Drizzle
 *
 * **Details**
 *
 * Provides persistent vector storage with hybrid search.
 * Requires pgvector extension to be enabled in PostgreSQL.
 *
 * **Example** (Inspect embedding repository live)
 *
 * ```ts
 * import { EmbeddingRepositoryLive } from "@effect-ontology/Repository/index"
 *
 * console.log(EmbeddingRepositoryLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingRepositoryLive = EmbeddingRepository.Default.pipe(Layer.provide(DrizzleLive));

/**
 * All repositories with Drizzle and Postgres
 *
 * **Example** (Inspect repositories live)
 *
 * ```ts
 * import { RepositoriesLive } from "@effect-ontology/Repository/index"
 *
 * console.log(RepositoriesLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RepositoriesLive = Layer.mergeAll(
  ClaimRepositoryLive,
  ArticleRepositoryLive,
  EntityRegistryRepositoryLive,
  EmbeddingRepositoryLive
).pipe(Layer.provide(PgClientLive));

/**
 * Test layer with explicit config
 *
 * **Example** (Inspect make test repositories layer)
 *
 * ```ts
 * import { makeTestRepositoriesLayer } from "@effect-ontology/Repository/index"
 *
 * console.log(makeTestRepositoriesLayer)
 * ```
 *
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
