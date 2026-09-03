/**
 * Postgres-backed Drizzle Effect composition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PostgresId } from "@beep/identity";
import { A, O, Str } from "@beep/utils";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { formatToMillis } from "drizzle-orm/migrator.utils";
import * as PgEffectSessionMigrator from "drizzle-orm/pg-core/effect";
import { Context, Crypto, Effect, Encoding, flow, Layer, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Statement from "effect/unstable/sql/Statement";
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
 * **Example** (Access underlying client)
 *
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
 * **Example** (Empty config object)
 *
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
 * **Example** (Reference service key)
 *
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
 * **Example** (Create drizzle effect)
 *
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
 * **Example** (Build drizzle layer)
 *
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
 * **Example** (Run folder migrations)
 *
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
 * **Example** (Make bundle entry)
 *
 * ```ts
 * import { MigrationBundleEntry } from "@beep/postgres"
 *
 * const entry = MigrationBundleEntry.make({
 *   name: "20260813130540_baseline",
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

const migrationNameEquivalence = S.toEquivalence(MigrationBundleEntryName);
const MigrationBundleLegacyNames = S.NonEmptyArray(MigrationBundleEntryName)
  .check(
    S.makeFilter(
      (names: ReadonlyArray<string>) => A.length(A.dedupeWith(migrationNameEquivalence)(names)) === A.length(names),
      {
        identifier: $I`MigrationBundleLegacyNamesUniqueItemsCheck`,
        title: "Unique legacy migration names",
        description: "One compatibility set must not repeat a legacy journal name.",
        message: "Legacy migration names must be unique within a compatibility set.",
      }
    )
  )
  .pipe(
    $I.annoteSchema("MigrationBundleLegacyNames", {
      description: "Non-empty unique legacy journal names that jointly prove one canonical migration was applied.",
    })
  );

/**
 * A complete legacy journal-name set that proves one canonical bundle entry
 * was already applied before a migration-history re-baseline.
 *
 * **Example** (Declare a re-baseline compatibility set)
 *
 * ```ts
 * import { MigrationBundleLegacyNameSet } from "@beep/postgres"
 *
 * const compatibility = MigrationBundleLegacyNameSet.make({
 *   canonicalName: "20260813130540_baseline",
 *   legacyNames: ["20260725222615_baseline"]
 * })
 * console.log(compatibility.legacyNames.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MigrationBundleLegacyNameSet extends S.Class<MigrationBundleLegacyNameSet>(
  $I`MigrationBundleLegacyNameSet`
)(
  {
    canonicalName: MigrationBundleEntryName,
    legacyNames: MigrationBundleLegacyNames,
  },
  $I.annote("MigrationBundleLegacyNameSet", {
    description:
      "Canonical migration name plus the complete legacy journal-name set required to skip its re-baselined SQL.",
  })
) {}

/**
 * Configuration accepted by {@link migrateBundle}.
 *
 * **Example** (Bundle config with migrations)
 *
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
    legacyNameSets: MigrationBundleLegacyNameSet.pipe(S.Array, S.optionalKey),
    migrations: S.Array(MigrationBundleEntry),
    migrationsSchema: S.optionalKey(S.String),
    migrationsTable: S.optionalKey(S.String),
  },
  $I.annote("MigrationBundleConfig", {
    description: "An in-memory Drizzle migration bundle and optional journal location.",
  })
) {}

const MigrationJournalShapeRow = S.Struct({ exists: S.Boolean, hasName: S.Boolean }).pipe(
  $I.annoteSchema("MigrationJournalShapeRow", {
    description: "Information-schema projection used to detect a current or legacy Drizzle journal.",
  })
);
const MigrationJournalNameRow = S.Struct({ name: S.NullOr(S.String) }).pipe(
  $I.annoteSchema("MigrationJournalNameRow", {
    description: "Current Drizzle journal-name row decoded from a migration table.",
  })
);
const MigrationJournalCreatedAtText = S.String.check(
  S.isPattern(/^\d{4,}$/u, {
    identifier: $I`MigrationJournalCreatedAtTextCheck`,
    title: "Legacy migration created-at text",
    description: "Legacy Drizzle created_at values must be decimal integers with a millisecond suffix.",
    message: "Expected a decimal legacy migration timestamp.",
  })
).pipe(
  $I.annoteSchema("MigrationJournalCreatedAtText", {
    description: "Text projection of a legacy Drizzle journal created_at bigint.",
  })
);
const LegacyMigrationJournalRow = S.Struct({
  createdAt: MigrationJournalCreatedAtText,
  hash: S.String,
}).pipe(
  $I.annoteSchema("LegacyMigrationJournalRow", {
    description: "Version-zero Drizzle journal row used for a fail-closed name upgrade.",
  })
);
type LegacyMigrationJournalRow = typeof LegacyMigrationJournalRow.Type;
const decodeJournalMillis = S.decodeUnknownEffect(S.FiniteFromString.check(S.isInt()));
const migrationMillisEquivalence = S.toEquivalence(S.Int);

const migrationMetaFromLegacyName = (name: string, hash = ""): MigrationMeta => ({
  bps: true,
  folderMillis: formatToMillis(Str.slice(0, 14)(name)),
  hash,
  name,
  sql: A.empty<string>(),
});

const failMigrationJournal = (message: string): PostgresError =>
  PostgresError.fromUnknown("migrateBundle", undefined, { message });

const requireUniqueMigrationCandidate = (
  candidates: ReadonlyArray<MigrationMeta>,
  row: LegacyMigrationJournalRow
): Effect.Effect<MigrationMeta, PostgresError> =>
  A.match(candidates, {
    onEmpty: () =>
      Effect.fail(
        failMigrationJournal(
          `Legacy migration journal row ${row.createdAt} does not match the current bundle or a declared compatibility name.`
        )
      ),
    onNonEmpty: ([candidate, ...remaining]) =>
      A.isReadonlyArrayEmpty(remaining)
        ? Effect.succeed(candidate)
        : Effect.fail(
            failMigrationJournal(
              `Legacy migration journal row ${row.createdAt} is ambiguous; rebuild the database or provide an unambiguous migration history.`
            )
          ),
  });

const resolveLegacyMigrationJournalRow = Effect.fn("Postgres.resolveLegacyMigrationJournalRow")(function* (
  row: LegacyMigrationJournalRow,
  candidates: ReadonlyArray<MigrationMeta>
) {
  const normalizedMillis = `${Str.slice(0, -3)(row.createdAt)}000`;
  const createdAtMillis = yield* decodeJournalMillis(normalizedMillis).pipe(
    Effect.mapError(() =>
      failMigrationJournal(`Legacy migration journal row ${row.createdAt} has an invalid timestamp.`)
    )
  );
  const millisMatches = A.filter(candidates, (candidate) =>
    migrationMillisEquivalence(candidate.folderMillis, createdAtMillis)
  );
  const matches = A.isReadonlyArrayNonEmpty(millisMatches)
    ? A.length(millisMatches) === 1
      ? millisMatches
      : A.filter(millisMatches, (candidate) => Str.Equivalence(candidate.hash, row.hash))
    : A.filter(candidates, (candidate) => Str.Equivalence(candidate.hash, row.hash));
  const resolved = yield* requireUniqueMigrationCandidate(matches, row);
  return { ...resolved, hash: row.hash } satisfies MigrationMeta;
});

const migrationMetaNameEquivalence = (left: MigrationMeta, right: MigrationMeta): boolean =>
  migrationNameEquivalence(left.name, right.name);

const readMigrationJournalState = Effect.fn("Postgres.readMigrationJournalState")(
  function* <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
    db: PostgresDrizzleDatabase<TSchema, TRelations>,
    migrationsSchema: string,
    migrationsTable: string,
    migrations: ReadonlyArray<MigrationMeta>,
    legacyNameSets: ReadonlyArray<MigrationBundleLegacyNameSet>
  ) {
    const sql = db.$client.withoutTransforms();
    const shapeRows = yield* sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = ${migrationsSchema} AND table_name = ${migrationsTable}
      ) AS exists,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = ${migrationsSchema}
          AND table_name = ${migrationsTable}
          AND column_name = 'name'
      ) AS "hasName"
    `;
    const shape = yield* S.decodeUnknownEffect(S.Array(MigrationJournalShapeRow))(shapeRows).pipe(
      Effect.flatMap((rows) =>
        A.head(rows).pipe(
          Effect.fromOption(() => failMigrationJournal("Postgres returned no migration journal shape row."))
        )
      )
    );
    if (!shape.exists) {
      return [A.empty<string>(), A.empty<MigrationMeta>()] as const;
    }
    if (!shape.hasName) {
      const legacyRows = yield* sql`
        SELECT hash, created_at::text AS "createdAt"
        FROM ${Statement.identifier(migrationsSchema)}.${Statement.identifier(migrationsTable)}
        ORDER BY id
      `;
      const decodedRows = yield* S.decodeUnknownEffect(S.Array(LegacyMigrationJournalRow))(legacyRows);
      const legacyCandidates = pipe(
        legacyNameSets,
        A.flatMap((entry) => entry.legacyNames),
        A.dedupeWith(migrationNameEquivalence),
        A.map((name) => migrationMetaFromLegacyName(name))
      );
      const candidates = A.dedupeWith(A.appendAll(migrations, legacyCandidates), migrationMetaNameEquivalence);
      const resolved = yield* Effect.forEach(decodedRows, (row) => resolveLegacyMigrationJournalRow(row, candidates), {
        concurrency: 1,
      });
      const currentNames = A.map(migrations, (migration) => migration.name);
      const upgradeMigrations = A.filter(
        resolved,
        (migration) => !A.containsWith(migrationNameEquivalence)(currentNames, migration.name)
      );
      return [A.map(resolved, (migration) => migration.name), upgradeMigrations] as const;
    }
    const nameRows = yield* sql`
      SELECT name
      FROM ${Statement.identifier(migrationsSchema)}.${Statement.identifier(migrationsTable)}
      ORDER BY id
    `;
    const decodedNames = yield* S.decodeUnknownEffect(S.Array(MigrationJournalNameRow))(nameRows);
    return [A.getSomes(A.map(decodedNames, (row) => O.fromNullishOr(row.name))), A.empty<MigrationMeta>()] as const;
  },
  Effect.mapError((cause) => PostgresError.fromUnknown("migrateBundle", cause))
);

const reconcileLegacyMigrationNames = Effect.fn("Postgres.reconcileLegacyMigrationNames")(function* (
  migrations: ReadonlyArray<MigrationMeta>,
  legacyNameSets: ReadonlyArray<MigrationBundleLegacyNameSet>,
  journalNames: ReadonlyArray<string>
) {
  const reconciled = yield* Effect.forEach(
    migrations,
    Effect.fn(function* (migration) {
      const compatibility = A.findFirst(legacyNameSets, (entry) =>
        migrationNameEquivalence(entry.canonicalName, migration.name)
      );
      if (O.isNone(compatibility) || A.containsWith(migrationNameEquivalence)(journalNames, migration.name)) {
        return O.some(migration);
      }
      const matchedLegacyNames = A.filter(compatibility.value.legacyNames, (name) =>
        A.containsWith(migrationNameEquivalence)(journalNames, name)
      );
      if (A.isReadonlyArrayEmpty(matchedLegacyNames)) {
        return O.some(migration);
      }
      if (A.length(matchedLegacyNames) === A.length(compatibility.value.legacyNames)) {
        return O.none<MigrationMeta>();
      }
      return yield* PostgresError.fromUnknown("migrateBundle", undefined, {
        message: `Refusing a partial legacy migration history for ${migration.name}; apply the complete pre-baseline history or rebuild the database.`,
      });
    }),
    { concurrency: 1 }
  );
  return A.getSomes(reconciled);
});

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
const migrationMetaFromBundleEntry = Effect.fn("Postgres.migrationMetaFromBundleEntry")(function* (
  entry: MigrationBundleEntry
): Effect.fn.Return<MigrationMeta, PostgresError, Crypto.Crypto> {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto
    .digest("SHA-256", new TextEncoder().encode(entry.sql))
    .pipe(Effect.mapError((cause) => PostgresError.fromUnknown("migrateBundle", cause)));
  return {
    bps: true,
    folderMillis: formatToMillis(Str.slice(0, 14)(entry.name)),
    hash: Encoding.encodeHex(digest),
    name: entry.name,
    sql: pipe(entry.sql, Str.split("--> statement-breakpoint"), A.flatMap(splitLegacyMigrationStatement)),
  };
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
 * **Example** (Run in-memory migrations)
 *
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
  ): Effect.Effect<undefined, PostgresError, Crypto.Crypto>;
  (
    config: MigrationBundleConfig
  ): <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
    db: PostgresDrizzleDatabase<TSchema, TRelations>
  ) => Effect.Effect<undefined, PostgresError, Crypto.Crypto>;
} = dual(
  2,
  <TSchema extends Record<string, unknown>, TRelations extends AnyRelations>(
    db: PostgresDrizzleDatabase<TSchema, TRelations>,
    config: MigrationBundleConfig
  ): Effect.Effect<undefined, PostgresError, Crypto.Crypto> =>
    decodeMigrationBundleConfig(config).pipe(
      Effect.mapError((cause) => PostgresError.fromUnknown("migrateBundle", cause)),
      Effect.flatMap((decoded) =>
        Effect.forEach(
          A.sortWith(decoded.migrations, (entry) => entry.name, Order.String),
          migrationMetaFromBundleEntry,
          { concurrency: "unbounded" }
        ).pipe(Effect.map((migrations) => ({ config: decoded, migrations })))
      ),
      Effect.flatMap(
        Effect.fn(function* ({ config: decoded, migrations }) {
          const legacyNameSets = pipe(
            decoded.legacyNameSets,
            O.fromUndefinedOr,
            O.getOrElse(A.empty<MigrationBundleLegacyNameSet>)
          );
          const migrationsSchema = pipe(
            decoded.migrationsSchema,
            O.fromUndefinedOr,
            O.getOrElse(() => "drizzle")
          );
          const migrationsTable = pipe(
            decoded.migrationsTable,
            O.fromUndefinedOr,
            O.getOrElse(() => "__drizzle_migrations")
          );
          const [journalNames, upgradeMigrations] = A.isReadonlyArrayEmpty(legacyNameSets)
            ? [A.empty<string>(), A.empty<MigrationMeta>()]
            : yield* readMigrationJournalState(db, migrationsSchema, migrationsTable, migrations, legacyNameSets);
          const reconciledMigrations = A.isReadonlyArrayEmpty(legacyNameSets)
            ? migrations
            : yield* reconcileLegacyMigrationNames(migrations, legacyNameSets, journalNames);
          return yield* runPgEffectMigrations(db, A.appendAll(upgradeMigrations, reconciledMigrations), {
            migrationsFolder: InMemoryBundleFolderSentinel,
            migrationsSchema,
            migrationsTable,
          });
        })
      )
    )
);
