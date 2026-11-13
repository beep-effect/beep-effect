import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Provenance } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimNotPending } from "@proto/party-contract/Claim/ClaimNotPending.rejection";
import { NotAnAgent, ProposalStale } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { Proposition } from "@proto/party-contract/Proposition";
import * as S from "effect/Schema";
import { ReasonerUnavailable } from "./Reasoner.external.ts";
import { RunRefused } from "./ReviewRuns.external.ts";

/**
 * The executor of one review run, keyed by the run: reserve budget, assess
 * through the Reasoner, settle, propose as the run, then report that it
 * waits for the decision. A second review of the same claim is a second run.
 * It carries the run's provenance, which every step re-admits, and follows
 * the run across continuations.
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
  { description: "A review run's executor: assess within budget, propose as the run, then wait for the decision." },
) {}
