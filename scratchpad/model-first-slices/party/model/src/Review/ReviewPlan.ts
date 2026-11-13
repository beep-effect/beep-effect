import { RunId } from "@proto/kernel/Ids";
import type { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ReviewVersions } from "./ReviewRuns.external.ts";

/**
 * How Party runs a review: the versions it records, the budget it asks for,
 * the most one Reasoner call may spend, and the run's history bound.
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewPlan = {
  versions: ReviewVersions.make({ prompt: "review-v1", model: "fixture-reasoner", tools: "party-review-v1" }),
  allowance: 100,
  maxPerCall: 40,
  historyBound: 20,
} as const;

/**
 * The run that carries the `n`th review of a claim.
 *
 * @category constructors
 * @since 0.0.0
 */
export const reviewRun = (claim: ClaimId, n: number): RunId => RunId.make(`review:${claim}:${n}`);
