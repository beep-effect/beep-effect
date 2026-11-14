# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

Standing brief for every entry (operator, 2026-11-13, `CAPTURE.md`): design the best architecture
for a codebase where agents write, call and operate the system. What the repo has today and its
past decisions are evidence about the problem and never a reason. React stays. Effect Cluster is a
first-class primitive.

## 2026-11-13 — D1 decision home

**Question:** Where are the decisions from grilling the Model-First Slices proposal recorded?

**Answer:** In this packet. `standards/ARCHITECTURE.md` and `standards/architecture/DECISIONS.md`
stay unchanged until the packet graduates into goals.

**Rationale:** The proposal is an exploration with one in-memory prototype, and two outside reviews
found claims that do not hold. Rejected: extending `explorations/alchemy-domain-adoption` as D18
onward (that packet is graduated and archived, and this work may supersede its D1 and D9); logging
straight to the architecture decision log (no exploration stage). Recommended answer accepted.

## 2026-11-13 — D2 unit of architecture

**Question:** Is a slice "one bounded context = exactly one `Domain.Model`"?

**Answer:** No. The bounded context is the unit: it owns a language, its data and its invariants.
One `Domain.Model` per context is the default. A second Model in a context is allowed only for an
independent event lifecycle or storage placement. "Fits in an agent's context window" is dropped as
a boundary test.

**Rationale:** A `Domain.Model` is a write-and-reaction graph with one storage namespace; on Effect
Cluster it is one entity type with many independently addressed instances. Neither fact establishes
a language or an ownership boundary (`research/02-astra-review.md` "Wrong on the merits" 3;
`research/03-kimi-review.md` "The unit of architecture"). A context-window test would let a tool
limit change business semantics. Rejected: keeping the identity rule (a context needing two Models
becomes two contexts); making the Model the unit with "context" as prose. Recommended answer
accepted. This reverses the proposal's first claim.

## 2026-11-13 — D3 client closure

**Question:** The Api file imports the Model, which imports every aggregate's `decide` and `evolve`,
so a client importing the Api receives the write model. What do clients import?

**Answer:** A generated `contract` package (operations, DTOs, public rejections, integration facts)
is the default import for browsers and for other slices. A screen that wants `Aggregate.predict`
imports the model deliberately. A slice is four packages: `contract`, `model`, `host`, `web`.

**Rationale:** A package exists for one dependency closure, and the public contract's closure is
smaller than the write model's. The library's optimistic-update feature runs `decide` in the
browser, so that path stays available as an explicit choice per screen. Rejected: contract only
(gives up client-side `predict`); model everywhere (three packages, the write model is the client
SDK). Recommended answer accepted. Open under this decision: how the contract is produced
(generated from the Api, or authored first and imported by the model); a sub-agent is checking what
the library's clients need at runtime.

## 2026-11-13 — D4 authority

**Question:** `by: Actor` is a label and not authority: a policy has to stamp System, in-process
code can provide any `CurrentActor`, and the human-approval signal accepts any Actor. How is
authority modelled?

**Answer:** A trusted boundary builds an `Invocation`: the principal, on whose behalf, the agent run
if any, and capability grants. Policies and sagas relay it together with the causal chain and never
stamp System. Capability grants replace the `audience` annotation. Approval is an authenticated
command, not a workflow signal carrying an Actor. The Invocation is stored in the event payload
through one kernel helper now, and moves to the event envelope once the library persists request
context, which is an upstream contribution.

**Rationale:** Three independent sources reached the same finding (`research/02-astra-review.md`
"Wrong on the merits" 6; `research/03-kimi-review.md` "Identity and provenance";
`research/04-adhd-pass.md` focus 1), and the prototype had already shown the policy case. The
library has `SendMeta.context` but does not persist it on events, so envelope-only provenance
cannot be built today. Rejected: envelope only, waiting for upstream first; keeping `by: Actor` and
adding only the causal chain. Recommended answer accepted.

## 2026-11-13 — D5 first host

**Question:** Cluster hosting is unproven at runtime. Which host is proved first, and what gates
retiring the repo-owned Postgres platform?

**Answer:** Alchemy's cluster pool with a Postgres database on a local Docker swarm. A conformance
suite (duplicate sends, kill after commit, lost response, projection crash, restore, authority
revocation) runs against it. `@beep/alchemy-postgres` is not retired until that suite passes on the
chosen host.

**Rationale:** The prototype type-checks the cluster wiring and nothing has run on a pool. "The
repo owns no platform" holds only as "the repo implements no `Domain.Platform` driver"; deployment,
data evolution and recovery still have an owner (`research/02-astra-review.md` claims table and
"Ideas" 5). The swarm route runs on this workstation at no charge. Rejected: Alchemy's Durable
Object pool first (needs a Cloudflare deployment); `@effect/platform-cloudflare` first (it does not
satisfy the Domain host contract as it stands, so a bridge would come first). Recommended answer
accepted. `docker swarm init` on the workstation is implied by this answer and has not been run.

## 2026-11-13 — D6 agent run

**Question:** The proposal runs an agent as a `Domain.Saga` waiting on a human signal. What is the
system of record for an agent run?

**Answer:** `AgentRun` is an aggregate. It holds the run's lifecycle, parent run, grants, budget and
its prompt, model and tool-contract versions. A saga executes the run and reports outcomes as
commands. A cluster entity is a restartable worker rebuilt from the run. Delegation is a command on
the parent that creates a child run whose grant can only narrow. Budget is reserved before an
inference or tool call and settled after.

**Rationale:** A saga key is its execution id, so the proposal could not express a second review of
the same claim, and run state had no single owner across saga, entity and aggregate
(`research/02-astra-review.md` "Wrong on the merits" 7; `research/03-kimi-review.md` "Agents in the
model"). Rejected: the saga is the run, with a run id added; a long-lived cluster entity is the run.
Recommended answer accepted.

## 2026-11-13 — D7 authority home

**Question:** Where do Invocation, capability grants, delegation and supervision live?

**Answer:** The shared kernel holds only the `Invocation` schema and its ids, as language. A
dedicated bounded context owns the Grant, Delegation and Supervision aggregates and the trusted
boundary that builds an Invocation. Other contexts check grants and do not define them.

**Rationale:** Grants have a lifecycle (issue, narrow, expire, revoke) and invariants, which makes
them aggregates with one owner, and the kernel is language only. Rejected: everything in the kernel
with shared helpers and per-slice enforcement; per-slice capabilities with only principal ids
shared. Recommended answer accepted. Open under this decision: the context's name, and whether the
supervision relation is general or belongs to the law-practice language.

## 2026-11-13 — D8 laws and review

**Question:** The proposal says laws are computed from the Model with no human review gate. What
replaces that claim?

**Answer:** A proof inventory. Each invariant is listed with its checker, inputs, assumptions and
evidence. Mechanical laws stay automatic. Semantic questions (context naming, capability scope,
public facts, what an event may retain) get a review step run by an agent that did not write the
change; a person decides only where that reviewer and the author disagree. Story coverage counts
executed outcomes, not tags found in a file.

**Rationale:** Model reflection gives structural checks only; paths, imports, baselines and stories
are separate inputs, and the suffix law as written rejects the proposal's own command file
(`research/02-astra-review.md` "Wrong on the merits" 9 and 10). An author's stories can restate the
author's `decide` (`research/04-adhd-pass.md`). Rejected: laws only, tightened; a human review gate
as the current standard has. Recommended answer accepted.

## 2026-11-13 — D9 contract production

**Question:** The library cannot build an Api client without the Model: `decide` and `evolve` are
inline fields of the aggregate declaration, the Model reads every aggregate at module load, and
tree-shaking cannot remove them. How is the contract package (D3) produced?

**Answer:** Target: an upstream contribution to the library for a model-free Api contract and an
aggregate declaration separate from `decide` and `evolve`, as `toLayer` already provides for views,
policies and sagas. Until it lands: a hand-authored contract `RpcGroup` built from the modules that
are already aggregate-free (commands, events, rejections, ids, queries), with a server test that it
matches the real Api group.

**Rationale:** Sub-agent fact-find, 2026-11-13, library `packages/domain/src`: `Api.ts` reads the
Model's commands, views, streams and queries at declaration and builds the `RpcGroup` then; remote
clients need only that group; `Aggregate.ts` keeps `decide` and `evolve` as static definition data;
no schema-only form of an Api exists; the upstream example's web app imports the Api and with it
every aggregate. Rejected: hand-authored for good (relies on internals, loses the typed nested
client); generating schema-only files (rejections would lose the class identity they decode to).
Recommended answer accepted.

## 2026-11-13 — D10 file grammar

**Question:** Does `.live.ts` stay, and what are folders and exports called?

**Answer:** Declarations are `<Module>/<Noun>.<kind>.ts`. `.handler.ts` implements a view, policy,
saga, projection, query or cluster class. `.adapter.ts` implements a port over a driver. `.live.ts`
is retired. Folders are Modules, not Subdomains. Package exports are exact entry points, not a
wildcard over `src`. The handler registry is generated from the Model and checked by diff.

**Rationale:** `.live.ts` names no responsibility and mislabels handlers that run unchanged in
memory; a wildcard export makes the boundary depend on every caller obeying a convention; a
hand-kept registry can omit a handler while every suffix check passes
(`research/03-kimi-review.md` "File and path grammar"). Rejected: keeping `.live.ts`; longer
`X.<kind>.handler.ts` names. Recommended answer accepted.

## 2026-11-13 — D11 between contexts

**Question:** How do contexts exchange facts asynchronously?

**Answer:** Integration facts. The producer publishes versioned integration facts in its contract
package and translates its private events to them in a host outbox. The consumer has an inbox keyed
by producer, event id and contract version, translates into its own language and sends its own
commands. Synchronous calls stay a consumer-declared port over the provider's contract.

**Rationale:** A stored domain event rebuilds the producer's state and a view event is internal;
letting another context follow either makes internal refactoring a public breaking change
(`research/03-kimi-review.md` "Between slices"; `research/02-astra-review.md` "Missing", durable
integration subscriptions). Rejected: consumers following the producer's `Domain.Stream`;
synchronous calls only, with polling. Recommended answer accepted.

## 2026-11-13 — D12 frontend default

**Question:** Does every screen get a machine, an atoms file and a view?

**Answer:** No. An ordinary screen is one `*.screen.tsx` over bindings generated from the contract:
view subscriptions, command atoms with ids and typed rejections, read-after-write, reconnect. A
screen with real interaction law adds `.machine.ts`, `.controller.ts` and a story. Every machine
correlates on command id, receipt and view revision.

**Rationale:** The sketched machine cleared `sending` on any view change with no command id, so a
delayed snapshot let a second command go out (`research/02-astra-review.md` "Wrong on the merits"
8). Three hand-written files for a screen that binds one query and one command is ceremony
(`research/03-kimi-review.md` "Frontend"). Rejected: a machine for every screen; no machines, with
browser QA only. Recommended answer accepted. React stays (operator, `CAPTURE.md`).

## 2026-11-13 — D13 deployment wiring

**Question:** Who owns deployment wiring for cluster classes?

**Answer:** Each slice's host publishes a deployment descriptor naming its models and processes.
The app composes descriptors onto pools and names no individual model or process. Cluster entry
modules are generated and never edited. The mechanism is proved on the Docker swarm host from D5.

**Rationale:** One hand-written entry module per cluster class in the app is registration code that
drifts from the slice (`research/03-kimi-review.md` "Cluster composition"). Rejected: app-owned
hand-written entries (the proposal); slice-owned per-target entries (the upstream example).
Recommended answer accepted. Not yet checked: that the cluster loader accepts generated `main`
modules.

## 2026-11-13 — D14 scope additions

**Question:** Which concerns the proposal does not cover join this design's scope?

**Answer:** All four offered:

- Durable compatibility and replay: a compatibility contract for stored state, events, receipts,
  request context and saga payloads; idempotency keys bound to tenant, operation and request
  fingerprint; projection sinks that take source sequence and generation; replay modes that
  suppress side effects.
- An operations context: every repair is a command an agent proposes and the aggregate decides;
  quarantine for a poisoned instance; a degraded mode per port; an operations Api.
- Production-cut stories: a journal on aggregate sends, stories cut from real histories with
  pseudonymised fixtures, a replay-diff check before `decide` or `evolve` changes land, coverage
  that counts executed outcomes.
- Retention and trust: a retention class on every stored field with erasure by tombstone; agent
  reads of privileged material recorded; trust labels on untrusted content limiting which actions
  it can influence.

**Rationale:** Each closes a hole a review verified or the prototype shows: a retried command id
skips `decide`; a projection batch replays after a crash and the prototype's sink is not safe for
it; the prototype stores names and evidence excerpts in events against the proposal's own rule; the
proposal says nothing about incidents (`research/02-astra-review.md` "Wrong on the merits" 1, 2, 5
and "Missing"; `research/04-adhd-pass.md` focus 2 and 3). None was deferred.

## 2026-11-13 — D15 next step

**Question:** The prototype has the old shape and has never run on a cluster. What is built next?

**Answer:** Rework the standalone prototype to the decided shape and prove it in memory with
stories first: two contexts, an integration fact, a delegated agent run, authenticated approval.
Then run that same code on the Postgres Docker swarm host with the conformance suite (D5). Upstream
proposals are drafted once the prototype shows the exact library changes wanted (D4, D9).

**Rationale:** In-memory proof is the cheapest check of D2 to D14 against the library, and a
cluster run of a shape already overturned would prove the wrong thing. Rejected: swarm first with
the current prototype; upstream proposals first. Recommended answer accepted.

## 2026-11-13 — D16 graduation gate

**Question:** Which proofs must exist before this packet graduates and `standards/ARCHITECTURE.md`
is amended?

**Answer:** All of these:

- two contexts exchanging an integration fact through an outbox and inbox;
- a parent and child agent run, with budget exhaustion;
- approval through the authenticated command boundary;
- a projection rebuild with no side effects;
- a stored-format compatibility test (state, events, receipts, saga payloads);
- the conformance suite passing on the Postgres swarm host, restore included;
- one plain screen on generated bindings and one machine-backed screen;
- the proof inventory written for each invariant (D8).

**Rationale:** The present evidence is six in-memory tests, and two reviews found claims that fail
(`research/02-astra-review.md` question 10; `research/03-kimi-review.md` question 10). Rejected:
graduating on in-memory proofs with cluster conformance as the first goal; graduating on design
agreement alone. Recommended answer accepted.

## 2026-11-13 — D17 in-flight work

**Question:** What happens to slice work on the current seven-package standard while this packet is
open?

**Answer:** Work already under way on the current shape finishes as planned. No new slice migration
to `@alchemy.run/domain` starts on the seven-package shape until this packet graduates or is killed.

**Rationale:** Finishing in-flight work keeps its evidence coming; a new migration on a shape under
review would be redone. Rejected: the current standard governing new migrations too until an
amendment lands; pausing in-flight slice work now. Recommended answer accepted. This is a hold on
starting work, recorded here and not yet in `standards/`.

## 2026-11-13 — D18 supervision

**Question:** Is the supervision relation general, or law-practice language (open under D7)?

**Answer:** General. The authority context owns an Accountability relation: every agent-rooted
action names an accountable human. Law-practice adds its own rules on top (attorney supervision of
nonlawyer work) in its own context, checked against that relation.

**Rationale:** Any product where agents act for people needs an accountable person; the professional
rule is one context's stricter reading of it. Rejected: supervision as law-practice language only;
deferring until the authority context is modelled. Recommended answer accepted. Still open: the
authority context's name, left to the prototype rework.

## 2026-11-13 — D19 agent evaluation

**Question:** Are recorded fixtures, replayable evaluations and release gates for prompt, model and
tool changes part of this design?

**Answer:** In scope as a port contract. Every Reasoner adapter records replayable fixtures, and a
change to a prompt, model or tool contract passes a recorded evaluation before release. Building
the evaluation harness is a later goal.

**Rationale:** A stubbed Reasoner proves orchestration and says nothing about agent quality
(`research/03-kimi-review.md` "Five things not considered" 5); D6 already records the versions on
each run. Rejected: designing and proving the harness in this packet; deferring the whole subject
to another packet. Recommended answer accepted.

## 2026-11-13 — D20 artifact

**Question:** When is the published design artifact rebuilt?

**Answer:** Now, from the decisions, as the fourth draft, marked decided-but-unproven wherever the
reworked prototype has not confirmed a shape. It doubles as the packet's shaped brief.

**Rationale:** The published third draft states positions D2, D3, D4, D6, D8, D10, D11, D12 and D13
overturned. Rejected: waiting for the prototype rework; a short decisions page now and a full
rebuild later. Recommended answer accepted.

## 2026-11-13 — D21 agent surfaces

**Question:** The proposal derives MCP tools, a toolkit and a CLI from the Api. Which surfaces do
agents get?

**Answer:** Two, by role. An operating agent calls derived tools (MCP, toolkit); each call runs
under a capability grant and a person can deny it. An agent that writes or composes code gets the
generated contract client inside a sandbox that holds bindings and nothing else: no general network
and no keys. Both are the D3 contract package pointed at different runtimes.

**Rationale:** One tool per command suits an agent that stays subject to human denial and is the
wrong surface for an agent writing code against the system
(`research/05-grok-deep-research.md` "What the proposal should change" 5 and 6, citing the MCP
specification and Cloudflare Code Mode). Rejected: derived tools only; sandboxed code only.
Recommended answer accepted.

## 2026-11-13 — D22 schema evolution

**Question:** The third draft's law was that stored schemas only widen. What is the evolution law?

**Answer:** Convert on read. Stored bytes are never rewritten. Payload conversion handles added
defaults, removals, renames and compatible type changes. An incompatible change is one declared
read-time transform per version step. A new event tag is for a new fact only. Frozen old-format
fixtures and replay equivalence prove each change, as part of the D14 compatibility contract.

**Rationale:** Akka, Pekko and Axon 5.4 leave the log untouched and convert on the read path;
widen-only sends every rename to a new event tag, which forks the language `evolve` has to
understand (`research/05-grok-deep-research.md` "What the proposal should change" 9). The library
looks up the event codec by stored tag before decoding, and state, receipts and saga payloads are
decoded too (`research/02-astra-review.md` "Wrong on the merits" 2), so the contract covers all of
them. Rejected: widen only; migrations that rewrite stored events. Recommended answer accepted.

## 2026-11-13 — D23 run length

**Question:** How long does one `AgentRun` (D6) live?

**Answer:** One bounded piece of work, including its wait for approval, with a bound on its
history. A long conversation or standing assignment is a session entity holding a chain of runs. A
run that reaches its bound continues as a new run that carries state forward.

**Rationale:** A long-lived entity and a process that finishes one piece of work are different
things, and workflow histories have caps (`research/05-grok-deep-research.md` "What the proposal
should change" 4 and "Ideas", continue-as-new). Rejected: one run spanning a whole conversation;
deferring to the prototype rework. Recommended answer accepted.

## 2026-11-13 — Facts to establish in the prototype rework (not decisions)

Raised by the Grok report and not yet checked in the source:

- Whether the Effect Cluster host's commit fails when the stored version has moved, or relies on
  one-at-a-time execution alone. A quick search of `EffectCluster/index.ts` found an upsert and no
  version comparison. This becomes a conformance case: two runners deciding on one instance.
- Whether `Cluster.EntityState` landed in `@alchemy.run/effect-cluster` after 2026-11-06.
- Whether `waitsFor` and `atLeast` wait on the platform's delivery or only name a cursor.

## 2026-11-13 — Phase 1 of the rework, and an amendment to D9's interim form

Phase 1 (file grammar, contract package, authority context, invocation relay) is built in
`scratchpad/model-first-slices/`: ten packages type-check and 38 tests pass, re-run by the
orchestrating session. Its findings are in `research/08-rework-phase1-findings.md`.

D9's interim form changed in the build, without a new ruling: the contract is `Domain.Api` declared
over a model-shaped catalog of aggregate-free declarations, not a hand-authored `RpcGroup`. It keeps
the typed nested client D9 expected to lose. Views and queries need separate contract declarations.
Parity tests compare all four Apis' groups. The upstream target in D9 is unchanged.

## 2026-11-13 — D24 authority between hops

**Question:** Phase 1 stored the whole Invocation in every event, grant terms included, so a view's
readers see them, and grants relayed through a policy are a snapshot that misses a revocation. How
does authority travel between hops?

**Answer:** Re-admit at each hop. Events store provenance only: the root, on whose behalf, the
causal chain and grant ids. A policy or saga asks the authority context, through a port it declares,
to re-admit the chain, and authority rebuilds the Invocation from live grants. Only authority ever
builds an Invocation.

**Rationale:** Revocation is then seen at the next hop, grant terms never sit in events, and the
kernel no longer exports a constructor that produces an Invocation (`research/08` "Known defects"
and "How hard it is to construct a root invocation"). Rejected: keeping the snapshot and stripping
terms from public read shapes; leaving it as built. Recommended answer accepted. This narrows D4:
the payload carries provenance, not the Invocation.

## 2026-11-13 — D25 root forgery

**Question:** The library decodes whatever request context in-process code provides, with no
verification, so a root Invocation can be forged in process. What is the control?

**Answer:** Target an upstream change: a request context that only middleware may provide, or one
verified on restore. Until it lands, the source scan stays as a proof-inventory checker with its
known gaps listed (object spreads, schema decodes, aliased tags).

**Rationale:** `research/08`, citing `RequestContext.ts:93` and `:107`. Rejected: signed invocations
verified at every model's ingress (works today, puts a key in every host); the scan alone with
nothing pursued upstream. Recommended answer accepted.

## 2026-11-13 — D26 run grants

**Question:** How does an agent run get its authority?

**Answer:** Delegated at request. Whoever requests a run delegates a narrowed grant to it then:
named operations, a resource scope, an expiry and a budget. The run's Invocation carries only that
delegation, and a child run narrows it again.

**Rationale:** In phase 1 the review agent acted with all of the asserting human's grants
(`research/08` "Known defects"). Rejected: agents as principals with standing grants of their own;
borrowing the requester's grants. Recommended answer accepted.

## 2026-11-13 — D27 grant-check language and the context's name

**Question:** D7 said the kernel holds only the Invocation schema and ids, and phase 1 put the
grant-check language there too. Where does it live, and what is the context called?

**Answer:** Amend D7: the kernel holds the Invocation schema, ids and the pure grant-check language
(grant terms, what "covers" means, the `MissingGrant` rejection), with no Layer, aggregate or
credential handling. The context is named `authority`. This closes the name left open in D18.

**Rationale:** Every context's `decide` checks grants, and one definition of "covers" keeps them in
agreement. Rejected: the check language in the authority contract, imported by every other
context's model; the name `access`. Recommended answer accepted.

## 2026-11-13 — D28 AgentRun home

**Question:** Which context owns the `AgentRun` aggregate (D6)?

**Answer:** A dedicated `runs` context owns AgentRun, the budget ledger and run lineage. A product
context keeps its own executor saga and reports steps and usage to the run through a port it
declares. Approval stays a command in the product context. Authority keeps grants, delegation and
accountability.

**Rationale:** Run, step, budget and lineage are a language of their own (D2), and a parent run in
one context can delegate a child that works in another. Rejected: AgentRun inside authority; an
AgentRun module inside each product context with per-context budgets. Recommended answer accepted.

## 2026-11-13 — Phase 2 of the rework

Phase 2 (re-admission at each hop, the `runs` context with `AgentRun`, approval as one authenticated
human command, the Reasoner evaluation contract, a derived toolkit) is built: 13 packages
type-check and 68 tests in 21 files pass, re-run by the orchestrating session. Its notes are in
`research/09-rework-phase2-notes.md`. The lane moved to its own worktree
(`beep-effect-worktrees/model-first-slices`, branch `explore/model-first-slices`) during this phase.

Defects phase 2 left, to be fixed first in phase 3: the executor does not follow a run across a
continuation; a parent run never resumes when its child finishes; a claim decided directly leaves
its run waiting; `CompleteRun` releases no open reservations.

## 2026-11-13 — D29 where a run's budget lives

**Question:** D26 worded the budget as part of the delegation. Phase 2 kept it only in the runs
context's ledger. Where does it live?

**Answer:** In the runs ledger only. This amends D26's wording: a delegation carries operations, a
resource scope and an expiry. The budget is allocated in the ledger when the run is requested, and
the ledger is the single place reservations are checked.

**Rationale:** The ledger settles usage, and grant terms never change on use (`research/09`, D26
entry). Rejected: stating the budget on the delegation as well, which gives two records to keep in
agreement. Recommended answer accepted.

## 2026-11-13 — D30 partial lapse at re-admission

**Question:** When only some of a chain's grants have lapsed or been revoked, what does
re-admission do?

**Answer:** It passes the grants still in force. Re-admission never adds a grant and drops any that
lapsed. The next command is refused only if it needs a dropped grant, and that refusal is recorded.

**Rationale:** Re-admission only ever narrows, so passing the rest cannot grant anything, and
`decide` already names the capability a command needs (`research/09`, D4 entry). Rejected: refusing
the whole hop on any lapsed grant. Recommended answer accepted.

## 2026-11-13 — D31 remote gateways (DEFERRED)

**Question:** What do cross-context gateways look like across a network, and how does a calling
host authenticate?

**Answer:** DEFERRED to the swarm phase (D5). Gateways stay in process for phases 3 and 4.

**Rationale:** The remote form can be tested only against a real pool. Rejected: designing it
before phase 3. Recommended answer accepted.

## 2026-11-13 — Phase 3 of the rework

Phase 3 is built: 13 packages type-check and 98 tests in 28 files pass, re-run by the orchestrating
session. Its notes are in `research/10-rework-phase3-notes.md`. It fixed the four defects phase 2
left, and built: a `ClaimDecided` integration fact from Party to runs with an inbox; a directory
store that tracks its position per source stream, with a rebuild that serves the old generation
until it switches; frozen stored-format fixtures with the five kinds of change converted on read;
tests pinning command-id reuse.

Two library facts it pinned as tests: a reused command id is answered from the stored receipt
before the payload is decoded or the grant checked; and a top-level event field cannot be renamed
with the library's Event builder. Both are upstream asks.

## 2026-11-13 — D32 authority for a fact-started command

**Question:** Under what authority does a command run when an integration fact starts it?

**Answer:** Under the consuming record's own provenance plus a hop naming the fact (producer,
contract, version, fact id). Facts carry no provenance and nobody is re-admitted.

**Rationale:** The consumer acts on its own record because the producer committed a fact; no grant
in the consumer's world authorises "a claim was decided" (`research/10`, D11 entry). Rejected:
facts carrying a publishable provenance summary that the consumer re-admits. Recommended answer
accepted.

## 2026-11-13 — D33 outbox placement

**Question:** D11 put the outbox in the producer's host. Phase 3 built it in the model. Where does
it live?

**Answer:** In the model. This amends D11's wording: translating private events into public facts
is a model-level projection into a `Domain.Stream`, covered by stories. The host serves that stream
as a feed. No second delivery mechanism is written.

**Rationale:** The library's stream already appends nothing twice for a replayed or redelivered
input (`research/10`, D11 entry). Rejected: a host-owned outbox table. Recommended answer accepted.

## 2026-11-13 — D34 retiring a fact version

**Question:** When may a producer stop publishing an old fact version?

**Answer:** When no deployment descriptor consumes it. Each slice's descriptor (D13) declares the
fact versions it consumes. A producer may drop a version once no descriptor in any app lists it. A
checker in the proof inventory enforces this.

**Rationale:** Retirement needs a registry of consumers and their versions, and the descriptors are
that registry. Rejected: a fixed deprecation window regardless of consumers; never retiring a
version. Recommended answer accepted.

## 2026-11-13 — D35 saga activity results

**Question:** A saga's activity results are a stored format D22 did not list. What is the rule?

**Answer:** They join the D22 compatibility contract. A compatible change converts on read, as for
events. An incompatible change gets a new saga version, and runs in flight finish on the version
they started.

**Rationale:** Phase 3 changed the review saga's results, and a run in flight across that change
would fail to decode them (`research/10`, findings). Rejected: no rule, with deploys waiting until
no run of the saga is in flight. Recommended answer accepted.

## 2026-11-13 — D36 tenant in a request key

**Question:** Command ids are derived from tenant, operation and a request fingerprint. What is the
tenant?

**Answer:** The org, the same resource scope grants are checked against.

**Rationale:** Phase 3 used stand-ins (the principal acted for, the producing context). Rejected:
the principal acted for; deferring. Recommended answer accepted.

## 2026-11-13 — Phase 4 of the rework, and the graduation gate in memory

Phase 4 is built: 14 packages type-check and 130 tests in 37 files pass, with the handler-registry
and generated-file checks, re-run by the orchestrating session. Its notes are in
`research/11-rework-phase4-notes.md`. It built: deployment descriptors as data with the D34
fact-retirement checker; the `party/web` package (bindings generated from the contract, a plain
screen, a machine-backed screen with seven stories, a render test per screen); a generated proof
inventory of 22 invariants (`PROOFS.md`) with a primary-export checker and outcome coverage measured
at run time (94 of 109 declared outcomes executed; the 15 left are authority refusal paths).

The D16 gate, as of this phase:

| Gate item | In memory |
| --- | --- |
| Two contexts exchanging an integration fact through an outbox and inbox | Proven |
| A parent and child agent run, with budget exhaustion | Proven |
| Approval through the authenticated command boundary | Proven |
| A projection rebuild with no side effects | Proven |
| A stored-format compatibility test | Proven, activity results included |
| The conformance suite on the Postgres swarm host, restore included | Not done |
| One plain screen and one machine-backed screen | Proven without a browser |
| The proof inventory for each invariant | Proven |

The packet does not graduate until the conformance suite passes on the Postgres swarm host (D5,
D16). "Proven" here means in memory, on `Domain.InMemory`; nothing has run on a cluster.

Open from phase 4, for the next round: whether a producer's newest fact version may be reported
retirable; where generated entry modules live; where a browser session's credentials and tenant
come from. The 15 uncovered authority outcomes are to be covered in the next phase.

## 2026-11-13 — D37 the cluster run

**Question:** Upstream hosts a model on Effect Cluster only inside a Docker swarm; there is no
lighter route (`research/12-cluster-run-scoping.md`). May the run happen on the workstation?

**Answer:** Yes. `docker swarm init --advertise-addr 127.0.0.1`, deploy the prototype's stack
(Postgres service and volume, two runners, a front service on one localhost port), run upstream's
ten Domain conformance cases plus the prototype's own (duplicate sends, kill after commit, lost
response, projection crash, revocation, two runners on one instance, backup and restore by
`pg_dump`), then `alchemy destroy` and `docker swarm leave --force`. No cloud account.

**Rationale:** D5 and D16 require the proof on this host, and state is purely local. Rejected:
leaving the stack up afterwards; preparing the stack and cases without running them here.
Recommended answer accepted.

## 2026-11-13 — D38 if the two-runners case fails

**Question:** The cluster host's commit does not check the stored version; it relies on
one-at-a-time execution and a shard lock that expires after 35 seconds (`research/12`, section 5).
If the two-runners conformance case reproduces an overwrite, what then?

**Answer:** Hold the retirement of the repo-owned Postgres platform (D5). The failing case and a
proposed fix, a version check inside the commit transaction, go into the upstream proposals. The
gate item stays open until the host passes.

**Rationale:** D5 already makes conformance the retirement gate. Rejected: carrying a local patch
and treating a pass with the patch as meeting the gate; deciding only after the run. Recommended
answer accepted.

## 2026-11-13 — D39 remote gateways (closes D31)

**Question:** How does one context's host call another's on a cluster, and how is the caller
trusted?

**Answer:** A gateway is the provider's contract Api reached through the pool's own dispatch.
Contexts in one pool trust each other; a caller from another pool presents that pool's gateway
token. Hosts get no principal of their own. Every call still carries provenance that authority
re-admits.

**Rationale:** The pool already authenticates its members, and authority over a domain action
comes from the provenance, not from which host relays it. Rejected: a service identity with grants
for every host; one runner with in-process gateways and the remote form left undecided.
Recommended answer accepted.

## 2026-11-13 — D40 newest fact version; where entry modules live

**Question:** May a producer's newest fact version be reported retirable (D34), and where do
generated cluster entry modules live (D13)?

**Answer:** A producer's newest fact version is never reported retirable. Entry modules are
generated into the app, from the composed descriptors, since the app chooses the pool each one
runs on.

**Rationale:** A newest version with no consumer yet is a fact being introduced, not one to remove.
The cluster loader accepts a generated module passed as `import.meta.url` (`research/12`, section
6). Rejected: entry modules generated into each host package; reporting an unconsumed newest
version. Recommended answer accepted.

## 2026-11-13 — Browser session (DEFERRED, not put to the operator)

Where a browser session's credentials and tenant come from, and what clears atom caches on logout
or tenant change, is deferred to the browser QA and HTTP wiring work. It is outside the D16 gate.
The orchestrating session deferred it without asking; the operator may reopen it.

## 2026-11-13 — Phase 5: the cluster run, and the D5 verdict

The prototype ran on Effect Cluster with Postgres on a local Docker swarm (stage
`mfs-conformance`: Postgres, two runners hosting the three models, one front). Notes are in
`research/13-rework-phase5-notes.md`. In memory, 14 packages type-check and 133 tests pass, re-run
by the orchestrating session.

**D5 verdict: not yet.** The repo-owned Postgres platform is not retired (D5, D38).

- Upstream's ten Domain conformance cases pass on this host.
- Of the prototype's eight cases, five pass: a command sent twice under one id; a lost response
  retried; a grant revoked (it landed before the first hop, not mid-run); two runners on one
  instance (no overwrite, in one timing); backup and restore by `pg_dump` (everything restores).
- Three fail, on two upstream defects:
  - **A killed runner strands work.** A drain's 60-second lease outlives the killed runner, and the
    one-shot 10-second backstop finds the lease held and gives up, so outbox rows and projection
    input wait until that instance's next commit. Fails "runner killed right after a commit" and
    "projection crash". The orchestrating session read the cited code
    (`domain/src/DurableObjects.ts`, the `queue` function) and it matches.
  - **Code on a runner cannot read a stream.** In runner mode a stream read goes over HTTP with an
    empty URL (`InvalidUrl`), so an integration fact is published but cannot be consumed there.
    Fails "a waiting run survives a runner restart and completes after approval".

Also established: the cluster loader accepts generated entry modules (D13, D40); restore needs only
a quiesced `pg_dump`, not Alchemy's state; the commit path still has no version check, so that
proposal stands. Five upstream issues are written out in `research/13`, none filed.

Two things differed from what the operator was told before the run. The front's port was reachable
on all interfaces while the stack was up, because swarm cannot bind a published port to 127.0.0.1.
And the runs inbox was built as a poller on every runner, not as a cluster singleton.

Teardown was checked against a Docker baseline recorded before the run: the stack, the swarm and
local state are gone, and containers, images, volumes and networks match the baseline by name.

D16 gate: seven items proven in memory; conformance on the Postgres swarm host is run and not
passing, waiting on the two upstream defects.

## 2026-11-13 — Phase 6: two local patches, and the conformance suite again

The operator approved local patches for the two defects phase 5 found, and a second swarm session.
Notes are in `research/14-rework-phase6-notes.md`. The patch is applied only through the
prototype's own `patchedDependencies`; the monorepo root is unchanged. In memory, 14 packages
type-check and 136 tests pass with the patch applied, re-run by the orchestrating session. Teardown
matched a second Docker baseline.

- **Patch 1, drain takeover.** A drain that finds its lease held reschedules itself for just after
  the lease expires. The same defect was in the projection drain, so both places are patched. An
  in-memory test fails without the patch and passes with it.
- **Patch 2, calls from a runner's background fibers.** Phase 5's diagnosis was wrong: the fault
  was not stream reads. Any call from a background fiber on a runner, commands included, fell back
  to a gateway with an empty URL. The patch hands those calls the runner's cluster connection.
- Both are saved as diffs against upstream's source under the prototype's `notes/upstream/`.
  Nothing is filed or opened upstream.

Conformance, eighteen cases plus one new timing:

- Fifteen pass: upstream's ten, the duplicate and lost-response cases, the projection crash (now
  forced exactly between the sink write and the checkpoint), the waiting run across a runner
  restart, two runners paused during `decide`, and backup and restore.
- **Runner killed after a commit: fails as written.** Every reaction happens exactly once, but only
  after the dead drain's 60-second lease, and the case's read gives up first.
- **Revocation mid-chain: fails on a defect in the prototype's own model.** The review saga catches
  only one refusal; a refused settle fails the workflow, records nothing and leaves 40 budget units
  reserved. To be fixed in the prototype.
- **Two runners, stale runner paused inside its commit (new case): a lost write.** The stale
  runner's acknowledged event 2 was overwritten by the other runner's event 2. This is the missing
  version check recorded under D38, now reproduced. It is unpatched, as D38 rules.

D5 verdict: still not yet. No host port was published this time: the conformance driver ran as a
one-shot service on the stack's own network.

## 2026-11-13 — Phase 7: the Effect rules, and the operator's review of the prototype

The operator asked for `@effect/tsgo` to be wired into the prototype and fully passing, and had
separately reviewed the prototype in the IDE: lifecycle state as tagged unions, absence decoded
into `Option` by the schema, service keys from `@beep/identity` composers. Notes are in
`research/15-rework-phase7-notes.md`.

The prototype's `check` had been running the plain TypeScript compiler, which ignores the Effect
language-service block it inherits from the monorepo's `tsconfig.base.json`. So no Effect rule had
run on this code in phases 1 to 6, and every "type-checks" statement above meant TypeScript errors
only.

As built, re-run by the orchestrating session:

- Every `check` step runs the Effect build (`effect-tsgo tsrs`, 7.1.0-beta+effect-tsgo.0.68.1)
  over 17 projects, with the rule set inherited from the monorepo and nothing switched off.
  Diagnostics went from 981 to 0. Two guards test that the compiler is the Effect build and that an
  Effect-only finding fails the check.
- One inline directive exists, on the generated front entry's deploy-time `Effect.provide`, in the
  repo's entry-point form with a reason, an owner and an exit. A guard test fails on any other.
- One project is exempt from the Effect rules: `conformance/upstream`, three files vendored from
  alchemy at 33c10dd and unchanged apart from a provenance header and import paths. It is checked
  for TypeScript errors only.
- Rejections are declared as branded `S.TaggedError` classes with identity annotations, as the
  monorepo's vault-sync slice does, and constructed with `.make`. The library on beta.87 reads the
  tag from the encoded schema and none of `Domain.Rejection`'s statics; encoded shapes are
  unchanged.
- The run lifecycle, both view states and the web screen's approval state are tagged unions. About
  twenty fields decode to `Option` with the stored JSON still `null`. Three stored shapes changed
  and decode through declared conversions; no earlier fixture was regenerated.
- `@beep/identity` and `@beep/schema` are linked from the monorepo as source. The prototype is no
  longer fully standalone: it resolves those two packages and their dependencies from the monorepo.
- The review saga now records a refused report step and releases its reservation (the defect phase
  6's revocation case found). Two further defects were fixed: a child run refused mid-run never
  resumed its parent, and some Layers were torn down while routes still used them.
- 152 tests pass; 109 of 109 declared command outcomes are executed; the registry and generated-file
  checks pass.

Not re-run after this phase: the cluster conformance suite. The saga fix, the remodelled state and
the linked `@beep/*` packages have not been exercised in the runner and front bundles.

## 2026-11-13 — Phase 8: the cluster suite on the phase 7 code

The operator approved a third swarm session. Notes are in `research/16-rework-phase8-notes.md`.
Teardown matched a third Docker baseline apart from build cache. In memory, the Effect check has
zero diagnostics and 152 tests pass, re-run by the orchestrating session.

- The runner and front bundles built and started with the linked `@beep/*` sources and the patched
  library. One regression from phase 7 was fixed first: the conformance wiring had merged two
  hosted models into one context.
- Upstream's ten cases pass. Of the prototype's cases: duplicate send, lost response, projection
  crash, the waiting run across a restart, backup and restore (pending scheduled work was present
  and delivered this time) and a new case writing old stored forms directly all pass.
- **Revocation mid-chain now passes on the cluster.** The refused settle is recorded on the claim,
  the run gives back its 40 reserved units, and the executor stops cleanly. This is the phase 7
  saga fix.
- Three cases fail:
  - **Runner killed after a commit**, as in phase 6: recovery waits out the 60-second lease and the
    case's read gives up first.
  - **Runner paused inside its commit**: the lost write again (D38), unpatched as ruled.
  - **New: phase 6's dump restored under the phase 7 code.** Every old form decoded and every read
    passed, but approval published no integration fact, so the waiting run never concluded. Phase 7
    moved the claim review view to version 1, which rebuilt the facts projection with its input log
    restarting at position 1. The facts stream kept the earlier generation's write position and
    refused the rebuilt projection's first writes as older ones. An upgrade over live data with a
    view version bump can therefore drop published facts silently. This bears on D33 (the outbox as
    a model-level projection into a stream).
- The runner paused during `decide` passed, but no takeover happened in this run, so that timing is
  covered by phase 6's run only.

D5 verdict: still not yet, for three reasons: the 60-second recovery, the lost write, and facts
dropped on an upgrade with a view version bump.

## 2026-11-13 — D41 the lost write (reverses D38's "no local patch")

**Question:** A runner paused inside its commit was acknowledged at version 2, and the other
runner's event then overwrote it. D38 ruled out a local patch. The operator has since patched the
other two library defects. What now?

**Answer:** Patch it too. Add a version check inside the commit transaction to the prototype's
local patch, save it as a third upstream-ready diff with the failing case, and rerun the
paused-inside-commit case.

**Rationale:** The overwrite is reproduced twice (`research/14`, `research/16`), and a tested fix is
a stronger thing to send upstream than an issue. Rejected: keeping D38, with the case failing until
upstream fixes it. Recommended answer accepted. D38's other half stands: the repo-owned platform is
not retired on the strength of a local patch alone.

## 2026-11-13 — D42 recovery after a killed runner

**Question:** After a runner is killed mid-delivery, every reaction happens exactly once, but only
after the dead runner's 60-second lease. What is the rule?

**Answer:** The guarantee is that reactions resume within one lease after a runner dies. The case is
rewritten to assert exactly that: nothing lost, nothing doubled, done within the lease plus wake
latency. A proposal for leases that follow shard ownership goes upstream separately.

**Rationale:** The earlier case asserted a ten-second read that the lease-based design cannot meet;
the property that matters is no loss and no duplication within a stated bound. Rejected: patching
the library for immediate takeover (a larger change than the patches so far); leaving the case
failing. Recommended answer accepted.

## 2026-11-13 — D43 facts and upgrades (narrows D33)

**Question:** Bumping a view's version rebuilt the projection that publishes integration facts; its
positions restarted and the facts stream refused its first writes as older. What is the rule?

**Answer:** The publishing projection reads aggregate events directly, not a versioned view, so a
view rebuild cannot touch it. A checker forbids bumping the version of any projection that feeds a
published stream; a change to a fact is a new fact version instead. The library behaviour goes
upstream as an issue.

**Rationale:** `research/16`, the case restoring earlier data under the new code. D33's outbox stays
in the model; what changes is what it may read and that it is never rebuilt in place. Rejected:
reversing D33 for a host-owned outbox table; keeping the design with a stream-origin reset as a
required upgrade step. Recommended answer accepted.

## 2026-11-13 — D44 upstream timing

**Question:** Two fixes are saved as upstream-ready diffs and two issues are written up. Open them
now?

**Answer:** Not yet. Hold everything upstream until D41 to D43 are built and rerun, so what goes
out is final. Nothing is posted.

**Rationale:** Posting is under the operator's GitHub account, and a third fix and a rewritten case
are about to change the evidence. Rejected: opening the two pull requests now; opening everything
now. Recommended answer accepted.

## 2026-11-14 — Phase 9: D41 to D43 built, and the cluster suite a fourth time

The operator approved a fourth swarm session. Notes are in `research/17-rework-phase9-notes.md`.
Teardown matched a fourth Docker baseline apart from 10.7 MB of build cache. In memory, the Effect
check has zero diagnostics, 166 tests pass and 109 of 109 declared outcomes run, re-run by the
orchestrating session.

- **D41, the version check.** A third local patch re-reads `meta` as the first step of the commit
  transaction and writes nothing when the version moved since `decide`; the call fails with
  `CommitConflict` and the caller's retry starts at the receipt lookup. On Effect Cluster the
  transaction first takes a per-instance advisory lock, without which two runners would both read
  the old version under read-committed isolation. Saved upstream-ready as
  `notes/upstream/03-commit-version-check.patch` in the prototype, with an in-process reproduction
  (`LostWrite.test.ts`).
- **D42, the recovery case.** Rewritten to assert every reaction exactly once within the library's
  60 s lease plus two 10 s message polls (80 s). It passed at 66.8 s. A test pins both constants to
  the installed sources. The shard-ownership lease proposal is written (`notes/upstream/04`).
- **D43, facts from events.** The decision events now carry their scope (org and review runs), a
  new projection reads `Claim` events and writes generation 2 of the published stream, and the feed
  serves generation 1 then generation 2 as one log so old checkpoints keep their meaning. A checker
  pins every published stream to its writer, generation and sources. The upgrade case (phase 6's
  dump under the new code) now passes: the decision is published, the waiting run completes, and no
  fact reaches a consumer's command twice.
- **Every case of the suite passes as written.** Two things fall short of what was asked:
  - **The stale runner is still acknowledged.** In three paused-inside-commit runs nothing was
    overwritten, but the paused runner's transaction began first, so it won each time. The shard
    moved in one run, and there the other runner's commit was refused and retried. A version check
    orders commits by transaction, not by shard ownership.
  - **A fourth library defect.** On Effect Cluster an object call's arguments go through
    `JSON.stringify`, so the directory listing's missing first-page cursor arrives as `null` and a
    new consumer's backfill lists no instances. Generation 2 therefore holds only decisions made
    after the upgrade, and generation 1 cannot be retired. This also explains phase 8's upgrade
    failure. Written up as `notes/upstream/06`, not patched.
- A decision stored before phase 9 whose fact was never published gets only the run its event
  names. Draining the old publisher before an upgrade would close that case.

D5 verdict: not met. The pass rests on three local patches, the stale runner is acknowledged, and
an upgrade that adds a consumer gets no history on this host. Open for the operator: accept
first-commit-wins or fence commits on shard ownership; patch the backfill defect locally or wait;
whether an upgrade drains the old publisher first; and D44 (nothing is posted upstream).

## 2026-11-14 — D45 a runner that lost its shard (extends D41)

**Question:** With the version check, a runner paused inside its commit no longer loses a write,
but in all three runs the paused runner's write was the one acknowledged, because its transaction
began first. What is the rule?

**Answer:** Fence the commit on shard ownership. A fourth local patch makes the commit transaction
also establish that this runner owns the instance's shard, so a runner that lost its shard is
refused and the caller's retry reaches the current owner. The case is rerun and the patch joins the
upstream set.

**Rationale:** `research/17`. Ordering commits by transaction keeps every acknowledged write, but
it lets a runner the cluster no longer trusts with the instance speak for it. Rejected: accepting
first-commit-wins as the guarantee and rewriting the case to assert only that. Recommended answer
accepted.

## 2026-11-14 — D46 the backfill that lists nothing on Effect Cluster

**Question:** On Effect Cluster a new consumer's backfill lists no instances, because the missing
first-page cursor arrives as `null`. The new facts stream therefore holds only decisions made after
the upgrade. Patch it locally like the other three defects?

**Answer:** Patch and rerun. Fix it in the local patch, save an upstream-ready diff with the failing
case, and rerun the upgrade case so the new stream generation is shown complete on the cluster.

**Rationale:** `research/17`. Without it an upgrade that adds or rebuilds a consumer gets no history
on this host, and the first generation of a published stream can never be retired. Rejected:
keeping the write-up only and serving the old generation indefinitely. Recommended answer accepted.

## 2026-11-14 — D47 upgrades that replace a publisher (extends D43)

**Question:** A decision made under the old code whose fact was never published now reaches only
the run its event names, not every review run of that claim. Should an upgrade drain the old
publisher first?

**Answer:** Yes. An upgrade that replaces a publisher waits until the old one has published
everything pending. The deployment check enforces it and a case proves it.

**Rationale:** `research/17`. The narrower fact is a silent loss for the other review runs, and the
old publisher is the only code that knows the full scope of an old decision. Rejected: accepting
the gap with the phase 9 fallback and a logged warning. Recommended answer accepted.

## 2026-11-14 — D48 upstream timing (renews D44)

**Question:** Three patches, a lease proposal and two issue write-ups are saved in the prototype.
Send them now?

**Answer:** Hold until the next rerun. Nothing is posted until D45 to D47 are built and the suite
is rerun, so the set that goes out is final. The operator is asked again then.

**Rationale:** Two more patches are about to join the set, and one of the write-ups becomes a patch.
Rejected: reading the six drafts now; stopping the lane. Recommended answer accepted.

## 2026-11-14 — Phase 10: D45 to D47 built, and the cluster suite a fifth time

The operator's answers to D45 and D46 asked for a rerun, taken as the go-ahead for a fifth swarm
session. Notes are in `research/18-rework-phase10-notes.md`. Teardown matched a fifth Docker
baseline apart from 21.4 MB of build cache. In memory, the Effect check has zero diagnostics, 175
tests pass and 109 of 109 declared outcomes run, re-run by the orchestrating session.

- **How Effect Cluster 4.1.4 holds a shard** (read from source, cited in `research/18`): a
  session-level Postgres advisory lock on one reserved connection per runner, whose
  `idle_session_timeout` is the 35 s lock expiry. The domain commits on a connection from another
  pool. A paused runner's lock session is ended by the server at 35 s; in all five pauses the lock
  passed to the other runner 28.8 to 36.4 s in. Earlier phases judged takeover by which runner
  handled the next write, which is not the same thing: that write is sometimes routed to the paused
  runner after its shard has moved.
- **D45, the fence (local patch 4).** A takeover cannot be made to wait for an open commit, so the
  fence records the lock holder at the start of the transaction and a deferred constraint trigger
  refuses the commit at `COMMIT` if the lock changed hands. It refused the paused runner's commit
  in five of five runs. **The invariant still fails:** in three of five runs a write queued to the
  paused runner ran after it resumed and was committed by it while the other runner held the shard
  (one run held, one was not sampled). On this stack every session arrives from the swarm load
  balancer's address under the client's default name, so the fence cannot tell its own runner's
  lock session from another's. No write was lost, doubled or reordered in any run; the version
  check and the per-instance advisory lock still order every commit.
- **D46, the backfill (local patch 5).** Fixed in the cluster transport: trailing arguments a
  caller leaves out are omitted, so they arrive as `undefined`. Two other calls had worked only by
  accident. A view added over phase 9's data held 11 of 11 earlier writes, and generation 2 of the
  facts stream now holds the phase 6 decision, identical to generation 1's. Each fact reached the
  consumer once. Generation 1 is still served.
- **D47, the drain check.** `checkPublisherHandover` in `shared/tooling` refuses a deploy that
  closes a generation or replaces its writer while the outgoing publisher has anything unpublished.
  It passes once drained, in memory and against phase 6's data. Its backlog reader is specific to
  Party's publisher. The drain itself was not run on the cluster, since no old code was deployed
  there. The never-published fallback is logged as an error and was not taken.
- Every other case passed. Upstream's ten, P1 to P7, P7b and P9 ran on a build whose fence matched
  sessions by address only; the final build tries the session name first, which no session here
  has, so behaviour is the same but those cases were not rerun on it.

The child proposed that Effect name its lock session after the runner (`notes/upstream/08`), a
change outside Alchemy. The orchestrating session read the source and found a route that needs no
change in Effect, not yet run: the lock session is reserved from the pool that
`@alchemy.run/effect-cluster`'s bootstrap builds with `PgClient.layer({ url })`, and `PgClient`
4.1.4 accepts `applicationName`. Naming that pool `effect-cluster:<host>:<port>` gives the fence
the identity it already looks for first.

D5 verdict: not met. D45's invariant fails on the cluster, and the pass rests on five local
patches. Open for the operator: make the fence exact or accept ordered commits as the guarantee;
whether the drain check's backlog reader becomes generic; the rule for when a generation stops
being served; and D48 (nothing is posted upstream).

## 2026-11-14 — D49 the fence's identity (completes D45)

**Question:** The fence refuses a commit during which the shard changed hands, but a runner that
already lost its shard was acknowledged in three of five runs, because the fence cannot tell its
own lock session from another runner's. What now?

**Answer:** Name the lock session. A sixth local patch, in `@alchemy.run/effect-cluster`: its
bootstrap names the runner's connection pool, from which Effect reserves the lock session, so the
fence identifies its own runner. No change to Effect. The whole suite is rerun on the final build.

**Rationale:** `research/18`, and the orchestrating session's reading of `SqlRunnerStorage.ts` and
`Bootstrap.ts` (not yet run). Rejected: proposing the change to Effect and leaving the invariant
unmet on this host meanwhile; reversing D45 for "every acknowledged write is stored once, in
order". Recommended answer accepted.

## 2026-11-14 — D50 the drain check reads any publisher (extends D47)

**Question:** The drain check finds unpublished decisions with a query that knows Party's claims.
Should it work for any publisher?

**Answer:** Yes. It reads a writer's backlog from the host's own records (its sources' outboxes,
plus what it accepted and has not processed), so every published stream gets the check with no
per-slice query. A library call for it is proposed upstream later.

**Rationale:** A check each slice must write is a check some slice will not write. Rejected: one
backlog query per publisher. Recommended answer accepted.

## 2026-11-14 — D51 when a closed generation stops being served (extends D34)

**Question:** Generation 2 of the facts stream is complete on the cluster and generation 1 is still
served. What is the rule?

**Answer:** A closed generation stops being served only when the next holds every fact it held,
every consumer in every deployment descriptor has read past it, and positions keep their meaning.
The checker enforces it. Nothing is retired now.

**Rationale:** The same shape as D34's rule for fact versions: retirement is decided by what
deployed consumers still need, checked by a tool. Rejected: serving every closed generation
forever. Recommended answer accepted.

## 2026-11-14 — D52 upstream timing (renews D48)

**Question:** Five patches, a lease proposal and two write-ups are saved in the prototype. Send
them now?

**Answer:** Hold until the fence is settled. Nothing is posted until D49 is built and rerun; the
operator then sees the full set before anything goes out.

**Rationale:** The fence's patch and its evidence are about to change. Rejected: reading the drafts
now; stopping the lane. Recommended answer accepted.

## 2026-11-14 — Phase 11: D49 to D51 built, an upgrade, and the cluster suite a sixth time

The operator's answer to D49 asked for a rerun of the whole suite, taken as the go-ahead for a
sixth swarm session. Notes are in `research/19-rework-phase11-notes.md`. Teardown matched a sixth
Docker baseline apart from 21.3 MB of build cache. In memory, the Effect check has zero
diagnostics, 188 tests pass and 109 of 109 declared outcomes run, re-run by the orchestrating
session.

- **D49, the fence is exact (local patch 6, in `@alchemy.run/effect-cluster`).** The bootstrap
  names the runner's pool `effect-cluster:<host>:<port>`, with a hashed form past Postgres's 63
  bytes, and the fence accepts only a session of that name holding the shard's lock, with no
  fallback. The reading the ruling rested on was confirmed: Effect reserves the lock session from
  that pool. Only the two named lock sessions ever held locks in the cluster's namespace,
  including after a lock connection was rebuilt.
- **The invariant held in six of six paused-inside-commit attempts.** The paused commit was refused
  every time, every write the resumed runner decided while it did not hold the shard was refused at
  the fence's first read, and every refused write was stored once, the last 12.03 s after the
  unpause against a derived bound of 33 s. Four attempts counted under the case's own rule (the
  write sent at once reached the paused runner); in the other two a later write reached it and was
  refused. The required three counting runs are met.
- **D50, the generic backlog reader.** The drain check reads any publisher's backlog from the
  host's rows: deliveries staged to the writer or to a view it reads, inputs accepted and not
  processed, and an incomplete backfill run. It agreed with Party's own query in every comparison.
  It cannot run on the in-memory platform, whose queue is out of reach; a library call is written
  up as a proposal (`notes/upstream/09`).
- **D51, the retirement check.** Stream pins gain a `Retired` state that keeps the generation's
  length, and the check approves a retirement only when the four conditions hold. Run against the
  cluster after the upgrade case, its verdict for generation 1 is allowed. Nothing was retired; the
  retired feed ran in process only.
- **A real upgrade on the cluster.** Phase 8's code was deployed, a decision was made with its fact
  undelivered, and the drain check refused; once the publisher drained it passed. The current code
  was deployed over the same data, the new generation was backfilled equal to the old, and the
  review run concluded once. The data was fresh: one decision and one run.
- Every case ran on one build. Upstream's ten and every case of the prototype's own pass.

What falls short: a write sent to a runner while it is paused in `decide` waits for that runner
(its client gave up at 60 s; it was stored once after the resume), which is a matter of liveness;
the refusal on an unnamed pool follows from the SQL and was not observed, and should come with a
startup error; generation 1 is still served.

D5 verdict: not met, by D41's standing half. Every case passes and D49's invariant holds, on six
local patches that are not upstream. Open for the operator: the upstream set (D52), whether this
pass meets the D16 gate, and the rule for a write sent to a frozen runner.

## 2026-11-14 — D53 the graduation gate and the patched pass (settles D16's last item)

**Question:** Every conformance case passes on the Postgres swarm host on one build, on six local
patches to Alchemy that are not upstream. Does this pass meet the graduation gate?

**Answer:** The gate is met; retirement waits. The patched pass counts as D16's conformance item,
so the packet can move toward graduation. Retiring `@beep/alchemy-postgres` (D5) still waits until
the fixes are in an upstream release, as D41 says.

**Rationale:** `research/19`. The gate asks whether the design holds on a real host, and the
patches show what the host needs for it to hold; retirement asks whether the repo can depend on
what upstream ships. Rejected: holding the packet at shape until upstream lands; retiring the
repo-owned platform on patches carried in the monorepo. Recommended answer accepted.

## 2026-11-14 — D54 the upstream set is read before it is sent (follows D52)

**Question:** Six patches and three write-ups are saved in the prototype. What next?

**Answer:** Show the operator the set. A startup error for an unnamed runner pool is added to the
fence first. Nothing is posted until the operator says so.

**Rationale:** The fence refuses every commit on an unnamed pool, which is correct and silent; a
maintainer should get a loud failure at start. Rejected: holding the set unread; stopping the lane.
Recommended answer accepted.

## 2026-11-14 — D55 a write sent to a frozen runner (beside D42)

**Question:** A write sent to a runner while it is frozen waits for that runner: its client gave up
at 60 s, and the write was stored exactly once after the runner resumed. What is the rule?

**Answer:** State it as the guarantee. A write to a frozen runner completes or fails within the
caller's retry budget, is never stored twice, and a retry under the same id gets its receipt. A
case asserts exactly that. No library change.

**Rationale:** The same reasoning as D42: the property that matters is no loss and no duplication
within a stated bound. Rejected: changing the caller to resend a stuck write to the runner that
holds the shard. Recommended answer accepted.
