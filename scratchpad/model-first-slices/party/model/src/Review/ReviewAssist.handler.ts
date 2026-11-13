import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { byAgent, extend, sagaStep } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { ClaimNotPending } from "@proto/party-contract/Claim/ClaimNotPending.rejection";
import { NotAnAgent, ProposalStale, ProposeDisposition } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { RecordReviewRefused } from "@proto/party-contract/Claim/RecordReviewRefused.command";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Activity from "effect/workflow/Activity";
import { Authority } from "../Authority.external.ts";
import { Claim } from "../Claim/Claim.aggregate.ts";
import { Assessed, Reasoner, ReasonerUnavailable } from "./Reasoner.external.ts";
import { ReviewAssist } from "./ReviewAssist.saga.ts";
import { ReviewPlan } from "./ReviewPlan.ts";
import { type BudgetRefused, LiveRun, ReviewRuns, RunRefused } from "./ReviewRuns.external.ts";

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
      const report = (name: string, execute: Effect.Effect<LiveRun, RunRefused>) =>
        Activity.make({ name, success: LiveRun, error: RunRefused, execute }).pipe(
          Effect.tap((next) =>
            Effect.sync(() => {
              live = next;
            }),
          ),
        );
      const reservation = `${run}:assess`;

      const reserved = yield* Activity.make({
        name: "reserve",
        success: S.NullOr(LiveRun),
        error: RunRefused,
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
        success: Assessed,
        error: ReasonerUnavailable,
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

      // Propose as the live run, under its provenance re-admitted for this hop.
      const refusal = yield* Activity.make({
        name: "propose",
        success: S.NullOr(S.String),
        error: S.Union([ClaimNotPending, MissingGrant, NotAnAgent, ProposalStale]),
        execute: authority.readmit({ provenance: live.provenance, hop: hop("propose") }).pipe(
          Effect.flatMap((invocation) =>
            claims
              .send(claim, new ProposeDisposition({ ...assessed.assessment, evidenceRevision }))
              .pipe(Effect.provideService(CurrentInvocation, invocation)),
          ),
          Effect.as(null),
          Effect.catchTag("ReadmissionRefused", (refused) => Effect.succeed(`readmission:${refused.reason}`)),
        ),
      });
      if (refusal !== null) {
        yield* Activity.make({
          name: "record-refusal",
          error: RunRefused,
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
    });
  }),
);
