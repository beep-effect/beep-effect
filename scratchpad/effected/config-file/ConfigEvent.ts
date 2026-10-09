import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as S from "effect/Schema";

/**
 * A reference to one configuration source that contributed to a load.
 *
 * @remarks
 * Carries the resolver's name alongside the path so a subscriber can tell
 * `/etc/app/.apprc` found by `systemEtc` from the same path passed explicitly.
 *
 * @public
 */
export const ConfigSourceRef = S.Struct({
	/** The filesystem path the value was read from. */
	path: S.String,
	/** The name of the resolver that found it. */
	resolver: S.String,
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
export const ConfigEventPayload = S.Union([
	/** A resolver matched a path. Emitted before the file is read. */
	S.TaggedStruct("Discovered", { path: S.String, resolver: S.String }),
	/** The resolver chain matched nothing. */
	S.TaggedStruct("NotFound", {}),
	/** The codec turned file content into a document. */
	S.TaggedStruct("Parsed", { path: S.String, codec: S.String }),
	/** The codec could not parse the file's content. */
	S.TaggedStruct("ParseFailed", { path: S.String, codec: S.String, error: S.Defect() }),
	/** The document satisfied the schema and any caller-supplied `validate`. */
	S.TaggedStruct("Validated", { path: S.String }),
	/** The document did not satisfy the schema, or `validate` rejected it. */
	S.TaggedStruct("ValidationFailed", { path: S.String, error: S.Defect() }),
	/**
	 * The merge strategy combined the discovered sources into one value.
	 *
	 * @remarks
	 * Carries EVERY contributing source — under `layeredMerge` all of them
	 * contributed, not just the first.
	 */
	S.TaggedStruct("Resolved", { sources: S.Array(ConfigSourceRef), strategy: S.String }),
	/** The load completed. Carries every contributing source, as `Resolved` does. */
	S.TaggedStruct("Loaded", { sources: S.Array(ConfigSourceRef) }),
	/** The codec could not serialize the value. */
	S.TaggedStruct("StringifyFailed", { codec: S.String, error: S.Defect() }),
	/** `write` persisted a value to an explicit path. */
	S.TaggedStruct("Written", { path: S.String }),
	/** `save` persisted a value to the configured `defaultPath`. */
	S.TaggedStruct("Saved", { path: S.String }),
	/** `update` loaded, transformed and persisted a value. Emitted alone. */
	S.TaggedStruct("Updated", { path: S.String }),
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
export class ConfigEvent extends S.Class<ConfigEvent>("ConfigEvent")({
	/** When the event occurred. */
	timestamp: S.DateTimeUtc,
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
	"@beep/scratchpad/effected/config-file/ConfigEvent/ConfigEvents",
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
