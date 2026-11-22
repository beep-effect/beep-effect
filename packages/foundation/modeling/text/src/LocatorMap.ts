/**
 * Locator maps between two text captures: the aligned segments a recorded
 * normalization or re-extraction uses to say which part of one text became
 * which part of another.
 *
 * **Details**
 *
 * A `Kept` segment is text carried over unchanged, so each of its boundaries
 * maps pointwise. A `Rewritten` segment is text the step changed as a whole,
 * so only its edges map. Both positions of a segment are `utf16-code-unit`.
 * Maps compose when the first ends at the capture the second starts from.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TextId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { coveringSegments, fromSide, segmentStartingAt, toSide } from "./internal/segments.ts";
import { Position } from "./OffsetUnit.ts";
import { SourceTextIdentity } from "./SourceTextIdentity.ts";
import type { Side } from "./internal/segments.ts";

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

const sourceTextIdentityEquivalence = S.toEquivalence(SourceTextIdentity);

/**
 * Two captures that should be one: the earlier map ends at `left` and the
 * later one starts at `right`.
 *
 * **Example** (Read the captures)
 *
 * ```ts
 * import type { CaptureMismatch } from "@beep/text/LocatorMap"
 *
 * const scopes = (mismatch: CaptureMismatch) => [mismatch.left.scopeRef, mismatch.right.scopeRef]
 * console.log(typeof scopes)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CaptureMismatch extends S.TaggedError<CaptureMismatch, { readonly brand: unique symbol }>(
  $I`CaptureMismatch`
)(
  "CaptureMismatch",
  {
    left: SourceTextIdentity,
    right: SourceTextIdentity,
  },
  $I.annoteError<CaptureMismatch>("CaptureMismatch", {
    description: "Two locator maps that do not meet: the first ends at one capture and the second starts at another.",
  })
) {}

type SegmentList = ReadonlyArray<AlignedSegment>;

const isUtf16 = (position: Position): boolean => position.unit === "utf16-code-unit";

const isOrderedOn = (segments: SegmentList, side: Side): boolean =>
  A.every(A.zip(segments, A.drop(segments, 1)), ([before, after]) => side(before).end <= side(after).start);

const keepsWidth = (segment: AlignedSegment): boolean =>
  AlignedSegment.match(segment, {
    Kept: ({ from, to }) => from.end - from.start === to.end - to.start,
    Rewritten: () => true,
  });

/**
 * The invariant of a locator map: every position is `utf16-code-unit`, the
 * segments are ordered and disjoint by `from` and by `to`, and a `Kept`
 * segment has the same width on both sides.
 *
 * **Example** (Refuse overlapping segments)
 *
 * ```ts import.meta.vitest name="Refuse overlapping segments"
 * import { AlignedSegment, LocatorMapCheck } from "@beep/text/LocatorMap"
 * import { Position } from "@beep/text/OffsetUnit"
 * import * as S from "effect/Schema"
 *
 * const at = (start: number, end: number) => Position.make({ unit: "utf16-code-unit", start, end })
 * const segments = [
 *   AlignedSegment.cases.Kept.make({ from: at(0, 2), to: at(0, 2) }),
 *   AlignedSegment.cases.Kept.make({ from: at(1, 3), to: at(2, 4) }),
 * ]
 * S.is(S.Struct({ segments: S.Array(AlignedSegment) }).check(LocatorMapCheck))({ segments }) // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const LocatorMapCheck = S.makeFilter(
  ({ segments }: { readonly segments: SegmentList }) =>
    A.every(segments, (segment) => isUtf16(segment.from) && isUtf16(segment.to) && keepsWidth(segment)) &&
    isOrderedOn(segments, fromSide) &&
    isOrderedOn(segments, toSide),
  $I.annote("LocatorMapCheck", {
    title: "Locator Map",
    description:
      "Checks that every position is UTF-16, the segments are ordered and disjoint on both sides, and a kept segment keeps its width.",
    message: "Expected UTF-16 segments, ordered and disjoint on both sides, with kept segments of equal width.",
  })
);

const utf16 = (start: number, end: number): Position => Position.make({ unit: "utf16-code-unit", start, end });

// The image of a cut through one segment: a kept segment maps the offset pointwise, a rewritten one only by its
// edges. `edge` picks the edge a rewritten segment maps the cut to.
const imageOf = (segment: AlignedSegment, side: Side, other: Side, offset: number, edge: "start" | "end"): number =>
  AlignedSegment.match(segment, {
    Kept: () => other(segment).start + (offset - side(segment).start),
    Rewritten: () => other(segment)[edge],
  });

const isInsideRewritten = (segments: SegmentList, side: Side, offset: number): boolean =>
  O.exists(
    O.flatMap(segmentStartingAt(segments, side, offset), (index) => A.get(segments, index)),
    (segment) => AlignedSegment.guards.Rewritten(segment) && side(segment).start < offset
  );

const edgesOn = (segments: SegmentList, side: Side): ReadonlyArray<number> =>
  A.flatMap(segments, (segment) => [side(segment).start, side(segment).end]);

// Performance boundary (composition): one pass over the cuts of the middle capture, each covered by a walk over the
// segments it overlaps; the cuts are disjoint, so the walks visit each segment of either map a bounded number of
// times. The pieces are pushed into a local array that becomes the result's segment list.
const composeSegments = (first: SegmentList, second: SegmentList): SegmentList => {
  const cuts = A.dedupeAdjacent(
    A.sort(
      A.filter(
        A.appendAll(edgesOn(first, toSide), edgesOn(second, fromSide)),
        (offset) => !isInsideRewritten(first, toSide, offset) && !isInsideRewritten(second, fromSide, offset)
      ),
      N.Order
    )
  );
  const pieces: Array<AlignedSegment> = [];
  for (const [start, end] of A.zip(cuts, A.drop(cuts, 1))) {
    const covered = O.all([
      coveringSegments(first, toSide, start, end),
      coveringSegments(second, fromSide, start, end),
    ]);
    if (O.isNone(covered)) {
      continue;
    }
    const [[firstStart, firstEnd], [secondStart, secondEnd]] = covered.value;
    const before = A.getUnsafe(first, firstStart);
    const after = A.getUnsafe(second, secondStart);
    const from = utf16(
      imageOf(before, toSide, fromSide, start, "start"),
      imageOf(A.getUnsafe(first, firstEnd), toSide, fromSide, end, "end")
    );
    const to = utf16(
      imageOf(after, fromSide, toSide, start, "start"),
      imageOf(A.getUnsafe(second, secondEnd), fromSide, toSide, end, "end")
    );
    const kept =
      firstStart === firstEnd &&
      secondStart === secondEnd &&
      AlignedSegment.guards.Kept(before) &&
      AlignedSegment.guards.Kept(after);
    pieces.push(
      kept ? AlignedSegment.cases.Kept.make({ from, to }) : AlignedSegment.cases.Rewritten.make({ from, to })
    );
  }
  return pieces;
};

/**
 * A recorded map from one text capture to another: the aligned segments of
 * the earlier text and the parts of the later text they became.
 *
 * **Details**
 *
 * Text of either capture that no segment covers is a gap: a range in `from`
 * that touches one does not map, and target text between two segments is
 * text the later capture inserted. `LocatorMap.identity` maps a capture to
 * itself; `LocatorMap.compose` joins two maps that meet at one capture.
 *
 * **Example** (Map a capture to itself)
 *
 * ```ts
 * import type { SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 * import { LocatorMap } from "@beep/text/LocatorMap"
 *
 * const selfMap = (capture: SourceTextIdentity, text: string) => LocatorMap.identity(capture, text.length)
 * console.log(typeof selfMap)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LocatorMap extends S.Opaque<LocatorMap, { readonly brand: unique symbol }>()(
  S.Struct({
    from: SourceTextIdentity,
    to: SourceTextIdentity,
    segments: S.Array(AlignedSegment).annotateKey({
      description: "The aligned segments, ordered and disjoint on both sides; uncovered text is a gap.",
    }),
  })
    .check(LocatorMapCheck)
    .pipe(
      $I.annoteSchema("LocatorMap", {
        description: "A recorded map of aligned segments from one text capture to another.",
      })
    )
) {
  /**
   * The map of a capture to itself: one `Kept` segment over its whole text,
   * and no segment for an empty text.
   *
   * **Example** (Read the one segment)
   *
   * ```ts
   * import type { SourceTextIdentity } from "@beep/text/SourceTextIdentity"
   * import { LocatorMap } from "@beep/text/LocatorMap"
   *
   * const widthOf = (capture: SourceTextIdentity) => LocatorMap.identity(capture, 4).segments.length
   * console.log(typeof widthOf)
   * ```
   *
   * @param capture - The text capture.
   * @param length - The UTF-16 length of its text.
   * @returns The identity map of the capture.
   */
  static readonly identity = (capture: SourceTextIdentity, length: number): LocatorMap =>
    LocatorMap.make({
      from: capture,
      to: capture,
      segments: length > 0 ? [AlignedSegment.cases.Kept.make({ from: utf16(0, length), to: utf16(0, length) })] : [],
    });

  /**
   * The map that runs `first` then `second`, or `CaptureMismatch` when
   * `first.to` is not `second.from`.
   *
   * **Details**
   *
   * The middle capture is cut at every segment edge of either map that is not
   * strictly inside a `Rewritten` segment of the other. A piece both maps
   * cover without a gap becomes one segment, `Kept` only when one `Kept`
   * segment of each map covers it; a piece that touches a gap of either map
   * is dropped.
   *
   * **Example** (Compose two maps)
   *
   * ```ts
   * import { LocatorMap } from "@beep/text/LocatorMap"
   * import * as Result from "effect/Result"
   *
   * const both = (first: LocatorMap, second: LocatorMap) => Result.isSuccess(LocatorMap.compose(first, second))
   * console.log(typeof both)
   * ```
   *
   * @param first - The map from the earliest capture to the middle one.
   * @param second - The map from the middle capture to the latest one.
   * @returns The composite map, or the mismatch of the two middle captures.
   */
  static readonly compose = (first: LocatorMap, second: LocatorMap): Result.Result<LocatorMap, CaptureMismatch> =>
    sourceTextIdentityEquivalence(first.to, second.from)
      ? Result.succeed(
          LocatorMap.make({
            from: first.from,
            to: second.to,
            segments: composeSegments(first.segments, second.segments),
          })
        )
      : Result.fail(CaptureMismatch.make({ left: first.to, right: second.from }));
}
