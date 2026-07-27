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
import { profilePhase } from "@beep/observability";
import { migrateBundle, PostgresDrizzle } from "@beep/postgres";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { migrationBundle } from "./Migrations.gen.ts";
import type { PostgresError } from "@beep/postgres";

const $I = $ProfessionalDesktopId.create("runtime/Migrations");

// Default schema for the Professional Desktop Drizzle migration journal.
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
 * Apply the bundled Professional Desktop migrations against the ambient
 * Drizzle database, entirely in-memory.
 *
 * @example
 * ```ts
 * import { migrateProfessionalDesktopDatabase } from "@/runtime/Migrations"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(migrateProfessionalDesktopDatabase())) // true
 * ```
 *
 * @effects Applies the bundled Drizzle migrations to the ambient database.
 * @category constructors
 * @since 0.0.0
 */
export const migrateProfessionalDesktopDatabase = Effect.fn("professional_desktop.database.migrate")(function* (
  options: (typeof ProfessionalDesktopMigrationOptions)["~type.make.in"] = {}
): Effect.fn.Return<void, PostgresError, PostgresDrizzle> {
  const db = yield* PostgresDrizzle;
  const schema = ProfessionalDesktopMigrationOptions.make(options).migrationsSchema;

  yield* migrateBundle(db, { migrations: migrationBundle, migrationsSchema: schema });
});

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
 * console.log(SidecarReadyMarker.endsWith("SIDECAR_READY")) // true
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
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(migrateOnBoot)) // true
 * ```
 *
 * @effects Applies database migrations, logs completion, and emits the IPC-ready marker.
 * @category constructors
 * @since 0.0.0
 */
export const migrateOnBoot: Effect.Effect<void, PostgresError, PostgresDrizzle> = profilePhase(
  migrateProfessionalDesktopDatabase(),
  { phase: "professional_desktop.database.migrate" }
).pipe(
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
