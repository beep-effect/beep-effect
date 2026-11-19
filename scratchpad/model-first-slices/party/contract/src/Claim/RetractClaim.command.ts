import * as Domain from "@alchemy.run/domain";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import { Text } from "@proto/kernel/Measure";
import { ClaimId } from "./Claim.id.ts";
import { ClaimNotPending } from "./ClaimNotPending.rejection.ts";
import { DecisionScope } from "./DecisionScope.ts";

/**
 * The fact: a pending claim was withdrawn, and why. Phase 9 added its scope,
 * the org and review runs (D43).
 *
 * @category events
 * @since 0.0.0
 */
export class ClaimRetracted extends Domain.Event("ClaimRetracted", carry({ reason: Text, ...DecisionScope }), { description: "A pending claim was withdrawn, and why, with the org and review runs the decision covers." }) {}

/**
 * Withdraw a pending claim.
 *
 * @category commands
 * @since 0.0.0
 */
export class RetractClaim extends Domain.Command(
  "RetractClaim",
  {
    target: ClaimId,
    middleware: [Session],
    input: { reason: Text },
    events: [ClaimRetracted],
    rejects: [ClaimNotPending, MissingGrant],
  },
  { description: "Withdraw a pending claim, giving the reason." },
) {}
