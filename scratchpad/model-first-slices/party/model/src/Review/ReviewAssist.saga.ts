import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Provenance } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { ApprovalId } from "@proto/party-contract/Claim/Approval.id";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimNotPending } from "@proto/party-contract/Claim/ClaimNotPending.rejection";
import { NotAnAgent, ProposalStale } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { Proposition } from "@proto/party-contract/Proposition";
import * as S from "effect/Schema";
import * as DurableDeferred from "effect/workflow/DurableDeferred";
import { ReasonerUnavailable } from "./Reasoner.external.ts";
import { RunRefused } from "./ReviewRuns.external.ts";

/**
 * The durable wait for a person's approval. It carries the approval's id
 * and nothing else; the approval is the committed fact on the claim.
 *
 * @category signals
 * @since 0.0.0
 */
export const ApprovalGiven = DurableDeferred.make("approval", {
  success: S.Struct({ approval: ApprovalId }),
});

/**
 * The executor of one review run, keyed by the run: reserve budget, assess
 * through the Reasoner, settle, propose as the run, then wait for a person
 * to approve. A second review of the same claim is a second run. It carries
 * the run's provenance, which every step re-admits.
 *
 * @category sagas
 * @since 0.0.0
 */
export class ReviewAssist extends Domain.Saga(
  "ReviewAssist",
  {
    key: RunId,
    input: {
      claim: ClaimId,
      proposition: Proposition,
      signals: S.Array(EvidenceSignal),
      evidenceRevision: S.Int,
      provenance: Provenance,
    },
    rejects: [ReasonerUnavailable, RunRefused, ClaimNotPending, MissingGrant, NotAnAgent, ProposalStale],
  },
  { description: "A review run's executor: assess within budget, propose as the run, wait for an approval." },
) {}
