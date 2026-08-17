# 02 -- Thread Triage

Every open memory-related thread in this project gets a verdict here. The goal
is not to preserve optionality. The goal is to destroy it. Eight threads became
two priorities and a clear "leave it alone" for everything else.

Definitions:

- **GO** -- Active build work. Has a priority rank.
- **PAUSE** -- Not abandoned, but no investment until a GO thread demands it.
- **DROP** -- Disable, remove, stop thinking about it.
- **LEARN-ONLY** -- Research artifact. Read it when relevant, never build from it directly.

---

## 1. repo-memory v0

> **Superseded (2026-06-17).** This thread's GO / Priority-1 verdict and "ship it"
> next-action are historical. repo-memory v0 was a learning vehicle and is archived;
> the active priority is the IP-law flywheel. The deterministic-first *principle* below
> remains valid (see `README.md` status amendment); the verdict is retained as dated
> context.

**Location:** archived pre-automation repo-memory packet and packages on
`archive/pre-repo-architecture-automation-2026-04-27`

**Status:** Substantially built. Tauri v2 desktop app, Effect runtime on
`effect/unstable/cluster`, ts-morph deterministic indexing, 15+ query classes,
durable workflows with interrupt/resume, grounded retrieval with citations.
Remaining P0 gaps: RunProjector extraction seams, projection bootstrap/cursor
ownership, query-preparation acceptance surface.

**Verdict:** GO -- Priority 1

**Rationale:** Deterministic code intelligence operates outside the No-Escape
Theorem. It does not degrade at scale. It cannot. AST extraction, type
resolution, and dependency graphs produce facts at certainty=1.0 -- no
semantic proximity, no interference, no forgetting curve. As a *principle* this
is the durable lesson of the memory work. _(2026-06-17: framing deterministic
code intelligence as "the project's core competitive advantage" is superseded --
that instantiation was a learning vehicle, now archived; the product moat is the
IP-law flywheel. The principle now anchors the product's exact authority records.)_

**Next action:** Close the remaining P0 gaps. Ship it.

---

## 2. Expert Memory Big Picture

**Location:** archived pre-automation expert-memory packet on
`archive/pre-repo-architecture-automation-2026-04-27`

**Status:** Thorough architectural thesis across kernel, control plane,
claims/evidence, representation layers, ontology, temporal modeling, domain
transfer. The older `knowledge` slice validated key ideas in practice:
MentionRecords, RelationEvidence, CitationValidation, ReasoningTraces,
ProvenanceEmission. The ClaimRecord abstraction is well-defined but not yet
implemented.

**Verdict:** GO -- Priority 2 (architecture reference, not active build)

**Rationale:** The architecture already contains the escape routes the theorem
demands: deterministic substrate, claims with evidence, provenance, symbolic
verification. But the spec's own recommendation is correct -- artifact-to-packet
first, full ClaimRecord later. The big picture is the map, not the road. Do not
start building the ClaimRecord kernel until repo-memory v0 has shipped and
validated the simpler path.

**Next action:** Use as architecture reference. Do NOT implement ClaimRecord
until repo-memory v0 ships and validates artifact-to-packet.

---

## 3. TrustGraph TypeScript Port

**Location:** the machine-local TrustGraph TypeScript port (`ts/`; upstream Python project: https://github.com/trustgraph-ai/trustgraph)

**Status:** Complete, deployable port. All Python services reimplemented in
imperative TypeScript. Microservices over NATS JetStream, FalkorDB + Qdrant
backends, full Docker Compose with observability stack, working React workbench
UI. Six packages (base, flow, client, cli, mcp, workbench).

**Verdict:** PAUSE

**Rationale:** This is a working proof of architecture, but it is imperative
TypeScript with no Effect patterns. Its value is as a reference for future
Effect-native provenance work -- it proves the design works. Running it in
production adds operational complexity (20+ Docker services) that is not
justified while repo-memory v0 is the priority. The provenance and trust-scoring
concepts are valuable, but they should enter the project through slice-owned
work, not through deploying this standalone.

**Next action:** None. Keep as reference. Do not invest further.

---

## 4. Graphiti MCP (Shared Memory)

**Location:** Configured in `.mcp.json`, backed by FalkorDB, managed via
`bun run beep graphiti proxy`

**Status:** Running. Shared between Claude Code and Codex. Extensive bootstrap
protocol and query catalog documented. User reports it has become less effective
as the knowledge graph has grown -- degradation at scale.

**Verdict:** PAUSE

**Rationale:** The user's experience is exactly what the No-Escape Theorem
predicts. Graphiti uses embedding-based edge construction (cosine > 0.7) which
inherits the full geometric vulnerability. The paper measured graph memory at
b=0.478 forgetting and FA=0.208 false recall. As the graph grows, interference
increases, retrieval quality degrades. This is not a bug to fix. It is a
mathematical consequence of the architecture.

Graphiti is not suitable as a long-term knowledge store. It can work as Layer 2
(short-term/session memory) if temporal windows are enforced, old data is pruned
aggressively, and a consolidation pipeline promotes high-signal facts to Layer 1.
Without those constraints, it is actively degrading.

**Next action:** Either implement temporal pruning and session-scoping, or
disable until a consolidation pipeline exists. Stop adding unbounded knowledge.

---

## 5. Supermemory

**Location:** Configured as Claude plugin in `.claude/settings.json`

**Status:** Authentication keeps timing out. Enabled but unreliable.

**Verdict:** DROP

**Rationale:** A third memory backend in an already-fragmented landscape
increases cognitive load without clear benefit. Supermemory's "auto-evolving
knowledge graph" operates inside the No-Escape Theorem and will degrade at
scale. Its connector ecosystem is immature. The project already has Graphiti for
semantic memory and file-based memory for durable knowledge. A system that
cannot maintain authentication is noise, not signal.

**Next action:** Disable the plugin. Remove from settings.

---

## 6. TrustGraph MCP (External Sync)

**Location:** Configured in `.mcp.json`, tracks 45+ synced documents

**Status:** Running against external server
(`dankserver.tailc7c348.ts.net:8444`).

**Verdict:** PAUSE

**Rationale:** This is the external TrustGraph deployment, separate from the TS
port. Its value depends on whether the provenance/trust features are providing
retrieval signal. If a local provenance layer ships, this external dependency
should be evaluated for retirement.

**Next action:** Audit whether the synced documents are providing value. If not,
disable to reduce operational surface.

---

## 7. Karpathy-Style LLM Wiki

**Location:** N/A (concept only, not implemented)

**Status:** Not implemented. The concept: LLM compiles raw sources into a
markdown wiki, iteratively enhances it, uses the wiki for Q&A.

**Verdict:** LEARN-ONLY

**Rationale:** The concept is inside the No-Escape Theorem for its semantic
retrieval layer, and the community building it will hit the interference wall.
But three ideas are worth extracting: (a) LLM-assisted health checks / linting
over curated knowledge (useful for Layer 1 maintenance), (b) the principle that
outputs should "add up" in a knowledge base (useful for consolidation pipeline
design), (c) the separation between raw sources and compiled wiki mirrors the
episodic-to-durable promotion pattern in Layer 2 to Layer 1. Do not implement as
a standalone system. Cherry-pick the consolidation ideas.

**Next action:** None. Extract consolidation patterns when designing the
Layer 2 to Layer 1 promotion pipeline.

---

## 8. repo-codegraph-jsdoc Research

**Location:** `goals/repo-codegraph-jsdoc/history/outputs/compiled_sources/`

**Status:** Pure research compilation -- 29 papers/reports synthesized.
Validates the deterministic-first approach with evidence (32.8% improvement from
RepoGraph, 36.36% pass@1 from KG-CodeGen). No code written from this research
directly.

**Verdict:** LEARN-ONLY

**Rationale:** This research is the evidentiary foundation for repo-memory v0's
approach. Its key insights -- three-tier certainty model, JSDoc as structured
semantic surface, property graphs over RDF for code, ts-morph as primary
extractor -- are already baked into the v0 design. The research has been
absorbed. No further action on the research itself.

**Next action:** None. Reference when making repo-memory v0 architecture
decisions.

---

## Summary

| # | Thread | Verdict | Priority | Layer Served |
|---|---|---|---|---|
| 1 | repo-memory v0 | **GO** | P1 | Layer 3 (Procedural) |
| 2 | Expert Memory Big Picture | **GO** (ref) | P2 | All layers (architecture) |
| 3 | TrustGraph TS Port | **PAUSE** | -- | Reference only |
| 4 | Graphiti MCP | **PAUSE** | -- | Layer 2 (if bounded) |
| 5 | Supermemory | **DROP** | -- | -- |
| 6 | TrustGraph MCP | **PAUSE** | -- | Evaluate later |
| 7 | Karpathy LLM Wiki | **LEARN-ONLY** | -- | Consolidation patterns |
| 8 | repo-codegraph research | **LEARN-ONLY** | -- | Already absorbed |

Two threads get investment. Three are paused pending demand. One is dropped.
Two are research artifacts. The search space is closed.
