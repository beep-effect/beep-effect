# Decision Log

Dated decision log for the memory architecture standard. Records decisions as they are made so the team can trace the evolution of thinking.

---

## 2026-07-08: External Memory Stack — Donor Portfolio Confirmed; Cognee Is the Sole Dev-Memory Incumbent; Doctrine Phrasing Sharpened

**Context:** Six products (OriginTrail DKG, TrustGraph, Graphiti/Zep, Cognee,
Supermemory, Mem0) were evaluated at clone+docs depth across 12 codex research
lanes plus a GPT-5.5 Pro adversarial oracle lane; synthesis with per-claim
citations and spot-checks lives in
[`docs/agent-memory-infra/`](../../docs/agent-memory-infra/00-recommendation.md).
That run corrected several claims in this standard (see 03/05 supersession
annotations) and its drafted durable records were applied on 2026-07-11.

**Decision:**

- **(A) Product runtime:** no external memory service enters the product
  runtime's authority path or default deployment. Durable truth stays
  repo-native (claim + evidence + provenance + lifecycle in Postgres). The
  donor portfolio is ported behind `drivers/*`: Graphiti bitemporal edge
  contract, TrustGraph provenance/explainability shell, Cognee
  projection/rollback-ledger ergonomics, Mem0 ADD-only extraction discipline,
  plus Supermemory/OriginTrail minor donors.
- **(B) Dev-tooling memory:** Cognee (bounded: embedded/local or all-Postgres
  profile, never the full compose stack) is the sole always-on dev-memory
  incumbent. graphiti-memory is decommissioned only AFTER the
  `@beep/epistemic-tables` bitemporal port lands; until then it is
  read-available but no longer written to. A 2–4 week recall bakeoff gate
  applies; the fallback on failure is Layer-1 file memory alone, not a return
  to Graphiti. File memory (CLAUDE.md / MEMORY.md) remains Layer 1.
- **(C) Doctrine phrasing:** deterministic-first survives adversarial review;
  the operative rule is sharpened to **"no uncited LLM output may cross the
  authority boundary"**, with explicit review states
  (`candidate` / `machine-extracted` / `human-reviewed` / `authoritative`) and
  four separately governed memory classes (authoritative facts+quoted sources /
  derived semantic graph / operational agent state / opinions+work product).

**Rationale:** All thirteen lanes converged on the authority boundary (every
candidate stores LLM-derived content without evidence spans or acceptance
lifecycle). The Role B reversal from Graphiti to Cognee rests on the
redundancy argument (Graphiti's sole decisive differentiator — its temporal
edge model — is exactly what the repo is porting natively), first-party
degradation history, operational direction of travel, and ontology alignment.

**Consequences:**

- 03/05 in this standard carry dated supersession annotations (FalkorDB is
  SSPLv1, not OSI open-source; Supermemory "nothing to take" refuted; Mem0
  upgraded to donor; Graphiti "bi-temporal" narrowed; Cognee/OriginTrail
  entries added to 05).
- `AGENTS.md`/`CLAUDE.md` name Cognee (bounded) as the durable dev-memory;
  Graphiti demoted to read-only donor pending the port milestone.
- `.mcp.json` keeps graphiti-memory until the port lands (write-freeze only).
- `explorations/agent-memory-tiers-bitemporal-edges` receives the research
  input for its open forks (Apache-2.0 Graphiti shapes only; Postgres-native
  reaffirmed; invalidate-don't-delete; review-state enum).

---

## 2026-06-17: Reframe — Code-Intelligence Was the Learning Vehicle; Product Is the IP-Law Flywheel

**Context:** The `atlas-synthesis` exploration (2026-06-17, formerly
`baseline-synthesis`) plus a git-history archaeology pass established that the
deterministic code-intelligence / repo-memory v0 body of work was a **learning
vehicle** -- the user grounding themselves in software to learn ontology/graph/memory
architecture -- and was **deliberately pruned** (spec corpus `309649ebcc` 2026-03-08;
repo-memory hosts `apps/clawhole` + `packages/ai` `78f5d3fb0e` 2026-04-07; last UI
residue `6c8bab5b25` 2026-04-27), with this standard crystallized *after* the prune.
Yet this README's Core Thesis + Imperative #1, `01-memory-layer-taxonomy.md`,
`02-thread-triage.md`, and `docs/BEEPGRAPH_ARCHITECTURE.md` still framed code
intelligence as "the competitive edge / the diamond / Priority 1" in the present
tense. That drift would mislead future sessions into treating archived
code-intelligence work as a current priority.

**Decision:** This standard is a durable **theoretical framework**, not a
shipping-product roadmap. The deterministic-first, semantic-as-managed-cache, and
provenance-verification **principles remain binding**. The **code-intelligence
instantiation is superseded**: repo-memory v0 is archived; the live product is the
**solo IP-law firm flywheel** (`goals/agentic-professional-runtime`, prose-to-proof /
BeepGraph). The No-Escape Theorem and four-layer taxonomy now govern **law-domain**
memory. Annotate the stale passages as superseded; do not delete the theory or the
dated history.

**Rationale:** The principles are domain-independent and correct; only the "our
current moat is code intelligence" framing was time-bound to April 2026. Preserving the
analysis and dated history while adding a status-amendment banner + this entry keeps the
standard trustworthy on a cold read.

**Consequences:**

- README gains a status-amendment banner; Core Thesis + Imperatives #1/#3 reframed;
  `01-memory-layer-taxonomy.md` (L3, repo-memory, BeepGraph) and `02-thread-triage.md`
  (thread 1) annotated as superseded; `docs/BEEPGRAPH_ARCHITECTURE.md` L3 row relabeled
  "dev tooling, not a product moat."
- `explorations/effect-capability-kg` (the code-intelligence tooling track) is **parked**.
- `goals/file-processing-capability` status corrected `pending-implementation → active`
  (the capability + tika/libpff drivers are built; P1 underway). A broader
  goal-status-vocabulary normalization is a separate, **deferred** cleanup.
- The live residue (`@beep/repo-codegraph`, `EffectCapabilityKG.ts`) is retained as
  **narrow dev tooling**, not a product moat.
- The 2026-04-15 / 2026-05-12 entries below stand as dated history, unedited.

---

## 2026-05-12: Context Graph Capability Portfolio

**Context:** TrustGraph, Cognee, Graphiti/Zep, Microsoft GraphRAG, LangGraph,
Letta, mem0, LlamaIndex, Neo4j GenAI, FalkorDB, Mastra, GraphZep, and the local
TrustGraph TypeScript port were reassessed for features that could support
`ip-law-knowledge-graph`, `knowledge-workspace`,
`agentic-professional-runtime`, and the memory architecture standard. The user
clarified that "base implementation on" means feature and capability influence,
not adopting another project's runtime topology. Provenance core is the primary
selection axis, and ontology graph capability is required.

**Decision:** Adopt a capability portfolio:

1. Keep repo-native authority as the foundation: Effect services,
   schema-first claims, deterministic IDs, source spans, provenance records,
   replayable events, and rebuildable graph projections.
2. Use TrustGraph and the local TrustGraph TypeScript port as the primary
   provenance/context-graph references.
3. Use Cognee as the primary memory-control-plane and ontology-UX reference.
4. Use Graphiti/Zep and GraphZep as temporal/session-memory references.
5. Use Microsoft GraphRAG and LlamaIndex as corpus graph-derivation references.
6. Keep FalkorDB as the preferred graph projection engine.
7. Treat all LLM/embedding/GraphRAG output as candidate memory until it is
   linked to source evidence and accepted by the relevant product or policy
   boundary.

**Rationale:**

- The April 2026 memory standard remains correct that semantic memory systems
  are not durable truth foundations.
- The newer assessment still found valuable capabilities in external systems:
  TrustGraph's persistent source/retrieval traces, Cognee's DataPoint and
  ontology UX, Graphiti's validity windows and episode lineage, and
  GraphRAG-style corpus derivation.
- Choosing one external project would either import Python/service topology or
  overfit the repo to a semantic-memory architecture. A portfolio lets the repo
  port the useful parts into Effect-native boundaries.
- The professional-runtime and IP-law initiatives need provenance and ontology
  capabilities, but accepted legal/financial facts must remain evidence-backed
  and approval-gated.

**Consequences:**

- `05-context-graph-capability-assessment.md` becomes the current reference for
  context graph, ontology graph, and agent recall feature selection.
- External projects may be used as feature donors, references, or cache
  sidecars, but not as authoritative memory stores.
- Future implementation work must classify each feature as authority, candidate
  producer, semantic cache, graph projection, or agent UX before choosing a
  package home.
- Any runtime integration with a foreign service must go through repo-level
  `drivers/*` wrappers and must not own product semantics.

---

## 2026-04-15: Memory Architecture Standard Established

**Context:** After extensive exploration of agent memory systems -- including knowledge graphs (Graphiti, TrustGraph), SaaS solutions (Supermemory, Greptile, FalkorDB), research papers ("The Price of Meaning", arXiv:2603.27116), and multiple internal specs (expert-memory-big-picture, repo-codegraph-jsdoc, repo-expert-memory-local-first-v0) -- the project had accumulated too many open threads without clear prioritization. The "AI Knowledge Base" wave triggered by Andrej Karpathy's X post amplified the noise.

**Decision:** Establish a foundational memory architecture standard in `standards/memory-architecture/` that:

1. Codifies the mathematical constraints from the No-Escape Theorem as governing principles
2. Defines a four-layer memory taxonomy (long-term, short-term, procedural, relational) with concrete architectures per layer
3. Triages all open memory-related threads with clear go/no-go/pause verdicts
4. Assesses the external SaaS landscape with clear use/learn/ignore verdicts

**Rationale:**

- The No-Escape Theorem proves that semantic memory systems degrade at scale -- this is mathematical, not a bug. The project's deterministic-first approach (AST-derived code intelligence) is one of the few approaches that escapes this theorem entirely.
- The project's Graphiti deployment confirmed the theorem's predictions -- degrading effectiveness at scale.
- Too many open threads were diluting focus from the strongest asset (repo-memory v0).
- A standards document (not another spec) was needed to close doors, not open them.

**Consequences:**

- repo-memory v0 is confirmed as Priority 1. All other memory work is subordinate.
- Supermemory is dropped. Graphiti is demoted to bounded session memory.
- BeepGraph scope is narrowed to provenance/verification layers only.
- TrustGraph TS port is frozen as reference-only.
- Future memory architecture decisions must reference this standard and the No-Escape Theorem constraints.

---

## 2026-04-15: Deterministic-First as Core Competitive Advantage

**Context:** The repo-codegraph-jsdoc research compiled evidence from 29 papers showing that deterministic code graph approaches outperform semantic search for code intelligence (32.8% improvement from RepoGraph, 36.36% pass@1 from KG-CodeGen).

**Decision:** Deterministic code intelligence (AST + type-checker + JSDoc, certainty layers 1.0 and 0.85-0.95) is the project's primary competitive advantage and must be prioritized over semantic/LLM-inferred approaches.

**Rationale:** The No-Escape Theorem proves that AST-derived facts operate outside the theorem class -- they use exact symbolic records, not semantic proximity. This means deterministic code intelligence will never degrade at scale, while every semantic approach will. This is not a preference -- it is a mathematical guarantee.

**Consequences:**

- repo-memory v0's deterministic query classes are the highest-value deliverable.
- LLM-inferred knowledge (Layer 3 certainty 0.6-0.85) is supplementary, not foundational.
- Any future memory feature must first ask: "Can this be answered deterministically?" If yes, it belongs in the deterministic layer, not the semantic layer.

---

## 2026-04-15: Semantic Memory = Managed Cache, Not Source of Truth

**Context:** User experience with Graphiti confirmed the No-Escape Theorem's predictions -- semantic memory degrades as it scales. The X community's "LLM Knowledge Base" wave is building systems the paper proves will degrade.

**Decision:** All semantic memory layers (Graphiti, embeddings, LLM-inferred knowledge) are treated as managed caches with bounded lifetimes, not as sources of truth.

**Rationale:** The paper's key finding: compression via clustering (2,500 clusters) achieved b=0.163 with 92.8% accuracy -- the best Pareto point. Interference management (consolidation, pruning, temporal windowing) is required, not optional. The OpenClaw Dreaming pipeline's three-phase consolidation model is the most thoughtful approach in the landscape.

**Consequences:**

- Graphiti may only be used for session-scoped memory with temporal bounds.
- A consolidation pipeline (inspired by OpenClaw Dreaming) is required before expanding semantic memory scope.
- Provenance verification (from TrustGraph/BeepGraph) is required for any semantic fact promoted to durable storage.
- No semantic memory system is deployed without monitoring for competitor density and retrieval degradation.

---

_Future decisions should be appended above this line in the same format._
