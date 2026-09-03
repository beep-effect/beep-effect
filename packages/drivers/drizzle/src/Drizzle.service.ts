/**
 * Product-neutral Drizzle execution service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DrizzleId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Context, Layer } from "effect";
import * as S from "effect/Schema";
import type { Effect } from "effect";
import type { DrizzleError } from "./Drizzle.errors.ts";

const $I = $DrizzleId.create("Drizzle.service");

/**
 * Schema for opaque row arrays returned by a product-neutral Drizzle adapter.
 *
 * **Details**
 *
 * The driver validates only the array boundary. Product repositories should
 * decode row objects with their own schemas after execution.
 *
 * **Example** (Decode opaque row array)
 *
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { DrizzleRows } from "@beep/drizzle"
 *
 * const rows = DrizzleRows.decodeUnknownSync([{ id: 1 }])
 * deepStrictEqual(rows, [{ id: 1 }])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DrizzleRows = S.Array(S.Unknown).pipe(
  $I.annoteSchema("DrizzleRows", {
    description: "Rows returned by a product-neutral Drizzle adapter.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"])
);

/**
 * Runtime row-array type decoded by {@link DrizzleRows}.
 *
 * **Example** (Annotate decoded row array)
 *
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import type { DrizzleRows } from "@beep/drizzle"
 *
 * const rows: DrizzleRows = [{ id: 1 }]
 * deepStrictEqual(rows, [{ id: 1 }])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DrizzleRows = typeof DrizzleRows.Type;

/**
 * Narrow adapter contract accepted by {@link Drizzle.makeLayer}.
 *
 * **Details**
 *
 * Implementations own connection management, SQL execution, and transaction
 * callback scoping. This package wraps that adapter without binding it to a
 * concrete database runtime.
 *
 * **Example** (Stub client execute methods)
 *
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import type { DrizzleClient } from "@beep/drizzle"
 * import { Effect } from "effect"
 *
 * const client: DrizzleClient = {
 *   execute: (statement, parameters) => Effect.succeed([{ statement, parameters }]),
 *   withTransaction: (use) => use(client)
 * }
 *
 * const rows = Effect.runSync(client.execute("select 1", []))
 * deepStrictEqual(rows, [{ statement: "select 1", parameters: [] }])
 * ```
 *
 * @effects
 * - `execute` delegates SQL execution to the backing adapter and may read or
 *   write database state depending on the statement.
 * - `withTransaction` delegates transaction scoping to the backing adapter.
 * @category models
 * @since 0.0.0
 */
export interface DrizzleClient {
  readonly execute: (statement: string, parameters: ReadonlyArray<unknown>) => Effect.Effect<DrizzleRows, DrizzleError>;
  readonly withTransaction: <A, R>(
    use: (transaction: DrizzleClient) => Effect.Effect<A, DrizzleError, R>
  ) => Effect.Effect<A, DrizzleError, R>;
}

/**
 * Service API exposed after yielding the {@link Drizzle} service.
 *
 * **Details**
 *
 * Transaction callbacks receive another `DrizzleShape` so call sites stay
 * independent of native transaction handles.
 *
 * **Example** (Nested transaction execute call)
 *
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import type { DrizzleShape } from "@beep/drizzle"
 * import { Effect } from "effect"
 *
 * let service: DrizzleShape
 * service = {
 *   execute: (statement, parameters) => Effect.succeed([`${statement}:${parameters.length}`]),
 *   withTransaction: (use) => use(service)
 * }
 *
 * const rows = Effect.runSync(
 *   service.withTransaction((transaction) => transaction.execute("select 1", []))
 * )
 * deepStrictEqual(rows, ["select 1:0"])
 * ```
 *
 * @effects
 * - `execute` performs adapter-backed SQL execution.
 * - `withTransaction` runs the callback in the adapter's transaction scope.
 * @category services
 * @since 0.0.0
 */
export interface DrizzleShape {
  readonly execute: (statement: string, parameters: ReadonlyArray<unknown>) => Effect.Effect<DrizzleRows, DrizzleError>;
  readonly withTransaction: <A, R>(
    use: (transaction: DrizzleShape) => Effect.Effect<A, DrizzleError, R>
  ) => Effect.Effect<A, DrizzleError, R>;
}

const makeService = (client: DrizzleClient): DrizzleShape =>
  ({
    execute: client.execute,
    withTransaction: (use) => client.withTransaction((transaction) => use(makeService(transaction))),
  }) satisfies DrizzleShape;

/**
 * Effect service tag for product-neutral Drizzle execution.
 *
 * **Example** (Provide layer and execute)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Drizzle, type DrizzleClient } from "@beep/drizzle"
 * import { Effect } from "effect"
 *
 * const client: DrizzleClient = {
 *   execute: () => Effect.succeed([{ ok: true }]),
 *   withTransaction: (use) => use(client)
 * }
 *
 * const program = Effect.gen(function* () {
 *   const drizzle = yield* Drizzle
 *   const rows = yield* drizzle.execute("select 1", [])
 *   return rows.length
 * }).pipe(Effect.provide(Drizzle.makeLayer(client)))
 *
 * strictEqual(Effect.runSync(program), 1)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Drizzle extends Context.Service<Drizzle, DrizzleShape>()($I`Drizzle`) {
  /**
   * Build a Layer from a narrow product-neutral Drizzle adapter.
   *
   * **Details**
   *
   * The layer is pure and does not acquire a database connection. Adapter
   * side effects occur only when service methods are invoked.
   *
   * **Example** (Layer with transaction execute)
   *
   * ```ts
   * import { deepStrictEqual } from "node:assert"
   * import { Drizzle, type DrizzleClient } from "@beep/drizzle"
   * import { Effect } from "effect"
   *
   * const client: DrizzleClient = {
   *   execute: (statement, parameters) => Effect.succeed([{ statement, parameters }]),
   *   withTransaction: (use) => use(client)
   * }
   *
   * const program = Effect.gen(function* () {
   *   const drizzle = yield* Drizzle
   *   return yield* drizzle.withTransaction((transaction) => transaction.execute("select 1", []))
   * }).pipe(Effect.provide(Drizzle.makeLayer(client)))
   *
   * deepStrictEqual(Effect.runSync(program), [{ statement: "select 1", parameters: [] }])
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (client: DrizzleClient): Layer.Layer<Drizzle> =>
    Layer.succeed(Drizzle, Drizzle.of(makeService(client)));
}
