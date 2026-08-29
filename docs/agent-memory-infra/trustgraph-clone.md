# TrustGraph Clone Assessment

## TL;DR

Verdict: LEARN + BUILD, not deploy-as-found. The local TrustGraph clone is a strong capability donor for provenance-aware GraphRAG/DocumentRAG, explainability traces, Context Core packaging, a Librarian-style document/processing boundary, and a sidecar API surface. It should not become the product runtime's system of record because this repo's binding memory doctrine keeps durable truth in exact, deterministic, provenance-backed records and treats semantic systems as managed caches or projections (`standards/memory-architecture/README.md:20-24`, `standards/memory-architecture/05-context-graph-capability-assessment.md:42-55`, `goals/agentic-professional-runtime/README.md:84-105`).

For Role A, TrustGraph should be used as a capability donor or optional rebuildable projection/retrieval sidecar behind `drivers/*`: port the named-graph provenance model, query-time explainability DAG, retrieval limits, source-document tracing, and document-library processing pattern; do not port the Python/pub-sub service platform, Cassandra/object-store defaults, broad agent runtime, or schema-light triples as authority (`upstream/trustgraph/trustgraph-base/trustgraph/provenance/namespaces.py:142-146`, `upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/graph_rag/graph_rag.py:615-815`, `upstream/trustgraph/README.md:88-118`, `docs/BEEPGRAPH_ARCHITECTURE.md:151-177`).

For Role B, TrustGraph can be a high-recall dev-tooling memory lab when already running, but it is too heavy to be the default Claude/Codex memory substrate: the upstream stack bundles Cassandra, Qdrant, Garage, Pulsar/RabbitMQ, and LLM services, while the TS port still runs NATS, FalkorDB, Qdrant, Ollama, observability, gateway, pipeline, and retrieval services (`upstream/trustgraph/README.md:113-129`, `upstream/trustgraph/ts/deploy/docker-compose.yml:20-88`, `upstream/trustgraph/ts/deploy/docker-compose.yml:209-353`, `upstream/trustgraph/ts/deploy/docker-compose.yml:355-500`).

The prior repo claim that TrustGraph leads provenance is confirmed. The prior "trust scoring" wording should be softened: the clone has authority-ranking language and `tg:score` metadata for selected graph edges/chunks, but the files read do not show a product-grade accepted-claim trust/reputation lifecycle (`upstream/trustgraph/README.md:58-65`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/namespaces.py:61-80`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:572-583`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:785-790`).

## Hard-gate verdicts

1. Self-hostable/local-first: PASS, with an operational-weight caveat. TrustGraph says it needs no third-party services except optional cloud LLM/OCR/API integrations, supports local LLM stacks, and deploys with Docker/Podman locally or Kubernetes in cloud (`upstream/trustgraph/README.md:29-31`, `upstream/trustgraph/README.md:97-118`). The quickstart generates Docker/Podman compose or Kubernetes resources, and the installer explicitly recommends Docker/Podman compose with bundled Cassandra, Qdrant, Garage, and RabbitMQ/Pulsar defaults (`upstream/trustgraph/README.md:120-130`, `upstream/trustgraph/install_trustgraph.sh:2157-2161`). The caveat is footprint: the installer checks CPU, memory, and GPU, recommends local Ollama only around 16 GB memory plus GPU or 8 cores, and recommends hosted OpenAI-compatible endpoints for tighter hardware (`upstream/trustgraph/install_trustgraph.sh:1192-1290`).

2. OSI license without copyleft trap: PASS for TrustGraph itself. The clone's actual license file is Apache License 2.0 at `upstream/trustgraph/LICENSE`, with the Apache 2.0 header, copyright grant, patent grant, and redistribution terms present (`upstream/trustgraph/LICENSE:2-4`, `upstream/trustgraph/LICENSE:67-88`, `upstream/trustgraph/LICENSE:90-129`). The README also states Apache 2.0 (`upstream/trustgraph/README.md:179-195`). Dependency licenses still need separate review before shipping a full stack; the TS compose stack directly pulls `falkordb/falkordb:latest`, and this repo's donor note already flags FalkorDB as the separate non-permissive projection-engine risk (`upstream/trustgraph/ts/deploy/docker-compose.yml:43-44`, `explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md:343-348`).

3. TS-native or clean HTTP/MCP API: PASS. Upstream TrustGraph remains Python/service-platform oriented, but it exposes a modular OpenAPI REST gateway, a multiplexed WebSocket API, a documented Python client, a TypeScript client, and MCP servers/tools (`upstream/trustgraph/specs/api/README.md:1-53`, `upstream/trustgraph/specs/websocket/asyncapi.yaml:1-54`, `upstream/trustgraph/docs/python-api.md:96-154`, `upstream/trustgraph/ai-context/trustgraph-client/README.md:1-12`, `upstream/trustgraph/trustgraph-mcp/pyproject.toml:5-27`). The clone also contains a serious private TS port with Bun/Turbo/Effect beta scripts and dependencies, plus a TS MCP package built on Effect and `@trustgraph/client` (`upstream/trustgraph/ts/package.json:1-71`, `upstream/trustgraph/ts/packages/mcp/package.json:1-20`, `upstream/trustgraph/ts/packages/mcp/src/server-effect.ts:1-18`).

## Architecture & storage

TrustGraph's conceptual model is a holonic context system: entities, relationships, and evidence are first-class, every agent query is grounded against graph plus embeddings, and every answer carries provenance (`upstream/trustgraph/README.md:47-53`). Its deployable knowledge unit is the Context Core, containing ontology, holon facts, embeddings, provenance, and retrieval policies such as freshness controls and authority ranking (`upstream/trustgraph/README.md:54-65`).

The runtime isolation model is Workspace -> Collection -> Flow. Workspaces isolate data/config/pipelines at pub/sub, storage, and gateway layers; Collections group holons, embeddings, and documents; Flows run ingestion, extraction, structuring, and storage pipelines (`upstream/trustgraph/README.md:78-86`). The FlowProcessor base class keeps flow state by `(workspace, flow)` and starts/stops configured flow variants from config updates (`upstream/trustgraph/trustgraph-base/trustgraph/base/flow_processor.py:23-40`, `upstream/trustgraph/trustgraph-base/trustgraph/base/flow_processor.py:53-107`).

The upstream Python package is a service mesh, not a small library. Its dependency list includes Cassandra/Scylla, FAISS, FalkorDB, MinIO, Neo4j, Pulsar, Milvus, Qdrant, Pinecone, RDFLib, Strawberry GraphQL, MCP, and LLM provider clients; its scripts expose gateway, IAM/no-auth, config, flow, chunking, embedding, GraphRAG, DocumentRAG, KG extraction, Librarian, MCP tool, row/triple stores, vector stores, SPARQL, structured query, and multiple LLM services (`upstream/trustgraph/trustgraph-flow/pyproject.toml:12-49`, `upstream/trustgraph/trustgraph-flow/pyproject.toml:58-133`).

The ingestion pipeline is Librarian -> PDF decoder -> chunker -> knowledge extraction, with outputs to triples, entity contexts, rows, and document embeddings (`upstream/trustgraph/docs/tech-specs/extraction-flows.md:9-25`). Source documents, pages, and chunks live in S3-compatible blob storage; document metadata lives in Cassandra; content is sent inline below 2 MB and fetched by document ID for larger content (`upstream/trustgraph/docs/tech-specs/extraction-flows.md:27-48`).

The storage model is explicitly multi-store. Triple storage is Cassandra by default with named graphs for core facts, extraction provenance, and query-time explainability; graph vectors and document vectors can use Qdrant, Milvus, or Pinecone; row storage is Cassandra (`upstream/trustgraph/docs/tech-specs/extraction-flows.md:275-304`). The Cassandra triple writer stores collection, subject, predicate, object, named graph, object type, datatype, and language in an entity-centric graph (`upstream/trustgraph/trustgraph-flow/trustgraph/storage/triples/cassandra/write.py:168-191`). The FalkorDB writer projects triples into `Node`, `Literal`, and `Rel` property-graph records scoped by workspace and collection (`upstream/trustgraph/trustgraph-flow/trustgraph/storage/triples/falkordb/write.py:38-57`, `upstream/trustgraph/trustgraph-flow/trustgraph/storage/triples/falkordb/write.py:62-130`). The Qdrant document-embedding writer creates dimension-specific collections and stores vectors with `chunk_id` payloads (`upstream/trustgraph/trustgraph-flow/trustgraph/storage/doc_embeddings/qdrant/write.py:53-115`). The row writer targets a unified Cassandra `rows` table with collection, schema, index, data, and source fields (`upstream/trustgraph/trustgraph-flow/trustgraph/storage/rows/cassandra/write.py:1-14`).

The TypeScript port narrows the platform shape but still remains a distributed stack: `trustgraph-ts` has Bun/Turbo scripts for gateway, config, LLMs, prompt, agent, librarian, knowledge, flow manager, PDF decoder, triples store, graph embeddings, chunker, extractor, triples query, graph embeddings query, doc embeddings query, GraphRAG, DocumentRAG, and MCP tool services (`upstream/trustgraph/ts/package.json:17-46`). Its compose stack runs NATS JetStream, FalkorDB, Qdrant, Ollama, observability services, gateway, config, prompt, embeddings, workbench, agent, MCP tool, librarian, flow manager, knowledge cores, document pipeline, and retrieval/query services (`upstream/trustgraph/ts/deploy/docker-compose.yml:20-88`, `upstream/trustgraph/ts/deploy/docker-compose.yml:209-353`, `upstream/trustgraph/ts/deploy/docker-compose.yml:355-500`).

## Retrieval

GraphRAG is flow-scoped and works by identifying query entities via embeddings, retrieving a connected subgraph, optionally traversing paths, limiting the subgraph size, and passing query plus graph structure to an LLM (`upstream/trustgraph/specs/api/paths/flow/graph-rag.yaml:1-28`). The API exposes retrieval controls for entity limit, triple limit, max subgraph size, and max path length, which are exactly the kind of bounded knobs Beep should preserve when porting the pattern (`upstream/trustgraph/specs/api/paths/flow/graph-rag.yaml:42-53`).

The Python GraphRAG implementation extracts concepts, embeds them, queries graph-embedding matches concurrently, deduplicates seed entities, then performs hop-and-filter with a reranker and emits explainability at question, grounding, exploration, focus, and synthesis stages (`upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/graph_rag/graph_rag.py:171-220`, `upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/graph_rag/graph_rag.py:615-815`). It also traces selected graph edges back to source documents by following `tg:contains` and `prov:wasDerivedFrom` through the `urn:graph:source` named graph (`upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/graph_rag/graph_rag.py:449-561`).

DocumentRAG is flow-scoped semantic search over document embeddings: query -> embedding -> chunk search -> top-N chunks -> LLM synthesis (`upstream/trustgraph/specs/api/paths/flow/document-rag.yaml:1-27`). The implementation queries vector matches by concept, deduplicates chunks by `chunk_id`, fetches chunk content from Garage/librarian storage, optionally reranks/uses diversity selection, and emits explainability for question, grounding, exploration, chunk selection, and synthesis (`upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/document_rag/document_rag.py:88-146`, `upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/document_rag/document_rag.py:217-365`).

Both RAG APIs can stream `explain` messages with inline `explain_triples`, `explain_id`, and `explain_graph`, so a client can record or inspect provenance without issuing a follow-up graph query (`upstream/trustgraph/specs/api/paths/flow/graph-rag.yaml:29-39`, `upstream/trustgraph/specs/api/paths/flow/document-rag.yaml:28-39`). The GraphRAG service sends those triples to the explainability queue and the response stream, using `urn:graph:retrieval` as the named graph (`upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/graph_rag/rag.py:138-159`).

For Beep, the retrieval lesson is not "accept GraphRAG output." The repo doctrine says GraphRAG/OntologyRAG output remains a candidate producer until tied to evidence and accepted by policy/human boundaries (`standards/memory-architecture/05-context-graph-capability-assessment.md:30-40`, `standards/memory-architecture/05-context-graph-capability-assessment.md:518-533`). The right port is a bounded retrieval/explainability pipeline that feeds context packets and candidate claims, not accepted facts.

## Provenance/temporal/lifecycle

TrustGraph's strongest clone-confirmed asset is the provenance model. The code defines PROV-O constants such as `prov:Entity`, `prov:Activity`, `prov:Agent`, `prov:wasDerivedFrom`, `prov:wasGeneratedBy`, `prov:used`, `prov:wasAssociatedWith`, and `prov:startedAtTime` (`upstream/trustgraph/trustgraph-base/trustgraph/provenance/namespaces.py:7-17`). It also defines TrustGraph query-time predicates for concept, entity, selected edge, reasoning, score, document, selected chunk, and chunk selection (`upstream/trustgraph/trustgraph-base/trustgraph/provenance/namespaces.py:42-80`).

The three named-graph split is explicit: default graph for core facts, `urn:graph:source` for extraction provenance, and `urn:graph:retrieval` for query-time explainability (`upstream/trustgraph/trustgraph-base/trustgraph/provenance/namespaces.py:142-146`). The extraction-flow doc repeats the same separation at the storage layer (`upstream/trustgraph/docs/tech-specs/extraction-flows.md:277-285`).

Provenance builders attach graph IDs without mutating triples, create source-document PROV entities, and build subgraph provenance where a subgraph contains quoted extracted triples and is derived from a source chunk through a generated activity and agent (`upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:51-68`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:97-145`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:283-361`). Query-time focus triples record selected edges, concepts, cross-encoder scores, and reasoning; DocumentRAG focus records selected chunks and reranker scores (`upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:508-594`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:726-792`).

Temporal support exists as provenance timestamps and processing status, not as a complete bitemporal claim lifecycle. The provenance builders use `datetime.now(timezone.utc)` for extraction and query-time activities, and the Librarian API tracks processing status timestamps (`upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:318-347`, `upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/graph_rag/graph_rag.py:623-636`, `upstream/trustgraph/specs/api/paths/librarian.yaml:142-153`). I did not find, in the files read, a durable accepted-claim lifecycle with candidate/accepted/rejected/superseded states matching the agentic-professional-runtime primitive (`goals/agentic-professional-runtime/README.md:93-105`).

Trust scoring should be treated as partial. The README lists authority ranking inside Context Core retrieval policies, and the code stores scores for selected edges/chunks, but those scores are retrieval/reranker metadata rather than a full claim-trust model (`upstream/trustgraph/README.md:58-65`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/namespaces.py:61-80`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:572-583`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:785-790`). This matters because the repo taxonomy says Layer 4 needs provenance verification and trust scores as interference-management signals, while product authority still remains claim + evidence + provenance + lifecycle (`standards/memory-architecture/01-memory-layer-taxonomy.md:84-107`, `standards/memory-architecture/05-context-graph-capability-assessment.md:503-533`).

Lifecycle support is strongest around documents and flows. The document-load API is fire-and-forget, returns `202 Accepted`, and explicitly says no response data/status tracking for that endpoint; the Librarian API provides persistent document-library operations and processing status; FlowProcessor config starts/stops flow variants per workspace (`upstream/trustgraph/specs/api/paths/flow/document-load.yaml:12-30`, `upstream/trustgraph/specs/api/paths/flow/document-load.yaml:64-70`, `upstream/trustgraph/specs/api/paths/librarian.yaml:12-40`, `upstream/trustgraph/trustgraph-base/trustgraph/base/flow_processor.py:53-107`). Beep's `trustgraph-port` packet already chooses a stricter local workflow contract with deterministic identity, state, progress, budgets, audit, frozen revisions, and SQLite-first storage boundaries (`goals/trustgraph-port/SPEC.md:217-327`).

## Integration surface

TrustGraph exposes a clean API envelope despite its heavy internals. REST is documented as a modular OpenAPI 3.1 gateway with bearer-token auth and global/workspace/flow service tiers (`upstream/trustgraph/specs/api/README.md:1-53`). WebSocket access is a single persistent, multiplexed, asynchronous, streaming connection, with in-band bearer-token authentication resolved to identity and workspace context (`upstream/trustgraph/specs/websocket/asyncapi.yaml:1-54`).

The Python API is direct enough for sidecar experiments: `pip install trustgraph`, instantiate `Api(url="http://localhost:8088/")`, pick a flow, and call `graph_rag`; the API class covers flow management, KG operations, document processing, RAG queries, REST, and WebSocket patterns (`upstream/trustgraph/docs/python-api.md:1-28`, `upstream/trustgraph/docs/python-api.md:96-154`).

The TypeScript client is a real integration surface for Beep-facing wrappers: it is a framework-agnostic WebSocket client with auth, auto-reconnect, full TypeScript definitions, and zero runtime dependencies, and it exposes triples, graph embeddings, GraphRAG, agent, embeddings, and document operations (`upstream/trustgraph/ai-context/trustgraph-client/README.md:1-12`, `upstream/trustgraph/ai-context/trustgraph-client/README.md:45-125`). The package publishes types and declares Apache-2.0 (`upstream/trustgraph/ai-context/trustgraph-client/package.json:1-38`).

MCP support exists in two directions. TrustGraph can execute external MCP tools as a flow-scoped service where tools are registered, discovered, called with structured parameters, and return text or structured results (`upstream/trustgraph/specs/api/paths/flow/mcp-tool.yaml:1-47`). TrustGraph also ships an MCP server package whose `mcp-server` script runs a streamable HTTP FastMCP server and registers tools for embeddings, text completion, GraphRAG, agent, triples, SPARQL, GraphQL, graph embeddings, config, prompts, token costs, Knowledge Cores, flows, documents, and processing (`upstream/trustgraph/trustgraph-mcp/pyproject.toml:5-27`, `upstream/trustgraph/trustgraph-mcp/trustgraph/mcp_server/mcp.py:320-401`).

The MCP server is not standalone memory; it is a gateway client. It creates per-caller WebSocket managers, forwards the caller's bearer token to the gateway, preserves workspace/capability scoping, and sends service envelopes over WebSocket (`upstream/trustgraph/trustgraph-mcp/trustgraph/mcp_server/tg_socket.py:17-99`, `upstream/trustgraph/trustgraph-mcp/trustgraph/mcp_server/tg_socket.py:146-216`). This is acceptable for a driver-wrapped sidecar, but it is a maintenance burden for default Claude/Codex memory.

The TS MCP port is promising but broad. It builds on Effect MCP/HTTP APIs and annotates tool safety metadata such as read-only/destructive/idempotent/open-world flags (`upstream/trustgraph/ts/packages/mcp/src/server-effect.ts:1-43`). It exposes read tools such as GraphRAG and DocumentRAG, but also mutating config tools such as `put_config` annotated as destructive (`upstream/trustgraph/ts/packages/mcp/src/server-effect.ts:127-240`, `upstream/trustgraph/ts/packages/mcp/src/server-effect.ts:498-617`). A Beep adapter should expose a narrow read-only subset aligned with `goals/trustgraph-port` rather than the whole tool surface (`goals/trustgraph-port/SPEC.md:31-43`, `goals/trustgraph-port/PLAN.md:59-80`).

## License & maturity

License maturity is good for source reuse: TrustGraph is Apache-2.0 in the clone's `LICENSE`, and Apache 2.0 includes permissive copyright and patent grants plus redistribution conditions (`upstream/trustgraph/LICENSE:2-4`, `upstream/trustgraph/LICENSE:67-129`). The README's license block matches the file (`upstream/trustgraph/README.md:179-195`).

Product maturity is mixed. Positive evidence: the project has a root quickstart, UI feature list, OpenAPI/AsyncAPI specs, Python API docs, a TS client, MCP, and many runnable service entrypoints (`upstream/trustgraph/README.md:120-173`, `upstream/trustgraph/specs/api/README.md:1-80`, `upstream/trustgraph/specs/websocket/asyncapi.yaml:1-75`, `upstream/trustgraph/docs/python-api.md:96-154`, `upstream/trustgraph/trustgraph-flow/pyproject.toml:58-133`). Negative evidence: at least one technical spec in the clone still contains unresolved merge-conflict markers, which weakens confidence in documentation hygiene (`upstream/trustgraph/docs/tech-specs/extraction-flows.md:311-335`).

Operational maturity is real but heavyweight. The installer handles host OS/architecture/CPU/memory/GPU detection and steers LLM mode based on local resources, but its own guidance asks for Docker/Podman compose and bundled Cassandra, Qdrant, Garage, and RabbitMQ/Pulsar defaults (`upstream/trustgraph/install_trustgraph.sh:1192-1290`, `upstream/trustgraph/install_trustgraph.sh:2157-2173`). Bootstrap docs also show Pulsar topology setup as a deployment-level concern, creating tenant and namespaces before config/flow services can come online (`upstream/trustgraph/docs/tech-specs/bootstrap.md:23-35`, `upstream/trustgraph/docs/tech-specs/bootstrap.md:181-194`).

The clone is mature enough to mine patterns and run as a lab, but too broad to import as product infrastructure by default. That matches the repo's existing TrustGraph-port plan, which explicitly ports only the curated document library, processing queue, repo-native indexing, bounded retrieval packet, and deterministic MCP answer, while excluding full TrustGraph topology, Cassandra/object-store assumptions, vector retrieval, generic MCP tools, agent runtime, and distributed deployment (`goals/trustgraph-port/SPEC.md:9-19`, `goals/trustgraph-port/SPEC.md:53-82`, `goals/trustgraph-port/SPEC.md:101-115`).

## Role A assessment

Role A verdict: use TrustGraph as a donor/projection sidecar only, not as product-runtime memory authority. The product requires a local-first governed workspace where durable assertions carry evidence, provenance, lifecycle, and cost, with the authoritative primitive defined as claim + evidence + provenance and accepted only after review/policy gates (`goals/agentic-professional-runtime/README.md:65-105`). The memory standard says semantic products are managed caches and every semantic fact must trace to deterministic source or uncertainty, while the context-graph addendum says external services may produce candidates, caches, context packets, retrieval hints, and UX, not sources of truth (`standards/memory-architecture/README.md:34-42`, `standards/memory-architecture/05-context-graph-capability-assessment.md:6-15`).

What is worth porting: the named-graph split, PROV-O trace shape, query-time explainability stages, source-document tracing, retrieval limit knobs, Context Core packaging, separate graph-vs-document embeddings, and Librarian document/processing boundary (`upstream/trustgraph/trustgraph-base/trustgraph/provenance/namespaces.py:142-146`, `upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/graph_rag/graph_rag.py:615-815`, `upstream/trustgraph/specs/api/paths/librarian.yaml:12-40`, `upstream/trustgraph/README.md:54-65`, `upstream/trustgraph/docs/tech-specs/extraction-flows.md:223-304`). These fit the BeepGraph design: Effect/typed authority spine plus TrustGraph-style projection/retrieval shell (`docs/BEEPGRAPH_ARCHITECTURE.md:13-31`, `docs/BEEPGRAPH_ARCHITECTURE.md:180-198`, `docs/BEEPGRAPH_ARCHITECTURE.md:236-242`).

What should not be ported wholesale: the FlowProcessor mesh, gateway/flow topology, Cassandra/Garage/Pulsar/RabbitMQ operational defaults, schema-light triple store as authority, generic agent runtime, prompt/text-completion services, and full MCP tool execution surface (`upstream/trustgraph/README.md:88-118`, `upstream/trustgraph/trustgraph-flow/pyproject.toml:58-133`, `upstream/trustgraph/trustgraph-base/trustgraph/base/flow_processor.py:23-107`, `upstream/trustgraph/trustgraph-mcp/trustgraph/mcp_server/mcp.py:365-401`). The local port packet already codifies that Beep should adapt document-library and processing-kernel behavior into Effect services, schema-first models, explicit stores, SQLite-first durability, grounded packets, and one narrow read MCP tool (`goals/trustgraph-port/SPEC.md:31-82`, `goals/trustgraph-port/PLAN.md:7-80`, `goals/trustgraph-port/research/capability-map.md:9-31`).

Postgres alignment: TrustGraph itself is not Postgres-aligned; upstream defaults are Cassandra plus object store plus vector DB, and the TS lab stack uses NATS/FalkorDB/Qdrant/Ollama rather than Postgres (`upstream/trustgraph/README.md:91-118`, `upstream/trustgraph/docs/tech-specs/extraction-flows.md:275-304`, `upstream/trustgraph/ts/deploy/docker-compose.yml:20-88`). The compatible Beep pattern is to keep external infrastructure wrappers, including Postgres-compatible storage, behind `drivers/*`, store current runtime truth plus append-only activities/provenance/evidence in product-owned data authority, and use graph/vector systems as rebuildable projections/caches (`goals/agentic-professional-runtime/SPEC.md:187-213`, `standards/memory-architecture/05-context-graph-capability-assessment.md:47-55`, `standards/memory-architecture/05-context-graph-capability-assessment.md:518-533`, `docs/BEEPGRAPH_ARCHITECTURE.md:188-198`).

Role A final call: TrustGraph should influence BeepGraph's L4 recall shell and maybe serve as an experiment runner behind `drivers/*`, but accepted runtime state must remain product-owned claim/evidence/provenance/lifecycle data authority, with Postgres-compatible storage as a driver choice and graph views rebuilt from accepted records (`goals/agentic-professional-runtime/SPEC.md:187-213`, `docs/BEEPGRAPH_ARCHITECTURE.md:236-242`).

## Role B assessment

Role B verdict: useful lab memory, poor default coding-agent memory. Recall quality should be strong for document/graph corpora once ingested because TrustGraph combines graph entity retrieval, graph/document embeddings, reranking, source tracing, and explainability streams (`upstream/trustgraph/specs/api/paths/flow/graph-rag.yaml:12-53`, `upstream/trustgraph/specs/api/paths/flow/document-rag.yaml:12-47`, `upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/graph_rag/graph_rag.py:615-815`, `upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/document_rag/document_rag.py:217-365`).

MCP reliability is credible but stack-dependent. The Python MCP server is a streamable HTTP facade over gateway WebSockets, uses per-caller WebSocket managers, forwards bearer tokens, and depends on gateway-side auth/workspace checks (`upstream/trustgraph/trustgraph-mcp/trustgraph/mcp_server/mcp.py:320-401`, `upstream/trustgraph/trustgraph-mcp/trustgraph/mcp_server/tg_socket.py:17-99`, `upstream/trustgraph/trustgraph-mcp/trustgraph/mcp_server/tg_socket.py:146-216`). That is better than an ad-hoc local daemon, but it means a coding-agent memory workflow is only as reliable as the gateway, broker, storage services, flow configuration, and auth wiring.

Local resource footprint is the blocker. Upstream local install guidance includes Cassandra, Qdrant, Garage, RabbitMQ/Pulsar, and optional local LLMs; the TS lab stack still requires NATS, FalkorDB, Qdrant, Ollama, observability, gateway, pipeline, and retrieval services (`upstream/trustgraph/README.md:113-129`, `upstream/trustgraph/install_trustgraph.sh:2157-2173`, `upstream/trustgraph/ts/deploy/docker-compose.yml:20-88`, `upstream/trustgraph/ts/deploy/docker-compose.yml:209-500`). The installer's resource heuristics also imply that local LLM operation is not assumed on small machines (`upstream/trustgraph/install_trustgraph.sh:1240-1269`).

Maintenance burden is high for Claude/Codex default memory. The service list is broad, the MCP tool surface includes mutation/config/flow/document operations, and docs still contain at least one unresolved conflict marker (`upstream/trustgraph/trustgraph-flow/pyproject.toml:58-133`, `upstream/trustgraph/trustgraph-mcp/trustgraph/mcp_server/mcp.py:365-401`, `upstream/trustgraph/docs/tech-specs/extraction-flows.md:311-335`). A safer dev-tooling path is a narrow read-only MCP adapter over Beep's deterministic repo memory or over a prebuilt TrustGraph projection, not a default always-on TrustGraph stack.

## Contradictions with prior repo assessments

`03-saas-landscape-assessment.md` says TrustGraph has graph/vector/row/object storage, combines GraphRAG and DocumentRAG, and has the strongest explainability/provenance story; the clone confirms this with README storage claims, extraction-flow store breakdown, RAG API specs, named graph constants, and GraphRAG explainability code (`standards/memory-architecture/03-saas-landscape-assessment.md:44-58`, `upstream/trustgraph/README.md:88-118`, `upstream/trustgraph/docs/tech-specs/extraction-flows.md:275-304`, `upstream/trustgraph/specs/api/paths/flow/graph-rag.yaml:12-39`, `upstream/trustgraph/specs/api/paths/flow/document-rag.yaml:12-39`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/namespaces.py:142-146`).

`03-saas-landscape-assessment.md` also says "trust/reputation scoring" is a quality signal; the clone partially refutes the strength of that wording. Evidence read shows authority-ranking language and score predicates for retrieval/reranker selections, not a full accepted-claim trust/reputation lifecycle (`standards/memory-architecture/03-saas-landscape-assessment.md:48-58`, `upstream/trustgraph/README.md:58-65`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/namespaces.py:61-80`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:572-583`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:785-790`).

`05-context-graph-capability-assessment.md` says TrustGraph should win provenance/context-graph influence, but not package topology, runtime authority, or source-of-truth status; the clone strongly confirms this. The provenance code is the best part, while the service/dependency topology remains Python/platform-heavy and conflicts with Beep's required implementation constraints (`standards/memory-architecture/05-context-graph-capability-assessment.md:62-99`, `standards/memory-architecture/05-context-graph-capability-assessment.md:518-557`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py:283-361`, `upstream/trustgraph/trustgraph-flow/pyproject.toml:12-49`, `upstream/trustgraph/trustgraph-flow/pyproject.toml:58-133`).

`21-external-memory-kg-donors.md` says Beep borrows TrustGraph's provenance/explainability shell and rejects Python pub/sub topology, Cassandra/external-store assumptions, schema-light triples as authority, and the full agent runtime; the clone confirms that split (`explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md:30-50`, `upstream/trustgraph/README.md:88-118`, `upstream/trustgraph/trustgraph-flow/pyproject.toml:58-133`, `upstream/trustgraph/trustgraph-base/trustgraph/provenance/namespaces.py:142-146`).

The prior "20+ containers / thin docs" criticism is directionally right on footprint but stale on docs. The clone now has substantial README/API/spec/client/MCP docs, yet the TS compose and Python scripts still show a multi-service platform, and at least one technical doc has unresolved conflict markers (`standards/memory-architecture/03-saas-landscape-assessment.md:52-58`, `explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md:375-389`, `upstream/trustgraph/README.md:120-173`, `upstream/trustgraph/specs/api/README.md:1-80`, `upstream/trustgraph/ts/deploy/docker-compose.yml:20-500`, `upstream/trustgraph/docs/tech-specs/extraction-flows.md:311-335`).

No referenced doctrine or prior-assessment file was missing in this lane.

## References

Repo doctrine and fit context read:

- `standards/memory-architecture/README.md`
- `standards/memory-architecture/01-memory-layer-taxonomy.md`
- `goals/agentic-professional-runtime/README.md`
- `goals/agentic-professional-runtime/SPEC.md`
- `standards/memory-architecture/03-saas-landscape-assessment.md`
- `standards/memory-architecture/05-context-graph-capability-assessment.md`
- `explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md`
- `goals/trustgraph-port/README.md`
- `goals/trustgraph-port/SPEC.md`
- `goals/trustgraph-port/PLAN.md`
- `goals/trustgraph-port/research/capability-map.md`
- `docs/BEEPGRAPH_ARCHITECTURE.md`

TrustGraph clone files read:

- `upstream/trustgraph/README.md`
- `upstream/trustgraph/LICENSE`
- `upstream/trustgraph/install_trustgraph.sh`
- `upstream/trustgraph/docs/README.md`
- `upstream/trustgraph/docs/README.api-docs.md`
- `upstream/trustgraph/docs/python-api.md`
- `upstream/trustgraph/docs/tech-specs/bootstrap.md`
- `upstream/trustgraph/docs/tech-specs/extraction-flows.md`
- `upstream/trustgraph/docs/tech-specs/flow-blueprint-definition.md`
- `upstream/trustgraph/specs/api/README.md`
- `upstream/trustgraph/specs/api/paths/flow/document-load.yaml`
- `upstream/trustgraph/specs/api/paths/flow/document-rag.yaml`
- `upstream/trustgraph/specs/api/paths/flow/graph-rag.yaml`
- `upstream/trustgraph/specs/api/paths/flow/mcp-tool.yaml`
- `upstream/trustgraph/specs/api/paths/librarian.yaml`
- `upstream/trustgraph/specs/websocket/asyncapi.yaml`
- `upstream/trustgraph/trustgraph-base/trustgraph/base/flow_processor.py`
- `upstream/trustgraph/trustgraph-base/trustgraph/provenance/namespaces.py`
- `upstream/trustgraph/trustgraph-base/trustgraph/provenance/triples.py`
- `upstream/trustgraph/trustgraph-base/trustgraph/provenance/uris.py`
- `upstream/trustgraph/trustgraph-base/trustgraph/provenance/vocabulary.py`
- `upstream/trustgraph/trustgraph-flow/pyproject.toml`
- `upstream/trustgraph/trustgraph-flow/trustgraph/direct/cassandra_kg.py`
- `upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/document_rag/document_rag.py`
- `upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/document_rag/rag.py`
- `upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/graph_rag/graph_rag.py`
- `upstream/trustgraph/trustgraph-flow/trustgraph/retrieval/graph_rag/rag.py`
- `upstream/trustgraph/trustgraph-flow/trustgraph/storage/doc_embeddings/qdrant/write.py`
- `upstream/trustgraph/trustgraph-flow/trustgraph/storage/rows/cassandra/write.py`
- `upstream/trustgraph/trustgraph-flow/trustgraph/storage/triples/cassandra/write.py`
- `upstream/trustgraph/trustgraph-flow/trustgraph/storage/triples/falkordb/write.py`
- `upstream/trustgraph/trustgraph-mcp/README.md`
- `upstream/trustgraph/trustgraph-mcp/pyproject.toml`
- `upstream/trustgraph/trustgraph-mcp/trustgraph/mcp_server/mcp.py`
- `upstream/trustgraph/trustgraph-mcp/trustgraph/mcp_server/tg_socket.py`
- `upstream/trustgraph/trustgraph-flow/trustgraph/agent/mcp_tool/service.py`
- `upstream/trustgraph/ai-context/trustgraph-client/README.md`
- `upstream/trustgraph/ai-context/trustgraph-client/package.json`
- `upstream/trustgraph/ts/package.json`
- `upstream/trustgraph/ts/deploy/docker-compose.yml`
- `upstream/trustgraph/ts/deploy/docker-compose.dev.yml`
- `upstream/trustgraph/ts/packages/mcp/package.json`
- `upstream/trustgraph/ts/packages/mcp/src/server-effect.ts`
