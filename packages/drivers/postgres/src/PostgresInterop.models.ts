/**
 * Native Drizzle and Effect Postgres interop helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { EffectDrizzleQueryError, MigratorInitError } from "drizzle-orm/effect-core/errors";
import type { SqlError } from "effect/unstable/sql/SqlError";

/**
 * Error union emitted by native Drizzle Effect Postgres migrations.
 *
 * **Example** (Type a migration error)
 *
 * ```ts
 * import type { NativeMigrationError } from "@beep/postgres/interop"
 *
 * const describeMigrationError = (_error: NativeMigrationError) => "migration failed"
 * console.log(describeMigrationError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type NativeMigrationError = EffectDrizzleQueryError | MigratorInitError | SqlError;

/**
 * Native Effect Postgres client namespace.
 *
 * **Example** (Access native PgClient tag)
 *
 * ```ts
 * import { NativePgClient } from "@beep/postgres/interop"
 *
 * const pgClientTag = NativePgClient.PgClient
 * console.log(pgClientTag)
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * as NativePgClient from "@effect/sql-pg/PgClient";
/**
 * Native Drizzle Effect Postgres database and logger types.
 *
 * **Example** (Type database and logger)
 *
 * ```ts
 * import type { EffectLogger, EffectPgDatabase } from "@beep/postgres/interop"
 *
 * const useDatabase = (_database: EffectPgDatabase) => "database"
 * const useLogger = (_logger: EffectLogger) => "logger"
 * console.log(useDatabase)
 * console.log(useLogger)
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export type { EffectLogger, EffectPgDatabase } from "drizzle-orm/effect-postgres";
/**
 * Native Drizzle Effect Postgres configuration types.
 *
 * **Example** (Assign Effect Drizzle config)
 *
 * ```ts
 * import type { EffectDrizzleConfig, EffectDrizzlePgConfig } from "@beep/postgres/interop"
 *
 * const config: EffectDrizzlePgConfig = {}
 * const legacyName: EffectDrizzleConfig = config
 * console.log(legacyName)
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export type {
  EffectDrizzlePgConfig,
  EffectDrizzlePgConfig as EffectDrizzleConfig,
} from "drizzle-orm/pg-core/effect/utils";
