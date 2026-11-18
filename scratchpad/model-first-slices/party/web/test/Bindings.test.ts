import * as Domain from "@alchemy.run/domain";
import { expect, it } from "@effect/vitest";
import { PrincipalId } from "@proto/kernel/Ids";
import { Count, IdText, Sequence } from "@proto/kernel/Measure";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimReviewState, proposalOf, ProposalView } from "@proto/party-contract/Claim/ClaimReview.read";
import { IntakeContract } from "@proto/party-contract/IntakeApi.contract";
import { PartyIntake, PartyPropose, PartyRead, PartyReview } from "@proto/party-contract/Party.capabilities";
import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import { ReviewerApi } from "@proto/party-model/ReviewerApi.api";
import { makeClaimReviewController } from "@proto/party-web/Claim/ClaimReview.controller";
import { Approval } from "@proto/party-web/Claim/ClaimReview.machine";
import { fixedCredentials } from "@proto/party-web/Credentials.context";
import { Intake, Reviewer } from "@proto/party-web/Party.bindings";
import * as A from "@beep/utils/Array";
import { thunkEmptyStr } from "@beep/utils/thunk";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import * as Schedule from "effect/Schedule";
import * as Str from "@beep/utils/Str";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Cast, grantsBy, hasIdentifier } from "../../host/test/Cast.ts";
import { Access, asHuman, World } from "../../host/test/World.ts";

// Every story runs over a generated cast (the Party host's, `party/host/test/Cast.ts`). The two
// hosted stories run 10 times each, not the default 100, each run in a fresh hosted model (about
// 0.15 s a run on the live clock); the fake-client cases run 100 and 20 times (the reconnect waits
// out the subscription's backoff, about 50 ms a run).
const runs = (count: number) => ({ timeout: 120_000, arbitrary: { runs: count } });

/** The latest proposal in a view state the client read, if any. */
const proposalIn = (state: ClaimReviewState | null) => O.flatMap(O.fromNullOr(state), proposalOf);

// The generated bindings over the real contract clients, served in process by the hosted
// Party model (with the authority and runs models behind the real Session).
const Clients = Layer.mergeAll(
  ReviewerContract.layerClient.pipe(Layer.provide(Domain.protocolInProcess(ReviewerApi))),
  IntakeContract.layerClient.pipe(Layer.provide(Domain.protocolInProcess(IntakeApi))),
  SecureRandom.layerWebCrypto,
);

/** A story with a fresh hosted model and its clients, built for it and closed with it. */
const withClients = <A, E, R>(story: Effect.Effect<A, E, R>) =>
  Clients.pipe(
    Layer.provideMerge(World),
    Layer.build,
    Effect.flatMap((context) => Effect.provideContext(story, context)),
    Effect.scoped,
  );

const as = (principal: PrincipalId) => Effect.provide(fixedCredentials(asHuman(principal).headers));

/** The command ids a reviewer story sends under: one the authority refuses, one that commits; never the same. And how far a stale digest is from the proposal's. */
const Commands = S.Struct({ refused: IdText, approved: IdText, staleOffset: Sequence.check(S.isLessThan(2 ** 32)) }).check(
  S.makeFilter(({ refused, approved }) => refused !== approved, {
    identifier: "CommandsCheck",
    title: "Distinct commands",
    description: "Two command ids, one per command: a reused id returns the first command's outcome.",
    message: "Expected two distinct command ids",
  }),
);

/** Another digest: the proposal hash `offset` further on, modulo 2^32, so it is a digest and never the same one. */
const otherDigest = (digest: string, offset: number) => `p${((Number.parseInt(Str.slice(1)(digest), 16) + offset) >>> 0).toString(16)}`;

/** The cast's claim about its party's identifier, on two sources: the fixture reasoner proposes to accept. */
const assertionOf = (cast: Cast) => ({ org: cast.org, proposition: hasIdentifier(cast), signals: cast.signals });

const grantsIssued = Effect.fnUntraced(function* (cast: Cast) {
  const access = yield* Access;
  const grant = grantsBy(cast);
  yield* Effect.forEach(
    [
      grant(cast.intake, PartyIntake, cast.org),
      grant(cast.intake, PartyPropose, cast.org),
      grant(cast.reviewer, PartyReview, cast.org),
      grant(cast.reviewer, PartyRead, cast.org),
    ],
    access.issue,
    { concurrency: 1, discard: true },
  );
});

it.live.prop(
  "commands return typed outcomes with ids; reads wait for receipts; subscriptions carry revisions",
  [Cast, Commands],
  ([cast, commands]) =>
    Effect.gen(function* () {
      yield* grantsIssued(cast);
      const { claim } = cast;
      const asserted = yield* Intake.AssertClaim.send({ target: claim, input: assertionOf(cast) }).pipe(as(cast.intake));
      expect(asserted._tag).toBe("Accepted");
      if (!P.isTagged(asserted, "Accepted")) return;

      // Read-after-write: the read waits until the view applied the receipt.
      const first = yield* Reviewer.ClaimReview.read(claim, asserted.receipt).pipe(as(cast.reviewer));
      expect(first.revision).toBeGreaterThanOrEqual(asserted.receipt.version);
      expect(first.state).toMatchObject({ _tag: "Pending", sources: A.length(cast.signals) });

      // The review run proposes (fixture Reasoner); the subscription delivers it with a newer revision.
      const proposed = yield* Reviewer.ClaimReview.subscribe(claim).pipe(
        Stream.filter((snapshot) => O.isSome(proposalIn(snapshot.state))),
        Stream.take(1),
        Stream.runCollect,
        as(cast.reviewer),
      );
      const proposal = proposed[0]!;
      // Newer than the assertion; and newer than the first read, unless that read already held
      // the proposal (the review run may propose before the read returns: one revision, one state).
      expect(proposal.revision).toBeGreaterThan(asserted.receipt.version);
      expect(proposal.revision).toBeGreaterThanOrEqual(first.revision);
      expect(O.isSome(proposalIn(first.state)) || proposal.revision > first.revision).toBe(true);
      const digest = O.getOrElse(
        O.map(proposalIn(proposal.state), (made) => made.digest),
        thunkEmptyStr,
      );

      // Authority refusal is Denied; a model refusal is Rejected; both keep the command id.
      const denied = yield* Reviewer.ApproveProposal.send({
        target: claim,
        input: { digest, evidenceRevision: 1 },
        commandId: commands.refused,
      }).pipe(as(cast.intake));
      expect(denied).toEqual({ _tag: "Denied", commandId: commands.refused, reason: "MissingGrant" });
      const mismatch = yield* Reviewer.ApproveProposal.send({
        target: claim,
        input: { digest: otherDigest(digest, commands.staleOffset), evidenceRevision: 1 },
      }).pipe(as(cast.reviewer));
      expect(mismatch).toMatchObject({ _tag: "Rejected", rejection: { _tag: "ProposalMismatch", reason: "digest" } });

      // Accepted, then a retry under the same id: the first receipt again, nothing applied twice.
      const approve = { target: claim, input: { digest, evidenceRevision: 1 }, commandId: commands.approved };
      const approved = yield* Reviewer.ApproveProposal.send(approve).pipe(as(cast.reviewer));
      const retried = yield* Reviewer.ApproveProposal.send(approve).pipe(as(cast.reviewer));
      expect(approved._tag).toBe("Accepted");
      expect(retried).toEqual(approved);
      if (!P.isTagged(approved, "Accepted")) return;
      const decided = yield* Reviewer.ClaimReview.read(claim, approved.receipt).pipe(as(cast.reviewer));
      expect(decided.state).toMatchObject({ _tag: "Accepted" });
      const late = yield* Reviewer.AcceptClaim.send({ target: claim, input: {} }).pipe(as(cast.reviewer));
      expect(late).toMatchObject({ _tag: "Rejected", rejection: { _tag: "ClaimNotPending" } });
    }).pipe(withClients),
  runs(10),
);

it.live.prop(
  "the claim review controller approves through the bindings: committed, then caught up",
  [Cast],
  ([cast]) =>
    Effect.gen(function* () {
      yield* grantsIssued(cast);
      const target = cast.otherClaim;
      yield* Intake.AssertClaim.send({ target, input: assertionOf(cast) }).pipe(as(cast.intake));
      const controller = yield* makeClaimReviewController(target).pipe(as(cast.reviewer));
      // Wait until the screen shows the proposal, press Approve, and wait for the approval to finish.
      yield* SubscriptionRef.get(controller.screen).pipe(
        Effect.repeat({
          schedule: Schedule.spaced("25 millis"),
          until: (screen) => O.isSome(O.flatMap(O.flatMap(screen.view, (view) => view.review), proposalOf)),
          times: 200,
        }),
      );
      yield* controller.approve;
      const done = yield* SubscriptionRef.get(controller.screen).pipe(
        Effect.repeat({ schedule: Schedule.spaced("25 millis"), until: (screen) => Approval.guards.Noticed(screen.approval), times: 200 }),
      );
      expect(done).toMatchObject({
        approval: { _tag: "Noticed", notice: { _tag: "Approved" } },
        view: { _tag: "Some", value: { review: { _tag: "Some", value: { _tag: "Accepted" } } } },
      });
    }).pipe(Effect.scoped, withClients),
  runs(10),
);

it.effect.prop(
  "a transport failure is an unknown outcome that keeps its command id for the retry",
  [ClaimId, PrincipalId, IdText, ProposalView.fields.digest, S.String],
  ([claim, principal, commandId, digest, message]) =>
    Effect.gen(function* () {
      const failing = Layer.succeed(ReviewerContract.Client, {
        ApproveProposal: () => Effect.fail({ _tag: "RpcClientError", message }),
      } as never);
      const context = yield* Layer.build(Layer.mergeAll(failing, SecureRandom.layerWebCrypto));
      const outcome = yield* Reviewer.ApproveProposal.send({ target: claim, input: { digest, evidenceRevision: 1 }, commandId }).pipe(
        Effect.provideContext(context),
        as(principal),
      );
      expect(outcome).toEqual({ _tag: "Unknown", commandId, reason: "RpcClientError" });
    }),
);

it.live.prop(
  "a subscription that fails reconnects with a new epoch and a fresh snapshot",
  [ClaimId, PrincipalId, ClaimReviewState, Count],
  ([claim, principal, state, cursor]) =>
    Effect.gen(function* () {
      let connections = 0;
      const flaky = Layer.succeed(ReviewerContract.Client, {
        ClaimReview: {
          snapshot: () => Effect.sync(() => ({ state, cursor: cursor + connections++ })),
          // The first connection drops; the second stays open.
          events: () => (connections === 1 ? Stream.fail({ _tag: "RpcClientError", message: "dropped" }) : Stream.never),
        },
      } as never);
      const context = yield* Layer.build(Layer.mergeAll(flaky, SecureRandom.layerWebCrypto));
      const seen = yield* Reviewer.ClaimReview.subscribe(claim).pipe(
        Stream.take(2),
        Stream.runCollect,
        Effect.provideContext(context),
        as(principal),
      );
      expect(seen).toEqual([
        { state, revision: cursor, epoch: 0 },
        { state, revision: cursor + 1, epoch: 1 },
      ]);
    }),
  runs(20),
);
