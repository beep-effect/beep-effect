/**
 * Claim projection read-model value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { EpistemicFixtureKey } from "../EpistemicFixtureKey/index.ts";

const $I = $EpistemicDomainId.create("values/ClaimProjection/ClaimProjectionView.model");

/**
 * Count of claims in each lifecycle state. One key per {@link ClaimLifecycle}
 * state so the projection is total and deterministic.
 *
 * @example
 * ```ts
 * import { ClaimStateCounts } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const counts = S.decodeUnknownSync(ClaimStateCounts)({
 *   candidate: 2,
 *   shape_valid: 1,
 *   consistency_checked: 0,
 *   admitted: 3,
 * })
 * console.log(counts.admitted)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ClaimStateCounts extends S.Class<ClaimStateCounts>($I`ClaimStateCounts`)(
  {
    candidate: NonNegativeInt.annotateKey({ description: "Number of candidate claims." }),
    shape_valid: NonNegativeInt.annotateKey({ description: "Number of shape-valid claims." }),
    consistency_checked: NonNegativeInt.annotateKey({ description: "Number of consistency-checked claims." }),
    admitted: NonNegativeInt.annotateKey({ description: "Number of admitted claims." }),
  },
  $I.annote("ClaimStateCounts", {
    description: "Count of claims in each lifecycle state.",
  })
) {}

/**
 * Deterministic in-memory read model folded from a single-owner authority array
 * of candidate claims. It is a rebuildable projection: the same authority always
 * yields a structurally-equal view, and it carries no write capability. The
 * `admittedKeys` are sorted for stable, referentially-equal rebuilds.
 *
 * @example
 * ```ts
 * import { ClaimProjectionView } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const view = S.decodeUnknownSync(ClaimProjectionView)({
 *   total: 4,
 *   counts: { candidate: 2, shape_valid: 1, consistency_checked: 0, admitted: 1 },
 *   admittedKeys: ["claim.patentability"],
 * })
 * console.log(view.total)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ClaimProjectionView extends S.Class<ClaimProjectionView>($I`ClaimProjectionView`)(
  {
    total: NonNegativeInt.annotateKey({ description: "Total claim count represented by the projection." }),
    counts: ClaimStateCounts.annotateKey({ description: "Claim counts by lifecycle state." }),
    admittedKeys: S.Array(EpistemicFixtureKey).annotateKey({
      description: "Stable fixture keys for admitted claims, sorted deterministically.",
    }),
  },
  $I.annote("ClaimProjectionView", {
    description: "Deterministic in-memory read model folded from a single-owner authority array.",
  })
) {}
