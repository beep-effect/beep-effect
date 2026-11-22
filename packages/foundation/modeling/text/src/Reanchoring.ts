/**
 * Re-anchoring: carrying one occurrence from a text capture to a later one
 * through a recorded locator map.
 *
 * **Details**
 *
 * A re-anchoring is `Exact` when both boundaries of the range land on a
 * segment edge or inside a kept segment, `Widened` when a boundary fell inside
 * a rewritten segment or the image spans text the later capture inserted, and
 * `Unmapped` otherwise. A mapped result carries the target receipt, verified
 * against the target text and projected; its id is minted from it, never
 * stored beside it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TextId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { coveringSegments, fromSide } from "./internal/segments.ts";
import { AlignedSegment } from "./LocatorMap.ts";
import { Anchored, mintOccurrenceId, OccurrenceId } from "./Occurrence.ts";
import { SourceTextIdentity } from "./SourceTextIdentity.ts";
import { TextAnchor } from "./TextAnchor.ts";
import {
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifyTextAnchorAgainstVerifiedSource,
} from "./VerifiedTextAnchor.ts";
import type * as Digest from "effect/crypto/Digest";
import type { LocatorMap } from "./LocatorMap.ts";
import type { PreimageMintError } from "./Occurrence.ts";
import type { VerifiedSourceText } from "./VerifiedTextAnchor.ts";

const $I = $TextId.create("Reanchoring");

/**
 * Why an occurrence did not map: the captures are not the map's, part of the
 * range is outside every segment, the target range is not a scalar range of
 * the target text, or a kept part of the target differs from the quote.
 *
 * **Example** (Check a reason)
 *
 * ```ts import.meta.vitest name="Check an unmapped reason"
 * import { UnmappedReason } from "@beep/text/Reanchoring"
 *
 * UnmappedReason.is["outside-map"]("outside-map") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UnmappedReason = LiteralKit(["capture-mismatch", "outside-map", "split-boundary", "quote-mismatch"]).pipe(
  $I.annoteSchema("UnmappedReason", {
    description: "Why an occurrence did not map to the later capture.",
  })
);

/**
 * Type for {@link UnmappedReason}.
 *
 * **Example** (Annotate a reason)
 *
 * ```ts
 * import type { UnmappedReason } from "@beep/text/Reanchoring"
 *
 * const reason: UnmappedReason = "capture-mismatch"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UnmappedReason = typeof UnmappedReason.Type;

/**
 * The outcome of re-anchoring one occurrence: `Exact` or `Widened` with the
 * target receipt, or `Unmapped` with its reason. Each names the source
 * occurrence by id.
 *
 * **Example** (Match on an outcome)
 *
 * ```ts import.meta.vitest name="Match on a re-anchoring"
 * import { OccurrenceId } from "@beep/text/Occurrence"
 * import { Reanchoring } from "@beep/text/Reanchoring"
 *
 * const unmapped = Reanchoring.cases.Unmapped.make({
 *   from: OccurrenceId.make("sha256:654d949fc9259fd7b3b3d90ef96c270b444cfece9feb03f15dfe29013001a06d"),
 *   reason: "outside-map",
 * })
 * Reanchoring.match(unmapped, {
 *   Exact: () => "exact",
 *   Widened: () => "widened",
 *   Unmapped: ({ reason }) => reason,
 * }) // => "outside-map"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Reanchoring = S.TaggedUnion({
  Exact: { from: OccurrenceId, to: Anchored },
  Widened: { from: OccurrenceId, to: Anchored },
  Unmapped: { from: OccurrenceId, reason: UnmappedReason },
}).pipe(
  $I.annoteSchema("Reanchoring", {
    description: "An occurrence carried to a later capture exactly, widened to segment edges, or not mapped.",
  })
);

/**
 * Type for {@link Reanchoring}.
 *
 * **Example** (Annotate an outcome)
 *
 * ```ts
 * import type { Reanchoring } from "@beep/text/Reanchoring"
 *
 * const isMapped = (outcome: Reanchoring): boolean => outcome._tag !== "Unmapped"
 * console.log(typeof isMapped)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Reanchoring = typeof Reanchoring.Type;

const sourceTextIdentityEquivalence = S.toEquivalence(SourceTextIdentity);

// The image of a range in the target text, and whether it grew past the range's own boundaries.
type Image = { readonly start: number; readonly end: number; readonly widened: boolean };

const textOf = (text: string, start: number, end: number): string => Str.slice(start, end)(text);

// Walks the segments a range overlaps. A boundary inside a kept segment maps pointwise; one strictly inside a
// rewritten segment moves to the segment edge and widens; target text between two covering segments was inserted
// and widens. A kept part whose target text is not the same part of the quote means the map does not describe it.
const imageOf = (
  segments: ReadonlyArray<AlignedSegment>,
  range: { readonly start: number; readonly end: number; readonly quote: string },
  targetText: string
): Result.Result<Image, UnmappedReason> =>
  O.match(coveringSegments(segments, fromSide, range.start, range.end), {
    onNone: () => Result.fail("outside-map" as const),
    onSome: ([first, last]) => {
      const covering = A.take(A.drop(segments, first), last - first + 1);
      const head = A.getUnsafe(segments, first);
      const tail = A.getUnsafe(segments, last);
      const start = AlignedSegment.match(head, {
        Kept: ({ from, to }) => to.start + (range.start - from.start),
        Rewritten: ({ to }) => to.start,
      });
      const end = AlignedSegment.match(tail, {
        Kept: ({ from, to }) => to.start + (range.end - from.start),
        Rewritten: ({ to }) => to.end,
      });
      const cutsRewritten =
        (AlignedSegment.guards.Rewritten(head) && head.from.start < range.start) ||
        (AlignedSegment.guards.Rewritten(tail) && range.end < tail.from.end);
      const spansInsertion = A.some(
        A.zip(covering, A.drop(covering, 1)),
        ([before, after]) => before.to.end < after.to.start
      );
      const keptMatches = A.every(A.filter(covering, AlignedSegment.guards.Kept), ({ from, to }) => {
        const low = N.max(range.start, from.start);
        const high = N.min(range.end, from.end);
        return (
          textOf(targetText, to.start + (low - from.start), to.start + (high - from.start)) ===
          textOf(range.quote, low - range.start, high - range.start)
        );
      });
      return keptMatches
        ? Result.succeed({ start, end, widened: cutsRewritten || spansInsertion })
        : Result.fail("quote-mismatch" as const);
    },
  });

/**
 * Carry an occurrence to a later capture through a recorded locator map.
 *
 * **Details**
 *
 * 1. `from` is the occurrence id of `anchored`.
 * 2. `anchored`'s capture must be `map.from` and `target`'s must be `map.to`,
 *    else `Unmapped{capture-mismatch}`.
 * 3. A part of the range no segment covers is `Unmapped{outside-map}`.
 * 4. A boundary inside a `Kept` segment maps pointwise; one strictly inside a
 *    `Rewritten` segment moves to the segment edge and the result is
 *    `Widened`, as it is when the image spans text the target inserted.
 * 5. A `Kept` part whose target text differs from the same part of the quote
 *    is `Unmapped{quote-mismatch}`.
 * 6. The target anchor is verified against `target`; a refusal, or a range the
 *    target text cannot hold, is `Unmapped{split-boundary}`. The proof is
 *    projected to its receipt.
 *
 * Requires core's `Digest.Digest` to mint `from`; minting fails only for a
 * quote with a lone surrogate.
 *
 * **Example** (Re-anchor through a normalization)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import type { LocatorMap } from "@beep/text/LocatorMap"
 * import type { Anchored } from "@beep/text/Occurrence"
 * import { reanchor } from "@beep/text/Reanchoring"
 * import type { VerifiedSourceText } from "@beep/text/VerifiedTextAnchor"
 *
 * const tagOf = (anchored: Anchored, map: LocatorMap, target: VerifiedSourceText) =>
 *   reanchor(anchored, map, target).pipe(Effect.map((outcome) => outcome._tag))
 * console.log(typeof tagOf)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const reanchor: {
  (
    map: LocatorMap,
    target: VerifiedSourceText
  ): (anchored: Anchored) => Effect.Effect<Reanchoring, PreimageMintError, Digest.Digest>;
  (
    anchored: Anchored,
    map: LocatorMap,
    target: VerifiedSourceText
  ): Effect.Effect<Reanchoring, PreimageMintError, Digest.Digest>;
} = dual(
  3,
  Effect.fn("Reanchoring.reanchor")(function* (
    anchored: Anchored,
    map: LocatorMap,
    target: VerifiedSourceText
  ): Effect.fn.Return<Reanchoring, PreimageMintError, Digest.Digest> {
    const from = yield* mintOccurrenceId(anchored);
    const unmapped = (reason: UnmappedReason): Reanchoring => Reanchoring.cases.Unmapped.make({ from, reason });
    if (
      !sourceTextIdentityEquivalence(Anchored.source(anchored), map.from) ||
      !sourceTextIdentityEquivalence(target.source, map.to)
    ) {
      return unmapped("capture-mismatch");
    }
    const targetText = target.sourceText;
    const range = Anchored.range(anchored);
    const image = imageOf(map.segments, { ...range, quote: Anchored.quote(anchored) }, targetText);
    if (Result.isFailure(image)) {
      return unmapped(image.failure);
    }
    const { start, end, widened } = image.success;
    if (end > Str.length(targetText)) {
      return unmapped("split-boundary");
    }
    const verified = yield* Effect.result(
      verifyTextAnchorAgainstVerifiedSource(
        VerifyTextAnchorAgainstVerifiedSourceInput.make({
          anchor: TextAnchor.make({ startChar: start, endChar: end, quote: textOf(targetText, start, end) }),
          verifiedSource: target,
        })
      )
    );
    if (Result.isFailure(verified)) {
      return unmapped("split-boundary");
    }
    const to = Anchored.make({ receipt: toTextAnchorVerificationReceipt(verified.success) });
    return widened ? Reanchoring.cases.Widened.make({ from, to }) : Reanchoring.cases.Exact.make({ from, to });
  })
);
