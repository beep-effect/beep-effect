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
 * @example
 * ```ts
 * import { ignoreNativeClose } from "./DuckDbNative.ts"
 *
 * // A throwing close is swallowed instead of propagating during teardown.
 * ignoreNativeClose(() => {
 *   throw new Error("close failed")
 * })
 * ```
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
 * @example
 * ```ts
 * import { releaseNativeConnection } from "./DuckDbNative.ts"
 *
 * // Effect that closes the connection, then its owning instance, on release.
 * const release = releaseNativeConnection
 * ```
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
