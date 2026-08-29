/**
 * App-owned long-lived DuckDB layer for the practice KG host.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";

/**
 * Open the shipped practice DuckDB file for the MCP host lifetime.
 *
 * **Example** (Create practice DuckDB layer)
 *
 * ```ts
 * import { makePracticeKgDuckDbLayer } from "../../src/runtime/DuckDb.ts"
 *
 * const layer = makePracticeKgDuckDbLayer("/bundle/practice.duckdb")
 * console.log(typeof layer.pipe)
 * ```
 *
 * @param databasePath - Path to the bundle's `practice.duckdb` file.
 * @category layers
 * @since 0.0.0
 */
export const makePracticeKgDuckDbLayer = (databasePath: string) =>
  DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }));
