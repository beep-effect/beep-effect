import * as Domain from "@alchemy.run/domain";
import { OrgId, RunId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { EvidenceSignal } from "../Evidence.ts";
import { Proposition } from "../Proposition.ts";
import { ClaimId } from "./Claim.id.ts";
import { ReviewRequested } from "./ReviewRequested.event.ts";

/**
 * Refused: a claim id is asserted once.
 *
 * @category rejections
 * @since 0.0.0
 */
export class ClaimAlreadyAsserted extends Domain.Rejection(
  "ClaimAlreadyAsserted",
  {},
  { httpApiStatus: 409, description: "This claim id was already asserted." },
) {}

/**
 * The fact: a proposition was put forward in an org, with its evidence,
 * under the invocation that asserted it.
 *
 * @category events
 * @since 0.0.0
 */
export class ClaimAsserted extends Domain.Event(
  "ClaimAsserted",
  carry({ org: OrgId, proposition: Proposition, signals: S.Array(EvidenceSignal) }),
) {}

/**
 * Put a proposition forward for review in an org, with the evidence for it.
 * The first review run is requested with it.
 *
 * @category commands
 * @since 0.0.0
 */
export class AssertClaim extends Domain.Command(
  "AssertClaim",
  {
    target: ClaimId,
    middleware: [Session],
    input: { org: OrgId, proposition: Proposition, signals: S.Array(EvidenceSignal) },
    events: [ClaimAsserted, ReviewRequested],
    rejects: [ClaimAlreadyAsserted, MissingGrant],
    reply: { reviewRun: S.NullOr(RunId) },
  },
  { description: "Assert a proposition about parties in an organization, with its evidence, for review." },
) {}
