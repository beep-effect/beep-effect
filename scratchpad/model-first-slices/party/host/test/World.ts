import * as Domain from "@alchemy.run/domain";
import { IssueGrant } from "@proto/authority-contract/Grant/IssueGrant.command";
import { AuthorityGatewayLive } from "@proto/authority-host/AuthorityGateway.adapter";
import { bootstrap } from "@proto/authority-host/Boundary/Boundary";
import { Credential, headersFor } from "@proto/authority-host/Boundary/FixtureCredential";
import { hostAuthority } from "@proto/authority-host/Host";
import { SessionLive } from "@proto/authority-host/Session.adapter";
import { Grant } from "@proto/authority-model/Grant/Grant.aggregate";
import { HolderGrants } from "@proto/authority-model/Grant/HolderGrants.view";
import { Capability, ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { GrantId, OrgId, PrincipalId, type RunId } from "@proto/kernel/Ids";
import { PartyFactsFeedLive } from "@proto/party-host/Facts/PartyFactsFeed.adapter";
import { hostParty } from "@proto/party-host/Host";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { RunsGatewayLive } from "@proto/runs-host/RunsGateway.adapter";
import { hostRuns } from "@proto/runs-host/Host";
import { ClaimDecidedInboxLive, ClaimDecidedInboxPoller } from "@proto/runs-host/Inbox/ClaimDecided.inbox";
import { MemoryInboxStore } from "@proto/runs-host/Inbox/Inbox.store";
import { AgentRun, type AgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import { $PartyHostId } from "@proto/kernel/Identity";
import * as A from "@beep/utils/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";

const $I = $PartyHostId.create("test/World");

// Three models on one in-memory platform: the same `Domain.InMemory` value, so one instance.
// Each hosted model reaches the others only through their gateways and the Session.
export const AuthorityWorld = hostAuthority(Domain.InMemory);
export const Gateway = AuthorityGatewayLive.pipe(Layer.provide(AuthorityWorld));
export const Session = SessionLive.pipe(Layer.provide(AuthorityWorld));
export const RunsWorld = hostRuns(Domain.InMemory).pipe(Layer.provide(Gateway));
export const Runs = RunsGatewayLive.pipe(Layer.provide(Layer.merge(RunsWorld, Gateway)));
export const PartyWorld = hostParty(Domain.InMemory, MemoryPartyDirectoryStore).pipe(Layer.provide(Layer.merge(Gateway, Runs)));
// The runs context consumes Party's published facts through its own inbox, polled.
export const PartyFeed = PartyFactsFeedLive.pipe(Layer.provide(PartyWorld));
export const RunsInbox = ClaimDecidedInboxPoller.pipe(
  Layer.provide(ClaimDecidedInboxLive),
  Layer.provide(Layer.mergeAll(RunsWorld, PartyFeed, MemoryInboxStore)),
);

/** A grant to issue: its id, its holder, the capability on an org, and the org's owner who issues it. */
export const GrantToIssue = S.Struct({ id: GrantId, holder: PrincipalId, capability: Capability, org: OrgId, owner: PrincipalId });
/** A grant to issue. */
export type GrantToIssue = typeof GrantToIssue.Type;

/** Test-side access to the authority and runs models, without their `Model.Internals` reaching the Party context. */
export class Access extends Context.Service<
  Access,
  {
    /** Issue a grant on an org as the org's owner, at bootstrap, and wait until the boundary's index lists it. */
    readonly issue: (grant: GrantToIssue) => Effect.Effect<void>;
    /** A run's state, once `until` holds. */
    readonly run: (run: RunId, until: (state: AgentRunState) => boolean) => Effect.Effect<AgentRunState>;
  }
>()($I`Access`) {}

const settled = <S, E>(read: Effect.Effect<S, E>, done: (state: S) => boolean) =>
  read.pipe(Effect.repeat({ schedule: Schedule.spaced("20 millis"), until: done, times: 250 }), Effect.orDie);

const AuthorityAccess = Layer.effect(
  Access,
  Effect.gen(function* () {
    const grants = yield* Grant;
    const holderGrants = yield* HolderGrants;
    const runs = yield* AgentRun;
    return {
      issue: Effect.fn("Access.issue")(({ id, holder, capability, org, owner }: GrantToIssue) =>
        pipe(
          grants.send(
            id,
            IssueGrant.make({
              holder,
              terms: { capability: capability.id, operations: O.none(), resource: ResourceScope.cases.Org.make({ org }), expires: O.none() },
            }),
          ),
          Effect.provideService(CurrentInvocation, bootstrap(owner, org)),
          Effect.andThen(
            settled(holderGrants.get(holder), O.exists((view) => A.contains(view.grants, id))),
          ),
          Effect.asVoid,
          // A grant the owner cannot issue fails the test that asked for it.
          Effect.orDie,
        ),
      ),
      run: Effect.fn("Access.run")((run: RunId, until: (state: AgentRunState) => boolean) => settled(runs.get(run), until)),
    };
  }),
  // Both models' outputs meet only here, where no Api is called in process.
).pipe(Layer.provide(Layer.merge(AuthorityWorld, RunsWorld)));

/**
 * The world an Api test runs in: the Party model (whose internals the Party
 * Apis' in-process clients use), the real Session, the runs context's fact
 * inbox, and test access.
 */
export const World = Layer.mergeAll(Session, AuthorityAccess, RunsInbox).pipe(Layer.provideMerge(PartyWorld));

/** The headers a human presents. */
export const asHuman = (principal: PrincipalId) => ({ headers: headersFor(Credential.cases.Human.make({ principal })) });

/** The headers an agent run presents. */
export const asAgent = (run: RunId) => ({ headers: headersFor(Credential.cases.Agent.make({ run })) });

/**
 * A story in a world of its own: the world is built for the story and closed
 * with it, so one property run never sees another run's claims or grants.
 */
export const inWorld = <A, E, R>(story: Effect.Effect<A, E, R>) =>
  World.pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provideContext(story, context)),
    Effect.scoped,
  );
