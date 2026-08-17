/**
 * Canonical Drizzle migration execution for effect-ontology.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { fileURLToPath } from "node:url";
import { $ScratchpadId } from "@beep/identity";
import { migrate, PostgresDrizzle } from "@beep/postgres";
import { Effect, Equal, FileSystem, HashSet, Order } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

const $I = $ScratchpadId.create("effect-ontology/Runtime/Persistence/MigrationRunner");

const MigrationHistoryState = S.Struct({
  canonicalJournalExists: S.Boolean,
  legacyJournalExists: S.Boolean,
});

const LegacyMigrationRow = S.Struct({
  name: S.String,
  version: S.Int,
});

const CanonicalMigrationRow = S.Struct({ name: S.String });
const JournalColumn = S.Struct({ columnName: S.String });

const hasJournalColumns = (rows: ReadonlyArray<typeof JournalColumn.Type>, required: ReadonlyArray<string>) =>
  A.every(required, (requiredName) => A.some(rows, (row) => row.columnName === requiredName));

const LegacyMigrationKeys = HashSet.fromIterable([
  "1:001_claims_schema",
  "2:002_bitemporal_timestamps",
  "3:003_claim_idempotency",
  "4:004_ingested_links",
  "5:005_ontology_scoping",
  "6:006_entity_registry_scoping",
  "7:007_llm_examples",
  "8:008_content_hash_scoping",
  "9:009_processing_status",
  "10:010_pgvector_setup",
]);

const migrationHistoryError = (detail: string) =>
  LegacyMigrationHistoryError.make({
    message: `${detail} Recreate the scratch database, then restart to apply the generated Drizzle baseline.`,
  });

/**
 * Refusal raised when an existing database still uses the deleted scratch
 * migration history and cannot be safely rebaselined in place.
 *
 * **Example** (Create reset guidance)
 *
 * ```ts
 * import { LegacyMigrationHistoryError } from "@effect-ontology/Runtime/Persistence/MigrationRunner"
 *
 * const error = LegacyMigrationHistoryError.make({ message: "Recreate the scratch database." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LegacyMigrationHistoryError extends S.TaggedError<LegacyMigrationHistoryError>(
  $I`LegacyMigrationHistoryError`
)(
  "LegacyMigrationHistoryError",
  {
    message: S.NonEmptyString,
  },
  $I.annote("LegacyMigrationHistoryError", {
    description: "An existing scratch database must be recreated before the generated baseline can be applied.",
  })
) {}

/**
 * Absolute folder containing every generated effect-ontology migration.
 *
 * **Example** (Inspect the migration folder)
 *
 * ```ts
 * import { migrationsFolder } from "@effect-ontology/Runtime/Persistence/MigrationRunner"
 *
 * console.log(migrationsFolder.endsWith("/migrations"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const migrationsFolder: string = fileURLToPath(new URL("./migrations", import.meta.url));

/**
 * Applies canonical migrations from an explicit generated folder after the
 * same legacy and journal-prefix preflight used at application startup.
 *
 * **Example** (Inspect an explicit-folder migration runner)
 *
 * ```ts
 * import { migrateFromFolder } from "@effect-ontology/Runtime/Persistence/MigrationRunner"
 *
 * console.log(migrateFromFolder)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const migrateFromFolder = Effect.fn("MigrationRunner.migrateFromFolder")(function* (folder: string) {
  const sql = yield* SqlClient.SqlClient;
  const database = yield* PostgresDrizzle;
  const fs = yield* FileSystem.FileSystem;
  const readHistoryState = SqlSchema.findOne({
    Request: S.Void,
    Result: MigrationHistoryState,
    execute: () => sql`
      SELECT to_regclass('public.schema_migrations') IS NOT NULL AS "legacyJournalExists",
             to_regclass('effect_ontology.__drizzle_migrations') IS NOT NULL AS "canonicalJournalExists"
    `,
  });
  const history = yield* readHistoryState(undefined);
  const expectedCanonicalNames = A.sort(yield* fs.readDirectory(folder), Order.String);

  let knownLegacyRows = 0;
  let legacyRows = 0;
  if (history.legacyJournalExists) {
    const readLegacyColumns = SqlSchema.findAll({
      Request: S.Void,
      Result: JournalColumn,
      execute: () => sql`
        SELECT column_name AS "columnName"
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'schema_migrations'
      `,
    });
    const legacyColumns = yield* readLegacyColumns(undefined);
    if (hasJournalColumns(legacyColumns, ["version", "name"])) {
      const readLegacyRows = SqlSchema.findAll({
        Request: S.Void,
        Result: LegacyMigrationRow,
        execute: () => sql`SELECT version, name FROM public.schema_migrations ORDER BY version`,
      });
      const rows = yield* readLegacyRows(undefined);
      legacyRows = rows.length;
      knownLegacyRows = A.filter(rows, (row) => HashSet.has(LegacyMigrationKeys, `${row.version}:${row.name}`)).length;
      if (legacyRows === 0) {
        return yield* migrationHistoryError("An empty public.schema_migrations journal is ambiguous after rebaseline.");
      }
    }
  }

  if (history.canonicalJournalExists) {
    const readCanonicalColumns = SqlSchema.findAll({
      Request: S.Void,
      Result: JournalColumn,
      execute: () => sql`
        SELECT column_name AS "columnName"
        FROM information_schema.columns
        WHERE table_schema = 'effect_ontology' AND table_name = '__drizzle_migrations'
      `,
    });
    if (!hasJournalColumns(yield* readCanonicalColumns(undefined), ["id", "hash", "name", "created_at"])) {
      return yield* migrationHistoryError(
        "The canonical effect-ontology migration journal has an unsupported table shape."
      );
    }
    const readCanonicalRows = SqlSchema.findAll({
      Request: S.Void,
      Result: CanonicalMigrationRow,
      execute: () => sql`SELECT name FROM effect_ontology.__drizzle_migrations ORDER BY id`,
    });
    const actualCanonicalNames = A.map(yield* readCanonicalRows(undefined), (row) => row.name);
    if (!Equal.equals(actualCanonicalNames, A.take(expectedCanonicalNames, actualCanonicalNames.length))) {
      return yield* migrationHistoryError(
        "The canonical effect-ontology migration journal contains unknown or out-of-order migration names."
      );
    }
  }

  if (knownLegacyRows > 0) {
    const state =
      knownLegacyRows === legacyRows && knownLegacyRows === HashSet.size(LegacyMigrationKeys)
        ? "complete"
        : "partial or mixed";
    return yield* migrationHistoryError(
      `A ${state} legacy effect-ontology migration history cannot be upgraded in place.`
    );
  }
  yield* migrate(database, { migrationsFolder: folder, migrationsSchema: "effect_ontology" });
});

/**
 * Applies every pending generated migration with canonical Drizzle journal,
 * hash, transaction, and future-folder semantics.
 *
 * **Details**
 *
 * `@beep/postgres` owns migration-file decoding and the Drizzle journal. A
 * second invocation is a no-op, while later timestamped folders are applied in
 * order without changing this runtime module.
 *
 * **Example** (Compose startup migration)
 *
 * ```ts
 * import { migrateOnBoot } from "@effect-ontology/Runtime/Persistence/MigrationRunner"
 *
 * console.log(migrateOnBoot)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const migrateOnBoot = migrateFromFolder(migrationsFolder);
