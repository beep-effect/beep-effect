/**
 * Schema-derived selection options shared by journal readers.
 * @packageDocumentation
 * @since 0.0.0
 */
// The one filter shape, shared by every read surface.
//
// One vocabulary means one thing to learn: a consumer who can express a
// subscription can express a query and a projection without translating. It is
// also what makes the filter-before-decode guarantee expressible — every field
// here lives on the envelope **frame**, so matching never touches `data`.
import * as P from "effect/Predicate";
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { EnvelopeFrame } from "./Envelope.ts";
import type { JsonlEvent } from "./JsonlEvent.ts";
import { ByteCount } from "./LineSlice.ts";

const $I = $ScratchpadId.create("effected/jsonl/Slice");

// Selection options are plain boundary inputs. Their schemas retain literal tags
// while preserving ordinary object-literal calls to query, changes and projection.
// Every key is optional with upstream omission semantics: an explicitly
// undefined key selects exactly what an omitted one does.
const fields = <T extends string>(event: S.Codec<T>) => ({
  events: event.pipe(S.Array, S.optional),
  scopes: S.String.pipe(S.Array, S.optional),
  from: S.optional(S.DateTimeUtc),
  to: S.optional(S.DateTimeUtc),
});
/**
 * Build selection options whose event filter retains the supplied tag domain.
 *
 * **Example** (Validate registered event filters)
 * ```ts import.meta.vitest name="Validate registered event filters"
 * import { Slice } from "@beep/scratchpad/effected/jsonl/Slice";
 * import * as S from "effect/Schema";
 * const selection = Slice(S.Literal("mail"));
 * S.is(selection)({ events: ["mail"] }) // => true
 * S.is(selection)({ events: ["foreign"] }) // => false
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Slice = <T extends string>(event: S.Codec<T>) =>
  event
    .pipe(fields, S.Struct)
    .annotate($I.annote("Slice", { description: "Frame selection with inclusive from and exclusive to bounds." }));
/**
 * Build selection options with a non-negative integer resume cursor.
 *
 * **Example** (Validate logical byte cursors)
 * ```ts import.meta.vitest name="Validate logical byte cursors"
 * import { CursoredSlice } from "@beep/scratchpad/effected/jsonl/Slice";
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
    cursor: S.optional(ByteCount),
  }).annotate(
    $I.annote("CursoredSlice", { description: "Frame selection resumed at a logical post-BOM byte offset." })
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
 * import { matchesFrame } from "@beep/scratchpad/effected/jsonl/Slice";
 * import * as DateTime from "effect/DateTime";
 * const frame = {at:DateTime.makeUnsafe(0),event:"started",data:null};
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
} = dual(2, (frame: EnvelopeFrame, slice: Slice<JsonlEvent.Registry, string> | undefined): boolean => {
  if (P.isUndefined(slice)) {
    return true;
  }
  if (P.isNotUndefined(slice.events) && !A.contains(slice.events, frame.event)) {
    return false;
  }
  if (P.isNotUndefined(slice.scopes)) {
    if (P.isUndefined(frame.scope) || !A.contains(slice.scopes, frame.scope)) {
      return false;
    }
  }
  const millis = frame.at.epochMilliseconds;
  if (
    P.isNotUndefined(slice.from) && millis < slice.from.epochMilliseconds) {
    return false;
  }
  return !(P.isNotUndefined(slice.to) && millis >= slice.to.epochMilliseconds);
});
