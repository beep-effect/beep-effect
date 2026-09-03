/**
 * Runtime migrations for the Professional Desktop chat sidecar.
 *
 * The repo's internal `db-admin` package is the migration-authoring home.
 * The sidecar embeds a generated data module (`Migrations.gen.ts`, synced from
 * `db-admin/drizzle` by `scripts/sync-migration-bundle.ts`) so production code
 * does not depend on `_internal/db-admin`, and applies it in-memory via
 * {@link migrateBundle} — the compiled sidecar never touches the filesystem to
 * migrate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { profilePhase } from "@beep/observability/PhaseProfiler";
import { MigrationBundleLegacyNameSet, migrateBundle, PostgresDrizzle } from "@beep/postgres";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { migrationBundle } from "./Migrations.gen.ts";
import type { PostgresError } from "@beep/postgres";
import type * as Crypto from "effect/Crypto";

const $I = $ProfessionalDesktopId.create("runtime/Migrations");

// Default schema for the Professional Desktop Drizzle migration journal.
const migrationsSchema = "drizzle" as const;
const legacyPreBaselineNames = A.make(
  "20260512000000_architecture_lab_work_item",
  "20260512001000_architecture_lab_worker_archetype",
  "20260613000000_workspace_thread_domain",
  "20260613000010_epistemic_usage_record",
  "20260708000000_workspace_vault_config",
  "20260711000000_documents_sync_state",
  "20260725222615_baseline",
  "20260726000000_epistemic_bitemporal_edge",
  "20260726210000_epistemic_execution_ledger",
  "20260730042420_epistemic_contradiction_triage",
  "20260730043536_epistemic_evidence_verification",
  "20260801021411_usage_record_optional_activity",
  "20260806031625_law_practice_candor_gate",
  "20260807061034_law_practice_legal_position"
);
const legacyNameSets = [
  MigrationBundleLegacyNameSet.make({
    canonicalName: "20260813130540_baseline",
    legacyNames: legacyPreBaselineNames,
  }),
  MigrationBundleLegacyNameSet.make({
    canonicalName: "20260813143745_baseline-functions",
    legacyNames: legacyPreBaselineNames,
  }),
  MigrationBundleLegacyNameSet.make({
    canonicalName: "20260814001821_law_practice_st13_office_identity",
    legacyNames: ["20260813173652_law_practice_st13_office_identity"],
  }),
];

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

/**
 * Options accepted when applying the Professional Desktop runtime migrations.
 *
 * **Example** (Making options with make)
 *
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
 * Apply the bundled Professional Desktop migrations against the ambient
 * Drizzle database, entirely in-memory.
 *
 * **Example** (Checking Effect return type)
 *
 * ```ts
 * import { migrateProfessionalDesktopDatabase } from "@/runtime/Migrations"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(migrateProfessionalDesktopDatabase())) // true
 * ```
 *
 * @effects Applies the bundled Drizzle migrations to the ambient database.
 * @category constructors
 * @since 0.0.0
 */
export const migrateProfessionalDesktopDatabase = Effect.fn("professional_desktop.database.migrate")(function* (
  options: (typeof ProfessionalDesktopMigrationOptions)["~type.make.in"] = {}
): Effect.fn.Return<void, PostgresError, Crypto.Crypto | PostgresDrizzle> {
  const db = yield* PostgresDrizzle;
  const schema = ProfessionalDesktopMigrationOptions.make(options).migrationsSchema;

  yield* migrateBundle(db, { legacyNameSets, migrations: migrationBundle, migrationsSchema: schema });
});

/**
 * Stderr marker emitted after the complete sidecar runtime is ready.
 *
 * **Details**
 *
 * The native shell and IPC stdio integration test wait for this marker instead
 * of coupling to human-readable log output. {@link migrateOnBoot} owns only the
 * database phase; `server/main.ts` emits the marker after every transport and
 * handler layer is live.
 *
 * **Example** (Verifying ready marker suffix)
 *
 * ```ts
 * import { SidecarReadyMarker } from "@/runtime/Migrations"
 *
 * console.log(SidecarReadyMarker.endsWith("SIDECAR_READY")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SidecarReadyMarker = "BEEP_PROFESSIONAL_DESKTOP_SIDECAR_READY";

/**
 * Boot-time migration effect for the sidecar database layer.
 *
 * **Example** (Checking Effect type)
 *
 * ```ts
 * import { migrateOnBoot } from "@/runtime/Migrations"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(migrateOnBoot)) // true
 * ```
 *
 * @effects Applies database migrations and logs completion.
 * @category constructors
 * @since 0.0.0
 */
export const migrateOnBoot: Effect.Effect<void, PostgresError, Crypto.Crypto | PostgresDrizzle> = profilePhase(
  migrateProfessionalDesktopDatabase(),
  { phase: "professional_desktop.database.migrate" }
).pipe(
  Effect.tap(() =>
    Effect.logInfo("chat sidecar migrations applied").pipe(
      Effect.annotateLogs({
        component: "professional-desktop",
        migrationsSchema,
      })
    )
  )
);
