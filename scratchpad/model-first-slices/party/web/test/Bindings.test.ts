import * as Domain from "@alchemy.run/domain";
import { expect, it } from "@effect/vitest";
import { OrgId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { IntakeContract } from "@proto/party-contract/IntakeApi.contract";
import { PartyIntake, PartyPropose, PartyRead, PartyReview } from "@proto/party-contract/Party.capabilities";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import { ReviewerApi } from "@proto/party-model/ReviewerApi.api";
import { makeClaimReviewController } from "@proto/party-web/Claim/ClaimReview.controller";
import { fixedCredentials } from "@proto/party-web/Credentials.context";
import { Intake, Reviewer } from "@proto/party-web/Party.bindings";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Access, asHuman, World } from "../../host/test/World.ts";

// The generated bindings over the real contract clients, served in process by the hosted
// Party model (with the authority and runs models behind the real Session).
const Clients = Layer.mergeAll(
  ReviewerContract.layerClient.pipe(Layer.provide(Domain.protocolInProcess(ReviewerApi))),
  IntakeContract.layerClient.pipe(Layer.provide(Domain.protocolInProcess(IntakeApi))),
  SecureRandom.layerWebCrypto,
);
const as = (principal: string) => Effect.provide(fixedCredentials(asHuman(principal).headers));

const acme = OrgId.make("org_acme");
const claim = ClaimId.make("claim_web_1");
const assertion = {
  org: acme,
  proposition: Proposition.cases.HasIdentifier.make({ party: PartyId.make("party_dana"), scheme: "email", value: "dana@acme.test" }),
  signals: [
    EvidenceSignal.make({ source: "mailbox:intake", quote: "From: Dana <dana@acme.test>" }),
    EvidenceSignal.make({ source: "crm", quote: "dana@acme.test on file" }),
  ],
};
const grants = Effect.gen(function* () {
  const access = yield* Access;
  yield* access.issue("g_intake", "p_intake", PartyIntake, acme);
  yield* access.issue("g_intake_propose", "p_intake", PartyPropose, acme);
  yield* access.issue("g_rev", "p_rev", PartyReview, acme);
  yield* access.issue("g_rev_read", "p_rev", PartyRead, acme);
});

it.live("commands return typed outcomes with ids; reads wait for receipts; subscriptions carry revisions", () =>
  Effect.gen(function* () {
    yield* grants;
    const asserted = yield* Intake.AssertClaim.send({ target: claim, input: assertion }).pipe(as("p_intake"));
    expect(asserted._tag).toBe("Accepted");
    if (asserted._tag !== "Accepted") return;

    // Read-after-write: the read waits until the view applied the receipt.
    const first = yield* Reviewer.ClaimReview.read(claim, asserted.receipt).pipe(as("p_rev"));
    expect(first.revision).toBeGreaterThanOrEqual(asserted.receipt.version);
    expect(first.state).toMatchObject({ status: "pending", sources: 2 });

    // The review run proposes (fixture Reasoner); the subscription delivers it with a newer revision.
    const proposed = yield* Reviewer.ClaimReview.subscribe(claim).pipe(
      Stream.filter((snapshot) => snapshot.state?.proposal != null),
      Stream.take(1),
      Stream.runCollect,
      as("p_rev"),
    );
    const proposal = proposed[0]!;
    expect(proposal.revision).toBeGreaterThan(first.revision);
    const digest = proposal.state?.proposal?.digest ?? "";

    // Authority refusal is Denied; a model refusal is Rejected; both keep the command id.
    const denied = yield* Reviewer.ApproveProposal.send({
      target: claim,
      input: { digest, evidenceRevision: 1 },
      commandId: "approve-intake",
    }).pipe(as("p_intake"));
    expect(denied).toEqual({ _tag: "Denied", commandId: "approve-intake", reason: "MissingGrant" });
    const mismatch = yield* Reviewer.ApproveProposal.send({ target: claim, input: { digest: "other", evidenceRevision: 1 } }).pipe(
      as("p_rev"),
    );
    expect(mismatch).toMatchObject({ _tag: "Rejected", rejection: { _tag: "ProposalMismatch", reason: "digest" } });

    // Accepted, then a retry under the same id: the first receipt again, nothing applied twice.
    const approved = yield* Reviewer.ApproveProposal.send({
      target: claim,
      input: { digest, evidenceRevision: 1 },
      commandId: "approve-1",
    }).pipe(as("p_rev"));
    const retried = yield* Reviewer.ApproveProposal.send({
      target: claim,
      input: { digest, evidenceRevision: 1 },
      commandId: "approve-1",
    }).pipe(as("p_rev"));
    expect(approved._tag).toBe("Accepted");
    expect(retried).toEqual(approved);
    if (approved._tag !== "Accepted") return;
    const decided = yield* Reviewer.ClaimReview.read(claim, approved.receipt).pipe(as("p_rev"));
    expect(decided.state).toMatchObject({ status: "accepted" });
    const late = yield* Reviewer.AcceptClaim.send({ target: claim, input: {} }).pipe(as("p_rev"));
    expect(late).toMatchObject({ _tag: "Rejected", rejection: { _tag: "ClaimNotPending" } });
  }).pipe(Effect.provide(Clients), Effect.scoped, Effect.provide(World)),
);

it.live("the claim review controller approves through the bindings: committed, then caught up", () =>
  Effect.gen(function* () {
    yield* grants;
    const target = ClaimId.make("claim_web_2");
    yield* Intake.AssertClaim.send({ target, input: assertion }).pipe(as("p_intake"));
    const controller = yield* makeClaimReviewController(target).pipe(as("p_rev"));
    // Wait until the screen shows the proposal, press Approve, and wait for the approval to finish.
    yield* SubscriptionRef.get(controller.screen).pipe(
      Effect.repeat({ schedule: Schedule.spaced("25 millis"), until: (screen) => screen.view?.review?.proposal != null, times: 200 }),
    );
    yield* controller.approve;
    const done = yield* SubscriptionRef.get(controller.screen).pipe(
      Effect.repeat({ schedule: Schedule.spaced("25 millis"), until: (screen) => screen.notice !== null, times: 200 }),
    );
    expect(done).toMatchObject({ pending: null, notice: { _tag: "Approved" }, view: { review: { status: "accepted" } } });
  }).pipe(Effect.provide(Clients), Effect.scoped, Effect.provide(World)),
);

it.effect("a transport failure is an unknown outcome that keeps its command id for the retry", () =>
  Effect.gen(function* () {
    const failing = Layer.succeed(ReviewerContract.Client, {
      ApproveProposal: () => Effect.fail({ _tag: "RpcClientError", message: "connection reset" }),
    } as never);
    const outcome = yield* Reviewer.ApproveProposal.send({
      target: claim,
      input: { digest: "d", evidenceRevision: 1 },
      commandId: "approve-9",
    }).pipe(Effect.provide(Layer.mergeAll(failing, SecureRandom.layerWebCrypto)), as("p_rev"));
    expect(outcome).toEqual({ _tag: "Unknown", commandId: "approve-9", reason: "RpcClientError" });
  }),
);

it.live("a subscription that fails reconnects with a new epoch and a fresh snapshot", () =>
  Effect.gen(function* () {
    let connections = 0;
    const flaky = Layer.succeed(ReviewerContract.Client, {
      ClaimReview: {
        snapshot: () => Effect.sync(() => ({ state: { status: "pending" }, cursor: 3 + connections++ })),
        // The first connection drops; the second stays open.
        events: () => (connections === 1 ? Stream.fail({ _tag: "RpcClientError", message: "dropped" }) : Stream.never),
      },
    } as never);
    const seen = yield* Reviewer.ClaimReview.subscribe(claim).pipe(
      Stream.take(2),
      Stream.runCollect,
      Effect.provide(Layer.mergeAll(flaky, SecureRandom.layerWebCrypto)),
      as("p_rev"),
    );
    expect(seen).toEqual([
      { state: { status: "pending" }, revision: 3, epoch: 0 },
      { state: { status: "pending" }, revision: 4, epoch: 1 },
    ]);
  }),
);
