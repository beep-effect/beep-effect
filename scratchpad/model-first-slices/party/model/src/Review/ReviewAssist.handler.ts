import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { byAgent, extend, sagaStep } from "@proto/kernel/Invocation";
import { ProposeDisposition } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { RecordReviewRefused } from "@proto/party-contract/Claim/RecordReviewRefused.command";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Activity from "effect/workflow/Activity";
import { Authority } from "../Authority.external.ts";
import { Claim } from "../Claim/Claim.aggregate.ts";
import { Reasoner } from "./Reasoner.external.ts";
import { ProposalSent, Reservation, ReviewAssist, ReviewAssistActivities } from "./ReviewAssist.saga.ts";
import { ReviewPlan } from "./ReviewPlan.ts";
import { type BudgetRefused, type LiveRun, ReviewRuns, RunEnded, type RunRefused } from "./ReviewRuns.external.ts";
import { thunkEffectVoid } from "@beep/utils"

/** How the proposal went, in memory: what the activity recorded, or a claim already decided. */
const Proposal = S.TaggedUnion({ Made: {}, Refused: { refusal: S.String }, AlreadyDecided: {} });
type Proposal = typeof Proposal.Type;

/**
 * The run. Each step is one activity, so a retried step does not apply
 * twice, and each acts as the run: a hop with the run as its relayer.
 *
 * - Budget is reserved before the Reasoner call, settled with the reported
 *   usage after, and released if the call fails. A refused reservation ends
 *   the run as exhausted, with no Reasoner call.
 * - Every report returns the live run: a run that reached its history bound
 *   continued as a new run, and the next step acts as that run, under its
 *   own delegation.
 * - The proposal is sent under the live run's provenance, re-admitted for
 *   this hop: a delegation revoked mid-run refuses here, and the refusal is
 *   recorded on the claim and on the run.
 * - So is a report the runs context refuses (reserve, settle, step,
 *   release, exhaust or the wait), for example because the delegation was
 *   revoked before that hop: the refusal is recorded on the claim and on
 *   the run, which gives back what its open reservation held, and the
 *   executor stops there.
 * - A decision that lands while the run is still working ends it cleanly: a
 *   report to the concluded run answers `RunEnded`, a proposal on the decided
 *   claim answers `ClaimNotPending`, and the saga stops there without error.
 * - The run then waits for the claim to be decided. The executor's work ends
 *   there: the runs context concludes the run when Party publishes the
 *   decision (D11), whether a person approved the proposal or decided the
 *   claim directly.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ReviewAssistLive = ReviewAssist.toLayer(
  Effect.gen(function* () {
    const claims = yield* Claim;
    const reasoner = yield* Reasoner;
    const runs = yield* ReviewRuns;
    const authority = yield* Authority;
    return Effect.fn(function* ({ key: run, claim, proposition, signals, evidenceRevision, provenance }) {
      // The saga stays keyed by the run it started as; `live` follows the lineage.
      let live: LiveRun = { run, provenance };
      const hop = (step: string) => byAgent(live.run, sagaStep(ReviewAssist.sagaName, { key: run, step }));
      const as = (step: string) => ({ provenance: live.provenance, hop: hop(step), run: live.run });
      /** Record a refusal on the claim and on the run; the run gives back what it holds. */
      const recordRefusal = (refusal: string) =>
        Activity.make({
          name: "record-refusal",
          ...ReviewAssistActivities["record-refusal"],
          execute: claims
            .send(
              claim,
              RecordReviewRefused.make({
                run: live.run,
                reason: refusal,
                provenance: extend(live.provenance, hop("record-refusal")),
              }),
            )
            .pipe(Effect.andThen(runs.refuse({ ...as("refuse"), reason: refusal })), Effect.asVoid),
        });
      /** A report the runs context refused is recorded, and the run has then ended: the executor stops. */
      const recorded = (refused: RunRefused) =>
        recordRefusal(refused.reason).pipe(Effect.andThen(Effect.fail(RunEnded.make({ status: "rejected" }))));
      const report = (
        name: "release" | "settle" | "step" | "exhaust" | "await",
        execute: Effect.Effect<LiveRun, RunRefused | RunEnded>,
      ) =>
        Activity.make({ name, ...ReviewAssistActivities[name], execute }).pipe(
          Effect.tap((next) =>
            Effect.sync(() => {
              live = next;
            }),
          ),
          Effect.catchTag("RunRefused", recorded),
        );
      const reservation = `${run}:assess`;

      const reserved = yield* Activity.make({
        name: "reserve",
        ...ReviewAssistActivities.reserve,
        execute: runs.reserve({ ...as("reserve"), reservation, units: ReviewPlan.maxPerCall }).pipe(
          Effect.map((next) => Reservation.cases.Reserved.make({ live: next })),
          Effect.catchTag("BudgetRefused", (_: BudgetRefused) => Effect.succeed(Reservation.cases.OutOfBudget.make({}))),
        ),
      }).pipe(Effect.catchTag("RunRefused", recorded));
      if (Reservation.guards.OutOfBudget(reserved)) {
        // Out of budget: the run ends here, and no Reasoner call is made.
        yield* report("exhaust", runs.exhaust(as("exhaust")));
        return;
      }
      live = reserved.live;

      const assessed = yield* Activity.make({
        name: "assess",
        ...ReviewAssistActivities.assess,
        execute: reasoner.assess({
          run: live.run,
          step: "assess",
          idempotencyKey: reservation,
          promptVersion: ReviewPlan.versions.prompt,
          maxAllowance: ReviewPlan.maxPerCall,
          proposition,
          signals,
        }),
      }).pipe(Effect.tapError(() => report("release", runs.release({ ...as("release"), reservation }))));
      yield* report("settle", runs.settle({ ...as("settle"), reservation, units: assessed.usage.units }));
      yield* report("step", runs.step({ ...as("step"), step: "assess" }));

      // Propose as the live run, under its provenance re-admitted for this hop. A claim
      // already decided answers ClaimNotPending: the run's work is over, and it ends here.
      const proposed = yield* Activity.make({
        name: "propose",
        ...ReviewAssistActivities.propose,
        execute: claims.send(claim, ProposeDisposition.make({ ...assessed.assessment, evidenceRevision })).pipe(
          Effect.provideServiceEffect(CurrentInvocation, authority.readmit({ provenance: live.provenance, hop: hop("propose") })),
          Effect.as(ProposalSent.cases.Made.make({})),
          Effect.catchTag("ReadmissionRefused", (refused) =>
            Effect.succeed(ProposalSent.cases.Refused.make({ refusal: `readmission:${refused.reason}` })),
          ),
        ),
      }).pipe(
        Effect.map((sent): Proposal => sent),
        Effect.catchTag("ClaimNotPending", () => Effect.succeed(Proposal.cases.AlreadyDecided.make({}))),
      );
      if (Proposal.guards.AlreadyDecided(proposed)) return;
      if (Proposal.guards.Refused(proposed)) {
        yield* recordRefusal(proposed.refusal);
        return;
      }

      yield* report("await", runs.awaitApproval(as("await")));
    }, Effect.catchTag("RunEnded", thunkEffectVoid));
  }),
);
