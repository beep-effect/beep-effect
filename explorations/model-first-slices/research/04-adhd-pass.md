# ADHD pass — 2026-11-13

Problem: how should the Model-First Slices proposal change to be the best architecture for a
codebase where agents write, call and operate the system? Five isolated branches (Claude Opus 5.5),
one frame each: hostile competitor, remove the load-bearing assumption, 3am on-call, regulator, ant
colony. Thirty ideas, scored on novelty (N), viability (V) and fit (F), 0 to 10.

## Wide set

### Who is accountable

- Authority triple: operator, principal, supervisor; supervision as an aggregate. N8 V8 F10
- Causal actor chain that survives policies and sagas. N6 V9 F9
- Law-set hash, inference model id and prompt digest on every event. N6 V9 F8
- Human attention as a budget the aggregate spends per proposal. N8 V7 F8
- Agent reads of privileged material become `AccessRecorded` events. N7 V7 F9
- Attribution as a disputable claim held by a provenance aggregate. N8 V4 F5 (trap)

### Production writes the spec

- Cut real log slices into stories. N6 V8 F9
- Replay-diff law: fold real histories through new `evolve` and fail on unexplained differences. N6 V8 F9
- A failing story is an incident's first artifact. N6 V8 F9
- Rejections as the Api backlog: repeated rejections signal a missing command. N7 V8 F8
- A runtime rejection no story covers drops a story stub. N7 V7 F8
- Every handler version live in shadow, promoted on agreement. N8 V6 F7
- Story author must differ from handler author. N7 V6 F7

### Proposals are branches

- Agents decide on a forked copy of a stream and submit the event diff. N8 V6 F7
- Inference stands in for an unwritten port until traffic earns real code. N9 V5 F7
- Speculative timelines for data and code alike. N9 V3 F6 (trap)

### Operations is a slice

- Ops model: every repair is a command; the agent proposes, the Ops aggregate decides. N7 V8 F9
- Quarantined state on every aggregate. N7 V7 F8
- Page a person only when the model rejects a repair. N8 V7 F7
- Declared degraded mode per `ExternalSystem` port. N6 V7 F8
- Every event names its compensating event. N7 V5 F7 (trap)

### Compliance as structure

- Retention class per stored field, a Retention aggregate, tombstone proofs. N7 V7 F9
- Lineage set per event, so one bad inference's downstream reach is computable. N8 V6 F9
- Ethical walls as a law over views, projections and agent context. N9 V5 F9

### Self-describing

- Live introspection query over MCP replaces the generated `SLICE.md`. N6 V8 F8
- Static detection of policy-to-command-to-event loops. N6 V7 F6
- Slice boundaries recomputed from observed coupling. N7 V4 F6
- Agents leave summary events for the next agent. N7 V5 F6
- Laws by quorum. N8 V3 F4 (trap)
- Vocabulary-hash "scent" at slice boundaries. N8 V3 F5 (trap)

## Converge

1. Authority record with a causal chain (the non-obvious pick). It fixes the hole the prototype
   exposed and matches what Astra and Kimi found independently.
2. Operations as a slice.
3. Production writes the spec.
4. Retention class per field.

Traps: laws by quorum (a law that decays when violated is not a law); speculative timelines
(branching history multiplies every consistency question); disputable attribution (an audit trail
unsettled at write time proves nothing); mandatory compensator (many facts cannot be compensated,
so fake ones would be invented); vocabulary scent (no checkable definition).

## Focus

### 1. Authority record

Replace `by: Actor` with `authority`: `root` (a human or agent, never a process), `by` (the
operator, which may be a process), `onBehalfOf`, a supervision reference and `hops`. A chain with no
root is unrepresentable. Session middleware builds the first one and, for an agent, fails with
`Unsupervised` when no live relation names a supervisor. The library gives every hop a cause
(`envelope.commandId`, `correlationId`, deterministic ids for policy sends) but delivers only
`PolicyRun` and `Telemetry.Correlation` to a policy, never the captured request context. One
`Authority.relay(policy, trigger)` constructor copies the trigger event's authority and appends the
hop.

- Rests on: after the first hop the handler asserts the authority. In-process sends skip the
  middleware and any handler can provide any context. Supervision liveness is a view read.
- First step: add `Authority` and `relay` to the prototype kernel, change
  `MergeOnSameParty.policy.live.ts` to relay, and assert `PartiesMerged.authority.root` is the
  reviewer.
- Children: an upstream PR to persist `SendMeta.context` on events and restore keys marked
  `propagate`; a Mandate aggregate as a root for scheduled and ingested work; a ratification queue
  per supervisor; scoped supervision as a capability token; a `Story` combinator that checks every
  chain reaches a root.

### 2. Operations as a slice

An Ops `Domain.Model` in its own shard group. A host singleton opens incidents from signals that
already exist: saga status `Died` or `Rejected`, exhausted policy retries, failed port spans. A
triage saga gets a schema-checked `RepairProposal` from the Reasoner. A deterministic step attaches
`Aggregate.predict` output and the reachable policies and sagas. `ProposeRepair.decide` accepts only
when the prediction is definite, one instance is touched, the fan-out is under budget and no
external operation is reachable. Accepted repairs go to a morning digest; a rejection pages a
person. Quarantine lives at the host; a degraded port answers `Deferred` and writes to an outbox.

- Rests on: the blast-radius check sees partial evidence (`predict` covers one instance; the static
  graph cannot see data-dependent branches). Also reported: the Domain cluster host builds the model
  entity with a defect retry policy that never stops, below any aggregate. Not re-checked.
- First step: a test on the cluster host where one id's `evolve` throws, asserting sibling ids still
  answer; then pass `disableFatalDefects` through the model entity options.
- Children: each repair carries a generated story that must pass in memory first; a daily
  blast-radius budget; a one-call `RevertRepair`; held poison commands promoted to regression
  stories; a degraded mode for the Reasoner itself.

### 3. Production writes the spec

The stored log cannot be cut into a story on its own: it lacks the command, the actor context,
rejections and port answers. A decorator on the aggregate store's `send` journals sampled sends. A
cut joins one journal row to the stream and emits story steps. Replay-diff folds sampled histories
through new `evolve`, re-decides the journaled commands and compares; a difference passes only when
a declared migration reproduces it on every sample.

- Rests on: the journal holds the most sensitive data in the system, and `decide` must depend only
  on what was captured. Fixtures are pseudonymised with a keyed HMAC; a fixture whose outcome
  changes under scrubbing stays inside production.
- First step: wrap the in-memory store in the prototype, cut each journaled send, and assert every
  cut passes under the same `Story.make`.
- Children: an outcome production has reached counts as covered only by a cut story; rejection
  clusters as demand signals; shadow `decide`; behaviour bisect across model versions.

## Provocation

If an agent's proposal is a forked stream that the aggregate merges or refuses, a pull request is
the same thing for source. Should code changes and data changes go through one mechanism?
