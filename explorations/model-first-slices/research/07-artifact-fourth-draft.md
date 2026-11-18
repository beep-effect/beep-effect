# Fourth draft of the design artifact, as text

Extracted 2026-11-13 from the published page (figures omitted). Code blocks are sketches unless the
page says they come from the prototype. `DECISIONS.md` wins where they differ.

---

Model-First Slices

beep-effect · architecture exploration · 2026-11-13 · fourth version

# If the Model had come first

This page designs the architecture standard around `@alchemy.run/domain` and Effect Cluster, for a codebase where agents write, call and operate the system alongside people. The fourth version follows twenty-three decisions recorded today, D1 to D23 in `explorations/model-first-slices/DECISIONS.md`, and serves as that packet's shaped brief (D20). Where the prototype has not yet run a shape, the page calls it decided and unproven. What the repo has today is evidence about the problem and never a reason to keep something.

## The short answer

A slice is one bounded context, which owns a language, its data and its invariants. It is written as one `Domain.Model` by default and ships as four packages, one per dependency closure: `contract`, `model`, `host` and `web`. Everything that runs is an Effect Cluster class. Authority is an `Invocation` built at a trusted boundary and relayed through every reaction. An agent run is an aggregate.

The current standard has the right principles. The library turns things the standard describes in prose (a command boundary, a port, a process, a read model) into values that a compiler, a test runner and an agent can inspect. The third draft let the library's containers set boundaries that belong to the domain. Two outside reviews and a prototype showed where, and this draft moves those lines.

| Concern | Standard today | This design |
| Unit of architecture | A slice is a "domain-bounded module family"; a model can sit inside one of its folders. | The bounded context. One `Domain.Model` per context by default, and a second only for an independent event lifecycle or storage placement (D2). |
| Packages | Seven per slice, one per architectural role. | Four per slice, one per dependency closure: `contract`, `model`, `host`, `web`. Browsers and other contexts import the contract (D3). |
| Path grammar | `<domain-kind>/<Concept>/<Concept>.<role>.ts` | `<Module>/<Noun>.<kind>.ts`, with `.handler.ts` and `.adapter.ts`. Exact package exports. A handler registry generated from the Model (D10). |
| Authority | Access rules per use case; most are docs-only review gates. | A trusted boundary builds an `Invocation` carrying capability grants. Policies and sagas relay it. An authority context owns grants and an Accountability relation (D4, D7, D18). |
| Agents | One more client of a derived MCP surface, read-first. | An `AgentRun` aggregate is the system of record for one bounded piece of work. A saga executes it, a session entity holds a chain of runs, and delegation only narrows. Operating agents call derived tools under a grant; coding agents get the contract client in a sandbox (D6, D21, D23). |
| Stored formats | Persisted entity schemas projected to tables. | Convert on read. Stored bytes are never rewritten, and every stored format has a compatibility contract (D14, D22). |
| Between contexts | Emitted events, or a promoted `shared/use-cases` contract. | Versioned integration facts through an outbox and an inbox. Synchronous calls through a port the consumer declares over the provider's contract (D11). |
| UI | Separate client and ui packages; state in atoms and hooks. | React over bindings generated from the contract. A pure machine with a story where the screen earns one (D12). |
| Deployment | Apps wire packages by hand. Effect Cluster appears only inside the platform driver. | Each slice's host publishes a deployment descriptor. The app composes descriptors onto pools. Cluster entry modules are generated (D13). |
| Enforcement | Path and suffix lint; most rules are docs-only review gates. | A proof inventory: each invariant with its checker and inputs. Semantic questions go to a reviewer agent that did not write the change (D8). |
| Hosting | A repo-owned Postgres `Domain.Platform`, `@beep/alchemy-postgres`. | Postgres on Effect Cluster, proved first on a local Docker swarm. The repo-owned platform is retired only when the conformance suite passes there (D5). |

A package manager enforces one thing: what a package can resolve. So a package exists for each distinct dependency closure. The model resolves no driver and no DOM, which makes those imports impossible. The contract is what a browser or another context needs, and its closure holds no `decide` and no `evolve`. Until the library can declare an Api without the Model, an import-graph check and a built-artifact check hold that line (D9).

## What changed since the third draft

Nineteen positions of the third draft are reversed or replaced. Each row gives what the third draft said, what is decided now, and what showed it. The sources are the GPT-6 Astra review (`research/02-astra-review.md`), the Kimi review (`03`), the ADHD pass (`04`), Grok's deep research (`05`) and the prototype.

| Concern | Third draft | Decided now | Shown by |
| Unit | Slice = bounded context = exactly one `Domain.Model`. A model too big for an agent's working context holds two languages. | The bounded context is the unit. One Model by default; a second for an independent event lifecycle or storage placement. The context-window test is dropped (D2). | Astra, "Wrong on the merits" 3: a Model is one entity type with many addressed instances, which says nothing about language. Kimi, "The unit of architecture". |
| Packages | Three per slice. The browser imports the model's `/api`. | Four: `contract`, `model`, `host`, `web`. Clients import the contract (D3, D9). | Astra 9: `/api` imports the Model, which imports every `decide`. A library fact-find: `Domain.Api` reads the Model at declaration. |
| File grammar | `.live.ts` beside each declaration; Subdomain folders; a hand-kept `Handlers.ts`; a wildcard export over `src`. | `.handler.ts` and `.adapter.ts`; Module folders; a generated handler registry; exact exports (D10). | Kimi, "File and path grammar". The prototype exports every source path, handlers included. |
| Suffix law | Every export of `X.<kind>.ts` has that `kind`. | One designated primary export per file. Companion exports are checked separately (D8). | Astra 9: the law rejected the third draft's own command files, which export an event and a rejection too. |
| Authority | `by: Actor` on every event, `CurrentActor` from middleware, an `audience` annotation. A policy provides a System actor. | An `Invocation` from a trusted boundary, capability grants, relay through policies and sagas. Policies never act as System (D4, D7). | Astra 6, Kimi "Identity and provenance", ADHD focus 1. The prototype: a policy runs with no request context. |
| Approval | A person's sign-off is a `DurableDeferred` signal carrying an Actor. | Approval is an authenticated command. The run wakes on the committed fact (D4). | Astra 6: the signal accepted any Actor, agents included. |
| Agent run | A run is a saga keyed by the claim it reviews. | An `AgentRun` aggregate. A saga executes it, a cluster entity is its worker, delegation narrows, budget is reserved (D6). | Astra 7: a saga key is its execution id, so a second review of one claim had no home. Kimi, "Agents in the model". |
| Run length | The run sleeps on a person's sign-off "for as long as that takes", with no bound on its history. | A run is one bounded piece of work with a history bound. A long conversation is a session entity holding a chain of runs. A run at its bound continues as a new run (D23). | Grok: workflow engines cap history (Temporal terminates past 51,200 events), and a long-lived entity is a different thing from a process that finishes. |
| Agent surfaces | One agent Api, served as a toolkit or over MCP, for every agent. | Two surfaces by role. Operating agents call derived tools under a grant, deniable by a person. Coding agents get the contract client in a sandbox with bindings only (D21). | Grok, citing the MCP tools specification and Cloudflare Code Mode. |
| Between slices | A downstream singleton follows the upstream's `Stream` or view events. | Integration facts, an outbox and an inbox (D11). | Kimi, "Between slices": following private events makes refactoring a breaking change. Astra, "Missing". |
| UI | Every screen gets a machine, an atoms file and a view. The machine clears `sending` on any view change. | Generated bindings by default; a machine when earned; correlation on command id, receipt and view revision (D12). | Astra 8: a delayed snapshot let a second command go out. Kimi, "Frontend". |
| Deployment | The app owns a hand-written entry module per cluster class. | Slice deployment descriptors; generated entry modules (D13). | Kimi, "Cluster composition". |
| Enforcement | Laws computed from the Model. No law needs a reviewer. | A proof inventory plus an independent reviewer (D8). | Astra 10: paths, imports and stories are separate inputs. ADHD: an author's stories can restate the author's `decide`. |
| Hosting | The repo owns no platform. Effect's or Alchemy's Durable Object support can sit underneath, as the app likes. | The Postgres swarm host is proved first; the repo-owned platform goes when conformance passes. The two Durable Object routes expose different contracts (D5). | Astra, claims table: the Postgres storage wraps the commit in one transaction, and a Layer does not bridge the two Durable Object routes. Grok: Effect's Cloudflare package is experimental and the model reaches Durable Objects through Alchemy's pool. |
| Aggregates | An aggregate is something that can refuse. | An aggregate is chosen by invariant ownership and ordering. | Astra 3. |
| Cross-aggregate rules | A cross-aggregate invariant becomes an aggregate or a reserving saga. | It needs a reservation protocol that every conflicting path takes part in. | Astra 4, and the prototype's `MergeParties`, which cannot see a second survivor. |
| Exactly once | A cron runs once per scheduled time. An activity does not apply twice. | No primitive gives an external effect exactly once. Idempotency keys and reconciliation do. | Astra, claims table and 7. |
| Stored formats | Upcasting is the event schema's decode. A stored contract only widens, and a change no codec can express is a new event tag. | Convert on read. Stored bytes are never rewritten. One declared read-time transform per version step for an incompatible change; a new tag for a new fact only. A compatibility contract covers state, events, receipts, request context and saga payloads (D14, D22). | Astra 2: the codec is picked by stored tag, and state decodes directly. Grok: Axon 5.4 leaves stored events alone and converts payloads on read; widen-only forks the language `evolve` reads. |
| Retention | Deletable data lives behind a port and events carry its id. | A retention class on every stored field, erasure by tombstone, recorded privileged reads, trust labels (D14). | Astra, "Missing": the prototype stores names and evidence excerpts in events, and an id can itself identify. Kimi: untrusted content can steer an agent. |

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
| `.access.ts` | The trusted boundary builds an `Invocation` and the command boundary checks its grants. `decide` judges invariants, a view's `validate` judges reads, a query handler scopes rows. |
| `.ports.ts` | `Domain.ExternalSystem` for calls out, a `.store.ts` service for projection stores. Repository ports vanish: the Platform is the repository. |
| `.service.ts` | Dispatch. `aggregate.send(id, command)` in process, the contract's client outside it. |
| `.errors.ts` | `Domain.Rejection`, listed in the command's `rejects` |
| `.http.ts` `.rpc.ts` `.tools.ts` | Derived from `Domain.Api`: its RPC group, `toHttpApi`, `toMcp`, `toToolkit`, `toCli` |
| `.cluster.ts` | A cluster class in the slice's host, named in its deployment descriptor |
| `.workflows.ts` `.processes.ts` | `Domain.Saga` |
| `.schedulers.ts` | `schedule` and `unschedule` on an aggregate client; a deadline is a command that never rejects |

## One command through one slice

The hexagon survives, and the library names its rings. The core is `decide` and `evolve`. The application ring is the Api, the views, policies, sagas and projections. The ports are `ExternalSystem` contracts and store services, and the adapters are their Layers in the host.

Solid arrows run inside one request. Dashed arrows are delivered after the commit, at least once. Every caller enters by the same door and holds only the contract's client: a person in the browser, an agent with a toolkit, another context's adapter. The platform looks up a stored receipt for the command id before `decide` runs, so a retry returns the first result. A `Domain.Query` (not drawn) reads the store through the same port.

The platform loads state, checks for a receipt, calls `decide`, and commits the events, the new state, the receipt and the delivery outbox together. On the Postgres host that is one database transaction. Rejections, external effects and projection stores fall outside it. The host package never sees a command. It supplies the ports the model declared, and the app supplies the trusted boundary that builds the Invocation.

## Effect Cluster is the process model

Every process is an Effect Cluster class, and the design uses all four cluster primitives next to the Model. None of them makes an external effect happen exactly once. An idempotency key the provider honours does that, or a reconciliation step for an uncertain outcome.

| The state or work is | Primitive | Lives in |
| A fact whose invariant needs one owner and one order | `Domain.Aggregate` | model |
| An answer derived from facts | `Domain.View`, or a projection store | model, host |
| A domain process with steps, waits and undo | `Domain.Saga` | model |
| A live process with an address: an agent session and its chain of runs, a per-vendor rate limiter, a connection | cluster `Entity` | host |
| A loop that one runner owns at a time: a poller, an outbox relay | cluster `Singleton` | host |
| Work on a schedule. A failed run is retried and a stale one skipped. | cluster `Cron` | host |
| A long technical job that must finish: ingest, re-index, export | cluster `Workflow` | host |
| Bulk content that no invariant guards | A store behind a port | host |

The Model is itself one of these. On Effect Cluster a `Domain.Model` is one entity type with many independently addressed instances: every aggregate instance, view key and policy has its own entity id. That makes the Model a runtime composition unit. It is neither one aggregate nor one transaction boundary, and it does not define a language. A slice's host is a list of cluster classes: the model, plus the entities, singletons, crons and workflows its adapters need.

A pool is one program that runs every class given to it. Callers outside it hold only the gateway's address and token, and a browser never holds that token. Swapping the pool changes where instances live and what stores them. A pool is acceptable once the conformance suite passes on it, and the Postgres swarm pool is the first to be proved (D5).

### What exists upstream, as of this week

| Layer | Where | State |
| Entities, sharding, singletons, crons, the workflow engine | `effect/cluster`, `effect/workflow` | In Effect 4.1. |
| Cluster on Cloudflare Durable Objects, from Effect itself | `@effect/platform-cloudflare` | Merged 2026-11-10 (#7322), experimental in the 4.1.3 tag. One SQLite object per entity instance. Its README says a singleton wake should run to completion, and a `ClusterCron` needs a trigger to wake its seed (Astra review). |
| Alchemy as the deployer for it | `@effect/platform-cloudflare/AlchemyCloudflareCluster` | `make({ entities, layer })` inside a `Cloudflare.Worker`. Alchemy owns the bindings, class exports and SQLite migrations. Its README says a live deployment smoke has not been run. |
| Cluster as Alchemy resources on any cloud | `@alchemy.run/effect-cluster` | 2026-11-06 (#2924). `Cluster.Entity`, `Singleton`, `Cron`, `Workflow`, and pools for Docker, AWS, GCP, Kubernetes, Fly, Hetzner and Cloudflare. |
| A `Domain.Model` on a cluster pool | `@alchemy.run/domain/EffectCluster` | 2026-11-07 (#3143); on the Durable Object pool since 2026-11-12 (#3276), once that pool grew `RunnerHost` and `InstanceStorage`. PR 3143 describes the domain conformance suite running on Effect Cluster, Cloudflare local and live included. PR 3276 documents a Durable Object bank integration test (Grok pass). |

There are two implementations of cluster on Durable Objects, and they expose different integration contracts. `@alchemy.run/domain/EffectCluster` consumes Alchemy's `RunnerHost` and `InstanceStorage`. Effect's Alchemy helper provides `Sharding`, `WorkflowEngine` and `PersistedQueueFactory`. A Layer alone does not bridge the two (Astra review, claims table). Today a `Domain.Model` reaches Durable Objects only through Alchemy's pool, and the 2.0.0-beta.87 packages do not depend on Effect's. Upstream has run its domain conformance suite on Effect Cluster. This repo has run nothing on a pool. Upstream's suite was not found in the local checkout; D5's suite starts from it once it is located and adds this repo's cases.

### The slice publishes what it runs

Each slice's host publishes a deployment descriptor naming its models and processes. The app composes descriptors onto pools and names no individual model or class. A generator emits the cluster entry modules, one per class, and nobody edits them (D13). This is decided and unproven: nobody has yet checked that the cluster loader accepts generated `main` modules. The pool file below is prototype code and type-checks. The descriptor is a proposal; no `Deployment` module exists.

apps/practice/src/Cluster.ts · prototype code, type-checked

```ts
import * as ClusterDocker from "@alchemy.run/effect-cluster/Docker";
import * as Layer from "effect/Layer";

// Postgres on the local Docker swarm, and two runners. The only file that names a cloud.
export const Database = ClusterDocker.Database("Practice");
export const Default = ClusterDocker.SwarmPool("Default", { replicas: 2 }).pipe(Layer.provide(Database));
```

packages/party/host/src/Party.deployment.ts · apps/practice/src/Practice.deployment.ts · proposed

```ts
// Party.deployment.ts: what the Party slice runs. It names no pool and no cloud.
export const PartyDeployment = Deployment.make({
  name: "Party",
  models: [{ name: "Party", host: hostParty }],
  processes: [MailboxPoller, OutboxRelay, AgentSession],
});

// Practice.deployment.ts: the app places descriptors on its pools.
export const PracticeDeployment = Deployment.compose({
  name: "Practice",
  slices: [
    PartyDeployment.on(Default),
    AuthorityDeployment.on(Default),
    OperationsDeployment.on(Default),
  ],
});
```

apps/practice/generated/cluster/Party.ts · what the generator would emit: the prototype's hand-written entry, which type-checks

```ts
import * as DomainCluster from "@alchemy.run/domain/EffectCluster";
import { hostParty } from "@beep/party-host/Host";
import { Default } from "../../src/Cluster.ts";

// Generated from PartyDeployment. Never edited.
export default hostParty(DomainCluster.layerEntities({ name: "Party", main: import.meta.url, pool: Default }));
```

### A cluster class, split the same way as a block

A cluster class is declared on its own file and implemented in a `.handler.ts`, the same split as a model block. Two rules keep cluster classes from becoming a second, unguarded write path. A cluster class changes domain state only by sending commands through an Api client, under an Invocation its host's trusted boundary built. The model reaches a cluster class only through a port, so stories stay closed-world.

packages/party/host/src/Evidence/MailboxPoller.singleton.ts · MailboxPoller.handler.ts · prototype code, files renamed to the new grammar

```ts
// MailboxPoller.singleton.ts: a name
export class MailboxPoller extends Cluster.Singleton<MailboxPoller>()("PartyMailboxPoller") {}

// MailboxPoller.handler.ts: one poller across the cluster, however many runners there are
export const mailboxPollerLive = (options: { readonly main: string; readonly mailbox: string }) =>
  MailboxPoller.make(
    { main: options.main },
    Effect.gen(function* () {
      const source = yield* ContactSource;        // the port the model declared
      const intake = yield* IntakeApi.Client;     // the same door every other caller uses
      const lastSeen = yield* Ref.make(0);
      return Effect.gen(function* () {
        const since = yield* Ref.get(lastSeen);
        const now = yield* Clock.currentTimeMillis;
        const { assertions } = yield* source.observe({ mailbox: options.mailbox, since });
        yield* Effect.forEach(
          assertions,
          // The command id comes from the source, so a second delivery returns the first receipt.
          (found) =>
            intake
              .AssertClaim(found.claimId, { proposition: found.proposition, signals: found.signals }, { commandId: found.sourceId })
              .pipe(Effect.catchTag("ClaimAlreadyAsserted", () => Effect.void)),
          { concurrency: 1, discard: true },
        );
        yield* Ref.set(lastSeen, now);
      }).pipe(Effect.repeat(Schedule.spaced("1 minute")), Effect.orDie);
    }),
  );
```

A singleton gives one owner at a time, which is shard ownership. It does not make `observe` or any later effect happen once. The command id taken from the source makes the aggregate return the stored result on a second delivery. That id dedupes a delivery and proves nothing about who presented it; authenticity is a separate check, such as a signature over the id, a timestamp and the body (Grok, citing Standard Webhooks 1.0.0). In the prototype the poller acts as a System actor through a fixture Session. In the decided design it acts under an Invocation that the trusted boundary builds from a grant the authority context issued for this process (sketch).

## The directory tree

A worked slice, `party`, as in the prototype. The block names borrow vocabulary from the `@beep/party-domain` README (claims, admission gates, key assignments). They sketch the architecture and propose nothing for that domain. The authority and operations contexts are shown only at package level.

```ts
packages/
  party/                                  one bounded context; one Domain.Model by default
    SLICE.md                              authored: purpose, language, invariants, read order
    contract/                             @beep/party-contract · what browsers and other contexts import
      package.json                        exact exports: ./ReviewerApi, ./AgentApi, ./integration
      src/
        ReviewerApi.contract.ts           the reviewer RpcGroup, from declaration modules (interim)
        AgentApi.contract.ts
        Party.integration.ts              versioned integration facts: PartyMergedV1
    model/                                @beep/party-model · the write and reaction model
      package.json                        exact exports; declaration modules listed one by one
      src/
        Claim/                            a Module: one aggregate and what changes it
          Claim.id.ts
          Claim.aggregate.ts              state union, decide, evolve
          Claim.rules.ts                  pure guards decide starts from
          AssertClaim.command.ts          primary export AssertClaim; its events, its private rejections
          AcceptClaim.command.ts
          ProposeDisposition.command.ts   what an agent run may ask for
          ApproveProposal.command.ts      a person's approval, bound to the proposal's digest
          RetractClaim.command.ts
          ClaimNotPending.rejection.ts    shared by two commands, so it gets a file
          ClaimReview.view.ts
          ClaimReview.handler.ts          the view's validate
        Review/                           where an agent works
          AgentRun.id.ts
          AgentRun.aggregate.ts           lifecycle, parent, grants, budget, prompt and model versions
          StartRun.command.ts
          DelegateRun.command.ts          a child run whose grant can only narrow
          ReserveBudget.command.ts        before every inference or tool call
          SettleUsage.command.ts          after it
          ReviewRun.saga.ts               executes a run and reports outcomes as commands
          ReviewRun.handler.ts
          StartReviewOnAssertion.policy.ts
          StartReviewOnAssertion.handler.ts
          ResumeOnApproval.policy.ts      wakes the run once the approval commits
          ResumeOnApproval.handler.ts
          Reasoner.external.ts            inference is a port with an evaluation contract
        Party/
          Party.id.ts
          Party.aggregate.ts
          RegisterParty.command.ts
          MergeParties.command.ts
          EffectiveParty.view.ts
          EffectiveParty.handler.ts
          MergeOnSameParty.policy.ts
          MergeOnSameParty.handler.ts     relays the Invocation; records a vetoed merge
        KeyAssignment/                    a uniqueness rule, keyed by the value it protects
          KeyAssignment.aggregate.ts
          AssignKey.command.ts            every path that assigns a key reserves here
        Evidence/
          ContactSource.external.ts       a port: contract only
        Directory/
          PartyDirectory.projection.ts
          PartyDirectory.handler.ts
          PartyDirectory.store.ts         the port and its memory twin; takes sequence and generation
          FindParties.query.ts
          FindParties.handler.ts
        Integration/
          PartyFacts.projection.ts        translates private events into integration facts
          PartyFacts.handler.ts
          PartyOutbox.store.ts            the outbox port and its memory twin
        Party.model.ts                    the Domain.Model
        Handlers.ts                       generated from the Model, checked by diff
        Ports.ts                          PartyPorts and the purity assertion
        ReviewerApi.api.ts
        AgentApi.api.ts
      test/
        Claim/AcceptClaim.story.test.ts   one story file per Module's behaviour
        Review/ReviewRun.story.test.ts
        Party.flow.story.test.ts          a few whole-context flows
        Party.verify.test.ts              Domain.verify(PartyModel) is empty
      MODEL.generated.md                  inventory from the Model, linked to source and stories
    host/                                 @beep/party-host · the server runtime's closure
      src/
        Evidence/
          GraphContactSource.adapter.ts   ContactSource over @beep/m365
          FixtureContactSource.adapter.ts the same contract test runs against both
          MailboxPoller.singleton.ts
          MailboxPoller.handler.ts
        Review/
          ClaudeReasoner.adapter.ts       Reasoner over a model driver; records replayable fixtures
          AgentSession.entity.ts          a conversation: a chain of runs, and the worker for the active one
          AgentSession.handler.ts         restartable; rebuilt from its runs on every start
        Directory/
          PartyDirectory.table.ts         a read-model table, never a write model
          PartyDirectory.adapter.ts       the store port over a sql driver
        Integration/
          PartyOutbox.table.ts
          PartyOutbox.adapter.ts          rows keyed by source stream and sequence
          OutboxRelay.singleton.ts
          OutboxRelay.handler.ts          delivers outbox rows to subscribed contexts
        AgentApi.mcp.ts                   toMcp with an explicit expose list
        Adapters.ts                       every port implementation as one Layer
        Config.ts                         server config and secrets
        Host.ts                           hostParty(platform)
        Party.deployment.ts               the models and processes this slice runs
      test/
        ReviewerApi.test.ts               real middleware over Domain.InMemory
        ReviewerApi.contract.test.ts      the contract's group equals the Api's group
    web/                                  @beep/party-web · the browser runtime's closure
      src/
        Connection.ts                     the contract's client and its protocol
        Config.ts                         public config
        generated/                        bindings from the contract, never edited
        ClaimList/
          ClaimList.screen.tsx            a plain screen over generated bindings
        ClaimReview/
          ClaimReview.screen.tsx
          ClaimReview.machine.ts          earned: an approval with a command in flight
          ClaimReview.controller.ts       runs the machine's intents through the bindings
      test/
        ClaimReview.story.test.ts         the machine's specification, no DOM
  authority/                              the authority context; its name is still open
    contract/ model/ host/                Grant, Delegation, Supervision, Accountability; the trusted boundary
  operations/                             the operations context
    contract/ model/ host/                incidents, repairs, quarantine, degraded ports
  shared/
    kernel/                               @beep/kernel · language only: no aggregate, no Model, no Layer
      src/
        Ids.ts                            PrincipalId, OrgId, RunId, GrantId
        Invocation.ts                     the Invocation schema, CurrentInvocation, the stamp and relay helpers
        Session.middleware.ts             declaration; the authority context's host provides it
  ecosystem/
    alchemy-atom/                         contract client to effect/reactivity atoms, for React
apps/
  practice/
    alchemy.run.ts                        the stack: yields the composed deployment
    src/
      Cluster.ts                          pools and the database: the only file that names a cloud
      Practice.deployment.ts              slice descriptors placed on pools
    generated/
      cluster/                            one entry module per class, never edited
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
  contract/
  model/src/
    Claim/
    Review/
    Party/
    KeyAssignment/
    Evidence/
    Directory/
    Integration/
    Party.model.ts
    Handlers.ts
  host/
  web/
```

- Kind folders separate what changes together. A command, the events it records and the rejections only it returns are one decision. The library's convention puts them in one file for that reason, so an `events/` folder has nothing natural to hold.
- The kind is already stated twice. Once in the suffix, once in the primary export's static `kind`. A folder states it a third time and spends the only directory level there is on it.
- A Module folder is a unit of work. A person or an agent changing how claims are accepted needs `Claim/` and nothing else. With kind folders the same change touches five directories. The folders are Modules: each holds a consistency boundary, a process or a read model. A subdomain is a strategic distinction, and a read directory is not one (Kimi review).
- Kind folders grow with the model; Module folders grow with one aggregate. Vault-sync would have a `commands/` folder with 35 files.

## What the files contain

Design order stays schema first, then contract, then implementation. The library holds that order: a command names its events and rejections before any `decide` exists, and the aggregate does not type-check until it handles every one. Each code block below says whether it is prototype code or a sketch of a decided shape. The prototype has the third draft's shape, so most blocks are prototype code with the decided changes applied.

### A command is a complete decision record

packages/party/model/src/Claim/AcceptClaim.command.ts · prototype code with the proposed Invocation in place of by: Actor

```ts
import * as Domain from "@alchemy.run/domain";
import { Invocation } from "@beep/kernel/Invocation";
import { Session } from "@beep/kernel/Session.middleware";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { Proposition } from "../Proposition.ts";
import { ClaimId } from "./Claim.id.ts";
import { ClaimNotPending } from "./ClaimNotPending.rejection.ts";

export const AdmissionGate = LiteralKit(["independent-corroboration", "source-support"]);

/** Companion: refused, the evidence does not clear the gate this proposition needs. */
export class AdmissionGateUnmet extends Domain.Rejection(
  "AdmissionGateUnmet",
  { gate: AdmissionGate, have: S.Int, need: S.Int },
  { httpApiStatus: 422, description: "The claim's evidence does not clear its admission gate." },
) {}

/** Companion: the fact. The Invocation rides in the payload until the library persists request context. */
export class ClaimAccepted extends Domain.Event("ClaimAccepted", {
  proposition: Proposition,
  corroboration: S.Int,
  invocation: Invocation,
}) {}

/** The primary export. The suffix law checks this one. */
export class AcceptClaim extends Domain.Command(
  "AcceptClaim",
  {
    target: ClaimId,
    middleware: [Session],      // builds CurrentInvocation and checks a grant covers AcceptClaim
    events: [ClaimAccepted],
    rejects: [ClaimNotPending, AdmissionGateUnmet],
  },
  { description: "Accept a pending claim once its admission gate is met." },
) {}
```

The `description` is what an agent reads. MCP tools, toolkits, CLI help and the OpenAPI document all show it, so the design requires it on every command, view and query. A command file has one primary export, the command. Its events and private rejections are companions, checked against the command's own `events` and `rejects` (D8).

### The aggregate owns an invariant and its order

Principle 5 asks for tagged unions for lifecycle states. Here the union is the aggregate's state, `decide` guards each transition and `evolve` takes it. An aggregate exists because an invariant needs one owner and one serial order. Its entity id is the consistency boundary: one aggregate instance, never the whole Model.

packages/party/model/src/Claim/Claim.aggregate.ts · prototype code with the proposed Invocation

```ts
export const ClaimState = S.TaggedUnion({
  Unasserted: {},
  Pending: { org: OrgId, proposition: Proposition, signals: S.Array(EvidenceSignal), proposal: S.NullOr(Proposal) },
  Accepted: { org: OrgId, proposition: Proposition },
  Retracted: { org: OrgId, reason: S.String },
});

export class Claim extends Domain.Aggregate("Claim", {
  id: ClaimId,
  state: ClaimState,
  initial: { _tag: "Unasserted" },
  commands: [AssertClaim, ProposeDisposition, ApproveProposal, AcceptClaim, RetractClaim],
  decide: {
    AcceptClaim: Effect.fn(function* (state) {
      const invocation = yield* stamp;                                    // the kernel helper
      const pending = yield* requirePending(state).pipe(Effect.flatMap(requireOrg(invocation)));
      const gate = yield* requireAdmission(pending);                      // Claim.rules.ts
      return [new ClaimAccepted({ proposition: pending.proposition, corroboration: gate.have, invocation })];
    }),
    // AssertClaim, ProposeDisposition, ApproveProposal, RetractClaim: same shape
  },
  evolve: {
    // Total: decide already refused what cannot happen, so a handler keeps any state its event cannot follow.
    ClaimAccepted: (state) =>
      ClaimState.matchOrElse(
        state,
        { Pending: (pending): ClaimState => ClaimState.cases.Accepted.make({ org: pending.org, proposition: pending.proposition }) },
        identity,
      ),
    // ClaimAsserted, DispositionProposed, ProposalApproved, ClaimRetracted: same shape
  },
}) {}
```

A total `evolve` also hides an impossible historical sequence. A replay auditor reads histories, reports transitions `evolve` could not follow, and fails promotion (Astra review, item 10).

### Declaration and handler: two files, one Module

Purity splits across files, and the package line keeps one meaning: a different dependency closure. A handler needs model members and declared ports, never a driver, so it sits beside its declaration in a `.handler.ts`. A policy runs with no request context, so it relays the trigger's Invocation and never acts as System.

packages/party/model/src/Party/MergeOnSameParty.policy.ts · prototype code

```ts
export class MergeOnSameParty extends Domain.Policy(
  "MergeOnSameParty",
  { from: Claim, on: [ClaimAccepted] },
  { description: "Merge the parties an accepted SameParty claim names." },
) {}
```

packages/party/model/src/Party/MergeOnSameParty.handler.ts · sketch over the prototype's handler; relay is proposed

```ts
export const MergeOnSamePartyLive = MergeOnSameParty.toLayer(
  Effect.gen(function* () {
    const parties = yield* Party;
    return Effect.fn(function* ({ event, envelope }) {
      // The trigger carries the event and its envelope and no request context.
      // The policy continues the reviewer's Invocation and appends itself to the chain.
      const relayed = relay(event.invocation, {
        step: "MergeOnSameParty",
        commandId: envelope.commandId,
        correlationId: envelope.correlationId,
      });
      yield* Proposition.match(event.proposition, {
        SameParty: ({ survivor, absorbed }) =>
          parties.send(survivor, new MergeParties({ absorbed })).pipe(
            Effect.provideService(CurrentInvocation, relayed),
            Effect.asVoid,
            // A vetoed merge is its own recorded outcome, so "accepted" and "merged" stay distinct facts.
            Effect.catchTag("MergeVetoed", (vetoed) => recordVeto(envelope.id, vetoed, relayed)),
          ),
        HasIdentifier: () => Effect.void,
      });
    });
  }),
);
```

The separate file keeps every `toLayer` off the paths a client imports. The registry that meets the Model, `Handlers.ts`, is generated from the Model and checked by diff. A declared handler cannot be left out while every suffix check passes (D10).

### A port is a schema-checked contract

model/src/Evidence/ContactSource.external.ts · prototype code

```ts
export class ContactSource extends Domain.ExternalSystem(
  "ContactSource",
  {
    observe: {
      args: { mailbox: S.String, since: S.Number },
      success: { assertions: S.Array(SourceAssertion) },
      error: MailboxUnavailable,
    },
  },
  { description: "Reads a mailbox for claims about parties since a point in time." },
) {}
```

host/src/Evidence/GraphContactSource.adapter.ts · sketch

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

Every call through the adapter is checked against the port's schemas, arguments before and result after. A story can stub the port and assert what each call sent. Driver errors never cross it: the adapter maps them to a declared error or lets them die as defects. A `Domain.ExternalSystem` class is not its own service identifier, so code that names the service uses `Context.Service.Identifier<typeof ContactSource>` (prototype finding).

### Reads: pick the weakest block that answers the question

| Question shape | Block | Stored by | Table needed |
| About one key, live | `Domain.View` | the Platform | no |
| An ordered log per key | `Domain.Stream` | the Platform | no |
| Across keys: search, lists, joins | `Projection` + `Query` | a store the host owns | yes |

Most reads are the first row, so most slices need no table. A view's `validate` runs on each read and each pushed change, against the Invocation captured when the subscription opened. That is not a fresh grant check. How revocation closes an open subscription belongs to the authority context's design and is unproven. An Api lists operations; a capability grant decides who may call them. The `audience` annotation is gone.

A projection runs at least once per input. The library says so itself, and gives each input its envelope, with the source `stream` and `seq`. A crash between a batch and its checkpoint replays the batch (Astra review, item 5). So the sink takes the source sequence and the projection's generation, which is the `version` option a rebuild bumps.

packages/party/model/src/Directory/ · the third row, end to end · sketch: the prototype's store drops the source identity

```ts
// PartyDirectory.store.ts: the port. The host implements it over a sql driver; stories use the memory twin.
export class PartyDirectoryStore extends Context.Service<PartyDirectoryStore, {
  /**
   * Apply one batch from one generation. A change at or below the stored sequence for its source
   * is skipped. A batch from an older generation is refused.
   */
  readonly record: (generation: number, changes: ReadonlyArray<Sourced<DirectoryChange>>) => Effect.Effect<void>;
  readonly search: (
    org: OrgId, text: string, page: Domain.Query.PageRequest,
  ) => Effect.Effect<Domain.Query.Page<DirectoryRow>>;
}>()("Party/PartyDirectoryStore") {}

// PartyDirectory.handler.ts: the envelope keeps each change's source identity.
export const PartyDirectoryLive = PartyDirectory.toLayer(
  Effect.gen(function* () {
    const store = yield* PartyDirectoryStore;
    return Effect.fn(function* (batch) {
      yield* store.record(
        DirectoryGeneration,
        A.map(batch, ({ key, event, envelope }) => ({ source: envelope.stream, seq: envelope.seq, change: changeOf(key, event) })),
      );
    });
  }),
  { batch: { size: 100, wait: "1 second" }, version: DirectoryGeneration },
);

// FindParties.handler.ts: scope to the caller's org, then read.
export const FindPartiesLive = FindParties.toLayer(
  Effect.gen(function* () {
    const store = yield* PartyDirectoryStore;
    return Effect.fn(function* ({ text }, page) {
      const { org } = yield* CurrentInvocation;
      return yield* store.search(org, text, page);
    });
  }),
  { take: { default: 50, max: 200 } },
);
```

### The model, its handlers, and its whole outside world

packages/party/model/src/Party.model.ts · Handlers.ts · Ports.ts · ReviewerApi.api.ts · the forms are prototype code; the members are the decided design

```ts
export class PartyModel extends Domain.Model(
  "Party",
  {
    aggregates: [Claim, Party, KeyAssignment, AgentRun],
    views: [ClaimReview, EffectiveParty],
    policies: [MergeOnSameParty, StartReviewOnAssertion, ResumeOnApproval],
    sagas: [ReviewRun],
    projections: [PartyDirectory, PartyFacts],
    queries: [FindParties],
  },
  { description: "Parties, claims about them, and the review that admits those claims." },
) {}

// Handlers.ts: generated from PartyModel and checked by diff. Never edited.
export const PartyHandlers = Layer.mergeAll(
  ClaimReviewLive, EffectivePartyLive, MergeOnSamePartyLive, StartReviewOnAssertionLive,
  ResumeOnApprovalLive, ReviewRunLive, PartyDirectoryLive, PartyFactsLive, FindPartiesLive,
);

// Ports.ts: everything the model needs from outside itself. Growing this union is an architecture event.
export type PartyPorts =
  | Context.Service.Identifier<typeof ContactSource>
  | Context.Service.Identifier<typeof Reasoner>
  | Context.Service.Identifier<typeof PartyDirectoryStore>
  | Context.Service.Identifier<typeof PartyOutbox>;

/** What every platform gives a hosted model, read off Domain.InMemory. */
export type Host = Layer.Success<typeof Domain.InMemory>;

/** The purity law as a type. A handler that requires anything else fails to compile, and the error names it. */
export const portPurity = PartyModel.layer(PartyHandlers) satisfies Layer.Layer<never, unknown, PartyPorts | Host>;

// ReviewerApi.api.ts: every kind listed, because a kind left out is served whole.
export class ReviewerApi extends Domain.Api(
  "ReviewerApi",
  {
    model: PartyModel,
    commands: ["AcceptClaim", "ApproveProposal", "RetractClaim"],
    views: ["ClaimReview", "EffectiveParty"],
    queries: ["FindParties"],
    streams: [],
  },
  { description: "Review claims about parties, read them, and search the directory." },
) {}
```

The package manager stops the model importing a driver. The `satisfies` line stops a handler requiring a service the model never declared; the prototype's negative probe shows the compiler naming the leaked service. Neither proves a handler's code is pure. `fetch`, `Date.now` and module state leave no Effect requirement (Astra review, item 9), so lint and the reviewer cover them.

a capability declaration · proposed: no Capability module exists, and which package declares capabilities is not yet decided

```ts
// A capability: operations and a resource scope that the authority context can grant to a principal
// or delegate to a run. Granting it is a command in the authority context. This file only names it.
export const ReviewClaims = Capability.make("party.claim.review", {
  operations: [AcceptClaim, ApproveProposal, RetractClaim, ClaimReview, FindParties],
  resource: Resource.Org,
});
```

### The contract is what clients import

The contract package holds what browsers and other contexts compile against: operations, DTOs, public rejections and integration facts. The library cannot build an Api client without the Model today. `Domain.Api` reads the Model's commands, views, streams and queries when it is declared, and `decide` and `evolve` are inline fields of the aggregate declaration. A client that imports an Api imports every aggregate (D9, from a reading of the library source).

Until the library changes, the contract's RpcGroup is written by hand from the declaration modules that import no aggregate: commands, events, rejections, ids and queries. A host test asserts it equals the real Api's group. The target is an upstream contribution with two parts: a model-free Api contract, and an aggregate declaration separate from `decide` and `evolve`, the way `toLayer` already separates views, policies and sagas from their handlers. Once it lands, the contract is generated. All of this is proposed.

A screen that wants `Aggregate.predict` imports the model on purpose (D3). A predicted result is never authorization and never a write.

### The specification is a story

packages/party/model/test/Party.flow.story.test.ts · prototype story with the proposed Invocation

```ts
const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(Layer.mergeAll(MemoryPartyDirectoryStore, MemoryPartyOutbox))),
  stub: [Reasoner],                       // faked: the story answers each call
});

/** Act under this Invocation for the following steps, as the Session middleware would. */
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

it.effect("an accepted SameParty claim merges the parties, through the policy", () =>
  story(
    // Names live in an erasable profile store. The events hold references.
    given(dana, new PartyRegistered({ profile: danaProfile, invocation: intake })),
    given(duplicate, new PartyRegistered({ profile: duplicateProfile, invocation: intake })),
    given(claim, new ClaimAsserted({ proposition: sameParty, signals: twoSources, invocation: intake })),
    as(reviewer),
    when(claim, new AcceptClaim()),
    then(claim, new ClaimAccepted({ proposition: sameParty, corroboration: 2, invocation: reviewer })),
    // The policy ran, for real, under the reviewer's Invocation with one hop appended.
    then(dana, new PartiesMerged({ absorbed: duplicate.id, invocation: relayedBy(reviewer, "MergeOnSameParty") })),
  ),
);

it.effect("one source is not corroboration", () =>
  story(
    given(claim, new ClaimAsserted({ proposition: sameParty, signals: oneSource, invocation: intake })),
    as(reviewer),
    when(claim, new AcceptClaim()),
    rejected(new AdmissionGateUnmet({ gate: "independent-corroboration", have: 1, need: 2 })),
  ),
);

it("the model is well defined", () => expect(Domain.verify(PartyModel)).toEqual([]));
```

A story fails on any event, rejection or external call it does not account for. It runs once per order of its concurrent work that can matter. Coverage counts outcomes that executed: the story runtime is to record which declared outcomes ran, and a rejection tag found in a file does not count (D8, proposed). An author's stories can restate the author's `decide`. So stories are evidence the independent reviewer reads, alongside assertions derived from invariants.

## Agents act under an Invocation

An agent proposes and an aggregate decides, under authority the agent can only narrow. Authority is an `Invocation` built at a trusted boundary. An agent run is an `AgentRun` aggregate: one bounded piece of work, executed by a saga. A person approves through an authenticated command.

All of this section is decided and unproven. The prototype still has `by: Actor`, a saga keyed by the claim, and an approval signal that accepts any Actor. The prototype rework proves this shape first (D15).

### Authority

A trusted boundary builds the `Invocation`. It records who is authenticated, on whose behalf they act, the agent run if one is acting, and the capability grants that cover the call (D4). The Session middleware is that boundary for requests, and the authority context's host provides it. In-process code can provide any context value, so who may build an Invocation is a rule. A syntactic check and the reviewer hold it (proof inventory). Policies and sagas relay the Invocation with the causal chain, and nothing acts as System.

| Concern | Where it lives |
| The `Invocation` schema and its ids | The shared kernel, as language (D7) |
| Grant, Delegation and Supervision aggregates | A dedicated authority context. Its name is still open (D7, D18). |
| Accountability: every agent-rooted action names an accountable human | The authority context, as a general relation (D18) |
| Attorney supervision of nonlawyer work | The law-practice context, checked against Accountability (D18) |
| Building an Invocation | The trusted boundary in the authority context's host |
| Checking a grant covers an operation | Each consuming context, at its command boundary. Contexts check grants and never define them. |
| Storing it with each event | The event payload through one kernel helper now; the event envelope once the library persists request context, which is an upstream contribution (D4) |

packages/shared/kernel/src/Invocation.ts · proposed

```ts
export const CausalHop = S.Struct({ step: S.String, commandId: S.String, correlationId: S.String });

export const Invocation = S.Struct({
  principal: PrincipalId,              // who is authenticated
  onBehalfOf: PrincipalId,             // whose authority the call uses
  accountable: PrincipalId,            // the human answerable for an agent-rooted action (D18)
  org: OrgId,
  run: S.NullOr(RunId),                // the agent run, when an agent acts
  grants: S.NonEmptyArray(GrantId),    // what the call may do
  chain: S.Array(CausalHop),           // every policy and saga hop since the boundary
});
export type Invocation = typeof Invocation.Type;

export class CurrentInvocation extends Domain.RequestContext<CurrentInvocation>()("Kernel/CurrentInvocation", Invocation) {}

/** The one helper decide uses to store the Invocation in an event. Moving it to the envelope changes this line. */
export const stamp = Effect.service(CurrentInvocation);

/** A policy or saga continues the trigger's Invocation with itself appended. It never builds a new one. */
export const relay = (from: Invocation, hop: CausalHop): Invocation => ({ ...from, chain: A.append(from.chain, hop) });
```

Capability grants replace the `audience` annotation. A grant names operations and a resource scope, has an expiry and can be revoked. How revocation reaches queued commands, retries and open subscriptions is part of the authority context's model, and it is unproven.

### The agent run is an aggregate

`AgentRun` is the system of record for a run (D6). It holds the lifecycle, the parent run, the grants, the budget, and the prompt, model and tool-contract versions. A saga executes the run and reports each outcome to it as a command. The saga is keyed by the run id, since a saga key is its execution id. A second review of the same claim is therefore a new run.

packages/party/model/src/Review/AgentRun.aggregate.ts · sketch

```ts
export const RunSpec = S.Struct({
  parent: S.NullOr(RunId),             // the run that delegated this one
  previous: S.NullOr(RunId),           // the run this one continues, after that run reached its bound
  session: S.NullOr(SessionId),        // the conversation whose chain holds this run
  grants: S.NonEmptyArray(GrantId),
  allowance: Budget,
  historyBound: S.Int,                 // events this run may record before it continues as a new run
  prompt: PromptVersion,
  model: ModelId,
  tools: ToolContractVersion,
});

export const RunState = S.TaggedUnion({
  NotStarted: {},
  Running: { spec: RunSpec, remaining: Budget, held: S.Array(Reservation) },
  WaitingForApproval: { spec: RunSpec, remaining: Budget, proposal: ProposalDigest },
  WaitingForChild: { spec: RunSpec, remaining: Budget, child: RunId },
  Completed: { spec: RunSpec, used: Budget },
  Continued: { spec: RunSpec, next: RunId },
  BudgetExhausted: { spec: RunSpec, at: StepId },
  Cancelled: { spec: RunSpec, reason: S.String },
});

export class AgentRun extends Domain.Aggregate("AgentRun", {
  id: RunId,
  state: RunState,
  initial: { _tag: "NotStarted" },
  // Every outcome the saga reports is a command the run can refuse.
  commands: [StartRun, ReserveBudget, SettleUsage, AwaitApproval, DelegateRun, ContinueRun, CompleteRun, CancelRun],
  decide: {
    // ReserveBudget refuses past the allowance. DelegateRun refuses a grant wider than the run's own.
    // ContinueRun is the only way past historyBound.
  },
  evolve: {},
}) {}
```

### Approval is an authenticated command

A person approves by sending `ApproveProposal` through the same Api door as any other command. Its `decide` stamps the person's own Invocation, refuses an Invocation with a run in it, and binds the approval to the digest of the proposal and evidence the person reviewed. A `DurableDeferred` only wakes the run, and it carries the approval's id. The approval record is the committed fact.

packages/party/model/src/Claim/ApproveProposal.command.ts · ResumeOnApproval.handler.ts · sketch; Run.signal is the library's real saga client

```ts
export class ProposalApproved extends Domain.Event("ProposalApproved", {
  approval: ApprovalId,
  run: RunId,
  digest: ProposalDigest,              // the exact proposal and evidence the person reviewed
  invocation: Invocation,
}) {}

export class ApproveProposal extends Domain.Command(
  "ApproveProposal",
  {
    target: ClaimId,
    middleware: [Session],
    input: { approval: ApprovalId, digest: ProposalDigest },
    events: [ProposalApproved, ClaimAccepted],
    rejects: [ClaimNotPending, ProposalChanged, NotAPerson, AdmissionGateUnmet],
  },
  { description: "Approve the agent's proposal you reviewed, by its digest, and accept the claim." },
) {}

// ResumeOnApproval.handler.ts: the committed approval wakes the run that waits on it.
export const ResumeOnApprovalLive = ResumeOnApproval.toLayer(
  Effect.gen(function* () {
    const reviews = yield* ReviewRun;
    return Effect.fn(function* ({ event }) {
      yield* reviews.get(event.run).signal(ApprovalRecorded, event.approval);
    });
  }),
);
```

packages/party/model/src/Review/ReviewRun.saga.ts · ReviewRun.handler.ts · sketch; Activity forms follow the prototype

```ts
export class ReviewRun extends Domain.Saga(
  "ReviewRun",
  {
    key: RunId,
    input: { claim: ClaimId, proposition: Proposition, signals: S.Array(EvidenceSignal), versions: RunVersions, invocation: Invocation },
    rejects: [ReasonerUnavailable, BudgetExhausted, ClaimNotPending, RunClosed],
  },
  { description: "One review run: reserve, assess, settle, propose, wait for a person's approval." },
) {}

/** Wakes the run. It carries the approval's id; the approval itself is a fact on the claim. */
export const ApprovalRecorded = DurableDeferred.make("approval-recorded", { success: ApprovalId });

export const ReviewRunLive = ReviewRun.toLayer(
  Effect.gen(function* () {
    const runs = yield* AgentRun;
    const claims = yield* Claim;
    const reasoner = yield* Reasoner;
    return Effect.fn(function* ({ key: run, claim, proposition, signals, versions, invocation }) {
      const asRun = Effect.provideService(CurrentInvocation, relay(invocation, hopOf(run)));
      const step = StepId.make("assess");

      // Reserve first. The run refuses once its allowance is spent.
      yield* Activity.make({
        name: "reserve",
        error: BudgetExhausted,
        execute: runs.send(run, new ReserveBudget({ step, allowance: assessAllowance })).pipe(Effect.asVoid, asRun),
      });
      // An activity can repeat a call, so the provider gets an idempotency key.
      const assessed = yield* Activity.make({
        name: "assess",
        success: Assessment,
        error: ReasonerUnavailable,
        execute: reasoner.assess({ proposition, signals, run, step, versions, idempotencyKey: `${run}/${step}` }),
      });
      yield* Activity.make({
        name: "settle",
        error: RunClosed,
        execute: runs.send(run, new SettleUsage({ step, usage: assessed.usage })).pipe(Effect.asVoid, asRun),
      });
      yield* Activity.make({
        name: "propose",
        error: ClaimNotPending,
        execute: claims.send(claim, new ProposeDisposition(assessed)).pipe(Effect.asVoid, asRun),
      });
      // The run sleeps until ApproveProposal commits. A policy signals this wait.
      yield* DurableDeferred.await(ApprovalRecorded);
      yield* Activity.make({
        name: "complete",
        error: RunClosed,
        execute: runs.send(run, new CompleteRun()).pipe(Effect.asVoid, asRun),
      });
    });
  }),
);
```

### Delegation narrows, and budget is reserved

Delegation is a command on the parent run. It creates a child run whose grant is a Delegation issued by the authority context, and the authority context refuses any grant wider than the parent's in operations, resources, expiry or budget. Budget is reserved before an inference or tool call and settled after it. A failed call releases its reservation. A parent allocates part of its allowance to each child, so two children cannot spend the same allowance (D6).

### A run is bounded, and a session holds the chain

A run is one bounded piece of work, its wait for approval included, with a bound on its history (D23). A long conversation or a standing assignment is an `AgentSession` cluster entity. It holds a chain of runs and is the restartable worker for the active one, rebuilt from those runs on every start. A run that reaches its bound records `Continued`, and a new run carries the state forward with `previous` set. Workflow engines cap history for this reason: Temporal warns at 10,240 events and terminates an execution past 51,200 (Grok research). The bound's value is not decided.

### Two agent surfaces, by role

Agents get two surfaces, and both are the contract package pointed at a different runtime (D21).

| Role | Surface | Authority | What a person controls |
| An agent that operates the system | Derived tools: `toMcp` or `toToolkit` over an Api | A capability grant on every call, narrowed to the run | A person can deny any call. A call that changes the world waits for approval. |
| An agent that writes or composes code | The generated contract client, inside a sandbox | The sandbox holds bindings and nothing else: no general network, no keys | The code reaches the system only through those bindings, each under its grant. |

One tool per command suits an agent that stays subject to a person's denial. The MCP tools specification says a human should always be able to deny a tool invocation, and that servers apply access controls. For an agent writing code against the system, a generated TypeScript client in a sandbox with bindings only is the better surface; Cloudflare's Code Mode is that shape (Grok research). A machine-checked architecture law is a different thing from a person's denial and replaces none of it.

### The Reasoner port carries an evaluation contract

Inference stays a port. Every Reasoner adapter records replayable fixtures: the request, the response, and the prompt, model and tool-contract versions. A change to a prompt, a model or a tool contract passes a recorded evaluation before release (D19). A stubbed Reasoner in a story proves orchestration and says nothing about agent quality. Building the evaluation harness is a later goal.

packages/party/model/src/Review/Reasoner.external.ts · the prototype's port with the run's identity added · sketch

```ts
export class Reasoner extends Domain.ExternalSystem(
  "Reasoner",
  {
    assess: {
      args: {
        proposition: Proposition,
        signals: S.Array(EvidenceSignal),     // each signal carries its trust label
        run: RunId,
        step: StepId,
        versions: RunVersions,                // prompt, model and tool-contract versions
        idempotencyKey: S.String,
      },
      success: { disposition: Disposition, rationale: S.String, usage: Usage, fixture: FixtureRef },
      error: ReasonerUnavailable,
    },
  },
  { description: "Assesses a claim's evidence and proposes a disposition with a rationale." },
) {}
```

### What an agent may do, and what it did

| Agent concern | Block | What it gives |
| Who is acting | The `Invocation`, from the trusted boundary | Principal, on-behalf-of, accountable human, run and grants are separate fields, and every event stores them. |
| A model call | The Reasoner port | Output checked against a schema at the adapter; stubbed in stories; fixtures recorded for evaluation. |
| A run | `AgentRun`, a saga, an `AgentSession` entity | One owner for lifecycle, budget and versions. Durable steps. A worker that survives a restart. |
| A person's sign-off | `ApproveProposal` | An authenticated command bound to the proposal's digest. |
| What an agent may do | A grant over an Api's operations | Least privilege comes from the grant. Listing a command in an Api only publishes it. |
| What an agent did | Events with their Invocation, joined by correlation id | An audit trail built by the commit itself. |
| What an agent read | `AccessRecorded` events | Reads of privileged material are on the record (D14). |

### The same model, for the agents that write the code
- One block per file, named by kind. The unit an agent edits is small and uniform, and a glob finds it: `**/*.command.ts`. Each file has one primary export.
- A context is sized by its language. A tool's context window plays no part in where a boundary falls (D2). An agent gets a bounded task and generated dependency views.
- Story first. The acceptance criterion for a change is a story, written before the block. The local loop is story, block, `Domain.verify`, then the mechanical checkers.
- Nothing is registered by hand. Adding a command regenerates the handler registry, the contract and the bindings.
- An independent reviewer. Semantic questions go to an agent that did not write the change. A person decides only where that reviewer and the author disagree (D8).
- Two first files. An authored `SLICE.md` for purpose, language and invariants, and a generated `MODEL.generated.md` for the inventory. This split comes from the Kimi review and has no decision yet.

## The host and the web

### The repo implements no platform driver

The host package provides the ports and hosts the model on whatever platform it is handed. The app hands it a cluster pool; a story or an Api test hands it `Domain.InMemory`. The repo implements no `Domain.Platform` driver. Deployment, data evolution and recovery still have owners: the slice's deployment descriptor, the compatibility contract and the operations context. Postgres on the Docker swarm pool is the first host proved, and `@beep/alchemy-postgres` stays until the conformance suite passes there (D5).

packages/party/host/src/Adapters.ts · Host.ts · prototype code

```ts
// Adapters.ts: every port the model declared, implemented
export const PartyAdapters = Layer.mergeAll(GraphContactSource, ClaudeReasoner, PgPartyDirectoryStore, PgPartyOutbox);

// Host.ts: the model, its handlers and its adapters, on the platform you give it
export const hostParty = <ROut, E, RIn>(platform: Layer.Layer<ROut, E, RIn>) =>
  SessionLive.pipe(
    Layer.provideMerge(PartyModel.layer(PartyHandlers)),
    Layer.provideMerge(PartyAdapters),
    Layer.provide(platform),
  );

// An Api test: the same model and handlers, on memory
const World = hostParty(Domain.InMemory);
```

In the prototype, `SessionLive` is a fixture that trusts caller headers, and it says so. In the decided design the authority context's host provides the Session middleware and the app supplies it to each slice host (sketch).

### Delivery is derived, except where it faces strangers

| Surface | How | File |
| Your own apps | The contract's typed client over HTTP and WebSocket | `web/Connection.ts` picks the protocol |
| Operating agents | `toToolkit` in the app, `toMcp` outside it, with an explicit expose list, each call under a grant | `host/<Api>.mcp.ts` |
| Coding agents | The contract client in a sandbox with bindings only | where the sandbox runs |
| Operators | The operations context's Api, and `toCli` | the operations context's host |
| Partners and the public | A hand-written `HttpApi` with its own response schemas, calling `clientInProcess` | `host/<Partner>.http.ts` |
| Other contexts | Integration facts through the outbox; synchronous calls through the provider's contract | `host/Integration/` |
| Pollers, consumers, schedules | A singleton or cron that sends commands with ids derived from the source | `host/<Module>/<Name>.singleton.ts`, `.cron.ts` |

### React over generated bindings

The web package stays React. An ordinary screen is one `*.screen.tsx` over bindings generated from the contract. The bindings own view subscriptions, command atoms that create command ids and return typed rejections, read-after-write and reconnect. A screen with real interaction law adds a `.machine.ts`, a `.controller.ts` and a story. Multi-step editing, offline intents, approval queues and gestures earn one (D12). No binding generator exists yet, so the binding names below are proposals.

packages/party/web/src/ClaimList/ClaimList.screen.tsx · proposed bindings

```ts
export const ClaimList = ({ org }: { readonly org: OrgId }) => {
  const claims = useAtomValue(Reviewer.views.OpenClaims(org));      // a generated view subscription
  const retract = useAtomSet(Reviewer.commands.RetractClaim);      // creates the command id, returns typed rejections
  return <ClaimTable rows={claims} onRetract={(target) => retract({ target, input: { reason: "duplicate" } })} />;
};
```

### A machine correlates on command id, receipt and view revision

The third draft's machine cleared its pending state on any view change. A delayed snapshot then let a second press send a second command while the first was in flight, and a late refusal could clear a newer request (Astra review, item 8). The decided machine tracks three things apart. The command id says which request. The receipt says the command committed. The view revision, and the checkpoint the view has applied, say the screen caught up. A transport failure is an unknown outcome, retried with the same command id.

packages/party/web/src/ClaimReview/ClaimReview.machine.ts · sketch

```ts
export const Pending = S.Struct({ commandId: CommandId, digest: ProposalDigest, receipt: S.NullOr(Receipt) });

export const Screen = S.Struct({
  review: S.NullOr(ClaimReview.state),
  revision: ViewRevision,                    // the newest view revision applied
  pending: S.NullOr(Pending),                // the one approval in flight
  refusal: S.NullOr(ApproveProposal.rejection),
});

export const Message = S.TaggedUnion({
  ApprovePressed: { commandId: CommandId, digest: ProposalDigest },
  Committed: { commandId: CommandId, receipt: Receipt },                   // the server accepted it
  Refused: { commandId: CommandId, rejection: ApproveProposal.rejection },
  Unknown: { commandId: CommandId },                                       // the transport failed
  ReviewChanged: { review: ClaimReview.state, revision: ViewRevision, applied: Checkpoint },
});

const mine = (screen: Screen, commandId: CommandId) => screen.pending?.commandId === commandId;

/** Pure. Everything this screen can do is a branch here. */
export const update = (screen: Screen, message: Message): readonly [Screen, ReadonlyArray<Intent>] =>
  Message.match(message, {
    ApprovePressed: ({ commandId, digest }) =>
      screen.pending !== null
        ? [screen, []]                                                      // one approval at a time
        : [{ ...screen, pending: { commandId, digest, receipt: null }, refusal: null }, [sendApprove(commandId, digest)]],
    Committed: ({ commandId, receipt }) =>
      mine(screen, commandId) && screen.pending !== null
        ? [{ ...screen, pending: { ...screen.pending, receipt } }, []]
        : [screen, []],
    Refused: ({ commandId, rejection }) =>
      mine(screen, commandId) ? [{ ...screen, pending: null, refusal: rejection }, []] : [screen, []],
    Unknown: ({ commandId }) =>
      mine(screen, commandId) && screen.pending !== null
        ? [screen, [resendApprove(screen.pending)]]                         // the same id, so it applies once
        : [screen, []],
    ReviewChanged: ({ review, revision, applied }) =>
      revision <= screen.revision
        ? [screen, []]                                                      // an older snapshot changes nothing
        : [{ ...screen, review, revision, pending: caughtUp(screen.pending, applied) ? null : screen.pending }, []],
  });
```

packages/party/web/test/ClaimReview.story.test.ts · a small test kit modelled on foldkit/story · proposed

```ts
it("a delayed first snapshot does not release the pending approval", () =>
  story(update)(
    given(emptyScreen),
    message(approvePressed("cmd_1", digest)),
    intents([sendApprove("cmd_1", digest)]),
    message(reviewChanged(pendingClaim, 3, before(receipt))),   // newer, but it has not applied the command
    message(approvePressed("cmd_2", digest)),                   // a second press
    intents([]),                                                // sends nothing
    message(committed("cmd_1", receipt)),
    message(reviewChanged(acceptedClaim, 4, after(receipt))),
    model((screen) => expect(screen.pending).toBeNull()),
  ));
```

No DOM, no server, no timers. A screen story fails on an intent it did not expect, the way a model story fails on an event it did not expect. A second test asserts the rendered tree, and browser QA proves real gestures reach the machine. The screen-story kit and the `@beep/alchemy-atom` binding are proposals. The kit borrows Foldkit's story pattern, which calls a pure update and keeps commands as data. Foldkit itself is not adopted (operator, `CAPTURE.md`).

## Between contexts

A context never imports another context's model. Facts cross as versioned integration facts, through the producer's outbox and the consumer's inbox. Synchronous calls go through a port the consumer declares, implemented over the provider's contract (D11). Both are decided and unproven; the prototype has one context.

The upper half is a fact crossing asynchronously. Party translates its private events into a published, versioned fact in its outbox. Law-practice records the fact in an inbox, translates it into its own words and sends its own command. The lower half is a synchronous call. Law-practice's model depends on a port it wrote, and only its adapter knows that Party answers, through Party's contract. Where Party's entities run is the cluster's concern; the adapter is the same code either way.

packages/party/contract/src/Party.integration.ts · packages/party/model/src/Integration/PartyFacts.handler.ts · proposed: no IntegrationEvent builder exists

```ts
// Party.integration.ts: a fact other contexts may rely on. Its version is part of its name.
export class PartyMergedV1 extends IntegrationEvent("party/PartyMerged", 1, {
  survivor: PartyId,
  absorbed: PartyId,
  occurredAt: S.DateTimeUtc,
}) {}

// PartyFacts.handler.ts: a projection whose store port is the outbox.
// An upsert keyed by stream and sequence, so a replayed batch writes nothing new.
export const PartyFactsLive = PartyFacts.toLayer(
  Effect.gen(function* () {
    const outbox = yield* PartyOutbox;
    return Effect.fn(function* (batch) {
      yield* outbox.put(
        A.map(batch, ({ key, event, envelope }) => ({
          eventId: `${envelope.stream}/${envelope.seq}`,
          fact: new PartyMergedV1({ survivor: key.id, absorbed: event.absorbed, occurredAt: envelope.at }),
        })),
      );
    });
  }),
);
```

- A synchronous request goes from a consumer port, through a host adapter, to the provider's contract. It replaces `shared/use-cases`, which existed to hold these contracts.
- An asynchronous fact goes from the provider's integration fact and outbox to the consumer's inbox and translation. The inbox key becomes the command id, so a fact delivered twice returns the first receipt. The consumer's policy owns the reaction; a relay singleton only moves rows.
- No context imports another context's aggregate, private event, view, store, handler or model. A stored domain event rebuilds the producer's state. Letting another context follow it would make every internal refactor a public breaking change.
- The shared kernel is language only: ids, values, the `Invocation` schema and the `Session` middleware declaration. No aggregate, no Model, no Layer.
- Contexts are named by language. "Every name has one meaning" is the test, and context naming stays with the reviewer. By that test `documents` holds at least two contexts.

## The role vocabulary

One rule generates most of it. `<Module>/<Noun>.<kind>.ts` declares a block, a `.handler.ts` beside it implements it, and an `.adapter.ts` in the host implements a port over a driver. Each file has one designated primary export, and a checker compares that export's static `kind` with the suffix (D10, D8). The suffixes stay alongside generated maps because a glob can find them and a checker can test each one.

 model package

| Suffix | Holds |
| `.id.ts` | An aggregate's branded id |
| `.command.ts` | A command; its events and private rejections as companions |
| `.rejection.ts` | A rejection several commands share |
| `.aggregate.ts` | State union, decide, evolve, reply |
| `.rules.ts` | Pure guards that decide starts from |
| `.view.ts` `.stream.ts` | Reads |
| `.policy.ts` `.saga.ts` | Reactions and processes |
| `.projection.ts` `.query.ts` | Store writers and readers |
| `.handler.ts` | The implementation of a view, policy, saga, projection or query |
| `.store.ts` | A store port and its memory twin |
| `.external.ts` | An `ExternalSystem` contract |
| `.context.ts` `.middleware.ts` | Request context and middleware declarations |
| `.api.ts` `.model.ts` | Apis; the context's Model |
| `Handlers.ts` `Ports.ts` | The generated registry; the ports union and the purity assertion |

 contract package

| Suffix | Holds |
| `.contract.ts` | An Api's RpcGroup for clients; hand-written until the upstream split, then generated |
| `.integration.ts` | Versioned integration facts |
| `package.json` | Exact exports, one per entry point |   web package

| Suffix | Holds |
| `Connection.ts` | The contract's client and its protocol |
| `generated/` | Bindings from the contract, never edited |
| `.screen.tsx` | React: a screen over bindings or a machine |
| `.machine.ts` | Screen state, messages, pure update |
| `.controller.ts` | Runs a machine's intents through the bindings |
| `Config.ts` | Public config |

 host package

| Suffix | Holds |
| `.adapter.ts` | A port implemented over a driver |
| `.table.ts` | A read-model or outbox table |
| `.entity.ts` `.singleton.ts` | A cluster class: an addressed process, or one owner at a time |
| `.cron.ts` `.workflow.ts` | A cluster class: scheduled work, or a long job |
| `.handler.ts` | A cluster class's implementation |
| `.http.ts` `.mcp.ts` | A partner `HttpApi`; a derived tool surface |
| `Adapters.ts` `Host.ts` | Composers |
| `<Slice>.deployment.ts` | The deployment descriptor |
| `Config.ts` | Server config and secrets |

 retired

`.live.ts`. Subdomain folders, which become Modules. The `audience` annotation, replaced by capability grants. `Actor` and `CurrentActor`, replaced by `Invocation`. A hand-kept `Handlers.ts` and hand-written app entry modules, both generated now. Wildcard package exports. `.atoms.ts` and `.view.tsx` as web roles.

From today's standard: the `use-cases`, `tables`, `client`, `ui` and `config` packages; the domain-kind folders; the domain roles `.values.ts`, `.errors.ts`, `.behavior.ts`, `.machine.ts`, `.access.ts`, `.contracts.ts` and `.events.ts`; every use-case role; `.repo.ts` and the six `-handlers.ts` server roles; the hand-written client roles; the entity kit; the planned eventlog, message-storage, workflow and sharding drivers. `@beep/alchemy-postgres` goes once the conformance suite passes on the swarm host.

The decisions name no suffix for a middleware's server half. This draft would use `.adapter.ts`, since it implements a declared contract over a driver, the identity provider. That choice is open.

### Legal imports

| Package | Resolves | Cannot resolve |
| contract | its model's declaration entry points (commands, events, rejections, ids, queries), `@alchemy.run/domain`, `effect`, `@beep/kernel` | any `.aggregate.ts`, `.handler.ts` or `.model.ts`; the host; drivers |
| model | `@alchemy.run/domain`, `effect`, `@beep/kernel`, foundation primitive and modeling | drivers, React, the DOM, Node, any other context |
| host | its own model and contract, drivers, foundation, `@alchemy.run/effect-cluster`, another context's contract | React, a pool or cloud provider package, another context's model or host |
| web | its own contract and generated bindings, React, `@beep/alchemy-atom`, `foundation/ui-system`, driver `/browser` subpaths; its own model only for `Aggregate.predict` | any `.handler.ts` or `.adapter.ts`, the host, driver roots |
| app | slice hosts and their deployment descriptors, webs, pools and cloud provider packages, the authority context's Session middleware | Module-level internals of any context |

## The proof inventory

Each invariant is listed with its checker, what the checker reads, and what stays with the independent reviewer. Model reflection gives structural checks only. Paths, imports, baselines, executed stories and type checks are separate inputs with separate checkers. Mechanical checks catch mechanical mistakes. Semantic questions go to a reviewer agent that did not write the change, and a person decides only where that reviewer and the author disagree (D8). The checkers are proposed; only `Domain.verify` and the purity assertion run today.

| Invariant | Checker | Reads | Stays with the reviewer |
| The model is well formed | `Domain.verify(Model)` is empty in each model package | the Model value | whether aggregate boundaries follow invariant ownership |
| A file's suffix names its primary export | a source check: one designated primary export per file, its static `kind` equal to the suffix | each file's exports | nothing |
| Companions belong to their primary | a source check: the events and rejections in a `.command.ts` are the ones its command lists | command declarations | nothing |
| Every handler is registered, and only those | regenerate `Handlers.ts` from the Model and diff | the Model, handler files | nothing |
| Handlers require only declared ports | `satisfies Layer.Layer<never, unknown, PartyPorts | Host>` under `tsc` | Effect requirement types | code purity: `fetch`, `Date.now` and module state leave no requirement; lint flags the known ones |
| A package is one closure | a manifest check against each package kind's allowed set; exact `exports` | `package.json` | ambient globals a manifest cannot see |
| The contract carries no write model | the import graph from each contract entry, and a built browser artifact check | import graph, bundle | which operations and facts are public |
| The contract matches the Api | a host test comparing the hand-written group with the Api's group | both RpcGroups | nothing |
| Every operation needs a grant | authorization stories: allowed, missing grant, revoked grant, other tenant | executed stories | capability scope |
| Only a trusted boundary builds an Invocation | a Biome GritQL rule on every `provideService(CurrentInvocation, …)`: the value must come from `relay` | source | a new trusted boundary |
| A retried command id is safe | replay tests: accepted replay, changed payload, changed command, other tenant, after revocation | executed tests | nothing |
| Stored formats convert on read | frozen old-format fixtures with semantic expected values, round-trip laws and replay equivalence, for state, events, receipts, request context and saga payloads | fixtures, codecs, read-time transforms | whether a transform keeps the meaning; whether a new tag is a new fact |
| Stored bytes are never rewritten | a check that no migration writes to event, state or receipt storage | migration files | nothing |
| History has no impossible transition | a replay auditor over cut histories | histories, `evolve` | whether a flagged sequence is a bug or needs a transform |
| Projection sinks survive replay | the store contract test, on the memory twin and on the adapter: repeated batch, stale batch, new generation | sink behaviour | nothing |
| Every declared outcome executes in a story | the story runtime records executed outcomes per command and per machine message | story runs | whether a story tests the invariant or restates `decide` |
| A behaviour change is explained | replay-diff over production-cut histories before a `decide` or `evolve` change lands | the send journal, histories | whether the declared migration is right |
| Contexts cross by contract only | an import boundary: a host imports another context's contract and nothing else of it | import graph | context naming and boundaries |
| A slice names no cloud | a manifest check: only apps depend on pools and provider packages | `package.json` | nothing |
| Generated files are fresh | regenerate and diff: registry, contract, bindings, entry modules, model inventory | generator output | nothing |
| Everything callable is described | Model reflection: every command, view, query and Api has a `description` | the Model value | whether the description is accurate |
| Every stored field has a retention class | a schema annotation check | event and state schemas | which class a field gets; what an event may retain |
| A Reasoner change is evaluated | a recorded evaluation before release; the harness is a later goal (D19) | recorded fixtures | the release threshold |

### Checked against the eight principles

| Principle | Under this design |
| Slice first | Stronger. A slice is a bounded context, and its Model is a value the tools can read. |
| Ports inward, adapters outward | Stronger. The model cannot resolve a driver, ports are schema-checked, and handler requirements are a type. |
| Shared is a shared kernel | Narrower. Language only, the `Invocation` schema included. |
| Rich domain, pure behavior | One home. Rules live in `decide`; time arrives as an argument, never from a clock. |
| Schemas are executable contracts | Extended. Every block is a schema class, and every stored format has a compatibility contract. |
| Topology is compressed context | Kept. Generated files are checked by diff, and semantic choices by the independent reviewer. |
| Non-slice families are explicit | Authority and operations become contexts. One ecosystem member arrives. An app composes deployment descriptors. |
| One public origin | Unchanged. |

## What the design makes true

These are properties of an event-sourced model hosted on Effect Cluster. Each is a modelling rule and belongs in the standard. Most are new or corrected since the third draft, after the Astra review and the Grok research.

### A stored fact is permanent, and every stored field has a retention class

Events are never rewritten. Content that may have to be erased (names, document text, evidence excerpts) lives in a store behind a port, and erasure leaves a tombstone. An id can still identify a person, so a reference alone does not settle retention. The prototype stored names and excerpts in events, against the third draft's own rule.

### Stored formats convert on read

Stored bytes are never rewritten. Payload conversion covers added defaults, removals, renames and compatible type changes. An incompatible change is one declared read-time transform per version step. A new event tag is for a new fact only, so `evolve` keeps one language (D22).

### An aggregate owns an invariant and its order

Choose an aggregate by the invariant it holds and the serial order that invariant needs. Whether a command can be refused plays no part: a fact-only ledger can need one ordered owner with no rejections, and an upload store can refuse writes and still be a store. Corpus text, embeddings, RDF triples and mail indexes are stores behind ports.

### A cross-aggregate invariant needs a reservation every conflicting path takes

There is no cross-aggregate transaction. A uniqueness rule becomes an aggregate keyed by the value it protects, with rules for release, reassignment and the moment an assignment counts. It holds only if every path that could break the invariant reserves through it. Compensation cannot undo a violation someone already saw.

### No primitive gives an external effect exactly once

Activities persist steps, a singleton is one owner at a time, and a cron retries failed runs and skips stale ones. Each can still repeat a call. A provider call carries an idempotency key the provider honours, or the step records an uncertain outcome and a reconciliation settles it.

### A retried command id returns the stored result before `decide` runs

So a cached result needs its own authorization check, and an idempotency key binds to tenant, operation and a canonical fingerprint of the request. The same id with a different request is refused. A rejection is not stored, so a retried rejected command runs `decide` again.

### Projections are at least once

A crash between a batch and its checkpoint replays the batch. Sinks take the source stream, its sequence and the projection's generation. They skip what they have applied and refuse an older generation.

### A read names the write it follows

Views and projections are delivered after the commit, so an immediate read can return the earlier state. A caller that writes then reads passes the receipt as `atLeast`. Whether `atLeast` waits on the platform's delivery or only names a cursor is still to be checked. A screen correlates its pending command on command id, receipt and view revision.

### Authority is relayed, never stamped

Every command runs under an Invocation built at a trusted boundary. A policy or saga continues the trigger's Invocation and appends itself to the chain. No reaction acts as System, and every agent-rooted action names an accountable human.

### Everything that runs has an address or an owner

A stateful process is an entity with an id. A loop is a singleton, owned by one runner at a time. A schedule is a cron. A run is bounded and continues as a new run at its bound. Nothing in a host forks a background fiber of its own.

### Rules ship where they are chosen

Browsers and other contexts import the contract. A screen that predicts with `decide` imports the model on purpose, and a prediction is never authorization or a write. Secrets live in a host's `Config.ts` and nowhere else.

### Every transition has a story

On the server a transition is `decide` and `evolve`. In the browser it is `update`. Both are pure, both are specified by a story that fails on anything it did not expect, and coverage counts outcomes that executed.

## Durable compatibility and replay

Every stored format has a compatibility contract: aggregate state, events, receipts, request context, and saga payloads and results. Stored bytes are never rewritten; formats convert on read (D14, D22). Replay modes rebuild read models without repeating side effects.

| Stored format | How the library reads it | What proves a change |
| Events | The kernel picks the codec by the stored `_tag`, then decodes | Frozen old-format fixtures with expected values; replay equivalence |
| Aggregate state | Decoded directly on load; an event codec does not migrate it | Fixtures of stored state, or a rebuild from events that matches |
| Receipts | Their own event and reply decoding | Fixtures, and the retried-command tests |
| Request context | Restored through registered service keys | Fixtures of the stored `Invocation`, which one kernel helper writes |
| Saga payloads, deferred values, results | The workflow engine, across a deploy | Fixtures taken from a running saga before the change |
| Projection rows | The sink | Source sequence and generation; a rebuild into a new generation |
- Convert on read. Payload conversion handles added fields with defaults, removed fields, renames and compatible type changes. An incompatible change is one declared read-time transform per version step. A new event tag is for a new fact only. A widen-only rule would send every rename to a new tag and fork the language `evolve` reads. Axon Framework 5.4 draws the same line and leaves stored events in the form they were written (Grok research).
- A codec picked by tag cannot rescue an old tag. The library chooses the event codec by the stored `_tag` before decoding, so the transform for a renamed event belongs to the old tag's read path (library source, re-read 2026-11-13).
- Decoding is not the whole proof. A decode-only check passes a codec that maps every old amount to zero. Each change carries frozen old-format fixtures with semantic expected values, round-trip laws and replay equivalence, and a matrix of which old and new writers and readers may run together (Astra review, item 2).
- Idempotency keys bind to tenant, operation and a canonical request fingerprint. A cached result is authorized on its own. The tests are accepted replay, changed payload, changed command, other tenant and replay after revocation.
- Projection sinks take source sequence and generation. Bumping a projection's `version` rebuilds it over the whole history; the library runs one backfill per consumer generation (`Backfill.ts`).
- Replay modes suppress side effects. Rebuilding a read model does not restart policies, call the Reasoner, send mail or publish integration facts. In the library's delivery, replayed history is marked, and views and projections apply it while policies ignore it.

## The operations context

Operations is a bounded context with its own model. Every repair is a command that an agent proposes and an aggregate decides. A poisoned instance is quarantined. Each port declares a degraded mode. An operations Api carries the recovery verbs (D14).

An incident opens from signals the system already has: a saga that `Died` or was `Rejected`, a policy out of retries, a failing port. A triage saga asks the Reasoner for a schema-checked repair proposal and attaches what `Aggregate.predict` says the repair would do. The repair aggregate accepts a proposal only when the prediction is definite, one instance is touched, the fan-out is under budget and no external operation is reachable. A refused repair pages a person. This shape comes from the ADHD pass, focus 2, and is a sketch.

The operations Api lists pause, inspect, reconcile, retry, rebuild and retire. Each runs under a grant and returns a receipt. Quarantine lives in the host. A degraded port answers `Deferred` and writes the call to an outbox for later.

Unverified: the ADHD pass reported that the Domain cluster host rebuilds a defecting model entity with a retry policy that never stops. Nobody has re-checked it. The first test makes one id's `evolve` throw and asserts that sibling ids still answer.

## Stories cut from production

Production histories become stories. A journal on aggregate sends records what the stored log lacks: the command, its Invocation, the rejection and the port answers. A cut joins one journal row to its stream and emits story steps (D14).

Fixtures are pseudonymised with a keyed hash. A fixture whose outcome changes under scrubbing stays inside production. Before a change to `decide` or `evolve` lands, a replay-diff folds sampled histories through the new code and re-decides the journaled commands. A difference passes only when a declared migration reproduces it on every sample. An outcome production has reached counts as covered only by a cut story.

This rests on `decide` depending only on what the journal captured. The journal holds the most sensitive data in the system, so it gets the strictest retention class.

## Retention and trust

Every stored field has a retention class, and erasure leaves a tombstone. Agent reads of privileged material are recorded. Content from outside carries a trust label that limits which actions it can influence (D14).

Events keep facts and references. Erasable content (names, document text, evidence excerpts, prompts, transcripts) lives in stores behind ports, each with its retention class. Erasure replaces the content with a tombstone and keeps the reference. Copies, caches and backups follow the same class. No source checked so far establishes that a reference left in a private log satisfies an erasure duty, so the design claims erasure of content and nothing more (Grok research).

When an agent reads privileged material, the read becomes an `AccessRecorded` event on its run. Mail, documents, retrieved memories and tool results can carry instructions. Each item carries a trust label, and a grant can name which labels may influence which operations. `decide` checks invariants and cannot tell a proposal shaped by an injected instruction from a sound one. Grants stay narrow, and trust labels gate what untrusted content may influence.

## What is proven

Six tests pass in memory on the third draft's shape. Nothing in this repo has run on a cluster. Every shape this page decides is unproven until the reworked prototype runs it.

| What | State | Evidence |
| A command through `decide` with the Session middleware; one source refused as corroboration | Proven in memory | `Party.story.test.ts`, prototype on `@alchemy.run/domain` 2.0.0-beta.87 and effect 4.1.4 |
| A policy reacting to a committed event, with deterministic command ids | Proven in memory | the SameParty merge story |
| A saga with a stubbed Reasoner and a durable wait | Proven in memory | the assistant story |
| A projection and a paged query scoped to the caller's org | Proven in memory | the directory story |
| `Domain.verify(PartyModel)` is empty | Proven in memory | `Party.verify.test.ts` |
| An Api call through real Session middleware, in process | Proven in memory | `ReviewerApi.test.ts` over `hostParty(Domain.InMemory)` |
| Port purity as a type, naming the leaked service | Type-checked; negative probe recorded | `Handlers.ts`, `probes/leak-probe-output.txt` |
| Cluster wiring: Docker database, swarm pool, entry modules, singleton | Type-checked only | `apps/practice`. An `alchemy plan` failed while importing the stack and was not investigated. |
| A retried id skips `decide`; a projection checkpoint follows its batch; the event codec is picked by stored tag | Read in library source; holds | `DurableObjects.ts`, `Kernel.ts` |
| Four packages and the contract (D3, D9) | Decided, unproven | the prototype has model, host and app |
| Invocation, grants, relay, the authority context, Accountability (D4, D7, D18) | Decided, unproven | the prototype has `by: Actor` |
| AgentRun, delegation, budget, authenticated approval, bounded runs, sessions (D6, D23) | Decided, unproven | the prototype's saga is keyed by the claim |
| Two agent surfaces, a sandbox for coding agents (D21) | Decided, unproven | no sandbox exists |
| File grammar, generated registry, exact exports (D10) | Decided, unproven | the prototype uses `.live.ts` and a wildcard export |
| Integration facts, outbox and inbox (D11) | Decided, unproven | the prototype has one context |
| Generated bindings and the correlated machine (D12) | Decided, unproven | the prototype has no web package |
| Deployment descriptors and generated entry modules (D13) | Decided, unproven | the loader is unchecked against generated `main` modules |
| The proof inventory and the independent reviewer (D8) | Decided, unproven | two checkers run today |
| The Postgres swarm host and the conformance suite (D5) | Decided, unproven | `docker swarm init` has not been run on the workstation |
| Compatibility and convert-on-read, operations, production-cut stories, retention and trust (D14, D22) | Decided, unproven | none built |
| The Reasoner evaluation contract (D19) | Decided, unproven | the harness is a later goal |

### Facts to establish in the prototype rework

These three come from the Grok research and are unchecked in the source.
- Unchecked. Whether the Effect Cluster host's commit fails when the stored version has moved, or relies on one-at-a-time execution alone. A quick search of `EffectCluster/index.ts` found an upsert and no version comparison. It becomes a conformance case: two runners deciding on one instance.
- Unchecked. Whether `Cluster.EntityState` landed in `@alchemy.run/effect-cluster` after 2026-11-06.
- Unchecked. Whether `waitsFor` and `atLeast` wait on the platform's delivery or only name a cursor.

### Build order
- First. Rework the standalone prototype to the decided shape and prove it in memory with stories: two contexts, an integration fact, a delegated agent run, authenticated approval (D15).
- Second. Run the same code on the Postgres Docker swarm host with the conformance suite: duplicate sends, kill after commit, lost response, projection crash, restore, authority revocation (D5).
- Third. Draft the upstream proposals once the prototype shows the exact library changes wanted: request context persisted on events (D4), and a model-free Api contract with an aggregate declaration separate from `decide` and `evolve` (D9).

### Graduation gate

The packet graduates, and the standard is amended, only when all of these exist (D16):
- two contexts exchanging an integration fact through an outbox and an inbox;
- a parent and a child agent run, with budget exhaustion;
- approval through the authenticated command boundary;
- a projection rebuild with no side effects;
- a stored-format compatibility test covering state, events, receipts and saga payloads;
- the conformance suite passing on the Postgres swarm host, restore included;
- one plain screen on generated bindings and one machine-backed screen;
- the proof inventory written for each invariant.

Until then, slice work already under way on the current seven-package standard finishes as planned. No new slice migration to `@alchemy.run/domain` starts on the seven-package shape until this packet graduates or is killed (D17). The hold is recorded in the packet and not yet in `standards/`.

## What graduation would amend

`standards/ARCHITECTURE.md` and `standards/architecture/DECISIONS.md` stay unchanged until this packet passes its graduation gate (D1, D16). When it does, the amendment covers these sections.

| In the standard | Change |
| North Star, Slice Package Topology | The bounded context is the unit, with one `Domain.Model` by default. Four packages: contract, model, host, web. |
| Decision 2026-11-06 and adoption D9 | Declarations live in the model and handlers beside them in `.handler.ts`; port implementations live in the host's `.adapter.ts`. The placement table reduces to one question per file: which closure it needs. |
| Adoption D1 and the drivers list | Host on Effect Cluster, Postgres proved first. Retire `@beep/alchemy-postgres` once the conformance suite passes, and drop the planned eventlog, message-storage, workflow and sharding drivers. |
| CQRS, Events, Workflows, Cluster, And Read Models | Rewrite around the state-to-primitive table, the at-least-once rules, bounded runs and the compatibility contract. |
| Apps, and the `tooling/infra` kind | An app composes slice deployment descriptors onto pools. Entry modules are generated. Slices name no cloud. |
| Domain-Kind Folders, Role Suffixes | Module folders and the kind-suffix vocabulary, with one primary export per file. |
| Principle 5, persisted entities | Replace the `ProductEntity` law with convert-on-read, the stored-format compatibility contract and retention classes. Tables are projection stores and outboxes inside a host. |
| Config role vocabulary | No slice config package. Each runtime owns a `Config.ts`; business constants are model values. |
| Client and UI vocabularies | One web package over generated bindings, with machines where a screen earns one. |
| Slice Consumption Rules | Integration facts through an outbox and an inbox; consumer ports over provider contracts. Retire `shared/use-cases`. The kernel gains the `Invocation` schema. |
| Access, Policy, And Error Kinds | Authority is an Invocation with grants from the authority context. Policy means `Domain.Policy` only. Actionable failures are rejections. |
| New section: Agents | Invocation and Accountability, the `AgentRun` aggregate, bounded runs and sessions, approval as a command, delegation, budget, the two agent surfaces, the Reasoner evaluation contract. |
| New sections: Operations, Retention and trust | The operations context, production-cut stories, retention classes, recorded privileged reads, trust labels. |
| Enforcement And Migration Posture | The proof inventory replaces the docs-only rows. The Review Gate lane becomes the independent reviewer. |    Sources: `explorations/model-first-slices/DECISIONS.md` (D1 to D23 and the facts to establish); the packet's research files `02-astra-review.md`, `03-kimi-review.md`, `04-adhd-pass.md` and `05-grok-deep-research.md` (the final Grok report); the standalone prototype in `scratchpad/model-first-slices/` and its probes; `standards/ARCHITECTURE.md` and `standards/architecture/DECISIONS.md`; `explorations/alchemy-domain-adoption/DECISIONS.md`; the vault-sync slice under `packages/documents`; `@alchemy.run/domain` and `@alchemy.run/effect-cluster` source at 2.0.0-beta.87 in the reference checkout; the Effect checkout, including `@effect/platform-cloudflare`. Code marked as prototype code exists in the prototype, sometimes renamed to the new grammar. Everything else is a sketch. These are proposals and do not exist: `Invocation` with its `stamp` and `relay` helpers, `Capability`, the deployment descriptor, the `IntegrationEvent` declaration, the model-free Api contract and the aggregate-declaration split upstream, the generated contract and bindings, `AgentRun` and its commands, the screen-story kit, `@beep/alchemy-atom` and the proof-inventory checkers.
