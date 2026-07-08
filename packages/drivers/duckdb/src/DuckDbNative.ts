/**
 * Internal native DuckDB lifecycle helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { thunkUndefined } from "@beep/utils";
import { Effect } from "effect";
import type { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

type NativeConnection = {
  readonly connection: DuckDBConnection;
  readonly instance: DuckDBInstance;
};

/**
 * Close a native DuckDB resource while suppressing close-time failures.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const ignoreNativeClose = (close: () => void): void => {
  try {
    close();
  } catch {
    thunkUndefined();
  }
};

/**
 * Release a native DuckDB connection and its owning instance.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const releaseNativeConnection = ({ connection, instance }: NativeConnection): Effect.Effect<void> =>
  Effect.sync(() => {
    ignoreNativeClose(() => connection.closeSync());
    ignoreNativeClose(() => instance.closeSync());
  });
