import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { Actor } from "@proto/kernel/Actor";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { EvidenceSignal } from "../Evidence.ts";
import { Proposition } from "../Proposition.ts";
import { ClaimId } from "./Claim.id.ts";

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
 * The fact: a proposition was put forward with its evidence, by an actor
 * whose org the claim now belongs to.
 *
 * @category events
 * @since 0.0.0
 */
export class ClaimAsserted extends Domain.Event("ClaimAsserted", {
  proposition: Proposition,
  signals: S.Array(EvidenceSignal),
  by: Actor,
}) {}

/**
 * Put a proposition forward for review, with the evidence for it.
 *
 * @category commands
 * @since 0.0.0
 */
export class AssertClaim extends Domain.Command(
  "AssertClaim",
  {
    target: ClaimId,
    middleware: [Session],
    input: { proposition: Proposition, signals: S.Array(EvidenceSignal) },
    events: [ClaimAsserted],
    rejects: [ClaimAlreadyAsserted],
  },
  {
    description: "Assert a proposition about parties, with its evidence, for review.",
    audience: "intake",
  },
) {}
