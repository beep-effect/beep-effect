/**
 * Schema-derived selection options shared by journal readers.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $JsonlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ByteCount } from "./LineSlice.ts";
import type { EnvelopeFrame } from "./Envelope.ts";
import type { JsonlEvent } from "./JsonlEvent.ts";

const $I = $JsonlId.create("Slice");

const fields = <T extends string>(event: S.Codec<T>) => ({
  events: event.pipe(S.Array, S.optionalKey),
  scopes: S.String.pipe(S.Array, S.optionalKey),
  from: S.optionalKey(S.DateTimeUtc),
  to: S.optionalKey(S.DateTimeUtc),
});
/**
 * Build selection options whose event filter retains the supplied tag domain.
 *
 * **Example** (Validate registered event filters)
 * ```ts import.meta.vitest name="Validate registered event filters"
 * import { Slice } from "@beep/jsonl/Slice";
 * import * as S from "effect/Schema";
 * const selection = Slice(S.Literal("mail"));
 * S.is(selection)({ events: ["mail"] }) // => true
 * S.is(selection)({ events: ["foreign"] }) // => false
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Slice = <T extends string>(event: S.Codec<T>) =>
  event.pipe(
    fields,
    S.Struct,
    $I.annoteSchema("Slice", { description: "Frame selection with inclusive from and exclusive to bounds." })
  );
/**
 * Build selection options with a non-negative integer resume cursor.
 *
 * **Example** (Validate logical byte cursors)
 * ```ts import.meta.vitest name="Validate logical byte cursors"
 * import { CursoredSlice } from "@beep/jsonl/Slice";
 * import * as S from "effect/Schema";
 * const selection = CursoredSlice(S.Literal("mail"));
 * S.is(selection)({ cursor: 0 }) // => true
 * S.is(selection)({ cursor: -1 }) // => false
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CursoredSlice = <T extends string>(event: S.Codec<T>) =>
  S.Struct({
    ...fields(event),
    cursor: S.optionalKey(ByteCount),
  }).pipe(
    $I.annoteSchema("CursoredSlice", { description: "Frame selection resumed at a logical post-BOM byte offset." })
  );

/**
 * Frame selection shared by queries, subscriptions and projections. Fields
 * combine with AND; omitted or undefined fields do not filter, while empty
 * arrays match nothing. Time bounds are inclusive at from and exclusive at to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Slice<R extends JsonlEvent.Registry, T extends JsonlEvent.Tag<R>> = ReturnType<typeof Slice<T>>["Type"];

/**
 * A slice with an inclusive resume cursor in logical bytes, excluding a BOM.
 * Persist an envelope's line.end to resume without redelivering that envelope.
 * An undefined cursor is an omitted cursor: no replay.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CursoredSlice<R extends JsonlEvent.Registry, T extends JsonlEvent.Tag<R>> = ReturnType<
  typeof CursoredSlice<T>
>["Type"];

const matchesEvent = (frame: EnvelopeFrame, slice: Slice<JsonlEvent.Registry, string>): boolean =>
  P.isUndefined(slice.events) || A.contains(slice.events, frame.event);

const matchesScope = (frame: EnvelopeFrame, slice: Slice<JsonlEvent.Registry, string>): boolean =>
  P.isUndefined(slice.scopes) || (P.isNotUndefined(frame.scope) && A.contains(slice.scopes, frame.scope));

const matchesHalfOpenWindow = (frame: EnvelopeFrame, slice: Slice<JsonlEvent.Registry, string>): boolean => {
  const millis = frame.at.epochMilliseconds;
  const atOrAfterInclusiveFrom = P.isUndefined(slice.from) || millis >= slice.from.epochMilliseconds;
  return atOrAfterInclusiveFrom && (P.isUndefined(slice.to) || millis < slice.to.epochMilliseconds);
};

/**
 * Whether a frame satisfies a slice.
 *
 * **Details**
 *
 * Takes the **frame**, never a decoded envelope — that is what keeps matching
 * ahead of the payload schema on the read path.
 *
 * **Example** (Select a frame without decoding data)
 *
 * ```ts import.meta.vitest name="Select a frame without decoding data"
 * import { EnvelopeFrame } from "@beep/jsonl/Envelope";
 * import { matchesFrame } from "@beep/jsonl/Slice";
 * import * as DateTime from "effect/DateTime";
 * const frame = EnvelopeFrame.make({at:DateTime.makeUnsafe(0),event:"started",data:null});
 * matchesFrame(frame, {events:["started"]}) // => true
 * ```
 *
 * @internal
 * @category filtering
 * @since 0.0.0
 */
export const matchesFrame: {
  (frame: EnvelopeFrame, slice: Slice<JsonlEvent.Registry, string> | undefined): boolean;
  (slice: Slice<JsonlEvent.Registry, string> | undefined): (frame: EnvelopeFrame) => boolean;
} = dual(
  2,
  (frame: EnvelopeFrame, slice: Slice<JsonlEvent.Registry, string> | undefined): boolean =>
    P.isUndefined(slice) ||
    (matchesEvent(frame, slice) && matchesScope(frame, slice) && matchesHalfOpenWindow(frame, slice))
);
