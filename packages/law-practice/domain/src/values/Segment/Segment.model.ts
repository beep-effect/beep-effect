/**
 * Segment value-object schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";

const $I = $LawPracticeDomainId.create("values/Segment/Segment.model");

/**
 * Segment-based position mapping.
 *
 * **Details**
 *
 * Compresses a per-character position map into contiguous segments where the
 * offset between clean and original coordinates is constant. Lookups use
 * binary search (O(log k) where k = number of segments, typically 50-200).
 *
 * **Example** (Create position segment)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Segment } from "@beep/law-practice-domain"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const segment = Segment.make({
 *   cleanPos: S.Natural.make(0),
 *   len: PosInt.make(1),
 *   origPos: S.Natural.make(0),
 * })
 *
 * console.log(segment.len)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Segment extends S.Class<Segment>($I`Segment`)(
  {
    cleanPos: S.Natural.annotateKey({
      description: "Start position in clean text",
    }),
    origPos: S.Natural.annotateKey({
      description: "Corresponding start position in original text",
    }),
    len: PosInt.annotateKey({
      description: "Number of positions covered by this segment",
    }),
  },
  $I.annote("Segment", {
    description: "Compressed position mapping segment for cleaned and original text.",
  })
) {}
