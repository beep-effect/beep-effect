/**
 * Law-practice PowerExercise row converters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PowerExercise } from "@beep/law-practice-domain/entities/PowerExercise";
import { Result } from "effect";
import * as S from "effect/Schema";
import type { Table } from "./PowerExercise.table.ts";

/**
 * Selected law-practice PowerExercise row.
 *
 * **Example** (Collect selected rows)
 *
 * ```ts
 * import type { PowerExerciseRow } from "@beep/law-practice-tables/entities/PowerExercise"
 *
 * const rows: ReadonlyArray<PowerExerciseRow> = []
 * console.log(rows.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type PowerExerciseRow = typeof Table.$inferSelect;

/**
 * Insertable law-practice PowerExercise row.
 *
 * **Example** (Collect insert rows)
 *
 * ```ts
 * import type { PowerExerciseInsert } from "@beep/law-practice-tables/entities/PowerExercise"
 *
 * const inserts: ReadonlyArray<PowerExerciseInsert> = []
 * console.log(inserts.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type PowerExerciseInsert = typeof Table.$inferInsert;

const encodePowerExercise = S.encodeResult(PowerExercise);

/**
 * Convert a power exercise entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the column shape
 * {@link Table} projects. The database-managed `id` is dropped so the insert
 * defers to the table sequence.
 *
 * **Gotchas**
 *
 * There is no update counterpart, and there deliberately never will be: an attempt stays on the
 * record as it was made, and a later determination about it is recorded
 * rather than written over the attempt.
 *
 * **Example** (Encode a decoded row back into an insert)
 *
 * ```ts
 * import {
 *   fromPowerExerciseRow,
 *   toPowerExerciseInsert
 * } from "@beep/law-practice-tables/entities/PowerExercise"
 * import { Result } from "effect"
 *
 * const insert = Result.flatMap(fromPowerExerciseRow({}), toPowerExerciseInsert)
 * console.log(Result.isFailure(insert)) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toPowerExerciseInsert = (exercise: PowerExercise): Result.Result<PowerExerciseInsert, S.SchemaError> =>
  Result.map(encodePowerExercise(exercise), (encoded): PowerExerciseInsert => {
    const { id: _id, ...insert } = encoded;
    return insert;
  });

/**
 * Convert a selected persistence row into a power exercise entity.
 *
 * **Details**
 *
 * The input is `unknown` rather than {@link PowerExerciseRow} because the driver hands
 * back untrusted values; every jsonb column is re-decoded through the entity
 * schema rather than trusted as its declared column type.
 *
 * **Gotchas**
 *
 * Every set-valued field in the payload is stored as a JSON array and decoded
 * back into a `HashSet` here. It is `HashSet` from `@beep/schema` that makes
 * that work: `effect/Schema`'s own `HashSet` encodes to a tagged wrapper no
 * decoder accepts, so a field declared with it cannot survive a row trip.
 *
 * **Example** (Reject a row that records no attempt)
 *
 * ```ts
 * import { fromPowerExerciseRow } from "@beep/law-practice-tables/entities/PowerExercise"
 * import { Result } from "effect"
 *
 * console.log(Result.isFailure(fromPowerExerciseRow({}))) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromPowerExerciseRow: (row: unknown) => Result.Result<PowerExercise, S.SchemaError> =
  S.decodeUnknownResult(PowerExercise);
