import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { Actor } from "@proto/kernel/Actor";
import { NotAMember } from "@proto/kernel/NotAMember.rejection";
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
export class ClaimRetracted extends Domain.Event("ClaimRetracted", {
  reason: S.String,
  by: Actor,
}) {}

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
    rejects: [ClaimNotPending, NotAMember],
  },
  { description: "Withdraw a pending claim, giving the reason.", audience: "reviewer" },
) {}
