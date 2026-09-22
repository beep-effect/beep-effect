/**
 * Agents ProviderInstance row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { ProviderInstance } from "@beep/agents-domain/entities/ProviderInstance";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ProviderInstanceConverterError } from "./ProviderInstance.errors.ts";
import type { providerInstanceTable } from "./ProviderInstance.table.ts";

/**
 * Selected agents ProviderInstance row.
 *
 * **Example** (Row matches table select)
 *
 * ```ts
 * import type { providerInstanceTable, ProviderInstanceRow } from "@beep/agents-tables/entities/ProviderInstance"
 *
 * type RowMatchesTable = ProviderInstanceRow extends typeof providerInstanceTable.$inferSelect ? true : false
 * const rowMatchesTable: RowMatchesTable = true
 *
 * console.log(rowMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ProviderInstanceRow = typeof providerInstanceTable.$inferSelect;

/**
 * Insertable agents ProviderInstance row.
 *
 * **Example** (Insert matches table insert)
 *
 * ```ts
 * import type { providerInstanceTable, ProviderInstanceInsert } from "@beep/agents-tables/entities/ProviderInstance"
 *
 * type InsertMatchesTable = ProviderInstanceInsert extends typeof providerInstanceTable.$inferInsert ? true : false
 * const insertMatchesTable: InsertMatchesTable = true
 *
 * console.log(insertMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ProviderInstanceInsert = typeof providerInstanceTable.$inferInsert;

const encodeProviderInstance = S.encodeResult(ProviderInstance);
const decodeProviderInstanceRow = S.decodeUnknownResult(ProviderInstance);

/**
 * Convert a ProviderInstance entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the field-key
 * shape accepted by {@link providerInstanceTable}, whose metadata carries the
 * physical SQL column names. The database-managed `id` (SERIAL) is dropped so
 * the insert defers to the sequence. The encoded row never contains provider
 * tokens: `lastProbe` is the tagged auth snapshot and `envVars` rejects
 * token-bearing names at decode time.
 *
 * **Example** (Insert drops managed id)
 *
 * ```ts
 * import { fromProviderInstanceRow, toProviderInstanceInsert } from "@beep/agents-tables/entities/ProviderInstance"
 * import { Result } from "effect"
 *
 * declare const row: import("@beep/agents-tables/entities/ProviderInstance").ProviderInstanceRow
 * const insert = Result.flatMap(fromProviderInstanceRow(row), toProviderInstanceInsert)
 * console.log(Result.isFailure(insert) || Result.isSuccess(insert))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toProviderInstanceInsert = (
  providerInstance: ProviderInstance
): Result.Result<ProviderInstanceInsert, ProviderInstanceConverterError> =>
  Result.mapError(
    Result.map(encodeProviderInstance(providerInstance), (encoded): ProviderInstanceInsert => {
      const { id: _id, ...insert } = encoded;
      return insert;
    }),
    ProviderInstanceConverterError.fromSchemaError
  );

/**
 * Convert a selected persistence row into a ProviderInstance entity.
 *
 * **Example** (Convert row to entity)
 *
 * ```ts
 * import { fromProviderInstanceRow } from "@beep/agents-tables/entities/ProviderInstance"
 * import { Result } from "effect"
 *
 * declare const row: import("@beep/agents-tables/entities/ProviderInstance").ProviderInstanceRow
 * console.log(Result.isFailure(fromProviderInstanceRow(row)) || Result.isSuccess(fromProviderInstanceRow(row)))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromProviderInstanceRow = (
  row: ProviderInstanceRow
): Result.Result<ProviderInstance, ProviderInstanceConverterError> =>
  Result.mapError(decodeProviderInstanceRow(row), ProviderInstanceConverterError.fromSchemaError);
