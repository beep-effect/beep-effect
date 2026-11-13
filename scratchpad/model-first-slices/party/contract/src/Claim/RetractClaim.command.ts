import * as Domain from "@alchemy.run/domain";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { ClaimId } from "./Claim.id.ts";
import { ClaimNotPending } from "./ClaimNotPending.rejection.ts";

/**
 * The fact: a pending claim was withdrawn, and why.
 *
 * @category events
 * @since 0.0.0
 */
export class ClaimRetracted extends Domain.Event("ClaimRetracted", carry({ reason: S.String })) {}

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
    input: { reason: S.String },
    events: [ClaimRetracted],
    rejects: [ClaimNotPending, MissingGrant],
  },
  { description: "Withdraw a pending claim, giving the reason." },
) {}
