import * as Domain from "@alchemy.run/domain";
import { expect, it } from "@effect/vitest";
import { AgentContract } from "@proto/party-contract/AgentApi.contract";
import { EffectivePartyState } from "@proto/party-contract/Party/EffectiveParty.read";
import { PartyIntake, PartyPropose, PartyRead, PartyReview } from "@proto/party-contract/Party.capabilities";
import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
import { AgentApi } from "@proto/party-model/AgentApi.api";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import { ReviewerApi } from "@proto/party-model/ReviewerApi.api";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { Cast, claimStream, duplicateName, grantIdOf, grantsBy, partiesInOrder, partyName, sameParty, searchText } from "./Cast.ts";
import { Access, asAgent, asHuman, AuthorityWorld, inWorld, PartyWorld, Session } from "./World.ts";

// Every story runs over a generated cast, each run in a fresh world (a world shared across runs,
// or across a failing run's shrinks, would hold the previous runs' claims and grants). Runs per
// story, chosen to keep the file near ten seconds: the full grants story 5 (one run builds three
// hosted models and waits for projections and the merge policy on the live clock, about 1.2 s),
// the contract-client story 20 (about 0.13 s a run), and the two boundary stories the default 100.
const runs = (count: number) => ({ timeout: 120_000, arbitrary: { runs: count } });

/**
 * A contract's client over the real Api's in-process protocol, both living for
 * the caller's scope (as the Api's own `clientInProcess` builds it).
 */
const contractClient = <C, R, P, RP>(client: Effect.Effect<C, never, R>, protocol: Layer.Layer<P, never, RP>) =>
  Effect.flatMap(Layer.build(protocol), (context) => Effect.provide(client, context));

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));

/** The assertion intake makes: the duplicate is the party, on two sources. */
const assertionOf = (cast: Cast) => ({ org: cast.org, proposition: sameParty(cast), signals: cast.signals });

/** The grants each principal holds, issued by the authority context. */
const grantsIssued = Effect.fnUntraced(function* (cast: Cast) {
  const authority = yield* Access;
  const grant = grantsBy(cast);
  yield* Effect.forEach(
    [
      grant(cast.intake, PartyIntake, cast.org),
      grant(cast.intake, PartyPropose, cast.org),
      grant(cast.reviewer, PartyReview, cast.org),
      grant(cast.reviewer, PartyRead, cast.org),
      grant(cast.outsider, PartyReview, cast.otherOrg),
      grant(cast.outsider, PartyRead, cast.otherOrg),
    ],
    authority.issue,
    { concurrency: 1, discard: true },
  );
});

it.live.prop(
  "grants decide who may accept and read; another org's grants are refused",
  [Cast],
  ([cast]) =>
    Effect.gen(function* () {
      yield* grantsIssued(cast);
      const intake = yield* IntakeApi.clientInProcess;
      const reviewer = yield* ReviewerApi.clientInProcess;
      const claimId = cast.claim;

      const registered = [
        yield* intake.RegisterParty(cast.party, { org: cast.org, name: partyName(cast) }, asHuman(cast.intake)),
        yield* intake.RegisterParty(cast.duplicate, { org: cast.org, name: duplicateName(cast) }, asHuman(cast.intake)),
      ];
      const asserted = yield* intake.AssertClaim(claimId, assertionOf(cast), asHuman(cast.intake));

      // A grant on another org reaches neither the decision nor the read. The read waits for
      // the assertion: a view that has not caught up reads as empty, and is not refused.
      const refusedAccept = yield* reviewer.AcceptClaim(claimId, {}, asHuman(cast.outsider)).pipe(Effect.flip);
      expect(refusedAccept).toMatchObject({ _tag: "MissingGrant", capability: PartyReview.id, operation: "AcceptClaim" });
      const refusedRead = yield* reviewer.ClaimReview.get(claimId, { ...asHuman(cast.outsider), atLeast: asserted }).pipe(
        Effect.flip,
      );
      expect(refusedRead).toMatchObject({ _tag: "MissingGrant", capability: PartyRead.id });

      // No credential at all.
      const anonymous = yield* reviewer.AcceptClaim(claimId).pipe(Effect.flip);
      expect(anonymous._tag).toBe("Unauthorized");

      // Intake asserted, but may not decide.
      const intakeAccept = yield* reviewer.AcceptClaim(claimId, {}, asHuman(cast.intake)).pipe(Effect.flip);
      expect(intakeAccept._tag).toBe("MissingGrant");

      // The granted reviewer accepts; the receipt lets the read wait for that write.
      const accepted = yield* reviewer.AcceptClaim(claimId, {}, asHuman(cast.reviewer));
      const review = yield* reviewer.ClaimReview.get(claimId, { ...asHuman(cast.reviewer), atLeast: accepted });
      expect(review).toMatchObject({ _tag: "Accepted", org: cast.org });

      // The merge policy ran under the reviewer's relayed invocation; the party view shows it once it lands.
      const merged = yield* reviewer.EffectiveParty.get(cast.party, asHuman(cast.reviewer)).pipe(
        Effect.repeat({
          schedule: Schedule.spaced("25 millis"),
          until: (party) =>
            O.exists(O.filter(O.fromNullishOr(party), EffectivePartyState.guards.Registered), (registered) =>
              A.isReadonlyArrayNonEmpty(registered.absorbed),
            ),
          times: 80,
        }),
      );
      expect(merged).toMatchObject({ name: partyName(cast), absorbed: [cast.duplicate] });

      // Events carry provenance only: a view's list and events hold grant ids and no grant terms.
      const listed = yield* reviewer.ClaimReview.list(claimId, asHuman(cast.reviewer));
      const streamed = yield* reviewer.ClaimReview.events(claimId, asHuman(cast.reviewer)).pipe(
        Stream.take(3),
        Stream.runCollect,
      );
      for (const read of [listed.entries, streamed]) {
        const text = yield* encodeJson(read);
        expect(text).toContain(`"grants":[{"grant":"${grantIdOf(cast.reviewer, PartyReview)}"`);
        // As keys: a generated quote or name may hold these words as text.
        expect(text).not.toContain('"capability":');
        expect(text).not.toContain('"operations":');
        expect(text).not.toContain('"resource":');
      }

      // The directory query refuses an org without a read grant; `atLeast` waits for the projection.
      const text = searchText(cast);
      const orgRows = yield* reviewer.FindParties(
        { org: cast.org, text },
        { ...asHuman(cast.reviewer), atLeast: registered },
      );
      expect(A.map(orgRows.entries, (row) => row.partyId)).toEqual(partiesInOrder(cast));
      const otherRows = yield* reviewer.FindParties(
        { org: cast.otherOrg, text },
        { ...asHuman(cast.outsider), atLeast: registered },
      );
      expect(otherRows.entries).toEqual([]);
      const refusedSearch = yield* reviewer
        .FindParties({ org: cast.org, text }, { ...asHuman(cast.outsider), atLeast: registered })
        .pipe(Effect.flip);
      expect(refusedSearch._tag).toBe("MissingGrant");
    }).pipe(Effect.scoped, inWorld),
  runs(5),
);

it.live.prop(
  "the contract client, with no model in its closure, drives the hosted model over the Api's wire",
  [Cast],
  ([cast]) =>
    Effect.gen(function* () {
      yield* grantsIssued(cast);
      const intake = yield* IntakeApi.clientInProcess;
      const asserted = yield* intake.AssertClaim(cast.claim, assertionOf(cast), asHuman(cast.intake));
      // The contract's client speaks the ReviewerApi's group, served in process by the real Api.
      const reviewer = yield* contractClient(ReviewerContract.client, Domain.protocolInProcess(ReviewerApi));
      const pending = yield* reviewer.ClaimReview.get(cast.claim, { ...asHuman(cast.reviewer), atLeast: asserted });
      expect(pending).toMatchObject({ _tag: "Pending", org: cast.org, sources: A.length(cast.signals) });
      const refused = yield* reviewer.AcceptClaim(cast.claim, {}, asHuman(cast.intake)).pipe(Effect.flip);
      // A rejection decodes to the contract's class: the same class the model declares.
      expect(refused).toMatchObject({ _tag: "MissingGrant", operation: "AcceptClaim" });
      const accepted = yield* reviewer.AcceptClaim(cast.claim, {}, asHuman(cast.reviewer));
      expect(accepted.stream).toBe(claimStream(cast.claim));
    }).pipe(Effect.scoped, inWorld),
  runs(20),
);

it.live.prop(
  "an agent run with no accountable human is refused at the boundary",
  [Cast],
  ([cast]) =>
    Effect.gen(function* () {
      const agent = yield* contractClient(AgentContract.client, Domain.protocolInProcess(AgentApi));
      const refused = yield* agent
        .ProposeDisposition(
          cast.claim,
          { disposition: "accept", rationale: cast.rationale, evidenceRevision: 1 },
          asAgent(cast.orphanRun),
        )
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "Unaccountable", run: cast.orphanRun });
    }).pipe(Effect.scoped, inWorld),
  runs(100),
);

it.live.prop(
  "two models on one InMemory share it, but merging both hosted Layers hands a Party Api the wrong model",
  [Cast],
  ([cast]) => {
    // Build a reviewer client and accept a claim nobody asserted, all inside one exit.
    // The layer is built inside the exit, so a model that dies building its protocol is observed too.
    const acceptUnder = <E, R>(layer: Layer.Layer<Layer.Success<typeof PartyWorld> | Layer.Success<typeof Session>, E, R>) =>
      Effect.scoped(
        Effect.gen(function* () {
          const context = yield* Layer.build(layer);
          return yield* Effect.gen(function* () {
            const reviewer = yield* ReviewerApi.clientInProcess;
            return yield* reviewer.AcceptClaim(cast.claim, {}, asHuman(cast.reviewer));
          }).pipe(Effect.provideContext(context));
        }),
      ).pipe(Effect.exit);
    return Effect.gen(function* () {
      // Scoped: the Party model alone meets its Api, and decides (a typed rejection).
      const scoped = yield* acceptUnder(Layer.mergeAll(PartyWorld, Session));
      expect(scoped).toMatchObject({ _tag: "Failure", cause: { reasons: [{ _tag: "Fail", error: { _tag: "ClaimNotPending" } }] } });
      // Merged at the top: the authority model's `Model.Internals` wins the single service key,
      // and the Party Api dies building its in-process protocol.
      const merged = yield* acceptUnder(Layer.mergeAll(PartyWorld, AuthorityWorld, Session));
      expect(merged).toMatchObject({
        _tag: "Failure",
        cause: { reasons: [{ _tag: "Die", defect: { _tag: "DefinitionError" } }] },
      });
      expect(String(Exit.isFailure(merged) ? merged.cause : "")).toContain("AcceptClaim is served, but no hosted aggregate handles it");
    });
  },
  runs(100),
);
