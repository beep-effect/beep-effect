import { Context, Effect, Layer, PubSub, Schema } from "effect";

/**
 * A reference to one configuration source that contributed to a load.
 *
 * @remarks
 * Carries the resolver's name alongside the path so a subscriber can tell
 * `/etc/app/.apprc` found by `systemEtc` from the same path passed explicitly.
 *
 * @public
 */
export const ConfigSourceRef = Schema.Struct({
	/** The filesystem path the value was read from. */
	path: Schema.String,
	/** The name of the resolver that found it. */
	resolver: Schema.String,
});

/**
 * Every event published during config discovery, parsing, validation and
 * persistence.
 *
 * @remarks
 * There is no discovery-failure variant: under this package's
 * resolver-absorption contract a resolver's error channel is `never` — every
 * filesystem failure becomes `Option.none()` — so the pipeline never observes a
 * discovery failure to report.
 *
 * The failure variants carry the **structured** typed error in `error`, not a
 * `reason` string, so every field a subscriber might branch on survives; a
 * subscriber that wants prose can read `error.message`.
 *
 * @public
 */
export const ConfigEventPayload = Schema.Union([
	/** A resolver matched a path. Emitted before the file is read. */
	Schema.TaggedStruct("Discovered", { path: Schema.String, resolver: Schema.String }),
	/** The resolver chain matched nothing. */
	Schema.TaggedStruct("NotFound", {}),
	/** The codec turned file content into a document. */
	Schema.TaggedStruct("Parsed", { path: Schema.String, codec: Schema.String }),
	/** The codec could not parse the file's content. */
	Schema.TaggedStruct("ParseFailed", { path: Schema.String, codec: Schema.String, error: Schema.Defect() }),
	/** The document satisfied the schema and any caller-supplied `validate`. */
	Schema.TaggedStruct("Validated", { path: Schema.String }),
	/** The document did not satisfy the schema, or `validate` rejected it. */
	Schema.TaggedStruct("ValidationFailed", { path: Schema.String, error: Schema.Defect() }),
	/**
	 * The merge strategy combined the discovered sources into one value.
	 *
	 * @remarks
	 * Carries EVERY contributing source — under `layeredMerge` all of them
	 * contributed, not just the first.
	 */
	Schema.TaggedStruct("Resolved", { sources: Schema.Array(ConfigSourceRef), strategy: Schema.String }),
	/** The load completed. Carries every contributing source, as `Resolved` does. */
	Schema.TaggedStruct("Loaded", { sources: Schema.Array(ConfigSourceRef) }),
	/** The codec could not serialize the value. */
	Schema.TaggedStruct("StringifyFailed", { codec: Schema.String, error: Schema.Defect() }),
	/** `write` persisted a value to an explicit path. */
	Schema.TaggedStruct("Written", { path: Schema.String }),
	/** `save` persisted a value to the configured `defaultPath`. */
	Schema.TaggedStruct("Saved", { path: Schema.String }),
	/** `update` loaded, transformed and persisted a value. Emitted alone. */
	Schema.TaggedStruct("Updated", { path: Schema.String }),
]);

/**
 * The decoded form of {@link (ConfigEventPayload:variable)}: a tagged union a subscriber
 * narrows with `switch (payload._tag)`.
 *
 * @public
 */
export type ConfigEventPayload = typeof ConfigEventPayload.Type;

/**
 * A published event: the payload plus the instant it occurred.
 *
 * @public
 */
export class ConfigEvent extends Schema.Class<ConfigEvent>("ConfigEvent")({
	/** When the event occurred. */
	timestamp: Schema.DateTimeUtc,
	/** What happened. */
	event: ConfigEventPayload,
}) {}

/**
 * The service shape {@link ConfigEvents} provides.
 *
 * @public
 */
export interface ConfigEventsShape {
	/** The hub every {@link ConfigEvent} is published to. */
	readonly events: PubSub.PubSub<ConfigEvent>;
}

/**
 * The opt-in event hook: a PubSub of {@link ConfigEvent} that consumers
 * subscribe to.
 *
 * @remarks
 * Opt-in and honestly zero-cost: when `ConfigFileOptions.events` is omitted the
 * pipeline's `emit` is `Effect.void` and never even looks the service up.
 *
 * Events are a **consumer-facing hook**, not the package's observability
 * channel — every public fallible method is also an `Effect.fn` named span, and
 * the library stays telemetry-agnostic.
 *
 * @example
 * ```ts
 * const events = ConfigEvents.layer;
 * const AppLayer = Layer.mergeAll(
 * 	events,
 * 	ConfigFile.layer(AppConfig, { schema, codec, resolvers, strategy, events: ConfigEvents }),
 * );
 * ```
 *
 * @public
 */
export class ConfigEvents extends Context.Service<ConfigEvents, ConfigEventsShape>()(
	"@effected/config-file/ConfigEvents",
) {
	/**
	 * An unbounded PubSub of config events.
	 *
	 * @remarks
	 * Unbounded on purpose: a slow subscriber must never apply backpressure to a
	 * config load. Bind this to a const and provide that const — building it
	 * twice mints two hubs, and the subscriber would watch the one `emit` does
	 * not publish to.
	 */
	static readonly layer: Layer.Layer<ConfigEvents> = Layer.effect(
		ConfigEvents,
		Effect.gen(function* () {
			return { events: yield* PubSub.unbounded<ConfigEvent>() };
		}),
	);
}
