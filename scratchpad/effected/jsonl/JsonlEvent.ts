/**
 * Event definitions retaining literal tags, payload codecs and lifecycle flags.
 * @packageDocumentation
 * @since 0.0.0
 */
// Event definitions and the registry they form.
//
// Modeled on core's `effect/eventlog` `Event` — a tag plus a payload
// schema, defined once and collected into a group — so a reader who knows that
// module recognizes this one. The mechanism is ours; the vocabulary is theirs.

import type * as S from "effect/Schema";
import { Envelope } from "./Envelope.ts";

/**
 * The bound every registered payload schema must satisfy: a codec requiring
 * **no services** in either direction.
 *
 * **Details**
 *
 * This is a contract, not an implementation detail. The pure core decodes with
 * `S.decodeUnknownResult` and encodes with `S.encodeUnknownResult`,
 * both of which demand `never` in both service slots — so a payload schema that
 * needed a service would make the synchronous, runtime-free read path
 * impossible. Bounding it here fails such a schema at **registration**, where
 * the mistake is, instead of at some consumer's call site later.
 *
 * `S.Top` is deliberately not the bound: its service parameters are
 * `unknown`, so it does not satisfy the sync codecs and the constraint would
 * silently fail to bind. The value slots are `unknown` rather than `any`
 * because `Codec`'s type and encoded parameters are covariant, so `unknown`
 * admits every concrete payload schema while still rejecting a
 * service-requiring one — the precision costs nothing here.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type DataSchema = S.Codec<unknown, unknown>;

/**
 * Unique type identifier marking a JSONL event definition.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type JsonlEventTypeId = "~effected/jsonl/JsonlEvent";

/**
 * Runtime type identifier marking a JSONL event definition.
 *
 * **Example** (Identify an event definition)
 * ```ts import.meta.vitest name="Identify an event definition"
 * import { JsonlEvent, JsonlEventTypeId } from "@beep/scratchpad/effected/jsonl/index";
 * import * as S from "effect/Schema";
 * const event = JsonlEvent.make("started", { data: S.String });
 * event[JsonlEventTypeId] === JsonlEventTypeId // => true
 * ```
 *
 * @public
 * @category type-ids
 * @since 0.0.0
 */
export const JsonlEventTypeId: JsonlEventTypeId = "~effected/jsonl/JsonlEvent";

/**
 * One event definition: a tag, the schema its `data` must satisfy, and the two
 * lifecycle markings.
 *
 * **Details**
 *
 * The type parameters are what make a registry more than a runtime list — the
 * literal `Tag`, the payload schema and the `terminal`/`reopen` flags all
 * survive into the derived envelope union, so `append` narrows on the tag and a
 * projection over a slice is exhaustively checkable.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface JsonlEvent<
  out Tag extends string,
  in out Data extends DataSchema = S.Codec<void, void>,
  out Terminal extends boolean = false,
  out Reopen extends boolean = false,
> {
  readonly [JsonlEventTypeId]: JsonlEventTypeId;
  /** The string tag: the envelope discriminant and the primary filter key. */
  readonly tag: Tag;
  /** The schema the envelope's `data` is validated against. */
  readonly data: Data;
  /** The selected event's envelope codec, applied after frame filtering. */
  readonly envelope: S.Codec<Envelope<Tag, Data["Type"]>, unknown>;
  /**
   * Whether this event makes the journal quiescent.
   *
   * **Details**
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
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JsonlEvent {
  /**
   * A type-erased event definition.
   *
   * **Details**
   *
   * Note `data` is bounded by {@link DataSchema} rather than widened to
   * `S.Top`: erasing to `Top` would lose the no-services guarantee that
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
    readonly envelope: S.Codec<Envelope<string, unknown>, unknown>;
    readonly terminal: boolean;
    readonly reopen: boolean;
  }

  /**
   * A registry: the set of events one journal may carry.
   * @category type-level
   * @since 0.0.0
   */
  export type Registry = ReadonlyArray<Any>;

  /**
   * The union of every event definition in a registry.
   * @category type-level
   * @since 0.0.0
   */
  export type Events<R extends Registry> = R[number];

  /**
   * The union of every tag in a registry — the envelope discriminant.
   * @category type-level
   * @since 0.0.0
   */
  export type Tag<R extends Registry> = Events<R>["tag"];

  /**
   * The event definition in a registry carrying a given tag.
   * @category type-level
   * @since 0.0.0
   */
  export type WithTag<R extends Registry, T extends string> = Extract<Events<R>, { readonly tag: T }>;

  /**
   * The decoded payload type registered for a given tag.
   * @category type-level
   * @since 0.0.0
   */
  export type Data<R extends Registry, T extends string> = WithTag<R, T>["data"]["Type"];

  /**
   * The tags marked `terminal` in a registry.
   * @category type-level
   * @since 0.0.0
   */
  export type TerminalTags<R extends Registry> = Extract<Events<R>, { readonly terminal: true }>["tag"];

  /**
   * The tags marked `reopen` in a registry.
   * @category type-level
   * @since 0.0.0
   */
  export type ReopenTags<R extends Registry> = Extract<Events<R>, { readonly reopen: true }>["tag"];
}

/**
 * Defines an event.
 *
 * **Details**
 *
 * The `const` type parameters are load-bearing: they keep `"unlinked"` a
 * literal rather than widening it to `string`, and keep `terminal: true` a
 * literal `true`, so both survive into the derived envelope union where the
 * narrowing and the terminal/reopen state machine depend on them.
 *
 * `data` is required rather than defaulted. A payload-less event says so
 * explicitly with `S.Void`, because a silent default would make a typo in
 * the options object look like a deliberate void payload.
 *
 * **Example** (Define payload and lifecycle contracts)
 * ```ts import.meta.vitest name="Define payload and lifecycle contracts"
 * import { JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
 * import * as S from "effect/Schema";
 * const updated = JsonlEvent.make("updated", { data: S.Struct({ count: S.Finite }) });
 * const closed = JsonlEvent.make("closed", { data: S.Null, terminal: true });
 * const reopened = JsonlEvent.make("reopened", { data: S.Null, reopen: true });
 * [updated.tag, closed.terminal, reopened.reopen] // => ["updated", true, true]
 * ```
 *
 * @public
 * @category constructors
 * @since 0.0.0
 */
export const JsonlEvent = { make };

function make<const Tag extends string, Data extends DataSchema>(
  tag: Tag,
  options: { readonly data: Data; readonly terminal?: false | undefined; readonly reopen?: false | undefined }
): JsonlEvent<Tag, Data>;
function make<const Tag extends string, Data extends DataSchema, const Terminal extends boolean>(
  tag: Tag,
  options: { readonly data: Data; readonly terminal: Terminal; readonly reopen?: false | undefined }
): JsonlEvent<Tag, Data, Terminal>;
function make<const Tag extends string, Data extends DataSchema, const Reopen extends boolean>(
  tag: Tag,
  options: { readonly data: Data; readonly terminal?: false | undefined; readonly reopen: Reopen }
): JsonlEvent<Tag, Data, false, Reopen>;
function make<
  const Tag extends string,
  Data extends DataSchema,
  const Terminal extends boolean,
  const Reopen extends boolean,
>(
  tag: Tag,
  options: { readonly data: Data; readonly terminal: Terminal; readonly reopen: Reopen }
): JsonlEvent<Tag, Data, Terminal, Reopen>;
function make<const Tag extends string, Data extends DataSchema>(
  tag: Tag,
  options: { readonly data: Data; readonly terminal?: boolean | undefined; readonly reopen?: boolean | undefined }
): JsonlEvent<Tag, Data, boolean, boolean>;
function make<Tag extends string, Data extends DataSchema>(
  tag: Tag,
  options: { readonly data: Data; readonly terminal?: boolean | undefined; readonly reopen?: boolean | undefined }
): JsonlEvent<Tag, Data, boolean, boolean> {
  const data: S.Codec<Data["Type"], Data["Encoded"]> = options.data;
  return {
    [JsonlEventTypeId]: JsonlEventTypeId,
    tag,
    data: options.data,
    envelope: Envelope.schema(tag, data),
    terminal: options.terminal ?? false,
    reopen: options.reopen ?? false,
  };
}
