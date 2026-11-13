import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { ClaimAccepted } from "../Claim/AcceptClaim.command.ts";
import { Claim } from "../Claim/Claim.aggregate.ts";

/**
 * When a `SameParty` claim is accepted, the absorbed party merges into the survivor.
 *
 * @category policies
 * @since 0.0.0
 */
export class MergeOnSameParty extends Domain.Policy(
  "MergeOnSameParty",
  { from: Claim, on: [ClaimAccepted] },
  { description: "Merge the parties an accepted SameParty claim names." },
) {}
