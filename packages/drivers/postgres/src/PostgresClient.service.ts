/**
 * Effect Postgres client service wiring.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PostgresId } from "@beep/identity";
import * as Pg from "@effect/sql-pg/PgClient";
import { Context, Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { PostgresError } from "./Postgres.errors.ts";

const $I = $PostgresId.create("PostgresClient.service");

/**
 * Native Effect Postgres pool configuration.
 *
 * **Example** (Pool config object shape)
 *
 * ```ts
 * import type { PostgresPoolConfig } from "@beep/postgres"
 *
 * const config: PostgresPoolConfig = {
 *   database: "postgres",
 *   host: "127.0.0.1",
 *   username: "postgres"
 * }
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PostgresPoolConfig = Pg.PgPoolConfig;

/**
 * Native Effect Postgres client value.
 *
 * **Example** (Reading client config)
 *
 * ```ts
 * import type { PostgresClientValue } from "@beep/postgres"
 *
 * const readConfig = (client: PostgresClientValue) => client.config
 * console.log(readConfig)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PostgresClientValue = Pg.PgClient;

/**
 * Beep service key for a native Effect Postgres client.
 *
 * **Example** (Service key reference)
 *
 * ```ts
 * import { PostgresClient } from "@beep/postgres"
 *
 * const service = PostgresClient
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PostgresClient extends Context.Service<PostgresClient, PostgresClientValue>()($I`PostgresClient`) {
  /**
   * Acquire a native Effect Postgres client.
   *
   * **Example** (Acquiring Postgres client)
   *
   * ```ts
   * import { PostgresClient } from "@beep/postgres"
   *
   * const effect = PostgresClient.make({ database: "postgres" })
   * console.log(effect)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make = (config: PostgresPoolConfig) =>
    Pg.make(config).pipe(Effect.mapError((cause) => PostgresError.fromUnknown("connect", cause)));

  /**
   * Build a Layer that provides both native and Beep Postgres client keys.
   *
   * **Example** (Building client layer)
   *
   * ```ts
   * import { PostgresClient } from "@beep/postgres"
   *
   * const layer = PostgresClient.makeLayer({ database: "postgres" })
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config: PostgresPoolConfig
  ): Layer.Layer<PostgresClient | Pg.PgClient | SqlClient.SqlClient, PostgresError> => {
    const nativeLayer = Pg.layerFrom(PostgresClient.make(config));
    const beepLayer = Layer.effect(PostgresClient, Effect.service(Pg.PgClient));

    return beepLayer.pipe(Layer.provideMerge(nativeLayer));
  };

  /**
   * Build a Layer from an already acquired native Effect Postgres client.
   *
   * **Example** (Layer from existing client)
   *
   * ```ts
   * import { PostgresClient } from "@beep/postgres"
   * import type { PostgresClientValue } from "@beep/postgres"
   *
   * const makeLayer = (client: PostgresClientValue) => PostgresClient.fromPgClient(client)
   * console.log(makeLayer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly fromPgClient = (
    client: PostgresClientValue
  ): Layer.Layer<PostgresClient | Pg.PgClient | SqlClient.SqlClient> =>
    Layer.mergeAll(
      Layer.succeed(Pg.PgClient, client),
      Layer.succeed(SqlClient.SqlClient, client),
      Layer.succeed(PostgresClient, client)
    );
}
