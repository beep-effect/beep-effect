/**
 * Configuration of the Postgres `Platform` driver for `@alchemy.run/domain`.
 *
 * **Details**
 *
 * The driver is model-agnostic. Provenance stamping (D10 of the vault-sync
 * goal) is configured by naming the request-context key and the two fields the
 * driver copies into its `principal` and `source_kind` columns; the full encoded
 * context is always kept as JSON.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyPostgresId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $AlchemyPostgresId.create("AlchemyPostgres.config");

/**
 * Where the driver finds principal and source kind inside the request context
 * the kernel hands it with every command.
 *
 * **Example** (Vault-sync provenance mapping)
 *
 * ```ts
 * import { ProvenanceMapping } from "@beep/alchemy-postgres/AlchemyPostgres.config"
 *
 * const mapping = ProvenanceMapping.make({
 *   contextKey: "Documents/CurrentActor",
 *   principalField: "principal",
 *   sourceKindField: "sourceKind",
 * })
 * console.log(mapping.contextKey)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProvenanceMapping extends S.Opaque<ProvenanceMapping, { readonly brand: unique symbol }>()(
  S.Struct({
    contextKey: S.NonEmptyString.annotateKey({
      description: "Request-context service key whose encoded value carries the actor (e.g. `Documents/CurrentActor`).",
    }),
    principalField: S.NonEmptyString.annotateKey({
      description: "Field of the encoded context copied into the `principal` column.",
    }),
    sourceKindField: S.NonEmptyString.annotateKey({
      description: "Field of the encoded context copied into the `source_kind` column.",
    }),
  }).pipe(
    $I.annoteSchema("ProvenanceMapping", {
      description: "Where principal and source kind live inside the request context the driver persists.",
    })
  )
) {}

/**
 * Driver configuration with constructor defaults.
 *
 * **Example** (Defaults)
 *
 * ```ts
 * import { AlchemyPostgresConfig } from "@beep/alchemy-postgres/AlchemyPostgres.config"
 *
 * const config = AlchemyPostgresConfig.make({})
 * console.log(config.tablePrefix) // "alchemy_"
 * console.log(config.pollMillis) // 250
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AlchemyPostgresConfig extends S.Opaque<AlchemyPostgresConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    tablePrefix: S.NonEmptyString.pipe(
      S.withConstructorDefault(Effect.succeed("alchemy_")),
      S.annotateKey({ description: "Prefix of every driver table; `alchemy_` by default." })
    ),
    pollMillis: S.Int.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(250)),
      S.annotateKey({ description: "Polling interval for live reads and workers when LISTEN/NOTIFY is unavailable." })
    ),
    deliveryBatchSize: S.Int.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(100)),
      S.annotateKey({ description: "Maximum outbox rows one delivery worker pass locks with SKIP LOCKED." })
    ),
    provenance: S.OptionFromOptionalKey(ProvenanceMapping).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Provenance mapping; absent keeps only the encoded context JSON." })
    ),
  }).pipe(
    $I.annoteSchema("AlchemyPostgresConfig", {
      description: "Configuration of the Postgres alchemy Platform driver.",
    })
  )
) {}
