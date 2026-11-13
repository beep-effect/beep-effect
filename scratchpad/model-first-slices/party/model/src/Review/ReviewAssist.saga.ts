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
import { Assessed, ReasonerUnavailable } from "./Reasoner.external.ts";
import { LiveRun, RunEnded, RunRefused } from "./ReviewRuns.external.ts";

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

/** What a report step records when it fails. */
const ReportError = S.Union([RunRefused, RunEnded]);

/**
 * The executor's activities and the schemas their results are stored with.
 * These results are a stored format (D35): a compatible change converts on
 * read; an incompatible one needs a new saga version, so a run in flight
 * finishes on the version it started.
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewAssistActivities = {
  reserve: { success: S.NullOr(LiveRun), error: ReportError },
  assess: { success: Assessed, error: ReasonerUnavailable },
  release: { success: LiveRun, error: ReportError },
  settle: { success: LiveRun, error: ReportError },
  step: { success: LiveRun, error: ReportError },
  propose: { success: S.NullOr(S.String), error: S.Union([ClaimNotPending, MissingGrant, NotAnAgent, ProposalStale]) },
  "record-refusal": { success: S.Void, error: ReportError },
  exhaust: { success: LiveRun, error: ReportError },
  await: { success: LiveRun, error: ReportError },
} as const;
