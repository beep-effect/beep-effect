# BeepGraph Architecture — effect-ontology vs TrustGraph, and the synthesis

> **Type**: Architecture decision (decision-grade synthesis)
> **Status**: Proposed — sharpens the 2026-05-12 "Context Graph Capability Portfolio" decision
> **Date**: 2026-06-15
> **Supersedes**: the "BeepGraph (Effect-native TrustGraph rewrite)" framing in
> `standards/memory-architecture/01-memory-layer-taxonomy.md:105`
> **Evidence base**: external research notes — the effect-ontology TrustGraph
> comparison study (maintained outside this repository; not tracked here)

---

## 1. Executive verdict

**For beep-effect's knowledge-graph / ontology spine, adopt the *effect-ontology*-style
architecture as the AUTHORITY SPINE, wrapped by a *TrustGraph*-style PROJECTION + RETRIEVAL
shell. The synthesis is named *BeepGraph*.**

- **effect-ontology (EO) wins the spine** — Effect-native, schema-first *typed* authority,
  ontology-*guided* extraction, evidence/provenance, monoid-fold merge, SHACL validation, a
  single durable in-repo app. That is beep-effect's DNA. TrustGraph is schema-light Python
  pub/sub microservices over external graph DBs — the opposite of local-first typed authority.
- **TrustGraph (TG) wins the shell** — pluggable graph **projection** (FalkorDB/Cypher),
  **GraphRAG** subgraph retrieval + **explainability DAG**, graph-vs-document embeddings,
  portable **Knowledge Cores**, and the **Librarian** curated-doc/processing-queue. EO has no
  external store (in-memory N3 only) and a thinner retrieval/packaging story; TG fills exactly
  that gap.
- **One-liner:** *EO is the spine; TG is the shell.* BeepGraph = an EO-style typed,
  ontology-guided, provenance-first extraction core whose accepted output is **projected** into
  a TG-style FalkorDB graph + GraphRAG retrieval, with vectors/semantic memory as a **managed
  cache** — never as authority.

This is not a reversal of the 2026-05-12 decision; it **sharpens** it. That decision said
"TrustGraph for design influence, Effect Schema for authority, FalkorDB projection." The
sharpening is naming the authority spine's *exemplar*: it is **effect-ontology** (an
Effect-native typed ontology-guided extraction pipeline), not raw TrustGraph. So "BeepGraph =
Effect-native TrustGraph rewrite" understates the EO-style typed core — BeepGraph is the **EO
spine + TG shell**.

---

## 2. Context & the question

beep-effect has three goal packets that all need knowledge-graph machinery, but at different
altitudes:

- **`goals/agentic-professional-runtime`** — the durable product spine. Doctrine: *claim +
  evidence + provenance + lifecycle is the authoritative memory primitive; graph views are
  rebuildable projections* (`SPEC.md`).
- **`goals/ip-law-knowledge-graph`** — a typed, OWL-grounded IP-law graph (7 published
  ontologies → Effect Schema → FalkorDB/Cypher). Carries an **unresolved P0**: *is FalkorDB a
  second source of truth, or a projection?* (`research/ontology-grounding-corpus.md:29-39`).
- **`goals/oppold-corpus-pipeline`** — completed batch salvage (8,438 files → DuckDB catalog +
  `@beep/file-processing` manifests) that **feeds** the other two.

And the user's `standards/memory-architecture/` vision frames all of it: the **No-Escape
Theorem** (semantic memory degrades at scale; deterministic layers are the foundation, semantic
memory is a *managed cache*), a **four-layer taxonomy**, and the **authority / projection /
cache** discipline.

The question this doc answers: *between the two reference architectures I compared
(effect-ontology and TrustGraph), which is the better spine for beep-effect — and what do we
graft from each?* The user asked for **one** choice, plus the cherry-picks.

> A full concept-by-concept comparison of the two reference systems lives at
> `@core-v2/docs/ontology_research/trustgraph_comparison_research.md` in the effect-ontology project (machine-local checkout).
> This doc does not repeat it; it *decides* against it.

---

## 3. The two architectures in one frame

| Axis | effect-ontology (EO) | TrustGraph (TG-Py / TG-TS) |
|------|----------------------|----------------------------|
| Core | Single durable Effect app | Distributed pub/sub microservices (Pulsar / NATS) |
| Authority altitude | **Typed** `Entity`/`Relation`, ontology-guided | Raw `Triple(s,p,o,g)`, schema-light |
| Ontology | OWL-2 reasoning + SHACL | schema.org + SKOS, no reasoning |
| Store | **In-memory N3 only** (+ Oxigraph SPARQL); pgvector for embeddings | **External graph DBs** (Cassandra/Neo4j/Memgraph/FalkorDB; TS: FalkorDB) + vector DBs |
| Extraction | One ontology-guided pipeline + **monoid-fold** merge | Discrete processors (`kg-extract-*`) emitting triples |
| Retrieval | GraphRAG (in-memory) | GraphRAG + **explainability DAG**, graph-vs-doc embeddings |
| Packaging | (none) | **Knowledge Cores**; **Librarian** curated-doc + processing queue |
| Runtime | Effect Service/Layer/Stream/Workflow | FlowProcessor + message bus |

EO's strength is the **typed, provenance-first, ontology-guided extraction core**. TG's strength
is the **multi-store projection, retrieval, and packaging shell**. They are complementary, not
competing — which is exactly why the verdict is "spine from one, shell from the other."

---

## 4. Decision criteria — beep-effect's non-negotiables

These are not invented for this doc; they are already binding in beep-effect's standards and
packets. The spine must satisfy them.

1. **Authority is typed, schema-first, evidence-backed, replayable.** Durable truth is
   repo-native Effect Schema claims with source spans, provenance, and an event log
   (`standards/memory-architecture/05-context-graph-capability-assessment.md`;
   `agentic-professional-runtime/SPEC.md`).
2. **Authority / projection / cache discipline.** Graph stores are *projections*; GraphRAG /
   OntologyRAG / vectors are *candidate producers / managed caches*; they never become
   source-of-truth (`04-decision-log.md:18-31`, `54-56`).
3. **No-Escape Theorem.** Semantic retrieval degrades at scale → deterministic layers are the
   foundation; semantic memory is a bounded, managed cache (`00-no-escape-theorem.md`).
4. **Four-layer taxonomy.** L1 durable · L2 session · L3 procedural · L4 relational
   (`01-memory-layer-taxonomy.md`).
5. **Local-first, single-app.** No required message broker, no Cassandra; SQLite/Postgres-local
   first (`trustgraph-port/SPEC.md` "intentionally not ported: gateway/flow topology, Cassandra").
6. **OWL is design-time only; runtime validation is bounded SHACL.** *No OWL reasoner in the
   runtime dependency graph* (`ip-law-knowledge-graph/SPEC.md` ADR; `@beep/semantic-web`
   ships `BoundedShaclValidationService`, not a full reasoner).
7. **Effect Schema is the typed authority; ontology is annotation + projection.** *Effect Schema
   classes remain the source of truth; ontology metadata is stored in schema annotations;
   projections (JSON-LD, Turtle) are derived* (`ontology-modeling-foundation/SPEC.md:10-11`).

---

## 5. Verdict, criterion by criterion

| Criterion | EO-as-spine | TG-as-spine | Spine winner |
|-----------|-------------|-------------|--------------|
| 1. Typed schema-first authority | Typed `Entity`/`Relation`, `Schema.Class` | Raw schema-light triples | **EO** |
| 2. Authority/projection/cache fit | Extraction core = authority; store is incidental | Store *is* the system; authority is the graph DB | **EO** (clean authority separation) |
| 3. No-Escape alignment | Deterministic ontology-guided extraction + SHACL gate | Semantic triples into a store; weaker determinism story | **EO** |
| 4. Layer fit | Slots as L4 relational atop L1 claims | Whole-system; doesn't decompose into the layers | **EO** |
| 5. Local-first single-app | One Effect app, in-process | Requires broker + external stores | **EO** |
| 6. OWL design-time + bounded SHACL | Has SHACL; OWL reasoning is *adaptable down* to design-time | No OWL/SHACL at all | **EO** |
| 7. Effect Schema authority + projections | Effect-native, schema-first | Python dataclasses / `S.Struct` triples, no typed authority | **EO** |
| **Projection: pluggable graph store** | In-memory N3 only (gap) | FalkorDB/Cypher, 4 backends | **TG** |
| **Retrieval: GraphRAG + explainability** | GraphRAG in-memory, thinner | GraphRAG + explainability DAG, graph/doc embeddings | **TG** |
| **Packaging / ingestion** | none | Knowledge Cores, Librarian curated-doc + queue | **TG** |

**Read-out:** EO wins all seven *authority* criteria; TG wins the three *projection / retrieval
/ packaging* dimensions where EO is silent. Hence **EO is the spine, TG is the shell**.

---

## 6. Cherry-pick — what to take from each (mapped to authority / projection / cache)

### Take from effect-ontology → **authority spine**

| Pattern | EO source | Role in BeepGraph |
|---------|-----------|-------------------|
| Ontology-*guided* extraction (class hierarchy → allowed types → scoped predicates) | `Workflow/StreamingExtraction.ts`, `Domain/Model/Ontology.ts` | Candidate producer constrained by `@beep/ontology` types |
| Typed `Entity`/`Relation` (not raw triples) | `Domain/Model/Entity.ts` | Authority shape over Effect Schema |
| **Monoid-fold merge** (associative, identity = empty graph) | `Workflow/Merge.ts:161` | Deterministic, order-independent claim/graph reduction |
| Evidence spans + provenance | `Domain/Model/Entity.ts` (`EvidenceSpan`), `claims#` ns | Maps to `@beep/epistemic-domain` Evidence + PROV-O |
| **SHACL validation** | `Service/Shacl.ts` | Already mirrored by `@beep/semantic-web` bounded SHACL |
| Entity resolution (mention → canonical) | `Domain/Model/EntityResolution.ts` | Candidate de-dup before acceptance |
| *(optional)* executable SPARQL over a materialized store (Oxigraph) | `Service/Sparql.ts` | **Deferred** — beep currently chooses Cypher (ADR-005), no SPARQL runtime |

### Take from TrustGraph → **projection + cache shell**

| Pattern | TG source | Role in BeepGraph |
|---------|-----------|-------------------|
| Pluggable graph **projection** (FalkorDB/Cypher) | TG-TS `ts/packages/flow/src/storage/triples/falkordb.ts` | The ip-law-KG FalkorDB read-model |
| **GraphRAG** subgraph retrieval + tuning limits | TG-TS `ts/packages/flow/src/retrieval/graph-rag.ts` | L4 retrieval over the projection |
| **Explainability DAG** (`explain_graph`/`explain_triples`) | TG-Py `trustgraph-base/.../base/graph_rag_client.py` | Audit-grade "why this answer" for regulated legal work |
| Graph-vs-document embeddings (separated) | TG-Py `.../storage/graph_embeddings/*` | pgvector cache (graph entity vs chunk) |
| **Knowledge Cores** (portable triples+embeddings bundle) | TG-TS `ts/packages/flow/src/cores/service.ts` | Portable, loadable domain-KG snapshots |
| **Librarian** curated-doc library + processing queue | TG-TS `ts/packages/flow/src/librarian/service.ts` | Already the target of `goals/trustgraph-port` Phase 1 |
| Multi-store decomposition (relational / vector / graph) | TG storage adapters | The authority / projection / cache split itself |

### Leave from effect-ontology

- **In-memory N3 as store-of-record** — beep uses EventLog authority + FalkorDB projection.
- **OWL-as-runtime-authority / live reasoner** — beep keeps OWL *design-time only*; Effect
  Schema is the typed authority (criterion 6–7). EO's `getAllSuperClasses`/`owl:imports`
  reasoning is a *design-time* aid, not a runtime dependency.

### Leave from TrustGraph

- **Pub/sub topology + FlowProcessor mesh** (`trustgraph-port/SPEC.md` "intentionally not
  ported").
- **Cassandra / external object-store assumptions.**
- **Schema-light triples as authority** — the single biggest mismatch with beep's typed-authority rule.
- **Python microservice runtime.**

---

## 7. BeepGraph, defined (canonical)

> **BeepGraph** is beep-effect's knowledge-graph architecture: an **effect-ontology-style typed,
> ontology-guided, provenance-first extraction spine** whose *accepted* output is **projected**
> into a **TrustGraph-style FalkorDB graph + GraphRAG retrieval shell**, with vector/semantic
> memory as a **managed cache**. It is governed by the authority / projection / cache discipline
> and the No-Escape Theorem.

| Tier | What | beep-effect home |
|------|------|------------------|
| **Authority** (spine) | Effect Schema claims + evidence + provenance + lifecycle; ontology-guided extraction emits *candidates*; SHACL gate; monoid-fold merge; EventLog mutation history | `@beep/epistemic-domain`, `@beep/ontology` (specced), `@beep/semantic-web` (PROV-O + bounded SHACL), `@beep/rdf`, EventLog (`knowledge-workspace/00-event-sourced-graph.md`) |
| **Projection** (read model) | FalkorDB graph (Cypher), GraphRAG subgraph + explainability DAG — **rebuildable** from authority | `ip-law-knowledge-graph` (FalkorDB), `knowledge-workspace` graph projection |
| **Cache** (candidates) | Graph/doc embeddings, semantic + temporal (Graphiti-style) memory — TTL'd, pruned, **candidates only** | pgvector (`docker-compose.yml` `pgvector/pgvector:pg17`, currently unused) |

**This supersedes** `01-memory-layer-taxonomy.md:105` ("BeepGraph (Effect-native TrustGraph
rewrite)... port the provenance and verification layers"). The sharpening: BeepGraph's spine
exemplar is **effect-ontology**, not raw TrustGraph; TrustGraph contributes the **shell**
(projection + retrieval + packaging), and its provenance/explainability ideas live in the
projection's audit trail rather than defining the core.

---

## 8. Per-memory-layer placement (L1–L4)

| Layer | Theorem status | What lands here | Source of pattern |
|-------|----------------|-----------------|-------------------|
| **L1 — Durable** | Outside | Curated docs + `@beep/epistemic-domain` accepted claims/evidence (authority) | EO (typed claims) + files |
| **L2 — Session** | Inside (managed) | Bi-temporal session cache, consolidation/pruning | Graphiti-style; TG GraphRAG cache |
| **L3 — Procedural** | Outside | Deterministic AST/JSDoc capability graph — **dev tooling / learning-vehicle residue, not a product moat** | _prior `EffectCapabilityKG.ts` prototype removed; rebuild if pursued_ |
| **L4 — Relational** | Inside (managed) | **BeepGraph**: EO extraction spine → FalkorDB projection + GraphRAG | EO spine + TG shell |

The verdict only governs **L4** (and the authority that feeds it). L1/L3 are already settled and
sit *outside* the theorem; L2 stays a bounded cache. BeepGraph is the L4 relational layer, and
its discipline (candidates → SHACL → accepted → projected) is what keeps L4's inevitable
semantic degradation *managed* rather than load-bearing.

---

## 9. Per-packet architecture calls

### `ip-law-knowledge-graph` — resolves the open P0

**Call: FalkorDB is a PROJECTION (rebuildable read model), not a second source of truth.**

This resolves the P0 flagged in `research/ontology-grounding-corpus.md:29-39` in favor of the
runtime doctrine. Concretely:

- The 7 OWL ontologies (LKIF-Core, IPRonto/ALIS, Copyright Ontology, JudO, LCBR, ESTRELLA, WIPO
  IPC; plus FOLIO as backbone) are **design-time grounding** → `@beep/ontology` Effect-Schema
  typed authority with ontology annotations (`ontology-modeling-foundation/SPEC.md:10-11`).
- LLM extraction (EO-style, ontology-guided) emits **candidate** nodes/edges with evidence spans.
- **Bounded SHACL** validates shape; accepted claims land in the epistemic authority.
- FalkorDB (ADR-002) + Cypher (ADR-005, *no SPARQL runtime*) is the **projection** rebuilt from
  accepted claims for sub-graph/path traversal. No change to ADR-002/005 is required — only the
  classification: the store is downstream of authority, not parallel to it.

### `agentic-professional-runtime`

**Call: unchanged and reinforced.** Claim + evidence + provenance + lifecycle authority
(`@beep/epistemic-domain` + EventLog). The EO-style extraction kernel runs as a **candidate
producer**; human/policy approval gates promote candidates to authoritative state; all graph
views (BeepGraph projection) are rebuildable. v1 stays deterministic-fixture-driven. BeepGraph is
the runtime's L4 recall surface, fed by — never ahead of — accepted claims.

### `oppold-corpus-pipeline`

**Call: feeder, no KG of its own.** The completed DuckDB catalog + `@beep/file-processing`
manifests are the **ingestion source** for the runtime's corpus lane → EO-style extraction →
candidate claims → (on acceptance) BeepGraph projection. It contributes corpus + provenance, not
graph authority.

---

## 10. Have vs build (mapping the cherry-picks to beep-effect)

| BeepGraph need | Status in beep-effect | Path |
|----------------|-----------------------|------|
| RDF value models (IRI/Quad/Dataset, OWL/PROV vocab) | **Live** | `packages/foundation/modeling/rdf/src/Rdf.ts`, `Vocab/Owl.ts` |
| PROV-O provenance + bounded SHACL | **Live** | `packages/foundation/modeling/rdf/src/Prov.ts`, `packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts` |
| Epistemic authority (claims/evidence/lifecycle) | **Live (domain only)** | `packages/epistemic/domain/src/entities/{CandidateClaim,Evidence,Activity}`, `values/ClaimLifecycle` |
| Ontology authoring over Effect Schema → JSON-LD/Turtle | **Specced, blocked** | `goals/ontology-modeling-foundation/SPEC.md` (`@beep/ontology`, retired) |
| EventLog → graph projection | **Specced** | `goals/knowledge-workspace/00-event-sourced-graph.md` |
| Curated-doc library + processing queue + grounded retrieval | **Specced** | `goals/trustgraph-port/{SPEC,PLAN}.md` → `packages/repo-memory` |
| FalkorDB projection + Cypher | **Specced** | `goals/ip-law-knowledge-graph/SPEC.md` (ADR-002/005) |
| GraphRAG + explainability DAG; Knowledge Cores; graph/doc embeddings | **Net-new (graft from TG)** | pgvector available (`docker-compose.yml`), unused |
| EO-style ontology-guided extraction + monoid-fold merge | **Net-new (graft from EO)** | pattern bridge cited in `ip-law-knowledge-graph/research/ontology-grounding-corpus.md:13` |

Net: the **authority spine is largely already built**; the **projection/retrieval shell** (TG
grafts) and the **extraction kernel** (EO graft) are the principal net-new work, and both already
have homes (`trustgraph-port`, `ip-law-knowledge-graph`, `knowledge-workspace`).

---

## 11. Proposed decision-log entry

> Paste into `standards/memory-architecture/04-decision-log.md` (above the
> `_Future decisions should be appended above this line_` marker) when ratified. Not yet applied.

```markdown
## 2026-06-15: BeepGraph Spine — effect-ontology core, TrustGraph shell

**Context:** A concept-by-concept comparison of the two reference architectures
(effect-ontology and TrustGraph, the latter in both its Python original and full
Effect-TS port) was run against beep-effect's three KG packets
(agentic-professional-runtime, ip-law-knowledge-graph, oppold-corpus-pipeline) and the
memory-architecture standard. See `docs/BEEPGRAPH_ARCHITECTURE.md`.

**Decision:** BeepGraph adopts the effect-ontology-style architecture as the typed
authority/extraction SPINE and the TrustGraph-style architecture as the projection +
retrieval + packaging SHELL.

1. Authority spine = effect-ontology-style: Effect-Schema typed claims, ontology-guided
   extraction (candidates only), evidence/provenance, monoid-fold merge, bounded SHACL.
2. Projection shell = TrustGraph-style: FalkorDB/Cypher graph, GraphRAG + explainability
   DAG, Knowledge Cores, Librarian curated-doc/processing-queue — all rebuildable.
3. Vector/semantic/temporal memory remains a managed cache (candidates only).
4. ip-law-knowledge-graph P0 resolved: FalkorDB is a projection, not a second source of truth.

**Rationale:** beep-effect's non-negotiables (typed schema-first authority, evidence/provenance,
local-first single-app, OWL design-time only + bounded SHACL, EventLog) are effect-ontology's
DNA, not TrustGraph's schema-light pub/sub-over-external-stores design. TrustGraph supplies the
multi-store projection, retrieval, and packaging that effect-ontology lacks.

**Consequences:**
- Sharpens the 2026-05-12 portfolio decision: the authority-spine exemplar is effect-ontology,
  not raw TrustGraph.
- Supersedes "BeepGraph = Effect-native TrustGraph rewrite" (01-memory-layer-taxonomy.md): the
  spine is EO-style; TrustGraph contributes the shell and the projection's audit trail.
- trustgraph-port Phase 1 (Librarian/processing/retrieval) and ip-law-knowledge-graph (FalkorDB
  projection) proceed as shell work; @beep/ontology + EO-style extraction kernel are the spine's
  net-new work.
```

---

## 12. Appendix — evidence

**Repo legend:** `beep` = this repository's root ·
`EO` = `@core-v2/src/` in the effect-ontology project (machine-local checkout) ·
`TG-Py` = the trustgraph repo root (upstream: https://github.com/trustgraph-ai/trustgraph) · `TG-TS` = its `ts/` subtree

- **Authority / criteria:** `beep standards/memory-architecture/{00-no-escape-theorem,01-memory-layer-taxonomy,04-decision-log,05-context-graph-capability-assessment}.md`; `beep goals/agentic-professional-runtime/SPEC.md`; `beep goals/ontology-modeling-foundation/SPEC.md:10-11`.
- **beep live:** `beep packages/foundation/modeling/rdf/src/{Rdf.ts,Vocab/Owl.ts}`; `beep packages/foundation/capability/semantic-web/src/{prov.ts,adapters/shacl-engine.ts}`; `beep packages/epistemic/domain/src/entities/{CandidateClaim,Evidence,Activity}`, `values/ClaimLifecycle`; `beep docker-compose.yml` (`pgvector/pgvector:pg17`).
- **beep specced:** `beep goals/{trustgraph-port,knowledge-workspace,ip-law-knowledge-graph,ontology-modeling-foundation}/`.
- **EO spine:** `EO Workflow/{StreamingExtraction.ts,Merge.ts:161}`; `EO Service/{Shacl,Sparql,GraphRAG,EntityResolution}.ts`; `EO Domain/Model/{Ontology,Entity,EntityResolution}.ts`; `EO Repository/Embedding.ts`.
- **TG shell:** `TG-Py trustgraph-flow/trustgraph/storage/triples/{cassandra,neo4j,memgraph,falkordb}`, `trustgraph-base/trustgraph/schema/knowledge/knowledge.py`, `trustgraph-base/trustgraph/base/graph_rag_client.py`; `TG-TS ts/packages/flow/src/{storage/triples/falkordb.ts,retrieval/graph-rag.ts,cores/service.ts,librarian/service.ts}`.
- **Full comparison:** `EO ../docs/ontology_research/trustgraph_comparison_research.md`.
