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
 * Maps any Effect failure at a Drizzle boundary onto `DrizzleError` tagged
 * with the operation that failed.
 *
 * **Example** (Capture an execute failure)
 *
 * ```ts
 * import { normalizeDrizzleError } from "@effect-ontology/Utils/Sql"
 * import { Effect } from "effect"
 *
 * const error = Effect.runSync(
 *   Effect.flip(Effect.fail("connection closed").pipe(normalizeDrizzleError("execute")))
 * )
 * console.log(error._tag) // "DrizzleError"
 * console.log(error.operation) // "execute"
 * ```
 *
 * @category error-handling
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
