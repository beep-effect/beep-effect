import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { byAgent, extend, sagaStep } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { ClaimNotPending } from "@proto/party-contract/Claim/ClaimNotPending.rejection";
import { NotAnAgent, ProposalStale, ProposeDisposition } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { RecordReviewRefused } from "@proto/party-contract/Claim/RecordReviewRefused.command";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Activity from "effect/workflow/Activity";
import * as DurableDeferred from "effect/workflow/DurableDeferred";
import { Authority } from "../Authority.external.ts";
import { Claim } from "../Claim/Claim.aggregate.ts";
import { Assessed, Reasoner, ReasonerUnavailable } from "./Reasoner.external.ts";
import { ApprovalGiven, ReviewAssist } from "./ReviewAssist.saga.ts";
import { ReviewPlan } from "./ReviewPlan.ts";
import { BudgetRefused, ReviewRuns, RunRefused } from "./ReviewRuns.external.ts";

/**
 * The run. Each step is one activity, so a retried step does not apply
 * twice, and each acts as the run: a hop with the run as its relayer.
 *
 * - Budget is reserved before the Reasoner call, settled with the reported
 *   usage after, and released if the call fails. A refused reservation ends
 *   the run as exhausted, with no Reasoner call.
 * - The proposal is sent under the run's provenance, re-admitted for this
 *   hop: a delegation revoked mid-run refuses here, and the refusal is
 *   recorded on the claim and on the run.
 * - The run then waits for an approval id; the approval itself decided the claim.
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
      const hop = (step: string) => byAgent(run, sagaStep(ReviewAssist.sagaName, run, step));
      const as = (step: string) => ({ provenance, hop: hop(step), run });
      const reservation = `${run}:assess`;

      const reserved = yield* Activity.make({
        name: "reserve",
        success: S.Boolean,
        error: RunRefused,
        execute: runs.reserve({ ...as("reserve"), reservation, units: ReviewPlan.maxPerCall }).pipe(
          Effect.as(true),
          Effect.catchTag("BudgetRefused", (_: BudgetRefused) => Effect.succeed(false)),
        ),
      });
      if (!reserved) {
        // Out of budget: the run ends here, and no Reasoner call is made.
        yield* Activity.make({ name: "exhaust", error: RunRefused, execute: runs.exhaust(as("exhaust")) });
        return;
      }

      const assessed = yield* Activity.make({
        name: "assess",
        success: Assessed,
        error: ReasonerUnavailable,
        execute: reasoner.assess({
          run,
          step: "assess",
          idempotencyKey: reservation,
          promptVersion: ReviewPlan.versions.prompt,
          maxAllowance: ReviewPlan.maxPerCall,
          proposition,
          signals,
        }),
      }).pipe(
        Effect.tapError(() =>
          Activity.make({
            name: "release",
            error: RunRefused,
            execute: runs.release({ ...as("release"), reservation }),
          }),
        ),
      );
      yield* Activity.make({
        name: "settle",
        error: RunRefused,
        execute: runs.settle({ ...as("settle"), reservation, units: assessed.usage.units }),
      });
      yield* Activity.make({ name: "step", error: RunRefused, execute: runs.step({ ...as("step"), step: "assess" }) });

      // Propose as the run, under its provenance re-admitted for this hop.
      const refusal = yield* Activity.make({
        name: "propose",
        success: S.NullOr(S.String),
        error: S.Union([ClaimNotPending, MissingGrant, NotAnAgent, ProposalStale]),
        execute: authority.readmit({ provenance, hop: hop("propose") }).pipe(
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
              new RecordReviewRefused({ run, reason: refusal, provenance: extend(provenance, hop("record-refusal")) }),
            )
            .pipe(Effect.andThen(runs.refuse({ ...as("refuse"), reason: refusal })), Effect.asVoid),
        });
        return;
      }

      yield* Activity.make({ name: "await", error: RunRefused, execute: runs.awaitApproval(as("await")) });
      const { approval } = yield* DurableDeferred.await(ApprovalGiven);
      yield* Activity.make({
        name: "complete",
        error: RunRefused,
        execute: runs.complete({ ...as("complete"), outcome: `approved:${approval}` }),
      });
    });
  }),
);
