/**
 * The opt-in event hook for config loading: the `ConfigEventPayload` union, the timestamped
 * `ConfigEvent`, and the `ConfigEvents` PubSub service a consumer subscribes to.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ConfigFileId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as S from "effect/Schema";

const $I = $ConfigFileId.create("ConfigEvent");

/**
 * **Details**
 *
 * Carries the resolver's name alongside the path so a subscriber can tell
 * `/etc/app/.apprc` found by `systemEtc` from the same path passed explicitly.
 *
 * **Example** (Decode a discovered source reference)
 *
 * ```ts
 * import { ConfigSourceRef } from "@beep/config-file/ConfigEvent"
 * import * as S from "effect/Schema"
 *
 * const source = S.decodeUnknownSync(ConfigSourceRef)({ path: "/etc/app/.apprc", resolver: "systemEtc" });
 * console.log(source.resolver) // systemEtc
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ConfigSourceRef extends S.Opaque<ConfigSourceRef, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The filesystem path the value was read from. */
    path: S.String.pipe(
      $I.annoteKey("ConfigSourceRef.path", { description: "The filesystem path the value was read from." })
    ),
    /** The name of the resolver that found it. */
    resolver: S.String.pipe(
      $I.annoteKey("ConfigSourceRef.resolver", { description: "The name of the resolver that found it." })
    ),
  }).pipe(
    $I.annoteSchema("ConfigSourceRef", {
      description: "A reference to one configuration source that contributed to a load.",
    })
  )
) {}

/**
 * **Details**
 *
 * There is no discovery-failure variant: under this package's
 * resolver-absorption contract a resolver's error channel is `never` — every
 * filesystem failure becomes `Option.none()` — so the pipeline never observes a
 * discovery failure to report.
 *
 * The failure variants carry the **structured** typed error in `error`, not a
 * `reason` string, so every field a subscriber might branch on survives; a
 * subscriber that wants prose can read `error.message`.
 *
 * **Example** (Decode a parsed event payload)
 *
 * ```ts
 * import { ConfigEventPayload } from "@beep/config-file/ConfigEvent"
 * import * as S from "effect/Schema"
 *
 * const payload = S.decodeUnknownSync(ConfigEventPayload)({ _tag: "Parsed", path: "/app/config.json", codec: "json" });
 * console.log(payload._tag) // Parsed
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ConfigEventPayload = S.Union([
  S.TaggedStruct("Discovered", { path: S.String, resolver: S.String }).pipe(
    $I.annoteSchema("ConfigEventPayload.Discovered", {
      description:
        "A resolver matched a path. Emitted before the file is read, so a corrupt file is still reported as found.",
    })
  ),
  S.TaggedStruct("NotFound", {}).pipe(
    $I.annoteSchema("ConfigEventPayload.NotFound", { description: "The resolver chain matched nothing." })
  ),
  S.TaggedStruct("Parsed", { path: S.String, codec: S.String }).pipe(
    $I.annoteSchema("ConfigEventPayload.Parsed", { description: "The codec turned file content into a document." })
  ),
  S.TaggedStruct("ParseFailed", { path: S.String, codec: S.String, error: S.Defect() }).pipe(
    $I.annoteSchema("ConfigEventPayload.ParseFailed", { description: "The codec could not parse the file's content." })
  ),
  S.TaggedStruct("Validated", { path: S.String }).pipe(
    $I.annoteSchema("ConfigEventPayload.Validated", {
      description: "The document satisfied the schema and any caller-supplied `validate`.",
    })
  ),
  S.TaggedStruct("ValidationFailed", { path: S.String, error: S.Defect() }).pipe(
    $I.annoteSchema("ConfigEventPayload.ValidationFailed", {
      description:
        "The document did not satisfy the schema, or `validate` rejected it: one validation step from a subscriber's point of view.",
    })
  ),
  S.TaggedStruct("Resolved", { sources: S.Array(ConfigSourceRef), strategy: S.String }).pipe(
    $I.annoteSchema("ConfigEventPayload.Resolved", {
      description:
        "The merge strategy combined the discovered sources into one value. Carries every contributing source: under `layeredMerge` all of them contributed, not just the first.",
    })
  ),
  S.TaggedStruct("Loaded", { sources: S.Array(ConfigSourceRef) }).pipe(
    $I.annoteSchema("ConfigEventPayload.Loaded", {
      description: "The load completed. Carries every contributing source, as `Resolved` does.",
    })
  ),
  S.TaggedStruct("StringifyFailed", { codec: S.String, error: S.Defect() }).pipe(
    $I.annoteSchema("ConfigEventPayload.StringifyFailed", {
      description:
        "The codec could not serialize the value on a write path. Never emitted by `encode`, which publishes nothing.",
    })
  ),
  S.TaggedStruct("Written", { path: S.String }).pipe(
    $I.annoteSchema("ConfigEventPayload.Written", { description: "`write` persisted a value to an explicit path." })
  ),
  S.TaggedStruct("Saved", { path: S.String }).pipe(
    $I.annoteSchema("ConfigEventPayload.Saved", {
      description: "`save` persisted a value to the configured `defaultPath`.",
    })
  ),
  S.TaggedStruct("Updated", { path: S.String }).pipe(
    $I.annoteSchema("ConfigEventPayload.Updated", {
      description: "`update` loaded, transformed and persisted a value. Emitted alone, without a `Saved`.",
    })
  ),
]).pipe(
  $I.annoteSchema("ConfigEventPayload", {
    description: "Every event published during config discovery, parsing, validation and persistence.",
  })
);

/**
 * The decoded form of {@link (ConfigEventPayload:variable)}: a tagged union a subscriber
 * narrows with `switch (payload._tag)`.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ConfigEventPayload = typeof ConfigEventPayload.Type;

/**
 * **Example** (Timestamp a missing configuration event)
 *
 * ```ts
 * import { ConfigEvent } from "@beep/config-file/ConfigEvent"
 * import * as DateTime from "effect/DateTime"
 *
 * const event = ConfigEvent.make({ timestamp: DateTime.makeUnsafe(0), event: { _tag: "NotFound" } });
 * console.log(event.event._tag) // NotFound
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ConfigEvent extends S.Opaque<ConfigEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    /** When the event occurred. */
    timestamp: S.DateTimeUtc.pipe($I.annoteKey("ConfigEvent.timestamp", { description: "When the event occurred." })),
    /** What happened. */
    event: ConfigEventPayload.pipe($I.annoteKey("ConfigEvent.event", { description: "What happened." })),
  }).pipe(
    $I.annoteSchema("ConfigEvent", { description: "A published event: the payload plus the instant it occurred." })
  )
) {}

/**
 * The opt-in event hook: a PubSub of {@link ConfigEvent} that consumers
 * subscribe to.
 *
 * **Details**
 *
 * Opt-in and honestly zero-cost: when `ConfigFileOptions.events` is omitted the
 * pipeline's `emit` is `Effect.void` and never even looks the service up.
 *
 * Events are a **consumer-facing hook**, not the package's observability
 * channel — every public fallible method is also an `Effect.fn` named span, and
 * the library stays telemetry-agnostic.
 *
 * **Example** (Wire a shared config event hub)
 *
 * ```ts
 * import { ConfigEvents } from "@beep/config-file/ConfigEvent"
 * import { ConfigFile } from "@beep/config-file/ConfigFile"
 * import { JsonCodec } from "@beep/config-file/JsonCodec"
 * import { MergeStrategy } from "@beep/config-file/MergeStrategy"
 * import * as Layer from "effect/Layer"
 * import * as S from "effect/Schema"
 *
 * class AppShape extends S.Class<AppShape>("AppShape")({ port: S.Finite }) {}
 * class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("app/Config") {}
 * const events = ConfigEvents.layer;
 * const AppLayer = Layer.mergeAll(
 *   events,
 *   ConfigFile.layer(AppConfig, {
 *     schema: AppShape, codec: JsonCodec, resolvers: [],
 *     strategy: MergeStrategy.firstMatch<AppShape>(), events: ConfigEvents,
 *   }),
 * );
 * console.log(Layer.isLayer(AppLayer)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class ConfigEvents extends Context.Service<
  ConfigEvents,
  {
    /**
     * The hub every {@link ConfigEvent} is published to.
     *
     * @since 0.0.0
     */
    readonly events: PubSub.PubSub<ConfigEvent>;
  }
>()($I`ConfigEvents`) {
  /**
   * An unbounded PubSub of config events.
   *
   * **Gotchas**
   *
   * Unbounded on purpose: a slow subscriber must never apply backpressure to a
   * config load. Bind this to a const and provide that const — building it
   * twice mints two hubs, and the subscriber would watch the one `emit` does
   * not publish to.
   *
   * **Example** (Build a subscriber with the shared hub)
   *
   * ```ts
   * import { ConfigEvents } from "@beep/config-file/ConfigEvent"
   * import * as Effect from "effect/Effect"
   * import * as PubSub from "effect/PubSub"
   *
   * const events = ConfigEvents.layer;
   * const subscriber = Effect.gen(function* () {
   *   const hub = yield* ConfigEvents;
   *   return yield* PubSub.subscribe(hub.events);
   * }).pipe(Effect.provide(events));
   * console.log(Effect.isEffect(subscriber)) // true
   * ```
   *
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<ConfigEvents> = Layer.effect(
    ConfigEvents,
    Effect.gen(function* () {
      return { events: yield* PubSub.unbounded<ConfigEvent>() };
    })
  );
}

/**
 * The service shape {@link ConfigEvents} provides: the hub every
 * {@link ConfigEvent} is published to.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ConfigEventsShape = (typeof ConfigEvents)["Service"];
