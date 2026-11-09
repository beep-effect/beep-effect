/**
 * In-memory SQLite test layer for SQL integration tests.
 *
 * **Details**
 *
 * Provides a fresh in-process, in-memory Bun SQLite database (`":memory:"`)
 * exposed under the `@effect/sql-sqlite-bun` SqliteClient and generic
 * {@link SqlClient.SqlClient} tags. Building it in a fresh scope provisions an
 * isolated database; pass an explicit `filename` to {@link makeLayer} for a
 * file-backed variant.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeLayer } from "./SqliteClient.service.ts";
import type * as Layer from "effect/Layer";
import type * as SqlClient from "effect/sql/SqlClient";
import type { SqliteError } from "./Sqlite.errors.ts";
import type { SqliteClientValue } from "./SqliteClient.service.ts";

/**
 * Default in-memory SQLite test layer.
 *
 * **Example** (Import and log layer)
 *
 * ```ts
 * import { SqliteTestLayer } from "@beep/sqlite"
 *
 * console.log(SqliteTestLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SqliteTestLayer: Layer.Layer<SqliteClientValue | SqlClient.SqlClient, SqliteError> = makeLayer({
  filename: ":memory:",
});
