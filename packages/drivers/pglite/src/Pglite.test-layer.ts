/**
 * In-memory PGlite test layer for SQL integration tests.
 *
 * Provides a fresh in-process, in-memory PGlite database (no `dataDir`) exposed
 * under the `@effect/sql-pg` {@link Pg.PgClient}, generic
 * {@link SqlClient.SqlClient}, and `@effect/sql-pglite` PgliteClient tags. The
 * shared SQL test harness uses this as a docker-free default driver, so the same
 * in-process client the app ships also backs integration tests. Building it in a
 * fresh scope (as the harness does per test) provisions an isolated database;
 * pass an explicit `dataDir` to {@link makeLayer} for a file-backed variant.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeLayer } from "./PgliteClient.service.ts";
import type * as Pg from "@effect/sql-pg/PgClient";
import type { Layer } from "effect";
import type * as SqlClient from "effect/unstable/sql/SqlClient";
import type { PgliteError } from "./Pglite.errors.ts";
import type { PgliteClientValue } from "./PgliteClient.service.ts";

/**
 * Default docker-free in-memory PGlite test layer.
 *
 * **Example** (Import and log layer)
 *
 * ```ts
 * import { PgliteTestLayer } from "@beep/pglite"
 *
 * console.log(PgliteTestLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PgliteTestLayer: Layer.Layer<PgliteClientValue | Pg.PgClient | SqlClient.SqlClient, PgliteError> =
  makeLayer({});
