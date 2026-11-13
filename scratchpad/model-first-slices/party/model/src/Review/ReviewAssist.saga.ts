import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { Actor } from "@proto/kernel/Actor";
import { OrgId, PrincipalId } from "@proto/kernel/Ids";
import { NotAMember } from "@proto/kernel/NotAMember.rejection";
import * as S from "effect/Schema";
import * as DurableDeferred from "effect/workflow/DurableDeferred";
import { AdmissionGateUnmet } from "../Claim/AcceptClaim.command.ts";
import { ClaimId } from "../Claim/Claim.id.ts";
import { ClaimNotPending } from "../Claim/ClaimNotPending.rejection.ts";
import { NotAnAgent } from "../Claim/ProposeDisposition.command.ts";
import { Disposition } from "../Disposition.ts";
import { EvidenceSignal } from "../Evidence.ts";
import { Proposition } from "../Proposition.ts";
import { ReasonerUnavailable } from "./Reasoner.external.ts";

/**
 * A reviewer's decision on the agent's proposal, and who made it. The run
 * waits on it durably, for as long as that takes.
 *
 * @category signals
 * @since 0.0.0
 */
export const HumanDecision = DurableDeferred.make("human-decision", {
  success: S.Struct({ disposition: Disposition, by: Actor }),
});

/**
 * An agent run on one claim: assess it through the Reasoner, propose a
 * disposition as the agent, then wait for a person to decide.
 *
 * @category sagas
 * @since 0.0.0
 */
export class ReviewAssist extends Domain.Saga(
  "ReviewAssist",
  {
    key: ClaimId,
    input: {
      proposition: Proposition,
      signals: S.Array(EvidenceSignal),
      onBehalfOf: PrincipalId,
      org: OrgId,
    },
    rejects: [ReasonerUnavailable, ClaimNotPending, NotAMember, NotAnAgent, AdmissionGateUnmet],
  },
  { description: "An assistant run: assess a claim, propose a disposition, wait for a reviewer." },
) {}
