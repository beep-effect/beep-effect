/**
 * Shared plumbing for the DuckDB-native effect storages (D63–D65).
 *
 * **Details**
 *
 * The message, runner and persisted-queue storages each run their migrations
 * under their own history table and round-trip JSON payloads through a schema
 * codec instead of the throwing native JSON operations upstream uses.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DuckdbId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import { flow, identity } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Migrator from "effect/sql/Migrator";
import type * as SqlClient from "effect/sql/SqlClient";

const $I = $DuckdbId.create("internal/storage");

const Json = S.fromJsonString(S.Unknown).pipe($I.annoteSchema("Json", { description: "JSON payload codec." }));

/**
 * Encode a payload as JSON text with the schema issue in the typed error channel.
 *
 * **Example** (Encoding a payload inside an Effect)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { encodeJsonEffect } from "./storage.ts"
 *
 * const text = Effect.runSync(encodeJsonEffect({ id: 1 })) // '{"id":1}'
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const encodeJsonEffect: (value: unknown) => Effect.Effect<string, S.SchemaError> = S.encodeUnknownEffect(Json);

/**
 * Decode a JSON payload column, throwing the schema issue on malformed text.
 *
 * **Example** (Decoding a stored payload)
 *
 * ```ts
 * import { decodeJson } from "./storage.ts"
 *
 * console.log(decodeJson('{"id":1}')) // { id: 1 }
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const decodeJson: (value: string) => unknown = flow(S.decodeResult(Json), Result.getOrThrowWith(identity));

/**
 * Encode a payload as JSON text, throwing the schema issue on unserializable values.
 *
 * **Example** (Encoding a payload for a TEXT column)
 *
 * ```ts
 * import { encodeJson } from "./storage.ts"
 *
 * console.log(encodeJson({ id: 1 })) // '{"id":1}'
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const encodeJson: (value: unknown) => string = flow(
  S.encodeUnknownResult(Json),
  Result.getOrThrowWith(identity)
);

/**
 * Run a storage's migrations under its own history table; migration failures are defects.
 *
 * **Example** (Running a storage's migrations)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as Migrator from "effect/sql/Migrator"
 * import { runMigrations } from "./storage.ts"
 *
 * const program = runMigrations({
 *   table: "cluster_migrations",
 *   loader: Migrator.fromRecord({ "0001_noop": Effect.void }),
 * })
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const runMigrations = (options: {
  readonly table: string;
  readonly loader: Migrator.Loader;
}): Effect.Effect<void, never, SqlClient.SqlClient> => Migrator.make({})(options).pipe(Effect.asVoid, Effect.orDie);

/**
 * Build the migration runner of a cluster storage whose tables share a prefix
 * (default `cluster`), recording history in `<prefix>_<historySuffix>`.
 *
 * **Example** (Running prefixed storage migrations)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as Migrator from "effect/sql/Migrator"
 * import { runPrefixedMigrations } from "./storage.ts"
 *
 * const run = runPrefixedMigrations({
 *   migrations: () => Migrator.fromRecord({ "0001_noop": Effect.void }),
 *   historySuffix: "runner_migrations",
 * })
 * const program = run({ prefix: "app" }) // history table app_runner_migrations
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const runPrefixedMigrations =
  (storage: {
    readonly migrations: (options: { readonly prefix?: string | undefined }) => Migrator.Loader;
    readonly historySuffix: string;
  }) =>
  (options: { readonly prefix?: string | undefined } = {}): Effect.Effect<void, never, SqlClient.SqlClient> =>
    runMigrations({
      loader: storage.migrations(options),
      table: `${options.prefix ?? "cluster"}_${storage.historySuffix}`,
    });
