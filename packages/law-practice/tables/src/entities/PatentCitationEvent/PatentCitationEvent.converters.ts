/**
 * Law-practice PatentCitationEvent row converters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PatentCitationEvent } from "@beep/law-practice-domain/entities/PatentCitationEvent";
import { Result } from "effect";
import * as S from "effect/Schema";
import type { Table } from "./PatentCitationEvent.table.ts";

/**
 * Selected law-practice PatentCitationEvent row.
 *
 * **Example** (Collect selected rows)
 *
 * ```ts
 * import type { PatentCitationEventRow } from "@beep/law-practice-tables/entities/PatentCitationEvent"
 *
 * const rows: ReadonlyArray<PatentCitationEventRow> = []
 * console.log(rows.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type PatentCitationEventRow = typeof Table.$inferSelect;

/**
 * Insertable law-practice PatentCitationEvent row.
 *
 * **Example** (Collect insert rows)
 *
 * ```ts
 * import type { PatentCitationEventInsert } from "@beep/law-practice-tables/entities/PatentCitationEvent"
 *
 * const inserts: ReadonlyArray<PatentCitationEventInsert> = []
 * console.log(inserts.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type PatentCitationEventInsert = typeof Table.$inferInsert;

const encodePatentCitationEvent = S.encodeResult(PatentCitationEvent);

/**
 * Convert a PatentCitationEvent entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the column shape
 * {@link Table} projects. The database-managed `id` is dropped so the insert
 * defers to the table sequence.
 *
 * **Example** (Encode a decoded row back into an insert)
 *
 * ```ts
 * import {
 *   fromPatentCitationEventRow,
 *   toPatentCitationEventInsert
 * } from "@beep/law-practice-tables/entities/PatentCitationEvent"
 * import { Result } from "effect"
 *
 * const insert = Result.flatMap(fromPatentCitationEventRow({}), toPatentCitationEventInsert)
 * console.log(Result.isFailure(insert)) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toPatentCitationEventInsert = (
  event: PatentCitationEvent
): Result.Result<PatentCitationEventInsert, S.SchemaError> =>
  Result.map(encodePatentCitationEvent(event), (encoded): PatentCitationEventInsert => {
    const { id: _id, ...insert } = encoded;
    return insert;
  });

/**
 * Convert a selected persistence row into a PatentCitationEvent entity.
 *
 * **Details**
 *
 * The input is `unknown` rather than {@link PatentCitationEventRow} because the
 * driver hands back untrusted values; every jsonb column is re-decoded through
 * the entity schema rather than trusted as its declared column type.
 *
 * **Example** (Reject a row that carries no recorded observation)
 *
 * ```ts
 * import { fromPatentCitationEventRow } from "@beep/law-practice-tables/entities/PatentCitationEvent"
 * import { Result } from "effect"
 *
 * console.log(Result.isFailure(fromPatentCitationEventRow({}))) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromPatentCitationEventRow: (row: unknown) => Result.Result<PatentCitationEvent, S.SchemaError> =
  S.decodeUnknownResult(PatentCitationEvent);
