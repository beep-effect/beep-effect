/**
 * Bun SQLite-backed Effect SQL client wiring.
 *
 * **Details**
 *
 * `@effect/sql-sqlite-bun` opens a `bun:sqlite` database in-process and exposes
 * it as the generic Effect {@link SqlClient.SqlClient}. This module wraps it as
 * a `@beep/sqlite` driver layer, normalizes driver failures into
 * {@link SqliteError}, and adds the two capabilities the agent memory store
 * needs from the driver: loading native extensions (sqlite-vec) and probing for
 * the bundled FTS5 full-text engine.
 *
 * **Gotchas**
 *
 * The underlying client imports `bun:sqlite`, so this module only loads under
 * the Bun runtime.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Sqlite from "@effect/sql-sqlite-bun/SqliteClient";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as SqlClient from "effect/sql/SqlClient";
import { SqliteError } from "./Sqlite.errors.ts";
import type * as Scope from "effect/Scope";

/**
 * Bun SQLite client service tag re-exported from `@effect/sql-sqlite-bun`.
 * Yield it to reach SQLite-specific capabilities (`export`, `loadExtension`)
 * beyond the generic SQL client surface.
 *
 * **Example** (Yield SqliteClient service tag)
 *
 * ```ts
 * import { SqliteClient } from "@beep/sqlite"
 *
 * const service = SqliteClient
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const SqliteClient = Sqlite.SqliteClient;

/**
 * Bun SQLite client value type re-exported from `@effect/sql-sqlite-bun`.
 *
 * **Example** (Read the client configuration)
 *
 * ```ts
 * import type { SqliteClientValue } from "@beep/sqlite"
 *
 * const readFilename = (client: SqliteClientValue) => client.config.filename
 * console.log(readFilename)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SqliteClientValue = Sqlite.SqliteClient;

/**
 * Options accepted when opening a managed Bun SQLite client. `filename` names
 * the database file; `":memory:"` yields an in-memory database suited to tests.
 *
 * **Example** (File-backed options)
 *
 * ```ts
 * import type { SqliteClientConfig } from "@beep/sqlite"
 *
 * const options: SqliteClientConfig = { filename: "./.beep/memory.db" }
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SqliteClientConfig = Sqlite.SqliteClientConfig;

/**
 * Acquire a managed Bun SQLite client, normalizing connection failures into a
 * {@link SqliteError}.
 *
 * **Example** (Create managed SQLite client)
 *
 * ```ts
 * import { make } from "@beep/sqlite"
 *
 * const effect = make({ filename: ":memory:" })
 * console.log(effect)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make = (
  options: SqliteClientConfig
): Effect.Effect<SqliteClientValue & SqlClient.SqlClient, SqliteError, Scope.Scope | Reactivity.Reactivity> =>
  Sqlite.make(options).pipe(Effect.mapError((cause) => SqliteError.fromUnknown("connect", cause)));

/**
 * Build a Layer that opens a Bun SQLite database and exposes it under both the
 * `@effect/sql-sqlite-bun` {@link SqliteClient} tag and the generic
 * {@link SqlClient.SqlClient} tag.
 *
 * **Example** (Provision a file-backed SQLite layer)
 *
 * ```ts
 * import { makeLayer } from "@beep/sqlite"
 *
 * const layer = makeLayer({ filename: "./.beep/memory.db" })
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeLayer = (
  options: SqliteClientConfig
): Layer.Layer<SqliteClientValue | SqlClient.SqlClient, SqliteError> =>
  Layer.effectContext(
    Effect.map(make(options), (client) =>
      Context.make(Sqlite.SqliteClient, client).pipe(Context.add(SqlClient.SqlClient, client))
    )
  ).pipe(Layer.provide(Reactivity.layer));

/**
 * Load native SQLite extensions into the managed client, in order.
 *
 * **Details**
 *
 * sqlite-vec is loaded through this function from a shared-library path the
 * caller supplies; the `sqlite-vec` npm package is not a dependency of this
 * driver. The first failing path stops the sequence and surfaces as a
 * {@link SqliteError} whose `operation` is `"loadExtension"`.
 *
 * **Example** (Load sqlite-vec from a caller-supplied path)
 *
 * ```ts
 * import { loadExtensions } from "@beep/sqlite"
 *
 * const effect = loadExtensions(["./vendor/vec0.so"])
 * console.log(effect)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const loadExtensions: (paths: ReadonlyArray<string>) => Effect.Effect<void, SqliteError, SqliteClientValue> =
  Effect.fn("Sqlite.loadExtensions")(function* (paths) {
    const client = yield* Sqlite.SqliteClient;
    yield* Effect.forEach(
      paths,
      (path) =>
        client.loadExtension(path).pipe(Effect.mapError((cause) => SqliteError.fromUnknown("loadExtension", cause))),
      { discard: true }
    );
  });

const isEnabledFlag = (row: { readonly enabled: number }): boolean => row.enabled === 1;

/**
 * Report whether the linked SQLite library was compiled with FTS5.
 *
 * **Details**
 *
 * Runs the side-effect-free `SELECT sqlite_compileoption_used('ENABLE_FTS5')`.
 * Bun's bundled SQLite reports `1`. A query failure surfaces as a
 * {@link SqliteError} whose `operation` is `"probeFts5"`.
 *
 * **Example** (Probe for FTS5)
 *
 * ```ts
 * import { probeFts5 } from "@beep/sqlite"
 *
 * console.log(probeFts5)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const probeFts5: Effect.Effect<boolean, SqliteError, SqliteClientValue> = Effect.gen(function* () {
  const client = yield* Sqlite.SqliteClient;
  const rows = yield* client.withoutTransforms()<{
    readonly enabled: number;
  }>`SELECT sqlite_compileoption_used('ENABLE_FTS5') AS enabled`.pipe(
    Effect.mapError((cause) => SqliteError.fromUnknown("probeFts5", cause))
  );
  return O.exists(A.head(rows), isEnabledFlag);
}).pipe(Effect.withSpan("Sqlite.probeFts5"));
