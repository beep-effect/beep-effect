/**
 * Claim projection read-model value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeClaimProjectionView, makeClaimStateCounts } from "@beep/epistemics/ClaimProjection";
import { $PartyDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { ClaimVersionId } from "../../Ids.ts";

const $I = $PartyDomainId.create("values/ClaimProjection/ClaimProjectionView.model");
const counts = makeClaimStateCounts({ $I });

/**
 * Count of claims in each lifecycle state. One key per {@link ClaimLifecycle}
 * state so the projection is total and deterministic.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ClaimStateCounts } from "@beep/party-domain/ClaimProjection"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ClaimStateCounts)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ClaimStateCounts extends S.Opaque<ClaimStateCounts, { readonly brand: unique symbol }>()(
  counts.ClaimStateCountsSchema
) {}

const view = makeClaimProjectionView({ $I, ClaimStateCounts, claimRef: ClaimVersionId });

/**
 * Deterministic in-memory read model folded from a single-owner authority array
 * of candidate claims. It is a rebuildable projection: the same authority always
 * yields a structurally-equal view, and it carries no write capability. The
 * `admittedKeys` are sorted for stable, referentially-equal rebuilds.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ClaimProjectionView } from "@beep/party-domain/ClaimProjection"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ClaimProjectionView)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ClaimProjectionView extends S.Opaque<ClaimProjectionView, { readonly brand: unique symbol }>()(
  view.ClaimProjectionViewSchema
) {}
