# Fresh-eyes review: model-first slices

## Verdict

Keep schema-checked ports, event-backed write models, runtime-closure packages, and closed-world stories.
Reject the equation `bounded context = one Domain.Model = one deployment unit`; a context owns language and data, while a Model is an internal runtime graph.
Replace `audience` with capabilities and authenticated delegation. Replace `Actor` payload stamping with trusted provenance in the event envelope.
Make `AgentRun` an aggregate, sagas its executors, and cluster entities restartable workers. Publish generated client and integration contracts instead of the whole model.
Keep pure machines for genuinely stateful screens. Generate the ordinary React command/view path instead of writing three files for every screen.

## What I would redesign

### The unit of architecture

The proposal starts with the right goal, then lets the library choose all the boundaries. That is the central mistake.

A bounded context owns four things:

- a ubiquitous language;
- commands, reads, and integration facts it publishes;
- the data and invariants it owns;
- the people and agents responsible for changing it.

A `Domain.Model` is a write-side and reaction graph with an event-storage namespace. It is not a ubiquitous language. One Model per context is a good default. It is a bad identity rule. A second Model is justified by an independent event lifecycle, storage placement, or reaction graph, never by whether the first Model fits in an agent's prompt.

Packages need to separate publication as well as runtime dependencies. The proposal's `model` package is both the server write model and the browser SDK. Those are different jobs. I would use four closures:

```txt
packages/party/
  SLICE.md                         # authored: purpose, language, invariants, read order
  contract/                        # @beep/party-contract; generated public contract
    src/
      Claim/
        AcceptClaim.contract.ts    # input, output, public rejections, operation id
        ClaimReview.contract.ts    # read DTO, key, revision/receipt type
      ReviewerApi.client.ts        # client descriptor; no decide/evolve/handlers
      Party.integration.ts         # versioned facts other contexts may consume
  model/                           # @beep/party-model; server write/reaction model
    src/
      Claim/
        Claim.id.ts
        Claim.aggregate.ts
        Claim.rules.ts
        AssertClaim.command.ts
        AcceptClaim.command.ts
        ClaimReview.view.ts
        ClaimReview.handler.ts
      Review/
        AgentRun.aggregate.ts
        RequestReview.command.ts
        ReviewAssist.saga.ts
        ReviewAssist.handler.ts
        Reasoner.external.ts
      Directory/
        PartyDirectory.projection.ts
        PartyDirectory.handler.ts
        PartyDirectory.store.ts
        FindParties.query.ts
        FindParties.handler.ts
      Party.model.ts
      Party.handlers.ts            # generated registration, checked by diff
      ReviewerApi.api.ts
    test/
      Claim/AcceptClaim.story.test.ts
      Review/ReviewAssist.story.test.ts
      Party.flow.story.test.ts
    MODEL.generated.md             # source-linked inventory and diagrams
  server/                          # @beep/party-server
    src/
      Review/
        ClaudeReasoner.adapter.ts
        AgentExecutor.entity.ts
        AgentExecutor.handler.ts   # ephemeral worker, rebuilt from AgentRun
      Evidence/
        GraphContactSource.adapter.ts
        MailboxPoller.singleton.ts
        MailboxPoller.handler.ts
      Directory/
        PartyDirectory.table.ts
        PartyDirectoryStore.adapter.ts
      deployment.ts                # public deployment descriptor
  web/                             # optional @beep/party-web
    src/
      ClaimReview/
        ClaimReview.screen.tsx
        ClaimReview.machine.ts     # only when interaction state earns it
        ClaimReview.controller.ts
        ClaimReview.story.test.ts

apps/practice/
  src/
    Cluster.ts                     # pools and placement only
    practice.deployment.ts         # slice descriptors on chosen pools
  generated/cluster/               # generated `main` modules, never hand-maintained
```

`contract` is generated from the declared public Api and Model. The browser never imports aggregate state, `decide`, private events, sagas, or every other client's operations. Client safety then includes the shipped module graph, not only the absence of server secrets.

`web` remains optional. `contract` and `model` exist for a model-backed context even when no UI exists. This is still a small slice, but each package now has one reason to exist.

### File and path grammar

`Claim`, `Review`, and `Directory` are modules, not subdomains. A subdomain is a strategic domain distinction. A read directory and an inference port do not become subdomains because they have folders. Call the grammar `<Module>/<Noun>.<kind>.ts` and keep modules focused on a consistency boundary, process, or read model.

The command layout is good. Keep a command beside its private events and rejections. Keep pure rules beside the aggregate. Do not reintroduce `events/` or `rejections/` folders.

I would replace `.live.ts` everywhere:

- `.handler.ts` implements a view, policy, saga, projection, query, entity, singleton, or cron.
- `.adapter.ts` implements an `ExternalSystem` or store port over a driver.
- `.layer.ts` composes Layers when a composer is too large for `deployment.ts`.

`.live.ts` says nothing about the responsibility. It also mislabels model handlers that run unchanged against memory. `ClaimReview.handler.ts` is clearer than `ClaimReview.view.live.ts`, and `AgentExecutor.handler.ts` says more than `AgentExecutor.entity.live.ts`.

The browser denylist should cover `*.handler.ts`, `*.adapter.ts`, `*.layer.ts`, and the entire server package. The package export map should contain exact entrypoints, not `"./*": "./src/*.ts"`. The prototype's wildcard makes the boundary depend on every caller obeying a convention.

Generate `Party.handlers.ts` from `Party.model.ts`. The current hand-maintained list can omit a handler while every suffix law stays green. The same generator should emit source links, story coverage, and public contract files.

### Capabilities, not audiences

`audience` mixes documentation, routing, and authorization. It fails all three once a reviewer delegates to an agent, an operator needs temporary access, or one operation serves two roles. The prototype's global `Audience` union also puts Party-specific roles in the kernel.

Use three separate concepts:

```ts
// Conceptual capability declaration, not a new annotation on Domain.Api.
export const ReviewClaim = Capability.make("party.claim.review", {
  operations: [AcceptClaim, ClaimReview],
  resource: Resource.Org,
})

export const ReviewApi = Domain.Api("PartyReview/v1", {
  model: PartyModel,
  capabilities: [ReviewClaim],
})
```

- An Api is a published, versioned consumer contract.
- A capability is a set of operations and a resource scope that can be granted to a principal or delegated to a run.
- An optional documentation label can say that a screen is designed for reviewers. It has no authority semantics.

Listing a command in `AgentApi` is not least privilege. Least privilege comes from authenticated grants checked at the command boundary, with resource constraints and expiry. The aggregate still checks the invariant. It should not reconstruct authorization by matching on `Actor._tag`.

### Cluster composition

Cluster class declarations and handlers belong in `server`, beside the adapters and processes they host. The app should choose pools and placement without naming `Party`, `MailboxPoller`, or individual models.

Each server package publishes a descriptor:

```ts
// packages/party/server/src/deployment.ts
export const PartyDeployment = Deployment.make({
  name: "Party",
  models: [{ name: "Party", host: hostParty }],
  processes: [MailboxPoller],
})
```

The app composes descriptors:

```ts
// apps/practice/src/practice.deployment.ts
export const PracticeDeployment = Deployment.compose({
  name: "Practice",
  slices: [
    PartyDeployment.on(DefaultPool),
    IdentityDeployment.on(DefaultPool),
    AnalyticsDeployment.on(ReportingPool),
  ],
})
```

A generator reads the descriptors and emits the one-`main`-per-class modules the cluster loader requires. The stack yields the composed deployment. Handwritten app entry modules are repetitive registration code and will drift from the server packages.

This also answers placement directly. Pools are app choices. Models and worker classes remain slice-owned. No browser receives a pool credential.

### Between slices

The consumer-owned `ExternalSystem` with an adapter to another context's Api is the right synchronous pattern. Keep it, but point the adapter at the provider's `contract` package, not its model package.

The event design needs a harder boundary. A stored `Domain.Event` is a private fact used to rebuild the producer's state. A `Domain.Stream` or view event is also internal until the producer deliberately publishes it. Letting another context subscribe to either makes internal refactoring a public breaking change.

Use separate integration facts:

```ts
// packages/party/contract/src/Party.integration.ts
export class PartyMergedV1 extends IntegrationEvent("party/PartyMerged", 1, {
  survivor: PartyId,
  absorbed: PartyId,
  occurredAt: S.DateTimeUtc,
}) {}
```

The producer translates private events to this contract in its server outbox. The consumer has an inbox keyed by `(producer, eventId, contractVersion)`, translates the fact into its own language, and sends its own commands. Its saga or policy owns the reaction and checkpoint. A singleton can run the transport loop, but it should not contain a hand-built checkpoint and idempotency scheme.

The resulting rules are simple:

- synchronous request: consumer port, server adapter, provider public client contract;
- asynchronous fact: provider integration contract and outbox, consumer inbox and translation;
- no import of another context's aggregate, private event, view, store, handler, or model;
- no cross-context reaction hidden in a generic polling singleton.

## Agent ergonomics

### The first five minutes

An agent opening a slice should read in this order:

1. `SLICE.md`, an authored one-page explanation of purpose, vocabulary, invariants, public capabilities, data ownership, and the expected change loop.
2. `MODEL.generated.md`, a source-linked projection of the Model with state transitions, command-to-event/rejection edges, required grants, saga waits, ports, and story links.
3. The story for the behavior being changed.
4. The aggregate or process module and its command file.
5. `server/deployment.ts` only when the change touches adapters, processes, or placement.

A fully generated `SLICE.md` cannot replace the authored page. Introspection can list `AcceptClaim`; it cannot explain why two independent sources matter, which facts are public, or whether acceptance is a legal decision. Put generated inventory in `MODEL.generated.md` and keep the human meaning in `SLICE.md`. Link each generated entry to its source and story.

### What an agent gets wrong in the current shape

- It treats every folder as a subdomain and creates folders for technical roles.
- It assumes `.live.ts` is a driver adapter, then writes model behavior in the wrong package.
- It follows the wildcard export and imports a handler from a browser module.
- It adds a new audience when the actual requirement is a narrower grant.
- It adds a declaration but forgets the manual `Handlers.ts` registration.
- It provides `CurrentActor` directly, because the saga example teaches that identity is just another Context service.
- It puts run state in a saga, session state in an entity, and proposal state in an aggregate without choosing a system of record.
- It creates a machine, atoms file, and view for a screen that only needs a generated query and command binding.
- It edits a generated `SLICE.md` to add the semantic guidance the generator cannot express.

### Make the right change the easiest change

A slice generator should accept an intent such as "add command AcceptClaim to Claim". It should create the command, register its events with the aggregate, add its capability to the chosen Api, regenerate handlers and contracts, and create a named story skeleton. Deleting a command should remove the same set.

Use exact exports such as `/contract`, `/model`, `/server`, `/test`, and `/deployment`. Do not expose deep source paths to consumers.

Split the monolithic `Party.story.test.ts` by module and keep a small number of whole-context flow stories. A command author should open `AcceptClaim.story.test.ts`, not scroll through directory search and agent delegation to find the relevant assertion.

Keep the story kit. Closed-world assertions on events, rejections, and port calls are the best part of the proposal. Improve the coverage law so it observes executed outcomes. Searching a story file for each rejection tag proves only that a string appears. The Story runtime should record which command outcomes executed and fail when a declared rejection has no executed case.

The computed laws need pruning:

- Keep `Domain.verify`, exact export boundaries, handler registration diffs, port purity, stored schema compatibility, and generated-doc diffs.
- Replace the audience law with capability/grant checks and authorization stories.
- Replace mandatory event `by` fields with trusted envelope provenance.
- Replace client import-graph checks with a built browser artifact check as well.
- Add a law proving every declared handler is registered and every registered handler belongs to the Model.
- Add contract tests for every ExternalSystem memory twin and live adapter.

Do not automate bounded-context naming, capability scope, public-event semantics, or the decision to retain a fact. Those require design review. Mechanical checks should catch mechanical mistakes, not declare design judgment obsolete.

## Agents in the model

A saga is the right execution mechanism and the wrong identity for an agent run. A cluster entity is the right worker and the wrong system of record. The `Actor` union records a useful label and does not model authority.

I would use this split:

- `AgentRun` aggregate: the durable record and lifecycle of the run.
- `RunSaga`: durable execution, retries, waiting, timeouts, and compensation.
- `AgentExecutor` cluster entity: a restartable worker for an active run, reconstructed from run events and checkpoints.
- `CapabilityGrant`: the authenticated authority delegated to the run.
- `BudgetLedger`: reservations and settled usage for inference and tool activity.
- `Reasoner` and tool ports: schema-checked effects with idempotency keys and usage receipts.

The run lifecycle belongs in the model:

```ts
export const RunState = S.TaggedUnion({
  Running: { step: StepId, remaining: Budget },
  WaitingForApproval: { approval: ApprovalId },
  WaitingForChild: { child: RunId },
  Completed: { result: ResultRef },
  Rejected: { reason: RejectionReason },
  Cancelled: { reason: S.String },
  BudgetExhausted: { at: StepId },
})

// Commands include RequestRun, RecordAssessment, RequestApproval,
// DelegateRun, ApproveRun, RejectRun, CancelRun, ReserveBudget, SettleUsage.
// The saga executes activities and reports their outcomes through these commands.
```

A run gets its own id, parent run, delegation chain, prompt version, tool-contract version, model settings, grants, and budget. The saga does not define who the agent is. It advances the run by sending commands and recording outcomes.

### Identity and provenance

`Human | Agent | System` conflates the authenticated subject with the thing executing the work. A service can run without an agent. An agent can act for a human, another agent, or a service. A human can approve work started by a system process.

Model those separately:

```ts
export const Invocation = S.Struct({
  principal: PrincipalId,
  org: OrgId,
  execution: S.NullOr(S.Struct({
    kind: S.Literals(["agent", "automation"]),
    run: RunId,
    parent: S.NullOr(RunId),
  })),
  grants: S.NonEmptyArray(GrantId),
})

export const EventEnvelope = S.Struct({
  eventId: EventId,
  occurredAt: S.DateTimeUtc,
  invocation: Invocation,
  correlationId: CorrelationId,
  causationId: CausationId,
})
```

Only trusted Session middleware and trusted internal command bridges can establish `CurrentInvocation`. Ordinary saga code cannot authenticate itself by providing a Context value. Event provenance comes from the envelope, stamped by the command boundary. A payload keeps an actor field only when that actor is part of the business fact, such as the reviewer legally accepting a claim.

The prototype's human decision demonstrates why this matters. It puts an arbitrary `Actor` in a deferred and later provides that value as `CurrentActor`. The better model is a `DecideReview` command authenticated as the reviewer. It emits `ReviewApproved` or `ReviewRejected`; the saga wakes on that domain fact. `DurableDeferred` can carry the approval id as a wake-up mechanism. It is not the approval record or the authority source.

### Delegation and hand-off

Delegation is a command on the parent run. It creates a child run with a new grant derived from the parent's grant. The derived grant can only narrow operations, resources, expiry, and budget. It cannot add authority.

A hand-off suspends or revokes the parent's active grant, transfers the remaining budget, and records the child run as the continuation. Other agents communicate through commands and run events addressed to those runs. They do not share a mutable session entity or a global memory object.

### Budgets

Budgets need domain semantics, not adapter bookkeeping. Reserve budget before an inference or tool activity, settle actual usage afterward, and release the reservation on failure. Parent runs allocate portions to children. Parallel activities draw from the same ledger, so two children cannot spend the same allowance.

The `Reasoner` port should accept run id, step id, idempotency key, prompt version, resource scope, and a maximum allowance. Its receipt should include usage and references to prompt/response content. The aggregate decides whether the run can proceed; the adapter only executes and reports.

### Memory

Use four distinct kinds of memory:

- The run event log is the audit record.
- A checkpoint is derived execution state and can be rebuilt.
- Prompts, transcripts, and large tool payloads live in content storage behind a port, with references, hashes, retention, and tenant access rules in the run record.
- Long-lived knowledge enters the owning domain through commands. Reads use a versioned knowledge port with provenance and access constraints.

No global agent memory service. No hidden mutable context inside `AgentExecutor`. A worker restart reads the run, checkpoint, and content references and reaches the same next step.

## Frontend

React over a pure update function is a good pattern for a stateful screen. It is a poor mandatory template for every screen.

Generate the ordinary path from `contract`:

- typed view subscriptions with revision/receipt handling;
- command atoms that create idempotency keys and return typed rejections;
- `atLeast` read-after-write handling;
- cancellation, reconnect, and stale-request handling;
- cache clearing on logout and tenant change.

A basic screen then has one `*.screen.tsx` and a story or interaction test. It does not need a handwritten machine, message union, intent union, and atoms interpreter.

Use the fuller shape when the screen has real interaction law: multi-step editing, offline intents, optimistic reconciliation, gestures, or approval queues:

```txt
ClaimReview.screen.tsx       # React composition
ClaimReview.machine.ts       # pure state + messages + intents
ClaimReview.controller.ts    # executes intents through generated API atoms
ClaimReview.story.test.ts    # state and intent specification
```

`controller` names the responsibility. `atoms` names one implementation library and should not be the architectural role.

The machine should track revisions and correlate confirmation with the exact command:

```ts
const Pending = S.Struct({
  commandId: CommandId,
  baseRevision: ViewRevision,
})

// ReviewChanged carries the view revision and command receipt.
// Only the receipt for Pending.commandId completes that pending intent.
// A newer pushed view updates data without pretending an older command finished.
```

Do not force server views and browser machines into identical machinery just because both fold messages. The server guards facts. The browser coordinates interaction, transport, and display. The shared story notation is useful; the similarity should stop there.

Browser QA remains responsible for real input and rendering. Screen stories remain responsible for state and emitted intents. The generated contract tests remain responsible for client/server compatibility.

## Five things not considered

1. **Prompt injection and untrusted tool content.** The proposal treats schema-valid inference output as the main boundary. Mail, documents, retrieved memories, and tool results can instruct an agent to exfiltrate data or misuse a valid grant. The model needs trust labels, source-scoped grants, secret-free tool views, and rules for which content can influence which action. "Agents propose, aggregates decide" does not stop a malicious proposal that is valid under a broad grant.

2. **In-flight saga and signal evolution.** Stored-event widening does not define how a running saga survives new code, renamed activities, changed deferred schemas, split steps, or revised compensation. Runs need workflow-definition versions, version-pinned execution or explicit migration, signal codecs, and drain rules.

3. **Replay, rebuild, and recovery semantics.** Rebuilding a projection must not restart policies, call inference, send email, or emit integration facts twice. The architecture needs replay modes, side-effect suppression, projection versions, atomic checkpoint/switchover, and restore behavior for event stores, content stores, outboxes, and inboxes.

4. **Live browser connection security.** `validate` on a pushed read does not define reauthentication, mid-subscription revocation, reconnect cursors, missed-event detection, backpressure, or cache disposal on logout and tenant switch. These belong in the generated client contract and its tests.

5. **Agent evaluation and reproducibility.** A single `Reasoner` stub proves orchestration, not agent quality. Runs need prompt, model, tool-contract, retrieval-snapshot, and settings versions; usage measurements; recorded fixtures; replayable evaluations; and explicit release gates for changes to those inputs.

## Questions for the owner

1. **Is a bounded context allowed to contain more than one `Domain.Model`?** If yes, what exact event-lifecycle, storage, or reaction-graph rule authorizes a split? If no, what requires every process and read model in a context to share one storage namespace forever?
2. **Will authority be based on authenticated capabilities and delegation rather than `audience` and `Actor._tag`?** Who issues grants, how are they scoped, and which trusted boundary establishes `CurrentInvocation`?
3. **Is `AgentRun` accepted as the durable system of record, with sagas as executors and cluster entities as restartable workers?** If not, which single value owns run lifecycle, parentage, approvals, and budget?
4. **Does event provenance move to a trusted envelope?** Which events still need an actor in their payload because the actor changes business meaning?
5. **Will the browser consume a generated `contract` package instead of the Model?** Which public commands, reads, rejections, and integration facts does the generator include, and what check proves the browser artifact excludes write-model code?
6. **Are integration facts separate from stored domain events?** Who owns translation, outbox/inbox checkpoints, contract versions, and consumer compatibility?
7. **Does the app compose server-published deployment descriptors?** Are generated cluster `main` modules accepted as the way to remove per-class app wiring?
8. **What is the canonical file grammar?** In particular, do `.handler.ts`, `.adapter.ts`, and `.layer.ts` replace `.live.ts`, and do exact package exports replace wildcard source exports?
9. **When does a screen earn a handwritten machine?** Which transport semantics must the generated React binding own so simple screens stay small?
10. **Which proofs gate the next architecture amendment?** I would require two Models in one context, two contexts exchanging an integration fact, delegated parent/child runs with budget exhaustion, an approval authenticated through the real command boundary, a projection rebuild without side effects, an in-flight saga upgrade, and one simple React screen beside one machine-backed screen.
