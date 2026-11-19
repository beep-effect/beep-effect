import * as DomainAi from "@alchemy.run/domain/Ai";
import { expect, it } from "@effect/vitest";
import { ClaimReviewEvent, type ClaimReviewState, proposalOf } from "@proto/party-contract/Claim/ClaimReview.read";
import { PartyIntake, PartyPropose, PartyRead, PartyReview } from "@proto/party-contract/Party.capabilities";
import { AgentApi } from "@proto/party-model/AgentApi.api";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import { ReviewerApi } from "@proto/party-model/ReviewerApi.api";
import { ReviewPlan, reviewRun } from "@proto/party-model/Review/ReviewPlan";
import { AgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import * as Schedule from "effect/Schedule";
import type * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import type * as Tool from "effect/ai/Tool";
import type * as Toolkit from "effect/ai/Toolkit";
import { Cast, delegationOf, grantIdOf, grantsBy, hasIdentifier } from "./Cast.ts";
import { Access, asAgent, asHuman, inWorld } from "./World.ts";
import { thunkEmptyStr } from "@beep/utils"

// Both stories run over a generated cast, each run in a fresh world, 10 runs each rather than the
// default 100: a run waits on the live clock for the review saga, the runs context and the fact
// inbox, about 0.3 s.
const storyRuns = { timeout: 120_000, arbitrary: { runs: 10 } };

/** The latest proposal in a review a client read, if it has one. */
const proposalIn = (state: ClaimReviewState | null | undefined) => O.flatMap(O.fromNullishOr(state), proposalOf);

/** The cast's claim about its party's identifier, on the cast's two sources: the fixture reasoner proposes to accept. */
const assertionOf = (cast: Cast) => ({ org: cast.org, proposition: hasIdentifier(cast), signals: cast.signals });

/**
 * A tool as `DomainAi.toToolkit` builds it (`toolOf` in the library's `Ai.ts`): JSON codecs, a
 * rejection returned as a result rather than failed (`failureMode: "return"`), and nothing required
 * at call time. The library's type is loose because it erases its tools to `Tool.Any`
 * (`as unknown as Toolkit<Record<string, Tool.Any>>`), whose calls read `any` requirements.
 */
type DerivedTool = Tool.Tool<
  string,
  {
    readonly parameters: Schema.Codec<unknown, Schema.Json>;
    readonly success: Schema.Codec<unknown, Schema.Json>;
    readonly failure: Schema.Codec<unknown, Schema.Json>;
    readonly failureMode: "return";
  }
>;

/** The derived toolkit's handlers, typed once as the tools the library built. */
const asDerived = (handlers: Toolkit.WithHandler<Record<string, Tool.Any>>) =>
  handlers as unknown as Toolkit.WithHandler<Record<string, DerivedTool>>;

/** A tool's final result, through the toolkit's own handler. */
const callTool = (handlers: Toolkit.WithHandler<Record<string, DerivedTool>>, name: string, params: Schema.Json) =>
  Effect.flatMap(handlers.handle(name, params), (results) => Stream.runLast(results).pipe(Effect.map(O.getOrThrow)));

it.live.prop(
  "a review run proposes under its delegation only; a person approves through the Session; the run completes",
  [Cast],
  ([cast]) =>
    Effect.gen(function* () {
      const access = yield* Access;
      const grant = grantsBy(cast);
      yield* access.issue(grant(cast.intake, PartyIntake, cast.org));
      yield* access.issue(grant(cast.intake, PartyPropose, cast.org));
      yield* access.issue(grant(cast.reviewer, PartyReview, cast.org));
      yield* access.issue(grant(cast.reviewer, PartyRead, cast.org));
      const intake = yield* IntakeApi.clientInProcess;
      const reviewer = yield* ReviewerApi.clientInProcess;
      const { claim, otherClaim } = cast;
      const run = reviewRun(claim, 1);

      // Asserting the claim requests the first review run, under a delegation of intake's propose grant.
      yield* intake.AssertClaim(claim, assertionOf(cast), asHuman(cast.intake));
      yield* intake.AssertClaim(otherClaim, assertionOf(cast), asHuman(cast.intake));
      const proposed = yield* reviewer.ClaimReview.get(claim, asHuman(cast.reviewer)).pipe(
        Effect.repeat({ schedule: Schedule.spaced("25 millis"), until: (view) => O.isSome(proposalIn(view)), times: 200 }),
      );
      expect(O.getOrThrow(proposalIn(proposed))).toMatchObject({ disposition: "accept", run, evidenceRevision: 1 });
      yield* access.run(run, AgentRunState.guards.AwaitingApproval);

      // The proposal is rooted at the run and names only its delegation, by id.
      const listed = yield* reviewer.ClaimReview.list(claim, asHuman(cast.reviewer));
      const proposal = A.findFirst(listed.entries, (entry) => ClaimReviewEvent.isAnyOf(["DispositionProposed"])(entry.event));
      expect(O.map(proposal, (entry) => entry.event.provenance)).toEqual(
        O.some({
          root: { _tag: "Agent", run, accountable: cast.intake },
          onBehalfOf: cast.intake,
          grants: [{ grant: grantIdOf(cast.intake, PartyPropose), delegation: O.some(delegationOf(run)) }],
          chain: [{ by: { _tag: "Agent", run }, cause: { _tag: "SagaStep", saga: "ReviewAssist", key: run, step: "propose" } }],
        }),
      );

      // The operating agent's toolkit, derived from the Api, under the run's own credential.
      const { toolkit, layer } = DomainAi.toToolkit(AgentApi, {
        expose: ["ProposeDisposition", "ClaimReview.get"],
        headers: Effect.succeed(asAgent(run).headers),
      });
      // Built in this test's scope, so the in-process client the tools call stays open.
      const context = yield* Layer.build(layer);
      const built = yield* Effect.provideContext(toolkit, context);
      const handlers = asDerived(built);
      // Granted: ProposeDisposition on this claim.
      const granted = yield* callTool(handlers, "AgentApi_ProposeDisposition_send", {
        target: claim,
        input: { disposition: "accept", rationale: cast.rationale, evidenceRevision: 1 },
      });
      expect(granted.isFailure).toBe(false);
      // Not granted: reading the claim (no party.read was delegated) ...
      const read = yield* callTool(handlers, "AgentApi_ClaimReview_get", { key: claim });
      expect(read).toMatchObject({ isFailure: true, encodedResult: { _tag: "MissingGrant", capability: PartyRead.id } });
      // ... and proposing on a claim outside the delegation's resource.
      const elsewhere = yield* callTool(handlers, "AgentApi_ProposeDisposition_send", {
        target: otherClaim,
        input: { disposition: "accept", rationale: cast.rationale, evidenceRevision: 1 },
      });
      expect(elsewhere).toMatchObject({ isFailure: true, encodedResult: { _tag: "MissingGrant", capability: PartyPropose.id } });

      // Approval is a person's act: the run's own credential is refused.
      const current = yield* reviewer.ClaimReview.get(claim, asHuman(cast.reviewer));
      const digest = O.getOrElse(
        O.map(proposalIn(current), (made) => made.digest),
        thunkEmptyStr,
      );
      const byAgent = yield* reviewer.ApproveProposal(claim, { digest, evidenceRevision: 1 }, asAgent(run)).pipe(Effect.flip);
      expect(byAgent._tag).toBe("HumanApprovalRequired");

      // One authenticated human command decides the claim; Party publishes the decision and the
      // runs context's inbox concludes the run under its own provenance plus the fact's hop.
      const approved = yield* reviewer.ApproveProposal(claim, { digest, evidenceRevision: 1 }, asHuman(cast.reviewer));
      const decided = yield* reviewer.ClaimReview.get(claim, { ...asHuman(cast.reviewer), atLeast: approved });
      expect(decided).toMatchObject({ _tag: "Accepted" });
      const finished = yield* access.run(run, P.not(AgentRunState.guards.AwaitingApproval));
      expect(finished).toMatchObject({
        _tag: "Completed",
        outcome: "accepted",
        run: { budget: { allowance: ReviewPlan.allowance, reserved: 0 } },
      });
    }).pipe(Effect.scoped, inWorld),
  storyRuns,
);

it.live.prop(
  "a claim a person decides directly, with no approval, still concludes its waiting run",
  [Cast],
  ([cast]) =>
    Effect.gen(function* () {
      const access = yield* Access;
      const grant = grantsBy(cast);
      yield* access.issue(grant(cast.intake, PartyIntake, cast.org));
      yield* access.issue(grant(cast.intake, PartyPropose, cast.org));
      yield* access.issue(grant(cast.reviewer, PartyReview, cast.org));
      const intake = yield* IntakeApi.clientInProcess;
      const reviewer = yield* ReviewerApi.clientInProcess;
      const run = reviewRun(cast.claim, 1);
      yield* intake.AssertClaim(cast.claim, assertionOf(cast), asHuman(cast.intake));
      yield* access.run(run, AgentRunState.guards.AwaitingApproval);
      // The reviewer accepts the claim outright; the run's proposal is never approved.
      yield* reviewer.AcceptClaim(cast.claim, {}, asHuman(cast.reviewer));
      const finished = yield* access.run(run, P.not(AgentRunState.guards.AwaitingApproval));
      expect(finished).toMatchObject({ _tag: "Completed", outcome: "accepted", run: { budget: { reserved: 0 } } });
    }).pipe(Effect.scoped, inWorld),
  storyRuns,
);
