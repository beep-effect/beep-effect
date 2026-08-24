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
