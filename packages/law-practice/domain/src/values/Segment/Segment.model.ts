/**
 * Segment value-object schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { NonNegativeInt, PosInt } from "@beep/schema";
import * as S from "effect/Schema";

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
 * import { Segment } from "@beep/law-practice-domain"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 *
 * const segment = Segment.make({
 *   cleanPos: NonNegativeInt.make(0),
 *   len: PosInt.make(1),
 *   origPos: NonNegativeInt.make(0),
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
    cleanPos: NonNegativeInt.annotateKey({
      description: "Start position in clean text",
    }),
    origPos: NonNegativeInt.annotateKey({
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
