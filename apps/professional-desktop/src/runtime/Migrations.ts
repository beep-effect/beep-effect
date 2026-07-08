/**
 * Runtime migration bundle for the Professional Desktop chat sidecar.
 *
 * The repo's internal `db-admin` package remains the migration-generation home.
 * The sidecar owns this small runtime bundle so production code does not depend
 * on `_internal/db-admin`, and so the compiled sidecar has the SQL it needs at
 * boot instead of resolving files from the monorepo checkout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { migrate, PostgresDrizzle, PostgresError } from "@beep/postgres";
import { SchemaUtils } from "@beep/schema";
import { Effect, FileSystem, Path } from "effect";
import * as S from "effect/Schema";

// cspell:words TIMESTAMPTZ

const $I = $ProfessionalDesktopId.create("runtime/Migrations");

class MigrationFile extends S.Class<MigrationFile>($I`MigrationFile`)(
  {
    name: S.String,
    sql: S.String,
  },
  $I.annote("MigrationFile", {
    description: "A migration file for the Professional Desktop chat sidecar.",
  })
) {}

/**
 * Default schema for the Professional Desktop Drizzle migration journal.
 *
 * @example
 * ```ts
 * import { migrationsSchema } from "@/runtime/Migrations"
 *
 * console.log(migrationsSchema)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
const migrationsSchema = "drizzle" as const;

const PostgresSchemaName = S.NonEmptyString.pipe(
  S.check(
    S.isPattern(/^[A-Za-z_][A-Za-z0-9_]*$/, {
      identifier: $I`PostgresSchemaNamePattern`,
      title: "Postgres Schema Name",
      description: "Postgres schema names accepted by the Professional Desktop migration journal option.",
      message: "Expected a Postgres schema name starting with a letter or underscore",
    })
  ),
  $I.annoteSchema("PostgresSchemaName", {
    description: "Identifier-like Postgres schema name used for Drizzle migration journaling.",
  })
);

// <generated:migration-bundle>
const MigrationBundle: ReadonlyArray<MigrationFile> = [
  {
    name: "20260512000000_architecture_lab_work_item",
    sql: `CREATE TABLE architecture_lab_work_item (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`,
  },
  {
    name: "20260512001000_architecture_lab_worker_archetype",
    sql: `CREATE TABLE architecture_lab_worker (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

ALTER TABLE architecture_lab_work_item
  ADD COLUMN assignee_id INTEGER,
  ADD COLUMN priority TEXT,
  DROP COLUMN assignee;
`,
  },
  {
    name: "20260613000000_workspace_thread_domain",
    sql: `CREATE TABLE workspace_thread (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  title TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE TABLE workspace_turn (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  items JSONB NOT NULL,
  parent_turn_id INTEGER,
  thread_id INTEGER NOT NULL,
  turn_index INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE TABLE workspace_message (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  content JSONB NOT NULL,
  role TEXT NOT NULL,
  thread_id INTEGER NOT NULL,
  turn_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);
`,
  },
  {
    name: "20260613000010_epistemic_usage_record",
    sql: `CREATE TABLE epistemic_usage_record (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  activity_id INTEGER NOT NULL,
  actor JSONB NOT NULL,
  cost_usd_approx_micros INTEGER,
  credential_reference TEXT,
  input_tokens INTEGER,
  latency_millis INTEGER,
  metadata JSONB NOT NULL,
  model TEXT NOT NULL,
  output_tokens INTEGER,
  provider TEXT NOT NULL,
  total_tokens INTEGER,
  unit_count INTEGER,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);
`,
  },
];
// </generated:migration-bundle>

const mapMigrationBundleError = (cause: unknown): PostgresError =>
  PostgresError.fromUnknown("prepareMigrations", cause);

const makeMigrationBundleFolder = Effect.fn("ProfessionalDesktop.Migrations.makeMigrationBundleFolder")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const folder = yield* fs
    .makeTempDirectoryScoped({ prefix: "beep-professional-desktop-migrations-" })
    .pipe(Effect.mapError(mapMigrationBundleError));

  // Current drizzle-orm readMigrationFiles consumes timestamped folders directly
  // and rejects legacy meta/_journal.json, so the generated bundle mirrors that
  // runtime contract: <migration-name>/migration.sql only.
  for (const migration of MigrationBundle) {
    const migrationFolder = path.join(folder, migration.name);
    yield* fs.makeDirectory(migrationFolder, { recursive: true }).pipe(Effect.mapError(mapMigrationBundleError));
    yield* fs
      .writeFileString(path.join(migrationFolder, "migration.sql"), migration.sql)
      .pipe(Effect.mapError(mapMigrationBundleError));
  }

  return folder;
});

/**
 * Options accepted when applying the Professional Desktop runtime migrations.
 *
 * @example
 * ```ts
 * import { ProfessionalDesktopMigrationOptions } from "@/runtime/Migrations"
 *
 * const options = ProfessionalDesktopMigrationOptions.make({ migrationsSchema: "drizzle" })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProfessionalDesktopMigrationOptions extends S.Class<ProfessionalDesktopMigrationOptions>(
  $I`ProfessionalDesktopMigrationOptions`
)(
  {
    migrationsSchema: PostgresSchemaName.pipe(SchemaUtils.withKeyDefaults(migrationsSchema)).annotateKey({
      description: "Drizzle migration journal schema used by the Professional Desktop sidecar database.",
    }),
  },
  $I.annote("ProfessionalDesktopMigrationOptions", {
    description: "Options accepted when applying the Professional Desktop runtime migrations.",
  })
) {}

/**
 * Apply the bundled Professional Desktop migrations against the ambient Drizzle
 * database.
 *
 * @example
 * ```ts
 * import { migrateProfessionalDesktopDatabase } from "@/runtime/Migrations"
 *
 * console.log(migrateProfessionalDesktopDatabase)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const migrateProfessionalDesktopDatabase = (
  options: (typeof ProfessionalDesktopMigrationOptions)["~type.make.in"] = {}
): Effect.Effect<void, PostgresError, FileSystem.FileSystem | Path.Path | PostgresDrizzle> =>
  Effect.scoped(
    Effect.gen(function* () {
      const db = yield* PostgresDrizzle;
      const schema = ProfessionalDesktopMigrationOptions.make(options).migrationsSchema;
      const migrationsFolder = yield* makeMigrationBundleFolder();

      return yield* migrate(db, { migrationsFolder, migrationsSchema: schema });
    })
  );

/**
 * Stderr marker emitted after sidecar migrations finish in IPC mode.
 *
 * The IPC stdio integration test waits for this marker instead of coupling to
 * the human-readable migration log line.
 *
 * @example
 * ```ts
 * import { SidecarReadyMarker } from "@/runtime/Migrations"
 *
 * console.log(SidecarReadyMarker) // "BEEP_PROFESSIONAL_DESKTOP_SIDECAR_READY"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SidecarReadyMarker = "BEEP_PROFESSIONAL_DESKTOP_SIDECAR_READY";

const writeSidecarReadyMarker = Effect.sync(() => {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: CHAT_TRANSPORT is declared in turbo.json under global.passThroughEnv.
  if (Bun.env.CHAT_TRANSPORT === "ipc") {
    process.stderr.write(`${SidecarReadyMarker}\n`);
  }
});

/**
 * Boot-time migration effect for the sidecar database layer.
 *
 * @example
 * ```ts
 * import { migrateOnBoot } from "@/runtime/Migrations"
 *
 * console.log(migrateOnBoot)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const migrateOnBoot: Effect.Effect<void, PostgresError, FileSystem.FileSystem | Path.Path | PostgresDrizzle> =
  migrateProfessionalDesktopDatabase().pipe(
    Effect.tap(() =>
      Effect.logInfo("chat sidecar migrations applied").pipe(
        Effect.annotateLogs({
          component: "professional-desktop",
          migrationsSchema,
        }),
        Effect.andThen(writeSidecarReadyMarker)
      )
    )
  );
