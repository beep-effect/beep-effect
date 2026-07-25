/**
 * Postgres-backed Drizzle Effect composition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { $PostgresId } from "@beep/identity";
import { A, O, Str } from "@beep/utils";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { formatToMillis } from "drizzle-orm/migrator.utils";
import * as PgEffectSessionMigrator from "drizzle-orm/pg-core/effect";
import { Context, Effect, flow, Layer, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { PostgresError } from "./Postgres.errors.ts";
import type * as Pg from "@effect/sql-pg/PgClient";
import type { MigrationConfig, MigrationMeta } from "drizzle-orm/migrator";
import type { EffectDrizzlePgConfig } from "drizzle-orm/pg-core/effect/utils";
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

const splitLegacyMigrationStatement = flow(
  Str.trim,
  Str.split(LegacyStatementBoundary),
  A.map(Str.trim),
  A.filter(Str.isNonEmpty),
  A.map((part) => (Str.endsWith(";")(part) ? part : `${part};`))
);

const normalizeMigration = (migration: MigrationMeta): MigrationMeta => ({
  ...migration,
  sql: A.flatMap(migration.sql, splitLegacyMigrationStatement),
});

const readNormalizedMigrationFiles = (
  config: MigrationConfig
): Effect.Effect<ReadonlyArray<MigrationMeta>, PostgresError> =>
  Effect.try({
    try: () => A.map(readMigrationFiles(config), normalizeMigration),
    catch: (cause) => PostgresError.fromUnknown("migrate", cause),
  });

const getDrizzleSession = <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
  db: PostgresDrizzleDatabase<TSchema, TRelations>
): unknown => (db as unknown as { readonly session: unknown }).session;

// Drizzle's Effect migrator/session surface is still RC-shaped in 1.0.0-rc.4-de6c356.
// Revisit these compatibility casts when the final Effect integration API stabilizes.
// The session migrator reads only migrationsTable/migrationsSchema/init from the
// config; migrationsFolder is never dereferenced, which is what lets
// migrateBundle pass an in-memory sentinel instead of a real folder. Upstream
// already codified this for SQLite (session migrators there take
// Omit<MigrationConfig, "migrationsFolder">, PR #5265); the pg session migrator
// just hasn't received the same treatment — drop the sentinel when it does.
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

const MigrationBundleEntryName = S.String.check(
  S.isPattern(/^\d{14}/, {
    identifier: $I`MigrationBundleEntryNameCheck`,
    title: "Timestamped migration bundle entry name",
    description: "A Drizzle migration folder name beginning with a 14-digit UTC timestamp.",
    message: "Expected a migration folder name beginning with a 14-digit UTC timestamp.",
  })
);

/**
 * One migration of an in-memory bundle: the timestamped drizzle folder name
 * and the byte-exact `migration.sql` content.
 *
 * @example
 * ```ts
 * import { MigrationBundleEntry } from "@beep/postgres"
 *
 * const entry = MigrationBundleEntry.make({
 *   name: "20260512000000_architecture_lab_work_item",
 *   sql: "CREATE TABLE architecture_lab_work_item (id TEXT PRIMARY KEY);\n",
 * })
 * console.log(entry.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MigrationBundleEntry extends S.Class<MigrationBundleEntry>($I`MigrationBundleEntry`)(
  {
    name: MigrationBundleEntryName,
    sql: S.String,
  },
  $I.annote("MigrationBundleEntry", {
    description: "One timestamped Drizzle migration and its byte-exact SQL content.",
  })
) {}

/**
 * Configuration accepted by {@link migrateBundle}.
 *
 * @example
 * ```ts
 * import type { MigrationBundleConfig } from "@beep/postgres"
 *
 * const config: MigrationBundleConfig = {
 *   migrations: [{ name: "20260512000000_example", sql: "CREATE TABLE example (id TEXT);\n" }],
 *   migrationsSchema: "drizzle",
 * }
 * console.log(config.migrations.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MigrationBundleConfig extends S.Class<MigrationBundleConfig>($I`MigrationBundleConfig`)(
  {
    migrations: S.Array(MigrationBundleEntry),
    migrationsSchema: S.optionalKey(S.String),
    migrationsTable: S.optionalKey(S.String),
  },
  $I.annote("MigrationBundleConfig", {
    description: "An in-memory Drizzle migration bundle and optional journal location.",
  })
) {}

// Mirrors drizzle-orm readMigrationFiles (migrator.js) field-for-field so
// in-memory journal rows stay byte-identical to folder-derived ones:
// hash = sha256 of the raw file content, folderMillis from the 14-digit
// name prefix (drizzle's own formatToMillis), sql split on the breakpoint
// marker. Deriving from {name, sql} at runtime makes a hash/sql mismatch
// unrepresentable. The real hash (drizzle's own no-fs SQLite migrators write
// hash: "") is what keeps the v0->v1 journal upgrade path viable — it matches
// legacy rows by millis then hash — and keeps bundle-migrated databases
// reconcilable with drizzle-kit-migrated ones.
// The drizzle v1 journal matches pending migrations by name alone, and its
// matcher treats a falsy name as "always run" — so the schema rejects unnamed
// entries before they can silently re-apply on every boot.
const migrationMetaFromBundleEntry = (entry: MigrationBundleEntry): MigrationMeta => ({
  bps: true,
  folderMillis: formatToMillis(Str.slice(0, 14)(entry.name)),
  hash: createHash("sha256").update(entry.sql).digest("hex"),
  name: entry.name,
  sql: pipe(entry.sql, Str.split("--> statement-breakpoint"), A.flatMap(splitLegacyMigrationStatement)),
});

const decodeMigrationBundleConfig = S.decodeUnknownEffect(MigrationBundleConfig);

const InMemoryBundleFolderSentinel = "<in-memory-bundle>";

/**
 * Run Drizzle Effect Postgres migrations from an in-memory bundle instead of
 * a migrations folder. Journal semantics are identical to {@link migrate}:
 * pending selection is keyed on migration name, and hash/millis are derived
 * exactly as drizzle's `readMigrationFiles` derives them, so a database
 * previously migrated from a folder continues seamlessly from a bundle.
 *
 * @example
 * ```ts
 * import { migrateBundle } from "@beep/postgres"
 * import type { PostgresDrizzleDatabase } from "@beep/postgres"
 *
 * const runMigration = (db: PostgresDrizzleDatabase) => {
 *   const migrations = [{ name: "20260512000000_example", sql: "CREATE TABLE example (id TEXT);\n" }]
 *   const effect = migrateBundle(db, { migrations })
 *   const deferred = migrateBundle({ migrations })(db)
 *   return { deferred, effect }
 * }
 * console.log(runMigration)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const migrateBundle: {
  <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
    db: PostgresDrizzleDatabase<TSchema, TRelations>,
    config: MigrationBundleConfig
  ): Effect.Effect<undefined, PostgresError>;
  (
    config: MigrationBundleConfig
  ): <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
    db: PostgresDrizzleDatabase<TSchema, TRelations>
  ) => Effect.Effect<undefined, PostgresError>;
} = dual(
  2,
  <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
    db: PostgresDrizzleDatabase<TSchema, TRelations>,
    config: MigrationBundleConfig
  ): Effect.Effect<undefined, PostgresError> =>
    decodeMigrationBundleConfig(config).pipe(
      Effect.mapError((cause) => PostgresError.fromUnknown("migrateBundle", cause)),
      Effect.map((decoded) => ({
        config: decoded,
        // String ordering mirrors readMigrationFiles' folder ordering.
        migrations: pipe(
          decoded.migrations,
          A.sortWith((entry) => entry.name, Order.String),
          A.map(migrationMetaFromBundleEntry)
        ),
      })),
      Effect.flatMap(({ config: decoded, migrations }) =>
        runPgEffectMigrations(db, migrations, {
          migrationsFolder: InMemoryBundleFolderSentinel,
          ...O.getSomesStruct({
            migrationsSchema: O.fromUndefinedOr(decoded.migrationsSchema),
            migrationsTable: O.fromUndefinedOr(decoded.migrationsTable),
          }),
        })
      )
    )
);
