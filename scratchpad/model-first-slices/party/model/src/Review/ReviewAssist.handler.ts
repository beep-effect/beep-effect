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
import { ReviewAssist, ReviewAssistActivities } from "./ReviewAssist.saga.ts";
import { ReviewPlan } from "./ReviewPlan.ts";
import { type BudgetRefused, LiveRun, ReviewRuns, RunEnded, RunRefused } from "./ReviewRuns.external.ts";

/** How the proposal went, in memory only: the activity itself records `string | null`. */
const Proposal = S.TaggedUnion({ Made: {}, Refused: { refusal: S.String }, AlreadyDecided: {} });



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
      const hop = (step: string) => byAgent(live.run, sagaStep(ReviewAssist.sagaName, run, step));
      const as = (step: string) => ({ provenance: live.provenance, hop: hop(step), run: live.run });
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
        );
      const reservation = `${run}:assess`;

      const reserved = yield* Activity.make({
        name: "reserve",
        ...ReviewAssistActivities.reserve,
        execute: runs
          .reserve({ ...as("reserve"), reservation, units: ReviewPlan.maxPerCall })
          .pipe(Effect.catchTag("BudgetRefused", (_: BudgetRefused) => Effect.succeed(null))),
      });
      if (reserved === null) {
        // Out of budget: the run ends here, and no Reasoner call is made.
        yield* report("exhaust", runs.exhaust(as("exhaust")));
        return;
      }
      live = reserved;

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
        execute: authority.readmit({ provenance: live.provenance, hop: hop("propose") }).pipe(
          Effect.flatMap((invocation) =>
            claims
              .send(claim, new ProposeDisposition({ ...assessed.assessment, evidenceRevision }))
              .pipe(Effect.provideService(CurrentInvocation, invocation)),
          ),
          Effect.as(null),
          Effect.catchTag("ReadmissionRefused", (refused) => Effect.succeed(`readmission:${refused.reason}`)),
        ),
      }).pipe(
        Effect.map((refusal) => (refusal === null ? Proposal.cases.Made.make({}) : Proposal.cases.Refused.make({ refusal }))),
        Effect.catchTag("ClaimNotPending", () => Effect.succeed(Proposal.cases.AlreadyDecided.make({}))),
      );
      if (Proposal.guards.AlreadyDecided(proposed)) return;
      if (Proposal.guards.Refused(proposed)) {
        const refusal = proposed.refusal;
        yield* Activity.make({
          name: "record-refusal",
          ...ReviewAssistActivities["record-refusal"],
          execute: claims
            .send(
              claim,
              new RecordReviewRefused({
                run: live.run,
                reason: refusal,
                provenance: extend(live.provenance, hop("record-refusal")),
              }),
            )
            .pipe(Effect.andThen(runs.refuse({ ...as("refuse"), reason: refusal })), Effect.asVoid),
        });
        return;
      }

      yield* report("await", runs.awaitApproval(as("await")));
    }, Effect.catchTag("RunEnded", () => Effect.void));
  }),
);
