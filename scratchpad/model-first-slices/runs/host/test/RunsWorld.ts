import * as InMemory from "@alchemy.run/domain/InMemory";
import { IssueGrant } from "@proto/authority-contract/Grant/IssueGrant.command";
import { RevokeGrant } from "@proto/authority-contract/Grant/RevokeGrant.command";
import { AuthorityGatewayLive } from "@proto/authority-host/AuthorityGateway.adapter";
import { bootstrap } from "@proto/authority-host/Boundary/Boundary";
import { hostAuthority } from "@proto/authority-host/Host";
import { SessionLive } from "@proto/authority-host/Session.adapter";
import { Grant } from "@proto/authority-model/Grant/Grant.aggregate";
import { HolderGrants } from "@proto/authority-model/Grant/HolderGrants.view";
import { type GrantTerms, ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { type FactEnvelope } from "@proto/kernel/Fact";
import { RunId } from "@proto/kernel/Ids";
import { byProcess, Cause, GrantRef, Provenance, Root } from "@proto/kernel/Invocation";
import { PartyFactsFeed } from "@proto/party-contract/Facts/PartyFacts.gateway";
import { hostRuns } from "@proto/runs-host/Host";
import { ClaimDecidedInboxLive } from "@proto/runs-host/Inbox/ClaimDecided.inbox";
import { InboxStore, MemoryInboxStore } from "@proto/runs-host/Inbox/Inbox.store";
import { RunsGatewayLive } from "@proto/runs-host/RunsGateway.adapter";
import { type RunRequestRefused, RunsGateway } from "@proto/runs-contract/Runs.gateway";
import { AgentRun, type AgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import { RunsApi } from "@proto/runs-model/RunsApi.api";
import { $RunsHostId } from "@proto/kernel/Identity";
import * as A from "@beep/utils/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import type { Cast } from "./Cast.ts";

const $I = $RunsHostId.create("test/RunsWorld");

/** Test-side control: the feed the inbox reads, inbox crashes, and the models' state. */
export class Harness extends Context.Service<
  Harness,
  {
    readonly control: InMemory.Control;
    /** Issue the cast's requester its grant on the cast's org, as the org's owner. */
    readonly grant: Effect.Effect<void>;
    /** Revoke the requester's grant, as the org's owner, and with it every delegation of it. */
    readonly revoke: Effect.Effect<void>;
    /** Append envelopes to the feed, numbering them in order. */
    readonly publish: (...facts: ReadonlyArray<Omit<FactEnvelope, "seq">>) => Effect.Effect<void>;
    /** Make the inbox store's next `commit` die, as a crash before the checkpoint would. */
    readonly crashNextCommit: Effect.Effect<void>;
    /** A run's state, once `until` holds. */
    readonly run: (run: string, until: (state: AgentRunState) => boolean) => Effect.Effect<AgentRunState>;
    /** How many events committed on this run. */
    readonly commitsOn: (run: string) => Effect.Effect<number>;
  }
>()($I`Harness`) {}

/** The runs Api's client in process, behind the boundary's `Session`, as a person's client reaches it. */
export class RunsClient extends Context.Service<RunsClient, Effect.Success<typeof RunsApi.clientInProcess>>()($I`RunsClient`) {}

const settled = <S, E>(read: Effect.Effect<S, E>, done: (state: S) => boolean) =>
  read.pipe(Effect.repeat({ schedule: Schedule.spaced("20 millis"), until: done, times: 250 }), Effect.orDie);

/** What `requestRun` returns: the gateway's answer, needing the gateway. */
type Requested = Effect.Effect<{ readonly provenance: Provenance }, RunRequestRefused, RunsGateway>;

/**
 * The runs host stories' world over a generated cast:
 *
 * - `terms`: what a run is granted, the cast's operation on its org;
 * - `asRequester`: the requester's own provenance, as the Session would admit it;
 * - `testHop(step)`: a hop the cast's test process relays, named for its step;
 * - `requestRun(run, historyBound?)`: request a run as the requester, with the cast's whole
 *   ledger as its allowance and its steps' number as its history bound, and wait until it is granted;
 * - `World`: the runs host, the authority host and a fixture feed, on an in-memory platform of its
 *   own, so every build of it starts from nothing; and the runs Api's client behind the boundary.
 */
export const worldOf = (cast: Cast) => {
  const terms: GrantTerms = {
    capability: cast.capability,
    operations: O.some([cast.operation]),
    resource: ResourceScope.cases.Org.make({ org: cast.org }),
    expires: O.none(),
  };
  const source = GrantRef.make({ grant: cast.grant, delegation: O.none() });
  const asRequester = Provenance.make({
    root: Root.cases.Human.make({ principal: cast.principals.requester }),
    onBehalfOf: cast.principals.requester,
    grants: [source],
    chain: [],
  });
  const testHop = (step: string) =>
    byProcess(cast.relay.process, Cause.cases.SagaStep.make({ saga: cast.relay.saga, key: cast.relay.key, step }));
  const asOwner = bootstrap(cast.principals.owner, cast.org);

  const requestRun = (run: RunId, historyBound: number = A.length(cast.steps)): Requested =>
    Effect.flatMap(Effect.service(RunsGateway), (gateway) =>
      gateway.request({
        provenance: asRequester,
        hop: testHop(`request:${run}`),
        run,
        session: cast.session,
        purpose: cast.purpose,
        versions: cast.versions,
        allowance: cast.ledger.used + cast.ledger.unused + cast.ledger.free,
        historyBound,
        source,
        terms,
      }),
    );

  const World = Layer.unwrap(
    Effect.gen(function* () {
      const platform = InMemory.make();
      const AuthorityWorld = hostAuthority(platform.layer);
      const Gateway = AuthorityGatewayLive.pipe(Layer.provide(AuthorityWorld));
      const RunsWorld = hostRuns(platform.layer).pipe(Layer.provide(Gateway));
      const Runs = RunsGatewayLive.pipe(Layer.provide(Layer.merge(RunsWorld, Gateway)));

      const feed = yield* Ref.make<ReadonlyArray<FactEnvelope>>([]);
      const crash = yield* Ref.make(false);
      const Feed = Layer.succeed(PartyFactsFeed, {
        read: Effect.fn("PartyFactsFeed.read")(({ after, take }: { readonly after: number; readonly take: number }) =>
          Effect.map(Ref.get(feed), (facts) => pipe(A.filter(facts, (fact) => fact.seq > after), A.take(take))),
        ),
      });
      // The memory store, with a switch that makes the next commit die.
      const Store = Layer.effect(
        InboxStore,
        Effect.map(Effect.service(InboxStore), (store) => ({
          ...store,
          commit: dual(3, (producer: string, key: O.Option<string>, seq: number) =>
            Effect.flatMap(Ref.getAndSet(crash, false), (crashing) =>
              crashing ? Effect.die("crash before the checkpoint") : store.commit(producer, key, seq),
            ),
          ),
        })),
      ).pipe(Layer.provide(MemoryInboxStore));
      const Inbox = ClaimDecidedInboxLive.pipe(Layer.provide(Layer.mergeAll(RunsWorld, Feed, Store)));

      const Control = Layer.effect(
        Harness,
        Effect.gen(function* () {
          const grants = yield* Grant;
          const holderGrants = yield* HolderGrants;
          const runs = yield* AgentRun;
          const { requester } = cast.principals;
          return {
            control: platform.control,
            grant: pipe(
              grants.send(cast.grant, IssueGrant.make({ holder: requester, terms: { ...terms, operations: O.none() } })),
              Effect.provideService(CurrentInvocation, asOwner),
              Effect.andThen(settled(holderGrants.get(requester), O.exists((view) => A.contains(view.grants, cast.grant)))),
              Effect.asVoid,
              // A grant the owner cannot issue fails the test that asked for it.
              Effect.orDie,
            ),
            revoke: pipe(
              grants.send(cast.grant, RevokeGrant.make({})),
              Effect.provideService(CurrentInvocation, asOwner),
              Effect.asVoid,
              Effect.orDie,
            ),
            publish: Effect.fn("Harness.publish")((...facts: ReadonlyArray<Omit<FactEnvelope, "seq">>) =>
              Ref.update(feed, (current) =>
                A.appendAll(current, A.map(facts, (fact, i) => ({ ...fact, seq: current.length + i + 1 }))),
              ),
            ),
            crashNextCommit: Ref.set(crash, true),
            run: Effect.fn("Harness.run")((run: string, until: (state: AgentRunState) => boolean) =>
              settled(runs.get(RunId.make(run)), until),
            ),
            commitsOn: Effect.fn("Harness.commitsOn")((run: string) =>
              Effect.sync(() => A.filter(platform.control.commits, (commit) => commit.aggregate === "AgentRun" && commit.id === run).length),
            ),
          };
        }),
      ).pipe(Layer.provide(Layer.merge(AuthorityWorld, RunsWorld)));

      // The Api over the same hosted runs model, admitted by the authority host's boundary.
      const Client = Layer.effect(RunsClient, RunsApi.clientInProcess).pipe(
        Layer.provide(Layer.merge(RunsWorld, SessionLive.pipe(Layer.provide(AuthorityWorld)))),
      );

      return Layer.mergeAll(Control, Runs, Inbox, Client);
    }),
  );

  return { terms, asRequester, testHop, requestRun, World };
};
