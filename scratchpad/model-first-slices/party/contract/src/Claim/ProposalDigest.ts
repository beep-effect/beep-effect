import type { RunId } from "@proto/kernel/Ids";
import * as Hash from "effect/Hash";
import * as S from "effect/Schema";
import type { Disposition } from "../Disposition.ts";

/**
 * The text of a proposal's digest: `p` and the proposal's 32-bit hash in
 * lower-case hexadecimal, one to eight digits, as {@link proposalDigest}
 * writes it.
 *
 * **Example** (A digest a reviewer approves)
 * ```ts
 * import { ProposalDigest } from "@proto/party-contract/Claim/ProposalDigest";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(ProposalDigest)("pdf3524c");
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProposalDigest = S.String.check(
  S.isPattern(/^p[0-9a-f]{1,8}$/, {
    identifier: "ProposalDigestCheck",
    title: "Proposal digest",
    description: "A proposal's digest: `p`, then one to eight lower-case hexadecimal digits.",
    message: "Expected a proposal digest: `p` and one to eight lower-case hexadecimal digits",
  }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type ProposalDigest = typeof ProposalDigest.Type;

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
}): ProposalDigest =>
  `p${(Hash.string(`${proposal.disposition}\u0000${proposal.rationale}\u0000${proposal.run}\u0000${proposal.evidenceRevision}`) >>> 0).toString(16)}`;
