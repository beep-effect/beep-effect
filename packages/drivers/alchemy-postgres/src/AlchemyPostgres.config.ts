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
 * How much catch-up work each step does: history rows a reader reads per
 * call, instances a directory node handles per step, buffered rows a key
 * applies per step, how many instances a directory leaf lists before it
 * splits, and the depth instances list themselves at. Absent fields keep upstream `Backfill.defaultLimits`.
 *
 * **Example** (Small pages for a test)
 *
 * ```ts
 * import { BackfillTuning } from "@beep/alchemy-postgres/AlchemyPostgres.config"
 *
 * const tuning = BackfillTuning.make({ page: 2, nodePage: 2, apply: 2, leafSize: 2, depth: 1 })
 * console.log(tuning.page) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BackfillTuning extends S.Opaque<BackfillTuning, { readonly brand: unique symbol }>()(
  S.Struct({
    page: S.Int.check(S.isGreaterThan(0)).annotateKey({ description: "History rows a reader reads per call." }),
    nodePage: S.Int.check(S.isGreaterThan(0)).annotateKey({
      description: "Source instances a directory node handles per step.",
    }),
    apply: S.Int.check(S.isGreaterThan(0)).annotateKey({
      description: "Buffered rows a consumer key applies per step.",
    }),
    leafSize: S.Int.check(S.isGreaterThan(0)).annotateKey({
      description: "Instances a directory node lists before it splits into 16 children.",
    }),
    depth: S.Int.check(S.isGreaterThan(0)).annotateKey({
      description: "Depth of the directory nodes instances list themselves at before any split (16^depth leaves).",
    }),
  }).pipe(
    $I.annoteSchema("BackfillTuning", {
      description: "Per-step sizes of the upstream Backfill protocol the driver runs for catch-up.",
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
    backfill: S.OptionFromOptionalKey(BackfillTuning).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Catch-up step sizes; absent keeps upstream `Backfill.defaultLimits`." })
    ),
  }).pipe(
    $I.annoteSchema("AlchemyPostgresConfig", {
      description: "Configuration of the Postgres alchemy Platform driver.",
    })
  )
) {}
