import * as Domain from "@alchemy.run/domain";
import { OrgId, RunId } from "@proto/kernel/Ids";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { ApprovalId } from "../Claim/Approval.id.ts";
import { ClaimId } from "../Claim/Claim.id.ts";

/**
 * How a claim was decided, as Party publishes it.
 *
 * @category models
 * @since 0.0.0
 */
export const Decision = LiteralKit(["accepted", "retracted"]);
/**
 * @category models
 * @since 0.0.0
 */
export type Decision = typeof Decision.Type;

/**
 * Party's published fact, version 1: a claim was decided. Its shape is
 * public and versioned apart from the claim's private events: no
 * proposition, no evidence, no provenance and no grant terms. `factId` is
 * stable for the decision, so a consumer recognises a redelivery, and
 * `reviewRuns` names the review runs the claim opened.
 *
 * @category facts
 * @since 0.0.0
 */
export class ClaimDecidedV1 extends Domain.Event("ClaimDecidedV1", {
  factId: S.String,
  claim: ClaimId,
  org: OrgId,
  outcome: Decision,
  reviewRuns: S.Array(RunId),
}) {}

/**
 * Version 2 of the same fact: it says whether a person approved an agent's
 * proposal or decided the claim directly, and names the approval. Party
 * publishes both versions while version 1 has consumers.
 *
 * @category facts
 * @since 0.0.0
 */
export class ClaimDecidedV2 extends Domain.Event("ClaimDecidedV2", {
  factId: S.String,
  claim: ClaimId,
  org: OrgId,
  decision: Decision,
  basis: S.Literals(["approval", "direct"]),
  approval: S.OptionFromNullOr(ApprovalId),
  reviewRuns: S.Array(RunId),
}) {}

/**
 * The fact's contract: who produces it, its name, and the schema of each
 * published version. A consumer subscribes to one version and decodes with
 * its schema.
 *
 * **Example** (Decoding a delivered payload)
 * ```ts
 * import { ClaimDecided } from "@proto/party-contract/Facts/ClaimDecided.fact";
 * import * as S from "effect/Schema";
 *
 * const decode = S.decodeUnknownEffect(ClaimDecided.versions[1]);
 * ```
 *
 * @category facts
 * @since 0.0.0
 */
export const ClaimDecided = {
  producer: "party",
  contract: "ClaimDecided",
  versions: { 1: ClaimDecidedV1, 2: ClaimDecidedV2 },
} as const;

/**
 * The single key of Party's fact feed: one ordered log for every claim.
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimFeed = S.Literal("claims");
/**
 * @category models
 * @since 0.0.0
 */
export type ClaimFeed = typeof ClaimFeed.Type;
