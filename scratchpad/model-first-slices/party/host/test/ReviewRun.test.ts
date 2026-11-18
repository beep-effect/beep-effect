import * as DomainAi from "@alchemy.run/domain/Ai";
import { expect, it } from "@effect/vitest";
import { OrgId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimReviewEvent, type ClaimReviewState, proposalOf } from "@proto/party-contract/Claim/ClaimReview.read";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyIntake, PartyPropose, PartyRead, PartyReview } from "@proto/party-contract/Party.capabilities";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { AgentApi } from "@proto/party-model/AgentApi.api";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import { ReviewerApi } from "@proto/party-model/ReviewerApi.api";
import { AgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as P from "effect/Predicate";
import * as Schedule from "effect/Schedule";
import type * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import type * as Tool from "effect/ai/Tool";
import type * as Toolkit from "effect/ai/Toolkit";
import { Access, asAgent, asHuman, World } from "./World.ts";

/** The latest proposal in a review a client read, if it has one. */
const proposalIn = (state: ClaimReviewState | null | undefined) => O.flatMap(O.fromNullishOr(state), proposalOf);

const acme = OrgId.make("org_acme");
const claimId = ClaimId.make("claim_run_1");
const otherClaim = ClaimId.make("claim_run_2");
const run = "review:claim_run_1:1";
const hasIdentifier = Proposition.cases.HasIdentifier.make({
  party: PartyId.make("party_dana"),
  scheme: "email",
  value: "dana@acme.test",
});
// Two sources: the fixture reasoner proposes to accept.
const twoSources = [
  EvidenceSignal.make({ source: "mailbox:intake", quote: "From: Dana Smith <dana@acme.test>" }),
  EvidenceSignal.make({ source: "crm", quote: "dana@acme.test on file" }),
];

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

it.layer(World, { buildPerTest: true, excludeTestServices: true })((it) => {
  it.effect(
    "a review run proposes under its delegation only; a person approves through the Session; the run completes",
    () =>
      Effect.gen(function* () {
        const access = yield* Access;
        yield* access.issue("g_intake", "p_intake", PartyIntake, acme);
        yield* access.issue("g_intake_propose", "p_intake", PartyPropose, acme);
        yield* access.issue("g_rev", "p_rev", PartyReview, acme);
        yield* access.issue("g_rev_read", "p_rev", PartyRead, acme);
        const intake = yield* IntakeApi.clientInProcess;
        const reviewer = yield* ReviewerApi.clientInProcess;

        // Asserting the claim requests the first review run, under a delegation of p_intake's propose grant.
        yield* intake.AssertClaim(claimId, { org: acme, proposition: hasIdentifier, signals: twoSources }, asHuman("p_intake"));
        yield* intake.AssertClaim(otherClaim, { org: acme, proposition: hasIdentifier, signals: twoSources }, asHuman("p_intake"));
        const proposed = yield* reviewer.ClaimReview.get(claimId, asHuman("p_rev")).pipe(
          Effect.repeat({ schedule: Schedule.spaced("25 millis"), until: (view) => O.isSome(proposalIn(view)), times: 200 }),
        );
        expect(O.getOrThrow(proposalIn(proposed))).toMatchObject({ disposition: "accept", run, evidenceRevision: 1 });
        yield* access.run(run, AgentRunState.guards.AwaitingApproval);

        // The proposal is rooted at the run and names only its delegation, by id.
        const listed = yield* reviewer.ClaimReview.list(claimId, asHuman("p_rev"));
        const proposal = A.findFirst(listed.entries, (entry) => ClaimReviewEvent.isAnyOf(["DispositionProposed"])(entry.event));
        expect(O.map(proposal, (entry) => entry.event.provenance)).toEqual(
          O.some({
            root: { _tag: "Agent", run, accountable: "p_intake" },
            onBehalfOf: "p_intake",
            grants: [{ grant: "g_intake_propose", delegation: O.some(`dlg:${run}`) }],
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
          target: claimId as string,
          input: { disposition: "accept", rationale: "two independent sources agree", evidenceRevision: 1 },
        });
        expect(granted.isFailure).toBe(false);
        // Not granted: reading the claim (no party.read was delegated) ...
        const read = yield* callTool(handlers, "AgentApi_ClaimReview_get", { key: claimId as string });
        expect(read).toMatchObject({ isFailure: true, encodedResult: { _tag: "MissingGrant", capability: "party.read" } });
        // ... and proposing on a claim outside the delegation's resource.
        const elsewhere = yield* callTool(handlers, "AgentApi_ProposeDisposition_send", {
          target: otherClaim as string,
          input: { disposition: "accept", rationale: "x", evidenceRevision: 1 },
        });
        expect(elsewhere).toMatchObject({ isFailure: true, encodedResult: { _tag: "MissingGrant", capability: "party.propose" } });

        // Approval is a person's act: the run's own credential is refused.
        const current = yield* reviewer.ClaimReview.get(claimId, asHuman("p_rev"));
        const digest = O.getOrElse(
          O.map(proposalIn(current), (proposal) => proposal.digest),
          () => "",
        );
        const byAgent = yield* reviewer
          .ApproveProposal(claimId, { digest, evidenceRevision: 1 }, asAgent(run))
          .pipe(Effect.flip);
        expect(byAgent._tag).toBe("HumanApprovalRequired");

        // One authenticated human command decides the claim; Party publishes the decision and the
        // runs context's inbox concludes the run under its own provenance plus the fact's hop.
        const approved = yield* reviewer.ApproveProposal(claimId, { digest, evidenceRevision: 1 }, asHuman("p_rev"));
        const decided = yield* reviewer.ClaimReview.get(claimId, { ...asHuman("p_rev"), atLeast: approved });
        expect(decided).toMatchObject({ _tag: "Accepted" });
        const finished = yield* access.run(run, P.not(AgentRunState.guards.AwaitingApproval));
        expect(finished).toMatchObject({ _tag: "Completed", outcome: "accepted", run: { budget: { allowance: 100, reserved: 0 } } });
      }).pipe(Effect.scoped),
  );


  it.effect("a claim a person decides directly, with no approval, still concludes its waiting run", () =>
    Effect.gen(function* () {
      const access = yield* Access;
      yield* access.issue("g_intake", "p_intake", PartyIntake, acme);
      yield* access.issue("g_intake_propose", "p_intake", PartyPropose, acme);
      yield* access.issue("g_rev", "p_rev", PartyReview, acme);
      const intake = yield* IntakeApi.clientInProcess;
      const reviewer = yield* ReviewerApi.clientInProcess;
      yield* intake.AssertClaim(claimId, { org: acme, proposition: hasIdentifier, signals: twoSources }, asHuman("p_intake"));
      yield* access.run(run, AgentRunState.guards.AwaitingApproval);
      // The reviewer accepts the claim outright; the run's proposal is never approved.
      yield* reviewer.AcceptClaim(claimId, {}, asHuman("p_rev"));
      const finished = yield* access.run(run, P.not(AgentRunState.guards.AwaitingApproval));
      expect(finished).toMatchObject({ _tag: "Completed", outcome: "accepted", run: { budget: { reserved: 0 } } });
    }).pipe(Effect.scoped),
  );
});
