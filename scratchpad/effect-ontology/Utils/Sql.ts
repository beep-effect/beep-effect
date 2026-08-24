/**
 * Shared SQL boundary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { DrizzleOperation } from "@beep/drizzle";
import { DrizzleError } from "@beep/drizzle";
import { Effect } from "effect";
import * as A from "effect/Array";

/**
 * Normalize an Effect failure at a Drizzle operation boundary.
 *
 * **Example** (Normalize an execution failure)
 *
 * ```ts
 * import { normalizeDrizzleError } from "@effect-ontology/Utils/Sql"
 * import { Effect } from "effect"
 *
 * const query = Effect.fail("connection closed").pipe(normalizeDrizzleError("execute"))
 * console.log(query)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const normalizeDrizzleError =
  (operation: DrizzleOperation) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, DrizzleError, R> =>
    effect.pipe(Effect.mapError((cause) => DrizzleError.fromUnknown(operation, cause)));

/**
 * Format a numeric vector for PostgreSQL `vector` input.
 *
 * **Example** (Format an embedding)
 *
 * ```ts
 * import { formatPgVector } from "@effect-ontology/Utils/Sql"
 *
 * console.log(formatPgVector([0.25, -0.5])) // "[0.25,-0.5]"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formatPgVector = (vector: ReadonlyArray<number>): string =>
  `[${A.join(A.map(vector, globalThis.String), ",")}]`;
