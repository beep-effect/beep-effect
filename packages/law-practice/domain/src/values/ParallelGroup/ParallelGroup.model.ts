/**
 * Parallel-citation group value object: the same case reported across multiple
 * reporters, ported from the eyecite `ParallelGroup` interface (#850).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import * as S from "effect/Schema";
import { CitationId } from "../CitationId/index.js";

const $I = $LawPracticeDomainId.create("values/ParallelGroup/ParallelGroup.model");

/**
 * A parallel-citation group (#850): the same case reported in multiple
 * reporters.
 *
 * Every member references all members of the group — including itself — by
 * stable {@link CitationId}, in document order. Because each member carries the
 * full roster, a consumer holding any one citation can recover the entire
 * parallel set without re-scanning the source text.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { CitationId, ParallelGroup } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const group = ParallelGroup.make({
 *   memberIds: [
 *     S.decodeUnknownSync(CitationId)("c0"),
 *     S.decodeUnknownSync(CitationId)("c1"),
 *   ],
 * })
 *
 * console.log(group.memberIds.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParallelGroup extends S.Class<ParallelGroup>($I`ParallelGroup`)(
  {
    memberIds: S.Array(CitationId).annotateKey({
      description:
        "Stable CitationId of every member of this parallel-citation group, including this citation itself, in document order (#850).",
    }),
  },
  $I.annote("ParallelGroup", {
    description: "A parallel-citation group: the same case reported in multiple reporters (#850).",
  })
) {}

/**
 * Companion namespace for `ParallelGroup`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ParallelGroup {
  /**
   * Wire-encoded representation of a decoded {@link ParallelGroup}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { ParallelGroup } from "@beep/law-practice-domain"
   *
   * type Wire = ParallelGroup.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ParallelGroup.Encoded;
}
