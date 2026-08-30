/**
 * Canonical Drizzle migration execution for effect-ontology.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { fileURLToPath } from "node:url";
import { migrate, PostgresDrizzle } from "@beep/postgres";
import { Effect } from "effect";

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
 * Applies canonical migrations from an explicit generated folder.
 *
 * **Example** (Apply migrations from a generated folder)
 *
 * ```ts
 * import { migrateFromFolder, migrateOnBoot, migrationsFolder } from "@effect-ontology/Runtime/Persistence/MigrationRunner"
 *
 * const migrate = migrateFromFolder(migrationsFolder)
 * console.log(migrationsFolder.endsWith("/migrations")) // true
 * console.log(migrate !== migrateOnBoot) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const migrateFromFolder = Effect.fn("MigrationRunner.migrateFromFolder")(function* (folder: string) {
  const database = yield* PostgresDrizzle;
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
 * **Example** (Use migrateOnBoot as databaseReady's second step)
 *
 * ```ts
 * import { migrateFromFolder, migrateOnBoot, migrationsFolder } from "@effect-ontology/Runtime/Persistence/MigrationRunner"
 *
 * const fromFolder = migrateFromFolder(migrationsFolder)
 * console.log(migrationsFolder.endsWith("/migrations")) // true
 * console.log(migrateOnBoot !== fromFolder) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const migrateOnBoot = migrateFromFolder(migrationsFolder);
