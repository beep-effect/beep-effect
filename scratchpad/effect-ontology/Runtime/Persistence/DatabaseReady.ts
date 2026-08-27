/**
 * Canonical PostgreSQL readiness and migration initialization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Duration, Effect, Schedule } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { migrateOnBoot } from "./MigrationRunner.ts";

/**
 * Verifies the current PostgreSQL client and applies every pending canonical
 * effect-ontology migration in that same context.
 *
 * **Example** (Run connectivity then migrateOnBoot)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { databaseReady } from "@effect-ontology/Runtime/Persistence/DatabaseReady"
 * import { migrateOnBoot } from "@effect-ontology/Runtime/Persistence/MigrationRunner"
 *
 * const documented = [databaseReady(), migrateOnBoot] as const
 * console.log(Effect.isEffect(documented[0])) // true
 * console.log(Effect.isEffect(documented[1])) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const databaseReady = Effect.fn("DatabaseReady.databaseReady")(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`SELECT 1`.pipe(
    Effect.retry(
      Schedule.max([Schedule.exponential(Duration.millis(500)), Schedule.recurs(5)]).pipe(Schedule.jittered)
    ),
    Effect.timeout(Duration.seconds(30))
  );
  yield* Effect.logInfo("PostgreSQL connection verified");
  yield* migrateOnBoot;
  yield* Effect.logInfo("Effect ontology migrations are current");
});
