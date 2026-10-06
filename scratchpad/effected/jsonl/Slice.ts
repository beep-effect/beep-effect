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

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { EnvelopeFrame } from "./Envelope.js";
import type { JsonlEvent } from "./JsonlEvent.js";

const $I = $ScratchpadId.create("effected/jsonl/Slice");

// Selection options are plain boundary inputs. Their schemas retain literal tags
// while preserving ordinary object-literal calls to query, changes and projection.
const fields = <T extends string>(event: S.Codec<T>) => ({
  events: event.pipe(S.Array, S.optional),
  scopes: S.String.pipe(S.Array, S.optional),
  from: S.optional(S.DateTimeUtc),
  to: S.optional(S.DateTimeUtc),
});
const slice = <T extends string>(event: S.Codec<T>) =>
  event
    .pipe(fields, S.Struct)
    .annotate($I.annote("Slice", { description: "Frame selection with inclusive from and exclusive to bounds." }));
const cursoredSlice = <T extends string>(event: S.Codec<T>) =>
  S.Struct({
    ...fields(event),
    cursor: S.optional(S.Int.check(S.isGreaterThanOrEqualTo(0))),
  }).annotate(
    $I.annote("CursoredSlice", { description: "Frame selection resumed at a logical post-BOM byte offset." }),
  );

/**
 * Frame selection shared by queries, subscriptions and projections. Fields
 * combine with AND; omitted fields do not filter, while empty arrays match
 * nothing. Time bounds are inclusive at from and exclusive at to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Slice<R extends JsonlEvent.Registry, T extends JsonlEvent.Tag<R>> = ReturnType<typeof slice<T>>["Type"];

/**
 * A slice with an inclusive resume cursor in logical bytes, excluding a BOM.
 * Persist an envelope's line.end to resume without redelivering that envelope.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CursoredSlice<R extends JsonlEvent.Registry, T extends JsonlEvent.Tag<R>> = ReturnType<
  typeof cursoredSlice<T>
>["Type"];

/**
 * Whether a frame satisfies a slice.
 *
 * Takes the **frame**, never a decoded envelope — that is what keeps matching
 * ahead of the payload schema on the read path.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const matchesFrame: {
  (frame: EnvelopeFrame, slice: Slice<JsonlEvent.Registry, string> | undefined): boolean;
  (slice: Slice<JsonlEvent.Registry, string> | undefined): (frame: EnvelopeFrame) => boolean;
} = dual(2, (frame: EnvelopeFrame, slice: Slice<JsonlEvent.Registry, string> | undefined): boolean => {
  if (slice === undefined) {
    return true;
  }
  if (slice.events !== undefined && !A.contains(slice.events, frame.event)) {
    return false;
  }
  if (slice.scopes !== undefined) {
    if (frame.scope === undefined || !A.contains(slice.scopes, frame.scope)) {
      return false;
    }
  }
  const millis = frame.at.epochMilliseconds;
  if (slice.from !== undefined && millis < slice.from.epochMilliseconds) {
    return false;
  }
  return !(slice.to !== undefined && millis >= slice.to.epochMilliseconds);
});
