# Fifth draft of the design artifact, as text

Extracted 2026-11-17 from the fifth draft of the page, which is not published. Figures are
described by their labels and captions. Code blocks are quoted from the prototype and trimmed
unless the page says otherwise. `DECISIONS.md` wins where they differ. The fourth draft is
`07-artifact-fourth-draft.md`.

---

Model-First Slices

beep-effect · architecture exploration · 2026-11-17 · fifth version

# If the Model had come first

This page designs the architecture standard around `@alchemy.run/domain` and Effect Cluster, for a
codebase where agents write, call and operate the system alongside people. It is current to D58 in
`explorations/model-first-slices/DECISIONS.md` and is the long form of that packet's `BRIEF.md`;
the decision log wins where they differ. A standalone prototype runs this shape with three
contexts, in memory and on Effect Cluster over Postgres on a local Docker swarm. The graduation
gate is met (D53). Nothing in `standards/` has been amended. What the repo has today is evidence
about the problem and never a reason to keep something.

## The short answer

A slice is one bounded context, which owns a language, its data and its invariants. It is written
as one `Domain.Model` by default and ships as four packages, one per dependency closure:
`contract`, `model`, `host` and `web`. Everything that runs is an Effect Cluster class. Only the
authority context builds an `Invocation`; events carry provenance, and every hop is re-admitted
from live grants. An agent run is an aggregate in a context of its own, `runs`.

The current standard has the right principles. The library turns things the standard describes in
prose (a command boundary, a port, a process, a read model) into values that a compiler, a test
runner and an agent can inspect. The prototype built to this design shows which lines the domain
draws and which the library draws, and its runs on a cluster show what the host must guarantee for
the design to hold.

- **Unit of architecture.** Standard today: A slice is a "domain-bounded module family"; a model
  can sit inside one of its folders. This design: The bounded context. One `Domain.Model` per
  context by default, and a second only for an independent event lifecycle or storage placement
  (D2).
- **Packages.** Standard today: Seven per slice, one per architectural role. This design: Four per
  slice, one per dependency closure: `contract`, `model`, `host`, `web`. The contract holds the
  declarations that name no aggregate and a `Domain.Api` over them. Browsers and other contexts
  import it (D3, D9).
- **Path grammar.** Standard today: `<domain-kind>/<Concept>/<Concept>.<role>.ts`. This design:
  `<Module>/<Noun>.<kind>.ts`, with `.handler.ts` and `.adapter.ts`. Exact package exports. A
  handler registry generated from the Model (D10).
- **Authority.** Standard today: Access rules per use case; most are docs-only review gates. This
  design: Only the authority context builds an `Invocation`. Events store provenance; a policy or
  saga asks authority to re-admit it at each hop, from live grants. The kernel holds the
  grant-check language (D7, D18, D24, D27, D30).
- **Agents.** Standard today: One more client of a derived MCP surface, read-first. This design: An
  `AgentRun` aggregate in the `runs` context owns the lifecycle, the budget ledger and the lineage.
  A run acts under a narrowed delegation given when it is requested. The product context keeps its
  executor saga. Operating agents call derived tools under a grant; coding agents get the contract
  client in a sandbox (D6, D21, D23, D26, D28, D29).
- **Stored formats.** Standard today: Persisted entity schemas projected to tables. This design:
  Convert on read. Stored bytes are never rewritten. The compatibility contract covers state,
  events, receipts, provenance, saga payloads and saga activity results (D14, D22, D35).
- **Between contexts.** Standard today: Emitted events, or a promoted `shared/use-cases` contract.
  This design: Versioned integration facts. A projection in the producer's model reads aggregate
  events into a published stream with generations, the host serves it as a feed, and the consumer
  keeps an inbox. Synchronous calls go through a port the consumer declares over the provider's
  contract (D11, D33, D43).
- **UI.** Standard today: Separate client and ui packages; state in atoms and hooks. This design:
  React over bindings generated from the contract. A pure machine with a story where the screen
  earns one (D12).
- **Deployment.** Standard today: Apps wire packages by hand. Effect Cluster appears only inside
  the platform driver. This design: Each slice's host publishes a deployment descriptor as data.
  The app composes descriptors, and the cluster entry modules are generated into the app (D13,
  D40).
- **Enforcement.** Standard today: Path and suffix lint; most rules are docs-only review gates.
  This design: A generated proof inventory: each invariant with its checker, what it reads and its
  gaps. Semantic questions go to a reviewer that did not write the change (D8). The Effect
  language-service rules run in every check with nothing switched off.
- **Hosting.** Standard today: A repo-owned Postgres `Domain.Platform`, `@beep/alchemy-postgres`.
  This design: Postgres on Effect Cluster. The conformance suite passes on a local Docker swarm, on
  six local library fixes; a startup guard added since has run in process only. The repo-owned
  platform is retired once those fixes are in an upstream release (D5, D41, D53).
- **Host guarantees.** Standard today: Not stated. This design: No acknowledged write is
  overwritten. A runner that lost its shard cannot commit. After a runner dies, every reaction
  happens exactly once within one lease. A write sent to a frozen runner completes or fails within
  the caller's retry budget (D41, D42, D45, D49, D55).

Figure (omitted): Seven role packages become four closure packages: domain and use-cases become the
model, tables and server become the host, the hand-written client roles become the contract,
declared as an Api over a catalog, ui becomes web, and each runtime owns its config.

A package manager enforces one thing: what a package can resolve. So a package exists for each
distinct dependency closure. The model resolves no driver and no DOM, which makes those imports
impossible. The contract is what a browser or another context needs: commands, events, rejections,
read contracts and integration facts, with no `decide` and no `evolve`. The model imports its
contract and adds the aggregates. Until the library can declare an Api without the Model, the
contract's Api is declared over a catalog of those declarations, and an import-graph test and a
parity test hold the line (D9 as amended in phase 1). The prototype names these packages
`@proto/*`; the design names them `@beep/*`.

## What changed since D23

The fourth version of this page, dated 2026-11-13, followed D1 to D23. Since then D24 to D58 were
recorded and the prototype was rebuilt to the design in twelve phases, six of which deployed it to
a local Docker swarm. Each row gives what that version said, what is decided now, and what showed
it. The phase notes are `research/08` to `20`.

- **Authority between hops.** Before: The Invocation, grants included, is stored in each event
  payload. Policies and sagas relay it with a hop appended. Decided now: Events store provenance
  only: the root, on whose behalf, the causal chain and grant ids. At each hop a policy or saga
  asks the authority context, through a port it declares, to re-admit the chain, and authority
  rebuilds the Invocation from live grants. Only authority builds an Invocation (D24). Shown by:
  Phase 1: grant terms in events reach a view's readers, and a relayed snapshot misses a revocation
  (`research/08`).
- **Partial lapse.** Before: Not covered. Decided now: Re-admission passes the grants still in
  force and never adds one. A command that needs a dropped grant is refused, and the refusal is
  recorded (D30). Shown by: Phase 2: `decide` already names the capability a command needs.
- **Fact-started commands.** Before: Not covered. Decided now: A command an integration fact starts
  runs under the consuming record's own provenance plus a hop naming the fact: producer, contract,
  version, fact id. Facts carry no provenance (D32). Shown by: Phase 3: no grant in the consumer's
  world authorises "a claim was decided".
- **Root forgery.** Before: A syntactic rule on every place that provides the Invocation. Decided
  now: The target is an upstream change: a request context only middleware may provide, or one
  verified on restore. Until then a source scan stays in the proof inventory with its gaps listed
  (D25). Shown by: Phase 1: the library decodes whatever request context in-process code provides.
- **Grant checks and the context's name.** Before: The kernel holds the Invocation schema and ids
  only. The authority context's name is open (D7, D18). Decided now: The kernel also holds the pure
  grant-check language: grant terms, what "covers" means, the `MissingGrant` rejection. No Layer,
  aggregate or credential handling. The context is named `authority` (D27). Shown by: Every
  context's `decide` checks grants, and one definition of "covers" keeps them in agreement.
- **Where an agent run lives.** Before: An `AgentRun` module inside the product context, with
  grants and budget on the run. Decided now: A `runs` context owns `AgentRun`, the budget ledger
  and lineage. The product context keeps its executor saga and reports steps and usage through a
  port. Whoever requests a run delegates to it then: named operations, a resource scope and an
  expiry; a child narrows again. The budget lives in the runs ledger alone (D26, D28, D29). Shown
  by: Phase 1: the review agent acted with every grant the asserting person held. Phase 2: the
  ledger settles usage, and grant terms never change on use.
- **How a waiting run ends.** Before: A policy signals a durable deferred value that wakes the saga
  after approval. Decided now: The executor saga reports the wait to the run and ends. The approval
  commits a decision event, the published `ClaimDecided` fact reaches the runs context's inbox, and
  the inbox concludes every review run it names. No signal is involved. Shown by: Built in phases 2
  and 3; passes on the cluster across a runner restart.
- **The contract.** Before: A hand-written RpcGroup from the model's aggregate-free modules. The
  typed nested client is lost. Decided now: A `Domain.Api` declared over a catalog of declarations
  that name no aggregate, so the typed nested client survives. A parity test compares it with the
  model's Api. Views and queries are declared a second time for the contract. The upstream split
  stays the target (D9, phase 1 amendment). Shown by: Phase 1: `Domain.Api` reads only `commands`,
  `views`, `streams`, `queries` and `modelName` at declaration.
- **The outbox.** Before: A host table, filled by a projection and delivered by a relay singleton.
  Decided now: A projection in the producer's model that reads aggregate events directly and writes
  a `Domain.Stream`, covered by stories. The host serves the stream as a feed. A published stream
  is pinned to its writer, generation and sources, and is never rebuilt in place (D33, D43). Shown
  by: Phase 3: the library's stream appends nothing twice. Phase 8: bumping a view the publisher
  read restarted its positions, and the stream refused the new writes.
- **Upgrades and retirement.** Before: Not covered. Decided now: A fact version is retired when no
  deployment descriptor consumes it, and a producer's newest never is (D34, D40). An upgrade that
  replaces a publisher waits until the old one has published everything pending, read from the
  host's own records for any publisher (D47, D50). A closed generation stops being served only when
  the next holds every fact it held, every consumer has read past it and positions keep their
  meaning (D51). Shown by: Phases 9 to 11, including a real upgrade from earlier code on the
  cluster.
- **Remote gateways.** Before: Callers outside a pool hold the gateway's address and token. How one
  context's host calls another, and how the caller is trusted, is open. Decided now: A gateway is
  the provider's contract Api over the pool's own dispatch. Contexts in a pool trust each other; a
  caller from another pool presents that pool's gateway token; a host has no principal of its own.
  Every call still carries provenance authority re-admits (D39). Shown by: Phase 5: built for one
  pool on the swarm.
- **What the host guarantees.** Before: One commit per instance, taken from upstream's design.
  Decided now: Four guarantees, each with a bound, proven on the cluster or in process (D41, D42,
  D45, D49, D54, D55). They are described under Effect Cluster. Shown by: Phases 5 to 12: a lost
  write, stranded deliveries, a stale runner acknowledged, and their fixes.
- **Saga activity results.** Before: Not listed as a stored format. Decided now: Part of the
  stored-format contract. A compatible change converts on read; an incompatible one is a new saga
  version, and runs in flight finish on the version they started (D35). Shown by: Phase 3 changed
  the review saga's results under runs in flight.
- **Request keys.** Before: Bound to tenant, operation and a request fingerprint, with the tenant
  not defined. Decided now: The tenant is the org, the same resource scope grants are checked
  against (D36). Shown by: Phase 3 used stand-ins.
- **The Effect rules.** Before: "Type-checks" meant the plain TypeScript compiler. Decided now:
  Every check runs the Effect build of the compiler over every project, with the monorepo's rule
  set and nothing switched off. Lifecycle state is a tagged union, absence decodes to `Option`,
  rejections are branded tagged errors. Shown by: Phase 7: no Effect rule had run on phases 1 to 6;
  diagnostics went from 981 to 0.
- **Graduation.** Before: The packet graduates when conformance passes on the swarm host, and the
  repo-owned platform goes then (D5, D16). Decided now: The gate is met on the patched pass.
  Retiring `@beep/alchemy-postgres` waits until the fixes are in an upstream release (D53). The
  shape review comes before the goal packets (D56), and the packet goes to one pull request (D57).
  Shown by: Phase 11: every case passes on one build, on six local fixes.

## What the first slice already shows

The vault-sync slice is the only code written against the amended standard, so it is the best
evidence of how a seven-package slice and this library fit together. Five observations from the
checkout:

- **A model is hiding inside an aggregate folder.** `documents/domain/src/aggregates/VaultSync/`
  holds 59 files in one flat directory: 35 commands, 7 views and 6 aggregates. Six consistency
  boundaries live in a folder named after none of them. The path grammar has no slot for "bounded
  context", so the model took the slot meant for one concept.
- **The code has moved away from the placement table twice, both times toward colocating.** The
  table sends policy handlers to `server` and `ExternalSystem` contracts to `domain`. The slice put
  `VaultSync.policy-handlers.ts` and `BoxMirror.external.ts` in `use-cases`, next to the
  declarations that use them.
- **`.policy.ts` means two things.** In the domain vocabulary it is "pure domain decision law". In
  the use-case vocabulary it is a `Domain.Policy`, an event reaction. A suffix that needs its
  package to disambiguate it has stopped compressing context.
- **`use-cases/Model.ts` declares two models with the same name**, `VaultSyncModel` and
  `VaultSyncPassModel`, both `Domain.Model("VaultSync", …)`. The library rejects two same-named
  models on one platform.
- **The repo owns a Platform because none existed that week.** Decision D1 (2026-11-03) built
  `@beep/alchemy-postgres` because the library shipped only in-memory and Durable Object hosting.
  Upstream added Effect Cluster hosting on 2026-11-07 (#3143): one entity per aggregate instance,
  with its events, state and reply committed in one transaction, and sagas on the cluster's
  workflow engine. That is the same design, maintained upstream, and it runs on Durable Objects as
  well as on Postgres.

### Where every use-case role went

All thirteen of the package's pre-alchemy roles now have a block that replaces them. What the
amendment left in `use-cases` (policy, saga and projection declarations, `Model.ts`, `Api.ts`) are
model declarations.

- **`.commands.ts`**: `Domain.Command`, one file each in the contract, with its events and private
  rejections
- **`.queries.ts`**: `Domain.Query` across keys; a single-key read is a `Domain.View`
- **`.access.ts`**: The authority boundary admits the caller, and `decide` checks the grant with
  the kernel's `requireGrant`. A view's `validate` judges reads, a query handler scopes rows.
- **`.ports.ts`**: `Domain.ExternalSystem` for calls out, a `.store.ts` service for projection
  stores. Repository ports vanish: the Platform is the repository.
- **`.service.ts`**: Dispatch. `aggregate.send(id, command)` in process, the contract's client
  outside it.
- **`.errors.ts`**: A rejection, a branded tagged error listed in the command's `rejects`
- **`.http.ts` `.rpc.ts` `.tools.ts`**: Derived from `Domain.Api`: its RPC group, `toHttpApi`,
  `toMcp`, `toToolkit`, `toCli`
- **`.cluster.ts`**: The slice's `<Context>.cluster.ts` in its host, named in its deployment
  descriptor
- **`.workflows.ts` `.processes.ts`**: `Domain.Saga`
- **`.schedulers.ts`**: `schedule` and `unschedule` on an aggregate client; a deadline is a command
  that never rejects

## One command through one slice

The hexagon survives, and the library names its rings. The core is `decide` and `evolve`. The
application ring is the Api, the views, policies, sagas and projections. The ports are
`ExternalSystem` contracts and store services, and the adapters are their Layers in the host.

Figure (omitted): A command enters through the Api, where the authority context's Session
middleware admits the credential and builds the root Invocation. The platform returns a stored
receipt for a retried command id before decide runs. Otherwise the aggregate decides, and events,
state, receipt and staged deliveries commit together in one fenced commit. Views, projections,
policies and sagas receive the events after the commit, at least once; a policy or saga has its hop
re-admitted by authority before it sends. Ports sit on the model package boundary and the host
implements them over drivers and other contexts' gateways.

Solid arrows run inside one request. Dashed arrows are delivered after the commit, at least once.
Every caller enters by the same door and holds only the contract's client: a person in the browser,
an agent with a toolkit, another context's adapter, a poller with its credential. The platform
looks up a stored receipt for the command id before `decide` runs, so a retry returns the first
result. A policy or saga reaches the authority context through its own `Authority` port, which the
host implements over authority's gateway. A `Domain.Query` (not drawn) reads the store through the
same port.

The platform loads state, checks for a receipt, calls `decide`, and commits the events, the new
state, the receipt and the staged deliveries together. On the Postgres host that is one database
transaction, which with the local fixes re-reads the version `decide` saw and checks that this
runner still holds the instance's shard (D41, D45). Rejections, external effects and projection
stores fall outside it. The host package never sees a command. It supplies the ports the model
declared. The authority context's host supplies the `Session` middleware, which admits a credential
and builds the root Invocation.

## Effect Cluster is the process model

Every process is an Effect Cluster class, and the design uses all four cluster primitives next to
the Model. None of them makes an external effect happen exactly once. An idempotency key the
provider honours does that, or a reconciliation step for an uncertain outcome.

- **A fact whose invariant needs one owner and one order.** Primitive: `Domain.Aggregate`. Lives
  in: model.
- **An answer derived from facts.** Primitive: `Domain.View`, or a projection store. Lives in:
  model, host.
- **An ordered log other contexts read: a published stream.** Primitive: `Domain.Stream`, written
  by a projection. Lives in: model.
- **A domain process with steps, waits and undo.** Primitive: `Domain.Saga`. Lives in: model.
- **A live process with an address: an agent session and its chain of runs, a per-vendor rate
  limiter, a connection.** Primitive: cluster `Entity`. Lives in: host.
- **A loop that one runner owns at a time: a mailbox poller.** Primitive: cluster `Singleton`.
  Lives in: host.
- **Work on a schedule. A failed run is retried and a stale one skipped..** Primitive: cluster
  `Cron`. Lives in: host.
- **A long technical job that must finish: ingest, re-index, export.** Primitive: cluster
  `Workflow`. Lives in: host.
- **Bulk content that no invariant guards.** Primitive: A store behind a port. Lives in: host.

The Model is itself one of these. On Effect Cluster a `Domain.Model` is one entity type with many
independently addressed instances: every aggregate instance, view key and policy has its own entity
id. That makes the Model a runtime composition unit. It is neither one aggregate nor one
transaction boundary, and it does not define a language. A slice's host is a list of cluster parts:
the model, plus the gateways, pollers and other classes its adapters need.

Figure (omitted): Callers reach one pool through its dispatch: the front service, and a caller from
another pool that presents that pool's gateway token. The pool runs one generated program hosting
the authority, party and runs models, the contract gateways between them, the mailbox poller
singleton and the ClaimDecided inbox, which polls on each runner. An agent session entity is
decided and not built. The runner pool on Postgres on a single-node Docker swarm is the one proved;
the Durable Object pool is a later target.

A pool is one program that runs every class given to it. In the prototype every context runs on one
pool, hosted by one generated `layerEntities` platform; one context calls another through the
provider's contract over the pool's dispatch (D39). The token a caller from another pool presents
is decided and not built, since the prototype has one pool. The ClaimDecided inbox is a poller on
every runner over a shared store, made safe by command ids derived from each fact; it was not built
as a singleton. A pool is acceptable once the conformance suite passes on it (D5).

### How Effect Cluster holds a shard

Read from Effect 4.1.4's source in phase 10 and observed on the swarm. A runner holds its shards
with session-level Postgres advisory locks, taken on one reserved connection per runner. That
connection's `idle_session_timeout` is the lock expiry, 35 seconds. The domain commits on a
connection from another pool. When a runner is paused, the server ends its lock session at 35
seconds and another runner takes the lock: in five pauses the lock passed 28.8 to 36.4 seconds in.
A write can still be routed to the paused runner after its shard has moved, so which runner handled
the next write says nothing about who holds the shard. Upstream's 2.0.0-beta.87 commit path had no
version check and no ownership check. These are the guarantees the design now requires of a host,
and how the prototype's fixes give them:

- **No acknowledged write is overwritten (D41).** How it is held: The commit transaction takes a
  per-instance advisory lock, then re-reads the stored version as its first step. When the version
  moved since `decide`, it writes nothing and fails with `CommitConflict`, and the caller's retry
  starts again at the receipt lookup. Without the lock, two runners would both read the old version
  under read-committed isolation. Proven: In process, `LostWrite.test.ts`. On the cluster, nothing
  lost in three paused-inside-commit runs (phase 9), after the overwrite was reproduced in phases 6
  and 8.
- **A runner that lost its shard cannot commit (D45, D49, D54).** How it is held: The bootstrap
  names the runner's connection pool `effect-cluster:<host>:<port>`, hashed past Postgres's 63
  bytes, so the lock session carries the runner's name. The commit records the lock holder at the
  start of the transaction, accepts only a session of that name holding the shard's lock, and a
  deferred constraint trigger refuses at `COMMIT` if the lock changed hands. A refused commit fails
  with `ShardLost` and the caller retries onto the owner. A runner whose pool is not named for it
  fails at start with `RunnerPoolUnnamed`; the check reads configuration only. Proven: On the
  cluster, the invariant held in six of six attempts (phase 11): every write the resumed runner
  decided without the shard was refused, and every refused write was stored once, the last 12.03 s
  after the unpause against a derived bound of 33 s. The startup check is proven in process only.
- **After a runner dies, every reaction happens exactly once within one lease (D42).** How it is
  held: A drain that finds its lease held comes back just after the lease expires. The bound is the
  library's 60 s lease plus two 10 s message polls, 80 s on the present constants; a test pins both
  constants to the installed sources. A proposal for leases that follow shard ownership is written
  for upstream. Proven: On the cluster, after both runners were killed: 66.8 to 67.7 s in phases 9
  to 11.
- **A write sent to a frozen runner completes or fails within the caller's retry budget, is never
  stored twice, and a retry under the same id gets its receipt (D55).** How it is held: No library
  change. The budget is the sum of the transit retry schedule's 35 delays, 63.1 s, computed from
  the installed library and pinned. Proven: In process, three cases: resumed within the budget,
  frozen past it, and the shard moving during the freeze. The cluster case is rewritten to this
  guarantee and has not been run; phase 11 saw such a write wait over 60 s.

Of the six local fixes, the pool name is in `@alchemy.run/effect-cluster` and the other five are in
`@alchemy.run/domain`; the startup guard touches both. They are applied only through the
prototype's own `patchedDependencies`, and are written up for upstream (see Status). A connection
pooler that rewrites the session name defeats the fence's identity: the runner starts and every
commit is then refused, and the startup guard cannot see it.

### What exists upstream, as of 2026-11-13

- **Entities, sharding, singletons, crons, the workflow engine.** Where: `effect/cluster`,
  `effect/workflow`. State: In Effect 4.1. `Cluster.EntityState` is absent from Effect 4.1.4 and
  from both Alchemy packages.
- **Cluster on Cloudflare Durable Objects, from Effect itself.** Where:
  `@effect/platform-cloudflare`. State: Merged 2026-11-10 (#7322), experimental in the 4.1.3 tag.
  One SQLite object per entity instance. Its README says a singleton wake should run to completion,
  and a `ClusterCron` needs a trigger to wake its seed (Astra review).
- **Alchemy as the deployer for it.** Where:
  `@effect/platform-cloudflare/AlchemyCloudflareCluster`. State: `make({ entities, layer })` inside
  a `Cloudflare.Worker`. Alchemy owns the bindings, class exports and SQLite migrations. Its README
  says a live deployment smoke has not been run.
- **Cluster as Alchemy resources on any cloud.** Where: `@alchemy.run/effect-cluster`. State:
  2026-11-06 (#2924). `Cluster.Entity`, `Singleton`, `Cron`, `Workflow`, and pools for Docker, AWS,
  GCP, Kubernetes, Fly, Hetzner and Cloudflare.
- **A `Domain.Model` on a cluster pool.** Where: `@alchemy.run/domain/EffectCluster`. State:
  2026-11-07 (#3143); on the Durable Object pool since 2026-11-12 (#3276), once that pool grew
  `RunnerHost` and `InstanceStorage`. Upstream's ten Domain conformance cases are ported into the
  prototype from alchemy at 33c10dd and pass on the swarm host.

There are two implementations of cluster on Durable Objects, and they expose different integration
contracts. `@alchemy.run/domain/EffectCluster` consumes Alchemy's `RunnerHost` and
`InstanceStorage`. Effect's Alchemy helper provides `Sharding`, `WorkflowEngine` and
`PersistedQueueFactory`. A Layer alone does not bridge the two (Astra review, claims table). A
`Domain.Model` reaches Durable Objects only through Alchemy's pool, and the 2.0.0-beta.87 packages
do not depend on Effect's. This repo has run a pool only on the Docker swarm.

### The slice publishes what it runs

Each slice's host publishes a deployment descriptor as data: its models, its processes, the fact
versions it publishes and consumes, and its cluster wiring. The app composes the descriptors and
names no model or process. A generator writes the cluster entry modules into the app from the
composed descriptors, and a check fails on drift (D13, D40). The cluster loader accepted the
generated modules on the swarm. The generator hosts every context on one platform; placing
descriptors on different pools is decided and not built.

`party/host/src/Party.descriptor.ts · prototype code, trimmed`

```ts
export const PartyDeployment = DeploymentDescriptor.make({
  context: "party",
  models: [PartyModel.modelName],
  processes: [
    { name: "MailboxPoller", kind: "poller" },
    { name: "PartyFactsFeed", kind: "feed" },
  ],
  publishes: A.map(R.keys(ClaimDecided.versions), (version) => ({
    producer: ClaimDecided.producer,
    contract: ClaimDecided.contract,
    version: Number(version),
  })),
  consumes: [],
  cluster: {
    module: "@proto/party-host/Party.cluster",
    export: "PartyCluster",
    parts: [{ name: "PartyFactsFeed", uses: ["AuthorityGateway", "RunsGateway"] }],
    apis: ["AuthorityGateway", "RunsGateway", "Session"],
  },
});
```

`apps/practice/src/Cluster.ts · apps/practice/src/Deployment.ts · prototype code`

```ts
// Cluster.ts. Postgres on the local Docker swarm. The only file that names a cloud.
export const Database = ClusterDocker.Database("Practice");
export const Default = ClusterDocker.SwarmPool("Default", { replicas: 2 }).pipe(
  Layer.provide(Database),
);

// Deployment.ts: the descriptors this app composes.
export const PracticeDeployment: ReadonlyArray<DeploymentDescriptor> = [
  AuthorityDeployment,
  PartyDeployment,
  RunsDeployment,
];
```

`apps/practice/generated/Practice.entry.ts · generated, trimmed`

```ts
// Generated from the composed deployment descriptors by scripts/entries.ts. Do not edit:
// `bun run entries` rewrites it, and `bun run entries --check` fails on drift.
export const platform = DomainCluster.layerEntities({
  name: "Practice",
  main: import.meta.url,
  handler: "PracticeLive",
  pool: Default,
});

export const authority = AuthorityCluster(platform);
export const party = PartyCluster(platform);
export const runs = RunsCluster(platform);

export const AuthorityGateway = authority.parts.AuthorityGateway;
export const RunsGateway = runs.parts.RunsGateway.pipe(
  Layer.provide(Layer.mergeAll(AuthorityGateway)),
);
// PartyFactsFeed, ClaimDecidedInbox: each provided with the parts it uses
export default PracticeLive;
```

### A cluster class, split the same way as a block

A cluster class is declared on its own file and implemented in a `.handler.ts`, the same split as a
model block. Two rules keep cluster classes from becoming a second, unguarded write path. A cluster
class changes domain state only by sending commands through an Api client, and it never builds an
Invocation: it presents a credential at the same door as every other caller, and the authority
context's Session middleware admits it. The model reaches a cluster class only through a port, so
stories stay closed-world.

`party/host/src/Evidence/MailboxPoller.singleton.ts · MailboxPoller.handler.ts · prototype code,
trimmed`

```ts
// MailboxPoller.singleton.ts: a name
export class MailboxPoller extends Cluster.Singleton<MailboxPoller>()($I`MailboxPoller`) {}

// MailboxPoller.handler.ts: one poller across the cluster, however many runners there are
export const mailboxPollerLive = (options: {
  readonly main: string;
  readonly mailbox: string;
  readonly org: string;
  readonly credential: Headers.Input;
}) =>
  MailboxPoller.make(
    { main: options.main },
    // The ports and the cursor, then the poll they drive.
    Effect.map(
      Effect.all({
        source: Effect.service(ContactSource),
        intake: Effect.service(IntakeApi.Client),
        lastSeen: Ref.make(0),
      }),
      ({ source, intake, lastSeen }) => {
        const org = OrgId.make(options.org);
        return Effect.gen(function* () {
          const since = yield* Ref.get(lastSeen);
          const now = yield* Clock.currentTimeMillis;
          const { assertions } = yield* source.observe({ mailbox: options.mailbox, since });
          yield* Effect.forEach(
            assertions,
            (found) =>
              intake
                .AssertClaim(
                  found.claimId,
                  { org, proposition: found.proposition, signals: found.signals },
                  { commandId: found.sourceId, headers: options.credential },
                )
                .pipe(Effect.catchTag("ClaimAlreadyAsserted", () => Effect.void)),
            { concurrency: 1, discard: true },
          );
          yield* Ref.set(lastSeen, now);
        }).pipe(Effect.repeat(Schedule.spaced("1 minute")), Effect.orDie);
      },
    ),
  );
```

A singleton gives one owner at a time, which is shard ownership. It does not make `observe` or any
later effect happen once. The command id taken from the source makes the aggregate return the
stored result on a second delivery. That id dedupes a delivery and proves nothing about who
presented it; authenticity is a separate check, such as a signature over the id, a timestamp and
the body (Grok, citing Standard Webhooks 1.0.0). In the prototype the credential is a fixture the
boundary accepts; a real identity provider is not wired.

## The directory tree

The prototype's layout under `scratchpad/model-first-slices/`, trimmed: some files of each Module
are left out, and the `authority` and `runs` contexts are shown at package level. The block names
borrow vocabulary from the `@beep/party-domain` README (claims, admission gates). They show the
architecture and propose nothing for that domain. The operations context is decided and has no
package yet.

```text
party/                                    one bounded context; one Domain.Model
  contract/                               @proto/party-contract · no aggregate, no handler
    package.json                          exact exports, one per entry point
    src/
      Claim/                              a Module: what clients send to and read from a claim
        Claim.id.ts
        AcceptClaim.command.ts            primary AcceptClaim; its event and private rejection
        ApproveProposal.command.ts        a person's approval, bound to the proposal's digest
        ProposeDisposition.command.ts     what an agent run may ask for
        RequestReview.command.ts
        ReviewRequested.event.ts          an event two commands record
        ClaimNotPending.rejection.ts      shared by several commands, so it gets a file
        ClaimReview.read.ts               the view's read contract, declared a second time
      Party/
        RegisterParty.command.ts
        MergeParties.command.ts
        EffectiveParty.read.ts
      Directory/
        FindParties.read.ts
      Facts/
        ClaimDecided.fact.ts              a published fact, versions 1 and 2
        PartyFacts.gateway.ts             the feed a consumer reads
      Party.catalog.ts                    the aggregate-free catalog the contract Apis use
      Party.capabilities.ts               capabilities: operations a grant can name
      ReviewerApi.contract.ts             Domain.Api over the catalog
      IntakeApi.contract.ts
      AgentApi.contract.ts
    test/
      Contract.imports.test.ts            the closure reaches no model, host or handler
      ClaimDecided.snapshot.test.ts       each fact version against a frozen JSON Schema
  model/                                  @proto/party-model · aggregates, reactions, ports
    src/
      Claim/
        Claim.aggregate.ts                state union, decide, evolve, reply
        Claim.rules.ts                    pure guards decide starts from
        ClaimReview.view.ts
        ClaimReview.handler.ts
      Party/
        Party.aggregate.ts
        EffectiveParty.view.ts
        EffectiveParty.handler.ts
        MergeOnSameParty.policy.ts
        MergeOnSameParty.handler.ts       re-admits its hop; records a refusal or a veto
      Review/
        ReviewOnRequest.policy.ts
        ReviewOnRequest.handler.ts        opens a run in the runs context, starts the executor
        ReviewAssist.saga.ts              the executor, keyed by run; its activity schemas
        ReviewAssist.handler.ts
        ReviewRuns.external.ts            the port to the runs context
        Reasoner.external.ts              inference, a port with an evaluation contract
      Evidence/
        ContactSource.external.ts
      Directory/
        PartyDirectory.projection.ts
        PartyDirectory.handler.ts
        PartyDirectory.store.ts           the port and its memory twin
        FindParties.query.ts
        FindParties.handler.ts
        RebuildDirectory.ts               serves the old generation until the new one catches up
      Facts/
        ClaimDecisions.projection.ts      reads Claim events, writes the published stream
        ClaimDecisions.handler.ts
        PartyFacts.stream.ts              generation 1, closed
        PartyFacts2.stream.ts             generation 2, open: the outbox
        StreamPins.ts                     each published stream pinned to its writer
      Authority.external.ts               the port: re-admit a provenance for its next hop
      Party.model.ts
      Party.handlers.ts                   generated from the Model, checked for drift
      Party.ports.ts                      the ports union and the purity assertion
      ReviewerApi.api.ts
      IntakeApi.api.ts
      AgentApi.api.ts
    test/
      Party.story.test.ts                 stories per behaviour, run on the model alone
      Review.story.test.ts
      Facts.story.test.ts
      Authorization.story.test.ts
      Outcomes.story.test.ts
      Api.parity.test.ts                  the contract's group equals the model's group
      StoredFormat.test.ts                frozen fixtures in stored/, converted on read
      SagaVersions.test.ts
      Rebuild.test.ts
      StreamPins.test.ts
      Handover.test.ts
      Party.verify.test.ts
      Party.handlers.test.ts
  host/                                   @proto/party-host · the server runtime's closure
    src/
      Authority.adapter.ts                the Authority port over authority's gateway
      Review/
        ReviewRuns.adapter.ts             the ReviewRuns port over the runs gateway
        FixtureReasoner.adapter.ts        one evaluation contract, three adapters
        RecordingReasoner.adapter.ts
        ReplayReasoner.adapter.ts
      Evidence/
        FixtureContactSource.adapter.ts
        MailboxPoller.singleton.ts
        MailboxPoller.handler.ts
      Directory/
        PgPartyDirectoryStore.adapter.ts  the store port over Postgres
      Facts/
        PartyFactsFeed.adapter.ts         serves the closed generation, then the open one
      ReviewerApi.http.ts                 toHttpApi with an explicit expose list
      Adapters.ts                         every port implementation as one Layer
      Host.ts                             hostParty(platform, directory)
      Party.cluster.ts                    what the context runs on a pool
      Party.descriptor.ts                 the deployment descriptor, as data
  web/                                    @proto/party-web · the browser runtime's closure
    src/
      Bindings.ts                         command outcomes, view subscriptions, read-after-write
      Party.bindings.ts                   generated from the contract, never edited
      Party.runtime.ts                    the atom runtime
      Credentials.context.ts
      Directory/
        FindParties.screen.tsx            a plain screen over generated bindings
      Claim/
        ClaimReview.machine.ts            earned: an approval with a command in flight
        ClaimReview.controller.ts         runs the machine's intents through the bindings
        ClaimReview.screen.tsx
    test/
      ClaimReview.story.test.ts           the machine's specification, no DOM
      Screens.render.test.tsx
      Web.imports.test.ts
authority/                                grants, delegation, accountability; the trusted boundary
  contract/
  model/
  host/
runs/                                     AgentRun, budget ledger, lineage; the ClaimDecided inbox
  contract/
  model/
  host/
shared/
  kernel/                                 language only: ids, Invocation, Provenance, grant checks
  contract-kit/                           Catalog.make, the interim catalog (D9)
  tooling/                                the checkers the proof inventory names
apps/
  practice/
    alchemy.run.ts                        the stack
    src/
      Cluster.ts                          the database and the pool: the only file naming a cloud
      Deployment.ts                       the composed descriptors
    generated/
      Practice.entry.ts                   generated from the descriptors, never edited
      Practice.front.ts
conformance/                              upstream's ten cases, ported; the prototype's own cases
patches/                                  the local library fixes, applied by patchedDependencies
```

### Kind folders and Module folders

**the first prototype**

```text
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

**the prototype now**

```text
party/
  contract/src/
    Claim/
    Party/
    Directory/
    Facts/
  model/src/
    Claim/
    Party/
    Review/
    Evidence/
    Directory/
    Facts/
  host/
  web/
```

- **Kind folders separate what changes together.** A command, the events it records and the
  rejections only it returns are one decision. The library's convention puts them in one file for
  that reason, so an `events/` folder has nothing natural to hold.
- **The kind is already stated twice.** Once in the suffix, once in the primary export's static
  `kind`. A folder states it a third time and spends the only directory level there is on it.
- **A Module folder is a unit of work.** A person or an agent changing how claims are accepted
  needs `Claim/` in the contract and `Claim/` in the model, and nothing else. The folders are
  Modules: each holds a consistency boundary, a process or a read model. A subdomain is a strategic
  distinction, and a read directory is not one (Kimi review).
- **The same Module name appears in two packages.** The contract's `Claim/` holds what a client
  sends and reads; the model's `Claim/` holds the aggregate that decides it. The package line is
  the dependency closure, and the Module line is the concept.
- **Kind folders grow with the model; Module folders grow with one aggregate.** Vault-sync would
  have a `commands/` folder with 35 files.

## What the files contain

Design order stays schema first, then contract, then implementation. The library holds that order:
a command names its events and rejections before any `decide` exists, and the aggregate does not
type-check until it handles every one. Every block in this section is quoted from the prototype and
trimmed: documentation comments, imports and sibling cases are left out, and a few long lines are
re-wrapped. Package names are the prototype's `@proto/*`.

### A command is a complete decision record

`party/contract/src/Claim/AcceptClaim.command.ts · prototype code, trimmed`

```ts
import * as Domain from "@alchemy.run/domain";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $PartyContractId.create("Claim/AcceptClaim.command");

export const AdmissionGate = LiteralKit(["independent-corroboration", "source-support"]);

/** Refused: the evidence does not clear the gate this proposition needs. */
export class AdmissionGateUnmet extends S.TaggedError<
  AdmissionGateUnmet,
  { readonly brand: unique symbol }
>()(
  "AdmissionGateUnmet",
  { gate: AdmissionGate, have: S.Int, need: S.Int },
  $I.annote("AdmissionGateUnmet", {
    httpApiStatus: 422,
    description: "The claim's evidence does not clear its admission gate.",
  }),
) {}

/** The fact. Phase 9 added its scope, the org and review runs (D43). */
export class ClaimAccepted extends Domain.Event(
  "ClaimAccepted",
  carry({ proposition: Proposition, ...DecisionScope }),
) {}

export class AcceptClaim extends Domain.Command(
  "AcceptClaim",
  {
    target: ClaimId,
    middleware: [Session],
    events: [ClaimAccepted],
    rejects: [ClaimNotPending, MissingGrant, AdmissionGateUnmet],
  },
  { description: "Accept a pending claim once its admission gate is met." },
) {}
```

The command lives in the contract, because a client sends it and nothing in it decides. `carry`
adds a `provenance` field to the event: the root, on whose behalf, grant ids and the causal chain,
never grant terms. The `description` is what an agent reads; MCP tools, toolkits, CLI help and the
OpenAPI document all show it. A command file has one primary export, the command. Its events and
private rejections are companions (D8). Rejections are branded tagged errors with identity
annotations, constructed with `.make` (phase 7).

### The aggregate owns an invariant and its order

Principle 5 asks for tagged unions for lifecycle states. Here the union is the aggregate's state,
`decide` guards each transition and `evolve` takes it. Absent values decode to `Option` while the
stored JSON keeps `null`. An aggregate exists because an invariant needs one owner and one serial
order. Its entity id is the consistency boundary: one aggregate instance, never the whole Model.

`party/model/src/Claim/Claim.aggregate.ts · prototype code, trimmed`

```ts
export const ClaimState = S.TaggedUnion({
  Unasserted: {},
  Pending: {
    org: OrgId,
    proposition: Proposition,
    signals: S.Array(EvidenceSignal),
    revision: S.Int,
    reviews: S.Int,
    proposal: S.OptionFromNullOr(ProposalView),
  },
  Accepted: { org: OrgId, proposition: Proposition },
  Retracted: { org: OrgId, reason: S.String },
});

export class Claim extends Domain.Aggregate(
  "Claim",
  {
    id: ClaimId,
    state: ClaimState,
    initial: { _tag: "Unasserted" },
    commands: [
      AssertClaim, ProposeDisposition, AcceptClaim, RetractClaim, AddEvidence,
      RequestReview, ApproveProposal, RecordMergeRefused, RecordReviewRefused,
    ],
    decide: {
      AcceptClaim: Effect.fn(function* (state, command, { id, stream, now }) {
        const invocation = yield* requireGranted({
          capability: PartyReview, operation: command._tag, state, stream, at: now,
        });
        const pending = yield* requirePending(state);
        yield* requireAdmission(pending);
        return [
          ClaimAccepted.make({
            proposition: pending.proposition,
            ...scopeOf(id, pending),
            provenance: provenanceOf(invocation),
          }),
        ];
      }),
      // AssertClaim, ProposeDisposition, RetractClaim, AddEvidence, RequestReview, ...
    },
    // Total: decide already refused what cannot happen, so a handler keeps any
    // state its event cannot follow.
    evolve: {
      ClaimAccepted: (state) =>
        ClaimState.matchOrElse(
          state,
          {
            Pending: (pending): ClaimState =>
              ClaimState.cases.Accepted.make({
                org: pending.org,
                proposition: pending.proposition,
              }),
          },
          identity,
        ),
      // ...
    },
  },
  {
    description:
      "A proposition about parties, from assertion through review to acceptance or retraction.",
  },
) {}
```

The grant is checked inside `decide` with the kernel's grant-check language, against the Invocation
the request carries. A total `evolve` also hides an impossible historical sequence. A replay
auditor that reads histories and reports transitions `evolve` could not follow is decided and not
built (Astra review, item 10).

### Declaration and handler: two files, one Module

Purity splits across files, and the package line keeps one meaning: a different dependency closure.
A handler needs model members and declared ports, never a driver, so it sits beside its declaration
in a `.handler.ts`. A policy runs with no request context. It asks the authority context to
re-admit the trigger's provenance for its own hop, and sends under what comes back.

`party/model/src/Party/MergeOnSameParty.policy.ts · prototype code`

```ts
export class MergeOnSameParty extends Domain.Policy(
  "MergeOnSameParty",
  { from: Claim, on: [ClaimAccepted, ProposalApproved] },
  {
    description:
      "Merge the parties an accepted SameParty claim names; record why when it cannot.",
  },
) {}
```

`party/model/src/Party/MergeOnSameParty.handler.ts · prototype code, trimmed`

```ts
export const MergeOnSamePartyLive = MergeOnSameParty.toLayer(
  Effect.gen(function* () {
    const parties = yield* Party;
    const claims = yield* Claim;
    const authority = yield* Authority;
    return Effect.fn(function* (trigger) {
      const { event } = trigger;
      const accepted = event._tag === "ClaimAccepted" || event.outcome === "accepted";
      if (!accepted) return;
      const hop = byProcess(MergeOnSameParty.policyName, eventCause(trigger));
      const refusal = yield* Proposition.match(event.proposition, {
        SameParty: ({ survivor, absorbed }) =>
          authority.readmit({ provenance: event.provenance, hop }).pipe(
            Effect.flatMap((invocation) =>
              parties
                .send(survivor, MergeParties.make({ absorbed }))
                .pipe(Effect.provideService(CurrentInvocation, invocation)),
            ),
            Effect.as(O.none<MergeRefusal>()),
            Effect.catchTags({
              ReadmissionRefused: (refused) =>
                Effect.succeedSome(
                  MergeRefusal.cases.Readmission.make({ reason: refused.reason }),
                ),
              MergeVetoed: (vetoed) =>
                Effect.succeedSome(MergeRefusal.cases.Vetoed.make({ reason: vetoed.reason })),
              MissingGrant: (missing) =>
                Effect.succeedSome(
                  MergeRefusal.cases.MissingGrant.make({ capability: missing.capability }),
                ),
            }),
          ),
        HasIdentifier: () => Effect.succeed(O.none<MergeRefusal>()),
      });
      yield* O.match(refusal, {
        onNone: () => Effect.void,
        onSome: (reason) =>
          claims
            .send(
              trigger.source,
              RecordMergeRefused.make({ reason, provenance: extend(event.provenance, hop) }),
            )
            .pipe(Effect.asVoid),
      });
    });
  }),
);
```

A refusal is recorded on the claim, never dropped: a lapsed re-admission, a missing grant and a
vetoed merge each become a `MergeRefused` event, so "accepted" and "merged" stay distinct facts.
The separate file keeps every `toLayer` off the paths a client imports. The registry that meets the
Model, `Party.handlers.ts`, is generated from the Model and checked for drift, so a declared
handler cannot be left out while every suffix check passes (D10).

### A port is a schema-checked contract

`party/model/src/Authority.external.ts · prototype code`

```ts
export class Authority extends Domain.ExternalSystem(
  "Authority",
  {
    readmit: {
      args: { provenance: Provenance, hop: Hop },
      success: Invocation,
      error: ReadmissionRefused,
    },
  },
  {
    description:
      "Re-admits a provenance for its next hop from live grants, or refuses.",
  },
) {}
```

`party/host/src/Authority.adapter.ts · prototype code`

```ts
export const PartyAuthority = Authority.toLayer(
  Effect.map(
    Effect.service(AuthorityGateway),
    (gateway) => ({ readmit: gateway.readmit }),
  ),
);
```

The model declares the port in its own words; the host implements it over the authority context's
gateway, which is in authority's contract. Every call through an adapter is checked against the
port's schemas, arguments before and result after. A story can stub the port and assert what each
call sent. Driver errors never cross it: the adapter maps them to a declared error or lets them die
as defects. A `Domain.ExternalSystem` class is not its own service identifier, so code that names
the service uses `Context.Service.Identifier<typeof Authority>`.

### Reads: pick the weakest block that answers the question

- **About one key, live.** Block: `Domain.View`. Stored by: the Platform. Table needed: no.
- **An ordered log per key.** Block: `Domain.Stream`. Stored by: the Platform. Table needed: no.
- **Across keys: search, lists, joins.** Block: `Projection` + `Query`. Stored by: a store the host
  owns. Table needed: yes.

Most reads are the first row, so most slices need no table. A view's `validate` runs on each read
and each pushed change, against the Invocation captured when the subscription opened. That is not a
fresh grant check, and how revocation closes an open subscription is not yet proven. An Api lists
operations; a capability grant decides who may call them.

A projection runs at least once per input. The library gives each input its envelope, with the
source `stream` and `seq`, and a crash between a batch and its checkpoint replays the batch (Astra
review, item 5). So the sink takes each change's source position and the projection's generation,
applies each source's changes once and in order, and writes rows and checkpoints together.

`party/model/src/Directory/PartyDirectory.store.ts · PartyDirectory.handler.ts · prototype code,
trimmed`

```ts
// PartyDirectory.store.ts: the port. Postgres in the host; stories use the memory twin.
export const DirectoryWrite = S.Struct({ stream: S.String, seq: S.Int, change: DirectoryChange });

export class PartyDirectoryStore extends Context.Service<
  PartyDirectoryStore,
  {
    readonly apply: (
      generation: number,
      writes: ReadonlyArray<DirectoryWrite>,
    ) => Effect.Effect<number>;
    readonly active: Effect.Effect<O.Option<number>>;
    readonly checkpoints: (generation: number) => Effect.Effect<HashMap.HashMap<string, number>>;
    readonly switchTo: (generation: number) => Effect.Effect<void, GenerationBehind>;
    readonly search: (
      org: OrgId,
      text: string,
      page: Domain.Query.PageRequest,
    ) => Effect.Effect<Domain.Query.Page<DirectoryRow>>;
  }
>()($I`PartyDirectoryStore`) {}

// PartyDirectory.handler.ts: the envelope keeps each change's source identity.
export const partyDirectoryLive = (generation: number) =>
  PartyDirectory.toLayer(
    Effect.gen(function* () {
      const store = yield* PartyDirectoryStore;
      return Effect.fn(function* (batch) {
        yield* store.apply(
          generation,
          A.map(batch, ({ key, event, envelope }): DirectoryWrite => ({
            stream: envelope.stream,
            seq: envelope.seq,
            change: Match.value(event).pipe(
              Match.tagsExhaustive({
                PartyRegistered: (registered): DirectoryChange =>
                  DirectoryChange.cases.Registered.make({
                    partyId: key.id, org: registered.org, name: registered.name,
                  }),
                PartiesMerged: (merged): DirectoryChange =>
                  DirectoryChange.cases.Merged.make({
                    partyId: key.id, absorbed: merged.absorbed,
                  }),
              }),
            ),
          })),
        );
      });
    }),
    { batch: { size: 100, wait: "1 second" }, version: generation },
  );
```

A rebuild writes a new generation beside the old one; the old generation is served until the new
one has caught up, and only then does `switchTo` move reads. The rebuild fires no policy, saga,
external call or fact.

### The model, its handlers, and its whole outside world

`party/model/src/Party.model.ts · Party.handlers.ts · Party.ports.ts · ReviewerApi.api.ts ·
prototype code, trimmed`

```ts
export class PartyModel extends Domain.Model(
  "Party",
  {
    aggregates: [Claim, Party],
    views: [ClaimReview, EffectiveParty],
    policies: [MergeOnSameParty, ReviewOnRequest],
    sagas: [ReviewAssist],
    projections: [PartyDirectory, ClaimDecisions],
    // Published facts: generation 1 (closed) and generation 2 (StreamPins.ts).
    streams: [PartyFacts, PartyFacts2],
    queries: [FindParties],
  },
  { description: "Parties, claims about them, and the review that admits those claims." },
) {}

// Party.handlers.ts. Generated from PartyModel by scripts/handlers.ts. Do not edit:
// `bun run handlers` rewrites it, and `bun run handlers --check` fails on drift.
export const PartyHandlers = Layer.mergeAll(
  ClaimReviewLive, EffectivePartyLive, MergeOnSamePartyLive, ReviewOnRequestLive,
  ReviewAssistLive, PartyDirectoryLive, ClaimDecisionsLive, FindPartiesLive,
);

// Party.ports.ts: everything the model needs from outside itself.
export type PartyPorts =
  | Context.Service.Identifier<typeof ContactSource>
  | Context.Service.Identifier<typeof Reasoner>
  | Context.Service.Identifier<typeof PartyDirectoryStore>
  | Context.Service.Identifier<typeof Authority>
  | Context.Service.Identifier<typeof ReviewRuns>;

export type Host = Layer.Success<typeof Domain.InMemory>;
export const PartyHosted = PartyModel.layer(PartyHandlers);
export type LeakedServices = Exclude<Layer.Services<typeof PartyHosted>, PartyPorts | Host>;

/** The purity law as a type. `true` only when nothing leaked. */
export const portPurity: [LeakedServices] extends [never] ? true : LeakedServices = true;

// ReviewerApi.api.ts: every kind listed, because a kind left out is served whole.
export class ReviewerApi extends Domain.Api(
  "ReviewerApi",
  {
    model: PartyModel,
    commands: ["AcceptClaim", "RetractClaim", "ApproveProposal", "RequestReview", "MergeParties"],
    views: ["ClaimReview", "EffectiveParty"],
    queries: ["FindParties"],
    streams: [],
  },
  { description: "Review claims about parties, read them, and search the directory." },
) {}
```

The package manager stops the model importing a driver. The `portPurity` line stops a handler
requiring a service the model never declared, and its type names the leaked service. Neither proves
a handler's code is pure. `fetch`, `Date.now` and module state leave no Effect requirement (Astra
review, item 9), so lint and the reviewer cover them.

`party/contract/src/Party.capabilities.ts · prototype code, trimmed`

```ts
export const PartyReview = Capability.make({
  id: CapabilityId.make("party.review"),
  operations: [
    AcceptClaim.tag, RetractClaim.tag, MergeParties.tag, ApproveProposal.tag, RequestReview.tag,
  ],
  description:
    "Accept, retract or approve a proposal on pending claims, ask for reviews, and merge parties.",
});

export const PartyPropose = Capability.make({
  id: CapabilityId.make("party.propose"),
  operations: [ProposeDisposition.tag],
  description: "Let an agent run propose a disposition on a pending claim.",
});
```

A capability names operations; a grant issued by the authority context names a capability,
optionally a narrower list of its operations, a resource scope and an expiry. Granting is a command
in the authority context. A context's contract only declares its capabilities.

### The contract is what clients import

The library cannot build an Api without a Model: `Domain.Api` reads the Model's commands, views,
streams and queries when it is declared, and `decide` and `evolve` are inline fields of the
aggregate declaration. It reads nothing else, so the contract declares its Api over a catalog
shaped like a Model that holds the context's commands, view read contracts and queries and no
aggregate. The typed nested client survives, and a parity test asserts that each contract Api's RPC
group equals the model Api's (D9 as amended in phase 1).

`party/contract/src/Party.catalog.ts · ReviewerApi.contract.ts · prototype code, trimmed`

```ts
// Party.catalog.ts: everything of Party a client can call, with no aggregate behind it.
export const PartyCatalog = Catalog.make({
  name: "Party",
  commands: [
    AssertClaim, ProposeDisposition, AcceptClaim, RetractClaim, AddEvidence,
    RequestReview, ApproveProposal, RegisterParty, MergeParties,
  ],
  views: [ClaimReviewRead, EffectivePartyRead],
  queries: [FindPartiesRead],
});

// ReviewerApi.contract.ts: the same RPC group as the model's ReviewerApi.
export class ReviewerContract extends Domain.Api(
  "ReviewerContract",
  {
    model: PartyCatalog,
    commands: ["AcceptClaim", "RetractClaim", "ApproveProposal", "RequestReview", "MergeParties"],
    views: ["ClaimReview", "EffectiveParty"],
    queries: ["FindParties"],
    streams: [],
  },
  { description: "Review claims about parties, read them, and search the directory." },
) {}
```

An Api over a catalog is a client contract only: serving it or calling `clientInProcess` on it has
no model behind it and fails. Views and queries are declared twice, once in the model and once as a
read contract, from shared parts. The target is still an upstream contribution with two parts: a
model-free Api contract, and an aggregate declaration separate from `decide` and `evolve`. Once it
lands, the catalog and the second declarations go. A screen that wants `Aggregate.predict` imports
the model on purpose and is listed (D3). A predicted result is never authorization and never a
write.

### The specification is a story

`party/model/test/Party.story.test.ts · prototype code, trimmed`

```ts
const { call, fail, given, provide, query, rejected, succeed, then, view, when } = Story;

/** Act under this invocation for the following steps, as the Session middleware would. */
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns], // every outside system answers in the story
});

it.effect(
  "a grant revoked between two hops stops the second hop, and the refusal is recorded",
  () =>
  story(
    ...registered,
    asserted(),
    as(reviewer),
    when(claim, AcceptClaim.make({})),
    then(
      claim,
      ClaimAccepted.make({
        proposition: sameParty,
        ...unreviewed,
        provenance: provenanceOf(reviewer),
      }),
    ),
    call(Authority.readmit, { provenance: provenanceOf(reviewer), hop: mergeHop(2) }),
    // The review grant was revoked after the accept: authority re-admits with the read
    // grant alone.
    succeed(
      Authority.readmit,
      readmitted(reviewer, mergeHop(2), [onOrg("g_rev_read", PartyRead, acme)]),
    ),
    then(
      claim,
      MergeRefused.make({
        reason: MergeRefusal.cases.MissingGrant.make({ capability: "party.review" }),
        provenance: extend(provenanceOf(reviewer), mergeHop(2)),
      }),
    ),
    then(dana),
    view(ClaimReview, claim, {
      notes: [{ _tag: "MergeRefused", reason: "missing-grant:party.review" }],
    }),
  ),
);

it.effect("one source is not corroboration", () =>
  story(
    asserted(oneSource),
    as(reviewer),
    when(claim, AcceptClaim.make({})),
    rejected(AdmissionGateUnmet.make({ gate: "independent-corroboration", have: 1, need: 2 })),
  ),
);
```

A story fails on any event, rejection or external call it does not account for. Coverage counts
outcomes that executed: a vitest setup records which declared outcomes each story and test ran, and
109 of 109 declared command outcomes execute. A rejection tag found in a file does not count (D8).
An author's stories can restate the author's `decide`, so stories are evidence the independent
reviewer reads, alongside assertions derived from invariants.

## Agents act under re-admitted authority

An agent proposes and an aggregate decides, under authority the agent can only narrow. Only the
authority context builds an `Invocation`, and it rebuilds one from live grants at every hop. An
agent run is an `AgentRun` aggregate in the `runs` context: one bounded piece of work, executed by
a saga in the product context. A person approves through an authenticated command.

All of this is built in the prototype and proven in memory, and the review flow also runs on the
cluster: a run waits for approval across a runner restart, and a grant revoked mid-chain is
recorded and the run gives back its reserved budget. Not built: the session entity that holds a
chain of runs, the sandbox for coding agents, and attorney supervision in a law-practice context.

### Authority

The authority context's `Session` middleware admits a credential at the Api door and builds the
root `Invocation`: who the root is (a person, or an agent run with the person accountable for it),
on whose behalf it acts, the grants with their terms, and the causal chain. An event stores only
the provenance: the same root, on whose behalf, grant ids and the chain. A policy or saga that acts
later asks authority, through its own `Authority` port, to re-admit that provenance for its hop.
Authority confirms each grant against the live `Grant` and `Delegation` aggregates, re-checks that
an agent root still has an accountable human, and returns an Invocation with the grants still in
force, or refuses (D24, D30).

- **The `Invocation` and `Provenance` schemas, ids, and the grant-check language: grant terms,
  `covers`, `allows`, `widens`, `requireGrant`, `MissingGrant`**: The shared kernel, as language,
  with no Layer, aggregate or credential handling (D7, D27)
- **`Grant`, `Delegation` and `Accountability` aggregates**: The `authority` context (D7, D18, D27)
- **Accountability: every agent-rooted action names an accountable human**: The authority context,
  as a general relation (D18)
- **Attorney supervision of nonlawyer work**: The law-practice context, checked against
  Accountability (D18). Not built.
- **Building an Invocation**: Only authority: the root at the Session boundary, every later one by
  re-admission (D24)
- **Checking a grant covers an operation**: Each context's `decide`, with the kernel's
  `requireGrant`. Contexts check grants and never define them.
- **What each event stores**: Provenance, added by the kernel's `carry`. Never grant terms. Request
  context persisted with events by the library stays an upstream target (D4).
- **Which context a fact-started command runs under**: The consuming record's own provenance plus a
  `Fact` hop naming producer, contract, version and fact id. Nobody is re-admitted (D32).

`shared/kernel/src/Invocation.ts · prototype code, trimmed`

```ts
export const Root = S.TaggedUnion({
  Human: { principal: PrincipalId },
  Agent: { run: RunId, accountable: PrincipalId },
});

export const Cause = S.TaggedUnion({
  Event: { stream: S.String, seq: S.Int, event: S.String },
  SagaStep: { saga: S.String, key: S.String, step: S.String },
  Session: { scheme: S.String },
  Fact: { producer: S.String, contract: S.String, version: S.Int, fact: S.String },
});

export const Hop = S.Struct({ by: Relayer, cause: Cause });

/** What a request carries: the grants with their terms. Only authority builds one. */
export const Invocation = S.Struct({
  root: Root,
  onBehalfOf: PrincipalId,
  grants: S.Array(CapabilityGrant),
  chain: S.Array(Hop),
});

/** What an event carries: grant ids, never terms. */
export const GrantRef = S.Struct({ grant: GrantId, delegation: S.OptionFromNullOr(DelegationId) });
export const Provenance = S.Struct({
  root: Root,
  onBehalfOf: PrincipalId,
  grants: S.Array(GrantRef),
  chain: S.Array(Hop),
});

export const carry = <const F extends S.Struct.Fields>(
  fields: F,
): F & { readonly provenance: typeof Provenance } => ({ ...fields, provenance: Provenance });
```

Re-admission never adds a grant the provenance did not name, and refuses when all of them lapse.
The next command is refused only if it needs a dropped grant, and that refusal is recorded on the
record that tried (D30). The library still decodes whatever request context in-process code
provides, so a root Invocation can be forged in process. The control is a source scan in the proof
inventory with its gaps listed (object spreads, schema decodes, aliased tags); the target is an
upstream change (D25). Command ids for the prototype's own sends are derived from the org, the
operation and a SHA-256 fingerprint of the request (D36).

### The agent run is an aggregate in its own context

`AgentRun` is the system of record for a run (D6, D28). It holds the lifecycle, the lineage
(session, parent, previous run), the delegation and its terms, the budget ledger, the steps taken
against a history bound, and the prompt, model and tool-contract versions. A run gets its authority
when it is requested: the requester delegates operations, a resource scope and an expiry, and a
child run narrows that again (D26). The budget is allocated in the ledger when the run is
requested, and the ledger is the only place reservations are checked (D29).

`runs/model/src/Run/AgentRun.aggregate.ts · prototype code, trimmed`

```ts
export const Budget = S.Struct({
  allowance: S.Int,
  reserved: S.Int,
  spent: S.Int,
  allocated: S.Int,
});

export const RunRecord = S.Struct({
  session: SessionId,
  lineage: RunId,
  generation: S.Int,
  parent: S.OptionFromNullOr(RunId),
  previous: S.OptionFromNullOr(RunId),
  purpose: S.String,
  versions: RunVersions,
  requester: PrincipalId,
  accountable: PrincipalId,
  source: GrantRef,
  terms: GrantTerms,
  delegation: DelegationId,
  provenance: Provenance,
  budget: Budget,
  reservations: S.Array(HeldReservation),
  steps: S.Int,
  historyBound: S.Int,
});

export const AgentRunState = S.TaggedUnion({
  Unrequested: {},
  Requested: { run: RunRequest },
  Running: { run: RunRecord },
  AwaitingApproval: { run: RunRecord },
  AwaitingChild: { run: RunRecord, child: RunId, allowance: S.Int },
  Completed: { run: RunRecord, outcome: S.String },
  Rejected: { session: SessionId, reason: S.String },
  Refused: { run: RunRecord, reason: S.String },
  Withdrawn: { run: RunRequest, reason: S.String },
  Cancelled: { run: RunRecord, reason: S.String },
  Exhausted: { run: RunRecord },
  Continued: { run: RunRecord, next: RunId },
});
```

The runs model has four policies: `GrantOnRequest` asks authority for the run's delegation,
`OpenChildOnRequest` opens a delegated child, `ContinueAtBound` opens the continuation when a run
reaches its history bound, and `ResumeParent` resumes a parent when its child finishes, including a
child refused mid-run. A `SessionRuns` view lists a session's chain. An earlier stored form of a
cancelled request decodes to `Withdrawn` through a declared conversion; no fixture was rewritten.

### The product context executes the run

Party keeps its own executor. When a review is requested, the `ReviewOnRequest` policy re-admits
the request's provenance, checks it holds a grant that allows proposing, asks the runs context
through its `ReviewRuns` port to open a run with a narrowed delegation, and starts the
`ReviewAssist` saga keyed by the run id. A second review of the same claim is a new run. The saga
reserves budget, calls the Reasoner, settles the usage, records the step, and proposes as the run
under its re-admitted provenance. Every report to the run goes through the port, and a refusal from
the runs context is recorded on the claim and reported back, so the run gives back what its open
reservations held.

`party/model/src/Review/ReviewAssist.saga.ts · ReviewAssist.handler.ts · prototype code, trimmed`

```ts
export class ReviewAssist extends Domain.Saga(
  "ReviewAssist",
  {
    key: RunId,
    input: {
      claim: ClaimId,
      proposition: Proposition,
      signals: S.Array(EvidenceSignal),
      evidenceRevision: S.Int,
      provenance: Provenance,
    },
    rejects: [
      ReasonerUnavailable, RunRefused, ClaimNotPending, MissingGrant, NotAnAgent, ProposalStale,
    ],
  },
  {
    description:
      "A review run's executor: assess within budget, propose as the run, " +
      "then wait for the decision.",
  },
) {}

/** Each activity's stored result has a schema: activity results are a stored format (D35). */
export const ReviewAssistActivities = {
  reserve: { success: StoredReservation, error: ReportError },
  assess: { success: Assessed, error: ReasonerUnavailable },
  settle: { success: LiveRun, error: ReportError },
  propose: {
    success: StoredProposalSent,
    error: S.Union([ClaimNotPending, MissingGrant, NotAnAgent, ProposalStale]),
  },
  // release, step, record-refusal, exhaust, await
} as const;

// ReviewAssist.handler.ts, inside the saga body
const reserved = yield* Activity.make({
  name: "reserve",
  ...ReviewAssistActivities.reserve,
  execute: runs.reserve({ ...as("reserve"), reservation, units: ReviewPlan.maxPerCall }).pipe(
    Effect.map((next) => Reservation.cases.Reserved.make({ live: next })),
    Effect.catchTag("BudgetRefused", (_: BudgetRefused) =>
      Effect.succeed(Reservation.cases.OutOfBudget.make({})),
    ),
  ),
}).pipe(Effect.catchTag("RunRefused", recorded));
if (Reservation.guards.OutOfBudget(reserved)) {
  // Out of budget: the run ends here, and no Reasoner call is made.
  yield* report("exhaust", runs.exhaust(as("exhaust")));
  return;
}
```

After proposing, the saga reports to the run that it awaits approval, and ends. Nothing signals it
later. The person's approval commits a decision event on the claim, the claim's decision is
published as a `ClaimDecided` fact, and the runs context's inbox concludes every review run that
fact names (see Between contexts). A run in flight across a change to the saga's activity results
finishes on the saga version it started (D35).

### Approval is an authenticated command

A person approves by sending `ApproveProposal` through the same Api door as any other command. Its
`decide` refuses an agent root or a relayed hop, checks the grant, and binds the approval to the
digest and evidence revision of the proposal the person read. The approval record is the committed
fact.

`party/contract/src/Claim/ApproveProposal.command.ts · party/model/src/Claim/Claim.aggregate.ts ·
prototype code, trimmed`

```ts
export class ApproveProposal extends Domain.Command(
  "ApproveProposal",
  {
    target: ClaimId,
    middleware: [Session],
    input: { digest: S.String, evidenceRevision: S.Int },
    events: [ProposalApproved],
    rejects: [
      HumanApprovalRequired, MissingGrant, ClaimNotPending, ProposalMismatch, AdmissionGateUnmet,
    ],
  },
  { description: "Approve a review run's proposal, as read: its digest and evidence revision." },
) {}

// In Claim's decide:
ApproveProposal: Effect.fn(function* (state, command, { id, stream, now, commandId }) {
  // A person approves, signed in and acting directly: never an agent root, never a relayed hop.
  const acting = yield* Effect.service(CurrentInvocation);
  if (!Root.guards.Human(acting.root) || !Operator.guards.Human(operatorOf(acting))) {
    return yield* HumanApprovalRequired.make({});
  }
  const invocation = yield* requireGranted({
    capability: PartyReview, operation: command._tag, state, stream, at: now,
  });
  const pending = yield* requirePending(state);
  if (O.isNone(pending.proposal)) return yield* ProposalMismatch.make({ reason: "no-proposal" });
  const proposal = pending.proposal.value;
  if (proposal.digest !== command.digest) {
    return yield* ProposalMismatch.make({ reason: "digest" });
  }
  // ... the evidence revision, the admission gate, then ProposalApproved with its scope
}),
```

### Delegation narrows, and budget is reserved

A run's grant is a Delegation issued by the authority context, from a grant the requester holds or
from the delegation the requesting run holds. Authority refuses any terms wider than their source
in capability, operations, resource or expiry, and names the dimension that widened. Budget is
reserved before an inference or tool call and settled after it; a failed call releases its
reservation, and completing a run releases what is still open. A parent allocates part of its
allowance to each child, so two children cannot spend the same allowance (D6, D26, D29).

### A run is bounded, and a session holds the chain

A run is one bounded piece of work, its wait for approval included, with a bound on its history
(D23). When a run reaches its bound it records `Continued`, and a new run carries the state forward
with `previous` set; the executor follows the lineage. A long conversation or a standing assignment
is a session: the prototype has the `SessionRuns` view over the chain, and the `AgentSession`
cluster entity that would be its restartable worker is decided and not built. Workflow engines cap
history for this reason: Temporal warns at 10,240 events and terminates an execution past 51,200
(Grok research). The bound's value is not decided for the standard.

### Two agent surfaces, by role

Agents get two surfaces, and both are the contract package pointed at a different runtime (D21).

- **An agent that operates the system.** Surface: Derived tools: `toMcp` or `toToolkit` over an
  Api. Authority: The run's own delegation on every call. What a person controls: A person can deny
  any call. A call that changes the world waits for approval.
- **An agent that writes or composes code.** Surface: The generated contract client, inside a
  sandbox. Authority: The sandbox holds bindings and nothing else: no general network, no keys.
  What a person controls: The code reaches the system only through those bindings, each under its
  grant.

The prototype derives a toolkit from the agent Api and drives it under a run's own grant in a host
test. The sandbox is not built. One tool per command suits an agent that stays subject to a
person's denial; the MCP tools specification says a human should always be able to deny a tool
invocation, and that servers apply access controls. For an agent writing code against the system, a
generated TypeScript client in a sandbox with bindings only is the better surface; Cloudflare's
Code Mode is that shape (Grok research). A machine-checked architecture law is a different thing
from a person's denial and replaces none of it.

### The Reasoner port carries an evaluation contract

Inference stays a port. The prototype has three Reasoner adapters behind one contract suite: a
fixture, a recorder that writes each request and its result to a schema-checked tape, and a
replayer that answers from the tape by prompt version and idempotency key. The tape is kept in
memory, not in files. A change to a prompt, a model or a tool contract passes a recorded evaluation
before release (D19); building that evaluation harness is a later goal. A stubbed Reasoner in a
story proves orchestration and says nothing about agent quality.

`party/model/src/Review/Reasoner.external.ts · prototype code, trimmed`

```ts
export const Usage = S.Struct({
  units: S.Int,
  // Added in phase 4 (D35): stored results and tapes without it read 0.
  cachedUnits: S.Int.pipe(
    S.withDecodingDefaultKey(Effect.succeed(0)),
    S.withConstructorDefault(Effect.succeed(0)),
  ),
});

export const AssessRequest = S.Struct({
  run: RunId,
  step: S.String,
  idempotencyKey: S.String,
  promptVersion: S.String,
  maxAllowance: S.Int,
  proposition: Proposition,
  signals: S.Array(EvidenceSignal),
});

export class Reasoner extends Domain.ExternalSystem(
  "Reasoner",
  { assess: { args: AssessRequest.fields, success: Assessed, error: ReasonerUnavailable } },
  {
    description:
      "Assesses a claim's evidence and proposes a disposition, " +
      "reporting usage within an allowance.",
  },
) {}
```

### What an agent may do, and what it did

- **Who is acting.** Block: The `Invocation` in the request; `Provenance` in every event. What it
  gives: Root, accountable human, on-behalf-of, grants and the causal chain are separate fields.
  Events hold grant ids only.
- **A model call.** Block: The Reasoner port. What it gives: Output checked against a schema at the
  adapter; stubbed in stories; recorded and replayed for evaluation.
- **A run.** Block: `AgentRun` in the runs context; the product context's executor saga. What it
  gives: One owner for lifecycle, budget, lineage and versions. Durable steps whose results are a
  stored format.
- **A person's sign-off.** Block: `ApproveProposal`. What it gives: An authenticated command from a
  human root, bound to the proposal's digest and evidence revision.
- **What an agent may do.** Block: A delegation over a capability's operations. What it gives:
  Least privilege comes from the delegation. Listing a command in an Api only publishes it.
- **What an agent did.** Block: Events with their provenance, refusals recorded as events. What it
  gives: An audit trail built by the commit itself.
- **What an agent read.** Block: `AccessRecorded` events. What it gives: Reads of privileged
  material on the record (D14). Not built.

### The same model, for the agents that write the code

- **One block per file, named by kind.** The unit an agent edits is small and uniform, and a glob
  finds it: `**/*.command.ts`. Each file has one primary export, and a checker reads every role
  file to hold it.
- **A context is sized by its language.** A tool's context window plays no part in where a boundary
  falls (D2). An agent gets a bounded task and generated dependency views.
- **Story first.** The acceptance criterion for a change is a story, written before the block. The
  local loop is story, block, `Domain.verify`, then the mechanical checkers.
- **Generated where it can be.** Adding a block regenerates the handler registry and the web
  bindings, and a check fails on drift. The contract catalog is listed by hand, and the parity test
  fails when it drifts from the model.
- **An independent reviewer.** Semantic questions go to an agent that did not write the change. A
  person decides only where that reviewer and the author disagree (D8).
- **Two first files.** An authored `SLICE.md` for purpose, language and invariants, and a generated
  `MODEL.generated.md` for the inventory. This split comes from the Kimi review, has no decision
  yet, and is not in the prototype.

## The host and the web

### The repo implements no platform driver

The host package provides the ports and hosts the model on whatever platform it is handed. The app
hands it a cluster pool; a story or an Api test hands it `Domain.InMemory`. The repo implements no
`Domain.Platform` driver. Deployment, data evolution and recovery still have owners: the slice's
deployment descriptor, the compatibility contract and the operations context. Postgres on the
Docker swarm pool is the host proved, and `@beep/alchemy-postgres` stays until the fixes the pass
rests on are in an upstream release (D5, D41, D53).

`party/host/src/Adapters.ts · Host.ts · prototype code, trimmed`

```ts
// Adapters.ts: every port the model declared, implemented
export const PartyAdapters = Layer.mergeAll(
  FixtureContactSource,
  FixtureReasoner,
  PartyAuthority,
  PartyReviewRuns,
);

// Host.ts: the model, its handlers and its adapters, on the platform and directory you give it
const hostPartyOn = <ROut, E, RIn>(
  platform: Layer.Layer<ROut, E, RIn>,
  directory: Layer.Layer<PartyDirectoryStore>,
) =>
  PartyHosted.pipe(
    Layer.provideMerge(PartyAdapters),
    Layer.provide(directory),
    Layer.provide(platform),
  );
```

The directory store is passed in because it differs by platform: the memory twin in memory,
`PgPartyDirectoryStore` on the cluster. The authority context's host provides the `Session`
middleware's server half (`Session.adapter.ts`); a fixture credential stands in for an identity
provider. Where a browser session's credentials and tenant come from, and what clears atom caches
on logout or tenant change, is deferred to the browser QA and HTTP wiring work.

### Delivery is derived, except where it faces strangers

- **Your own apps.** How: The contract's typed client over a protocol that speaks its group. File:
  `web/Party.runtime.ts`.
- **Operating agents.** How: `toToolkit` in the app, `toMcp` outside it, with an explicit expose
  list, each call under the run's delegation. File: an app or host file per surface.
- **Coding agents.** How: The contract client in a sandbox with bindings only. Not built. File:
  where the sandbox runs.
- **Operators.** How: The operations context's Api, and `toCli`. Not built. File: the operations
  context's host.
- **HTTP and partners.** How: `toHttpApi` with an explicit expose list; for strangers, a
  hand-written `HttpApi` with its own response schemas. File: `host/ReviewerApi.http.ts`.
- **Other contexts.** How: Integration facts through a published stream served as a feed;
  synchronous calls through the provider's gateway contract. File: `host/Facts/`,
  `host/<Provider>.adapter.ts`.
- **Pollers, consumers, schedules.** How: A singleton, inbox or cron that sends commands with ids
  derived from the source. File: `host/<Module>/<Name>.singleton.ts`, `.inbox.ts`.

### React over generated bindings

The web package stays React, over Effect Atom. It imports the contract and never a model or host
file. An ordinary screen is one `*.screen.tsx` over bindings generated from the contract. The
bindings give typed command outcomes with their command ids, view subscriptions with revisions and
reconnect, and read-after-write. A screen with real interaction law adds a `.machine.ts`, a
`.controller.ts` and a story; multi-step editing, offline intents, approval queues and gestures
earn one (D12). The binding code lives in the web package's own `Bindings.ts`; a shared
`@beep/alchemy-atom` package is proposed and not built.

`party/web/src/Party.bindings.ts · Directory/FindParties.screen.tsx · prototype code, trimmed`

```ts
// Party.bindings.ts. Generated from the Party contract by scripts/bindings.ts. Do not edit.
export const Reviewer = {
  ApproveProposal: Bindings.command(
    ReviewerContract,
    ApproveProposal,
    (client) => client.ApproveProposal,
  ),
  ClaimReview: Bindings.view(ReviewerContract, (client) => client.ClaimReview),
  FindParties: Bindings.query(ReviewerContract, (client) => client.FindParties),
  // AcceptClaim, EffectiveParty, MergeParties, RequestReview, RetractClaim
} as const;

// FindParties.screen.tsx: a search that reads after the last registration's receipt.
export const searchResults = Atom.family((org: OrgId) =>
  partyRuntime.atom((get) => {
    const atLeast = get(lastRegistration);
    return Reviewer.FindParties(
      { org, text: get(searchText) },
      {
        take: 20,
        ...O.match(atLeast, { onNone: () => ({}), onSome: (receipt) => ({ atLeast: receipt }) }),
      },
    );
  }),
);
```

### A machine correlates on command id, receipt and view revision

The third draft's machine cleared its pending state on any view change. A delayed snapshot then let
a second press send a second command while the first was in flight, and a late refusal could clear
a newer request (Astra review, item 8). The prototype's machine tracks three things apart. The
command id says which request. The receipt says the command committed. The view revision says which
snapshot the screen holds. A receipt's version counts the aggregate's events and a view's revision
counts the view's own events, so the machine never compares the two: it confirms through a read
that waits for the receipt. A transport failure is an unknown outcome, retried with the same
command id.

`party/web/src/Claim/ClaimReview.machine.ts · prototype code, trimmed`

```ts
export const Approval = S.TaggedUnion({
  Idle: {},
  Sending: inFlight,                                   // commandId, digest, revisions, attempts
  Committed: { ...inFlight, receipt: Receipt },
  Noticed: { notice: Notice },
});

export const Message = S.TaggedUnion({
  Snapshot: { review: S.Option(ClaimReviewState), revision: S.Int, epoch: S.Int },
  ApproveClicked: { commandId: S.String },
  Accepted: { commandId: S.String, receipt: Receipt },
  Rejected: { commandId: S.String, reason: S.String },
  Denied: { commandId: S.String, reason: S.String },
  Unknown: { commandId: S.String },
  CaughtUp: { commandId: S.String, review: S.Option(ClaimReviewState), revision: S.Int },
});

export const Intent = S.TaggedUnion({
  Approve: { commandId: S.String, digest: S.String, evidenceRevision: S.Int },
  ReadAfterWrite: { commandId: S.String, receipt: Receipt },
});

// In update, a Match over every message:
Accepted: ({ commandId, receipt }) =>
  O.match(O.filter(current(screen, commandId), Approval.guards.Sending), {
    onNone: () => unchanged(screen),
    onSome: (sending) =>
      emit(
        {
          ...screen,
          approval: Approval.cases.Committed.make({ ...Struct.omit(sending, ["_tag"]), receipt }),
        },
        Intent.cases.ReadAfterWrite.make({ commandId, receipt }),
      ),
  }),
```

`party/web/test/ClaimReview.story.test.ts · prototype code, trimmed`

```ts
it(
  "Astra's counterexample: a delayed snapshot after the command neither clears it " +
    "nor lets a second one out",
  () => {
  story(
    seen,
    send(Message.cases.ApproveClicked.make({ commandId: "c1" })),
    intents(approve("c1")),
    // The delayed first snapshot (older revision), and a reconnect's fresh one still
    // showing pending.
    send(snapshot(1)),
    intents(),
    send(snapshot(4, 1)),
    send(Message.cases.ApproveClicked.make({ commandId: "c2" })),
    intents(),
    state({ approval: { _tag: "Sending", commandId: "c1" } }),
  );
});
```

No DOM, no server, no timers. A screen story fails on an intent it did not expect, the way a model
story fails on an event it did not expect. A render test per screen asserts the rendered tree;
browser QA proving real gestures reach the machine is not done. The screen-story kit is the
prototype's `test/ScreenStory.ts`, which borrows Foldkit's story pattern: it calls a pure update
and keeps commands as data. Foldkit itself is not adopted (operator, `CAPTURE.md`).

## Between contexts

A context never imports another context's model. Facts cross as versioned integration facts: a
projection in the producer's model writes them to a published stream, the producer's host serves
that stream as a feed, and the consumer keeps an inbox. Synchronous calls go through a port the
consumer declares, implemented over the provider's contract (D11, D33). Both are built between
Party and runs, and both run on the cluster.

Figure (omitted): Party's ClaimDecisions projection reads Claim events directly and appends
ClaimDecided versions 1 and 2 to a published stream with a closed and an open generation. Party's
host serves the generations as one feed. The runs context's inbox, keyed by producer, fact id and
version, decodes each fact once and sends ConcludeRun to every review run the fact names. Below,
Party's model calls a ReviewRuns port in its own words; its host adapter calls the runs context's
RunsGateway, the synchronous edge.

The upper half is a fact crossing asynchronously. Party's publishing projection reads the claim's
own events, never a versioned view, so a view rebuild cannot touch it. The feed serves the closed
generation and then the open one as one log. The runs context records each fact once in its inbox
and sends its own command, under its own record's provenance plus a hop naming the fact. The lower
half is a synchronous call. Party's model depends on a port it wrote, and only its host adapter
knows that the runs context answers, through runs' gateway contract. Where each context's entities
run is the cluster's concern; the adapter is the same code either way.

`party/contract/src/Facts/ClaimDecided.fact.ts · party/model/src/Facts/ClaimDecisions.projection.ts
· StreamPins.ts · prototype code, trimmed`

```ts
// ClaimDecided.fact.ts: a fact other contexts may rely on. Each version is its own event class.
export class ClaimDecidedV2 extends Domain.Event("ClaimDecidedV2", {
  factId: S.String,
  claim: ClaimId,
  org: OrgId,
  decision: Decision,
  basis: S.Literals(["approval", "direct"]),
  approval: S.OptionFromNullOr(ApprovalId),
  reviewRuns: S.Array(RunId),
}) {}

export const ClaimDecided = {
  producer: "party",
  contract: "ClaimDecided",
  versions: { 1: ClaimDecidedV1, 2: ClaimDecidedV2 },
} as const;

// ClaimDecisions.projection.ts: the publisher reads Claim's events and writes the open generation.
export class ClaimDecisions extends Domain.Projection(
  "ClaimDecisions",
  {
    from: [Claim],
    key: ClaimFeed,
    keyOf: { Claim: () => "claims" as const },
    on: [ClaimAccepted, ClaimRetracted, ProposalApproved],
    writes: [PartyFacts2],
  },
  {
    description:
      "Publish ClaimDecided, versions 1 and 2, when a claim is decided, from the claim's events.",
  },
) {}

// StreamPins.ts: every published stream, pinned.
export const partyStreamPins: ReadonlyArray<StreamPin> = [
  StreamPin.cases.Closed.make({ stream: "PartyFacts" }),
  StreamPin.cases.Open.make({
    stream: "PartyFacts2",
    writer: StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Claim"] }),
  }),
];
```

`runs/host/src/Inbox/ClaimDecided.inbox.ts · prototype code, trimmed`

```ts
const handle = Effect.fnUntraced(function* (envelope: FactEnvelope) {
  const key = inboxKey(envelope);
  if (envelope.version !== version || (yield* store.seen(key))) {
    return yield* store.commit(envelope.producer, O.none(), envelope.seq);
  }
  const fact = yield* Effect.orDie(decode(envelope.payload));
  const hop = byProcess(
    process,
    Cause.cases.Fact.make({
      producer: envelope.producer,
      contract: envelope.contract,
      version,
      fact: envelope.factId,
    }),
  );
  yield* Effect.forEach(
    fact.reviewRuns,
    (run) =>
      Effect.gen(function* () {
        const live = yield* liveRun(runs, run);
        const commandId = yield* requestKey({
          tenant: fact.org,
          operation: ConcludeRun.tag,
          payload: { fact: key, run: live.run },
        }).pipe(Effect.provideService(Digest.Digest, digest));
        yield* runs.send(
          live.run,
          ConcludeRun.make({ outcome: fact.outcome, hop }),
          { commandId },
        );
      }),
    { discard: true },
  );
  yield* store.commit(envelope.producer, O.some(key), envelope.seq);
});
```

### Published streams, generations and upgrades

A published stream is pinned to its writer: the projection, its generation and its sources. The
projection behind it is never rebuilt in place. A checker fails a bump of the projection's version,
of a view it reads, a change of its sources or of the projection itself, unless the stream's
generation is pinned closed and a new one opened. A change to a fact is a new fact version or a new
stream generation (D43).

The feed serves closed generations followed by the open one as a single log. A closed generation's
length is fixed, so its entries keep their positions and the next generation follows at that length
plus its own position; a checkpoint taken before the new generation existed keeps its meaning. The
new generation republishes the decisions the old one holds under the same fact ids, and a consumer
drops those by producer, fact id and version.

`shared/tooling/src/PublisherHandover.ts · prototype code, trimmed`

```ts
export const checkPublisherHandover = ({
  current,
  next,
  backlog,
}: {
  readonly current: ReadonlyArray<StreamPin>;
  readonly next: ReadonlyArray<StreamPin>;
  readonly backlog: ReadonlyArray<PublisherBacklog>;
}): Effect.Effect<ReadonlyArray<Handover>, PublisherPending> => {
  const handovers = handoversOf({ current, next });
  // ... each handover's backlog entry: unread, or pending > 0, refuses the deploy
};
```

- **An upgrade that replaces a publisher drains it first.** The check refuses a deploy that closes
  a generation or gives it another writer while the outgoing publisher has anything unpublished
  (D47). It reads any writer's backlog from the host's own records: deliveries staged to the writer
  or to a view it reads, inputs accepted and not handled, and an incomplete backfill run. That
  reader agreed with Party's own query in every comparison (D50). It cannot run on the in-memory
  platform, whose queue is out of reach, so it is proven only against Postgres; a library call for
  it is proposed upstream.
- **A fact version is retired when no deployment descriptor consumes it.** Each descriptor declares
  the versions it consumes, and a checker reports a version nobody consumes as retirable. A
  producer's newest version is never reported, since it is a fact being introduced (D34, D40).
- **A closed generation stops being served only when three things hold.** The next generation holds
  every fact it held with the same payload, every consumer in every deployment descriptor has read
  past it, and positions keep their meaning. A `Retired` pin keeps the generation's length so later
  positions stay where they were (D51). Run against the cluster after the upgrade case, the check's
  verdict for generation 1 was "allowed". Nothing was retired, and a feed with a retired generation
  ran in process only.
- **A real upgrade ran on the cluster.** Phase 8's code was deployed, a decision was made with its
  fact undelivered, and the drain check refused; once the publisher drained it passed. The current
  code was deployed over the same data, the new generation was backfilled equal to the old, and the
  review run concluded once. The data was fresh: one decision and one run.

- **A synchronous request** goes from a consumer port, through a host adapter, to the provider's
  gateway contract. It replaces `shared/use-cases`, which existed to hold these contracts.
- **An asynchronous fact** goes from the provider's published stream and feed to the consumer's
  inbox. The inbox key is producer, fact id and version, and the command id is a request key over
  the org, the operation and the fact, so a fact delivered twice changes nothing and a crash before
  the checkpoint is safe. A consumer of version 1 survives version 2. The inbox in the prototype
  polls on every runner over a shared store, which those ids make safe.
- **No context imports** another context's aggregate, private event, view, store, handler or model.
  A stored domain event rebuilds the producer's state. Letting another context follow it would make
  every internal refactor a public breaking change.
- **The shared kernel is language only:** ids, the `Invocation` and `Provenance` schemas, the
  grant-check language, the fact envelope and inbox key, the request key, the deployment descriptor
  and stream pin schemas, and the `Session` middleware declaration. No aggregate, no Model, no
  Layer.
- **Contexts are named by language.** "Every name has one meaning" is the test, and context naming
  stays with the reviewer. By that test `documents` holds at least two contexts.

## The role vocabulary

One rule generates most of it. `<Module>/<Noun>.<kind>.ts` declares a block, a `.handler.ts` beside
it implements it, and an `.adapter.ts` in the host implements a port, a gateway or a middleware's
server half over a driver or another context's contract. Each file has one designated primary
export, and a checker compares that export with the suffix using a rule per kind: most kinds name
the primary after the noun, and a few name it by a rule (an adapter for what it adapts, a machine's
`update`) (D10, D8). The suffixes below are the ones the prototype uses.

**contract package**

- **`.id.ts`**: A branded id
- **`.command.ts`**: A command; its events and private rejections as companions
- **`.event.ts`**: An event several commands record
- **`.rejection.ts`**: A rejection several commands share
- **`.read.ts`**: A view's or query's read contract
- **`.fact.ts`**: A published fact and its versions
- **`.gateway.ts`**: A service other contexts call
- **`.catalog.ts`**: The aggregate-free catalog (interim, D9)
- **`.capabilities.ts`**: The context's capabilities
- **`.contract.ts`**: A client Api over the catalog

**model package**

- **`.aggregate.ts`**: State union, decide, evolve, reply
- **`.rules.ts`**: Pure guards that decide starts from
- **`.view.ts` `.stream.ts`**: Reads; a published stream
- **`.policy.ts` `.saga.ts`**: Reactions and processes
- **`.projection.ts` `.query.ts`**: Store and stream writers; readers
- **`.handler.ts`**: The implementation of a view, policy, saga, projection or query
- **`.store.ts`**: A store port and its memory twin
- **`.external.ts`**: An `ExternalSystem` port
- **`.api.ts` `.model.ts`**: Apis; the context's Model
- **`<Context>.handlers.ts`**: The generated handler registry
- **`<Context>.ports.ts`**: The ports union and the purity assertion

**host package**

- **`.adapter.ts`**: A port, a gateway or a middleware's server half
- **`.singleton.ts`**: A cluster class with one owner at a time
- **`.handler.ts`**: A cluster class's implementation
- **`.inbox.ts` `.store.ts`**: A consumer's inbox and its store port
- **`.http.ts` `.route.ts`**: An HTTP surface; a host route
- **`<Context>.cluster.ts`**: What the context runs on a pool: parts and Apis
- **`<Context>.descriptor.ts`**: The deployment descriptor
- **`Adapters.ts` `Host.ts`**: Composers

Decided and not in the prototype: `.entity.ts`, `.cron.ts`, `.workflow.ts`, `.mcp.ts`, and a
`Config.ts` per runtime.

**web package and kernel**

- **`.screen.tsx`**: React: a screen over bindings or a machine
- **`.machine.ts`**: Screen state, messages, pure update
- **`.controller.ts`**: Runs a machine's intents through the bindings
- **`.bindings.ts`**: Bindings generated from the contract
- **`.runtime.ts`**: The atom runtime
- **`.context.ts` `.middleware.ts`**: Request context and middleware declarations

**retired**

`.live.ts`. Subdomain folders, which become Modules. The `audience` annotation, replaced by
capability grants. `Actor` and `CurrentActor`, replaced by `Invocation` and `Provenance`. The
kernel's `stamp` and `relay`, replaced by re-admission. A host outbox table and its relay
singleton. A hand-kept handler registry and hand-written entry modules, both generated now.
Wildcard package exports. `.atoms.ts` and `.view.tsx` as web roles.

From today's standard, retired: the `use-cases`, `tables`, `client`, `ui` and `config` packages;
the domain-kind folders; the domain roles `.values.ts`, `.errors.ts`, `.behavior.ts`,
`.machine.ts`, `.access.ts`, `.contracts.ts` and `.events.ts`; every use-case role; `.repo.ts` and
the six `-handlers.ts` server roles; the hand-written client roles; the entity kit; the planned
eventlog, message-storage, workflow and sharding drivers. `@beep/alchemy-postgres` goes once the
host fixes are in an upstream release.

### Legal imports

- **contract.** Resolves: `@alchemy.run/domain`, `effect`, the kernel, the contract kit, schema
  primitives. Cannot resolve: any model, host, aggregate or handler file; drivers.
- **model.** Resolves: its own contract, `@alchemy.run/domain`, `effect`, the kernel, foundation
  primitive and modeling. Cannot resolve: drivers, React, the DOM, Node, any other context.
- **host.** Resolves: its own model and contract, other contexts' contracts, drivers,
  `@alchemy.run/effect-cluster`. Cannot resolve: React, another context's model or host.
- **web.** Resolves: its own contract and generated bindings, React, Effect Atom; its own model
  only for a listed `Aggregate.predict` screen. Cannot resolve: any `.handler.ts` or `.adapter.ts`,
  the host, driver roots.
- **app.** Resolves: slice hosts and their deployment descriptors, webs, pools and cloud provider
  packages. Cannot resolve: Module-level internals of any context.

The contract and web rows are checked by import-graph tests; the others are decided and checked by
the package manifests alone.

## The proof inventory

Each invariant is listed with its checker, what the checker reads, what it assumes, its gaps, and
what stays with the independent reviewer. The inventory is generated: `PROOFS.md` is rendered from
a data file, and a check fails on drift. Model reflection gives structural checks only. Paths,
imports, executed stories, type checks and a live host are separate inputs with separate checkers.
Mechanical checks catch mechanical mistakes; semantic questions go to a reviewer that did not write
the change, and a person decides only where that reviewer and the author disagree (D8).

The prototype's inventory has 41 entries. Mechanical laws run in `bun run check`, `bun run test`
and `bun run generated:check`; the cluster entries run against a deployed stack.

- **Structure and closure.** Entries: 8. What they hold: Each model is well formed; each file's
  primary export matches its suffix; contract and web closures reach no model or host file;
  packages are reached only through listed exports; handlers need only declared ports; registries
  match their models; each contract Api's group equals the model Api's. Checked by:
  `Domain.verify`, the primary-export law, import-graph walks, the purity type, the registry
  generator, RPC parity.
- **Authority.** Entries: 3. What they hold: Only the authority boundary builds a root invocation;
  events carry grant ids and never grant terms; re-admission never adds a grant, refuses when all
  lapse, and re-checks an agent's accountable human. Checked by: a source scan, an Api test reading
  a view, boundary tests.
- **Facts and published streams.** Entries: 8. What they hold: Each fact version's schema equals a
  frozen snapshot; fact versions retire only when unconsumed and never the newest; a publishing
  projection is never rebuilt behind its stream; decision events carry the scope a fact needs; the
  inbox acts once; a handover waits for the drain; the backlog is read from host records; a closed
  generation retires only under its three conditions. Checked by: snapshot tests, descriptor and
  pin checkers, stories, the handover and retirement checks run in memory and against Postgres.
- **Stored formats and replay.** Entries: 5. What they hold: Earlier stored events, state,
  receipts, saga payloads, activity results and provenance decode and replay with bytes untouched;
  a saga run in flight finishes on its version; the directory sink applies each source once and in
  order; a rebuild has no side effects; a reused command id is answered from its receipt (pinned).
  Checked by: frozen fixtures, saga-version and rebuild tests, story runs.
- **Runs, screens and coverage.** Entries: 3. What they hold: A refused report hop of the review
  run is recorded and the run gives back its reservations; the claim review machine correlates on
  command id, receipt and revision; every declared outcome executes in some story or test. Checked
  by: stories, host tests, the screen story, a run-time outcome recorder.
- **Generated files and the compiler.** Entries: 3. What they hold: Generated files match their
  generators; `check` runs the Effect build with the monorepo's rules over every project; an
  Effect-only finding fails the check. Checked by: regenerate and diff, compiler guard tests, a
  canary project.
- **Host guarantees and fixes.** Entries: 5. What they hold: Drain lease takeover; the commit
  version check; the commit fence; the frozen-runner guarantee; call arguments left out arrive as
  `undefined`. Checked by: an in-process Durable Object host with a test clock, against the patched
  library; the fence also on the cluster.
- **On the cluster.** Entries: 6. What they hold: Upstream's ten conformance cases; idempotent
  sends; a runner killed after a commit, a projection crash, a grant revoked mid-chain and a run
  waiting across a restart; two runners on one instance; backup and restore by `pg_dump` with
  pending scheduled work; earlier stored forms under today's code. Checked by: the conformance
  suite against the stack on the swarm.

`bun run outcomes --check` lists no declared outcome that no story executes. The questions the
inventory leaves for an independent reviewer are four. Does each context, aggregate and command
name a thing the business recognises, and does a new one belong where it was put? Is each
capability and operation list the narrowest that does the job, and does a delegation narrow rather
than copy? Should a fact be public at all, and does each field belong in what other contexts may
depend on for years? What may a stored field retain, and should anything recorded be a reference
instead?

Decided and without a checker yet: stored bytes are never rewritten by a migration; a replay
auditor over cut histories; replay-diff over production-cut histories; every stored field has a
retention class; every command, view, query and Api has a description; only apps depend on pools
and provider packages; a Reasoner change passes a recorded evaluation before release (D19).

### Checked against the eight principles

- **Slice first**: Stronger. A slice is a bounded context, and its Model is a value the tools can
  read.
- **Ports inward, adapters outward**: Stronger. The model cannot resolve a driver, ports are
  schema-checked, and handler requirements are a type.
- **Shared is a shared kernel**: Narrower. Language only: ids, the `Invocation` and `Provenance`
  schemas and the grant-check language included.
- **Rich domain, pure behavior**: One home. Rules live in `decide`; time arrives as an argument,
  never from a clock.
- **Schemas are executable contracts**: Extended. Every block is a schema class, every stored
  format has a compatibility contract, and every published fact version has a frozen snapshot.
- **Topology is compressed context**: Kept. Generated files are checked for drift, and semantic
  choices go to the independent reviewer.
- **Non-slice families are explicit**: Authority and runs become contexts, and operations is a
  decided one. An app composes deployment descriptors.
- **One public origin**: Unchanged.

## What the design makes true

These are properties of an event-sourced model hosted on Effect Cluster. Each is a modelling rule
and belongs in the standard. Where the prototype does not hold a rule yet, the rule says so.

### A stored fact is permanent, and every stored field has a retention class

Events are never rewritten. Content that may have to be erased (names, document text, evidence
excerpts) lives in a store behind a port, and erasure leaves a tombstone. An id can still identify
a person, so a reference alone does not settle retention. The prototype does not apply this yet:
its `PartyRegistered` event still carries a party's name.

### Stored formats convert on read

Stored bytes are never rewritten. Payload conversion covers added defaults, removals, renames and
compatible type changes. An incompatible change is one declared read-time transform per version
step. A new event tag is for a new fact only, so `evolve` keeps one language (D22). A saga's
activity results are a stored format too, and an incompatible change to them is a new saga version
(D35).

### An aggregate owns an invariant and its order

Choose an aggregate by the invariant it holds and the serial order that invariant needs. Whether a
command can be refused plays no part: a fact-only ledger can need one ordered owner with no
rejections, and an upload store can refuse writes and still be a store. Corpus text, embeddings,
RDF triples and mail indexes are stores behind ports.

### A cross-aggregate invariant needs a reservation every conflicting path takes

There is no cross-aggregate transaction. A uniqueness rule becomes an aggregate keyed by the value
it protects, with rules for release, reassignment and the moment an assignment counts. It holds
only if every path that could break the invariant reserves through it. Compensation cannot undo a
violation someone already saw. The prototype has no such aggregate yet.

### No primitive gives an external effect exactly once

Activities persist steps, a singleton is one owner at a time, and a cron retries failed runs and
skips stale ones. Each can still repeat a call. A provider call carries an idempotency key the
provider honours, or the step records an uncertain outcome and a reconciliation settles it.

### A retried command id returns the stored result before `decide` runs

The library answers a reused command id from its receipt before the payload is decoded or the grant
checked. So a command id is bound to the org, the operation and a canonical fingerprint of the
request, and a cached result needs its own authorization check (D36). A rejection is not stored, so
a retried rejected command runs `decide` again.

### Projections are at least once, and a publisher is never rebuilt in place

A crash between a batch and its checkpoint replays the batch. Sinks take the source stream, its
sequence and the projection's generation; they skip what they have applied and refuse an older
generation. A projection that writes a published stream reads aggregate events, never a view, and a
change behind it is a new stream generation (D43).

### A read names the write it follows

Views and projections are delivered after the commit, so an immediate read can return the earlier
state. A caller that writes then reads passes the receipt as `atLeast`, and the read waits: it
polls every 25 ms until the checkpoint reaches the receipt's version, up to 10 s, then fails with
`ConsistencyTimeout`. A receipt's version and a view's revision count different things, so a screen
never compares them.

### Authority is re-admitted at every hop

Every command runs under an Invocation only the authority context built. A policy or saga sends its
trigger's provenance with its own hop to authority and acts under what comes back, which holds only
the grants still in force. A refusal is recorded. A fact-started command runs under the consumer's
own provenance plus a hop naming the fact. No reaction acts as System, and every agent-rooted
action names an accountable human.

### The host states what it guarantees, with bounds

No acknowledged write is overwritten. A runner that lost its shard cannot commit. After a runner
dies, every reaction happens exactly once within one lease. A write to a frozen runner completes or
fails within the caller's retry budget, is never stored twice, and its retry gets its receipt. A
pool is acceptable only when its conformance run shows all four (D5, D41, D42, D45, D55).

### Everything that runs has an address or an owner

A stateful process is an entity with an id. A loop is a singleton, owned by one runner at a time. A
schedule is a cron. A run is bounded and continues as a new run at its bound. The prototype's inbox
is the one exception: it polls on every runner, made safe by idempotent command ids.

### Rules ship where they are chosen

Browsers and other contexts import the contract. A screen that predicts with `decide` imports the
model on purpose and is listed, and a prediction is never authorization or a write. Secrets live in
a host's configuration and nowhere else.

### Every transition has a story

On the server a transition is `decide` and `evolve`. In the browser it is `update`. Both are pure,
both are specified by a story that fails on anything it did not expect, and coverage counts
outcomes that executed.

## Durable compatibility and replay

Every stored format has a compatibility contract: aggregate state, events, receipts, provenance,
and saga payloads and activity results. Stored bytes are never rewritten; formats convert on read
(D14, D22, D35). Replay modes rebuild read models without repeating side effects. This is proven in
memory with frozen fixtures, and on the cluster by writing earlier stored forms directly and by
restoring an earlier dump under later code.

- **Events.** How the library reads it: The kernel picks the codec by the stored `_tag`, then
  decodes. What proves a change: Frozen histories with expected values; replay equivalence.
- **Aggregate state.** How the library reads it: Decoded directly on load; an event codec does not
  migrate it. What proves a change: Frozen stored state, and declared conversions such as the run's
  earlier cancelled form.
- **Receipts.** How the library reads it: Their own event and reply decoding. What proves a change:
  Frozen receipts with replies, and the command-id reuse tests.
- **Provenance.** How the library reads it: An event field, written by the kernel's `carry`. What
  proves a change: A frozen provenance fixture.
- **Saga payloads and activity results.** How the library reads it: The workflow engine, across a
  deploy. What proves a change: Frozen payload and activity fixtures; two saga versions side by
  side across a redeploy.
- **Projection rows.** How the library reads it: The sink. What proves a change: Source position
  and generation; a rebuild into a new generation.
- **Published facts.** How the library reads it: The consumer, by version. What proves a change:
  Each version's JSON Schema against a frozen snapshot; a version 1 consumer beside version 2.

- **Convert on read.** Payload conversion handles added fields with defaults, removed fields,
  renames and compatible type changes. An incompatible change is one declared read-time transform
  per version step. A new event tag is for a new fact only. A widen-only rule would send every
  rename to a new tag and fork the language `evolve` reads. Axon Framework 5.4 draws the same line
  and leaves stored events in the form they were written (Grok research).
- **A codec picked by tag cannot rescue an old tag.** The library chooses the event codec by the
  stored `_tag` before decoding, so the transform for a renamed event belongs to the old tag's read
  path. A top-level event field cannot be renamed with the library's Event builder; that is an
  upstream ask.
- **Decoding is not the whole proof.** A decode-only check passes a codec that maps every old
  amount to zero. Each change carries frozen old-format fixtures with semantic expected values and
  replay equivalence (Astra review, item 2).
- **Saga versions.** The workflow behind a saga is named after the saga, so two names are two
  workflows, and a run in flight finishes on the version it started. The library cannot list a
  saga's runs in flight, so nothing yet proves an old saga version is safe to drop.
- **Projection sinks take source position and generation.** Bumping a projection's `version`
  rebuilds it over the whole history. A publishing projection is the exception: its version is
  pinned, and a change behind it opens a new stream generation (D43).
- **Replay modes suppress side effects.** Rebuilding a read model does not restart policies, call
  the Reasoner, send mail or publish integration facts: policies, sagas and the publisher keep
  their own checkpoints, so only the rebuilt projection runs again.

## The operations context

**Decided, not built.**

Operations is a bounded context with its own model. Every repair is a command that an agent
proposes and an aggregate decides. A poisoned instance is quarantined. Each port declares a
degraded mode. An operations Api carries the recovery verbs (D14).

An incident opens from signals the system already has: a saga that `Died` or was `Rejected`, a
policy out of retries, a failing port. A triage saga asks the Reasoner for a schema-checked repair
proposal and attaches what `Aggregate.predict` says the repair would do. The repair aggregate
accepts a proposal only when the prediction is definite, one instance is touched, the fan-out is
under budget and no external operation is reachable. A refused repair pages a person. This shape
comes from the ADHD pass, focus 2, and is a sketch.

The operations Api lists pause, inspect, reconcile, retry, rebuild and retire. Each runs under a
grant and returns a receipt. Quarantine lives in the host. A degraded port answers `Deferred` and
writes the call to an outbox for later.

Unverified: a sub-agent reported that a defecting cluster entity is restarted without end, below
any aggregate. Nobody has re-checked it. The first test makes one id's `evolve` throw and asserts
that sibling ids still answer.

## Stories cut from production

**Decided, not built.**

Production histories become stories. A journal on aggregate sends records what the stored log
lacks: the command, its Invocation, the rejection and the port answers. A cut joins one journal row
to its stream and emits story steps (D14).

Fixtures are pseudonymised with a keyed hash. A fixture whose outcome changes under scrubbing stays
inside production. Before a change to `decide` or `evolve` lands, a replay-diff folds sampled
histories through the new code and re-decides the journaled commands. A difference passes only when
a declared migration reproduces it on every sample. An outcome production has reached counts as
covered only by a cut story.

This rests on `decide` depending only on what the journal captured. The journal holds the most
sensitive data in the system, so it gets the strictest retention class.

## Retention and trust

**Decided, not built.**

Every stored field has a retention class, and erasure leaves a tombstone. Agent reads of privileged
material are recorded. Content from outside carries a trust label that limits which actions it can
influence (D14).

Events keep facts and references. Erasable content (names, document text, evidence excerpts,
prompts, transcripts) lives in stores behind ports, each with its retention class. Erasure replaces
the content with a tombstone and keeps the reference. Copies, caches and backups follow the same
class. No source checked so far establishes that a reference left in a private log satisfies an
erasure duty, so the design claims erasure of content and nothing more (Grok research).

When an agent reads privileged material, the read becomes an `AccessRecorded` event on its run.
Mail, documents, retrieved memories and tool results can carry instructions. Each item carries a
trust label, and a grant can name which labels may influence which operations. `decide` checks
invariants and cannot tell a proposal shaped by an injected instruction from a sound one. Grants
stay narrow, and trust labels gate what untrusted content may influence.

## What is proven

As of phase 12 (2026-11-14), re-run by the orchestrating session: zero Effect diagnostics over 17
projects, 196 tests, 109 of 109 declared command outcomes executed, and a proof inventory of 41
entries. The prototype has three contexts (`party`, `authority`, `runs`), a `party/web` package and
one app. It ran on the swarm in six sessions; phase 12 ran in process only. Every swarm session
ended with the stack and the swarm removed, and Docker matched a baseline recorded before it apart
from build cache.

### The graduation gate

All eight items of the D16 gate are proven. Seven are proven in memory, the two screens without a
browser. The eighth, conformance on the Postgres swarm host with restore, passed on one build in
the sixth swarm session: upstream's ten cases and every case of the prototype's own, including a
real upgrade from earlier code over live data. That pass rests on six local fixes to
`@alchemy.run/domain` and `@alchemy.run/effect-cluster`, plus a startup guard added afterwards and
run in process only. The patched pass counts as the gate's conformance item, and retiring
`@beep/alchemy-postgres` waits until the fixes are in an upstream release (D53).

- **Two contexts exchanging an integration fact through an outbox and an inbox.** State: Proven in
  memory; runs on the cluster. Evidence: `Facts.story.test.ts`, `RunsHost.test.ts`,
  `ClaimDecided.snapshot.test.ts`; the waiting-run and upgrade cases on the swarm.
- **A parent and a child agent run, with budget exhaustion.** State: Proven in memory. Evidence:
  `Runs.story.test.ts`, `RunsHost.test.ts`.
- **Approval through the authenticated command boundary.** State: Proven in memory. Evidence:
  `ReviewRun.test.ts` through the real Session boundary; an agent-rooted or relayed approval is
  refused.
- **A projection rebuild with no side effects.** State: Proven in memory. Evidence:
  `Rebuild.test.ts`, `PartyDirectory.sink.test.ts`.
- **A stored-format compatibility test, activity results included.** State: Proven in memory;
  earlier forms decode on the cluster. Evidence: `StoredFormat.test.ts` in party and runs,
  `SagaVersions.test.ts`; the stored-forms and restore-across-versions cases.
- **The conformance suite on the Postgres swarm host, restore included.** State: Passed on one
  build, on six local fixes. Evidence: Sixth swarm session: upstream's ten cases, the prototype's
  own cases, backup and restore by `pg_dump`, the upgrade from phase 8's code.
- **One plain screen and one machine-backed screen.** State: Proven without a browser. Evidence:
  `ClaimReview.story.test.ts`, `Bindings.test.ts`, a render test per screen.
- **The proof inventory for each invariant.** State: Done, 41 entries. Evidence: `PROOFS.md`,
  generated and checked for drift.

### Also built and proven

- **In memory:** the file grammar with exact exports and generated registries; the authority
  context with delegation that only narrows and accountability; provenance in events and
  re-admission at each hop; the runs context with its ledger, lineage and continuation; the
  Reasoner evaluation contract across three adapters; a toolkit derived for operating agents under
  a run's own grant; command ids bound to org, operation and request; deployment descriptors with
  the fact-retirement checker; stream pins, the publisher drain check and the generation retirement
  check.
- **On the cluster:** the generated entry modules load; gateways reach other contexts over the
  pool's dispatch; the four host guarantees except the frozen-runner case (see Effect Cluster);
  restore needs only a quiesced `pg_dump`, not Alchemy's state.

### Not yet observed

- **On a cluster:** the startup guard; the refusal on an unnamed pool, which follows from the SQL;
  the bootstrap declaring the pool name on a real runner, and a runner failing to start; the
  frozen-runner case as rewritten for D55 (an earlier run saw such a write wait over 60 seconds, so
  it may fail); serving a retired generation, which ran in process only.
- **The fixes are not upstream.** Until they are in an Alchemy release, any slice run on Effect
  Cluster carries the patches.
- **A connection pooler that rewrites the session name defeats the fence's identity.** The runner
  starts and every commit is then refused. The startup guard cannot see this.
- **The upgrade proof is small:** one decision and one run, on fresh data.
- **Root forgery in process.** The control is a source scan with known gaps; an upstream change is
  the target (D25).
- **A reused command id is answered from the stored receipt before the payload is decoded or the
  grant checked.** Pinned as a test; an upstream ask.
- **A top-level event field cannot be renamed with the library's Event builder.** An upstream ask.
- **The generic backlog reader cannot run on the in-memory platform,** so the drain check is proven
  only against Postgres. A library call for it is proposed.
- **Swarm cannot bind a published port to localhost.** The conformance driver runs inside the
  stack's network.
- **The prototype resolves `@beep/identity` and `@beep/schema` from the monorepo** and is no longer
  standalone.
- **A defecting cluster entity is reported to restart without end,** below any aggregate. Found by
  a sub-agent and never re-checked.
- **Browser session credentials, tenant and cache clearing** are deferred to the browser QA and
  HTTP wiring work. Browser QA itself is not done.
- **Not built:** the `AgentSession` entity, the coding-agent sandbox, the agent evaluation harness
  (a later goal, D19), and pools other than one Docker swarm.

Decided and not built: the operations context, production-cut stories, and retention and trust
(D14). They are added scope with no proof yet, outside the graduation gate.

### The upstream set

Seven patches and three write-ups for `alchemy-run/alchemy` at 33c10dd (2.0.0-beta.87) are in the
prototype's `notes/upstream/`, in the order a maintainer should take them. None has been sent: no
issue, pull request or message has been posted (D54). Applied in order, the patches reproduce
exactly the sources the prototype ran; all except 10 ran on a cluster.

- **`03` commit version check**: A runner that stalls past its shard lock overwrites an
  acknowledged write; the commit now checks, inside its transaction, the version `decide` saw.
- **`08` name the runner pool**: No connection can tell which runner holds a shard; the runner
  bootstrap names its Postgres pool `effect-cluster:<host>:<port>`.
- **`07` commit fenced on shard ownership**: A runner that lost its shard is still acknowledged;
  every commit is fenced on this runner's own lock session, checked first and at `COMMIT`.
- **`10` fail at start without a named pool**: A runner whose fence can never succeed refuses every
  commit silently; it now fails at start. In process only.
- **`01` drain lease takeover**: A drain whose holder died leaves its rows stranded until the next
  commit; it now comes back when the lease expires.
- **`06` call arguments keep `undefined`**: Left-out optional arguments arrive as `null` on Effect
  Cluster, so every backfill lists nothing; trailing `undefined`s are left out of the JSON.
- **`02` runner background calls**: Calls from fibers a model's Layer starts on a runner fail with
  `InvalidUrl`; they now go through the runner's `Sharding`.
- **`05` issue**: A rebuilt projection's first appends to its stream are silently dropped.
- **`04` proposal**: Drain leases follow instance ownership, so recovery does not wait out the
  lease.
- **`09` proposal**: `Projection.Progress.backlog`, so a drain check is one line on every platform.

The next step for the set is a read-only check against Alchemy's current main and its open issues
and pull requests, rebasing where main has moved. The final texts then go back to the operator, who
is asked again before anything is posted (D58). Two upstream changes the design wants are not in
the set yet: request context persisted with events (D4), and a model-free Api with an aggregate
declaration separate from `decide` and `evolve` (D9); the request-context hook for root forgery
(D25) is a third.

### What comes next

- **Done.** The prototype reworked to the decided shape and proven in memory (D15).
- **Done.** The same code on the Postgres Docker swarm host with the conformance suite; the gate is
  met on the patched pass (D5, D53).
- **Written, not sent.** The upstream set, held for the read-only check against Alchemy's main
  (D54, D58).
- **Next.** The operator confirms the shape in `BRIEF.md` and this page (D56). The packet is then
  decomposed and its goal packets created, and the branch goes to one pull request carrying the
  packet, the prototype and any goal packet created by then (D57).

Until the packet graduates, slice work already under way on the current seven-package standard
finishes as planned. No new slice migration to `@alchemy.run/domain` starts on the seven-package
shape (D17). The hold is recorded in the packet and not yet in `standards/`.

## What graduation would amend

Nothing in `standards/` has been amended, and the packet has not graduated.
`standards/ARCHITECTURE.md` and `standards/architecture/DECISIONS.md` stay unchanged until it does
(D1, D16). The gate is met (D53); the shape review comes first (D56), then the goal packets. When
the packet graduates, the amendment covers these sections.

- **North Star, Slice Package Topology**: The bounded context is the unit, with one `Domain.Model`
  by default. Four packages: contract, model, host, web. The contract holds the aggregate-free
  declarations and its Api over a catalog until the library splits the Api from the Model.
- **Decision 2026-11-06 and adoption D9**: Commands, events, rejections, read contracts and facts
  live in the contract; aggregates, reactions and ports in the model, with handlers beside them in
  `.handler.ts`; port implementations in the host's `.adapter.ts`. The placement table reduces to
  one question per file: which closure it needs.
- **Adoption D1 and the drivers list**: Host on Effect Cluster, Postgres proved first. Retire
  `@beep/alchemy-postgres` once the host fixes are in an upstream release, and drop the planned
  eventlog, message-storage, workflow and sharding drivers.
- **CQRS, Events, Workflows, Cluster, And Read Models**: Rewrite around the state-to-primitive
  table, the at-least-once rules, bounded runs, the compatibility contract, and the four host
  guarantees with their bounds as the conformance bar for any pool.
- **Apps, and the `tooling/infra` kind**: An app composes slice deployment descriptors onto pools.
  Entry modules are generated into the app. Slices name no cloud.
- **Domain-Kind Folders, Role Suffixes**: Module folders and the kind-suffix vocabulary, with one
  primary export per file and a rule per kind.
- **Principle 5, persisted entities**: Replace the `ProductEntity` law with convert-on-read, the
  stored-format compatibility contract (saga activity results included) and retention classes.
  Tables are projection stores and inbox stores inside a host.
- **Config role vocabulary**: No slice config package. Each runtime owns its configuration;
  business constants are model values.
- **Client and UI vocabularies**: One web package over generated bindings, with machines where a
  screen earns one.
- **Slice Consumption Rules**: Integration facts: a publishing projection over aggregate events
  into a pinned published stream with generations, served as a feed and read into an inbox; the
  publisher drain before a handover; the retirement rules for fact versions and generations.
  Consumer ports over provider gateway contracts. Retire `shared/use-cases`. The kernel gains the
  `Invocation` and `Provenance` schemas and the grant-check language.
- **Access, Policy, And Error Kinds**: Only the authority context builds an Invocation; events
  store provenance, and every hop is re-admitted from live grants. Policy means `Domain.Policy`
  only. Actionable failures are rejections, declared as branded tagged errors, and a refusal is
  recorded.
- **New section: Agents**: The `runs` context, the `AgentRun` aggregate and its budget ledger,
  delegation at request, the product context's executor, bounded runs and sessions, approval as a
  command, Accountability, the two agent surfaces, the Reasoner evaluation contract.
- **New sections: Operations, Retention and trust**: The operations context, production-cut
  stories, retention classes, recorded privileged reads, trust labels.
- **Enforcement And Migration Posture**: The generated proof inventory replaces the docs-only rows,
  and the Effect language-service rules run in every check. The Review Gate lane becomes the
  independent reviewer.

Sources: `explorations/model-first-slices/DECISIONS.md` (D1 to D58, and the phase 1 to phase 12
entries) and `BRIEF.md`; the packet's research files `02-astra-review.md`, `03-kimi-review.md`,
`04-adhd-pass.md`, `05-grok-deep-research.md` and the phase notes `08` to `20`; the prototype in
`scratchpad/model-first-slices/`, its `PROOFS.md` and `notes/upstream/`;
`standards/ARCHITECTURE.md` and `standards/architecture/DECISIONS.md`;
`explorations/alchemy-domain-adoption/DECISIONS.md`; the vault-sync slice under
`packages/documents`; `@alchemy.run/domain` and `@alchemy.run/effect-cluster` at 2.0.0-beta.87;
Effect 4.1.4, including `@effect/platform-cloudflare`. Code marked as prototype code is quoted from
the prototype and trimmed, with its package names (`@proto/*`). These are decided and do not exist
yet: the operations context, the production journal and cut stories, retention classes and trust
labels, the `AgentSession` entity, the coding-agent sandbox, `@beep/alchemy-atom`, a gateway token
between pools, the model-free Api and aggregate-declaration split upstream, `SLICE.md` and
`MODEL.generated.md`.
