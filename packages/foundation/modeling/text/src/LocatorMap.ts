/**
 * Aligned segments between two text captures: the vocabulary a recorded
 * normalization or re-extraction uses to say which part of one text became
 * which part of another.
 *
 * **Details**
 *
 * A `Kept` segment is text carried over unchanged, so each of its boundaries
 * maps pointwise. A `Rewritten` segment is text the step changed as a whole,
 * so only its edges map. Both positions of a segment are `utf16-code-unit`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TextId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { Position } from "./OffsetUnit.ts";

const $I = $TextId.create("LocatorMap");

/**
 * One aligned segment: the range `from` in the earlier text and the range
 * `to` it became in the later one.
 *
 * **Example** (Match on a segment)
 *
 * ```ts import.meta.vitest name="Match on a segment"
 * import { AlignedSegment } from "@beep/text/LocatorMap"
 * import { Position } from "@beep/text/OffsetUnit"
 *
 * const segment = AlignedSegment.cases.Rewritten.make({
 *   from: Position.make({ unit: "utf16-code-unit", start: 0, end: 1 }),
 *   to: Position.make({ unit: "utf16-code-unit", start: 0, end: 2 }),
 * })
 * AlignedSegment.match(segment, {
 *   Kept: () => "kept",
 *   Rewritten: (rewritten) => `${rewritten.to.end - rewritten.to.start} units`,
 * }) // => "2 units"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AlignedSegment = S.TaggedUnion({
  Kept: { from: Position, to: Position },
  Rewritten: { from: Position, to: Position },
}).pipe(
  $I.annoteSchema("AlignedSegment", {
    description: "A range of one text and the range of another it became: kept unchanged or rewritten as a whole.",
  })
);

/**
 * Type for {@link AlignedSegment}.
 *
 * **Example** (Annotate a segment)
 *
 * ```ts
 * import type { AlignedSegment } from "@beep/text/LocatorMap"
 * import { Position } from "@beep/text/OffsetUnit"
 *
 * const range = Position.make({ unit: "utf16-code-unit", start: 0, end: 4 })
 * const segment: AlignedSegment = { _tag: "Kept", from: range, to: range }
 * console.log(segment._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AlignedSegment = typeof AlignedSegment.Type;
