/**
 * Event definitions and the registry they form.
 *
 * Modeled on core's `effect/unstable/eventlog` `Event` — a tag plus a payload
 * schema, defined once and collected into a group — so a reader who knows that
 * module recognizes this one. The mechanism is ours; the vocabulary is theirs.
 *
 * @since 0.1.0
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
 * `Schema.Top` is deliberately not the bound: its service parameters are
 * `unknown`, so it does not satisfy the sync codecs and the constraint would
 * silently fail to bind. The value slots are `unknown` rather than `any`
 * because `Codec`'s type and encoded parameters are covariant, so `unknown`
 * admits every concrete payload schema while still rejecting a
 * service-requiring one — the precision costs nothing here.
 *
 * @public
 */
export type DataSchema = Schema.Codec<unknown, unknown, never, never>;

/**
 * Unique type identifier marking a JSONL event definition.
 *
 * @public
 */
export type JsonlEventTypeId = "~effected/jsonl/JsonlEvent";

/**
 * Runtime type identifier marking a JSONL event definition.
 *
 * @public
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
 * @public
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
 * @public
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
	 */
	export interface Any {
		readonly [JsonlEventTypeId]: JsonlEventTypeId;
		readonly tag: string;
		readonly data: DataSchema;
		readonly terminal: boolean;
		readonly reopen: boolean;
	}

	/** A registry: the set of events one journal may carry. */
	export type Registry = ReadonlyArray<Any>;

	/** The union of every event definition in a registry. */
	export type Events<R extends Registry> = R[number];

	/** The union of every tag in a registry — the envelope discriminant. */
	export type Tag<R extends Registry> = Events<R>["tag"];

	/** The event definition in a registry carrying a given tag. */
	export type WithTag<R extends Registry, T extends string> = Extract<Events<R>, { readonly tag: T }>;

	/** The decoded payload type registered for a given tag. */
	export type Data<R extends Registry, T extends string> = WithTag<R, T>["data"]["Type"];

	/** The tags marked `terminal` in a registry. */
	export type TerminalTags<R extends Registry> = Extract<Events<R>, { readonly terminal: true }>["tag"];

	/** The tags marked `reopen` in a registry. */
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
 * @example
 * ```ts
 * import { JsonlEvent } from "@effected/jsonl";
 * import { Schema } from "effect";
 *
 * const MailReceived = JsonlEvent.make("mail-received", {
 *   data: Schema.Struct({ round: Schema.Number }),
 * });
 * const Unlinked = JsonlEvent.make("unlinked", { data: Schema.Void, terminal: true });
 * const Relinked = JsonlEvent.make("relinked", { data: Schema.Void, reopen: true });
 *
 * const registry = [MailReceived, Unlinked, Relinked] as const;
 * ```
 *
 * @public
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
