# 03 — SaaS Landscape Assessment

> Condensed evaluations of every external agent memory solution the project has assessed.
> Verdicts are final: USE, LEARN, or IGNORE.

---

## Graphiti / Zep

**Category:** Temporal Knowledge Graph

**Architecture:** Four primitives — Entities (nodes with evolving summaries), Facts (edges as triplets with temporal validity windows), Episodes (raw ingested data for provenance), Custom Types (ontology). Hybrid retrieval: semantic + BM25 + graph traversal. Backed by Neo4j, FalkorDB, Kuzu, or Neptune.

**Theorem status:** INSIDE. Embedding-based edge construction inherits geometric vulnerability. The paper measured graph memory at b=0.478 forgetting.

**Strengths:** Bi-temporal fact tracking with auto-invalidation. Full provenance from facts to source episodes. Sub-second retrieval without LLM-in-the-loop. Supports both prescribed and emergent ontologies.

**Weaknesses:** Degrades at scale (confirmed by user experience). Operationally heavy. Rate-limiting constraints.

**Verdict:** LEARN — The temporal model is the insight.

**What to take:** Bi-temporal validity windows and auto-invalidation are the right primitives for managing Layer 2 (session memory). The four-primitive model (Entity, Fact, Episode, CustomType) is a clean abstraction. The specific implementation will degrade, but the temporal management pattern should be adopted.

> **Narrowed (2026-07-08):** "bi-temporal" overstates it — Graphiti provides
> valid-time fields plus system timestamps plus episode lineage, not a
> transaction ledger with claim lifecycle. Deployment status: retiring to
> donor after the `@beep/epistemic-tables` bitemporal port lands
> (write-freeze until then). See 05's Graphiti note and
> `docs/agent-memory-infra/graphiti-clone.md`.

---

## Supermemory

**Category:** Managed Memory API

**Architecture:** Knowledge-graph-native storage with auto-evolution. Documents chunked, embedded, organized into container tags. Unified ingestion pipeline. SDKs for 15+ frameworks.

**Theorem status:** INSIDE. Auto-evolving knowledge graph with embedding-based retrieval.

**Strengths:** Broadest connector ecosystem. Low-latency recall.

**Weaknesses:** Opaque internals. Connector maturity is uneven (GitHub is the only fully supported provider). No scaling guarantees. Auth reliability issues in this project.

**Verdict:** IGNORE

**What to take:** Nothing. The connector ecosystem is immature and the architectural internals are opaque. The project has no need for another degrading memory backend with reliability issues.

> **Superseded in part (2026-07-08):** "nothing to take" is refuted — the
> document/chunk/memory schema split, `updates`/`extends`/`derives` version
> relations, container-tag namespace isolation, and retrieval-mode split are
> real, source-observed donor patterns. IGNORE **as foundation** is confirmed
> (engine opaque, hosted-API-backed). See the Supermemory entry added to 05.

---

## TrustGraph

**Category:** Explainable Knowledge Platform

**Architecture:** Four-layer storage: graph store (relationships), vector store (embeddings), row store (structured records), object store (unstructured content). Combines Graph RAG and Document RAG. Provenance-traced retrieval. Docker/K8s deployment with GPU support.

**Theorem status:** PARTIALLY OUTSIDE. The provenance tracing and trust scoring provide the "external symbolic verifier" escape route the No-Escape Theorem identifies. The semantic retrieval layer is still inside the theorem, but provenance verification can catch false recall.

**Strengths:** Strongest explainability story — traces every answer to source provenance. Multi-store architecture handles structured, unstructured, and semantic queries. Trust/reputation scoring adds a quality signal that most systems lack.

**Weaknesses:** Operationally complex (20+ containers). Documentation thin on performance and failure recovery. Smaller community.

**Verdict:** LEARN + BUILD (via BeepGraph)

**What to take:** The provenance tracing architecture is the key differentiator. Trust scoring provides a mechanism for interference management that goes beyond simple temporal pruning. The multi-store architecture (graph + vector + row + object) is the right decomposition. Don't deploy TrustGraph itself — implement these concepts in BeepGraph with Effect-native patterns.

---

## FalkorDB

**Category:** Graph Database Engine

**Architecture:** Property-graph model with Cypher query language. In-memory C/Rust engine with AVX-accelerated sparse adjacency matrices. Native multi-tenancy. Fuses vector similarity with graph traversal. Sub-10ms query latency.

**Theorem status:** N/A — it's an engine, not a memory system. The theorem applies to whatever you build on top of it.

**Strengths:** Raw performance (claimed 496x faster than Neo4j). Open-source. Vector+graph hybrid queries. Linear horizontal scaling.

**Weaknesses:** You build the memory layer yourself. In-memory design constrains dataset size. Smaller ecosystem than Neo4j.

**Verdict:** USE — Already chosen as the graph engine.

**What to take:** Already selected for repo-memory v0 and BeepGraph. The right choice for local-first deployment. Continue using it. The performance characteristics make interference management strategies (compression, clustering, pruning) practical at interactive latency.

> **Superseded in part (2026-07-08):** calling FalkorDB "open-source" is wrong
> for shipping decisions — it is **SSPLv1, non-OSI** (live LICENSE.txt fetch,
> confirmed by two lanes). USE survives only for local projection/read-model
> roles with the license accepted consciously; anything shipped must pick a
> gate-passing backend. See `docs/agent-memory-infra/00-recommendation.md`.

---

## Greptile

**Category:** Codebase Intelligence (Code Review)

**Architecture:** Full codebase graph capturing function relationships, dependencies, patterns. PR diffs analyzed against the graph. Three-tier configuration. Self-hosted or SaaS.

**Theorem status:** PARTIALLY OUTSIDE for structural queries (call chains, dependency analysis are deterministic). Inside for semantic "understanding" features.

**Strengths:** Genuine codebase-graph context (not just file-level RAG). Learning loop via feedback.

**Weaknesses:** Scoped exclusively to code review. Not a general memory system.

**Verdict:** LEARN — Validates the deterministic code graph approach.

**What to take:** Greptile's success with codebase graphs validates the same approach repo-memory v0 is taking. The learning loop via feedback is interesting for future iterations. The three-tier configuration (directory-scoped cascading rules) is a UX pattern worth noting.

---

## Claude Code Memory

**Category:** File-Based Hierarchical Instructions

**Architecture:** CLAUDE.md files in hierarchy (managed policy > project > user > local). Path-scoped rules load conditionally. Auto-memory in ~/.claude/projects/. 200-line index loaded at startup.

**Theorem status:** OUTSIDE. Plain files, always loaded, no semantic search.

**Strengths:** Zero infrastructure. Hierarchical scoping. Human-editable. Version-controllable.

**Weaknesses:** No semantic search. 200-line/25KB cap. No cross-machine sync. Soft guidance (can be ignored).

**Verdict:** USE — Already the Layer 1 implementation.

**What to take:** This IS the project's Layer 1 (long-term memory) implementation. The hierarchical scoping pattern (org > project > user > local) is well-designed. The key limitation — no semantic search — is actually a STRENGTH per the No-Escape Theorem. Keep using it for durable, curated knowledge.

---

## OpenClaw Memory

**Category:** Markdown-First Agent Memory

**Architecture:** Three file types: MEMORY.md (durable), daily notes (ephemeral), DREAMS.md (consolidation). Hybrid search (semantic + keyword). Pluggable backends (SQLite, QMD, Honcho). Optional Memory Wiki layer for structured claims.

**Theorem status:** INSIDE for semantic retrieval. The durable MEMORY.md layer is outside (file-based, always loaded).

**Strengths:** Transparent (inspectable plain text). Hybrid search. Pre-compaction flush prevents context loss.

**Weaknesses:** No conflict resolution without Wiki layer. Plain markdown scaling limits.

**Verdict:** LEARN — The two-tier separation is the insight.

**What to take:** The separation between MEMORY.md (durable, always loaded) and daily notes (ephemeral, auto-loaded for recent days) maps cleanly to Layer 1 vs Layer 2. The pre-compaction flush is a clever safety mechanism. The Memory Wiki (structured claims with provenance) echoes the expert-memory ClaimRecord idea — validate independently.

---

## OpenClaw Dreaming

**Category:** Offline Memory Consolidation

**Architecture:** Three sequential phases via cron: Light (ingest + deduplicate + stage), Deep (weighted scoring against 6 signals + promote winners to MEMORY.md), REM (thematic patterns, never writes to permanent). Only deep phase touches durable memory.

**Theorem status:** OUTSIDE — it's a consolidation pipeline, not a retrieval system. It manages interference rather than being subject to it.

**Strengths:** Explainable weighted scoring. Multi-signal consolidation. Clean phase separation. Sensitive data redaction.

**Weaknesses:** Experimental. No real-time promotion. Hardcoded weights not tunable. Dream Diary excluded from promotion.

**Verdict:** LEARN — The consolidation architecture is highly valuable.

**What to take:** This is the most thoughtful consolidation pipeline in the landscape. The three-phase model (ingest, score, reflect) with the constraint that only one phase writes to permanent memory is exactly what the No-Escape Theorem prescribes for managing interference. The six-signal weighted scoring (relevance 0.30, frequency 0.24, query diversity 0.15, recency 0.15, consolidation 0.10, conceptual richness 0.06) is a concrete starting point for the Layer 2 to Layer 1 promotion pipeline. Adapt the architecture, tune the weights for this project's needs.

---

## Comparison Matrix

| Solution | Category | Theorem Status | Verdict | Key Takeaway |
|---|---|---|---|---|
| Graphiti/Zep | Temporal KG | Inside | LEARN | Bi-temporal model |
| Supermemory | Managed API | Inside | IGNORE | Nothing |
| TrustGraph | Explainable KG | Partially outside | LEARN+BUILD | Provenance + trust scoring |
| FalkorDB | Graph Engine | N/A (engine) | USE | Already chosen |
| Greptile | Code Intelligence | Partially outside | LEARN | Validates deterministic approach |
| Claude Code | File-Based | Outside | USE | Layer 1 implementation |
| OpenClaw Memory | Markdown-First | Mixed | LEARN | Two-tier separation |
| OpenClaw Dreaming | Consolidation | Outside | LEARN | Three-phase promotion pipeline |

---

## What the Landscape Tells Us

The highest-value insights cluster around two themes:

1. **Temporal management and consolidation** (Graphiti's bi-temporal model, OpenClaw's Dreaming pipeline) — these are the interference management strategies the No-Escape Theorem says are required.
2. **Provenance and verification** (TrustGraph's explainability, the ClaimRecord model) — these provide the "external symbolic verifier" escape route.

Everything else is either already in use (FalkorDB, Claude Code memory), already absorbed (Greptile's validation of deterministic code graphs), or noise (Supermemory).
