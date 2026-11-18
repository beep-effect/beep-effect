# Model-First Slices: proposal under review

Status: exploration, 2026-11-13. Not a decision. Nothing in `standards/` has changed.

## What this is

A greenfield redesign of this repo's architecture standard (`standards/ARCHITECTURE.md`) with
`@alchemy.run/domain` (domain-driven design blocks on Effect v4) and Effect Cluster as core
primitives. The question it answers: if that library had existed when the repo began, how would
the architecture have been designed from first principles?

## Ground rules from the repo owner

- No "risk", "cost" or "tradeoff" hedging. The goal is the best architecture for the age of AI.
- What the repo has today, and its past decisions, are evidence about the problem. They are never
  a reason to keep something.
- Agents are first-class: they write the code, call the system and operate it alongside people.
- React stays as the frontend. Foldkit is not adopted; only its story testing pattern is borrowed.
- Effect Cluster is wanted as a first-class primitive.
- Real technical pushback is wanted. Saying an option is worse on the merits is not hedging.

## What has been checked, and what has not

A standalone prototype of one slice (Party) is in this directory (`README.md` has the layout). On
`@alchemy.run/domain` 2.0.0-beta.87 and effect 4.1.4:

- Type-checks: kernel, model, host and app packages (`bun run check`).
- Passes at runtime, in memory: 5 model tests (stories and `Domain.verify`) and 1 Api test through
  `hostParty(Domain.InMemory)` with real Session middleware (`bun run test`).
- Type-level only: the cluster wiring (`apps/practice/src/Cluster.ts`, `src/cluster/*.ts`).
- Not proven: cluster hosting at runtime. Nothing was deployed. An `alchemy plan` of the app stack
  failed while importing the stack and was not investigated.

Places where the proposal's code sketches did not match the real API (see `probes/`):

- A policy handler runs with no request context. A policy that sends a command guarded by the
  Session middleware must provide `CurrentActor` itself, as a System actor.
- A `Domain.ExternalSystem` class is not its own service identifier. The ports union is built from
  `Context.Service.Identifier<typeof X>`.
- The port-purity law works as `satisfies Layer.Layer<never, unknown, PartyPorts | Host>`, where
  `Host = Layer.Success<typeof Domain.InMemory>`; the error names the leaked service.
- A saga `Activity` needs an explicit error schema and cannot return a command receipt as its value.
- `Story.saga(..., { _tag: "Completed" })` needs a `result`.
- A singleton declared by name only cannot be yielded in a stack.

The code blocks in the proposal below are the original sketches. Where they differ from the
prototype, the prototype is right.

## Where to look

- This repo: `standards/ARCHITECTURE.md` (the current binding standard),
  `packages/documents/{domain,use-cases,server}` (the one slice on the library today),
  `.claude/skills/alchemy-domain/` (block templates).
- Upstream source: `~/YeeBois/references/effect/alchemy` (`packages/domain`,
  `packages/effect-cluster`, `examples/cluster-domain`) and `~/YeeBois/references/effect/effect`
  (`packages/platform/cloudflare`, Effect Cluster on Durable Objects).

---

Model-First Slices

beep-effect · architecture exploration · 2026-11-13 · third version

# If the Model had come first

This page designs the architecture standard from `@alchemy.run/domain` and the standard's own principles, for a codebase where agents write, call and operate the system alongside people. What the repo has today is used as evidence about the problem and never as a reason to keep something.

## The short answer

A slice is one bounded context, written down as exactly one `Domain.Model`. A package exists to carry one runtime's dependency closure. Everything that runs is an Effect Cluster class on a pool the app chooses. Agents are actors inside the model, and the aggregate is what keeps them honest.

The current standard already has the right principles. What changes is where the lines fall, because the library turns things the standard describes in prose (a bounded context, a port, a command boundary, a protocol) into values a compiler, a test runner and an agent can inspect.

| Concern | Standard today | This design |
| Unit of architecture | A slice is a "domain-bounded module family"; a model can sit inside one of its folders. | Slice = bounded context = one `Domain.Model`. Slice name is the model name. |
| Packages | Seven per slice, one per architectural role. | Three per slice, one per runtime: model (none), host (server), web (browser). |
| Where purity splits | Across three packages: declarations in domain and use-cases, handlers in server. | Across two files in one folder: `X.policy.ts` and `X.policy.live.ts`. |
| Path grammar | `<domain-kind>/<Concept>/<Concept>.<role>.ts` | `<Subdomain>/<Noun>.<kind>.ts`, where kind is the block's own `kind`. |
| System of record | Entity schema projected to a table; a repo-owned Postgres platform for event-sourced slices. | The event log, hosted on Effect Cluster. The repo owns no platform. Tables exist only as projection stores. |
| Process model | Stateless Layers behind handlers. Effect Cluster appears only inside the platform driver's workflow engine. | Effect Cluster throughout: the Model, entities, singletons, crons and workflows are classes on one pool. The app picks the pool; a slice names no cloud. |
| Agents | One more client of a derived MCP surface, read-first. | Actors in the model. Inference is a port, an agent run is a saga, every event names its actor. |
| UI | Separate client and ui packages; state in atoms and hooks. | React over pure machines. Every machine has a story, the same way the model does. |
| Between slices | Emitted events, or a promoted `shared/use-cases` contract. | The other slice's `Domain.Api`, behind an `ExternalSystem` the consumer declares. |
| Enforcement | Path and suffix lint; most rules are docs-only review gates. | Laws computed from the Model value. No law needs a reviewer's judgement to run. |

A package manager enforces exactly one thing: what a package can resolve. So a package should exist for each distinct dependency closure and for nothing else. The model resolves neither a driver nor the DOM, which makes those imports impossible, not merely linted.

## What the first slice already shows

The vault-sync slice is the only code written against the amended standard, so it is the best evidence of how a seven-package slice and this library fit together. Five observations from the checkout:
- A model is hiding inside an aggregate folder. `documents/domain/src/aggregates/VaultSync/` holds 59 files in one flat directory: 35 commands, 7 views and 6 aggregates. Six consistency boundaries live in a folder named after none of them. The path grammar has no slot for "bounded context", so the model took the slot meant for one concept.
- The code has moved away from the placement table twice, both times toward colocating. The table sends policy handlers to `server` and `ExternalSystem` contracts to `domain`. The slice put `VaultSync.policy-handlers.ts` and `BoxMirror.external.ts` in `use-cases`, next to the declarations that use them.
- `.policy.ts` means two things. In the domain vocabulary it is "pure domain decision law". In the use-case vocabulary it is a `Domain.Policy`, an event reaction. A suffix that needs its package to disambiguate it has stopped compressing context.
- `use-cases/Model.ts` declares two models with the same name, `VaultSyncModel` and `VaultSyncPassModel`, both `Domain.Model("VaultSync", …)`. The library rejects two same-named models on one platform.
- The repo owns a Platform because none existed that week. Decision D1 (2026-11-03) built `@beep/alchemy-postgres` because the library shipped only in-memory and Durable Object hosting. Upstream added Effect Cluster hosting on 2026-11-07 (#3143): one entity per aggregate instance, with its events, state and reply committed in one transaction, and sagas on the cluster's workflow engine. That is the same design, maintained upstream, and it now runs on Durable Objects as well as on Postgres.

### Where every use-case role went

All thirteen of the package's pre-alchemy roles now have a block that replaces them. What the amendment left in `use-cases` (policy, saga and projection declarations, `Model.ts`, `Api.ts`) are model declarations.

| Role today | Replaced by |
| `.commands.ts` | `Domain.Command`, one file each, with its events and private rejections |
| `.queries.ts` | `Domain.Query` across keys; a single-key read is a `Domain.View` |
| `.access.ts` | Middleware provides a `RequestContext`. `decide` judges commands, a view's `validate` judges reads, a query handler scopes rows. |
| `.ports.ts` | `Domain.ExternalSystem` for calls out, a `.store.ts` service for projection stores. Repository ports vanish: the Platform is the repository. |
| `.service.ts` | Dispatch. `aggregate.send(id, command)` in process, the Api client outside it. |
| `.errors.ts` | `Domain.Rejection`, listed in the command's `rejects` |
| `.http.ts` `.rpc.ts` `.tools.ts` | Derived from `Domain.Api`: its RPC group, `toHttpApi`, `toMcp`, `toToolkit`, `toCli` |
| `.cluster.ts` | The Platform's concern, not the slice's |
| `.workflows.ts` `.processes.ts` | `Domain.Saga` |
| `.schedulers.ts` | `schedule` and `unschedule` on an aggregate client; a deadline is a command that never rejects |

## One command through one slice

The hexagon survives intact. Its rings are now named by the library: the core is `decide` and `evolve`, the application ring is the consumers, the ports are `ExternalSystem` and store services, and the adapters are their Layers.

Solid arrows run inside one request; dashed ones are delivered after the commit. The two ports straddle the model boundary because that is what they are. A person in the browser, an agent with a toolkit and another slice all enter by the same door. A `Domain.Query` (not drawn) reads the store through the same port.

The command handler no longer loads a model through a repository port and saves it back: the Platform loads state, calls `decide`, and commits events, state and idempotency receipt together. The host package never sees a command. It supplies the things the model declared it needs, and nothing else.

## Effect Cluster is the process model

A hexagon says where code may point. It says nothing about what is running, how many copies there are, or what happens when one stops. Effect Cluster answers those questions with four primitives, and the design uses all four as host-side building blocks, next to the Model.

| The state or work is | Primitive | Lives in |
| A fact someone could dispute, guarded by rules | `Domain.Aggregate` | model |
| An answer derived from facts | `Domain.View`, or a projection store | model, host |
| A domain process with steps, waits and undo | `Domain.Saga` | model |
| A live process with an address: an agent session, a per-vendor rate limiter, a connection | cluster `Entity` | host |
| Work that must run in exactly one place: a poller, a consumer | cluster `Singleton` | host |
| Work on a schedule, once per scheduled time | cluster `Cron` | host |
| A long technical job that must finish: ingest, re-index, export | cluster `Workflow` | host |
| Bulk content nobody can refuse | A store behind a port | host |

The Model is itself one of these. On Effect Cluster a `Domain.Model` is a single entity type, and every aggregate instance, view key and policy is an entity id of it. So a slice's host is a list of cluster classes: the model, and whatever entities, singletons, crons and workflows its adapters need.

A pool is one program that runs every class given to it. Callers outside it hold only the gateway's address and token. Swapping the pool changes where instances live and what stores them. It changes no slice code.

### What exists upstream, as of this week

| Layer | Where | State |
| Entities, sharding, singletons, crons, the workflow engine | `effect/cluster`, `effect/workflow` | In Effect 4.1. |
| Cluster on Cloudflare Durable Objects, from Effect itself | `@effect/platform-cloudflare` | Merged 2026-11-10 (#7322), released in 4.1.3. Marked experimental. Every entity instance is one object and its SQLite is the system of record. No shard manager, no database. |
| Alchemy as the deployer for it | `@effect/platform-cloudflare/AlchemyCloudflareCluster` | `make({ entities, layer })` inside a `Cloudflare.Worker`. Alchemy owns the bindings, class exports and SQLite migrations, so there is no wrangler config. Its README says a live deployment smoke has not been run yet. |
| Cluster as Alchemy resources on any cloud | `@alchemy.run/effect-cluster` | 2026-11-06 (#2924). `Cluster.Entity`, `Singleton`, `Cron`, `Workflow`, and pools for Docker, AWS, GCP, Kubernetes, Fly, Hetzner and Cloudflare. |
| A `Domain.Model` on a cluster pool | `@alchemy.run/domain/EffectCluster` | 2026-11-07 (#3143); on the Durable Object pool since 2026-11-12 (#3276). |

There are two implementations of cluster on Durable Objects at the moment. Effect's own, and Alchemy's `DurableObjectPool`, whose docs describe it as "the design of Effect's own Durable Object support". Alchemy's cluster and domain packages do not depend on `@effect/platform-cloudflare` today, so a `Domain.Model` reaches Durable Objects through Alchemy's pool. Because a slice only ever sees `Layer`s, which of the two sits underneath is the app's decision and can change without touching a slice.

### The app is the deployment

A cluster class is found by its `main`: the module whose default export the pool's program loads. That module has to know the pool, and a slice must not. So entry modules belong to the app. An app is then three things: a pool, one entry module per class it runs, and a stack.

apps/practice/ · the only place a cloud is named (sketch)

```ts
// src/Cluster.ts
import * as ClusterDocker from "@alchemy.run/effect-cluster/Docker";

export const Database = ClusterDocker.Database("Practice");
export const Default = ClusterDocker.SwarmPool("Default", { replicas: 2 }).pipe(Layer.provide(Database));
// The same app on Durable Objects is this one line instead. No database, no runners:
// export const Default = ClusterCloudflare.DurableObjectPool("Default");

// src/cluster/Party.ts: the Party model on this pool
import * as DomainCluster from "@alchemy.run/domain/EffectCluster";

export default hostParty(DomainCluster.layerEntities({ name: "Party", main: import.meta.url, pool: Default }));

// src/cluster/PartyMailboxPoller.ts
export default mailboxPollerLive({ main: import.meta.url }).pipe(Layer.provide(Default));

// alchemy.run.ts: infrastructure as an Effect
export default Alchemy.Stack(
  "Practice",
  { providers: Layer.mergeAll(Docker.providers(), Cluster.providers()), state: Alchemy.localState() },
  Effect.gen(function* () {
    yield* PartyMailboxPoller;            // nothing calls a singleton, so the stack yields it
    const api = yield* PracticeApi;       // brings the models' entities, the pool and the database with it
    return { api: api.name };
  }),
);
```

### A cluster class, split the same way as a block

Upstream already recommends declaring a class on its own and implementing it in a second file, to keep its code out of its callers. That is the `.live.ts` rule, so the vocabulary extends without a new idea.

packages/party/host/src/Evidence/MailboxPoller.singleton.ts · MailboxPoller.singleton.live.ts

```ts
// MailboxPoller.singleton.ts: a name
export class MailboxPoller extends Cluster.Singleton<MailboxPoller>()("PartyMailboxPoller") {}

// MailboxPoller.singleton.live.ts: one poller across the whole cluster, however many runners there are
export const mailboxPollerLive = (options: { readonly main: string }) =>
  MailboxPoller.make(
    options,
    Effect.gen(function* () {
      const source = yield* ContactSource;          // the port the model declared
      const party = yield* IntakeApi.Client;        // the same door every other caller uses
      return Effect.gen(function* () {
        const { assertions } = yield* source.observe({ mailbox, since: yield* lastSeen });
        yield* Effect.forEach(assertions, (found) =>
          party.AssertClaim(claimIdOf(found), found, { commandId: found.sourceId }),   // redelivery applies once
        );
      }).pipe(Effect.repeat(Schedule.spaced("1 minute")), Effect.orDie);
    }),
  );
```

Two rules keep cluster classes from becoming a second, unguarded write path. A cluster class changes domain state only by sending commands through an Api client, as an `Actor`. And the model reaches a cluster class only through a port, so stories stay closed-world. A browser never holds a pool's gateway token; it reaches an entity through a host route that runs the Session middleware.

## The directory tree

A worked slice, using `party` because your scratchpad experiment does. The block names borrow vocabulary from the `@beep/party-domain` README (claims, admission gates, key assignments) but they are an architectural sketch, not a proposal for that domain.

```ts
packages/
  party/                                  slice = bounded context = Domain.Model("Party")
    model/                                @beep/party · resolves effect and the library, nothing else
      src/
        Claim/                            a subdomain: one aggregate and everything about it
          Claim.id.ts
          Claim.aggregate.ts              state union, decide, evolve
          Claim.rules.ts                  pure guards decide starts from (admission gates)
          AssertClaim.command.ts          command + ClaimAsserted
          AcceptClaim.command.ts          command + ClaimAccepted + AdmissionGateUnmet
          RetractClaim.command.ts
          ClaimNotPending.rejection.ts    shared by two commands, so it gets a file
          ClaimReview.view.ts             audience: reviewer
          ClaimReview.view.live.ts        its validate
        Review/                           where an agent works
          Reasoner.external.ts            inference is a port
          ProposeDisposition.command.ts   what the agent may ask for
          ReviewAssist.saga.ts            an agent run
          ReviewAssist.saga.live.ts
          ReviewOnAssertion.policy.ts     starts the run
          ReviewOnAssertion.policy.live.ts
        Party/
          Party.id.ts
          Party.aggregate.ts
          RegisterParty.command.ts
          MergeParties.command.ts
          EffectiveParty.view.ts
          EffectiveParty.view.live.ts
          MergeOnSameParty.policy.ts
          MergeOnSameParty.policy.live.ts
        KeyAssignment/                    a uniqueness rule is its own aggregate, keyed by the value
          KeyAssignment.aggregate.ts
          AssignKey.command.ts
        Evidence/
          ContactSource.external.ts       a port: contract only
        Directory/
          PartyDirectory.projection.ts
          PartyDirectory.projection.live.ts
          PartyDirectory.store.ts         a port, with the memory twin stories use
          FindParties.query.ts
          FindParties.query.live.ts
        Identifier.ts                     plain values keep plain names
        PartyKey.ts
        Party.model.ts                    the one Domain.Model
        Handlers.ts                       every .live.ts as one Layer, and the PartyPorts type
        ReviewerApi.api.ts                audience: reviewer
        AgentApi.api.ts                   audience: agent
        ResolutionApi.api.ts              audience: other slices
      test/
        Party.story.test.ts               the specification
        Party.verify.test.ts              Domain.verify(PartyModel) is empty
      SLICE.md                            generated from the Model: what an agent reads first
    host/                                 @beep/party-host · the server runtime's closure
      src/
        Evidence/
          GraphContactSource.adapter.ts   ContactSource.toLayer over @beep/m365
          FixtureContactSource.adapter.ts the same contract test runs against both
          MailboxPoller.singleton.ts      a cluster class, declared on its own
          MailboxPoller.singleton.live.ts one poller across the whole cluster
        Review/
          ClaudeReasoner.adapter.ts       Reasoner.toLayer over a model driver
          ReviewSession.entity.ts         a live agent session, one instance per id
          ReviewSession.entity.live.ts
        Directory/
          PartyDirectory.table.ts         a read-model table, never a write model
          PartyDirectory.store.live.ts    the store port over a sql driver
          DirectoryRebuild.cron.ts        once per scheduled time, across the cluster
        AgentApi.mcp.ts                   toMcp with an explicit expose list
        Partner.http.ts                   hand-written HttpApi with its own response schemas
        Adapters.ts                       every port implementation as one Layer
        Config.ts                         server config and secrets
        Host.ts                           hostParty(platform): the model on whatever it is given
      test/
        ReviewerApi.test.ts               real middleware over Domain.InMemory
    web/                                  @beep/party-web · the browser runtime's closure
      src/
        Connection.ts                     ReviewerApi.layerClient and the protocol choice
        Config.ts                         public config
        ClaimReview/
          ClaimReview.machine.ts          screen state, messages, pure update
          ClaimReview.atoms.ts            runs the machine against the Api client
          ClaimReview.view.tsx            React: a function of the machine's state
      test/
        ClaimReview.story.test.ts         the screen's specification, no DOM
  shared/
    kernel/                               @beep/kernel: language only, no Model
      src/
        Ids.ts
        Actor.ts                          Human | Agent | System
        CurrentActor.context.ts
        Session.middleware.ts             declaration; an identity slice's host provides the live half
        NotAMember.rejection.ts
  ecosystem/
    alchemy-atom/                         Api client to effect/reactivity atoms, for React
apps/
  practice/                               an app is a deployment
    alchemy.run.ts                        the stack: yields what this deployment runs
    src/
      Cluster.ts                          the pool and its database: the only file that names a cloud
      cluster/
        Party.ts                          entry module: the Party model on this pool
        PartyMailboxPoller.ts             entry module: one class each
```

### On the scratchpad layout

 scratchpad

```ts
party/
  domain/
    aggregates/
    commands/
    events/
    models/
    projections/
    queries/
    values/
    views/
  use-cases/
  table/
  server/
  client/
  ui/
  config/
```

 this design

```ts
party/
  model/src/
    Claim/
    Review/
    Party/
    KeyAssignment/
    Evidence/
    Directory/
    Party.model.ts
    Handlers.ts
    ReviewerApi.api.ts
  host/
  web/
```

- Kind folders separate what changes together. A command, the events it records and the rejections only it returns are one decision. The library's convention puts them in one file for that reason, so an `events/` folder has nothing natural to hold.
- The kind is already stated twice. Once in the suffix, once in the class's static `kind`. A folder states it a third time and spends the only directory level you have on it.
- A subdomain folder is a unit of work. A person or an agent changing how claims are accepted needs `Claim/` and nothing else. With kind folders the same change touches five directories.
- Kind folders grow with the model; subdomain folders grow with one aggregate. Vault-sync would have a `commands/` folder with 35 files.

## What the files contain

Design order stays schema first, then contract, then implementation. The library enforces it: a command names its events and rejections before any `decide` exists, and the aggregate will not type-check until every one is handled.

### A command is a complete decision record

packages/party/model/src/Claim/AcceptClaim.command.ts

```ts
import * as Domain from "@alchemy.run/domain";
import { Actor } from "@beep/kernel/Actor";
import { Session } from "@beep/kernel/Session.middleware";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { Proposition } from "../Proposition.ts";
import { ClaimId } from "./Claim.id.ts";
import { ClaimNotPending } from "./ClaimNotPending.rejection.ts";

export const AdmissionGate = LiteralKit(["independent-corroboration", "source-support"]);

/** Refused: the evidence does not clear the gate this proposition needs. */
export class AdmissionGateUnmet extends Domain.Rejection(
  "AdmissionGateUnmet",
  { gate: AdmissionGate, have: S.Int, need: S.Int },
  { httpApiStatus: 422 },
) {}

/** The fact. It names who made it true and carries the outcome decide worked out. */
export class ClaimAccepted extends Domain.Event("ClaimAccepted", {
  proposition: Proposition,
  by: Actor,
  corroboration: S.Int,
}) {}

export class AcceptClaim extends Domain.Command(
  "AcceptClaim",
  {
    target: ClaimId,
    middleware: [Session],          // provides CurrentActor to decide
    input: {},
    events: [ClaimAccepted],
    rejects: [ClaimNotPending, AdmissionGateUnmet],
  },
  { description: "Accept a pending claim once its admission gate is met." },
) {}
```

The `description` is the interface an agent reads. MCP tools, toolkits, CLI help and the OpenAPI document all show it, so the design makes it mandatory on every command, view and query.

### The aggregate is the lifecycle machine

Principle 5 already demands tagged unions for lifecycle states. Here the union is the aggregate's state, `decide` is the transition guard and `evolve` is the transition. That retires `.machine.ts`, `.behavior.ts` and the domain meaning of `.policy.ts`. Guards shared by several handlers move to `Claim.rules.ts`.

packages/party/model/src/Claim/Claim.aggregate.ts

```ts
export const ClaimState = S.Union([
  S.TaggedStruct("Unasserted", {}),
  S.TaggedStruct("Pending", { proposition: Proposition, signals: S.Array(EvidenceSignal) }),
  S.TaggedStruct("Accepted", { proposition: Proposition, by: Actor }),
  S.TaggedStruct("Retracted", { reason: RetractionReason }),
]);

export class Claim extends Domain.Aggregate("Claim", {
  id: ClaimId,
  state: ClaimState,
  initial: { _tag: "Unasserted" },
  commands: [AssertClaim, ProposeDisposition, AcceptClaim, RetractClaim],
  decide: {
    AcceptClaim: Effect.fn(function* (s) {
      const pending = pendingFor(s);                    // Claim.rules.ts: the narrowed state, or the rejection
      if (pending._tag !== "Pending") return yield* pending;
      const gate = admission(pending);                  // Claim.rules.ts: counts independent sources
      if (gate.have < gate.need) return yield* new AdmissionGateUnmet(gate);
      const by = yield* CurrentActor;                   // a type error without Session in the command's middleware
      return [new ClaimAccepted({ proposition: pending.proposition, by, corroboration: gate.have })];
    }),
    // AssertClaim, ProposeDisposition, RetractClaim: same shape
  },
  evolve: {
    ClaimAsserted: (_, e) => ({ _tag: "Pending" as const, proposition: e.proposition, signals: e.signals }),
    // Total: decide already refused what cannot happen, so keep any state the event cannot follow.
    ClaimAccepted: (s, e) =>
      s._tag === "Pending" ? { _tag: "Accepted" as const, proposition: s.proposition, by: e.by } : s,
    ClaimRetracted: (_, e) => ({ _tag: "Retracted" as const, reason: e.reason }),
  },
}) {}
```

### Declaration and handler: two files, one folder

The 2026-11-06 decision (D9) split by purity across packages, which spreads one policy over three of them. Split by purity across files instead. The package line is then free to mean one thing only: a different runtime.

packages/party/model/src/Party/MergeOnSameParty.policy.ts · reachable from /api

```ts
export class MergeOnSameParty extends Domain.Policy("MergeOnSameParty", {
  from: Claim,
  on: [ClaimAccepted],
}) {}
```

packages/party/model/src/Party/MergeOnSameParty.policy.live.ts · never reachable from /api

```ts
export const MergeOnSamePartyLive = MergeOnSameParty.toLayer(
  Effect.gen(function* () {
    const parties = yield* Party;                       // a model member, resolved once
    return Effect.fn(function* ({ event }) {
      if (event.proposition._tag !== "SameParty") return;
      // Sends made while a policy handles a trigger get deterministic command ids,
      // so a redelivered event applies once.
      yield* parties
        .send(event.proposition.survivor, new MergeParties({ absorbed: event.proposition.absorbed }))
        .pipe(Effect.catchTag("MergeVetoed", () => Effect.void));   // every declared rejection is handled
    });
  }),
);
```

A handler needs model members and declared ports, never a driver, so it belongs beside its declaration. If a handler wants something from outside, the answer is a new `ExternalSystem`. The separate file exists because the browser imports the Api, the Api imports the Model, and the Model imports declarations. With handlers in their own files, nothing on that path executes a `toLayer`.

### A port is a schema-checked contract

model/src/Evidence/ContactSource.external.ts

```ts
export class ContactSource extends Domain.ExternalSystem(
  "ContactSource",
  {
    observe: {
      args: { mailbox: MailboxId, since: EpochMillis },
      success: { assertions: S.Array(SourceAssertion) },
      error: [MailboxUnavailable],
    },
  },
) {}
```

host/src/Evidence/GraphContactSource.adapter.ts

```ts
export const GraphContactSource = ContactSource.toLayer(
  Effect.gen(function* () {
    const graph = yield* M365;          // @beep/m365
    return {
      observe: Effect.fn(function* ({ mailbox, since }) {
        const mail = yield* graph.messagesSince(mailbox, since).pipe(
          Effect.mapError(() => new MailboxUnavailable({ mailbox })),
        );
        return { assertions: A.map(mail, assertionOf) };
      }),
    };
  }),
);
```

Every call through the adapter is checked against the port's schemas, arguments before and result after. A story can stub the port and assert what each call sent. Driver errors never cross it: the adapter maps them to a declared error or lets them die as defects.

### Reads: pick the weakest block that answers the question

| Question shape | Block | Stored by | Table needed |
| About one key, live | `Domain.View` | the Platform | no |
| An ordered log per key | `Domain.Stream` | the Platform | no |
| Across keys: search, lists, joins | `Projection` + `Query` | a store you own | yes |

Most reads are the first row, so most slices need no table at all. A view's `validate` runs on every read and on every pushed change, which makes the view the read-side security boundary. Each view declares the audience it is for, and an Api may list only views of its own audience.

packages/party/model/src/Directory/ · the third row, end to end

```ts
// PartyDirectory.store.ts: the port. The host implements it over a sql driver; stories use the memory twin.
export class PartyDirectoryStore extends Context.Service<PartyDirectoryStore, {
  readonly upsert: (rows: ReadonlyArray<DirectoryRow>) => Effect.Effect<void>;
  readonly search: (
    org: OrgId, text: string, page: Domain.Query.PageRequest,
  ) => Effect.Effect<Domain.Query.Page<DirectoryRow>>;
}>()($I`PartyDirectoryStore`) {}

// PartyDirectory.projection.ts
export class PartyDirectory extends Domain.Projection("PartyDirectory", {
  from: [Party],
  key: Party,
  on: [PartyRegistered, KeyAssigned, PartiesMerged],
}) {}

// FindParties.query.ts
export class FindParties extends Domain.Query("FindParties", {
  input: { text: S.String },
  success: DirectoryRow,
  paged: true,
  waitsFor: [PartyDirectory],       // lets a caller read their own write
  middleware: [Session],
}, { description: "Search the caller's organization for parties by name or identifier.", audience: "reviewer" }) {}

// FindParties.query.live.ts: scope to the caller, then read
export const FindPartiesLive = FindParties.toLayer(
  Effect.gen(function* () {
    const store = yield* PartyDirectoryStore;
    return Effect.fn(function* ({ text }, page) {
      const actor = yield* CurrentActor;
      return yield* store.search(orgOf(actor), text, page);
    });
  }),
  { take: { default: 50, max: 200 } },
);
```

### The model, its handlers, and its whole outside world

packages/party/model/src/Party.model.ts · Handlers.ts · ReviewerApi.api.ts

```ts
export class PartyModel extends Domain.Model("Party", {
  aggregates: [Claim, Party, KeyAssignment],
  views: [ClaimReview, EffectiveParty],
  policies: [MergeOnSameParty, ReviewOnAssertion],
  sagas: [ReviewAssist],
  projections: [PartyDirectory],
  queries: [FindParties],
}) {}

// Handlers.ts
export const PartyHandlers = Layer.mergeAll(
  ClaimReviewLive, EffectivePartyLive, MergeOnSamePartyLive, ReviewOnAssertionLive,
  ReviewAssistLive, PartyDirectoryLive, FindPartiesLive,
);

/** Everything the model needs from outside itself. Growing this union is an architecture event. */
export type PartyPorts = ContactSource | Reasoner | PartyDirectoryStore;

// The purity law as a type (sketch): once hosted, the model may require its ports and a host. Nothing else.
export const PartyHosted = PartyModel.layer(PartyHandlers) satisfies Layer.Layer<any, any, PartyPorts | Host>;

// ReviewerApi.api.ts: every kind listed. A kind left out is served whole.
export class ReviewerApi extends Domain.Api("ReviewerApi", {
  model: PartyModel,
  commands: ["AcceptClaim", "RetractClaim", "DecideProposal"],
  views: ["ClaimReview", "EffectiveParty"],
  queries: ["FindParties"],
  streams: [],
}, { audience: "reviewer" }) {}
```

The package manager already stops the model importing a driver. The `satisfies` line closes the remaining gap: it stops a handler requiring a service the model never declared, and the error names the service that leaked. `Host` stands for what the library asks of any platform. The `audience` key is the repo's own, added by augmenting `Domain.Annotations`.

### The specification is a story

packages/party/model/test/Party.story.test.ts

```ts
const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [ContactSource, Reasoner],    // faked: the story answers each call
});
const claim = Claim.ref(ClaimId.make("claim_1"));
const dana = Party.ref(PartyId.make("party_1"));

it.effect("an accepted SameParty claim merges the parties", () =>
  story(
    Story.given(dana, new PartyRegistered({ orgId })),
    Story.given(claim, new ClaimAsserted({ proposition: sameParty(dana.id, duplicate), signals: twoSources })),
    Story.provide(CurrentActor, reviewer),
    Story.when(claim, new AcceptClaim({})),
    Story.then(claim, new ClaimAccepted({ proposition: sameParty(dana.id, duplicate), by: reviewer, corroboration: 2 })),
    Story.then(dana, new PartiesMerged({ absorbed: duplicate })),      // the policy ran, for real
  ),
);

it.effect("one source is not corroboration", () =>
  story(
    Story.given(claim, new ClaimAsserted({ proposition: sameParty(dana.id, duplicate), signals: oneSource })),
    Story.provide(CurrentActor, reviewer),
    Story.when(claim, new AcceptClaim({})),
    Story.rejected(new AdmissionGateUnmet({ gate: "independent-corroboration", have: 1, need: 2 })),
  ),
);

it("the model is well defined", () => expect(Domain.verify(PartyModel)).toEqual([]));
```

A story fails on any event, rejection or external call it does not account for, and it replays every ordering of concurrent writers. A green story file is a closed-world statement about the model. That is the property that lets an agent change a model without a person re-reading the whole of it: anything the change made newly true breaks a story.

## Agents are in the model

The current standard treats an agent as a client of a derived MCP surface. That gets the easy half. The harder half is what an agent is allowed to make true, how its work is tested, and how anyone later finds out what it did. The library already has a block for each of those, so the design assigns them.

| Agent concern | Block | What that buys |
| Who is acting | `Actor` in the kernel, provided as `CurrentActor` | Human, agent and system are one schema. `decide` can treat them differently, and every event records which it was. |
| A model call | `Domain.ExternalSystem` | The output is schema-checked at the adapter. Stories stub it, so agent behaviour is deterministic to test. |
| An agent run | `Domain.Saga` | Steps are durable and resumable. A person's sign-off is a durable signal the run waits on. |
| A live agent session | A cluster `Entity` in the host | One instance per session id, holding its context in memory and handling one message at a time. What it concludes still enters the model as a command. |
| What an agent may do | A `Domain.Api` for the agent audience, as a toolkit or over MCP | Least privilege by listing names. Every tool is a command, so nothing an agent does skips `decide`. |
| What an agent did | The event log | An audit trail by construction, joined across a whole flow by the correlation id. |
| What an agent reads first | `SLICE.md`, generated from the Model | Aggregates, commands, rejections, views and their descriptions, in one file that cannot go stale. |

Agents propose, aggregates decide. An agent can ask for anything its Api lists. It cannot make an invalid state true, because the only way to change state is a command, and `decide` is not something a prompt can talk its way past.

packages/shared/kernel/src/Actor.ts

```ts
export const Actor = S.Union([
  S.TaggedStruct("Human", { principal: PrincipalId, org: OrgId }),
  S.TaggedStruct("Agent", { agent: AgentId, model: S.String, run: RunId, onBehalfOf: PrincipalId, org: OrgId }),
  S.TaggedStruct("System", { process: S.String, org: OrgId }),
]);

export class CurrentActor extends Domain.RequestContext<CurrentActor>()("Kernel/CurrentActor", Actor) {}
```

packages/party/model/src/Review/ · an agent run, as blocks

```ts
// Reasoner.external.ts: inference is a port, with a schema on both sides
export class Reasoner extends Domain.ExternalSystem("Reasoner", {
  assess: {
    args: { proposition: Proposition, signals: S.Array(EvidenceSignal) },
    success: { disposition: Disposition, rationale: S.String },
    error: [ReasonerUnavailable],
  },
}) {}

// ReviewAssist.saga.ts
export const HumanDecision = DurableDeferred.make("human-decision", { success: Disposition });

export class ReviewAssist extends Domain.Saga("ReviewAssist", {
  key: ClaimId,
  input: { proposition: Proposition, signals: S.Array(EvidenceSignal), run: RunId },
}) {}

// ReviewAssist.saga.live.ts
export const ReviewAssistLive = ReviewAssist.toLayer(
  Effect.gen(function* () {
    const claims = yield* Claim;
    const reasoner = yield* Reasoner;
    return Effect.fn(function* ({ key, proposition, signals, run }) {
      const assessed = yield* Activity.make({
        name: "assess",
        success: Assessment,
        error: ReasonerUnavailable,
        execute: reasoner.assess({ proposition, signals }),
      });
      // The agent proposes, as itself. decide may refuse the proposal like any other command.
      yield* Activity.make({
        name: "propose",
        execute: claims
          .send(key, new ProposeDisposition(assessed))
          .pipe(Effect.provideService(CurrentActor, reviewAssistant(run))),
      });
      // A person signs off. The run sleeps here, durably, for as long as that takes.
      const decision = yield* DurableDeferred.await(HumanDecision);
      if (decision === "reject") return;
      yield* Activity.make({ name: "apply", execute: claims.send(key, new ApplyDisposition({ decision })) });
    });
  }),
);
```

packages/party/model/test/Party.story.test.ts · the agent's behaviour, with no model call

```ts
it.effect("the assistant proposes, a reviewer decides", () =>
  story(
    Story.provide(CurrentActor, intake),
    Story.when(claim, new AssertClaim({ proposition, signals: twoSources })),
    Story.then(claim, new ClaimAsserted({ proposition, signals: twoSources, by: intake })),
    Story.call(Reasoner.assess, { proposition }),                                    // the run reached the model call
    Story.succeed(Reasoner.assess, { disposition: "accept", rationale: "two independent sources" }),
    Story.then(claim, new DispositionProposed({ disposition: "accept", by: assistant })),
    Story.saga(ReviewAssist, claim.id, { _tag: "Running" }),                         // waiting on a person
    Story.signal(ReviewAssist, claim.id, HumanDecision, "accept"),
    Story.then(claim, new ClaimAccepted({ proposition, by: assistant, corroboration: 2 })),
    Story.saga(ReviewAssist, claim.id, { _tag: "Completed" }),
  ),
);
```

### The same model, for the agents that write the code
- One block per file, named by kind. The unit an agent edits is small, uniform and found by a glob: `**/*.command.ts`.
- A slice is sized to be held whole. One bounded context, one model package, one generated `SLICE.md`. If a model no longer fits in one working context, that is the signal it holds two languages.
- Story first. The acceptance criterion for a change is a story, written before the block. The loop an agent runs is story, block, `Domain.verify`, laws, and all four are local and fast.
- No law needs a reviewer to run it. A rule that only a person can check is a rule an agent will break at volume. Every rule in the laws table below is mechanical.

## The host and the web

### The repo owns no platform

The host package provides the ports and offers the model to whatever platform it is handed. The app hands it a cluster pool. A story or an Api test hands it `Domain.InMemory`, and nothing else changes. On a runner pool the system of record is Postgres; on a Durable Object pool it is each object's own SQLite. Cross-key reads go through projection stores either way.

packages/party/host/src/Adapters.ts · Host.ts (sketch)

```ts
// Adapters.ts: every port the model declared, implemented
export const PartyAdapters = Layer.mergeAll(GraphContactSource, ClaudeReasoner, PgPartyDirectoryStore);

// Host.ts: the model and its adapters, on the platform you give it
export const hostParty = <ROut, E, RIn>(platform: Layer.Layer<ROut, E, RIn>) =>
  PartyModel.layer(PartyHandlers).pipe(Layer.provide(PartyAdapters), Layer.provide(platform));

// An Api test: the same model and handlers, fakes for the ports, memory for the platform
const World = PartyModel.layer(PartyHandlers).pipe(
  Layer.provide(Layer.mergeAll(FixtureContactSource, FixtureReasoner, MemoryPartyDirectoryStore, Domain.InMemory)),
);
```

Two things the repo's own platform driver added move into the model, where every platform preserves them:
- Provenance is a fact. Every event has a `by: Actor` field, stamped in `decide` from `CurrentActor`. When the actor can be an agent with a model and a run id, who did it is business data, not envelope metadata.
- Upcasting is the event schema's decode. An event's encoded side is the stored contract and may only widen. A renamed or added field is a codec on the event class that decodes every shape ever stored. A change no codec can express is a new event tag.

### Delivery is derived, except where it faces strangers

| Surface | How | File |
| Your own apps | The Api's typed client over HTTP and WebSocket | none; `web/Connection.ts` picks the protocol |
| Agents in the app | `toToolkit` over the agent Api, acting for the caller's headers | where the agent runs |
| Agents and operators outside | `toMcp`, `toCli` with an explicit `expose` list | `host/<Api>.mcp.ts`, a command tool |
| Partners and the public | A hand-written `HttpApi` with its own response schemas, calling `clientInProcess` | `host/<Audience>.http.ts` |
| Pollers, consumers, schedules | A cluster singleton or cron that sends commands with ids derived from the upstream event | `host/<Name>.singleton.ts`, `.cron.ts` |

### React over pure machines, with stories

The web package stays React. What it takes from Foldkit is the testing pattern, not the framework: screen state is a schema, everything that can happen is a tagged message, and one pure function folds a message into the next state and a list of intents. React renders the state and dispatches messages. The atoms run the intents against the Api client and feed live reads back in as messages. That is the same shape as an aggregate, and it earns the same kind of test.

packages/party/web/src/ClaimReview/ClaimReview.machine.ts

```ts
export const Screen = S.Struct({
  review: S.NullOr(ClaimReview.state),            // the server's view, as last pushed
  sending: S.NullOr(CommandId),                   // an accept the view has not confirmed yet
  refusal: S.NullOr(AcceptClaim.rejection),
});

export const Message = S.Union([
  S.TaggedStruct("ReviewChanged", { review: ClaimReview.state }),          // pushed by watch
  S.TaggedStruct("AcceptPressed", { commandId: CommandId }),
  S.TaggedStruct("AcceptRefused", { rejection: AcceptClaim.rejection }),
]);

export const Intent = S.Union([S.TaggedStruct("SendAccept", { claim: ClaimId, commandId: CommandId })]);

/** Pure. Everything this screen can do is a branch here. */
export const update = (screen: Screen, message: Message): readonly [Screen, ReadonlyArray<Intent>] =>
  Match.value(message).pipe(
    Match.tagsExhaustive({
      AcceptPressed: ({ commandId }) =>
        screen.review === null || screen.sending !== null
          ? [screen, []]
          : [{ ...screen, sending: commandId, refusal: null }, [sendAccept(screen.review.id, commandId)]],
      AcceptRefused: ({ rejection }) => [{ ...screen, sending: null, refusal: rejection }, []],
      // The view is the confirmation. Nothing is ever rolled back.
      ReviewChanged: ({ review }) => [{ ...screen, review, sending: null }, []],
    }),
  );
```

packages/party/web/test/ClaimReview.story.test.ts · a small test kit modelled on foldkit/story

```ts
it("an accept stays pending until the view confirms it", () =>
  story(update)(
    given(screenShowing(pendingClaim)),
    message(acceptPressed("cmd_1")),
    intents([sendAccept(pendingClaim.id, "cmd_1")]),         // what it asked the runtime to do
    model((screen) => expect(screen.sending).toBe("cmd_1")),
    message(acceptPressed("cmd_2")),                         // a double click
    intents([]),                                             // sends nothing
    message(reviewChanged(acceptedClaim)),                   // the server's view arrives
    model((screen) => expect(screen.sending).toBeNull()),
  ));
```

No DOM, no server, no timers. A screen story fails on an intent it did not expect, the way a model story fails on an event it did not expect. Browser QA keeps its job, which is to prove that real gestures reach the machine. The Api client binding for atoms (`@beep/alchemy-atom`) is the one package the library does not ship for React; it binds two external libraries and carries no beep semantics, so it is an `ecosystem` member.

## Between slices

A model never touches another model's aggregates. It reaches another model only through an Api that model chose to publish.

The consumer's model depends on a port it wrote. Only its adapter knows that another slice answers. Where party's entities run is the cluster's business: on the same pool the call stays in process, on another it goes through that pool's gateway, and the adapter is the same code.
- The single legal cross-slice import is a host importing another slice's `/api`. It replaces `shared/use-cases`, which existed to hold exactly these contracts.
- Events cross the same way. The upstream slice serves a `Stream` or a view's events through its Api. The downstream slice reads it in a cluster singleton and sends its own commands, with command ids derived from the upstream `stream:seq`.
- The shared kernel is language only: ids, values, `Actor`, the `CurrentActor` context, the `Session` middleware declaration, a few common rejections. No aggregate, no Model, no Layer. A shared aggregate would be shared data, and models do not share data.
- Slices are bounded contexts, so they get smaller. "Every name has one meaning" is the test. By it `documents` holds at least two contexts, and vault-sync is `packages/vault-sync/` with one model named `VaultSync`.

## The role vocabulary

One rule generates most of it: `<Noun>.<kind>.ts` declares a block, and `<Noun>.<kind>.live.ts` holds its `toLayer`. The suffixes are kept, though a generated map exists, because they are free, a glob can find them, and a law checks each one against the value it names.

 model package

| Suffix | Holds |
| `.id.ts` | An aggregate's branded id |
| `.command.ts` | A command, its events, its private rejections |
| `.rejection.ts` | A rejection several commands share |
| `.aggregate.ts` | State union, decide, evolve, reply |
| `.rules.ts` | Pure guards that decide starts from |
| `.view.ts` `.stream.ts` | Reads; `.live.ts` holds `validate` |
| `.policy.ts` `.saga.ts` | Reactions and processes; `.live.ts` holds the handler |
| `.projection.ts` `.query.ts` | Store writers and readers; `.live.ts` holds the handler |
| `.store.ts` | A store port and its memory twin |
| `.external.ts` | An `ExternalSystem` contract |
| `.context.ts` `.middleware.ts` | Request context and middleware declarations |
| `.api.ts` `.model.ts` | One Api per audience; one Model per package |

 host and web packages

| Suffix | Holds |
| `.adapter.ts` | Host: `ExternalSystem.toLayer` over a driver |
| `.store.live.ts` | Host: a store port over a sql driver |
| `.table.ts` | Host: a read-model table |
| `.middleware.live.ts` | Host: a middleware's server half |
| `.entity.ts` `.workflow.ts` | Host: a cluster class; `.live.ts` holds its code |
| `.singleton.ts` `.cron.ts` | Host: one runner, or one run per scheduled time |
| `.http.ts` `.mcp.ts` | Host: a partner `HttpApi`; a derived tool surface |
| `Adapters.ts` `Host.ts` | Host: composers |
| `Connection.ts` | Web: the Api client and its protocol |
| `.machine.ts` | Web: screen state, messages, pure update |
| `.atoms.ts` | Web: runs a machine against the Api client |
| `.view.tsx` | Web: React, a function of machine state |
| `Config.ts` | Each runtime's own configuration |

retired

The `use-cases`, `tables`, `client`, `ui` and `config` packages. The domain-kind folders (`aggregates/`, `entities/`, `values/`, `policies/`, `services/`). The domain roles `.model.ts` as a persisted entity, `.values.ts`, `.errors.ts`, `.behavior.ts`, `.machine.ts`, `.access.ts`, `.contracts.ts` and `.events.ts`. Every use-case role. The server roles `.repo.ts` and all six `-handlers.ts`. The client roles `.command-client.ts`, `.query-client.ts` and `.service.ts`. The entity kit. The `@beep/alchemy-postgres` driver, and the standard's planned eventlog, message-storage, workflow and sharding drivers, all of which Effect Cluster already is.

### Legal imports

| Package | Resolves | Cannot resolve |
| model | `@alchemy.run/domain`, `effect`, `@beep/kernel`, foundation primitive and modeling | drivers, React, the DOM, Node, any other slice |
| host | own model, drivers, foundation, `@alchemy.run/effect-cluster`, another slice's `/api` | React, a pool or a cloud provider package, another slice's host or model internals |
| web | own model `/api`, React, `@beep/alchemy-atom`, `foundation/ui-system`, driver `/browser` subpaths | any `.live.ts`, the host, driver roots |
| app | slice hosts and webs, pools and cloud provider packages, the identity slice's middleware | concept-level slice internals |

## Laws computed from the Model

The current enforcement table lists seven rule areas, and six of them say "docs-only". A Model is a value that lists its own aggregates, commands, events and rejections, so the standard can be checked by loading it. The topology becomes a projection that a law compares against the Model.

| Law | Mechanism |
| The model is well formed | `Domain.verify(Model)` is empty in every model package |
| One model per slice, named after it | Compare `Model.modelName` with the manifest's slice |
| The suffix tells the truth | Every export of `X.<kind>.ts` has a static `kind` equal to the suffix |
| A package is a closure | Each manifest's dependencies fall inside its runtime's allowed set |
| Handlers are port-closed | The `satisfies` assertion in `Handlers.ts`, checked by `tsc` |
| `/api` is client-safe | Its import graph reaches no `.live.ts` |
| One cross-slice edge | Import boundary: only a host to another slice's `/api` |
| A slice names no cloud | No slice manifest depends on a pool module or a provider package; only apps do |
| One write path | A host file with a cluster suffix imports its model only through `/api` |
| The app lists what runs | Every cluster class has exactly one entry module in each app that deploys it |
| Apis list every kind | No Api omits `commands`, `views`, `streams` or `queries` |
| A view is served to its own audience | Each view and query declares an `audience`; an Api lists only its own |
| Everything callable is described | Every command, view, query and Api has a `description` |
| Every event names its actor | Every `Domain.Event` has a `by: Actor` field |
| Stored contracts only widen | A baseline of event tags and encoded schemas; a new encoded schema must decode every stored sample |
| Every outcome has a story | For each command, the happy path and each tag in `rejects` appear in a story; for each machine, each message does |
| The map is generated | `SLICE.md` and the slice diagrams are rebuilt from the Model and diffed |

### Checked against the eight principles

| Principle | Under this design |
| Slice first | Stronger. A slice is a value, and the Platform isolates its data by model name. |
| Ports inward, adapters outward | Stronger. The model cannot resolve a driver, ports are schema-checked, and handler purity is a type. |
| Shared is a shared kernel | Narrower. Language only. |
| Rich domain, pure behavior | One home. Rules live in `decide`; time arrives as an argument, never from a clock. |
| Schemas are executable contracts | Extended. Every block is a schema class, and an event's encoded side is the durable contract. |
| Topology is compressed context | Kept, and verified against the Model instead of trusted. |
| Non-slice families are explicit | Unchanged in kind. The platform and engine drivers go; one ecosystem member arrives; an app becomes a deployment. |
| One public origin | Unchanged. |

## What the design makes true

These are properties of an event-sourced, actor-hosted model. Each one is a rule for how to model, and belongs in the standard as such.

### A stored fact is permanent

Events are never rewritten. Anything that may later be deleted or corrected (personal data, document text) lives in a store behind a port, and the event carries its id.

### An aggregate is something that can refuse

If no command about a thing could ever be rejected, it is not an aggregate. Corpus text, embeddings, RDF triples and mail indexes are stores behind ports. Aggregates hold lifecycle and references.

### A read names the write it follows

Views and projections are delivered after the commit. A caller that writes then reads passes the receipt as `atLeast`. A screen keeps its own intent pending until the view confirms it, which is what the machine above does.

### An invariant across aggregates is an aggregate

There is no cross-aggregate transaction. A uniqueness rule becomes an aggregate keyed by the value it protects; a multi-step rule becomes a saga that reserves, commits and compensates.

### Everything that runs has an address or an owner

A stateful process is an entity with an id. A loop is a singleton, owned by one runner at a time. A schedule is a cron, run once per scheduled time. Nothing in a host forks a background fiber of its own.

### Rules are public

The model package is imported by the browser and read by agents. That is what makes prediction and generated tools possible. Secrets live in a host's `Config.ts` and nowhere else.

### Every transition has a story

On the server a transition is `decide` and `evolve`. In the browser it is `update`. Both are pure, both are specified by a story that fails on anything it did not expect.

## What this would amend

| In the standard | Change |
| North Star, Slice Package Topology | Define a slice as one `Domain.Model`. Three packages, one per runtime: model, host, web. |
| Decision 2026-11-06 and D9 | Every declaration lives in the model package. Handlers live in `.live.ts` beside their declarations. The placement table reduces to "which runtime does it need?". |
| D1 and the drivers list | Host on Effect Cluster. Retire `@beep/alchemy-postgres` and the planned eventlog, message-storage, workflow and sharding drivers. Provenance moves into events; upcasting moves into event schemas. |
| CQRS, Events, Workflows, Cluster, And Read Models | Rewrite around the state-to-primitive table: aggregate, view, saga, entity, singleton, cron, workflow, store. |
| Apps, and the `tooling/infra` kind | An app is a deployment: a pool, entry modules and a stack. Slices name no cloud. |
| Domain-Kind Folders, Role Suffixes | Replace with subdomain folders and the kind-suffix vocabulary above. |
| Principle 5, persisted entities | Replace the `ProductEntity` law with the stored-contract law. Tables are projection stores inside a host. |
| Config role vocabulary | No slice config package. Each runtime owns a `Config.ts`; business constants are model values. |
| Client and UI vocabularies | One web package. Add the machine and its story; retire the hand-written clients. |
| Slice Consumption Rules | Add the one cross-slice edge. Retire `shared/use-cases`. The kernel gains `Actor`. |
| Access, Policy, And Error Kinds | Policy means `Domain.Policy` only. Access is middleware, `decide` and `validate`. Actionable failures are rejections. |
| New section: Agents | Actor, inference as a port, runs as sagas, the agent Api, the generated slice card. |
| Enforcement And Migration Posture | Replace the docs-only rows with the Model-derived laws. Drop the Review Gate lane. |    Sources: `standards/ARCHITECTURE.md` and `standards/architecture/DECISIONS.md` at `9e3d2919fd1`; `explorations/alchemy-domain-adoption/DECISIONS.md` (D0 to D17); the vault-sync slice under `packages/documents`; `@alchemy.run/domain` source, docs and git history at 2.0.0-beta.87 in the reference checkout, including `@alchemy.run/effect-cluster` and the `cluster-domain` example; the Effect checkout at `9ef5cd04d2` (2026-11-13), including `@effect/platform-cloudflare` 4.1.4; `foldkit/story` 0.170 for the screen-story steps. Code blocks are architectural sketches checked against the library's declared shapes, not compiled. `@beep/alchemy-atom`, the screen-story test kit, the `audience` annotation and `SLICE.md` are proposals, not things that exist.
