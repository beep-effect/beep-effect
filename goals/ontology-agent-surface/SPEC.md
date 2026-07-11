# Ontology Agent Surface Spec

## Objective

Expose the completed ontology workbench to agents through a curated MCP toolkit
served by the existing professional-desktop sidecar. V1 operates statelessly on
saved Turtle files, reuses typed ontology use-cases and real engine layers, and
makes every write conflict-safe, fail-closed, attributed, budgeted, and
recoverable. The first live slice proves authenticated `capability-metadata`
and bounded `sparql-query` calls from an actual MCP client.

## Non-Goals

- A sidecar session repository, revisioned two-writer contract, shared
  undo/redo, or access to unsaved webview state; `sessionHandle` is reserved for
  a future stateful v2 only.
- A stdio MCP transport in v1.
- Full OWL 2 DL reasoning; the workbench t2/t3 deferral remains and capability
  metadata must advertise the bounded inference actually available.
- A broad 25+ tool inventory before usage evidence justifies it.
- OLS/BioPortal registry fetch, multi-format import/export, or server-backed
  ontology workspaces.
- Unguarded mutation. A write that cannot be gated, attributed, and budgeted
  does not ship.
- Unrelated workbench UI, chat, foundation ontology, or identity-as-IRI work.

## Source Hierarchy

1. The user-approved graduation objective and
   [`BRIEF.md`](../../explorations/ontology-agent-surface/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md`, governing package standards, and the completed
   [`ontology-workbench` spec](../ontology-workbench/SPEC.md).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. [`DECISIONS.md`](../../explorations/ontology-agent-surface/DECISIONS.md),
   [`MAP.md`](../../explorations/ontology-agent-surface/MAP.md),
   `research/`, `ops/`, and `history/`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/ontology/{domain,use-cases,server}` for schema-first tool contracts,
  stateless file operations, CAS, attribution, validation, and shared
  orchestration.
- `packages/drivers/{n3,shacl,oxigraph}` and
  `packages/foundation/{capability/{mcp-kit,semantic-web},modeling/rdf}` only
  where the hardening and real-engine contracts require focused changes.
- An ontology MCP toolkit/driver following the `@beep/m365-mcp` thin-handler
  pattern; P0 must confirm its canonical package placement before scaffolding.
- `apps/professional-desktop/server` for the authenticated streamable-HTTP MCP
  mount beside `/rpc/` and the minimum runtime wiring needed to host it.
- Focused tests, tool documentation, benchmarks, and this packet's evidence.

## Constraints (locked decisions, normative)

1. The v1 vocabulary is a curated, agent-first surface of approximately ten
   task tools, not a 1:1 mirror of `OntologyRpcs`: `open-inspect`,
   `snapshot-describe`, `search`, `sparql-query`, `propose-change-batch`,
   `validate`, `repair`, `export-provenance`, and `capability-metadata` are the
   required capabilities. A mechanically justified split may add one tool;
   broader expansion requires usage evidence and a contract change.
2. Toolkit schemas live with the ontology capability they describe; the MCP
   driver stays a thin host with schema tools, service-delegating handlers,
   sanitized spans, explicit read/write annotations, and protocol-level tests.
3. V1 is stateless over saved Turtle files: each operation opens server-side,
   derives or applies typed change operations, and writes atomically only when
   the caller's expected rdfc-1.0 canonize fingerprint matches current disk
   state. Unsaved webview state is neither observed nor overwritten.
4. Tool schemas reserve an optional `sessionHandle` for a future stateful v2,
   but v1 must not create a session repository, lock service, revision store,
   cache, or two-writer undo model.
5. Before the P1 save contract freezes, decide and record whether semantic
   fingerprint equality alone is the CAS precondition or whether byte-hash
   equality is also required. The decision must preserve explicit conflict
   detection under prefix/formatting churn.
6. CAS rejection is a typed, recoverable tool result containing the current
   fingerprint and refetch/retry guidance; it is never last-writer-wins or a
   bare failure.
7. The only v1 transport is MCP streamable HTTP at `/mcp`, mounted beside
   `/rpc/` in the existing sidecar, bound to loopback, Origin-validated, and
   authenticated by the existing `RpcSessionAuth` boundary. Sidecar stdio
   remains owned by Effect RPC framing.
8. Every mutating tool is dispatched through `@beep/mcp-kit` TierGate and
   fails closed when policy or approval is absent. This first production
   wiring is reviewed and documented as a reusable repo precedent.
9. Caller identity crosses the authenticated tool boundary and is retained on
   every change-log entry so PROV-O export emits the correct `prov:Agent` and
   association. P2 cannot begin until the actor identity source is explicit;
   export-time-only attribution is insufficient.
10. Static server-owned budgets bound operations/quads per batch and query or
    report results independently of caller input. Reasoner drift beyond the
    allowed cap returns a typed tool error instead of silently triggering an
    unbounded full recompute.
11. Constraints 8-10 are the indivisible write-safety trio: a mutation that is
    not gated, attributed, and budgeted does not ship.
12. P0 hardens the flagship path before tool exposure: repair generation uses
    a constraint-component strategy registry beyond `sh:hasValue` while
    preserving verify-then-offer; empty/base `@prefix :` round-trips without
    loss; ROBOT validates the named interop fixtures on a capable host.
13. Repair strategies may only offer operations supported by sufficient SHACL
    detail and an explicit safety classification. Destructive or value-guessing
    strategies do not inherit the safe posture of `sh:hasValue` additions.
14. Every refusal or blocked action is surfaced as a typed tool state/error;
    silent no-op guards are forbidden. Proposed batches return real added and
    removed deltas.
15. All tool tests exercise the real N3/Oxigraph/SHACL stack where applicable.
    P2 includes an actual MCP client conversation (`initialize` → `tools/list`
    → `tools/call`) against authenticated `/mcp`; fakes-only proof is not
    acceptance evidence.
16. The first live vertical slice is `capability-metadata` plus bounded
    `sparql-query` over the real endpoint, proving transport, auth, toolkit
    registration, budgets, and Oxigraph before any mutation ships.
17. Stateless open/parse latency is benchmarked at 1k, 10k, and 100k elements
    in P3. Do not add a silent cache to improve results; cache pressure reopens
    the explicitly deferred session-ownership design and triggers a stop.
18. Adopt the single partition-ingestion classifier, worker-safe entrypoints,
    and shared surfaced-action-state helper only where planned work already
    touches their files; they do not authorize a broad architecture refactor.

## Decision Log

The resolved rationale remains in the exploration; these links seed the
implementation contract without duplicating the discussion.

| Date | Locked decision | Source |
| --- | --- | --- |
| 2026-07-10 | Sidecar streamable HTTP `/mcp`; existing loopback/auth boundary; no v1 stdio. | [`DECISIONS.md` — MCP transport & placement](../../explorations/ontology-agent-surface/DECISIONS.md) |
| 2026-07-10 | Stateless saved-file operations with fingerprint CAS; stateful session reserved for v2. | [`DECISIONS.md` — Agent session model](../../explorations/ontology-agent-surface/DECISIONS.md) |
| 2026-07-10 | TierGate, per-change actor attribution, and static budgets are launch-blocking. | [`DECISIONS.md` — Mutation safety scope](../../explorations/ontology-agent-surface/DECISIONS.md) |
| 2026-07-10 | Curated task-oriented toolkit near ten tools, wrapping use-cases directly. | [`DECISIONS.md` — Tool vocabulary](../../explorations/ontology-agent-surface/DECISIONS.md) |
| 2026-07-10 | Repair registry, prefix fidelity, and ROBOT proof land in P0/P1. | [`DECISIONS.md` — Hardening pre-work](../../explorations/ontology-agent-surface/DECISIONS.md) |

## Acceptance Criteria

- [ ] The curated toolkit exposes every required capability in Constraint 1
      with schema-typed inputs, outputs, and returned errors.
- [ ] An actual MCP client authenticates to loopback `/mcp`, initializes, lists
      tools, and invokes `capability-metadata` and bounded `sparql-query`
      against Oxigraph.
- [ ] A typed batch can be proposed, gated, applied, CAS-saved, and returned
      with real deltas and caller-specific PROV-O attribution.
- [ ] A stale caller receives the recoverable CAS conflict contract and cannot
      overwrite newer saved content.
- [ ] Query/result and mutation budgets are server-enforced; TierGate refusal
      and reasoner drift-cap refusal are typed and visible.
- [ ] SHACL validation returns verified repair proposals from the supported
      strategy registry; applying a proposal resolves its target violation.
- [ ] Empty/base prefix fidelity and ROBOT interop proof pass on named fixtures.
- [ ] Stateless parse benchmarks at 1k/10k/100k are recorded without hidden
      caching, and tool/capability documentation states actual reasoner limits.
- [ ] Real engine tests, authenticated protocol proof, package/repo gates, and
      P3 reflection lint pass; Yeet reports the PR work mergeable.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/ontology-agent-surface/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/ontology-agent-surface/ops/manifest.json` | Passes |
| Packet references | `rg -n "ontology-agent-surface|GOAL.md|agentLaunchers|packetAnchorDocument" goals/ontology-agent-surface` | Expected references present |
| Whitespace | `git diff --check -- goals/ontology-agent-surface explorations/ontology-agent-surface explorations/ATLAS.md` | Passes |
| Real engine/tool tests | Exact package filters recorded in phase evidence as surfaces land | Green; no fakes-only substitution |
| Live MCP slice | Scripted authenticated client session against sidecar `/mcp` | Initialize/list/call passes with bounded Oxigraph result |
| Interop | Base-prefix fingerprint fixture + ROBOT host validation | Passes; evidence archived |
| Performance | 1k/10k/100k stateless open/parse benchmark under `history/` | Results recorded; no silent cache |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at P3 close |

## Stop Conditions

- Required source files are missing, stale in a decision-invalidating way, or
  materially contradictory.
- V1 requires a stateful session repository, a second transport, OWL 2 DL
  reasoning, broad tool expansion, or another named non-goal.
- Actor identity cannot be derived meaningfully at the authenticated boundary
  before attribution wiring begins.
- The implementation requires an unapproved auth/security redesign,
  dependency or lockfile change, generated-file churn, destructive state,
  credentials, cost, or policy approval outside this spec.
- A required real-engine, live-client, CAS-conflict, or ROBOT proof cannot be
  produced; record evidence before stopping.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
