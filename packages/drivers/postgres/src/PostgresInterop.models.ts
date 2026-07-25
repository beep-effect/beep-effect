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
 * @example
 * ```ts
 * import type { NativeMigrationError } from "@beep/postgres/interop"
 *
 * const describeMigrationError = (_error: NativeMigrationError) => "migration failed"
 * console.log(describeMigrationError)
 * ```
 *
 * @since 0.0.0
 * @category errors
 */
export type NativeMigrationError = EffectDrizzleQueryError | MigratorInitError | SqlError;

/**
 * Native Effect Postgres client namespace.
 *
 * @example
 * ```ts
 * import { NativePgClient } from "@beep/postgres/interop"
 *
 * const pgClientTag = NativePgClient.PgClient
 * console.log(pgClientTag)
 * ```
 *
 * @since 0.0.0
 * @category interop
 */
export * as NativePgClient from "@effect/sql-pg/PgClient";
/**
 * Native Drizzle Effect Postgres database and logger types.
 *
 * @example
 * ```ts
 * import type { EffectLogger, EffectPgDatabase } from "@beep/postgres/interop"
 *
 * const useDatabase = (_database: EffectPgDatabase) => "database"
 * const useLogger = (_logger: EffectLogger) => "logger"
 * console.log(useDatabase)
 * console.log(useLogger)
 * ```
 *
 * @since 0.0.0
 * @category interop
 */
export type { EffectLogger, EffectPgDatabase } from "drizzle-orm/effect-postgres";
/**
 * Native Drizzle Effect Postgres configuration types.
 *
 * @example
 * ```ts
 * import type { EffectDrizzleConfig, EffectDrizzlePgConfig } from "@beep/postgres/interop"
 *
 * const config: EffectDrizzlePgConfig = {}
 * const legacyName: EffectDrizzleConfig = config
 * console.log(legacyName)
 * ```
 *
 * @since 0.0.0
 * @category interop
 */
export type {
  EffectDrizzlePgConfig,
  EffectDrizzlePgConfig as EffectDrizzleConfig,
} from "drizzle-orm/pg-core/effect/utils";
