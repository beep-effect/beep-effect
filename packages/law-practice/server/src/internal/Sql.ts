/**
 * SQL text helpers for the bundle's DuckDB statements that take a file path
 * where DuckDB accepts no bound parameter (table functions such as
 * `read_json`). Private to `@beep/law-practice-server`.
 *
 * @packageDocumentation
 * @internal
 * @category utilities
 * @since 0.0.0
 */
import { pipe } from "effect/Function";
import * as Str from "effect/String";

/**
 * Quote a value as a SQL string literal, doubling embedded single quotes.
 *
 * **Example** (Quote a path)
 *
 * ```ts
 * import { sqlStringLiteral } from "./Sql.ts"
 *
 * console.log(sqlStringLiteral("/corpus/o'brien")) // "'/corpus/o''brien'"
 * ```
 *
 * @internal
 * @param value - Raw string.
 * @returns The quoted literal.
 * @category utilities
 * @since 0.0.0
 */
export const sqlStringLiteral = (value: string): string => `'${pipe(value, Str.replaceAll("'", "''"))}'`;
