/**
 * Postgres-backed Drizzle Effect composition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PostgresId } from "@beep/identity";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import * as PgEffectSessionMigrator from "drizzle-orm/pg-core/effect/session";
import { Context, Effect, Layer } from "effect";
import { dual } from "effect/Function";
import { PostgresError } from "./Postgres.errors.ts";
import type * as Pg from "@effect/sql-pg/PgClient";
import type { EffectDrizzlePgConfig } from "drizzle-orm/effect-postgres";
import type { MigrationConfig, MigrationMeta } from "drizzle-orm/migrator";
import type { AnyRelations, EmptyRelations } from "drizzle-orm/relations";
import type { NativeMigrationError } from "./PostgresInterop.models.ts";

const $I = $PostgresId.create("PostgresDrizzle.service");
const LegacyStatementBoundary =
  /;\s*\n(?=\s*(?:ALTER|BEGIN|COMMENT|CREATE|DELETE|DROP|GRANT|INSERT|REVOKE|SET|TRUNCATE|UPDATE|WITH)\b)/giu;

declare const PostgresDrizzleSchema: unique symbol;

type PostgresDrizzleSchemaPhantom<TSchema> = {
  readonly [PostgresDrizzleSchema]?: TSchema;
};

/**
 * Native Drizzle Effect Postgres database value.
 *
 * @example
 * ```ts
 * import type { PostgresDrizzleDatabase } from "@beep/postgres"
 *
 * const readClient = (db: PostgresDrizzleDatabase) => db.$client
 * console.log(readClient)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PostgresDrizzleDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
  TRelations extends AnyRelations = EmptyRelations,
> = PgDrizzle.EffectPgDatabase<NonNullable<TRelations>> &
  PostgresDrizzleSchemaPhantom<TSchema> & {
    readonly $client: Pg.PgClient;
  };

/**
 * Configuration accepted by {@link makeDrizzle}.
 *
 * @example
 * ```ts
 * import type { PostgresDrizzleConfig } from "@beep/postgres"
 *
 * const config: PostgresDrizzleConfig = {}
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PostgresDrizzleConfig<
  TSchema extends Record<string, unknown> = Record<string, never>,
  TRelations extends AnyRelations = EmptyRelations,
> = EffectDrizzlePgConfig<NonNullable<TRelations>> & PostgresDrizzleSchemaPhantom<TSchema>;

/**
 * Service key for a default-typed Postgres-backed Drizzle database.
 *
 * @example
 * ```ts
 * import { PostgresDrizzle } from "@beep/postgres"
 *
 * const service = PostgresDrizzle
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PostgresDrizzle extends Context.Service<PostgresDrizzle, PostgresDrizzleDatabase>()($I`PostgresDrizzle`) {}

/**
 * Create a Postgres-backed Drizzle Effect database from a provided PgClient.
 *
 * @example
 * ```ts
 * import { makeDrizzle } from "@beep/postgres"
 *
 * const effect = makeDrizzle()
 * console.log(effect)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDrizzle = <
  TSchema extends Record<string, unknown> = Record<string, never>,
  TRelations extends AnyRelations = EmptyRelations,
>(
  config: PostgresDrizzleConfig<TSchema, TRelations> = {} as PostgresDrizzleConfig<TSchema, TRelations>
): Effect.Effect<PostgresDrizzleDatabase<TSchema, TRelations>, PostgresError, Pg.PgClient> =>
  PgDrizzle.makeWithDefaults<NonNullable<TRelations>>(config).pipe(
    Effect.map((database) => database as PostgresDrizzleDatabase<TSchema, TRelations>),
    Effect.mapError((cause) => PostgresError.fromUnknown("makeDrizzle", cause))
  );

/**
 * Build a Layer for a default-typed Postgres-backed Drizzle database.
 *
 * @example
 * ```ts
 * import { makeDrizzleLayer } from "@beep/postgres"
 *
 * const layer = makeDrizzleLayer()
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDrizzleLayer = (
  config: PostgresDrizzleConfig = {}
): Layer.Layer<PostgresDrizzle, PostgresError, Pg.PgClient> => Layer.effect(PostgresDrizzle, makeDrizzle(config));

const splitLegacyMigrationStatement = (statement: string): ReadonlyArray<string> => {
  const parts = statement
    .trim()
    .split(LegacyStatementBoundary)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts.map((part) => (part.endsWith(";") ? part : `${part};`));
};

const normalizeMigration = (migration: MigrationMeta): MigrationMeta => ({
  ...migration,
  sql: migration.sql.flatMap(splitLegacyMigrationStatement),
});

const readNormalizedMigrationFiles = (
  config: MigrationConfig
): Effect.Effect<ReadonlyArray<MigrationMeta>, PostgresError> =>
  Effect.try({
    try: () => readMigrationFiles(config).map(normalizeMigration),
    catch: (cause) => PostgresError.fromUnknown("migrate", cause),
  });

const getDrizzleSession = <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
  db: PostgresDrizzleDatabase<TSchema, TRelations>
): unknown => (db as unknown as { readonly session: unknown }).session;

// Drizzle's Effect migrator/session surface is still RC-shaped in 1.0.0-rc.4-5d5b77c.
// Revisit these compatibility casts when the final Effect integration API stabilizes.
const runPgEffectMigrations = <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
  db: PostgresDrizzleDatabase<TSchema, TRelations>,
  migrations: ReadonlyArray<MigrationMeta>,
  config: MigrationConfig
): Effect.Effect<undefined, PostgresError> =>
  (
    PgEffectSessionMigrator.migrate as (
      migrations: ReadonlyArray<MigrationMeta>,
      session: unknown,
      config: MigrationConfig
    ) => Effect.Effect<undefined, NativeMigrationError, never>
  )(migrations, getDrizzleSession(db), config).pipe(
    Effect.mapError((cause) => PostgresError.fromUnknown("migrate", cause))
  );

/**
 * Run Drizzle Effect Postgres migrations and normalize failures.
 *
 * @example
 * ```ts
 * import { migrate } from "@beep/postgres"
 * import type { PostgresDrizzleDatabase } from "@beep/postgres"
 *
 * const runMigration = (db: PostgresDrizzleDatabase) => {
 *   const effect = migrate(db, { migrationsFolder: "./drizzle" })
 *   const deferred = migrate({ migrationsFolder: "./drizzle" })(db)
 *   return { deferred, effect }
 * }
 * console.log(runMigration)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const migrate: {
  <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
    db: PostgresDrizzleDatabase<TSchema, TRelations>,
    config: MigrationConfig
  ): Effect.Effect<undefined, PostgresError>;
  (
    config: MigrationConfig
  ): <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
    db: PostgresDrizzleDatabase<TSchema, TRelations>
  ) => Effect.Effect<undefined, PostgresError>;
} = dual(
  2,
  <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
    db: PostgresDrizzleDatabase<TSchema, TRelations>,
    config: MigrationConfig
  ): Effect.Effect<undefined, PostgresError> =>
    readNormalizedMigrationFiles(config).pipe(
      Effect.flatMap((migrations) => runPgEffectMigrations(db, migrations, config))
    )
);
