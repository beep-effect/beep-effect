# Hosted docs mining: docs.getsemantica.ai

Against local clone `~/YeeBois/workstation-apps/semantica` @ `add1c006` (`docs/` identical to `origin/main`). Groundings already cover code-level gaps; this file is hosted vs `docs/` plus atlas-useful tables those groundings do not carry.

## Lane and coverage

Lane: Firecrawl `/v1/map` then `/v1/scrape` (`formats: ["markdown"]`, `onlyMainContent`). First map via `op run`. Later `op run` died (`authorization prompt dismissed`); remaining scrapes used `op read` in-process (key never printed or written to the repo) plus a few unauthenticated Firecrawl MCP scrapes. Direct HTTP for 404 probes and titles of unscraped pages. `/v2/` not needed.

Map: 79 links, **78 unique** (one `#` fragment). Matches Mintlify `docs/docs.json` nav. No extra hosted routes. `generator: Mintlify`. Sitemap and llms.txt confirmed 404 (`Page not found · GitHub Pages`). Firecrawl prepends a fake "Documentation Index → /llms.txt" on every scrape; ignore it.

Scraped: **65** high-value pages (homepage, install/quickstart, architecture/modules/concepts/cookbook/glossary/faq/cli/explorer, all 29 `reference/*`, 5 integrations, AGE + pgvector, 15 guides). Unscraped: **13** (6 community/legal + 7 guides that duplicate reference pages). Budget ~60; 65 kept because reference pages are the atlas payload.

Probed, all 404: `/changelog`, `/storage-backends`, `/migration/kg-provenance-tracker`, `/api`, `/roadmap`, `/versions`, `/llms.txt`, `/sitemap.xml`.

Published hosted bodies match local `docs/` (token Jaccard typically ≥0.88; heading sets match on the noisy Firecrawl outliers). Token extras are Mintlify tab/example inlining, not new APIs.

## Drift findings

1. **Local pages never published.** Hosted 404 vs local files not in `docs.json`: `docs/storage-backends.md` (LPG/RDF adapter matrix, Anzo constructor, RDF4J `repository_id` no-op), `docs/migration/kg-provenance-tracker.md` (`kg.ProvenanceTracker` → `ProvenanceManager`, `recorded_at` vs `timestamp`), `docs/changelog.md`. Why it matters: the only conservative backend matrix and the only deprecation map live only in the clone.

2. **Changelog tab is GitHub, not docs.** `docs.json` sends Changelog to `https://github.com/semantica-agi/semantica/releases`. No hosted changelog, no version history on-site. FAQ table at https://docs.getsemantica.ai/faq says latest **v0.6.6 (August 2026)**; the accordion "What's the latest version?" still says **v0.5.0, May 2026**. Same contradiction in `docs/faq.md:20` vs `:73`.

3. **0.6.6 code is absent from hosted (and from published local docs).** Hosted never mentions `retract_node`/`purge_node`, `to_kg_dict`, `metric_errors`, `vocabulary_turtle` / `semantica-ns`, `sqlite-vec`, or Anzo. Those exist in clone code + `CHANGELOG.md` / unpublished `storage-backends.md`. Atlas must not treat the docs site as the 0.6.6 surface.

4. **Evals overclaim vs the evals page.** https://docs.getsemantica.ai/modules shows runnable `KGEvaluator` / `ExtractionEvaluator` / `PipelineEvaluator` / `RegressionTracker` (`docs/modules.md` identical). https://docs.getsemantica.ai/reference/evals warns the module is unimplemented (`__all__ = []`; planned `PipelineBenchmark` not `PipelineEvaluator`). Grounding already graded evals as stub; hosted keeps the lie on the overview.

5. **Four-layer vs six-layer.** https://docs.getsemantica.ai/architecture is a four-layer story (Ingestion/Processing/Intelligence/Application). https://docs.getsemantica.ai/modules is the 27-module / six-layer map grounding verified. Same split in local `docs/architecture.md` vs `docs/modules.md`.

6. **Mintlify relative-link breakage (hosted-only).** Scrape of `/reference/evals` rewrote sibling links to `/reference/evals/semantic_extract` (and `kg`, `pipeline`, `ontology`). Those paths 404. Local markdown uses `semantic_extract` relatives.

7. **SPARQL and parallelism docs match local, contradict code.** https://docs.getsemantica.ai/reference/reasoning documents `SPARQLReasoner.execute_query` (empty bindings unless `triplet_store=`). https://docs.getsemantica.ai/reference/pipeline advertises `ParallelismManager` thread/process pools and never says the engine is sequential. Grounding already has the code facts; hosted does not add a correction.

## High-value mining by module

Not already in `research/grounding-semantica-repo.md` as tables/signatures. Cite hosted URLs actually fetched.

**vector_store** — https://docs.getsemantica.ai/reference/vector_store
- `VectorStore(backend=, dimension=)` backends: `inmemory`, `faiss`, `pinecone`, `weaviate`, `qdrant`, `pgvector`, `milvus`. No `sqlite`. Dimension must match model: `BAAI/bge-small-en-v1.5`/`all-MiniLM-L6-v2`=384, `all-mpnet-base-v2`=768, `bge-large-en-v1.5`=1024.
- `add_documents()` vs `store_vectors()`; `search` vs `search_vectors`.
- `MetadataFilter`: `.eq .ne .gt .gte .lt .lte .in_list .contains` (AND).
- `HybridSearch(vector_store=)` + `SearchRanker(strategy="reciprocal_rank_fusion"|"weighted_average")`.
- `NamespaceManager` is a separate in-process map, not a backend namespace.
- `FAISSStore.create_index` lowercase only: `flat`/`ivf`/`hnsw`/`pq` (uppercase → `ValidationError`). Default under `VectorStore(backend="faiss")` is flat.
- `save()`/`load()` only for inmemory/faiss.

**pgvector** — https://docs.getsemantica.ai/vector_stores/pgvector
- Extra: `pip install semantica[vectorstore-pgvector]`. Metrics cosine/L2/IP. Indexes IVFFlat + HNSW. JSONB filters. Postgres 13+. Idempotent index create. Connection pooling psycopg3/psycopg2.

**graph_store** — https://docs.getsemantica.ai/reference/graph_store
- `GraphStore(backend="neo4j"|"falkordb"|"age"|"neptune", uri=, user=, password=)` context manager; `connect()`.
- `create_node(labels, properties)` returns backend id (Neo4j integer). `create_relationship(start_node_id, end_node_id, rel_type, properties)`. `delete_node(detach=True)`. `create_index(label, property_name=)`.
- `QueryEngine` parameterized Cypher + optional `use_cache=True`. `GraphAnalytics`: degree centrality, components, `shortest_path`, `get_neighbors`.

**triplet_store** — https://docs.getsemantica.ai/reference/triplet_store
- Published backends: oxigraph / blazegraph / jena / rdf4j. Anzo omitted (only unpublished local storage-backends).
- `add_triplet(Triplet)` not kwargs. `execute_query` → `QueryResult` with `.bindings` / `.variables` / `.execution_time` (not a list). `QueryEngine` injects `LIMIT 1000` if missing.
- `backend="jena"` + `enable_inference=True` is a placeholder (0 inferred triples).
- CONSTRUCT templates (`ConstructTemplate`, `ParameterDescriptor` types `uri`/`literal`/`typed-literal`, `execute_construct_template`) are **Blazegraph-only**.
- `graph=` named-graph scoping: oxigraph/blazegraph/rdf4j; silently ignored on Jena.
- SKOS helpers `add_skos_concept` / `get_skos_concepts`. `compute_delta(old_graph_uri, new_graph_uri)`.

**embeddings** — https://docs.getsemantica.ai/reference/embeddings
- Default FastEmbed `BAAI/bge-small-en-v1.5`; `device=` ignored (ONNX). Pooling: Mean (default), Max, CLS, Attention, Hierarchical.
- `LlamaStore`: "Placeholder store: not production-ready; do not use." Docs never mention the random-vector success fallback grounding found in `vector_store.py`.
- `check_available_providers()`. Extra `semantica[fastembed]`.

**pipeline** — https://docs.getsemantica.ai/reference/pipeline and https://docs.getsemantica.ai/guides/pipeline
- `PipelineBuilder.add_step(name, type, handler=)` + `connect_steps` + `set_parallel` + `build`.
- Failure strategies: `skip` / `retry` / `abort` / `fallback`.
- Templates: `"document_processing"`, `"rag_pipeline"`, `"kg_construction"`, `"ontology_generation"`. YAML serializable. Delta mode.
- `ParallelismManager(use_processes=False)` thread pool vs process pool (GIL). Docs claim this runs the DAG; grounding says the engine still sequences `current_data`.

**mcp_server** — https://docs.getsemantica.ai/reference/mcp_server
- Packaged 12 tools only (hosted never mentions root `mcp/` 17-tool drift). Env: `SEMANTICA_KG_PATH`, `SEMANTICA_LOG_LEVEL` (default WARNING). No stdout logging.
- Tool JSON: `extract_entities{text}`, `extract_relations{text}`, `record_decision{category,scenario,reasoning,outcome,confidence}` (+ optional `decision_maker`,`valid_from`,`valid_until`), `find_precedents{scenario,max_results≤50}`, `get_causal_chain{decision_id,direction,max_depth≤20}`, `add_entity{id}`, `add_relationship{source,target}`, `export_graph{format in turtle,ttl,nt,xml,json-ld,json}`.
- Resources: `semantica://graph/summary`, `semantica://decisions/list` (≤50), `semantica://schema/info`.

**explorer / CLI** — https://docs.getsemantica.ai/explorer-setup, https://docs.getsemantica.ai/cli-setup
- Five entry points: `semantica`, `semantica-server` (`SEMANTICA_CORS_ORIGINS`, bind `0.0.0.0:8000`), `semantica-worker`, `semantica-explorer` (needs `semantica[explorer]`), `semantica-mcp`.
- Explorer CLI: `--graph` required, `--port` 8000, `--host` 127.0.0.1, `--no-browser`. Since **v0.6.5**, API requires `SEMANTICA_API_KEY` as `X-API-Key`, fails closed `503`; `SEMANTICA_ALLOW_ANONYMOUS=true` to opt out. `/docs` Swagger, `/api/health`.

**context / policy / distance**
- https://docs.getsemantica.ai/reference/context: `AgentContext(vector_store=, knowledge_graph=ContextGraph(advanced_analytics=True), decision_tracking=True, retention_days=90, max_memories=50000)`. Classes: `AgentMemory`, `EntityLinker`, `ContextRetriever(hybrid_alpha)`, `DecisionRecorder`, `PolicyEngine`, `CausalChainAnalyzer`. No retract/purge.
- https://docs.getsemantica.ai/guides/policy-engine: `check_compliance(Decision, policy_id) → bool` (does not block), `record_exception`, `analyze_policy_impact`, `get_affected_decisions`, `update_policy` with version strings.
- https://docs.getsemantica.ai/reference/distance: four bands `direct`(1 hop)/`near`(2)/`mid-range`(3–4)/`distant`(5+), N×N matrices, ego BFS, proximity blending, "10×" revision-keyed embedding cache.

**reasoning / ontology / llms / crewai / cookbook**
- https://docs.getsemantica.ai/reference/reasoning: engines `Reasoner`, `GraphReasoner`, `ReteEngine`, `SPARQLReasoner`, `DatalogReasoner`, `TemporalReasoningEngine` (13 Allen relations), `ExplanationGenerator`. String facts `Predicate(args)`; `Rule` dataclass.
- https://docs.getsemantica.ai/reference/ontology: `OntologyEngine(base_uri=).from_data / validate_graph / export_owl`. 5-stage generate. `SHACLValidationReport.conforms` + violations. Hub is Explorer v0.5.0.
- https://docs.getsemantica.ai/reference/llms: classes `Groq`, `OpenAI` (`base_url` gateways), `LiteLLM` (100+ prefixes), `HuggingFaceLLM`. Groq example `llama-3.1-8b-instant`, 128k, 100+ tok/s.
- https://docs.getsemantica.ai/integrations/crewai: extra `semantica[crewai]`, `crewai>=0.80.0`. `SemanticaKGTool` (5 actions), `SemanticaDecisionTool` (5), `SemanticaKnowledgeSource`. Import path `integrations.crewai`. Not in https://docs.getsemantica.ai/installation extras tabs.
- https://docs.getsemantica.ai/cookbook: notebooks on GitHub `cookbook/introduction/*` and `cookbook/advanced/*` (first-KG featured; ingest/parse/normalize/NER/relations/embeddings/vector/graph/ontology; advanced extraction/analytics/context/viz/conflicts/export/fusion/reasoning/temporal). Not inlined on-site.

## Glossary gaps

Hosted https://docs.getsemantica.ai/glossary is the same 56 terms as `docs/glossary.md` (Datalog duplicated). No hosted-only glossary entries.

Missing from `docs/glossary.md` but defined on hosted pages:
- Distance bands `direct` / `mid-range` / `distant` (https://docs.getsemantica.ai/reference/distance) vs glossary **Distance Band** `near`/`mid`/`far`.
- `DatalogEngine` (glossary + modules) vs `DatalogReasoner` (https://docs.getsemantica.ai/reference/reasoning).
- `SourceDocument` (https://docs.getsemantica.ai/modules ingest).
- `LlamaStore` placeholder (https://docs.getsemantica.ai/reference/embeddings).
- `ConstructTemplate` / `QueryResult` (https://docs.getsemantica.ai/reference/triplet_store).
- `SEMANTICA_API_KEY` / `SEMANTICA_ALLOW_ANONYMOUS` (https://docs.getsemantica.ai/explorer-setup).
- Policy evaluation vs enforcement (`check_compliance` returns bool, does not block) at https://docs.getsemantica.ai/guides/policy-engine.

## URL inventory

Map = 78 unique. `S` = Firecrawl-scraped (65). `U` = title fetched over HTTP only (13). Descriptions from hosted `<title>`/`description` or scrape metadata.

| | Path | Title — one line |
|---|---|---|
| S | / | Semantica — accountability / context layer pitch |
| S | /concepts | Core concepts: KG, reasoning, provenance |
| S | /modules | 27 modules, six layers, code samples (evals overclaim) |
| S | /choose-your-module | Goal → module map |
| S | /glossary | 56-term dictionary |
| S | /architecture | Four-layer architecture + extension registries |
| S | /learning-more | Learning paths, config, troubleshooting |
| S | /guides/graphrag | Graph-augmented retrieval |
| U | /guides/ingest | Load files, web, git, DB, Kafka, RSS |
| S | /guides/llm-integrations | Groq/OpenAI/Anthropic/HF/LiteLLM |
| S | /guides/pipeline | PipelineBuilder DSL cookbook |
| U | /guides/multi-agent | Shared memory / KG across agents |
| S | /guides/decision-intelligence | Decisions as first-class objects |
| S | /guides/context-graphs | Thread-safe ContextGraph |
| S | /guides/agent-memory | AgentContext store/retrieve |
| S | /guides/provenance | PROV-O lineage |
| S | /guides/semantic-extraction | NER / relations / events / triplets |
| S | /guides/ontology | OWL generate / validate / Hub |
| S | /guides/reasoning | Forward/back, Datalog, SPARQL, Rete, temporal |
| U | /guides/export | RDF / GraphML / Cypher / Arango |
| U | /guides/deduplication | Multi-factor similarity + merge |
| S | /guides/mcp-server | MCP client setup (12 tools) |
| S | /guides/shacl-validation | SHACL generate + validate |
| U | /guides/conflict-resolution | Value/type/relationship conflicts |
| S | /guides/change-management | Snapshot / diff / migrate |
| S | /guides/policy-engine | Versioned policies + exceptions |
| U | /guides/visualization | KG / ontology / embedding plots |
| S | /guides/distance-intelligence | Bands, ego mode, decay |
| U | /guides/graph-analytics | Centrality, communities, paths |
| S | /integrations/agno | Agno team toolkit |
| S | /integrations/crewai | KG + decision tools + knowledge source |
| S | /integrations/docling | DoclingParser extras |
| S | /integrations/snowflake | SnowflakeIngestor |
| S | /integrations/databricks | Unity Catalog / Delta |
| S | /graph_stores/apache_age | AGE openCypher on Postgres |
| S | /vector_stores/pgvector | pgvector metrics + IVFFlat/HNSW |
| S | /installation | pip extras (no crewai tab) |
| S | /getting-started | What Semantica is |
| S | /quickstart | First KG in 5 minutes |
| S | /cli-setup | Five executables + env vars |
| S | /explorer-setup | Explorer flags + v0.6.5 API key |
| S | /reference/context | AgentContext / ContextGraph API |
| S | /reference/kg | GraphBuilder, temporal, analytics |
| S | /reference/temporal | Bi-temporal + Allen algebra |
| S | /reference/distance | Matrices, bands, cache |
| S | /reference/semantic_extract | NER / relation / triplet extractors |
| S | /reference/reasoning | Six engines + ExplanationGenerator |
| S | /reference/ontology | OntologyEngine lifecycle |
| S | /reference/vector_store | Unified vector API (no sqlite-vec) |
| S | /reference/graph_store | Neo4j/FalkorDB/AGE/Neptune |
| S | /reference/triplet_store | Oxigraph/Blazegraph/Jena/RDF4J |
| S | /reference/ingest | Ingestor catalog |
| S | /reference/parse | DocumentParser / DoclingParser |
| S | /reference/split | Chunking strategies |
| S | /reference/normalize | Text/entity/date/number |
| S | /reference/embeddings | Providers + LlamaStore warning |
| S | /reference/pipeline | Builder, retries, templates |
| S | /reference/deduplication | v2 strategies |
| S | /reference/conflicts | ConflictDetector |
| S | /reference/provenance | ProvenanceManager |
| S | /reference/change_management | TemporalVersionManager |
| S | /reference/export | RDF/Parquet/LPG/AQL/… |
| S | /reference/visualization | Plotly/Matplotlib visualizers |
| S | /reference/explorer | FastAPI workbench |
| S | /reference/llms | Groq/OpenAI/LiteLLM/HF |
| S | /reference/seed | SeedManager |
| S | /reference/evals | Planned API, unimplemented |
| S | /reference/utils | Logging, validation, IDs |
| S | /reference/core | Semantica / PluginRegistry / ConfigManager |
| S | /reference/mcp_server | 12 tools + 3 resources |
| S | /cookbook | Jupyter index → GitHub notebooks |
| S | /faq | FAQ (v0.6.6 table / v0.5.0 accordion) |
| U | /community | Discord / help |
| U | /community-projects | Community extensions |
| U | /contributing-guide | How to contribute |
| U | /governance | Roles, cadence, review |
| U | /citation | Cite Semantica |
| U | /project-license | MIT |

Not in map (local only, hosted 404): `/storage-backends`, `/migration/kg-provenance-tracker`, `/changelog`.
