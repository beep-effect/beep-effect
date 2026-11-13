import type { RunId } from "@proto/kernel/Ids";
import * as Hash from "effect/Hash";
import type { Disposition } from "../Disposition.ts";

/**
 * The digest that names one proposal: what was proposed, why, by which run,
 * against which evidence revision. An approval names it, so a reviewer
 * approves exactly what they read.
 *
 * **Example** (The digest a reviewer approves)
 * ```ts
 * import { proposalDigest } from "@proto/party-contract/Claim/ProposalDigest";
 * import { RunId } from "@proto/kernel/Ids";
 *
 * const digest = proposalDigest({ disposition: "accept", rationale: "two sources", run: RunId.make("run_1"), evidenceRevision: 1 });
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const proposalDigest = (proposal: {
  readonly disposition: Disposition;
  readonly rationale: string;
  readonly run: RunId;
  readonly evidenceRevision: number;
}): string =>
  `p${(Hash.string(`${proposal.disposition}\u0000${proposal.rationale}\u0000${proposal.run}\u0000${proposal.evidenceRevision}`) >>> 0).toString(16)}`;
