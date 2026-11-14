import { OrgId, RunId } from "@proto/kernel/Ids";
import * as S from "effect/Schema";

/**
 * What a decision applies to, carried by each decision event (`ClaimAccepted`,
 * `ClaimRetracted`, `ProposalApproved`) so the published `ClaimDecided` is
 * built from the event alone (D43): the claim's org, and every review run
 * asked for it, in order.
 *
 * **Details**
 *
 * Both keys are optional on the stored side. A decision stored before phase 9
 * lacks them and reads as `None` (D22: convert on read, stored bytes never
 * rewritten); every decision made since carries both.
 *
 * **Example** (A decision event's scope)
 * ```ts
 * import { DecisionScope } from "@proto/party-contract/Claim/DecisionScope";
 * import * as S from "effect/Schema";
 *
 * const Scoped = S.Struct(DecisionScope);
 * const legacy = S.decodeUnknownSync(S.toCodecJson(Scoped))({});
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DecisionScope = {
  org: S.OptionFromOptionalKey(OrgId),
  reviewRuns: RunId.pipe(S.Array, S.OptionFromOptionalKey),
};
