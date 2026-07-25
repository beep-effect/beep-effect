# Memory Layer Taxonomy

This document defines the four memory layers required by the project's agent memory architecture, maps each to its mathematical constraints from the No-Escape Theorem, and specifies the concrete architecture for each.

---

## Layer 1: Long-Term Memory (Durable Knowledge)

**What it stores:** Project goals, user principles, domain rules, architectural decisions, coding standards. Things that are true for months or years.

**Architecture:** File-based curated documents and a deterministic graph.

- Claude Code MEMORY.md / CLAUDE.md style -- always loaded, never searched semantically.
- The expert-memory ClaimRecord model for structured assertions with evidence and provenance.
- Human-authored and human-curated. The LLM does not write to this layer autonomously.

**Theorem status:** OUTSIDE -- these are exact records, not semantic retrievals. No degradation.

**What gets it right:** Claude Code's hierarchical MEMORY.md (zero infrastructure, transparent, version-controlled). OpenClaw's separation of MEMORY.md (durable) from daily notes (ephemeral).

**What gets it wrong:** Supermemory and similar tools that dump everything into an "auto-evolving knowledge graph" -- the paper proves this degrades.

**Concrete implementation:** `standards/` directory documents, `CLAUDE.md`, project-level memory files. The expert-memory-big-picture ClaimRecord system when it matures -- but artifact-to-packet first.

**Consolidation strategy:** Manual curation with periodic LLM-assisted "health checks" (Karpathy's linting idea is sound here -- use LLMs to find inconsistencies in curated knowledge, but humans approve changes).

---

## Layer 2: Short-Term / Session Memory (Ephemeral Context)

**What it stores:** What the user worked on today, recent conversation context, in-progress decisions, current task state.

**Architecture:** Episodic log with temporal windowing and aggressive consolidation.

- Graphiti's bi-temporal model has the right shape: facts with validity windows, auto-invalidation.
- BUT: must implement interference management -- this layer WILL degrade if left unmanaged.

**Split (2026-07-25, academia corpus dispatch):** this layer is two stores, not one:

- **Exact episodic records** -- append-only, immutable session/event records. OUTSIDE the theorem (exact records, no semantic retrieval); pruned only by explicit retention policy, never to manage interference.
- **Prunable semantic/session projections** -- consolidated, clustered, compressed views derived from those records. INSIDE the theorem; every pruning, windowing, and compression lever below applies to these projections. They stay rebuildable only while their source records are retained; when retention policy removes source records, dependent projections must expire with them rather than persist as memory whose provenance no longer exists.

"Old sessions drop off" means the projections drop off; the exact records that produced them are governed by retention policy alone. Evidence: the memory-bitemporal cluster of `explorations/academia-corpus-mining` ([`research/t3-memory-bitemporal.md`](../../explorations/academia-corpus-mining/research/t3-memory-bitemporal.md)) and the dispatch note in `goals/epistemic-bitemporal-edge-core/research/`.

**Theorem status:** INSIDE for semantic retrieval (the projection store), but manageable through:

- Aggressive temporal pruning (old session projections drop off; the exact episodic records follow retention policy).
- Competitor density management (don't let the graph grow unbounded).
- Compression via clustering (the paper's best Pareto point: ~2,500 clusters).

**What gets it right:** OpenClaw Dreaming's 3-phase consolidation -- light (ingest + deduplicate), deep (weighted scoring + promote to durable), REM (pattern extraction, never writes to permanent). Only the deep phase touches permanent memory.

**What gets it wrong:** Naive Graphiti usage where everything is stored forever and the graph grows without bounds. This is exactly what the user experienced -- degradation at scale.

**Concrete implementation:** Graphiti is acceptable HERE (not for long-term) IF:

1. Graphiti holds only the projection store, never the exact episodic records.
2. Temporal windows are enforced (projection entries older than N days are pruned or compressed; exact records are governed by retention policy, not interference management).
3. A consolidation pipeline promotes high-signal facts to Layer 1 (durable).
4. Competitor density is monitored.
5. The graph is periodically compressed (clustering).

**Consolidation strategy:** Automated with human-in-the-loop for promotion to Layer 1. OpenClaw's six-signal weighted scoring is a good starting model: relevance (0.30), frequency (0.24), query diversity (0.15), recency (0.15), consolidation (0.10), conceptual richness (0.06).

---

## Layer 3: Procedural Memory (How To Do Things)

**What it stores:** How to use APIs, how to call functions, what parameters are required, what errors can occur, code patterns and their usage.

**Architecture:** Deterministic code graph and grounded retrieval.

- AST-derived knowledge via ts-morph (Layer 1 certainty = 1.0).
- JSDoc as structured semantic surface (deterministic metadata, not raw text).
- Type-checker derived relationships (Layer 2 certainty = 0.85-0.95).
- 15+ query classes: describeSymbol, symbolParams, symbolReturns, symbolThrows, listFileExports, listFileImports, listFileImporters, listSymbolImporters, listFileDependencies, listFileDependents, keywordSearch, etc.

**Theorem status:** OUTSIDE -- these are symbolic lookups against deterministic data. They do not degrade.

**This deterministic property is the durable lesson** -- the transferable principle: route every query to the highest-certainty, non-semantic layer. _(2026-06-17: the project's original code-intelligence instantiation was a learning vehicle, now archived; it is **not** the current product moat — that is the IP-law flywheel.)_ While every semantic memory system operates inside the theorem class and degrades at scale, procedural memory via deterministic code intelligence is mathematically immune. "How do I use this API?" is answerable from AST + JSDoc + type signatures without any semantic search -- and the same principle now anchors the IP-law product's exact authority records (source spans + accepted claims).

**What gets it right:** Greptile's codebase graph approach (function relationships, dependencies, patterns). The repo-codegraph-jsdoc research's three-tier certainty model.

**What gets it wrong:** Any approach that embeds code into vectors and searches semantically. The paper proves this will degrade. Code has deterministic structure -- use it.

**Concrete implementation (historical):** repo-memory v0 (Tauri desktop app, Effect runtime, ts-morph indexing, deterministic retrieval with citations, 15 query classes, durable workflows) was the learning vehicle and is **archived** (`archive/pre-repo-architecture-automation-2026-04-27`; see `90-archaeology-pruned-repo-intel.md` in `explorations/atlas-synthesis/`). The live residue is **narrow dev tooling** (`@beep/repo-codegraph`, `EffectCapabilityKG.ts`), not a product moat.

**Consolidation strategy:** Not needed -- deterministic data doesn't degrade. Re-index when code changes.

---

## Layer 4: Relational / Conceptual Memory (How Things Connect)

**What it stores:** Relationships between concepts, cross-domain connections, architectural patterns, how subsystems interact, why decisions were made in relation to each other.

**Architecture:** Managed semantic graph with provenance verification.

- TrustGraph/BeepGraph territory -- this is where semantic knowledge lives.
- Provenance tracing is CRITICAL because it provides the "external symbolic verifier" escape route.
- Trust scoring gives a quality signal for managing interference.

**Theorem status:** INSIDE -- this will degrade. The engineering question is not "how to prevent degradation" but "how to manage where we sit on the interference-fidelity frontier."

**Key constraints from the paper:**

- Compression is the most practical lever (clustering).
- False recall is more fundamental than forgetting -- must be treated as first-class failure mode.
- Hybrid retrieval (semantic + keyword + exact) can navigate the frontier even though no single component escapes.
- Reasoning overlays convert graceful degradation into brittle phase transitions -- don't add LLM reasoning on top of semantic retrieval without monitoring competitor density.

**What gets it right:** TrustGraph's multi-store architecture (graph + vector + row + object stores) with provenance tracing. Graphiti's bi-temporal fact tracking with auto-invalidation. FalkorDB's raw performance for graph+vector hybrid queries.

**Concrete implementation:** BeepGraph is **specced, not shipped** -- see [`../../docs/BEEPGRAPH_ARCHITECTURE.md`](../../docs/BEEPGRAPH_ARCHITECTURE.md) (the spine exemplar is _effect-ontology_, not a raw TrustGraph rewrite; TrustGraph contributes the projection **shell**). The **authority spine** is largely built (`@beep/epistemic-domain`, `@beep/semantic-web` PROV-O + bounded SHACL, `@beep/rdf`); the projection/retrieval shell and the extraction kernel are the net-new work. Port what enables verification and trust scoring.

**Consolidation strategy:** Automated compression with provenance-based verification. Facts without traceable provenance should decay faster. Trust scores should weight consolidation decisions.

---

## How the Layers Compose

```text
+---------------------------------------------------+
|  Layer 1: Long-Term (Durable)                     |
|  Curated assertions, project standards            |
|  OUTSIDE theorem -- never degrades                |
+---------------------------------------------------+
|  Layer 3: Procedural (Code Intelligence)          |
|  AST, types, JSDoc -- deterministic lookups       |
|  OUTSIDE theorem -- never degrades                |
+---------------------------------------------------+
|  Layer 4: Relational (Conceptual Connections)     |
|  Semantic graph with provenance verification      |
|  INSIDE theorem -- managed degradation            |
+---------------------------------------------------+
|  Layer 2: Short-Term (Session/Ephemeral)          |
|  Exact episodic records -- OUTSIDE (retention)    |
|  Semantic projections -- INSIDE (consolidation)   |
+---------------------------------------------------+

Promotion flow: Layer 2 --> (consolidation) --> Layer 1 or Layer 4
Verification flow: Layer 4 --> (provenance check) --> Layer 3 or Layer 1
Query routing: Route to the highest-certainty layer that can answer
```

### Query Routing Principle

Always route queries to the highest-certainty layer that can answer them. "What does this function return?" goes to Layer 3 (deterministic). "What has the user been working on?" goes to Layer 2 (session). "How do these subsystems relate?" goes to Layer 4 (semantic, verified against Layer 3). "What are the project's architectural principles?" goes to Layer 1 (curated).

The worst failure mode is routing a query to a lower-certainty layer when a higher-certainty layer could answer it. This is where most agent memory systems fail -- they route everything through semantic search when deterministic lookups would be both faster and immune to degradation.
