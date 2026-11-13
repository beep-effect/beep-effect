import { agent } from "@proto/kernel/Actor";
import { CurrentActor } from "@proto/kernel/CurrentActor.context";
import { NotAMember } from "@proto/kernel/NotAMember.rejection";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Activity from "effect/workflow/Activity";
import * as DurableDeferred from "effect/workflow/DurableDeferred";
import { AcceptClaim, AdmissionGateUnmet } from "../Claim/AcceptClaim.command.ts";
import { Claim } from "../Claim/Claim.aggregate.ts";
import { ClaimNotPending } from "../Claim/ClaimNotPending.rejection.ts";
import { NotAnAgent, ProposeDisposition } from "../Claim/ProposeDisposition.command.ts";
import { Assessment, Reasoner, ReasonerUnavailable } from "./Reasoner.external.ts";
import { HumanDecision, ReviewAssist } from "./ReviewAssist.saga.ts";

/**
 * The run. Each step is one activity, so a retried step does not apply twice;
 * the agent proposes as itself, and the accept is sent as the person who decided.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ReviewAssistLive = ReviewAssist.toLayer(
  Effect.gen(function* () {
    const claims = yield* Claim;
    const reasoner = yield* Reasoner;
    return Effect.fn(function* ({ key, proposition, signals, onBehalfOf, org }) {
      const assistant = agent({
        agent: "review-assistant",
        model: "reasoner",
        run: `ReviewAssist/${key}`,
        onBehalfOf,
        org,
      });

      const assessed = yield* Activity.make({
        name: "assess",
        success: Assessment,
        error: ReasonerUnavailable,
        execute: reasoner.assess({ proposition, signals }),
      });

      // The agent proposes, as itself. decide may refuse it like any other command.
      yield* Activity.make({
        name: "propose",
        error: S.Union([ClaimNotPending, NotAMember, NotAnAgent]),
        execute: claims
          .send(key, new ProposeDisposition(assessed))
          .pipe(Effect.asVoid, Effect.provideService(CurrentActor, assistant)),
      });

      // A person signs off. The run sleeps here, durably.
      const decision = yield* DurableDeferred.await(HumanDecision);
      if (decision.disposition === "reject") return;

      yield* Activity.make({
        name: "apply",
        error: S.Union([ClaimNotPending, NotAMember, AdmissionGateUnmet]),
        execute: claims
          .send(key, new AcceptClaim())
          .pipe(Effect.asVoid, Effect.provideService(CurrentActor, decision.by)),
      });
    });
  }),
);
