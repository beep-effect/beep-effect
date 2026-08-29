# Memory Architecture Standard

> **Status amendment (2026-06-17) — read first.** This standard is a durable
> *theoretical framework*. Its April-2026 framing of **deterministic code
> intelligence / repo-memory v0 as "the competitive edge / the diamond / Priority 1"**
> is **superseded**: repo-memory v0 was a *learning vehicle* and is **archived**
> (`archive/pre-repo-architecture-automation-2026-04-27`; the git-dated prune is traced in
> `explorations/atlas-synthesis/synthesis/90-archaeology-pruned-repo-intel.md`). The
> **product** is the solo IP-law firm flywheel (`goals/agentic-professional-runtime`,
> prose-to-proof). The No-Escape Theorem and the four-layer taxonomy now govern
> **law-domain** memory; the *principles* — exact/deterministic records as authority,
> semantic layers as managed caches, provenance verification — remain **binding**, but
> the code-intelligence *instantiation* does not. See the 2026-06-17 entry in
> [`04-decision-log.md`](./04-decision-log.md).

This is a foundational architectural standard for this monorepo, alongside `effect-first-development.md` and `effect-laws-v1.md`. It governs all memory-related design, implementation, and evaluation work. It is not another exploration. It is a decision record that constrains and directs. If a proposed memory feature contradicts this document, the proposal must change or this document must be formally amended.

## Core Thesis

Different memory problems require different architectures, and mathematical constraints govern which approaches can work at scale. The No-Escape Theorem (from "The Price of Meaning: Why Every Semantic Memory System Forgets", arXiv:2603.27116) proves that any system organizing information by conceptual relatedness will degrade as it scales. Interference, forgetting, and false recall are mathematical consequences of finite-dimensional semantic spaces, not implementation bugs to be fixed with better embeddings or smarter retrieval. The only escape routes are: (a) exact episodic or symbolic records that do not rely on semantic proximity, (b) external symbolic verifiers that can detect and correct drift, or (c) infinite effective dimensionality, which is impossible in practice.

This means a **deterministic-first** approach -- exact records (source spans, accepted claims, AST facts) stored at certainty=1.0, provenance-tracked, schema-validated -- is mathematically immune to the degradation that plagues every semantic memory system. Every SaaS vendor, every embedding-based knowledge graph, every LLM-inferred fact store will hit the interference wall. Deterministic, exact-record authority will not. **This principle is the durable lesson** -- the project's original code-intelligence instantiation was a learning vehicle (now archived); the principle now governs the IP-law product's authority/projection/cache split (see [`../../docs/BEEPGRAPH_ARCHITECTURE.md`](../../docs/BEEPGRAPH_ARCHITECTURE.md)).

The practical consequence: stop evaluating semantic memory products as potential foundations. They are useful as managed caches over a deterministic substrate, never as sources of truth. The search for semantic-memory foundations is over. A later addendum may still evaluate external systems as capability donors when the output preserves this authority boundary.

## The Three Imperatives

### 1. Finish repo-memory v0 — SUPERSEDED (2026-06-17)

_Historical (April 2026): repo-memory v0 (deterministic code intelligence) was framed as Priority 1, "the diamond." It was a **learning vehicle** and is now **archived** (see the status amendment above and `04-decision-log.md`). The active priority is the **IP-law flywheel**, not repo-memory v0._

The durable lesson survives: deterministic code intelligence (AST extraction, type resolution, dependency graphs, call-site analysis) escapes the No-Escape Theorem entirely -- exact records, no semantic drift, no interference, no graceful degradation into hallucination. Apply that *principle* to the product's authority records (source spans, accepted claims) -- not to reviving repo-memory v0.

### 2. Treat semantic layers as managed caches, not sources of truth

Graphiti, vector embeddings, LLM-inferred knowledge graphs, and conversational memory will degrade. The theorem guarantees it. This does not make them useless -- it makes them caches. Design them with explicit interference management: consolidation windows, provenance-gated pruning, TTL-based compression, and hard ceiling policies on node/edge counts. Budget for degradation management, not elimination. Every semantic fact must trace back to a deterministic source or carry an explicit uncertainty marker.

### 3. Port only the provenance/verification kernel from TrustGraph/BeepGraph

The provenance and verification layers in TrustGraph provide the "external symbolic verifier" escape route the paper identifies. They are valuable. But TrustGraph is 15+ services, and porting all of them is a multi-quarter distraction. Port the provenance model, the verification primitives, and the graph storage layer.

_(2026-06-17: the original "until repo-memory v0 is running" gate is superseded -- repo-memory v0 is archived. The live target is **BeepGraph for the IP-law product**: an effect-ontology-style authority spine + a TrustGraph-style projection shell -- see [`../../docs/BEEPGRAPH_ARCHITECTURE.md`](../../docs/BEEPGRAPH_ARCHITECTURE.md). Leave the rest until that loop runs and the next bottleneck is identified.)_

## Document Index

| Document | Purpose |
|---|---|
| `00-no-escape-theorem.md` | Mathematical constraints that govern all memory architecture decisions |
| `01-memory-layer-taxonomy.md` | Four memory layers, their escape routes, and concrete architectures |
| `02-thread-triage.md` | Go/no-go decisions on every open memory-related thread |
| `03-saas-landscape-assessment.md` | Condensed evaluations of external solutions (closed, not ongoing) |
| `04-decision-log.md` | Dated decision entries as the architecture evolves |
| `05-context-graph-capability-assessment.md` | Bounded addendum selecting feature donors for provenance, ontology graphs, context graphs, and agent recall UX |
| `06-agent-memory-operations.md` | Operational runbook implementing 04's dev-memory decision: provisioning envelope, recall routing, session continuity |
| `07-shared-memory-adoption.md` | Adopted 2026-08-06 memory plane: basic-memory as the shared cross-agent store, codegraph as the code KG, store conventions, wiring, and the Cognee role retirement |

## Relationship to Other Standards

| Standard | Relationship |
|---|---|
| `standards/effect-first-development.md` | Effect patterns govern all memory service implementation |
| `standards/effect-laws-v1.md` | Effect laws constrain all memory service code |
| `goals/canonical-slice-factory/` | Current architecture automation path; the pre-automation memory packets live only in git history and the archive branch |

## Anti-Goals

- This is **not** another SaaS foundation evaluation. The landscape is assessed in `03-saas-landscape-assessment.md` and that assessment is closed for foundation decisions. `05-context-graph-capability-assessment.md` is a bounded capability-donor addendum, not permission to make semantic memory authoritative.
- This is **not** a research compilation. The relevant research is distilled into `00-no-escape-theorem.md` and the thesis above.
- This is **not** a "someday maybe" exploration. Every section contains closed decisions or explicit next actions.
- This **is** a set of closed decisions that reduce the search space so building can begin.
