# 05 -- Context Graph Capability Assessment

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

Status: doctrine addendum.
Assessed: 2026-05-12.

> **Refresh (2026-07-08, applied 2026-07-11):** the clone+docs research run in
> [`docs/agent-memory-infra/`](../../docs/agent-memory-infra/00-recommendation.md)
> supersedes several entries below (see the dated notes in each affected
> section and the 2026-07-08 entry in [`04-decision-log.md`](./04-decision-log.md)):
> FalkorDB is **SSPLv1, not OSI open-source**; Mem0 is upgraded from
> benchmark-only to donor; Graphiti's "bi-temporal" wording is narrowed and its
> deployment retires post-port; Cognee is the sole (bounded) dev-tooling
> memory incumbent; Supermemory and OriginTrail DKG entries are added at the
> end of the candidate list. The authority model above is unchanged — the run
> **confirmed** it across all thirteen lanes.

This addendum reopens the external landscape only for feature and capability
selection. It does not reopen the question of what owns durable memory truth in
this repository.

The answer to that question is unchanged: durable truth is repo-native,
schema-first, evidence-backed, provenance-tracked, and replayable. Semantic
memory products, GraphRAG systems, vector stores, and LLM-inferred knowledge
graphs may produce candidates, caches, context packets, retrieval hints, and
inspection UX. They do not become sources of truth.

## Decision

Use a capability portfolio, not a single external foundation.

| Capability | Primary donor | Secondary donors | Repo-owned destination |
|---|---|---|---|
| Durable authority | Existing memory standard, Effect `EventLog`, `ProvBundle`, schema-first claims | TrustGraph provenance model as reference | Slice/shared domain and use-case contracts, with graph/search as projections |
| Provenance core | TrustGraph explainability and local TrustGraph TS port | Graphiti episode lineage, Cognee provenance metadata | Repo-owned source spans, evidence records, provenance activities, retrieval traces |
| Ontology graph | TrustGraph OntologyRAG and Cognee ontology validation | GraphZep RDF/OWL, LlamaIndex property graph APIs | Effect Schema legal/ontology models; LLM extraction creates candidates only |
| Temporal/session memory | Graphiti/Zep | GraphZep, Cognee session memory, LangGraph stores | Managed Layer 2/4 cache with TTL, pruning, consolidation, and uncertainty |
| Corpus graph derivation | Microsoft GraphRAG | LlamaIndex PropertyGraphIndex | Batch candidate extraction and summary generation, never accepted fact authority |
| Agent recall UX | Cognee, LangGraph, Letta, Mastra | mem0, Hindsight | Bounded context packets and candidate write APIs over repo-owned truth |
| Graph projection engine | FalkorDB | Neo4j and Kuzu as references only | Rebuildable projection/read model, not source of truth |

The resulting implementation direction is:

1. Keep the foundation local: Effect services, schema-first models,
   deterministic IDs, source spans, provenance records, and replayable event
   logs.
2. Use FalkorDB for graph projection and traversal when a graph engine is
   needed.
3. Port ideas from external projects into repo-native packages only after they
   pass the architecture routing rules in `standards/ARCHITECTURE.md`.
4. Treat all LLM/embedding/GraphRAG output as candidate memory until it is tied
   to evidence and accepted by the relevant product or policy boundary.

## Authority Model

The important boundary is not "graph or no graph." It is "authority or
projection."

| Layer | Allowed role | Required proof |
|---|---|---|
| Exact source and evidence records | Authority | Stable source artifact, span, actor, timestamp, and provenance activity |
| Schema-first claims and domain entities | Authority after acceptance | Runtime schema, lifecycle state, evidence links, policy/human approval where needed |
| Event log entries | Authority for mutation history | Replayable event contract, primary key, payload schema, timestamp, actor |
| FalkorDB graph | Projection/read model | Rebuildable from authoritative events, claims, and source records |
| GraphRAG/OntologyRAG extraction | Candidate producer | Source span references and extraction provenance; no direct accepted writes |
| Vector, semantic, temporal memory | Managed cache | TTL/windowing, pruning/compression, uncertainty, provenance back-pointers |
| Context packets for agents | Bounded projection | Explicit scope, evidence links, freshness marker, and provenance trail |

If a proposed feature cannot say which row it belongs to, it is not ready for
implementation.

## Candidate Assessment

### TrustGraph

Sources: [llms.txt](https://trustgraph.ai/llms.txt),
[architecture](https://docs.trustgraph.ai/overview/architecture.html),
[explainability](https://docs.trustgraph.ai/overview/explainability.html),
[OntologyRAG](https://docs.trustgraph.ai/guides/ontology-rag/),
[changelog](https://docs.trustgraph.ai/reference/changelog/trustgraph.html),
[GitHub](https://github.com/trustgraph-ai/trustgraph).

**Use as:** primary provenance and context-graph reference.

**Pros**

- Strongest explainability model found in this pass: separate core knowledge,
  extraction provenance, and retrieval-trace graphs.
- Uses W3C PROV-O concepts and persistent query-time traces that can support
  regulated legal/financial audit trails.
- Context Cores are a useful packaging model for portable, isolated knowledge
  bases.
- OntologyRAG directly matches the ontology-survey scope now absorbed by
  `semantic-foundation`; see [`explorations/legal-ontology-landscape`](../../explorations/legal-ontology-landscape/README.md).
- The architecture separates graph, vector, object, and structured stores in a
  way that maps cleanly to repo-owned authority plus projections.

**Cons**

- Upstream remains Python and service-platform oriented.
- Full topology is operationally heavy and conflicts with the repo's
  slice-local Layer and driver/foundation boundaries.
- LLM extraction and graph embeddings remain semantic candidate machinery, not
  deterministic authority.
- Its agent runtime and dynamic flow manager are too broad for the first
  professional-runtime proof.

**Tradeoff**

TrustGraph should win provenance and context-graph design influence. It should
not win package topology, runtime authority, or source-of-truth status.

### Local TrustGraph TypeScript Port

Source: the machine-local TrustGraph TypeScript port (upstream: https://github.com/trustgraph-ai/trustgraph), inspected read-only. Relevant anchors:
`package.json`, `packages/base/src/processor/flow-processor.ts`,
`packages/flow/src/retrieval/graph-rag.ts`,
`packages/flow/src/storage/triples/falkordb.ts`,
`packages/flow/src/extract/knowledge-extract.ts`.

**Use as:** runnable TypeScript comparison harness and component donor.

**Pros**

- Serious TypeScript port with gateway, config, LLM, embeddings, chunking,
  extraction, triple storage, GraphRAG, DocumentRAG, MCP, workbench, and Docker
  stack scripts.
- Uses FalkorDB, Qdrant, and NATS JetStream, making it much closer to local
  experimentation than upstream Pulsar/Cassandra deployment.
- Its GraphRAG path is readable and useful as a reference pipeline:
  concept extraction, embeddings, graph entity search, traversal, scoring, and
  synthesis.

**Cons**

- It is imperative TypeScript, not Effect-native.
- It lacks the current upstream TrustGraph explainability model as a first-class
  persistent named-graph design.
- Its FalkorDB triple store is a minimal `Node`/`Literal`/`Rel` property graph,
  not repo-owned provenance authority.
- It is service-topology oriented; this repo needs EventLog authority with
  graph projections.

**Tradeoff**

Keep it as a working lab. Port selected ideas only after converting them into
Effect services, schemas, typed errors, and repo topology.

### Cognee

Sources: [llms.txt](https://www.cognee.ai/llms.txt),
[architecture](https://docs.cognee.ai/core-concepts/architecture),
[DataPoints](https://docs.cognee.ai/core-concepts/building-blocks/datapoints),
[remember](https://docs.cognee.ai/core-concepts/main-operations/remember),
[recall](https://docs.cognee.ai/core-concepts/main-operations/recall),
[ontologies](https://docs.cognee.ai/core-concepts/further-concepts/ontologies),
[time awareness](https://docs.cognee.ai/guides/time-awareness),
[MCP](https://docs.cognee.ai/cognee-mcp/mcp-overview),
[GitHub](https://github.com/topoteretes/cognee).

**Use as:** ontology UX, memory-control-plane, and agent recall reference.

**Pros**

- Clean three-store decomposition: relational provenance/metadata, vector
  similarity, and graph relationships.
- `DataPoint` is a useful modeling ergonomic: typed units of knowledge with
  metadata, versioning, provenance, and selective embedding fields.
- Strong user-facing memory operations: remember, recall, improve, and forget.
- Ontology support gives a concrete UX for RDF/OWL validation and enrichment.
- Session/permanent memory split is a good reference for Layer 2 cache design.
- MCP and API modes provide useful agent-facing integration patterns.

**Cons**

- Python-first; TypeScript fit is REST/MCP or a future adapter, not native
  package integration.
- Most graph construction remains LLM-mediated unless using structured-data
  paths.
- Provenance tracks ingestion lineage but does not replace repo-owned
  claim/evidence/provenance lifecycle.
- Temporal mode is useful, but not equivalent to replayable event sourcing or
  bitemporal professional truth.

**Tradeoff**

Cognee should influence UX, ontology workflows, and cache ergonomics. It should
not own accepted claims, professional approvals, or durable legal facts.

> **Role update (2026-07-08):** Cognee is now the **sole always-on dev-tooling
> memory incumbent** (Role B), conditional on: running the embedded/local or
> all-Postgres profile (never the full compose stack — its own compose
> reserves 4CPU/8GB + 2CPU/4GB); bounding the semantic cache per `01`
> (TTL/pruning/consolidation via its memify/improve loop, node-set scoping);
> and a 2–4 week recall bakeoff whose fallback is Layer-1 file memory alone.
> Its authority-boundary limits above are unchanged. Also a **projection
> donor** for Role A: DataPoint metadata, pipeline provenance stamping with a
> relational rollback ledger, and the all-Postgres deployment shape. See
> `docs/agent-memory-infra/cognee-clone.md`.

> **Superseded (2026-08-06) by [`07-shared-memory-adoption.md`](./07-shared-memory-adoption.md):**
> the Role B dev-tooling memory incumbency passes to basic-memory +
> codegraph; Cognee is retired to document-KG experiments. Its donor and
> authority-boundary notes above are unchanged.

### Graphiti / Zep

Sources: [Graphiti GitHub](https://github.com/getzep/graphiti),
[Zep paper](https://arxiv.org/abs/2501.13956).

**Use as:** temporal memory and session-cache reference.

**Pros**

- Best mature reference for temporal context graphs: entities, facts with
  validity windows, episodes as provenance, and custom types.
- Supports hybrid retrieval across semantic, keyword, and graph traversal.
- Incremental updates and automatic fact invalidation are valuable for managed
  short-term memory.
- Supports FalkorDB among other graph backends.

**Cons**

- Python-first for the open-source engine.
- Embedding/LLM-based graph construction remains inside the semantic
  degradation class.
- Unbounded use repeats the failure mode already observed in this repo's
  Graphiti deployment.

**Tradeoff**

Use the temporal model, not the unbounded memory practice. Any Graphiti-like
cache must have TTL, pruning, consolidation, and provenance-gated promotion.

> **Superseded in part (2026-07-08):** "bi-temporal" overstates the model —
> Graphiti provides valid-time fields plus system timestamps plus episode
> lineage (`valid_at`/`invalid_at`/`expired_at`/`reference_time`,
> `episodes[]`), not a transaction ledger with claim lifecycle. Its MCP server
> is labeled experimental upstream, and the FalkorDB backend option carries
> the SSPLv1 flag. Verdict update: **primary bitemporal port donor; deployment
> retires after the `@beep/epistemic-tables` port lands** (write-freeze until
> then). See `docs/agent-memory-infra/graphiti-clone.md`.

### GraphZep

Source: [GraphZep GitHub](https://github.com/aexy-io/graphzep).

**Use as:** TypeScript audit target, not foundation.

**Pros**

- TypeScript-native attempt at Zep/Graphiti-style temporal memory.
- Advertises episodic, semantic, and procedural memory; FalkorDB/Neo4j/RDF
  support; SPARQL; ontology management; and MCP/server deployment.
- Could donate API shapes for a TS temporal graph cache.

**Cons**

- Very young project at time of assessment, with only a small public commit
  history.
- Uses Zod and conventional Node patterns, not Effect Schema/Layer/typed-error
  boundaries.
- Needs a real provenance and determinism audit before any adoption.

**Tradeoff**

Worth tracking because it is TypeScript and overlaps the desired feature set.
Not yet mature enough to influence doctrine beyond "audit later."

### Microsoft GraphRAG

Source: [Microsoft GraphRAG GitHub](https://github.com/microsoft/graphrag).

**Use as:** batch corpus derivation and evaluation reference.

**Pros**

- Strong algorithmic reference for deriving entities, relationships, claims,
  communities, and summaries from unstructured corpora.
- Useful for evaluating legal or professional corpora where global/community
  summaries matter.
- Good reminder that graph construction costs happen at indexing time.

**Cons**

- Python batch pipeline and research/demo posture.
- Not a live TypeScript memory/runtime architecture.
- Outputs are LLM-derived and must remain candidate facts until verified.

**Tradeoff**

Use it for corpus-level extraction and summarization ideas. Do not use it as a
runtime or accepted-memory store.

### FalkorDB

Sources: [FalkorDB docs](https://docs.falkordb.com/),
[Code-Graph docs](https://docs.falkordb.com/genai-tools/code-graph.html).

**Use as:** graph projection engine.

**Pros**

- Already aligned with existing repo direction.
- Cypher, full-text, vector indexes, graph tooling, and TypeScript-friendly
  local deployment options make it a practical graph read model.
- Good fit for code graph projections and ontology graph traversal.

**Cons**

- It is a graph database, not a memory architecture.
- It does not solve provenance, acceptance, lifecycle, or semantic drift by
  itself.

**Tradeoff**

FalkorDB can be foundational infrastructure, but only as a rebuildable
projection/read model over authoritative events and evidence.

> **License correction (2026-07-08):** FalkorDB is **SSPLv1 — not an OSI
> license** (confirmed by two lanes incl. a live LICENSE.txt fetch). Any
> shipping decision that bundles it (directly or via Graphiti's FalkorDB
> backend) must choose a gate-passing backend or accept SSPL consciously.
> The "USE — already chosen" verdict in 03 predates this flag.

### LangGraph / LangMem

Sources: [LangChain JS long-term memory docs](https://docs.langchain.com/oss/javascript/langchain/long-term-memory),
[LangGraph memory docs](https://docs.langchain.com/oss/python/langgraph/memory),
[LangMem GitHub](https://github.com/langchain-ai/langmem).

**Use as:** TypeScript agent-memory ergonomics reference.

**Pros**

- Strong TypeScript availability for agent stores and checkpoint-style memory.
- The namespace/key document model is simple and useful for agent runtime
  context.
- LangMem contributes a useful taxonomy and memory-management workflow ideas.

**Cons**

- JSON document stores are not provenance-first graph authority.
- Agent writes must be wrapped as candidate/evented/provenance-bound operations.
- LangChain/LangGraph dependency weight is not justified for the repo's core
  memory architecture.

**Tradeoff**

Study the ergonomics and store interfaces. Do not build durable professional
truth on a LangGraph store.

### Letta

Source: [Letta stateful agents docs](https://docs.letta.com/guides/core-concepts/stateful-agents).

**Use as:** stateful-agent UX reference.

**Pros**

- Good model for agents that persist context, messages, tool calls, and memory
  outside the active context window.
- Core memory blocks and archival memory are useful distinctions for agent UX.
- Strong reminder that memory is part of the agent control loop, not just
  retrieval.

**Cons**

- Agent-server oriented rather than repo-native architecture.
- Agent self-modified memory is not acceptable as durable legal/financial truth
  without approval and evidence gating.

**Tradeoff**

Letta is useful for context-management UX. It is not the authority model.

### mem0

Sources: [mem0 docs index](https://docs.mem0.ai/llms.txt),
[OSS v3 migration](https://docs.mem0.ai/migration/oss-v2-to-v3).

**Use as:** external benchmark/reference only.

**Pros**

- Convenient cross-language memory API and current focus on hybrid retrieval
  and entity linking.
- Useful benchmark target for agent memory UX.

**Cons**

- Current OSS migration removes graph-store support in favor of entity linking.
- Too managed/heuristic for repo-owned provenance authority.
- Less compelling than Cognee/Graphiti/TrustGraph for ontology and provenance
  features.

**Tradeoff**

Do not invest unless a narrow benchmark or integration comparison requires it.

> **Upgraded (2026-07-08):** "benchmark/reference only" is too narrow — Mem0
> ships a real TS OSS SDK (`mem0ai/oss`), a pgvector-default self-host server,
> and the strongest Claude/Codex plugin/lifecycle-hook story of the six.
> Verdict update: **donor** for ADD-only automatic extraction (no LLM-decided
> UPDATE/DELETE), UUID masking before LLM calls, hash-dedup, entity-sidecar
> linking, and hybrid scoring over pgvector; its lifecycle-hook *pattern*
> (recall-before-prompt, store-on-stop, pre-compact summary) is the reference
> shape for tuning Cognee's hooks. Still nowhere near authority-grade (no
> evidence spans, no acceptance lifecycle). See
> `docs/agent-memory-infra/mem0-clone.md`.

### LlamaIndex PropertyGraphIndex

Source: [PropertyGraphIndex docs](https://developers.llamaindex.ai/python/examples/property_graph/property_graph_basic/).

**Use as:** graph indexing/retrieval reference.

**Pros**

- Clear property-graph indexing API with explicit graph extractors and multiple
  retrievers.
- Good reference for combining vector retrieval, keyword expansion, and graph
  traversal.

**Cons**

- Python graph features are more mature than TypeScript graph features.
- Default extraction is LLM-derived and must remain candidate-only.

**Tradeoff**

Study pipeline structure, not implementation foundation.

### Neo4j GenAI

Sources: [Neo4j GenAI docs](https://neo4j.com/docs/genai/),
[Neo4j GraphRAG Python](https://neo4j.com/docs/neo4j-graphrag-python/current/).

**Use as:** graph ecosystem reference.

**Pros**

- Mature graph database ecosystem with GraphRAG, vector indexes, and agent
  integration examples.
- Useful source of query/modeling patterns and operational lessons.

**Cons**

- Switching graph engines away from FalkorDB adds operational weight and weakens
  current repo direction.
- Neo4j tooling does not provide the repo's authority model by itself.

**Tradeoff**

Learn from it; do not replace FalkorDB as the chosen projection engine without a
separate engine decision.

### Kuzu

Source: [Kuzu GitHub](https://github.com/kuzudb/kuzu).

**Use as:** fallback/reference only.

**Pros**

- Embedded property graph database with Cypher, full-text search, vector index,
  and browser/wasm story.

**Cons**

- The public README states that the KuzuDB project is being archived.
- Not a good new foundation choice in 2026 despite attractive technical shape.

**Tradeoff**

Keep as historical/technical reference only.

### Mastra

Source: [Mastra agents](https://mastra.ai/agents).

**Use as:** TypeScript agent-runtime UX reference.

**Pros**

- TypeScript-native agent framework with memory, tools, MCP, workflows, logs,
  traces, evals, and RAG primitives.
- Strong source of frontend/backend developer-experience ideas for an agentic
  professional runtime.

**Cons**

- Not a provenance-first knowledge graph or memory authority layer.
- Its agent memory is a runtime convenience, not accepted professional truth.

**Tradeoff**

Study for workflow and agent ergonomics. Do not route core memory architecture
through it.

### Hindsight

Source: [Hindsight GitHub](https://github.com/vectorize-io/hindsight).

**Use as:** watchlist and benchmark reference.

**Pros**

- Promising agent-memory benchmark claims and learning-oriented memory model.
- Useful category pressure: memory systems are moving from recall toward
  learned mental models and reflection.

**Cons**

- Not deeply audited in this pass.
- Its memory model must still be tested against repo authority, provenance, and
  deterministic-first constraints before adoption.

**Tradeoff**

Track as an external benchmark. Do not let benchmark claims override authority
requirements.

### Supermemory (added 2026-07-08)

Sources: `docs/agent-memory-infra/supermemory-clone.md`,
`docs/agent-memory-infra/supermemory-docs.md`.

**Use as:** schema-pattern donor only; never foundation.

**Pros**

- Real, source-observed donor patterns: document/chunk/memory schema split;
  typed version relations (`updates`/`extends`/`derives`); container-tag
  namespace isolation; profile/query/full retrieval-mode split.

**Cons**

- Engine is not source-buildable from the OSS repo; the repo's own dev path
  points at the hosted API — fails auditable self-host.
- 03's "nothing to take" is refuted, but its IGNORE-as-foundation verdict is
  confirmed.

**Tradeoff**

LEARN (schemas, version relations, container tags, retrieval modes); the
engine stays opaque and hosted-API-backed.

### OriginTrail DKG (added 2026-07-08)

Sources: `docs/agent-memory-infra/origintrail-clone.md`,
`docs/agent-memory-infra/origintrail-docs.md`.

**Use as:** verifiable-provenance packaging donor; watchlist.

**Pros**

- The only TS-native candidate of the six (Node 22+ monorepo, HTTP daemon,
  29-tool MCP); Apache-2.0 root license (clone-verified).
- Strongest verifiable-provenance packaging ideas found: knowledge-asset
  lifecycle envelopes (create→finalize→share→publish), Merkle commitments
  over public/private partitions, author attestations, fail-closed
  private-graph gates, explicit WM/SWM/VM trust-tier labels.
- Tokenless local mode covers WM/SWM/query.

**Cons**

- Release-candidate; its own README says avoid production. VM finality needs
  TRAC/gas (chain dependency).

**Tradeoff**

Watchlist for the legal verifiability story once V10 exits release-candidate;
port packaging ideas, do not deploy.

### ArangoDB, LanceDB, SurrealDB

Sources: [ArangoDB GraphRAG docs](https://docs.arangodb.com/3.13/data-science/graphrag/),
[LanceDB docs](https://lancedb.github.io/lancedb/),
[SurrealDB docs](https://surrealdb.com/docs/surrealdb).

**Use as:** ignore unless a narrow storage need appears.

These are storage or multi-model alternatives, not better matches for the
current repo authority model. None displaces FalkorDB plus repo-native
provenance as the chosen direction.

## Initiative Mapping

### `semantic-foundation` (absorbed ontology-survey scope)

Use TrustGraph OntologyRAG and Cognee ontology UX as references for OWL import,
ontology-scoped extraction, and validation, but make Effect Schema the typed
authority. Every node and edge type still needs source ontology traceability.
The grounding survey is retained at
[`explorations/legal-ontology-landscape`](../../explorations/legal-ontology-landscape/README.md).

LLM extraction may propose `Patent`, `Trademark`, `LegalProvision`, `Claim`, or
edge candidates, but accepted legal graph facts require evidence spans and
repo-owned lifecycle state.

### Knowledge workspace vision (packet removed 2026-07-14)

The vision was re-captured at
[`explorations/knowledge-workspace`](../../explorations/knowledge-workspace/README.md).

Keep Effect `EventLog` and `SqlEventJournal` as the source of graph mutation
history. Use TrustGraph's separation between knowledge graph, source
provenance, and retrieval explainability as the projection model to emulate.

The workspace graph view is a materialized projection, not a replacement for
repo-memory, accepted claims, or source artifacts.

### `agentic-professional-runtime`

Keep `claim + evidence + provenance + lifecycle` as the authoritative memory
primitive. Agent recall systems may read bounded context packets and propose
candidate claims, tasks, drafts, or retrieval traces. Professional judgment,
client-facing communication, filings, recommendations, and compliance-weighted
records remain approval-gated.

### `memory-architecture`

This addendum amends the closed April landscape assessment with a new rule:
external systems may be evaluated as capability donors, but not as semantic
memory foundations. Any future memory feature must say whether it is authority,
candidate producer, cache, projection, or UX.

## Required Implementation Constraints

- No Python or external service topology becomes repo topology by default.
- External services, if ever run, live behind repo-level `drivers/*` wrappers
  and never own product semantics.
- Product semantics stay in the owning slice or high-bar `shared/*` promotion.
- Domain-agnostic repo-owned substrate routes through `foundation/*` only after
  the architecture gate.
- Graph projections must be rebuildable from accepted events, source records,
  claims, and evidence.
- Semantic caches require hard bounds: TTL/windowing, pruning, compression or
  consolidation, uncertainty, and provenance back-pointers.
- Context packets must be bounded, cited, freshness-marked, and reproducible
  from source records.
- GraphRAG/OntologyRAG output is never an accepted fact until verified against
  source evidence and accepted by the appropriate policy boundary.

## Next Research Steps

These are deliberately not implementation steps.

1. Audit GraphZep's source quality, provenance model, and FalkorDB/RDF drivers
   before considering it as a TypeScript temporal-cache donor.
2. Extract a minimal TrustGraph-style provenance trace model as a design note:
   source graph, retrieval graph, and accepted knowledge graph as separate
   projections over repo-owned authority.
3. Compare Cognee `DataPoint` ergonomics against existing Effect Schema /
   `Model.Class` patterns for typed ontology units.
4. Define an evaluation fixture for ontology extraction over one IP-law scenario
   with expected candidate facts, evidence spans, and rejection cases.

## Closed Questions

- No single external project is selected as the foundation.
- TrustGraph leads provenance influence, but not runtime topology.
- Cognee leads memory UX and ontology ergonomics influence, but not authority.
- FalkorDB remains the graph engine direction unless a separate engine decision
  supersedes it.
- Python projects are allowed to win ideas; they do not win authoritative
  implementation ownership.
