import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { Actor } from "@proto/kernel/Actor";
import { NotAMember } from "@proto/kernel/NotAMember.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { Disposition } from "../Disposition.ts";
import { ClaimId } from "./Claim.id.ts";
import { ClaimNotPending } from "./ClaimNotPending.rejection.ts";

/**
 * Refused: only an agent proposes; a person decides directly.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotAnAgent extends Domain.Rejection(
  "NotAnAgent",
  {},
  { httpApiStatus: 403, description: "Only an agent may propose a disposition." },
) {}

/**
 * The fact: an agent proposed what to do with a pending claim, and why.
 *
 * @category events
 * @since 0.0.0
 */
export class DispositionProposed extends Domain.Event("DispositionProposed", {
  disposition: Disposition,
  rationale: S.String,
  by: Actor,
}) {}

/**
 * What the agent may ask for: a proposal a reviewer later decides on.
 *
 * @category commands
 * @since 0.0.0
 */
export class ProposeDisposition extends Domain.Command(
  "ProposeDisposition",
  {
    target: ClaimId,
    middleware: [Session],
    input: { disposition: Disposition, rationale: S.String },
    events: [DispositionProposed],
    rejects: [ClaimNotPending, NotAMember, NotAnAgent],
  },
  {
    description: "Propose accepting or rejecting a pending claim, with a rationale. Agents only.",
    audience: "agent",
  },
) {}
