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
import { profilePhase } from "@beep/observability";
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
  public_id TEXT NOT NULL,
  status TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX architecture_lab_worker_public_id_unique_idx
  ON architecture_lab_worker (public_id);

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
  public_id TEXT NOT NULL,
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

CREATE UNIQUE INDEX workspace_thread_public_id_unique_idx
  ON workspace_thread (public_id);

CREATE TABLE workspace_turn (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
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

CREATE UNIQUE INDEX workspace_turn_public_id_unique_idx
  ON workspace_turn (public_id);

CREATE TABLE workspace_message (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
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

CREATE UNIQUE INDEX workspace_message_public_id_unique_idx
  ON workspace_message (public_id);
`,
  },
  {
    name: "20260613000010_epistemic_usage_record",
    sql: `CREATE TABLE epistemic_usage_record (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
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

CREATE UNIQUE INDEX epistemic_usage_record_public_id_unique_idx
  ON epistemic_usage_record (public_id);
`,
  },
  {
    name: "20260708000000_workspace_vault_config",
    sql: `CREATE TABLE workspace_workspace (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  fixture_key TEXT NOT NULL,
  name TEXT NOT NULL,
  organization_fixture_key TEXT NOT NULL,
  owner_principal_fixture_key TEXT NOT NULL,
  vault_root_path TEXT,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX workspace_workspace_public_id_unique_idx
  ON workspace_workspace (public_id);
`,
  },
  {
    name: "20260711000000_documents_sync_state",
    sql: `CREATE TABLE documents_sync_item (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  content_digest TEXT,
  content_size_bytes INTEGER,
  item_kind TEXT NOT NULL,
  last_error TEXT,
  last_pushed_digest TEXT,
  last_pushed_generation INTEGER,
  local_generation INTEGER NOT NULL,
  local_rel_path TEXT NOT NULL,
  provider TEXT NOT NULL,
  remote_id TEXT,
  remote_name TEXT,
  remote_parent_id TEXT,
  sync_state TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX documents_sync_item_public_id_unique_idx
  ON documents_sync_item (public_id);

CREATE INDEX documents_sync_item_local_rel_path_lookup_idx
  ON documents_sync_item (local_rel_path);

CREATE INDEX documents_sync_item_remote_id_lookup_idx
  ON documents_sync_item (remote_id);

CREATE INDEX documents_sync_item_sync_state_lookup_idx
  ON documents_sync_item (sync_state);

CREATE INDEX documents_sync_item_workspace_id_btree_idx
  ON documents_sync_item (workspace_id);

CREATE TABLE documents_sync_operation (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  attempt_count INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_content_digest TEXT,
  input_generation INTEGER NOT NULL,
  last_error TEXT,
  operation_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  sync_item_id INTEGER NOT NULL,
  target_name TEXT NOT NULL,
  target_parent_rel_path TEXT,
  target_rel_path TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX documents_sync_operation_public_id_unique_idx
  ON documents_sync_operation (public_id);

CREATE UNIQUE INDEX documents_sync_operation_idempotency_key_unique_idx
  ON documents_sync_operation (idempotency_key);

CREATE INDEX documents_sync_operation_status_lookup_idx
  ON documents_sync_operation (status);

CREATE INDEX documents_sync_operation_sync_item_id_lookup_idx
  ON documents_sync_operation (sync_item_id);

CREATE INDEX documents_sync_operation_workspace_id_btree_idx
  ON documents_sync_operation (workspace_id);

CREATE TABLE documents_sync_cursor (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  last_error TEXT,
  last_event_id TEXT,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  stream_position TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX documents_sync_cursor_public_id_unique_idx
  ON documents_sync_cursor (public_id);

CREATE INDEX documents_sync_cursor_workspace_id_btree_idx
  ON documents_sync_cursor (workspace_id);

CREATE TABLE documents_sync_conflict (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  conflict_kind TEXT NOT NULL,
  local_rel_path TEXT,
  provider TEXT NOT NULL,
  remote_event_id TEXT,
  remote_id TEXT,
  remote_payload JSONB NOT NULL,
  resolution_status TEXT NOT NULL,
  sync_item_id INTEGER,
  workspace_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX documents_sync_conflict_public_id_unique_idx
  ON documents_sync_conflict (public_id);

CREATE INDEX documents_sync_conflict_conflict_kind_lookup_idx
  ON documents_sync_conflict (conflict_kind);

CREATE INDEX documents_sync_conflict_remote_event_id_lookup_idx
  ON documents_sync_conflict (remote_event_id);

CREATE INDEX documents_sync_conflict_resolution_status_lookup_idx
  ON documents_sync_conflict (resolution_status);

CREATE INDEX documents_sync_conflict_workspace_id_btree_idx
  ON documents_sync_conflict (workspace_id);
`,
  },
  {
    name: "20260726000000_epistemic_bitemporal_edge",
    sql: `CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE epistemic_candidate_claim (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  fixture_key TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX epistemic_candidate_claim_public_id_unique_idx
  ON epistemic_candidate_claim (public_id);

CREATE TABLE epistemic_evidence (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  artifact_fixture_key TEXT NOT NULL,
  span JSONB NOT NULL,
  span_fixture_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX epistemic_evidence_public_id_unique_idx
  ON epistemic_evidence (public_id);

CREATE TABLE epistemic_edge_version (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  evidence_scope TEXT,
  expired_at BIGINT,
  fact JSONB NOT NULL,
  logical_key TEXT NOT NULL,
  matter_scope TEXT,
  qualifiers JSONB NOT NULL,
  recorded_at BIGINT NOT NULL,
  relation TEXT NOT NULL,
  source_claim_id INTEGER CONSTRAINT epistemic_edge_source_claim_fk REFERENCES epistemic_candidate_claim (id),
  source_entity_ref TEXT,
  source_evidence_id INTEGER CONSTRAINT epistemic_edge_source_evidence_fk REFERENCES epistemic_evidence (id),
  source_kind TEXT NOT NULL,
  source_observation_ref TEXT,
  supersedes_id INTEGER CONSTRAINT epistemic_edge_supersedes_fk REFERENCES epistemic_edge_version (id),
  target_claim_id INTEGER CONSTRAINT epistemic_edge_target_claim_fk REFERENCES epistemic_candidate_claim (id),
  target_entity_ref TEXT,
  target_evidence_id INTEGER CONSTRAINT epistemic_edge_target_evidence_fk REFERENCES epistemic_evidence (id),
  target_kind TEXT NOT NULL,
  target_observation_ref TEXT,
  valid_from BIGINT NOT NULL,
  valid_to BIGINT,
  version INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY,
  CONSTRAINT epistemic_edge_valid_ordered CHECK (valid_to IS NULL OR valid_from < valid_to),
  CONSTRAINT epistemic_edge_txn_ordered CHECK (expired_at IS NULL OR recorded_at < expired_at),
  CONSTRAINT epistemic_edge_no_self_supersede CHECK (supersedes_id IS NULL OR supersedes_id <> id),
  CONSTRAINT epistemic_edge_source_bounded CHECK (
    source_kind IN ('claim', 'evidence', 'entity', 'observation')
    AND ((source_kind = 'claim') = (source_claim_id IS NOT NULL))
    AND ((source_kind = 'evidence') = (source_evidence_id IS NOT NULL))
    AND ((source_kind = 'entity') = (source_entity_ref IS NOT NULL))
    AND ((source_kind = 'observation') = (source_observation_ref IS NOT NULL))
  ),
  CONSTRAINT epistemic_edge_target_bounded CHECK (
    target_kind IN ('claim', 'evidence', 'entity', 'observation')
    AND ((target_kind = 'claim') = (target_claim_id IS NOT NULL))
    AND ((target_kind = 'evidence') = (target_evidence_id IS NOT NULL))
    AND ((target_kind = 'entity') = (target_entity_ref IS NOT NULL))
    AND ((target_kind = 'observation') = (target_observation_ref IS NOT NULL))
  ),
  CONSTRAINT epistemic_edge_logical_version_unique UNIQUE (logical_key, version),
  CONSTRAINT epistemic_edge_no_overlap EXCLUDE USING gist (
    logical_key WITH =,
    int8range(valid_from, valid_to, '[)') WITH &&
  ) WHERE (expired_at IS NULL)
);

CREATE UNIQUE INDEX epistemic_edge_version_public_id_unique_idx
  ON epistemic_edge_version (public_id);

CREATE UNIQUE INDEX epistemic_edge_open_head_idx
  ON epistemic_edge_version (logical_key)
  WHERE valid_to IS NULL AND expired_at IS NULL;

CREATE INDEX epistemic_edge_asof_idx
  ON epistemic_edge_version (logical_key, valid_from, recorded_at);

CREATE INDEX epistemic_edge_qualifiers_gin_idx
  ON epistemic_edge_version USING gin (qualifiers);

CREATE TABLE epistemic_claim_disposition (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  claim_id INTEGER NOT NULL CONSTRAINT epistemic_claim_disposition_claim_fk REFERENCES epistemic_candidate_claim (id),
  reason TEXT NOT NULL,
  resolved_at BIGINT NOT NULL,
  resolved_by JSONB NOT NULL,
  status TEXT NOT NULL CONSTRAINT epistemic_claim_disposition_bounded CHECK (
    status IN ('active', 'rejected', 'superseded')
  ),
  violations JSONB NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX epistemic_claim_disposition_public_id_unique_idx
  ON epistemic_claim_disposition (public_id);
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
  profilePhase(migrateProfessionalDesktopDatabase(), { phase: "professional_desktop.database.migrate" }).pipe(
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
