/**
 * PGlite-backed Effect SQL client wiring.
 *
 * `@effect/sql-pglite` runs PGlite (embedded PostgreSQL) in-process and exposes
 * it as the generic Effect {@link SqlClient.SqlClient}. This module wraps it as a
 * `@beep/pglite` driver layer and aliases the client under the
 * `@effect/sql-pg` {@link Pg.PgClient} tag so the repo's Drizzle composition
 * (`drizzle-orm/effect-postgres`, which resolves `PgClient` from context) runs
 * unchanged against the in-process database — no PGlite-socket bridge.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Pg from "@effect/sql-pg/PgClient";
import * as Pglite from "@effect/sql-pglite/PgliteClient";
import { Effect, Layer } from "effect";
import { PgliteError } from "./Pglite.errors.ts";
import type * as Scope from "effect/Scope";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type * as SqlClient from "effect/unstable/sql/SqlClient";

/**
 * PGlite client service tag re-exported from `@effect/sql-pglite`. Yield it to
 * reach PGlite-specific capabilities (the raw `pglite` instance,
 * `dumpDataDir`, `listen`/`notify`) beyond the generic SQL client surface.
 *
 * **Example** (Yield PgliteClient service tag)
 *
 * ```ts
 * import { PgliteClient } from "@beep/pglite"
 *
 * const service = PgliteClient
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const PgliteClient = Pglite.PgliteClient;

/**
 * PGlite client value type re-exported from `@effect/sql-pglite`.
 *
 * **Example** (Access raw pglite instance)
 *
 * ```ts
 * import type { PgliteClientValue } from "@beep/pglite"
 *
 * const readPglite = (client: PgliteClientValue) => client.pglite
 * console.log(readPglite)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PgliteClientValue = Pglite.PgliteClient;

/**
 * Options accepted when creating a managed in-process PGlite client. A
 * `dataDir` makes PGlite file-backed (durable); omitting it yields an in-memory
 * instance suited to tests.
 *
 * **Example** (File-backed dataDir options)
 *
 * ```ts
 * import type { PgliteClientOptions } from "@beep/pglite"
 *
 * const options: PgliteClientOptions = { dataDir: "./.beep/chat-db" }
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PgliteClientOptions = Pglite.PgliteClientConfig.Create;

/**
 * Acquire a managed in-process PGlite client, normalizing connection failures
 * into a {@link PgliteError}.
 *
 * **Example** (Create managed PGlite client)
 *
 * ```ts
 * import { make } from "@beep/pglite"
 *
 * const effect = make({ dataDir: "./.beep/chat-db" })
 * console.log(effect)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make = (
  options: PgliteClientOptions = {}
): Effect.Effect<PgliteClientValue, PgliteError, Scope.Scope | Reactivity.Reactivity> =>
  Pglite.make(options).pipe(Effect.mapError((cause) => PgliteError.fromUnknown("connect", cause)));

// The Drizzle Effect Postgres integration resolves the `@effect/sql-pg` PgClient
// tag from context and, at query time, calls only base SqlClient methods
// (`unsafe`, `withTransaction`). `PgliteClient` is a `SqlClient` that mirrors the
// rest of PgClient's surface (`json`, `listen`, `notify`), so it stands in at
// runtime. This single cast is the one deliberate, contained place the driver
// boundary bends: if a future drizzle-orm bump starts calling a pg-specific
// method, this is the failure point to revisit.
const asPgClient = (client: PgliteClientValue): Pg.PgClient => client as unknown as Pg.PgClient;

/**
 * Build a Layer that provisions an in-process PGlite database and exposes it
 * under the `@effect/sql-pglite` {@link PgliteClient}, the generic
 * {@link SqlClient.SqlClient}, and the `@effect/sql-pg` {@link Pg.PgClient} tags
 * (via the tag-shim), so Drizzle-backed repositories run unchanged.
 *
 * **Example** (Provision multi-tag PGlite layer)
 *
 * ```ts
 * import { makeLayer } from "@beep/pglite"
 *
 * const layer = makeLayer({ dataDir: "./.beep/chat-db" })
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeLayer = (
  options: PgliteClientOptions = {}
): Layer.Layer<PgliteClientValue | Pg.PgClient | SqlClient.SqlClient, PgliteError> => {
  const nativeLayer = Pglite.layerFrom(make(options));
  const pgClientShim = Layer.effect(Pg.PgClient, Effect.map(Effect.service(Pglite.PgliteClient), asPgClient));

  return pgClientShim.pipe(Layer.provideMerge(nativeLayer));
};
