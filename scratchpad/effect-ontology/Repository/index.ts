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
export const DrizzleLive = CanonicalDrizzleLive;

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
export const PgClientLive = CanonicalPgClientLive;

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
export const DrizzleWithPgLive = DatabaseReadyLive;

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
export const ClaimRepositoryLive = ClaimRepository.Default.pipe(Layer.provide(DatabaseReadyLive));

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
export const ArticleRepositoryLive = ArticleRepository.Default.pipe(Layer.provide(DatabaseReadyLive));

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
export const EntityRegistryRepositoryLive = EntityRegistryRepository.Default.pipe(Layer.provide(DatabaseReadyLive));

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
export const EmbeddingRepositoryLive = EmbeddingRepository.Default.pipe(Layer.provide(DatabaseReadyLive));

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
);

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
