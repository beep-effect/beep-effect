import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { ClaimAsserted } from "../Claim/AssertClaim.command.ts";
import { Claim } from "../Claim/Claim.aggregate.ts";

/**
 * Every asserted claim gets an assistant run.
 *
 * @category policies
 * @since 0.0.0
 */
export class ReviewOnAssertion extends Domain.Policy(
  "ReviewOnAssertion",
  { from: Claim, on: [ClaimAsserted] },
  { description: "Start a ReviewAssist run for every asserted claim." },
) {}
