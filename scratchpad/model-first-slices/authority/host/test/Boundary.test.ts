import * as Domain from "@alchemy.run/domain";
import { expect, it } from "@effect/vitest";
import { IssueGrant } from "@proto/authority-contract/Grant/IssueGrant.command";
import { RevokeGrant } from "@proto/authority-contract/Grant/RevokeGrant.command";
import { AuthorityGateway } from "@proto/authority-contract/Authority.gateway";
import { AuthorityGatewayLive } from "@proto/authority-host/AuthorityGateway.adapter";
import { Boundary, BoundaryLive, bootstrap } from "@proto/authority-host/Boundary/Boundary";
import { Credential, headersFor, read } from "@proto/authority-host/Boundary/FixtureCredential";
import { hostAuthority } from "@proto/authority-host/Host";
import { SessionLive } from "@proto/authority-host/Session.adapter";
import { AuthorityApi } from "@proto/authority-model/AuthorityApi.api";
import { RunDelegations } from "@proto/authority-model/Delegation/RunDelegations.view";
import { Grant } from "@proto/authority-model/Grant/Grant.aggregate";
import { HolderGrants } from "@proto/authority-model/Grant/HolderGrants.view";
import { allows, Capability, CapabilityGrant, type GrantTerms, inForce, ResourceScope, widens } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { CapabilityId, DelegationId, GrantId, OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { GrantRef, Hop, Provenance, Root } from "@proto/kernel/Invocation";
import { Count, IdText, Name } from "@proto/kernel/Measure";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import { thunkTrue } from "@beep/utils/thunk";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Schedule from "effect/Schedule";
import type * as Scope from "effect/Scope";

// The trusted boundary's laws, held over generated grants and delegations. Each run hosts a fresh
// authority model in memory, with the real Session middleware, boundary and gateway in front of
// it, and builds the scene through them. What the boundary admits is then known by construction.
// A hosted run takes a few milliseconds, so each law keeps the default of 100 runs.

const Hosted = hostAuthority(Domain.InMemory);
const World = Layer.mergeAll(SessionLive, BoundaryLive, AuthorityGatewayLive).pipe(Layer.provideMerge(Hosted));

// ---------------------------------------------------------------------------------------------
// The scene's building blocks.

/** An index into one of the scene's pools of three. */
const Pick = S.Literals([0, 1, 2]);
/** How long terms last, in whole minutes after the law's start: up to about ten years. */
const Lifetime = S.Int.check(S.isBetween({ minimum: 1, maximum: 5_256_000 }));
/** When the boundary is asked, in whole minutes after the law's start: up to about twenty years. */
const Ahead = S.Int.check(S.isBetween({ minimum: 0, maximum: 10_512_000 }));

const distinct = <A>(values: ReadonlyArray<A>) => A.length(A.dedupe(values)) === A.length(values);

/** The orgs, capabilities, operations and records a scene's terms are drawn from. */
const Pools = S.Struct({
  orgs: S.Tuple([OrgId, OrgId, OrgId]),
  capabilities: S.Tuple([CapabilityId, CapabilityId, CapabilityId]),
  operations: S.Tuple([Name, Name, Name]),
  records: S.Tuple([S.Struct({ aggregate: Name, id: IdText }), S.Struct({ aggregate: Name, id: IdText }), S.Struct({ aggregate: Name, id: IdText })]),
});
type Pools = typeof Pools.Type;

/** Terms, as picks from the pools: a capability, maybe some operations, an org or a record in it, maybe an expiry. */
const TermsSpec = S.Struct({
  capability: Pick,
  operations: S.Option(S.Array(Pick).check(S.isMaxLength(3))),
  org: Pick,
  record: S.Option(Pick),
  lifetime: S.Option(Lifetime),
});
type TermsSpec = typeof TermsSpec.Type;

/** The owner who bootstraps each org, the human who holds grants, and a stranger who holds others. */
const People = S.Struct({ owner: PrincipalId, holder: PrincipalId, stranger: PrincipalId });

const minutesAfter = (start: DateTime.Utc, minutes: number) => DateTime.add(start, { minutes });

const termsOf = (pools: Pools, start: DateTime.Utc) => (spec: TermsSpec): GrantTerms => {
  const org = pools.orgs[spec.org];
  return {
    capability: pools.capabilities[spec.capability],
    operations: O.map(spec.operations, A.map((pick) => pools.operations[pick])),
    resource: O.match(spec.record, {
      onNone: () => ResourceScope.cases.Org.make({ org }),
      onSome: (pick) => ResourceScope.cases.Record.make({ org, record: `${pools.records[pick].aggregate}/${pools.records[pick].id}` }),
    }),
    expires: O.map(spec.lifetime, (minutes) => minutesAfter(start, minutes)),
  };
};

/** The earlier of two optional expiries; none only when both are none. */
const earliest = (a: O.Option<DateTime.Utc>, b: O.Option<DateTime.Utc>) =>
  O.firstSomeOf([O.zipWith(a, b, (x, y) => DateTime.min(x, y)), a, b]);

/** How terms narrow their parent's: operations kept by position, a record of an org, an earlier expiry. */
const Narrower = S.Struct({ keep: S.Array(S.Boolean), record: S.Option(Pick), lifetime: S.Option(Lifetime) });
type Narrower = typeof Narrower.Type;

/** A delegation of a grant: its id, the run it goes to, how it narrows the grant, and whether its delegator revokes it. */
const Narrowing = S.Struct({ id: DelegationId, toOther: S.Boolean, ...Narrower.fields, revoked: S.Boolean });

const narrowed = (pools: Pools, start: DateTime.Utc) => (parent: GrantTerms, narrowing: Narrower): GrantTerms => ({
  capability: parent.capability,
  operations: O.map(parent.operations, A.filter((_, index) => O.getOrElse(A.get(narrowing.keep, index), () => true))),
  resource: ResourceScope.match(parent.resource, {
    Org: ({ org }) =>
      O.match(narrowing.record, {
        onNone: () => parent.resource,
        onSome: (pick) => ResourceScope.cases.Record.make({ org, record: `${pools.records[pick].aggregate}/${pools.records[pick].id}` }),
      }),
    Record: () => parent.resource,
  }),
  expires: earliest(parent.expires, O.map(narrowing.lifetime, (minutes) => minutesAfter(start, minutes))),
});

/** A ref a provenance names: a grant of the scene's (or one nobody issued), and maybe a delegation (or one nobody opened). */
const NamedRef = S.Struct({ grant: Count, delegation: S.Option(Count) });

/**
 * What a principal and two runs hold: grants issued to the holder or the stranger, some revoked,
 * each delegated (narrower) to the run or the other run, some of those revoked; then a provenance
 * naming refs, an agent root naming the holder or the stranger as accountable, whether the
 * holder released the run, and the time the boundary is asked at.
 */
const Holdings = S.Struct({
  people: People,
  runs: S.Struct({ run: RunId, other: RunId }),
  pools: Pools,
  grants: S.Array(
    S.Struct({
      id: GrantId,
      toStranger: S.Boolean,
      terms: TermsSpec,
      revoked: S.Boolean,
      delegations: S.Array(Narrowing).check(S.isMaxLength(3)),
    }),
  ).check(S.isMaxLength(4)),
  unknown: S.Struct({ grant: GrantId, delegation: DelegationId }),
  named: S.Array(NamedRef).check(S.isMaxLength(4)),
  chain: S.Array(Hop).check(S.isMaxLength(2)),
  hop: Hop,
  accountableIsHolder: S.Boolean,
  released: S.Boolean,
  at: Ahead,
}).check(
  S.makeFilter(
    ({ people, runs: { run, other }, grants, unknown }) =>
      distinct([people.owner, people.holder, people.stranger]) &&
      distinct([run, other]) &&
      distinct([unknown.grant, ...A.map(grants, (held) => held.id)]) &&
      distinct([unknown.delegation, ...A.flatMap(grants, (held) => A.map(held.delegations, (narrowing) => narrowing.id))]),
    {
      identifier: "HoldingsCheck",
      title: "Holdings",
      description: "The people are distinct, the runs are distinct, and every grant and delegation id names one instance.",
      message: "Expected distinct people, runs, grant ids and delegation ids",
    },
  ),
);
type Holdings = typeof Holdings.Type;

// ---------------------------------------------------------------------------------------------
// Building the scene through the hosted model.

const asHuman = (principal: PrincipalId) => ({ headers: headersFor(Credential.cases.Human.make({ principal })) });
const asAgent = (run: RunId) => ({ headers: headersFor(Credential.cases.Agent.make({ run })) });
const sameMembers = <A>(actual: ReadonlyArray<A>, expected: ReadonlyArray<A>) =>
  A.length(A.difference(actual, expected)) === 0 && A.length(A.difference(expected, actual)) === 0;

/** Wait until an index lists exactly `expected` (a view is an index, eventually consistent). */
const listed = <S>(get: Effect.Effect<O.Option<S>>, items: (state: S) => ReadonlyArray<string>, expected: ReadonlyArray<string>) =>
  get.pipe(
    Effect.repeat({
      schedule: Schedule.spaced("10 millis"),
      until: (state) => sameMembers(O.match(state, { onNone: A.empty<string>, onSome: items }), expected),
      times: 200,
    }),
  );

const grantsListed = (principal: PrincipalId, expected: ReadonlyArray<GrantId>) =>
  Effect.flatMap(Effect.service(HolderGrants), (view) => listed(Effect.orDie(view.get(principal)), (state) => state.grants, expected));

const delegationsListed = (run: RunId, expected: ReadonlyArray<DelegationId>) =>
  Effect.flatMap(Effect.service(RunDelegations), (view) => listed(Effect.orDie(view.get(run)), (state) => state.delegations, expected));

/** Issue, list, delegate, answer for both runs, then revoke: the order a real org would. */
const establish = Effect.fnUntraced(function* (scene: Holdings, start: DateTime.Utc) {
  const { owner, holder, stranger } = scene.people;
  const grants = yield* Grant;
  const authority = yield* AuthorityApi.clientInProcess;
  const asOwner = (terms: GrantTerms) => Effect.provideService(CurrentInvocation, bootstrap(owner, terms.resource.org));
  const issued = A.map(scene.grants, (held) => ({
    held,
    holder: held.toStranger ? stranger : holder,
    terms: termsOf(scene.pools, start)(held.terms),
  }));
  const delegated = A.flatMap(issued, (parent) =>
    A.map(parent.held.delegations, (narrowing) => ({
      narrowing,
      parent,
      run: narrowing.toOther ? scene.runs.other : scene.runs.run,
      terms: narrowed(scene.pools, start)(parent.terms, narrowing),
    })),
  );
  const heldBy = (principal: PrincipalId) => A.filterMap(issued, (grant) => (grant.holder === principal ? Result.succeed(grant.held.id) : Result.failVoid));
  const heldByRun = (run: RunId) => A.filterMap(delegated, (entry) => (entry.run === run ? Result.succeed(entry.narrowing.id) : Result.failVoid));

  yield* Effect.forEach(issued, ({ held, holder: to, terms }) => grants.send(held.id, IssueGrant.make({ holder: to, terms })).pipe(asOwner(terms)), { concurrency: 1, discard: true });
  yield* grantsListed(holder, heldBy(holder));
  yield* grantsListed(stranger, heldBy(stranger));
  yield* Effect.forEach(
    delegated,
    ({ narrowing, parent, run, terms }) =>
      authority.DelegateGrant(parent.held.id, { delegation: narrowing.id, to: run, terms }, asHuman(parent.holder)),
    { concurrency: 1, discard: true },
  );
  yield* delegationsListed(scene.runs.run, heldByRun(scene.runs.run));
  yield* delegationsListed(scene.runs.other, heldByRun(scene.runs.other));
  // The holder answers for the run; the stranger for the other run.
  yield* authority.AssignAccountability(scene.runs.run, {}, asHuman(holder));
  yield* authority.AssignAccountability(scene.runs.other, {}, asHuman(stranger));
  // Revocations count at once: nothing below waits for an index.
  yield* Effect.forEach(
    A.filter(delegated, (entry) => entry.narrowing.revoked),
    ({ narrowing, parent }) => authority.RevokeDelegation(narrowing.id, {}, asHuman(parent.holder)),
    { concurrency: 1, discard: true },
  );
  yield* Effect.forEach(
    A.filter(issued, (grant) => grant.held.revoked),
    ({ held, terms }) => grants.send(held.id, RevokeGrant.make({})).pipe(asOwner(terms)),
    { concurrency: 1, discard: true },
  );
  return { issued, delegated };
});
type Established = Effect.Success<ReturnType<typeof establish>>;

/** The grants a human holds in force at `at`, as the boundary must carry them. */
const inForceFor = ({ issued }: Established, principal: PrincipalId, at: DateTime.Utc) =>
  A.filterMap(issued, ({ held, holder, terms }) =>
    holder === principal && !held.revoked && inForce(terms, at)
      ? Result.succeed(CapabilityGrant.make({ grant: held.id, delegation: O.none(), ...terms }))
      : Result.failVoid,
  );

/** The delegations a run holds in force at `at`: open, its parent active, both unexpired. */
const delegatedInForce = ({ delegated }: Established, run: RunId, at: DateTime.Utc) =>
  A.filterMap(delegated, ({ narrowing, parent, run: to, terms }) =>
    to === run && !narrowing.revoked && !parent.held.revoked && inForce(terms, at) && inForce(parent.terms, at)
      ? Result.succeed(CapabilityGrant.make({ grant: parent.held.id, delegation: O.some(narrowing.id), ...terms }))
      : Result.failVoid,
  );

/** The refs a scene's provenance names, resolved against its grants and delegations. */
const namedRefs = (scene: Holdings) => {
  const grantIds = A.append(A.map(scene.grants, (held) => held.id), scene.unknown.grant);
  const delegationIds = A.append(
    A.flatMap(scene.grants, (held) => A.map(held.delegations, (narrowing) => narrowing.id)),
    scene.unknown.delegation,
  );
  const pick = <Id>(ids: A.NonEmptyReadonlyArray<Id>, index: number) => ids[index % ids.length] ?? A.headNonEmpty(ids);
  return A.map(scene.named, (ref) =>
    GrantRef.make({ grant: pick(grantIds, ref.grant), delegation: O.map(ref.delegation, (index) => pick(delegationIds, index)) }),
  );
};

/** Run a law against a fresh hosted world of its own, so one run's records never meet another's. */
const lifted = <A, E>(effect: Effect.Effect<A, E, Layer.Success<typeof World> | Scope.Scope>) =>
  Layer.build(World).pipe(Effect.flatMap((world) => Effect.provideContext(effect, world)), Effect.scoped);

// ---------------------------------------------------------------------------------------------
// The laws.

it.prop("a credential reads back from the headers it is sent in", [Credential], ([credential]) => {
  expect(read(Headers.fromInput(headersFor(credential)))).toEqual(O.some(credential));
});

it.prop(
  "any authorization header reads as a well-formed credential or as none, never as a defect",
  [S.Literals(["human", "agent", "process"]), S.String, S.String],
  ([kind, subject, raw]) => {
    for (const authorization of [`Fixture ${kind}:${subject}`, raw]) {
      expect(O.match(read(Headers.fromInput({ authorization })), { onNone: thunkTrue, onSome: S.is(Credential) })).toBe(true);
    }
  },
);

it.live.prop(
  "an agent with no live accountable human is refused at the boundary",
  [S.Struct({ run: RunId, human: PrincipalId, released: S.Boolean })],
  ([{ run, human, released }]) =>
    lifted(
      Effect.gen(function* () {
        const authority = yield* AuthorityApi.clientInProcess;
        const boundary = yield* Boundary;
        // Unassigned, or assigned and then released by its human: either way nobody answers for it.
        if (released) {
          yield* authority.AssignAccountability(run, {}, asHuman(human));
          yield* authority.ReleaseAccountability(run, {}, asHuman(human));
        }
        const refused = yield* authority.AssignAccountability(run, {}, asAgent(run)).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "Unaccountable", run });
        const now = yield* DateTime.now;
        const admitted = yield* Effect.flip(boundary.admit(Credential.cases.Agent.make({ run }), now));
        expect(admitted).toMatchObject({ _tag: "Unaccountable", run });
        const anonymous = yield* authority.AssignAccountability(run).pipe(Effect.flip);
        expect(anonymous._tag).toBe("Unauthorized");
      }),
    ),
);

it.live.prop(
  "the boundary admits exactly what is in force: a human's own active, unexpired grants; a run's open delegations of them, while a human answers for it",
  [Holdings],
  ([scene]) =>
    lifted(
      Effect.gen(function* () {
        const start = yield* DateTime.now;
        const boundary = yield* Boundary;
        const authority = yield* AuthorityApi.clientInProcess;
        const held = yield* establish(scene, start);
        const at = minutesAfter(start, scene.at);
        const { holder, stranger } = scene.people;
        const { run, other } = scene.runs;

        for (const principal of [holder, stranger]) {
          const admitted = yield* boundary.admit(Credential.cases.Human.make({ principal }), at);
          expect(admitted.root).toEqual(Root.cases.Human.make({ principal }));
          expect(admitted.onBehalfOf).toBe(principal);
          expect(admitted.chain).toEqual([]);
          expect(sameMembers(admitted.grants, inForceFor(held, principal, at))).toBe(true);
        }
        // Each run gets an agent root naming the human who answers for it, and only its own delegations.
        for (const [agentRun, answerer] of [[run, holder], [other, stranger]] as const) {
          const admitted = yield* boundary.admit(Credential.cases.Agent.make({ run: agentRun }), at);
          expect(admitted.root).toEqual(Root.cases.Agent.make({ run: agentRun, accountable: answerer }));
          expect(admitted.onBehalfOf).toBe(answerer);
          expect(admitted.chain).toEqual([]);
          expect(sameMembers(admitted.grants, delegatedInForce(held, agentRun, at))).toBe(true);
        }

        // Released: the boundary refuses the run again.
        yield* authority.ReleaseAccountability(run, {}, asHuman(holder));
        const refused = yield* boundary.admit(Credential.cases.Agent.make({ run }), at).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "Unaccountable", run });
      }),
    ),
);

it.live.prop(
  "re-admission of a human's provenance never adds a grant it did not name, drops what lapsed, and refuses when all lapsed",
  [Holdings],
  ([scene]) =>
    lifted(
      Effect.gen(function* () {
        const start = yield* DateTime.now;
        const boundary = yield* Boundary;
        const held = yield* establish(scene, start);
        const at = minutesAfter(start, scene.at);
        const { holder } = scene.people;
        const named = namedRefs(scene);
        const provenance = Provenance.make({ root: Root.cases.Human.make({ principal: holder }), onBehalfOf: holder, grants: named, chain: scene.chain });
        // A human holds grants directly: a named delegation, another principal's grant or a lapsed one is not live.
        const live = A.flatMap(named, (ref) =>
          O.isSome(ref.delegation) ? [] : A.filter(inForceFor(held, holder, at), (grant) => grant.grant === ref.grant),
        );
        const readmitted = yield* boundary.readmit(provenance, scene.hop, at).pipe(Effect.result);
        if (A.isReadonlyArrayNonEmpty(named) && A.isReadonlyArrayEmpty(live)) {
          expect(readmitted).toEqual(Result.fail(expect.objectContaining({ _tag: "ReadmissionRefused", reason: "lapsed", lapsed: named })));
        } else {
          expect(readmitted).toEqual(
            Result.succeed({ root: provenance.root, onBehalfOf: holder, grants: live, chain: A.append(scene.chain, scene.hop) }),
          );
        }
      }),
    ),
);

it.live.prop(
  "re-admission of a run's provenance re-checks its accountable human and keeps only the named delegations in force",
  [Holdings],
  ([scene]) =>
    lifted(
      Effect.gen(function* () {
        const start = yield* DateTime.now;
        const boundary = yield* Boundary;
        const authority = yield* AuthorityApi.clientInProcess;
        const held = yield* establish(scene, start);
        const at = minutesAfter(start, scene.at);
        const { holder, stranger } = scene.people;
        const { run } = scene.runs;
        if (scene.released) yield* authority.ReleaseAccountability(run, {}, asHuman(holder));
        const named = namedRefs(scene);
        const provenance = Provenance.make({
          root: Root.cases.Agent.make({ run, accountable: scene.accountableIsHolder ? holder : stranger }),
          onBehalfOf: holder,
          grants: named,
          chain: scene.chain,
        });
        // A run holds grants only through its delegations, each as the pair the provenance named.
        const live = A.flatMap(named, (ref) =>
          A.filter(
            delegatedInForce(held, run, at),
            (grant) => grant.grant === ref.grant && Equal.equals(grant.delegation, ref.delegation),
          ),
        );
        const readmitted = yield* boundary.readmit(provenance, scene.hop, at).pipe(Effect.result);
        if (scene.released || !scene.accountableIsHolder) {
          expect(readmitted).toEqual(Result.fail(expect.objectContaining({ _tag: "ReadmissionRefused", reason: "unaccountable" })));
        } else if (A.isReadonlyArrayNonEmpty(named) && A.isReadonlyArrayEmpty(live)) {
          expect(readmitted).toEqual(Result.fail(expect.objectContaining({ _tag: "ReadmissionRefused", reason: "lapsed", lapsed: named })));
        } else {
          expect(readmitted).toEqual(
            Result.succeed({ root: provenance.root, onBehalfOf: holder, grants: live, chain: A.append(scene.chain, scene.hop) }),
          );
        }
      }),
    ),
);

/** Terms a run asks for: narrowed from what it asks of, or (when given) any terms at all. */
const Asked = S.Struct({ narrower: Narrower, free: S.Option(TermsSpec) });

/** A need to probe terms with: picks from the pools, and when it is asked. */
const Probe = S.Struct({ capability: Pick, operation: Pick, org: Pick, record: S.Option(Pick), at: Ahead, description: S.String });

/**
 * A human asks the gateway to grant a run part of a grant they hold; the run then asks for part of
 * that for a child run, under a fresh delegation id or the one its own delegation already has.
 */
const Request = S.Struct({
  people: People,
  runs: S.Struct({ run: RunId, child: RunId }),
  pools: Pools,
  grant: GrantId,
  parent: TermsSpec,
  delegations: S.Struct({ run: DelegationId, child: DelegationId }),
  terms: Asked,
  childTerms: Asked,
  reuse: S.Boolean,
  hop: Hop,
  probe: Probe,
}).check(
  S.makeFilter(
    ({ people, runs: { run, child }, delegations }) =>
      distinct([people.owner, people.holder, people.stranger]) && distinct([run, child]) && distinct([delegations.run, delegations.child]),
    {
      identifier: "RunRequestCheck",
      title: "Run request",
      description: "The people are distinct, the runs are distinct, and the two delegation ids are distinct.",
      message: "Expected distinct people, runs and delegation ids",
    },
  ),
);

it.live.prop(
  "a run is granted only narrower terms under an agent provenance; a run's grant never reaches what its parent does not; a released run is unaccountable",
  [Request],
  ([request]) =>
    lifted(
      Effect.gen(function* () {
        const start = yield* DateTime.now;
        const grants = yield* Grant;
        const gateway = yield* AuthorityGateway;
        const authority = yield* AuthorityApi.clientInProcess;
        const { owner, holder } = request.people;
        const { run, child } = request.runs;
        const toTerms = termsOf(request.pools, start);
        // Only expiries ahead of now: what is asked for is in force now, so re-admission shows it.
        const parent = toTerms(request.parent);
        const ask = (of: GrantTerms, asked: typeof Asked.Type) =>
          O.match(asked.free, { onNone: () => narrowed(request.pools, start)(of, asked.narrower), onSome: toTerms });
        const terms = ask(parent, request.terms);
        const childTerms = ask(terms, request.childTerms);
        yield* grants
          .send(request.grant, IssueGrant.make({ holder, terms: parent }))
          .pipe(Effect.provideService(CurrentInvocation, bootstrap(owner, parent.resource.org)));
        yield* grantsListed(holder, [request.grant]);

        const requester = Provenance.make({
          root: Root.cases.Human.make({ principal: holder }),
          onBehalfOf: holder,
          grants: [GrantRef.make({ grant: request.grant, delegation: O.none() })],
          chain: [],
        });
        const asking = {
          provenance: requester,
          hop: request.hop,
          source: GrantRef.make({ grant: request.grant, delegation: O.none() }),
          delegation: request.delegations.run,
          run,
          terms,
        };
        const granted = yield* gateway.grantRun(asking).pipe(Effect.result);
        if (O.isSome(widens(parent, terms))) {
          expect(granted).toEqual(Result.fail(expect.objectContaining({ _tag: "RunGrantRefused", reason: "TermsWiden" })));
          return;
        }
        expect(Result.isSuccess(granted)).toBe(true);
        if (Result.isFailure(granted)) return;
        const { provenance } = granted.success;
        expect(provenance).toEqual({
          root: Root.cases.Agent.make({ run, accountable: holder }),
          onBehalfOf: holder,
          grants: [GrantRef.make({ grant: request.grant, delegation: O.some(request.delegations.run) })],
          chain: [],
        });
        // The run's provenance re-admits to exactly its delegation's terms.
        const asRun = yield* gateway.readmit({ provenance, hop: request.hop });
        const held = CapabilityGrant.make({ grant: request.grant, delegation: O.some(request.delegations.run), ...terms });
        expect(asRun.grants).toEqual([held]);
        // The same request again, as a redelivered trigger sends it, is granted the same.
        const again = yield* gateway.grantRun(asking);
        expect(again).toEqual(granted.success);
        // Whatever the run's grant allows, its parent allows.
        const { probe } = request;
        const need = {
          capability: Capability.make({
            id: request.pools.capabilities[probe.capability],
            operations: [request.pools.operations[probe.operation]],
            description: probe.description,
          }),
          operation: request.pools.operations[probe.operation],
          resource: termsOf(request.pools, start)({ ...request.parent, org: probe.org, record: probe.record }).resource,
          at: minutesAfter(start, probe.at),
        };
        if (allows(need)(held)) expect(allows(need)(CapabilityGrant.make({ grant: request.grant, delegation: O.none(), ...parent }))).toBe(true);

        // The run passes part of its delegation to a child run: only narrower, and never under an id already open.
        const childDelegation = request.reuse ? request.delegations.run : request.delegations.child;
        const further = yield* gateway
          .grantRun({
            provenance,
            hop: request.hop,
            source: GrantRef.make({ grant: request.grant, delegation: O.some(request.delegations.run) }),
            delegation: childDelegation,
            run: child,
            terms: childTerms,
          })
          .pipe(Effect.result);
        if (request.reuse) {
          expect(further).toEqual(Result.fail(expect.objectContaining({ _tag: "RunGrantRefused" })));
        } else if (O.isSome(widens(terms, childTerms))) {
          expect(further).toEqual(Result.fail(expect.objectContaining({ _tag: "RunGrantRefused", reason: "TermsWiden" })));
        } else {
          expect(Result.isSuccess(further)).toBe(true);
          if (Result.isSuccess(further)) {
            const asChild = yield* gateway.readmit({ provenance: further.success.provenance, hop: request.hop });
            expect(asChild.grants).toEqual([CapabilityGrant.make({ grant: request.grant, delegation: O.some(childDelegation), ...childTerms })]);
          }
        }

        // Released: the run's next hop is refused as unaccountable.
        yield* authority.ReleaseAccountability(run, {}, asHuman(holder));
        const refused = yield* gateway.readmit({ provenance, hop: request.hop }).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "ReadmissionRefused", reason: "unaccountable" });
      }),
    ),
);
