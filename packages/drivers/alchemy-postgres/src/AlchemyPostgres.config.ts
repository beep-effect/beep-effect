/**
 * Configuration of the Postgres `Platform` driver for `@alchemy.run/domain`.
 *
 * **Details**
 *
 * The driver is model-agnostic. Provenance stamping (D10 of the vault-sync
 * goal) is configured by naming the request-context key and the two fields the
 * driver copies into its `principal` and `source_kind` columns; the full encoded
 * context is always kept as JSON. Several request-context shapes (for example
 * genesis import and the Session middleware) each get their own mapping.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyPostgresId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $AlchemyPostgresId.create("AlchemyPostgres.config");

/**
 * Where the driver finds principal and source kind inside the request context
 * the kernel hands it with every command.
 *
 * **Details**
 *
 * Only string values are copied: a field that is absent or holds any other
 * JSON value leaves its column NULL.
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
 * Provenance mappings for several request-context shapes, one per context key.
 *
 * **Details**
 *
 * Context keys must be distinct, so each key names one context shape. A
 * context that carries several mapped keys takes the first mapping in order.
 *
 * **Example** (Genesis import and Session v1)
 *
 * ```ts
 * import { ProvenanceMappings } from "@beep/alchemy-postgres/AlchemyPostgres.config"
 * import * as S from "effect/Schema"
 *
 * const mappings = S.decodeSync(ProvenanceMappings)([
 *   { contextKey: "Documents/CurrentActor", principalField: "principal", sourceKindField: "sourceKind" },
 *   { contextKey: "Session/RequestContext", principalField: "principalKey", sourceKindField: "sourceKind" },
 * ])
 * console.log(mappings.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProvenanceMappings = S.Array(ProvenanceMapping).pipe(
  S.check(
    S.makeFilter(
      (mappings: ReadonlyArray<ProvenanceMapping>) =>
        HashSet.size(HashSet.fromIterable(A.map(mappings, ({ contextKey }) => contextKey))) === mappings.length,
      $I.annote("DistinctProvenanceContextKeys", {
        title: "Distinct provenance context keys",
        description: "Every provenance mapping names a different request-context key.",
      })
    )
  ),
  $I.annoteSchema("ProvenanceMappings", {
    description: "Provenance mappings for several request-context shapes, one per context key.",
  })
);

/**
 * The type of {@link ProvenanceMappings}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProvenanceMappings = typeof ProvenanceMappings.Type;

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
 * **Details**
 *
 * `provenance` and `provenanceMappings` together form the driver's provenance
 * mappings, `provenance` first. An event row takes its columns from the first
 * mapping whose context key holds an object in the stored context; with no
 * such mapping both columns stay NULL. A matched mapping whose fields are not
 * strings leaves its columns NULL and does not fall through to a later mapping.
 * The context keys of both fields must be distinct.
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
    leaseMillis: S.Int.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(30_000)),
      S.annotateKey({
        description:
          "How long a claimed outbox row or backfill job stays leased to the host running it; a host that closes frees the outbox rows it claimed at once, and anything else is retried once the lease lapses.",
      })
    ),
    deliveryBatchSize: S.Int.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(100)),
      S.annotateKey({ description: "Maximum outbox rows one delivery worker pass locks with SKIP LOCKED." })
    ),
    provenance: S.OptionFromOptionalKey(ProvenanceMapping).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Provenance mapping; absent keeps only the encoded context JSON." })
    ),
    provenanceMappings: ProvenanceMappings.pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.annotateKey({ description: "Further provenance mappings, one per request-context key; empty by default." })
    ),
    backfill: S.OptionFromOptionalKey(BackfillTuning).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Catch-up step sizes; absent keeps upstream `Backfill.defaultLimits`." })
    ),
  }).pipe(
    S.check(
      S.makeFilter(
        (config: {
          readonly provenance: O.Option<ProvenanceMapping>;
          readonly provenanceMappings: ReadonlyArray<ProvenanceMapping>;
        }) =>
          O.match(config.provenance, {
            onNone: () => true,
            onSome: ({ contextKey }) =>
              !A.some(config.provenanceMappings, (mapping) => mapping.contextKey === contextKey),
          }),
        $I.annote("DistinctConfigProvenanceContextKeys", {
          title: "Distinct config provenance context keys",
          description: "`provenance` names a request-context key no entry of `provenanceMappings` names.",
        })
      )
    ),
    $I.annoteSchema("AlchemyPostgresConfig", {
      description: "Configuration of the Postgres alchemy Platform driver.",
    })
  )
) {}
