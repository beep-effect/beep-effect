/**
 * Segment value-object schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { HashMap, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Segment } from "../Segment/index.ts";

const $I = $LawPracticeDomainId.create("values/SegmentMap/SegmentMap.model");

const entryByCleanPosition: Order.Order<readonly [number, number]> = Order.mapInput(
  Order.Number,
  ([cleanPos]) => cleanPos
);

/**
 * Compressed map between cleaned-text and original-text positions.
 *
 * **Example** (Identity map lookup)
 *
 * ```ts
 * import { SegmentMap } from "@beep/law-practice-domain"
 *
 * const segmentMap = SegmentMap.identity(10)
 * console.log(segmentMap.lookup(0))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SegmentMap extends S.Class<SegmentMap>($I`SegmentMap`)(
  {
    segments: S.Array(Segment),
  },
  $I.annote("SegmentMap", {
    description: "Compressed map between cleaned-text and original-text positions.",
  })
) {
  /**
   * Create an identity map (clean position === original position).
   *
   * **Example** (Create identity SegmentMap)
   *
   * ```ts
   * import { SegmentMap } from "@beep/law-practice-domain"
   *
   * const identityMap = SegmentMap.identity(10)
   * console.log(identityMap.lookup(0))
   * ```
   *
   * @category statics
   * @since 0.0.0
   */
  static readonly identity = (length: number): SegmentMap =>
    SegmentMap.make({
      segments: [
        Segment.make({
          cleanPos: NonNegativeInt.make(0),
          origPos: NonNegativeInt.make(0),
          len: PosInt.make(length + 1),
        }),
      ],
    });

  /**
   * Compress a per-position Map into a SegmentMap.
   * Adjacent entries with the same offset (origPos - cleanPos) are merged
   * into a single segment.
   *
   * **Example** (Compress HashMap to segments)
   *
   * ```ts
   * import { SegmentMap } from "@beep/law-practice-domain"
   * import * as HashMap from "effect/HashMap"
   *
   * const segmentMap = SegmentMap.fromMap(HashMap.make([0, 0], [1, 1]))
   * console.log(segmentMap.lookup(1))
   * ```
   *
   * @category statics
   * @since 0.0.0
   */
  static readonly fromMap = (map: HashMap.HashMap<number, number>): SegmentMap => {
    const entries = map.pipe(HashMap.entries, A.fromIterable, A.sort(entryByCleanPosition));

    return A.matchLeft(entries, {
      onEmpty: () =>
        SegmentMap.make({
          segments: [],
        }),
      onNonEmpty: ([firstCleanPosN, firstOrigPosN], rest) => {
        let segments = A.empty<Segment>();
        let segCleanStart = firstCleanPosN;
        let segOrigStart = firstOrigPosN;
        let segLen = 1;

        const appendCurrent = () => {
          segments = A.append(
            segments,
            Segment.make({
              cleanPos: NonNegativeInt.make(segCleanStart),
              origPos: NonNegativeInt.make(segOrigStart),
              len: PosInt.make(segLen),
            })
          );
        };

        for (const [cleanPosN, origPosN] of rest) {
          if (cleanPosN === segCleanStart + segLen && origPosN === segOrigStart + segLen) {
            segLen++;
          } else {
            appendCurrent();
            segCleanStart = cleanPosN;
            segOrigStart = origPosN;
            segLen = 1;
          }
        }
        appendCurrent();

        return SegmentMap.make({
          segments,
        });
      },
    });
  };

  /**
   * Look up the original position for a clean-text position.
   * Uses binary search on sorted segments.
   *
   * **Example** (Lookup original position)
   *
   * ```ts
   * import { SegmentMap } from "@beep/law-practice-domain"
   *
   * console.log(SegmentMap.identity(10).lookup(5))
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  readonly lookup = (cleanPos: number): number => {
    const segments = this.segments;
    if (A.isReadonlyArrayEmpty(segments)) return cleanPos;

    let lo = 0;
    let hi = segments.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const segmentOption = A.get(segments, mid);
      if (O.isNone(segmentOption)) return cleanPos;

      const segment = segmentOption.value;

      if (cleanPos < segment.cleanPos) {
        hi = mid - 1;
      } else if (cleanPos >= segment.cleanPos + segment.len) {
        lo = mid + 1;
      } else {
        return segment.origPos + (cleanPos - segment.cleanPos);
      }
    }

    return A.last(segments).pipe(
      O.match({
        onNone: () => cleanPos,
        onSome: (last) => last.origPos + (cleanPos - last.cleanPos),
      })
    );
  };
}
