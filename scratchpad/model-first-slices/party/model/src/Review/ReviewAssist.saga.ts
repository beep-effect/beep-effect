import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Provenance } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimNotPending } from "@proto/party-contract/Claim/ClaimNotPending.rejection";
import { NotAnAgent, ProposalStale } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { Proposition } from "@proto/party-contract/Proposition";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { Assessed, ReasonerUnavailable } from "./Reasoner.external.ts";
import { LiveRun, RunEnded, RunRefused } from "./ReviewRuns.external.ts";
import { thunkNull } from "@beep/utils"

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
 * What the reservation came to: the live run, now holding the units, or a
 * run without the budget for them, which ends without a Reasoner call.
 *
 * @category models
 * @since 0.0.0
 */
export const Reservation = S.TaggedUnion({ Reserved: { live: LiveRun }, OutOfBudget: {} });
/**
 * @category models
 * @since 0.0.0
 */
export type Reservation = typeof Reservation.Type;

/** Stored as phases 2 to 6 stored it (D35): the live run, or `null` when out of budget. */
const StoredReservation = S.NullOr(LiveRun).pipe(
  S.decodeTo(
    S.toType(Reservation),
    SchemaTransformation.transform({
      decode: (stored) =>
        O.match(O.fromNullOr(stored), {
          onNone: () => Reservation.cases.OutOfBudget.make({}),
          onSome: (live) => Reservation.cases.Reserved.make({ live }),
        }),
      encode: Reservation.match({ OutOfBudget: thunkNull, Reserved: ({ live }) => live }),
    }),
  ),
);

/**
 * How sending the proposal went: made, or refused at re-admission with the
 * refusal recorded. A claim already decided is the activity's error.
 *
 * @category models
 * @since 0.0.0
 */
export const ProposalSent = S.TaggedUnion({ Made: {}, Refused: { refusal: S.String } });
/**
 * @category models
 * @since 0.0.0
 */
export type ProposalSent = typeof ProposalSent.Type;

/** Stored as phases 2 to 6 stored it (D35): `null` when made, the refusal's text when refused. */
const StoredProposalSent = S.NullOr(S.String).pipe(
  S.decodeTo(
    S.toType(ProposalSent),
    SchemaTransformation.transform({
      decode: (stored) =>
        O.match(O.fromNullOr(stored), {
          onNone: () => ProposalSent.cases.Made.make({}),
          onSome: (refusal) => ProposalSent.cases.Refused.make({ refusal }),
        }),
      encode: ProposalSent.match({ Made: thunkNull, Refused: ({ refusal }) => refusal }),
    }),
  ),
);

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
  reserve: { success: StoredReservation, error: ReportError },
  assess: { success: Assessed, error: ReasonerUnavailable },
  release: { success: LiveRun, error: ReportError },
  settle: { success: LiveRun, error: ReportError },
  step: { success: LiveRun, error: ReportError },
  propose: { success: StoredProposalSent, error: S.Union([ClaimNotPending, MissingGrant, NotAnAgent, ProposalStale]) },
  "record-refusal": { success: S.Void, error: ReportError },
  exhaust: { success: LiveRun, error: ReportError },
  await: { success: LiveRun, error: ReportError },
} as const;
