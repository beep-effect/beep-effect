import * as Domain from "@alchemy.run/domain";
import { expect, it } from "@effect/vitest";
import { IssueGrant } from "@proto/authority-contract/Grant/IssueGrant.command";
import { RevokeGrant } from "@proto/authority-contract/Grant/RevokeGrant.command";
import { AuthorityGateway } from "@proto/authority-contract/Authority.gateway";
import { AuthorityGatewayLive } from "@proto/authority-host/AuthorityGateway.adapter";
import { Boundary, BoundaryLive, bootstrap } from "@proto/authority-host/Boundary/Boundary";
import { Credential, headersFor } from "@proto/authority-host/Boundary/FixtureCredential";
import { hostAuthority } from "@proto/authority-host/Host";
import { SessionLive } from "@proto/authority-host/Session.adapter";
import { AuthorityApi } from "@proto/authority-model/AuthorityApi.api";
import { RunDelegations } from "@proto/authority-model/Delegation/RunDelegations.view";
import { Grant } from "@proto/authority-model/Grant/Grant.aggregate";
import { ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { CapabilityId, DelegationId, GrantId, OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { byProcess, Cause, GrantRef, Provenance, Root } from "@proto/kernel/Invocation";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";

// The authority model in memory, with the real Session middleware and boundary in front of it.
const Hosted = hostAuthority(Domain.InMemory);
const World = Layer.mergeAll(SessionLive, BoundaryLive, AuthorityGatewayLive).pipe(Layer.provideMerge(Hosted));

const acme = OrgId.make("org_acme");
const rev = PrincipalId.make("p_rev");
const run = RunId.make("run_1");
const asRev = { headers: headersFor(Credential.cases.Human.make({ principal: rev })) };
const asAgent = (agentRun: RunId) => ({ headers: headersFor(Credential.cases.Agent.make({ run: agentRun })) });
const admit = (credential: Credential) =>
  Effect.flatMap(Effect.service(Boundary), (boundary) => Effect.flatMap(DateTime.now, (now) => boundary.admit(credential, now)));

/** Issue the reviewer a review grant on acme, as the org's owner at bootstrap. */
const seed = Effect.gen(function* () {
  const grants = yield* Grant;
  yield* grants
    .send(
      GrantId.make("g_rev"),
      IssueGrant.make({
        holder: rev,
        terms: {
          capability: CapabilityId.make("party.review"),
          operations: O.none(),
          resource: ResourceScope.cases.Org.make({ org: acme }),
          expires: O.none(),
        },
      }),
    )
    .pipe(Effect.provideService(CurrentInvocation, bootstrap(PrincipalId.make("p_owner"), acme)));
});

/** Wait until the run's delegation index lists `count` delegations. */
const delegationsListed = (agentRun: RunId, count: number) =>
  Effect.flatMap(Effect.service(RunDelegations), (view) =>
    view.get(agentRun).pipe(
      Effect.repeat({
        schedule: Schedule.spaced("20 millis"),
        until: (state) => O.match(state, { onNone: () => false, onSome: (s) => s.delegations.length === count }),
        times: 100,
      }),
    ),
  );

it.layer(World, { buildPerTest: true, excludeTestServices: true })((it) => {
  it.effect("an agent with no live accountable human is refused at the boundary", () =>
    Effect.gen(function* () {
      const authority = yield* AuthorityApi.clientInProcess;
      const refused = yield* authority.AssignAccountability(run, {}, asAgent(run)).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "Unaccountable", run });
      const anonymous = yield* authority.AssignAccountability(run).pipe(Effect.flip);
      expect(anonymous._tag).toBe("Unauthorized");
    }).pipe(Effect.scoped),
  );

  it.effect("an agent is admitted with an agent root and only its narrowed delegation, while a human answers for it", () =>
    Effect.gen(function* () {
      yield* seed;
      const authority = yield* AuthorityApi.clientInProcess;
      const narrowed = {
        capability: CapabilityId.make("party.review"),
        operations: O.some(["AcceptClaim"]),
        resource: ResourceScope.cases.Record.make({ org: acme, record: "Claim/claim_1" }),
        expires: O.none(),
      };
      // The reviewer delegates part of the grant to the run, and answers for the run.
      yield* authority.DelegateGrant(
        GrantId.make("g_rev"),
        { delegation: DelegationId.make("d_1"), to: run, terms: narrowed },
        asRev,
      );
      yield* authority.AssignAccountability(run, {}, asRev);
      yield* delegationsListed(run, 1);

      const admitted = yield* admit(Credential.cases.Agent.make({ run }));
      expect(admitted.root).toEqual(Root.cases.Agent.make({ run, accountable: rev }));
      expect(admitted.onBehalfOf).toBe(rev);
      expect(admitted.chain).toEqual([]);
      expect(admitted.grants).toEqual([
        { grant: "g_rev", delegation: O.some("d_1"), ...narrowed },
      ]);

      // Released: the boundary refuses the run again.
      yield* authority.ReleaseAccountability(run, {}, asRev);
      const refused = yield* admit(Credential.cases.Agent.make({ run })).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "Unaccountable", run });
    }).pipe(Effect.scoped),
  );

  it.effect("revoking the parent grant drops its delegation at the boundary at once", () =>
    Effect.gen(function* () {
      yield* seed;
      const authority = yield* AuthorityApi.clientInProcess;
      const second = RunId.make("run_2");
      yield* authority.DelegateGrant(
        GrantId.make("g_rev"),
        {
          delegation: DelegationId.make("d_2"),
          to: second,
          terms: {
            capability: CapabilityId.make("party.review"),
            operations: O.none(),
            resource: ResourceScope.cases.Org.make({ org: acme }),
            expires: O.none(),
          },
        },
        asRev,
      );
      yield* authority.AssignAccountability(second, {}, asRev);
      yield* delegationsListed(second, 1);
      expect((yield* admit(Credential.cases.Agent.make({ run: second }))).grants).toHaveLength(1);

      const grants = yield* Grant;
      yield* grants
        .send(GrantId.make("g_rev"), RevokeGrant.make({}))
        .pipe(Effect.provideService(CurrentInvocation, bootstrap(PrincipalId.make("p_owner"), acme)));
      // The delegation is still listed and still open; its parent is not in force, so it counts for nothing.
      expect((yield* admit(Credential.cases.Agent.make({ run: second }))).grants).toEqual([]);
      // And the reviewer no longer holds it either.
      expect((yield* admit(Credential.cases.Human.make({ principal: rev }))).grants).toEqual([]);
    }).pipe(Effect.scoped),
  );

  it.effect("re-admission rebuilds from live grants: never adds one, drops a revoked one, refuses when all lapsed", () =>
    Effect.gen(function* () {
      const grants = yield* Grant;
      const asOwner = Effect.provideService(CurrentInvocation, bootstrap(PrincipalId.make("p_owner"), acme));
      const issue = (id: string, capability: string) =>
        grants
          .send(
            GrantId.make(id),
            IssueGrant.make({
              holder: rev,
              terms: { capability: CapabilityId.make(capability), operations: O.none(), resource: ResourceScope.cases.Org.make({ org: acme }), expires: O.none() },
            }),
          )
          .pipe(asOwner);
      yield* issue("g_review", "party.review");
      yield* issue("g_read", "party.read");
      const gateway = yield* AuthorityGateway;
      const hop = byProcess("SomePolicy", Cause.cases.Session.make({ scheme: "test" }));
      const named = (...ids: ReadonlyArray<string>) =>
        Provenance.make({
          root: Root.cases.Human.make({ principal: rev }),
          onBehalfOf: rev,
          grants: A.map(ids, (id) => GrantRef.make({ grant: GrantId.make(id), delegation: O.none() })),
          chain: [],
        });
      // Only the named grant comes back, though the reviewer holds two; the hop is appended.
      const one = yield* gateway.readmit({ provenance: named("g_review"), hop });
      expect(A.map(one.grants, (grant) => grant.grant)).toEqual(["g_review"]);
      expect(one.chain).toEqual([hop]);
      yield* grants.send(GrantId.make("g_review"), RevokeGrant.make({})).pipe(asOwner);
      // Revoked: dropped at once; the other named grant still comes back.
      const both = yield* gateway.readmit({ provenance: named("g_review", "g_read"), hop });
      expect(A.map(both.grants, (grant) => grant.grant)).toEqual(["g_read"]);
      // Every named grant lapsed: refused, naming them.
      const refused = yield* gateway.readmit({ provenance: named("g_review"), hop }).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "ReadmissionRefused", reason: "lapsed", lapsed: [{ grant: "g_review" }] });
    }).pipe(Effect.scoped),
  );

  it.effect("a run is granted narrowed terms and an agent provenance; widening is refused; a released run is unaccountable", () =>
    Effect.gen(function* () {
      yield* seed;
      const gateway = yield* AuthorityGateway;
      const hop = byProcess("GrantOnRequest", Cause.cases.Session.make({ scheme: "test" }));
      const requester = Provenance.make({
        root: Root.cases.Human.make({ principal: rev }),
        onBehalfOf: rev,
        grants: [GrantRef.make({ grant: GrantId.make("g_rev"), delegation: O.none() })],
        chain: [],
      });
      const narrowed = {
        capability: CapabilityId.make("party.review"),
        operations: O.some(["AcceptClaim"]),
        resource: ResourceScope.cases.Record.make({ org: acme, record: "Claim/claim_1" }),
        expires: O.none(),
      };
      const source = GrantRef.make({ grant: GrantId.make("g_rev"), delegation: O.none() });
      const granted = yield* gateway.grantRun({
        provenance: requester,
        hop,
        source,
        delegation: DelegationId.make("d_run"),
        run,
        terms: narrowed,
      });
      expect(granted.provenance).toEqual({
        root: { _tag: "Agent", run, accountable: rev },
        onBehalfOf: rev,
        grants: [{ grant: "g_rev", delegation: O.some("d_run") }],
        chain: [],
      });
      // The run's provenance re-admits to exactly its delegation's terms.
      const asRun = yield* gateway.readmit({ provenance: granted.provenance, hop });
      expect(asRun.grants).toEqual([{ grant: "g_rev", delegation: O.some("d_run"), ...narrowed }]);
      // A child of the run cannot widen what the run holds.
      const widened = yield* gateway
        .grantRun({
          provenance: granted.provenance,
          hop,
          source: GrantRef.make({ grant: GrantId.make("g_rev"), delegation: O.some(DelegationId.make("d_run")) }),
          delegation: DelegationId.make("d_child"),
          run: RunId.make("run_child"),
          terms: { ...narrowed, operations: O.none() },
        })
        .pipe(Effect.flip);
      expect(widened).toMatchObject({ _tag: "RunGrantRefused", reason: "TermsWiden" });
      // Released: the run's next hop is refused as unaccountable.
      const authority = yield* AuthorityApi.clientInProcess;
      yield* authority.ReleaseAccountability(run, {}, asRev);
      const refused = yield* gateway.readmit({ provenance: granted.provenance, hop }).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "ReadmissionRefused", reason: "unaccountable" });
    }).pipe(Effect.scoped),
  );
});
