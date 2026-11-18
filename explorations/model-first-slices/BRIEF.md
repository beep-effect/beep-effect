# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

Current to D61 (2026-11-17). Confirmed by the operator on 2026-11-17 (D59). The fifth-draft design
artifact (`research/21`) is the long form of this brief; `DECISIONS.md` is the source of truth
where they differ.

## Problem

The architecture standard was written before `@alchemy.run/domain` and before Effect Cluster could
host a domain model. The one slice built on the library since then (vault-sync) shows the
seven-package slice and the library pulling against each other: a whole model sits inside one
aggregate folder, handlers and ports have twice moved away from the placement table, and a
repo-owned Postgres platform duplicates hosting that upstream now ships. The question is what the
standard would be if it were designed today, for a codebase where agents write, call and operate
the system alongside people.

## Appetite

The standard plus one real slice (D60). The first round of goal packets amends
`standards/ARCHITECTURE.md` and the scaffolding and lint tooling to the four-package shape, and
builds one real context end to end on it in `packages/`, running on Effect Cluster with the library
fixes carried as root patches (D61). Everything else waits in `MAP.md` as gated candidates.

## Solution Sketch

- **Unit.** A slice is a bounded context. One `Domain.Model` per context by default (D2).
- **Packages.** Four per slice, one per dependency closure: `contract` (what clients and other
  contexts import), `model` (the write and reaction model), `host` (server adapters, stores, cluster
  classes), `web` (React). `Aggregate.predict` in the browser is an explicit per-screen choice (D3).
  The contract is a `Domain.Api` declared over a catalog of declarations that name no aggregate, so
  the typed nested client survives; a parity test compares it with the model's Api. Views and
  queries are declared a second time for the contract. An upstream split remains the target (D9 as
  amended in phase 1).
- **Files.** `<Module>/<Noun>.<kind>.ts` for declarations, `.handler.ts` and `.adapter.ts` for
  implementations, exact package exports, a generated handler registry (D10).
- **Authority.** A context named `authority` owns grants, delegation and a general Accountability
  relation: every agent-rooted action names an accountable human (D7, D18). The kernel holds the
  `Invocation` schema, ids and the pure grant-check language, with no Layer and no credential
  handling (D27). Only authority builds an Invocation. Events store provenance alone: the root, on
  whose behalf, the causal chain and grant ids. At each hop a policy or saga asks authority, through
  a port it declares, to re-admit the chain from live grants (D24). Re-admission never adds a grant;
  it passes those still in force, and a command that needs a lapsed one is refused and the refusal
  recorded (D30). A command started by an integration fact runs under the consuming record's own
  provenance plus a hop naming the fact (D32). Command ids are bound to org, operation and request
  fingerprint (D36).
- **Agents.** A context named `runs` owns the `AgentRun` aggregate, the budget ledger and run
  lineage. A product context keeps its own executor saga and reports steps and usage to the run
  through a port; approval is an authenticated command in the product context (D6, D28). A run gets
  its authority by delegation when it is requested: named operations, a resource scope and an
  expiry. A child run narrows it again (D26). The budget lives in the runs ledger alone, reserved
  and settled there (D29). A run is one bounded piece of work; a session entity holds a chain of
  runs (D23). Operating agents call derived tools under a grant; agents that write code get the
  contract client in a sandbox (D21). The Reasoner port carries an evaluation contract (D19).
- **Process model.** Effect Cluster, with Postgres on a Docker swarm as the first host (D5). Each
  slice's host publishes a deployment descriptor as data; the app composes descriptors onto pools
  and generates the cluster entry modules (D13, D40). One context calls another through the
  provider's contract Api over the pool's own dispatch. Contexts in a pool trust each other, a
  caller from another pool presents that pool's gateway token, and a host has no principal of its
  own (D39).
- **What the host guarantees.** No acknowledged write is overwritten: the commit transaction
  re-reads the version and refuses when it moved (D41). A runner that lost its shard cannot commit:
  the transaction is fenced on shard ownership, identified by a connection pool named for the
  runner, and a runner whose pool is not named fails at start (D45, D49, D54). After a runner dies,
  every reaction happens exactly once within one lease, 80 seconds on the present constants (D42).
  A write sent to a frozen runner completes or fails within the caller's retry budget, is never
  stored twice, and a retry under the same id gets its receipt (D55).
- **Between contexts.** Versioned integration facts. The outbox is a projection in the producer's
  model that reads aggregate events directly and writes a `Domain.Stream`; the host serves that
  stream as a feed and the consumer keeps an inbox (D11, D33, D43). A published stream is pinned to
  its writer, generation and sources. The projection behind it is never rebuilt in place; a change
  to a fact is a new fact version or a new stream generation, and the feed serves closed
  generations followed by the open one as a single log (D43). An upgrade that replaces a publisher
  waits until the old one has published everything pending, checked from the host's own records for
  any publisher (D47, D50). A fact version is retired when no deployment descriptor consumes it, and
  a producer's newest version never is (D34, D40). A closed generation stops being served only when
  the next holds every fact it held, every consumer has read past it and positions keep their
  meaning (D51). Synchronous calls go through a consumer-declared port over the provider's contract
  (D11).
- **Stored formats.** Stored bytes are never rewritten; schemas convert on read (D22). Saga
  activity results are part of that contract: an incompatible change is a new saga version, and
  runs in flight finish on the version they started (D35).
- **Frontend.** React. Generated bindings for ordinary screens; a pure machine with a story where
  interaction state earns it; correlation on command id, receipt and view revision (D12).
- **Enforcement.** A generated proof inventory: mechanical laws run automatically, and semantic
  questions go to a reviewer that did not write the change (D8). The Effect language-service rules
  run in every check with nothing switched off.
- **Added scope.** Durable compatibility and replay, an operations context, production-cut
  stories, retention and trust (D14).

## What The Prototype Shows

The standalone prototype (`scratchpad/model-first-slices/`) has three contexts (`party`,
`authority`, `runs`), a `party/web` package and one app. As last run by the orchestrating session:
zero Effect diagnostics over 17 projects, 196 tests, 109 of 109 declared command outcomes executed,
and a proof inventory of 41 entries.

- All eight items of the D16 gate are proven. Seven are proven in memory, the two screens without
  a browser. The eighth, conformance
  on the Postgres swarm host with restore, passed on one build in the sixth swarm session:
  upstream's ten cases and every case of the prototype's own, including a real upgrade from earlier
  code over live data.
- That pass rests on six local fixes to `@alchemy.run/domain` and `@alchemy.run/effect-cluster`. A
  startup guard was added afterwards and has run in process only. They are written up for upstream
  as seven patches and three write-ups. Nothing has been sent (D54, D58).
- Built from D14: stored-format fixtures with conversion on read, command ids bound to their
  request, sinks that track source position and generation, and a rebuild with no side effects.
  Not built: the operations context, production-cut stories, retention and trust. They are decided
  scope with no proof yet.

## Rabbit Holes

- **The host guarantees depend on fixes upstream does not ship.** Until they are in an Alchemy
  release, the monorepo carries them as root patches (D61).
- **A connection pooler that rewrites the session name defeats the fence's identity.** The runner
  starts and every commit is then refused. The startup guard cannot see this.
- **Not yet observed on a cluster:** the startup guard, the refusal on an unnamed pool, the
  frozen-runner case as rewritten for D55 (an earlier run saw such a write wait over 60 seconds, so
  it may fail), and serving a retired generation.
- **The upgrade proof is small.** One decision and one run, on fresh data.
- **Root forgery in process.** The library decodes whatever request context in-process code
  provides. The control today is a source scan with known gaps; an upstream change is the target
  (D25).
- **A reused command id is answered from the stored receipt before the payload is decoded or the
  grant checked.** Pinned as a test; an upstream ask.
- **A top-level event field cannot be renamed with the library's Event builder.** An upstream ask.
- **The generic backlog reader cannot run on the in-memory platform,** so the drain check is
  proven only against Postgres. A library call for it is proposed.
- **Swarm cannot bind a published port to localhost.** The conformance driver runs inside the
  stack's network.
- **The prototype resolves `@beep/identity` and `@beep/schema` from the monorepo** and is no longer
  standalone.
- **A defecting cluster entity is reported to restart without end, below any aggregate.** Found by
  a sub-agent and never re-checked.
- **Browser session credentials, tenant and cache clearing** are deferred to the browser QA and
  HTTP wiring work.

## No-Gos

- No amendment to `standards/ARCHITECTURE.md` before the packet graduates (D1, D16).
- No retirement of `@beep/alchemy-postgres` until the fixes are in an upstream release (D5, D41,
  D53).
- No new slice migration on the seven-package shape while the packet is open (D17).
- Nothing is posted upstream without the operator's explicit yes (D54, D58).
- Foldkit is not adopted; only its story testing pattern is borrowed (operator, `CAPTURE.md`).
- Building the agent evaluation harness is a later goal (D19).
