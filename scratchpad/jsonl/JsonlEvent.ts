/**
 * Event definitions and the registry they form.
 *
 * Modeled on core's `effect/unstable/eventlog` `Event` — a tag plus a payload
 * schema, defined once and collected into a group — so a reader who knows that
 * module recognizes this one. The mechanism is ours; the vocabulary is theirs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { Schema } from "effect";

/**
 * The bound every registered payload schema must satisfy: a codec requiring
 * **no services** in either direction.
 *
 * This is a contract, not an implementation detail. The pure core decodes with
 * `Schema.decodeUnknownResult` and encodes with `Schema.encodeUnknownResult`,
 * both of which demand `never` in both service slots — so a payload schema that
 * needed a service would make the synchronous, runtime-free read path
 * impossible. Bounding it here fails such a schema at **registration**, where
 * the mistake is, instead of at some consumer's call site later.
 *
 * **Gotchas**
 *
 * `Schema.Top` is deliberately not the bound: its service parameters are
 * `unknown`, so it does not satisfy the sync codecs and the constraint would
 * silently fail to bind. A payload-less event still has to name `data`
 * (`Schema.Void`); omitting it is a type error rather than a silent void.
 *
 * @see {@link JsonlEvent} for the factory that requires this bound on `data`.
 * @see {@link Envelope} for the two-stage decode that uses the sync codecs.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type DataSchema = Schema.Codec<unknown, unknown, never, never>;

/**
 * Brand carried on every {@link JsonlEvent} definition so a value can be
 * recognized as one without trusting its shape.
 *
 * @see {@link JsonlEventTypeId} for the runtime string this type names.
 * @public
 * @category type-ids
 * @since 0.0.0
 */
export type JsonlEventTypeId = "~effected/jsonl/JsonlEvent";

/**
 * Runtime brand written onto every {@link JsonlEvent} at `make`.
 *
 * **Example** (Identity of a made event)
 *
 * ```ts
 * import { JsonlEvent, JsonlEventTypeId } from "@beep/scratchpad/jsonl"
 * import * as S from "effect/Schema"
 *
 * const Started = JsonlEvent.make("started", { data: S.Void })
 * console.log(Started[JsonlEventTypeId] === JsonlEventTypeId) // true
 * console.log(JsonlEventTypeId) // "~effected/jsonl/JsonlEvent"
 * ```
 *
 * @see {@link JsonlEventTypeId} for the type-level twin of this string.
 * @public
 * @category type-ids
 * @since 0.0.0
 */
export const JsonlEventTypeId: JsonlEventTypeId = "~effected/jsonl/JsonlEvent";

/**
 * One event definition: a tag, the schema its `data` must satisfy, and the two
 * lifecycle markings.
 *
 * The type parameters are what make a registry more than a runtime list — the
 * literal `Tag`, the payload schema and the `terminal`/`reopen` flags all
 * survive into the derived envelope union, so `append` narrows on the tag and a
 * projection over a slice is exhaustively checkable.
 *
 * **Gotchas**
 *
 * `data` is required rather than defaulted. A payload-less event says so
 * explicitly with `Schema.Void`; a typo in the options object must not become
 * a silent void payload. Codecs are `never`-service — see {@link DataSchema}.
 *
 * @see {@link DataSchema} for the no-services payload bound.
 * @see {@link Envelope} for the discriminated union derived from a registry.
 * @see {@link TerminalViolation} for the append failure a `terminal` tail raises.
 * @public
 * @category models
 * @since 0.0.0
 */
export interface JsonlEvent<
	out Tag extends string,
	in out Data extends DataSchema = Schema.Codec<void, void, never, never>,
	out Terminal extends boolean = false,
	out Reopen extends boolean = false,
> {
	readonly [JsonlEventTypeId]: JsonlEventTypeId;
	/** The string tag: the envelope discriminant and the primary filter key. */
	readonly tag: Tag;
	/** The schema the envelope's `data` is validated against. */
	readonly data: Data;
	/**
	 * Whether this event makes the journal quiescent.
	 *
	 * After a terminal event is the tail, appending fails with
	 * `TerminalViolation` unless the appended event is marked `reopen`.
	 */
	readonly terminal: Terminal;
	/** Whether this event may follow a terminal one, reopening the journal. */
	readonly reopen: Reopen;
}

/**
 * Helper types for working with event definitions and registries.
 *
 * **Example** (Tag union from a registry)
 *
 * ```ts
 * import { JsonlEvent } from "@beep/scratchpad/jsonl"
 * import * as S from "effect/Schema"
 *
 * const MailReceived = JsonlEvent.make("mail-received", {
 *   data: S.Struct({ round: S.Number }),
 * })
 * const Unlinked = JsonlEvent.make("unlinked", { data: S.Void, terminal: true })
 * const registry = [MailReceived, Unlinked] as const satisfies JsonlEvent.Registry
 * const tag: JsonlEvent.Tag<typeof registry> = "unlinked"
 * console.log(tag) // "unlinked"
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JsonlEvent {
	/**
	 * A type-erased event definition.
	 *
	 * Note `data` is bounded by {@link DataSchema} rather than widened to
	 * `Schema.Top`: erasing to `Top` would lose the no-services guarantee that
	 * the sync codecs depend on.
	 *
	 * @public
	 * @category type-level
	 * @since 0.0.0
	 */
	export interface Any {
		readonly [JsonlEventTypeId]: JsonlEventTypeId;
		readonly tag: string;
		readonly data: DataSchema;
		readonly terminal: boolean;
		readonly reopen: boolean;
	}

	/**
	 * A registry: the set of events one journal may carry.
	 *
	 * @category type-level
	 * @since 0.0.0
	 */
	export type Registry = ReadonlyArray<Any>;

	/**
	 * The union of every event definition in a registry.
	 *
	 * @category type-level
	 * @since 0.0.0
	 */
	export type Events<R extends Registry> = R[number];

	/**
	 * The union of every tag in a registry — the envelope discriminant.
	 *
	 * @category type-level
	 * @since 0.0.0
	 */
	export type Tag<R extends Registry> = Events<R>["tag"];

	/**
	 * The event definition in a registry carrying a given tag.
	 *
	 * @category type-level
	 * @since 0.0.0
	 */
	export type WithTag<R extends Registry, T extends string> = Extract<Events<R>, { readonly tag: T }>;

	/**
	 * The decoded payload type registered for a given tag.
	 *
	 * @category type-level
	 * @since 0.0.0
	 */
	export type Data<R extends Registry, T extends string> = WithTag<R, T>["data"]["Type"];

	/**
	 * The tags marked `terminal` in a registry.
	 *
	 * @category type-level
	 * @since 0.0.0
	 */
	export type TerminalTags<R extends Registry> = Extract<Events<R>, { readonly terminal: true }>["tag"];

	/**
	 * The tags marked `reopen` in a registry.
	 *
	 * @category type-level
	 * @since 0.0.0
	 */
	export type ReopenTags<R extends Registry> = Extract<Events<R>, { readonly reopen: true }>["tag"];
}

/**
 * Defines an event.
 *
 * The `const` type parameters are load-bearing: they keep `"unlinked"` a
 * literal rather than widening it to `string`, and keep `terminal: true` a
 * literal `true`, so both survive into the derived envelope union where the
 * narrowing and the terminal/reopen state machine depend on them.
 *
 * `data` is required rather than defaulted. A payload-less event says so
 * explicitly with `Schema.Void`, because a silent default would make a typo in
 * the options object look like a deliberate void payload.
 *
 * **Gotchas**
 *
 * Payload schemas must satisfy {@link DataSchema} (`never` services in both
 * directions). A schema that needs a service fails at registration, not on the
 * hook read path.
 *
 * **Example** (Register terminal and reopen events)
 *
 * ```ts
 * import { JsonlEvent } from "@beep/scratchpad/jsonl"
 * import * as S from "effect/Schema"
 *
 * const MailReceived = JsonlEvent.make("mail-received", {
 *   data: S.Struct({ round: S.Number }),
 * })
 * const Unlinked = JsonlEvent.make("unlinked", { data: S.Void, terminal: true })
 * const Relinked = JsonlEvent.make("relinked", { data: S.Void, reopen: true })
 * const registry = [MailReceived, Unlinked, Relinked] as const satisfies JsonlEvent.Registry
 *
 * console.log(MailReceived.tag) // "mail-received"
 * console.log(Unlinked.terminal) // true
 * console.log(Relinked.reopen) // true
 * console.log(registry.length) // 3
 * ```
 *
 * @see {@link DataSchema} for the no-services payload bound `make` enforces.
 * @see {@link Envelope} for decode/encode over a registry of these definitions.
 * @see {@link TerminalViolation} for the append failure a `terminal` tail raises.
 * @public
 * @category factories
 * @since 0.0.0
 */
export const JsonlEvent = {
	make: <
		const Tag extends string,
		Data extends DataSchema,
		const Terminal extends boolean = false,
		const Reopen extends boolean = false,
	>(
		tag: Tag,
		options: {
			readonly data: Data;
			readonly terminal?: Terminal | undefined;
			readonly reopen?: Reopen | undefined;
		},
	): JsonlEvent<Tag, Data, Terminal, Reopen> => ({
		[JsonlEventTypeId]: JsonlEventTypeId,
		tag,
		data: options.data,
		terminal: (options.terminal ?? false) as Terminal,
		reopen: (options.reopen ?? false) as Reopen,
	}),
} as const;
