import * as Domain from "@alchemy.run/domain";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import { ClaimId } from "./Claim.id.ts";
import { ClaimNotPending } from "./ClaimNotPending.rejection.ts";
import { ReviewRequested } from "./ReviewRequested.event.ts";

/**
 * Ask for another review of a pending claim: a new run, with its own grant and budget.
 *
 * @category commands
 * @since 0.0.0
 */
export class RequestReview extends Domain.Command(
  "RequestReview",
  {
    target: ClaimId,
    middleware: [Session],
    events: [ReviewRequested],
    rejects: [ClaimNotPending, MissingGrant],
  },
  { description: "Ask for another review of a pending claim, as a new run." },
) {}
