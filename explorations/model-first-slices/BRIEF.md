# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

Not yet confirmed by the operator. The fourth-draft design artifact (D20) is the long form of this
brief; `DECISIONS.md` is the source of truth where they differ.

## Problem

The architecture standard was written before `@alchemy.run/domain` and before Effect Cluster could
host a domain model. The one slice built on the library since then (vault-sync) shows the
seven-package slice and the library pulling against each other: a whole model sits inside one
aggregate folder, handlers and ports have twice moved away from the placement table, and a
repo-owned Postgres platform duplicates hosting that upstream now ships. The question is what the
standard would be if it were designed today, for a codebase where agents write, call and operate
the system alongside people.

## Appetite

Not set by the operator. The graduation gate in D16 bounds the work: the packet graduates only when
that list of proofs exists.

## Solution Sketch

- **Unit.** A slice is a bounded context. One `Domain.Model` per context by default (D2).
- **Packages.** Four per slice, one per dependency closure: `contract` (what clients and other
  contexts import), `model` (the write and reaction model), `host` (server adapters, stores, cluster
  classes), `web` (React). `Aggregate.predict` in the browser is an explicit per-screen choice (D3).
  The contract is hand-authored with a parity test until an upstream split lands (D9).
- **Files.** `<Module>/<Noun>.<kind>.ts` for declarations, `.handler.ts` and `.adapter.ts` for
  implementations, exact package exports, a generated handler registry (D10).
- **Authority.** A trusted boundary builds an `Invocation` (principal, on whose behalf, agent run,
  grants). Policies and sagas relay it with the causal chain. A dedicated authority context owns
  grants, delegation and a general Accountability relation; the kernel holds only the language
  (D4, D7, D18).
- **Agents.** `AgentRun` is an aggregate; a saga executes it; a cluster entity is a restartable
  worker. Approval is an authenticated command. Budget is reserved and settled. Delegation only
  narrows. A run is one bounded piece of work; a session entity holds a chain of runs. Operating
  agents call derived tools under a grant; agents that write code get the contract client in a
  sandbox. The Reasoner port carries an evaluation contract (D6, D19, D21, D23).
- **Process model.** Effect Cluster. Postgres on a Docker swarm is the first host. Each slice's host
  publishes a deployment descriptor; the app composes descriptors onto pools; entry modules are
  generated (D5, D13).
- **Between contexts.** Versioned integration facts through an outbox and inbox; synchronous calls
  through a consumer-declared port over the provider's contract (D11).
- **Frontend.** React. Generated bindings for ordinary screens; a pure machine with a story where
  interaction state earns it; correlation on command id, receipt and view revision (D12).
- **Enforcement.** A proof inventory: mechanical laws run automatically, and semantic questions go
  to a reviewer that did not write the change (D8).
- **Added scope.** Durable compatibility and replay, an operations context, production-cut stories,
  retention and trust (D14). Stored bytes are never rewritten; schemas convert on read (D22).

Build order: rework the prototype in memory, then run it on the swarm host with the conformance
suite, then draft the upstream proposals (D15).

## Rabbit Holes

- The library cannot build an Api client without the Model today. The interim contract relies on
  library internals and loses the typed nested client (D9).
- Request context is not persisted on events, so authority rides in the payload until an upstream
  change lands, and after the first hop the handler asserts it (D4).
- A retried command id returns the stored result before `decide` runs. Authorization of cached
  results and the binding of idempotency keys need their own design (D14).
- A defecting cluster entity is reported to restart without end today, below any aggregate. This
  was found by a sub-agent and has not been re-checked.
- Upstream states that every host passes a shared conformance suite. The D5 suite should start from
  it; it has not been located in the source yet.
- That the cluster loader accepts generated entry modules is unchecked (D13).

## No-Gos

- No amendment to `standards/ARCHITECTURE.md` before the packet graduates (D1, D16).
- No retirement of `@beep/alchemy-postgres` before the conformance suite passes on the chosen host
  (D5).
- No new slice migration on the seven-package shape while the packet is open (D17).
- Foldkit is not adopted; only its story testing pattern is borrowed (operator, `CAPTURE.md`).
- Building the agent evaluation harness is a later goal (D19).
