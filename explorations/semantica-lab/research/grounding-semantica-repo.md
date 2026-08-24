## 1. Stack and shape

- Scope/method: local checkout `/home/elpresidank/YeeBois/workstation-apps/semantica` at `add1c006cd8c502f6f2981e251e9e9a0f774870d` (`danklocal`, clean when inspected); paths below are repo-relative. Counts are static source inventory, not a test run.
- Product shape: one setuptools Python distribution plus a React/Vite/TypeScript Explorer frontend; `pyproject.toml` packages `semantica*` and `integrations*`, exposes `semantica`, `semantica-server`, `semantica-worker`, `semantica-explorer`, and `semantica-mcp`, while the separate root `mcp/` package is not included (`pyproject.toml`).
- Layout: `semantica/` is the 27-module library and services; `explorer/` is the browser UI; `integrations/` contains Agno, CrewAI, and OpenClaw bridges; `tests/`, `docs/`, `cookbook/`, and `deploy/` are substantial supporting trees (`pyproject.toml`, `explorer/package.json`, `integrations/`).
- Languages/scale: about 184,267 physical Python lines under `semantica/`, 3,980 under `integrations/`, 1,613 in the unpackaged root `mcp/`, 29,037 JS/TS/TSX lines in `explorer/src/`, and 101,626 Python test lines under `tests/`; this is a large codebase, not a façade.
- Runtime stack: Python >=3.8; NumPy/Pandas/SciPy/scikit-learn/UMAP, spaCy/Transformers/Torch/SentenceTransformers, RDFLib/NetworkX, Pydantic v2, FAISS/FastEmbed/ONNX, parsing/media libraries, Plotly/Matplotlib, Click/Rich/Loguru; optional extras add LLMs, SHACL, databases, graph/vector stores, queues/cloud, and agent frameworks (`pyproject.toml`).
- Frontend stack: React 19, TypeScript, Vite/Vitest, Sigma.js/graphology/ForceAtlas2, React Flow, Monaco, TanStack Query, Zustand, Recharts, and timeline/layout libraries (`explorer/package.json`).
- Test surface: static AST inventory found 275 `test*.py` files, about 5,311 test functions and 745 test classes, plus five frontend test files (`tests/`, `explorer/src/`); coverage spans virtually every module and many backend adapters, usually with mocks.
- CI caveat: the committed workflow runs three Explorer test scripts, builds the UI, resolves pinned dependencies, and builds/verifies the wheel, but does not run Python pytest, lint, typing, or coverage (`.github/workflows/ci.yml`). A large test tree therefore is not equivalent to a continuously enforced Python suite.
- Release/maturity signals: package version 0.6.6 self-classifies as “Production/Stable”; changelog releases moved from 0.2.2 (2026-01-15) through 0.6.6 (2026-08-20), but the newest Git tag is v0.6.5 (`pyproject.toml`, `CHANGELOG.md`). Fast cadence, broad tests/docs, and real integrations coexist with duplicated APIs, giant route/CLI files, and visible placeholders.
- Stub baseline: `evals` is wholly “Coming Soon”; notable internal gaps are fourteen empty declarations in ontology functional wrappers, simulated logical consistency/satisfiability, unimplemented SPARQL execution, and random-vector fallbacks (`semantica/evals/__init__.py`, `semantica/ontology/methods.py`, `semantica/ontology/ontology_validator.py`, `semantica/reasoning/sparql_reasoner.py`, `semantica/vector_store/vector_store.py`).

## 2. Verified module inventory

The advertised count is exact: excluding `__pycache__`, the real `semantica/` tree has the 21 modules assigned to six layers plus six utilities, exactly matching `docs/modules.md`. Grades mean **solid** = meaningful implementations and tests across the principal surface, **partial** = useful implementation with a material missing path/drift, **stub** = advertised surface substantially absent.

### Input layer

- `ingest` — **solid**: file/web/feed/API/public-API, SQL/DuckDB/Mongo/Elastic, Pandas, GDrive/Hugging Face, Databricks/Snowflake, Arrow/Parquet/XML/email/repository/stream/MCP ingestors, source models, and SSRF/network controls (`semantica/ingest/`).
- `parse` — **solid**: dispatch and parsers for PDF, DOCX, PPTX, HTML, tabular/JSON/XML/Excel, image/media/email/code/web, MCP, and optional Docling (`semantica/parse/`).
- `split` — **solid**: sliding, structural, semantic, table, graph/entity/relation/ontology/community chunkers plus chunk provenance (`semantica/split/`).
- `normalize` — **solid**: text, entity, date, number, encoding, and language normalization with configurable data cleaning (`semantica/normalize/`).

### Core processing

- `semantic_extract` — **solid**: NER, relations/triplets/events, coreference, semantic networks, extraction validation, provider pooling/cache, and Pydantic output schemas (`semantica/semantic_extract/`).
- `kg` — **solid**: graph builder/resolver/validator, analytics, centrality/community/path/link prediction, node embeddings, and temporal graph/query/reasoning/snapshots (`semantica/kg/`).
- `ontology` — **partial**: substantial heuristic/LLM generation, OWL/SHACL/SKOS/alignment/version code, but the public functional wrappers are empty and logical reasoner validation is simulated (`semantica/ontology/methods.py`, `semantica/ontology/ontology_validator.py`).
- `reasoning` — **partial**: forward/backward, deductive, Datalog, Rete, abductive, temporal, graph/LLM, and explanation code are real, but `SPARQLReasoner.execute_query` always raises (`semantica/reasoning/`).

### Storage

- `embeddings` — **partial**: SentenceTransformers, FastEmbed, OpenAI, BGE, deterministic hash fallback, pooling/managers, and provenance exist; `LlamaStore` is an unreachable random placeholder (`semantica/embeddings/text_embedder.py`, `semantica/embeddings/provider_stores.py`).
- `vector_store` — **solid**: in-memory, FAISS, Qdrant, Weaviate, Pinecone, Milvus, PgVector, and sqlite-vec contain backend-specific client/query code; capabilities differ and top-level embedding failure silently degrades to random vectors (`semantica/vector_store/`).
- `graph_store` — **solid**: Neo4j, FalkorDB, Amazon Neptune, and Apache AGE adapters use their actual drivers/protocols and Cypher/OpenCypher paths (`semantica/graph_store/`).
- `triplet_store` — **solid**: embedded Oxigraph plus HTTP SPARQL adapters for Blazegraph, Jena Fuseki, RDF4J, and Anzo, with query/bulk/named-graph support; one legacy convenience delete still raises despite the core store supporting delete (`semantica/triplet_store/`).

### Quality assurance

- `deduplication` — **solid**: similarity/blocking, duplicate detection/clustering, merge strategies, and provenance (`semantica/deduplication/`).
- `conflicts` — **solid**: source tracking; type/value/relationship/temporal/logical conflict detection; analysis, investigation, resolution, and provenance (`semantica/conflicts/`).

### Context and memory

- `context` — **solid**: `ContextGraph`, agent context/memory, decisions, causal analysis/query, entity linking, policy, Markdown filesystem memory, and broad tests (`semantica/context/`).
- `provenance` — **solid**: rich provenance entries, in-memory/SQLite stores, lineage/descendants, invalidation, integrity/hash chaining, wrappers, and PROV-O RDF export (`semantica/provenance/`).
- `change_management` — **solid**: in-memory/SQLite snapshot stores, temporal and ontology managers, checksums, diffs, tags, rollback/history, mutations, and reports, albeit with overlapping version-manager APIs (`semantica/change_management/`).

### Output and orchestration

- `export` — **solid**: RDF, JSON/JSON-LD, CSV, YAML, OWL, Arrow/Parquet, GraphML/GEXF/DOT, vector/NumPy/FAISS, Cypher LPG, Neo4j CSV, AQL, and report/distance exporters (`semantica/export/`).
- `visualization` — **solid**: Plotly/Matplotlib views for knowledge graphs, ontology, embeddings, semantic networks, temporal evolution, and analytics, with force/hierarchical/circular layouts (`semantica/visualization/`).
- `pipeline` — **partial**: fluent DAG construction, validation, serialization, retry policies, failure/resource helpers, and delta steps exist, but the primary engine topologically sorts then executes a single sequential `current_data` chain and never uses `ParallelismManager` (`semantica/pipeline/execution_engine.py`, `semantica/pipeline/parallelism_manager.py`).
- `explorer` — **solid**: a large FastAPI graph/decision/temporal/ontology/provenance API plus a substantial React graph workbench and websockets (`semantica/explorer/`, `explorer/src/`).

### Utilities

- `llms` — **partial**: OpenAI, Groq, Hugging Face, and LiteLLM wrappers work, but this API overlaps the separate eight-provider extraction factory (`semantica/llms/`, `semantica/semantic_extract/providers.py`).
- `mcp_server` — **partial**: a working stdio JSON-RPC server exposes 12 tools and three resources, but it is hand-rolled and diverges from an unpackaged root `mcp/` implementation with 17 tools (`semantica/mcp_server/__init__.py`, `mcp/`).
- `seed` — **solid**: source registry/loaders, foundation-graph assembly, merge, validation, export, and version tracking for bootstrapping graphs (`semantica/seed/`).
- `evals` — **stub**: only version/status metadata and an empty export list (`semantica/evals/__init__.py`).
- `core` — **partial**: high-level `Semantica` orchestration, configuration/lifecycle, and plugin discovery/loading exist, but orchestration remains dictionary/duck-typed and inherits pipeline limitations (`semantica/core/`).
- `utils` — **solid**: shared dataclasses/type aliases/protocols, validation, IDs/time, exceptions, structured logging, and progress displays (`semantica/utils/`).

## 3. Core abstractions

- Base-class shape is federated, not uniform: important ABCs are provider, version storage/manager, provenance storage, progress display, and layouts; generic `Processor`, `Validator`, `Exporter`, and `Importer` are only `Protocol`s and most modules expose independent classes plus their own registries (`semantica/semantic_extract/providers.py`, `semantica/change_management/version_storage.py`, `semantica/change_management/managers.py`, `semantica/provenance/storage.py`, `semantica/utils/types.py`).
- Data-model fragmentation is structural: extraction `Entity/Relation/Triplet` dataclasses use spans and entity-valued relation endpoints; `utils` defines different ID-based entity/relationship dataclasses; extraction also has Pydantic `EntityOut/RelationOut/TripletOut`; `KnowledgeGraph` stores lists of minimally constrained dictionaries (`semantica/semantic_extract/types.py`, `semantica/semantic_extract/schemas.py`, `semantica/utils/types.py`, `semantica/kg/knowledge_graph.py`).
- There is no canonical `Document`: ingestion has `FileObject`/source-specific outputs, parsers define format-specific result dataclasses, and splitters define their own `Chunk`/provenance structures (`semantica/ingest/file_ingestor.py`, `semantica/parse/`, `semantica/split/semantic_chunker.py`, `semantica/split/provenance_tracker.py`).
- Plugin system: `PluginRegistry` discovers Python files, imports modules with `importlib`, locates classes, checks only for `initialize`/`execute`, and recursively loads declared dependencies; it tracks lifecycle metadata but provides no process isolation, capability typing, or robust version-constraint solver (`semantica/core/plugin_registry.py`).
- Registration is duplicated: most modules own a class-level dictionary `MethodRegistry`; LLM providers, storage backends, plugins, and methods consequently have parallel discovery/configuration mechanisms (`semantica/*/registry.py`, `semantica/semantic_extract/providers.py`).
- Pipeline model: `PipelineStep` is a mutable dataclass containing name/type/config/dependencies plus a Python callable, status/result/error and delta fields; the builder validates missing dependencies/cycles and serializes configuration, but a callable itself is not a portable declarative step (`semantica/pipeline/pipeline_builder.py`).
- Execution/retry: main execution returns `ExecutionResult` rather than raising at its outer boundary, catches broad exceptions, blocks with `time.sleep`, and retries by policy; failure handling receives no attempt number, so its delay calculation is not clearly coupled to the loop's retry count (`semantica/pipeline/execution_engine.py`, `semantica/pipeline/failure_handler.py`).
- Parallelism claim: `set_parallelism` and a thread/process `ParallelismManager` exist, but `ExecutionEngine._execute_steps` always iterates the topological order, feeds each output into the next step, and cannot preserve distinct outputs from DAG branches (`semantica/pipeline/pipeline_builder.py`, `semantica/pipeline/execution_engine.py`, `semantica/pipeline/parallelism_manager.py`).
- Provenance core: `ProvenanceEntry` carries entity/activity/agent IDs, sources/quotes/locations, roles/delegation, generated/used times, derivation/version links, bundle/invalidation fields, and checksum-chain metadata; memory and SQLite stores support lineage, descendants, invalidation and integrity (`semantica/provenance/schemas.py`, `semantica/provenance/storage.py`).
- The PROV-O claim is concrete at export: RDFLib emits `prov:Entity`, `Agent`, `Activity`, `wasGeneratedBy`, qualified associations/roles, delegation, `wasInformedBy`, derivations/usages, invalidation, and bundles (`semantica/provenance/manager.py`). It is not enforced “on every fact”: wrappers/mixins are opt-in and entity/triplet models do not require a provenance key.
- Change management: `VersionStorage` has in-memory and SQLite implementations; snapshots are JSON payloads with SHA-256, tags, mutations and entity history, while temporal/ontology managers provide snapshot/diff/restore/report flows (`semantica/change_management/version_storage.py`, `semantica/change_management/managers.py`).
- Ontology versioning is separately reimplemented in memory: versioned ontology IRIs, stable element IRIs, structural set/dict diffs, shallow import closure, and migration that mainly rewrites version/URI/`versionInfo`; it is not a general schema/data migration engine (`semantica/change_management/ontology_version_manager.py`).

## 4. Ontology and reasoning

- `OntologyEngine` composes generator, class/property inference, OWL output, evaluation, validation, LLM generation, triplet-store vocabulary/alignment operations, and versioning (`semantica/ontology/engine.py`). The functional facade advertised in `semantica/ontology/methods.py` is nevertheless fourteen bare `pass` statements plus registry lookup/ingest.
- Auto-generation is real but mostly heuristic: entities/relations become semantic-network dictionaries, inferred classes/properties/hierarchies, then RDFLib OWL; an alternate LLM path prompts for structured JSON (`semantica/ontology/ontology_generator.py`, `semantica/ontology/class_inferrer.py`, `semantica/ontology/property_generator.py`, `semantica/ontology/owl_generator.py`, `semantica/ontology/llm_generator.py`).
- SHACL is substantive: generator code creates node/property shapes, inheritance, cardinality/datatype/class constraints and basic/standard/strict profiles; runtime validation calls pySHACL and returns structured violations/explanations (`semantica/ontology/ontology_generator.py`, `semantica/ontology/ontology_validator.py`). By contrast, `OntologyValidator`'s HermiT/Pellet-style consistency and satisfiability branches are placeholders that return optimistic defaults.
- SKOS/alignment: namespace helpers and triplet-store queries support concept schemes, concepts, hierarchy/search and alignment predicates including OWL equivalence/sameAs and SKOS match relations (`semantica/ontology/engine.py`, `semantica/ontology/skos_namespaces.py`, `semantica/explorer/routes/vocabulary.py`).
- “Ontology Hub” is chiefly an Explorer route suite: registry/preview/load/create/search, vocabulary, alignment, health, SHACL, drafts/proposals/review/publish/comments and version comparison are present; only the registry has optional file persistence, while alignments, drafts, proposals, and versions default to `app.state` dictionaries (`semantica/explorer/routes/ontology.py`). It is a useful workbench, not a separately durable governance service.
- Domain auto-generation is narrower than its prose: `DomainOntologyGenerator` implements healthcare and finance templates, not five domain ontologies (`semantica/ontology/domain_ontologies.py`).
- Reasoning engines present: string-rule forward/backward `Reasoner`, `DeductiveReasoner`, fixpoint/unification `DatalogReasoner`, alpha/beta-network `ReteEngine`, ranked `AbductiveReasoner`, Allen-interval temporal reasoning, an LLM-prompt `GraphReasoner`, and query-expansion-only `SPARQLReasoner` (`semantica/reasoning/`, `semantica/kg/temporal_reasoning.py`).
- Explainability is partially real: `InferenceResult` records conclusion/rule/premises/confidence and `ExplanationGenerator` emits typed steps/paths for core, deductive proofs, and abductive explanations (`semantica/reasoning/reasoner.py`, `semantica/reasoning/explanation_generator.py`). It is not a common derivation protocol across Datalog, Rete, SPARQL and LLM reasoning; many paths are a single rule application, and provenance wrappers record an inference plus input metadata rather than a complete proof DAG (`semantica/reasoning/reasoning_provenance.py`).

## 5. Storage backends actually wired

- Embedding models: `TextEmbedder` uses FastEmbed `BAAI/bge-small-en-v1.5` by default, supports SentenceTransformers (documented alternate `all-MiniLM-L6-v2`) and deterministic SHA-256 fallback; provider stores add OpenAI `text-embedding-3-small`, local BGE, and FastEmbed (`semantica/embeddings/text_embedder.py`, `semantica/embeddings/provider_stores.py`). `LlamaStore` is explicitly placeholder code returning random normalized vectors and is omitted from its own factory.
- Vector stores: the unified facade wires `inmemory`, `faiss`, `qdrant`, `weaviate`, `pinecone`, `milvus`, `pgvector`, and `sqlite`; each external backend has substantive native SDK/SQL upsert/search/fetch/delete/filter code rather than a name-only adapter (`semantica/vector_store/vector_store.py`, `semantica/vector_store/*_store.py`). Capability parity is uneven, and the facade's random fallback can make failed model loading look like successful indexing.
- Graph stores: Neo4j uses its driver/Cypher, FalkorDB its client/OpenCypher, Neptune boto3 IAM plus Bolt/OpenCypher, and Apache AGE psycopg/Cypher-over-SQL (`semantica/graph_store/neo4j_store.py`, `semantica/graph_store/falkordb_store.py`, `semantica/graph_store/amazon_neptune.py`, `semantica/graph_store/age_store.py`). These are real optional integrations; no in-memory backend is offered by this facade.
- Triplet stores: `TripletStore.SUPPORTED_BACKENDS` is exactly Blazegraph, Jena, RDF4J, Anzo, and Oxigraph; Oxigraph is embedded via pyoxigraph and the other four issue real HTTP SPARQL requests, with bulk loading/query helpers and partial named-graph support (`semantica/triplet_store/triplet_store.py`, `semantica/triplet_store/*_store.py`).
- Integration verdict: the listed vector/graph/triplet backends are materially wired, although most require optional packages/live services and tests commonly mock them. The clearest adapters-in-name-only are Llama embeddings and SPARQL reasoning; stale wrapper methods and fallback behavior, rather than absent backend code, are the larger reliability risk.

## 6. Interfaces

- Explorer API: FastAPI app factory, auth dependency, CORS/security middleware, websocket graph updates, and routes for graph search/path/distance, analytics/validation, decisions/causality/precedent/compliance, temporal snapshots/diffs/history, enrichment/extraction/reasoning/dedup/merge, import/export/session, annotations, SPARQL, provenance/reports, SKOS vocabulary, and Ontology Hub (`semantica/explorer/app.py`, `semantica/explorer/routes/`).
- Explorer UI: the React application is a real graph workbench using Sigma/graphology, ForceAtlas2, React Flow, Monaco and timeline/chart components; Vite output is copied into the Python wheel (`explorer/src/`, `explorer/package.json`, `.github/workflows/ci.yml`).
- Packaged MCP server: hand-written MCP/JSON-RPC over stdio with 12 tools: `extract_entities`, `extract_relations`, `record_decision`, `query_decisions`, `find_precedents`, `get_causal_chain`, `add_entity`, `add_relationship`, `run_reasoning`, `get_graph_analytics`, `export_graph`, `get_graph_summary`; it also exposes graph-summary, decisions-list and schema-info resources (`semantica/mcp_server/__init__.py`).
- MCP drift: the root `mcp/` companion exposes 17 tools, adding decision-impact, provenance, combined extraction, graph search and abductive reasoning variants, but setuptools does not package it (`mcp/server.py`, `mcp/tools/`, `pyproject.toml`).
- Unified LLM layer is only partly unified: `semantica.llms` wraps OpenAI, Groq, Hugging Face and LiteLLM; `semantic_extract` independently has native OpenAI, Gemini, Groq, Anthropic, Ollama, Hugging Face, DeepSeek and Novita providers plus custom registration/pooling (`semantica/llms/__init__.py`, `semantica/semantic_extract/providers.py`). LiteLLM supplies the long tail rather than dedicated provider classes.
- Export formats implemented: RDF/Turtle/RDF/XML/N-Triples/JSON-LD, JSON, CSV, YAML, OWL, Arrow, Parquet, GraphML/GEXF/DOT, vector JSON/NumPy/FAISS, Cypher LPG, Neo4j CSV, Arango AQL, provenance and distance/report outputs (`semantica/export/`).
- Visualization: Python Plotly/Matplotlib renderers cover graph topology/community/centrality/type matrices, ontology hierarchy/properties, embedding reduction/clusters, semantic networks, temporal evolution and analytics; the Explorer supplies the separate interactive Sigma/React surface (`semantica/visualization/`, `explorer/src/`).

## 7. Porting lens: TypeScript + Effect v4 ideas, not code

### Concepts worth stealing

1. First-class provenance events: source quote/location, entity/activity/agent/role, validity and generation time, derivation/version links, invalidation/tombstones, hash-chain integrity, lineage queries, and PROV-O projection.
2. Separate capability families for embeddings, vector search, property graphs, and RDF triplet stores, including explicit named-graph support and a canonical search-result shape.
3. `ContextGraph` plus typed decisions, causal chains, precedents and policy/compliance queries as an agent-memory substrate, rather than treating memory as only vector similarity.
4. Ontology lifecycle as one workflow: generate/import, SKOS/alignment, SHACL validate, diff/propose/review/publish, migrate, and preserve provenance.
5. Typed inference explanations containing conclusion, rule, premises, confidence and nested paths; retain the data structure and make prose a rendering.
6. Declarative dependency DAGs with cycle validation, retry policy, failure classification, resource requirements, graph-version ranges and delta execution.
7. Operation-level provenance instrumentation around extract/normalize/store/reason/export boundaries, implemented as composable services/aspects rather than per-module mixin copies.

### Weaknesses and Python-isms not to carry over

- Do not reproduce incompatible dataclass/Pydantic/dictionary models for Entity, Relation, Triplet, Chunk and Document, nor plain-string RDF objects that erase IRI-vs-literal/datatype/language distinctions.
- Avoid one mutable global `MethodRegistry` per module, duplicate LLM/MCP/version-manager stacks, import-time singleton caches, process-local Hub governance state, and `hasattr`/signature introspection as capability negotiation.
- Avoid broad `except Exception`, log-and-continue semantics, and especially random embeddings as a success-shaped fallback; absence, configuration failure, provider failure and degraded mode need distinct typed failures.
- Do not port blocking `time.sleep` retries or the current sequential data-threading implementation under a “parallel” DAG API; branches need keyed inputs/outputs, bounded fibers, cancellation, timeouts and scoped resources.
- Avoid embedding raw Python callables inside supposedly serializable pipeline definitions; use a tagged step algebra interpreted by registered services.
- Split oversized surfaces (`semantica/cli.py`, `semantica/explorer/routes/ontology.py`) and make Python-equivalent unit/integration/type/coverage gates mandatory in CI rather than merely keeping a large dormant test tree.

### Where schema-first Effect is structurally better

- Define one `Schema.TaggedClass`/tagged-union family for `DocumentSource`, parsed document, chunk, entity, relation, RDF term/triplet, graph mutation, inference event, provenance event, pipeline step, backend capability and every public error; decode at ingestion, persistence, HTTP/MCP and plugin boundaries.
- Brand/refine URI, entity ID, activity ID, confidence, vector dimension, checksum, temporal interval and ontology version; represent RDF objects as `Iri | Literal { value, datatype, language }`, not `str`.
- Express embedding/vector/graph/triplet/LLM/provenance/version services as Effect `Context` tags with backend `Layer`s and `Scope`/`acquireRelease` for connections; make supported operations explicit capabilities instead of runtime introspection.
- Use tagged error channels, `Schedule` retry/backoff, timeout/circuit-breaker policies, `Stream`/`Queue` for ingest and graph mutations, and fibers with bounded concurrency for each ready DAG level.
- Make provenance and version history immutable append-only events with transaction/outbox coordination; derive current snapshots and PROV-O/RDF views instead of mutating several overlapping manager stores.
- Derive JSON Schema, OpenAPI, MCP `inputSchema`, codecs, persisted snapshot migrations and test generators from the same Effect schemas, eliminating the current dataclass/Pydantic/dict and duplicate-MCP drift.
