import { Capability } from "@proto/kernel/Capability";
import { CapabilityId } from "@proto/kernel/Ids";
import { AcceptClaim } from "./Claim/AcceptClaim.command.ts";
import { AddEvidence } from "./Claim/AddEvidence.command.ts";
import { ApproveProposal } from "./Claim/ApproveProposal.command.ts";
import { AssertClaim } from "./Claim/AssertClaim.command.ts";
import { ClaimReviewRead } from "./Claim/ClaimReview.read.ts";
import { ProposeDisposition } from "./Claim/ProposeDisposition.command.ts";
import { RequestReview } from "./Claim/RequestReview.command.ts";
import { RetractClaim } from "./Claim/RetractClaim.command.ts";
import { FindPartiesRead } from "./Directory/FindParties.read.ts";
import { EffectivePartyRead } from "./Party/EffectiveParty.read.ts";
import { MergeParties } from "./Party/MergeParties.command.ts";
import { RegisterParty } from "./Party/RegisterParty.command.ts";

/**
 * Put parties and claims into an org: register parties, assert claims.
 *
 * **Example** (Read the capability id the authority context grants by)
 * ```ts
 * import { PartyIntake } from "@proto/party-contract/Party.capabilities";
 *
 * const id = PartyIntake.id;
 * ```
 *
 * @category capabilities
 * @since 0.0.0
 */
export const PartyIntake = Capability.make({
  id: CapabilityId.make("party.intake"),
  operations: [RegisterParty.tag, AssertClaim.tag, AddEvidence.tag],
  description: "Register parties, assert claims about them and add evidence, in an organization.",
});

/**
 * Read claims, parties and the directory of an org.
 *
 * @category capabilities
 * @since 0.0.0
 */
export const PartyRead = Capability.make({
  id: CapabilityId.make("party.read"),
  operations: [ClaimReviewRead.viewName, EffectivePartyRead.viewName, FindPartiesRead.queryName],
  description: "Read claims, parties and the party directory of an organization.",
});

/**
 * Decide pending claims and merge parties.
 *
 * @category capabilities
 * @since 0.0.0
 */
export const PartyReview = Capability.make({
  id: CapabilityId.make("party.review"),
  operations: [AcceptClaim.tag, RetractClaim.tag, MergeParties.tag, ApproveProposal.tag, RequestReview.tag],
  description: "Accept, retract or approve a proposal on pending claims, ask for reviews, and merge parties.",
});

/**
 * Have an agent run propose dispositions on pending claims.
 *
 * @category capabilities
 * @since 0.0.0
 */
export const PartyPropose = Capability.make({
  id: CapabilityId.make("party.propose"),
  operations: [ProposeDisposition.tag],
  description: "Let an agent run propose a disposition on a pending claim.",
});

/**
 * Every capability Party declares, for tooling that lists them.
 *
 * @category capabilities
 * @since 0.0.0
 */
export const PartyCapabilities = [PartyIntake, PartyRead, PartyReview, PartyPropose] as const;
