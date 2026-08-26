# Open-source references for the demo workbench and KG/memory layer

Date: 2026-08-25
Method: offline source and license inspection only. No repository was run.

## Decision in brief

The next-week demo should use the existing Beep Graph TypeScript workbench as
the visual and operational reference, but it should not be copied or shipped
until its repository-level license is made explicit. It already has the right
demo flow: Beep branding, document upload, Graph RAG, document RAG, agent chat,
an explainability subgraph, a graph explorer, flows, knowledge cores, and MCP
tools (`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/App.tsx:8-41`;
`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/pages/chat.tsx:38-42,181-183`;
`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/pages/library.tsx:67-108`;
`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/pages/graph.tsx:169-210`).

The lunch proof should stay narrower than the full platform: ingest a curated
Office export, build a small fastener graph, answer a quote/specification
question with visible sources, retain one approved correction or preference,
and stop before any order is placed. That matches the brief's M365 system of
record, quote/source/order/specify workflow, retiring-expert risk, and approval
requirement (`explorations/lejeune-bolt-agentic-demo/CAPTURE.md:26-37,57-77`).

For the memory engine, Cognee has the broadest implemented mix of provenance,
hybrid retrieval, temporal retrieval, session memory, trace memory, and cited
answers (`~/YeeBois/dev/cognee/cognee/modules/search/types/SearchType.py:4-21`;
`~/YeeBois/dev/cognee/cognee/api/v1/remember/remember.py:623-673`;
`~/YeeBois/dev/cognee/cognee/modules/retrieval/utils/references.py:170-201,228-273`).
Graphiti is the cleaner specialist for evolving, time-valid facts and source
episodes, but it supplies no OSS application UI (`~/YeeBois/dev/graphiti/README.md:64-81,107-122`).
Graphnosis contributes excellent local, deterministic, owner-adjudicated memory
patterns and a tiny deployment footprint (`~/YeeBois/dev/Graphnosis/README.md:140-166,173-204`).

## Scope and evidence limits

The packet registered this lane against `.repos/` (`explorations/lejeune-bolt-agentic-demo/research/SOURCES.md:9-18`),
but the requested `.repos/trustgraph`, `.repos/trustgraph-ui`,
`.repos/trustgraph-upstream`, `.repos/cognee`, `.repos/CogniWeave`,
`.repos/graphiti`, `.repos/Graphnosis`, `.repos/graphify`, and
`.repos/falkor-codegraph` paths were unavailable in this checkout. That absence
is an audit observation with no durable source file, so the requested vendored
state is **UNVERIFIED**. The report uses the matching local checkouts under
`~/YeeBois/dev/` as an explicit fallback and cites every claim to those files.

No runtime, container, build, test, or network verification was performed.
Descriptions of deployability are source-level findings, not live-readiness
claims. Any such readiness is marked **UNVERIFIED**.

The license rule used throughout is the packet rule: copyleft code is
clean-room-only, permissive code may be ported with attribution, and a missing
license makes the source reference-only
(`explorations/lejeune-bolt-agentic-demo/research/SOURCES.md:20-27`).

## License register

| Source | Verified name or SPDX text | Required treatment |
| --- | --- | --- |
| TrustGraph local checkout | `"Apache License, Version 2.0"` (`Apache-2.0`) (`~/YeeBois/dev/trustgraph/LICENSE:2-4`; `~/YeeBois/dev/trustgraph/README.md:179-189`) | Port with Apache attribution. Replace upstream marks. |
| TrustGraph upstream mirror | `"Apache License, Version 2.0"` (`Apache-2.0`) (`~/YeeBois/dev/trustgraph-upstream/LICENSE:2-4`; `~/YeeBois/dev/trustgraph-upstream/README.md:172-182`) | Port with Apache attribution. It is a second local copy of the same upstream system, not a separate product choice. |
| trustgraph-ui React root | Root says `"Apache License, Version 2.0"`; client/provider say `Apache-2.0`, and react-state says `MIT` (`~/YeeBois/dev/trustgraph-ui/LICENSE:2-4`; `~/YeeBois/dev/trustgraph-ui/packages/trustgraph-client/package.json:35-36`; `~/YeeBois/dev/trustgraph-ui/packages/trustgraph-react-provider/package.json:34-38`; `~/YeeBois/dev/trustgraph-ui/packages/trustgraph-react-state/package.json:35-39`) | Port named React/TypeScript files with the applicable notice. Do not reuse logos or marks. |
| trustgraph-ui Python proxy | Nested package declares `"GPL-3.0-or-later"` (`~/YeeBois/dev/trustgraph-ui/trustgraph-ui/pyproject.toml:5-15`) | Copyleft, therefore clean-room-only under the packet rule. Do not copy the proxy/service into the demo. |
| TrustGraph TypeScript port | No root license is declared in the root or private workbench manifests; only the vendored client declares `Apache-2.0` (`~/YeeBois/dev/trustgraph/ts/package.json:1-70`; `~/YeeBois/dev/trustgraph/ts/packages/workbench/package.json:1-38`; `~/YeeBois/dev/trustgraph/ts/packages/client/package.json:1-5,44`) | **Reference-only** as a whole until the owner adds an explicit repository license and attribution record. |
| Cognee | `"Apache-2.0"` and `"Apache License, Version 2.0"` (`~/YeeBois/dev/cognee/pyproject.toml:10-16`; `~/YeeBois/dev/cognee/LICENSE:1-3`) | Port with Apache attribution and retain `NOTICE.md`; do not reuse trade names or unverified brand assets (`~/YeeBois/dev/cognee/NOTICE.md:1-10`; `~/YeeBois/dev/cognee/LICENSE:138-140`). |
| CogniWeave | `"MIT License"` (`~/YeeBois/dev/CogniWeave/LICENSE:1-13`) | Port with the MIT notice. Replace name and icon. |
| Graphiti | `"Apache-2.0"` and `"Apache License, Version 2.0"` (`~/YeeBois/dev/graphiti/pyproject.toml:1-12`; `~/YeeBois/dev/graphiti/LICENSE:1-3`) | Port with Apache attribution. Build the surrounding UI and governance layer separately. |
| Graphnosis engine and checked-in web pages | `"Apache-2.0"` (`~/YeeBois/dev/Graphnosis/package.json:2-10`; `~/YeeBois/dev/Graphnosis/LICENSE:1-3`) | Port with Apache attribution. |
| Separate Graphnosis desktop app | README says the linked app uses Functional Source License 1.1 with future Apache, but that repository's LICENSE was not inspected (`~/YeeBois/dev/Graphnosis/README.md:519-525`) | **UNVERIFIED**. Clean-room/reference-only for this decision. |
| Graphify | `"Apache License, Version 2.0"` and `"Apache-2.0"`; NOTICE says pre-relicense portions remain under MIT (`~/YeeBois/dev/graphify/LICENSE:2-4`; `~/YeeBois/dev/graphify/pyproject.toml:5-12`; `~/YeeBois/dev/graphify/NOTICE:1-8`) | Port with the applicable Apache and retained MIT notices. Do not call the whole tree dual-licensed. |
| Falkor CodeGraph and its retired backend | `"MIT License"` in both roots (`~/YeeBois/dev/falkor-codegraph/code-graph/LICENSE:1-13`; `~/YeeBois/dev/falkor-codegraph/code-graph-backend/LICENSE:1-13`) | Port with MIT attribution. The standalone backend says it was merged into the main repo (`~/YeeBois/dev/falkor-codegraph/code-graph-backend/README.md:1-2`). |

## Capability comparison

| Reference | Ingest to UI architecture | Model and provenance | Retrieval | Agent memory | Community or summary support |
| --- | --- | --- | --- | --- | --- |
| TrustGraph and upstream | Configurable flows move raw input through ingest, extraction, structuring, and storage; services expose GraphRAG/DocumentRAG and feed the TrustGraph UI (`~/YeeBois/dev/trustgraph/README.md:78-103`; `~/YeeBois/dev/trustgraph-upstream/README.md:71-96`). | RDF/RDF-star terms and named-graph triples; metadata has source/root document/collection; chunks and entity contexts retain document or chunk ids (`~/YeeBois/dev/trustgraph/trustgraph-base/trustgraph/schema/core/primitives.py:3-54`; `~/YeeBois/dev/trustgraph/trustgraph-base/trustgraph/schema/core/metadata.py:1-12`; `~/YeeBois/dev/trustgraph/trustgraph-base/trustgraph/schema/knowledge/document.py:30-39`; `~/YeeBois/dev/trustgraph/trustgraph-base/trustgraph/schema/knowledge/graph.py:8-30`). Rich page-to-chunk-to-fact provenance is still desired state, not current behavior (`~/YeeBois/dev/trustgraph/docs/tech-specs/extraction-time-provenance.md:9-55`). | Graph RAG uses embedded entity entry points, subgraphs/paths, and explain triples; Document RAG uses semantic chunk search and explain triples (`~/YeeBois/dev/trustgraph/specs/api/paths/flow/graph-rag.yaml:12-48`; `~/YeeBois/dev/trustgraph/specs/api/paths/flow/document-rag.yaml:12-47`). Ontology-guided extraction exists; claimed OntoRAG plus GraphRAG hybrid is design-only and **UNVERIFIED** (`~/YeeBois/dev/trustgraph/docs/tech-specs/ontorag.md:7-34,638-651`). | Agent calls accept caller-supplied state and thought/action/observation history; multi-turn use resends that history (`~/YeeBois/dev/trustgraph/specs/api/components/schemas/agent/AgentRequest.yaml:1-49`; `~/YeeBois/dev/trustgraph/specs/api/paths/flow/agent.yaml:20-53`). Durable episodic memory is **UNVERIFIED**. | First-class episodes, community detection, and community summaries were not found in the reviewed core schemas. Temporal queries are candidate patterns, not verified runtime behavior (`~/YeeBois/dev/trustgraph/docs/tech-specs/graph-contexts.md:7-43,225-267`). |
| trustgraph-ui | React monorepo separates design system, client, WebSocket provider, state, and demo (`~/YeeBois/dev/trustgraph-ui/README.md:1-20`). The Python proxy serves static assets and proxies API/WebSocket traffic (`~/YeeBois/dev/trustgraph-ui/trustgraph-ui/trustgraph_ui/service.py:8-47`; `~/YeeBois/dev/trustgraph-ui/trustgraph-ui/trustgraph_ui/api.py:17-47`). | It is a client/view layer over TrustGraph, not an independent graph model (`~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/index.ts:91-130,148-165`). | It exposes GraphRAG, source, graph explorer, agent console, and workbench views through hooks and components (`~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/index.ts:91-130,148-165`). | No independent memory engine is evidenced; it displays backend results and agent state (`~/YeeBois/dev/trustgraph-ui/packages/demo/src/pages/QueryView.tsx:16-64,124-228`). | No independent community model is evidenced. |
| Cognee | `add` accepts text/files/URLs/streams, then `cognify` classifies, chunks, extracts entities/relations, summarizes chunks, and persists graph/vector projections; the UI uploads to `/v1/add` and invokes cognify (`~/YeeBois/dev/cognee/cognee/api/v1/add/add.py:25-84,209-220`; `~/YeeBois/dev/cognee/cognee/api/v1/cognify/cognify.py:325-351`; `~/YeeBois/dev/cognee/cognee-frontend/src/app/(app)/dashboard/AddDataToCognee.tsx:37-73`). | `DataPoint` carries version, source pipeline/task/node-set/user/content hash, feedback and importance weights; `DocumentChunk` retains document identity and contained entities/events (`~/YeeBois/dev/cognee/cognee/infrastructure/engine/models/DataPoint.py:26-69`; `~/YeeBois/dev/cognee/cognee/modules/chunking/models/DocumentChunk.py:10-45`). Evidence utilities return stable data/chunk references (`~/YeeBois/dev/cognee/cognee/modules/retrieval/utils/references.py:170-201,228-273`). | Graph, chunk RAG, hybrid, summaries, Cypher, temporal, lexical BM25, and agentic modes are concrete enum/factory choices (`~/YeeBois/dev/cognee/cognee/modules/search/types/SearchType.py:4-21`; `~/YeeBois/dev/cognee/cognee/modules/search/methods/get_search_type_retriever_instance.py:77-160,237-307`). Temporal retrieval filters graph events by query time, vector-ranks them, and falls back to triplets (`~/YeeBois/dev/cognee/cognee/modules/retrieval/temporal_retriever.py:87-107,122-173`). | `remember` separates permanent and fast session modes; `@agent_memory` adds graph memory, session feedback, trace persistence, dataset/user scope, and periodic memification (`~/YeeBois/dev/cognee/cognee/api/v1/remember/remember.py:623-673`; `~/YeeBois/dev/cognee/cognee/modules/agent_memory/decorator.py:29-74,93-161`). | `TextSummary` points back to its chunk, and hierarchical `GlobalContextSummary` records dataset, level, root, bucket entities, and parent (`~/YeeBois/dev/cognee/cognee/tasks/summarization/models.py:9-39`). Conventional Leiden/Louvain detection was not found; grouped global summaries are community-like, not verified communities (`~/YeeBois/dev/cognee/cognee/memify_pipelines/global_context_index.py:14-30,46-61`). |
| CogniWeave | Tauri/React over Rust; SQLite is content truth, embedded Kuzu is topology, Qdrant is vectors, and PDF/web/text follows chunk, enrich, weave, inbox (`~/YeeBois/dev/CogniWeave/README.md:11-60`; `~/YeeBois/dev/CogniWeave/src-tauri/src/commands/ingest.rs:39-133,135-230,233-325`). | `AtomicNode` carries content, metadata, edges/tags, entities, summary, and sync state; metadata includes author/source URL and version timestamps, while edges have a manual-creation bit (`~/YeeBois/dev/CogniWeave/src-tauri/src/models/node.rs:7-67`; `~/YeeBois/dev/CogniWeave/src-tauri/src/models/edge.rs:4-23`). URL ingestion does not copy its source URL into node metadata, so source-level provenance is incomplete (`~/YeeBois/dev/CogniWeave/src-tauri/src/commands/ingest.rs:145-175`). | Intended flow is query embedding, Qdrant top five, one-hop Kuzu expansion, SQLite content, then Ollama synthesis (`~/YeeBois/dev/CogniWeave/src-tauri/src/ai/synthesis.rs:1-17,44-135`). FTS5 exists but is not in that synthesis path (`~/YeeBois/dev/CogniWeave/src-tauri/migrations/001_initial.sql:15-21`; `~/YeeBois/dev/CogniWeave/src-tauri/src/ai/synthesis.rs:52-119`). | Persistent PKM, versions, search, serendipity, and collaboration exist as concepts; there is no comparable trace/session-memory API, and the collaboration log records edits rather than agent episodes (`~/YeeBois/dev/CogniWeave/src-tauri/migrations/001_initial.sql:1-64`; `~/YeeBois/dev/CogniWeave/src-tauri/migrations/002_collab.sql:17-27`). | No temporal validity, episode, community, or community-summary model was found. Per-node summaries and ordinary timestamps are present (`~/YeeBois/dev/CogniWeave/src-tauri/src/models/node.rs:36-58`). |
| Graphiti | Structured/unstructured data and interactions are incrementally extracted, resolved, deduplicated, and written as episodes, entities, facts, and communities (`~/YeeBois/dev/graphiti/README.md:41-48,124-138`; `~/YeeBois/dev/graphiti/graphiti_core/graphiti.py:717-733,783-852`). It deliberately leaves developer UI to the adopter (`~/YeeBois/dev/graphiti/README.md:107-122`). | Episodes retain raw content, source description, valid time, edge references, and metadata; entity edges retain fact, episode ids, expiry, validity, invalidity, and reference time (`~/YeeBois/dev/graphiti/graphiti_core/nodes.py:318-332`; `~/YeeBois/dev/graphiti/graphiti_core/edges.py:263-285`). Entity and Community nodes contain summaries (`~/YeeBois/dev/graphiti/graphiti_core/nodes.py:499-504,687-690`). | Hybrid semantic, keyword, and graph traversal supports present and historical queries (`~/YeeBois/dev/graphiti/README.md:50-54,129-138`). | MCP exposes episode/entity management, hybrid search, groups, and graph maintenance (`~/YeeBois/dev/graphiti/README.md:320-334`; `~/YeeBois/dev/graphiti/mcp_server/README.md:14-28`). | Community nodes have regional summaries; entity summaries and temporal fact validity are first class (`~/YeeBois/dev/graphiti/README.md:64-81`; `~/YeeBois/dev/graphiti/graphiti_core/nodes.py:499-504,687-690`). |
| Graphnosis | Files/text become nodes, directed logical and undirected associative edges are built, lexical seeding plus a two-layer BFS returns a source-cited subgraph; HTTP, MCP, and checked-in web views sit over the engine (`~/YeeBois/dev/Graphnosis/README.md:47-67,71-113,489-494`). | Nodes include fact/event/document/preference/conversation/message/session-summary types plus source file/offset/line/section, content hash, confidence, created/access/valid-until timestamps (`~/YeeBois/dev/Graphnosis/src/core/types.ts:14-75`). Directed relations include causes, precedes, contradicts, supersedes, preference, and summarizes (`~/YeeBois/dev/Graphnosis/src/core/types.ts:77-127`). | Default lexical retrieval is local; optional embeddings add hybrid retrieval; `asOf` freezes the temporal view (`~/YeeBois/dev/Graphnosis/README.md:292-316,333-346`). | Contradictions are owner-adjudicated, supersession preserves old knowledge, reads are deterministic, and retired material remains auditable (`~/YeeBois/dev/Graphnosis/README.md:173-204,373-390`). | Session summaries and hierarchy exist, but conventional community detection/summaries were not found (`~/YeeBois/dev/Graphnosis/src/core/types.ts:38-41,50-75`). |

## TrustGraph UI pieces worth white-labeling

The reusable target is the React tree, not the GPL-declared Python proxy. The
following are source components, not screenshots or design descriptions.

| Need | Candidate files | Why it is useful for the demo |
| --- | --- | --- |
| Graph explorer | `GraphExplorer` composes loading, filters, one-hop highlights, SVG/canvas rendering, and detail panels (`~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/components/knowledge/GraphExplorer.tsx:19-120`). `RawGraphExplorer3D` adds search, reset, details, and a force-directed 3D canvas (`~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/components/raw-graph/RawGraphExplorer3D.tsx:15-48,115-151`). | Port the 2D explorer for reliable interaction; use 3D only as an optional wow view. Both are root-Apache code, subject to attribution. |
| Chat and visible reasoning | `QueryView` joins agent chat, semantic lookup, graph highlighting, streaming messages, and node details (`~/YeeBois/dev/trustgraph-ui/packages/demo/src/pages/QueryView.tsx:16-64,124-228`). `AgentConsole` is a three-column config/editor/debug view (`~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/components/agent-config/AgentConsole.tsx:8-55`). `ChatPanel` supplies suggestions, messages, streaming state, textarea, and send behavior (`~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/components/retail/ChatPanel.tsx:5-95,97-177,196-229`). | Borrow the interaction pattern, then replace generic reasoning labels with quote, source, specification, exception, and approval states. |
| Sources and trust | `RagWithSourcesView` runs Graph RAG with explain events, deduplicates document sources, opens source text, and renders a source ledger (`~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/components/explain/RagWithSourcesView.tsx:19-85,87-147`). | This is the most valuable direct port. The existing TS port only renders the explain subgraph and does not expose the source text (`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/components/chat/explain-graph.tsx:72-140`). |
| Document upload | `IngestPage` supports file/text drafts, flow-based destinations, chunked uploads, and upload controls (`~/YeeBois/dev/trustgraph-ui/packages/demo/src/pages/IngestPage.tsx:32-44,83-130,573-615,912-1009`). `SubmitDialog` confirms flow and collection (`~/YeeBois/dev/trustgraph-ui/packages/demo/src/components/SubmitDialog.tsx:5-29,31-126,184-233`). | Do not port the roughly monolithic page wholesale. Rebuild the fastener/Office wizard with beep form and approval components, while preserving the small API/state contracts. |
| Branding | Header logo/name/subtitle (`~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/components/common/Header.tsx:15-35`), login identity (`~/YeeBois/dev/trustgraph-ui/packages/demo/src/pages/LoginPage.tsx:45-69`), workflow cards (`~/YeeBois/dev/trustgraph-ui/packages/demo/src/pages/HomePage.tsx:17-168`), theme colors (`~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/theme/colors.ts:1-59`), and route inventory (`~/YeeBois/dev/trustgraph-ui/packages/demo/src/App.tsx:64-105`). | Replace every upstream name/logo. Map colors through beep tokens rather than retaining a parallel theme system. |

## Deployment and one-week fit by reference

### TrustGraph family

The Python reference stack is generated as Docker/Podman Compose or Kubernetes
resources. Its documented infrastructure includes Cassandra, Qdrant,
Garage/S3, Pulsar or RabbitMQ, and an LLM/OCR provider
(`~/YeeBois/dev/trustgraph/README.md:105-130`). This is operationally broad for
a lunch proof, and actual startup is **UNVERIFIED**.

The separate TypeScript port is already narrower in product shape but still
large in service count. Compose includes NATS, FalkorDB, Qdrant, Ollama,
Prometheus, Loki, Tempo, OpenTelemetry, and Grafana
(`~/YeeBois/dev/trustgraph/ts/deploy/docker-compose.yml:20-203`). It adds gateway,
config, completion, prompt, embeddings, workbench, agent, MCP, librarian, flow
manager, knowledge cores, PDF decode, chunking, extraction, graph/vector stores
and queries, Graph RAG, and Document RAG
(`~/YeeBois/dev/trustgraph/ts/deploy/docker-compose.yml:205-500`).

One-week boundary: reuse the running port only after its license is clarified.
Hide observability and administrative routes from the lunch navigation. Add the
React source-ledger behavior from `RagWithSourcesView` with attribution. Do not
copy the GPL Python proxy. Do not promise temporal or episodic memory from this
stack because those runtime capabilities were not found
(`~/YeeBois/dev/trustgraph/docs/tech-specs/graph-contexts.md:225-267`;
`~/YeeBois/dev/trustgraph/specs/api/components/schemas/agent/AgentRequest.yaml:1-49`).

### Cognee

Cognee can run an API container alone, or profiles can add UI, MCP, Postgres,
and Neo4j (`~/YeeBois/dev/cognee/docker-compose.yml:1-38,39-145`). Its README
also describes an embedded SQLite/LanceDB/Ladybug development mode and a single
Postgres deployment for graph, pgvector, session cache, and metadata
(`~/YeeBois/dev/cognee/README.md:327-340`). The frontend container is a Node
development server rather than a production Next build
(`~/YeeBois/dev/cognee/cognee-frontend/Dockerfile:1-22`).

One-week boundary: integrate Cognee as a service rather than porting its Python
engine. Upload a curated export, cognify with a small fastener model, call
hybrid or graph completion with references, and display results in the Beep
workbench. No SharePoint, OneDrive, or M365 connector was found in the reviewed
source, so live M365 synchronization is **UNVERIFIED**; manual Office export is
the honest demo input. The upload path does claim Office document formats
(`~/YeeBois/dev/cognee/cognee/api/v1/add/add.py:62-84`).

### CogniWeave

CogniWeave is a Tauri desktop deployment with embedded SQLite/Kuzu, intended
Qdrant sidecar, and Ollama or optional cloud models. Development and production
use `npm run tauri dev` and `npm run tauri build`
(`~/YeeBois/dev/CogniWeave/README.md:280-311`). It has no reviewed Compose
deployment, and service-as-software would require a new server boundary.

More importantly, the current source does not register the frontend's
`synthesis_query` command, and it constructs but does not start the Qdrant
manager (`~/YeeBois/dev/CogniWeave/src/lib/tauri-bridge.ts:109-111`;
`~/YeeBois/dev/CogniWeave/src-tauri/src/lib.rs:41-54,98-158`;
`~/YeeBois/dev/CogniWeave/src-tauri/src/db/mod.rs:8-27`). The Graph RAG and
vector demo path is therefore not ready from source. Use only its MIT UI ideas:
the resizable tri-pane shell, React Flow explorer, retrieval-step strip, and
approve/dismiss inbox (`~/YeeBois/dev/CogniWeave/src/components/layout/TriPane.tsx:1-38`;
`~/YeeBois/dev/CogniWeave/src/components/graph/MacroGraph.tsx:1-57,59-140`;
`~/YeeBois/dev/CogniWeave/src/components/chat/RetrievalGraph.tsx:1-29`;
`~/YeeBois/dev/CogniWeave/src/components/inbox/InboxView.tsx:70-185`).

### Graphiti

Graphiti needs Neo4j, FalkorDB, Neptune, or deprecated Kuzu plus LLM/embedding
services (`~/YeeBois/dev/graphiti/README.md:164-176`). Root Compose runs API plus
Neo4j or the FalkorDB profile (`~/YeeBois/dev/graphiti/docker-compose.yml:1-88`),
and the MCP server can manage episodes, search, and maintenance
(`~/YeeBois/dev/graphiti/README.md:320-334`).

One-week boundary: it is a strong memory sidecar if the pitch must show facts
changing over time. Do not make it the workbench base because the project says
adopters build their own tools, conversation management, and production
controls (`~/YeeBois/dev/graphiti/README.md:107-122`).

### Graphnosis

Graphnosis runs as an in-process npm library, CLI, HTTP server, or MCP server
without a graph database (`~/YeeBois/dev/Graphnosis/README.md:47-67,71-113`). Its
Compose file is one MCP service with a mounted `.gai` directory
(`~/YeeBois/dev/Graphnosis/docker-compose.yml:12-26`).

One-week boundary: its Apache engine and checked-in dashboard, 2D graph, chat,
and `.gai` audit views can be ported with attribution
(`~/YeeBois/dev/Graphnosis/src/app/page.tsx:17-38,48-121`;
`~/YeeBois/dev/Graphnosis/src/app/graph/page.tsx:50-83,100-204`;
`~/YeeBois/dev/Graphnosis/src/app/chat/page.tsx:18-82,165-235`;
`~/YeeBois/dev/Graphnosis/src/app/view-gai/page.tsx:49-97,105-178`). It is a
useful local memory proof, but its documented limitations include lexical
mismatch and heuristic identity/contradiction detection
(`~/YeeBois/dev/Graphnosis/README.md:395-409`).

### Graphify and Falkor CodeGraph

Graphify's pipeline detects files, extracts a NetworkX graph, clusters it,
analyzes it, and emits report/export artifacts with source locations and
EXTRACTED/INFERRED/AMBIGUOUS confidence (`~/YeeBois/dev/graphify/ARCHITECTURE.md:1-56`).
It generates a searchable/filterable `graph.html`, report, and `graph.json`,
with community/query/path/explain operations (`~/YeeBois/dev/graphify/README.md:37-64,97-113`).
This is good visual language for evidence confidence, not a domain agent-memory
backend.

Falkor CodeGraph maps source-language entities and relations into FalkorDB,
then supplies graph browsing, paths, and GraphRAG chat
(`~/YeeBois/dev/falkor-codegraph/code-graph/README.md:18-47,222-243`). Its unified
Compose starts the app and FalkorDB (`~/YeeBois/dev/falkor-codegraph/code-graph/README.md:160-168`).
The resizable graph/chat panels, node expansion, and path highlighting are
portable MIT interaction patterns, but its code ontology does not supply
fastener provenance, temporal memory, or approval semantics
(`~/YeeBois/dev/falkor-codegraph/code-graph/app/src/App.tsx:1-31,64-92`;
`~/YeeBois/dev/falkor-codegraph/code-graph/app/src/components/code-graph.tsx:225-300`;
`~/YeeBois/dev/falkor-codegraph/code-graph/app/src/components/chat.tsx:73-110,246-275`).

## Comparison with current beep labs and the TypeScript port

| Surface | What exists now | Demo consequence |
| --- | --- | --- |
| `apps/labs/trustgraph-workbench` | It is an active D13 first-wave shell whose entire UI is one heading (`apps/labs/trustgraph-workbench/lab.manifest.json:1-5`; `apps/labs/trustgraph-workbench/src/App.tsx:1-7`). It already depends on `@beep/ui`, imports beep global styles, uses a portless URL, and is private MIT code (`apps/labs/trustgraph-workbench/package.json:1-8,14-45`; `apps/labs/trustgraph-workbench/src/styles/globals.css:1`; `apps/labs/trustgraph-workbench/LICENSE:1-13`). | Best in-repo destination for a licensed port. It has no current ingest, graph, retrieval, chat, provenance, memory, or backend wiring, so it cannot be the demo without importing or reimplementing those parts. |
| `apps/labs/semantica` | Headless-first construction canary; C0/C1/C2 intentionally raise `StageNotImplemented`, and tests require that failure (`apps/labs/semantica/README.md:1-20`; `apps/labs/semantica/src/canary/Command.ts:87-126,128-160`; `apps/labs/semantica/test/Canary.test.ts:50-71`). Only Bun runtime/config/logging layers exist; construction services are a comment seam (`apps/labs/semantica/src/runtime/Layer.ts:43-60,76`). | Wrong next-week base. Its ratified charter is ingest, parse, extract, KG build, reasoning, provenance, and eval, while the workbench owns projection/retrieval/graph UX (`explorations/semantica-lab/DECISIONS.md:130-143`). Its current milestone explicitly excludes GraphRAG, hybrid search, UI, email/DOCX ingest, agent integrations, and deployment (`goals/semantica-canary/SPEC.md:38-59`). |
| `~/YeeBois/dev/trustgraph/ts` | Already Beep Graph branded with logo/sidebar (`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/components/layout/beep-graph-logo.tsx:1-47`; `~/YeeBois/dev/trustgraph/ts/packages/workbench/src/components/layout/sidebar.tsx:158-199`). It has upload, graph, chat modes, explain graphs, and persisted browser transcript (`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/pages/library.tsx:67-199`; `~/YeeBois/dev/trustgraph/ts/packages/workbench/src/pages/chat.tsx:198-313`; `~/YeeBois/dev/trustgraph/ts/packages/workbench/src/atoms/workbench.ts:1520-1561`). | Fastest visual base and strongest current wow factor. Its transcript is browser persistence, not backend episodic memory, because agent submission sends only the current question/user/collection/streaming request (`~/YeeBois/dev/trustgraph/ts/packages/client/src/models/messages.ts:122-127`). The missing root license makes the whole port reference-only until corrected. |

The in-repo boundary is already right: Semantica should eventually construct
and evaluate knowledge, while `trustgraph-workbench` should consume projections
and own the demo UX (`explorations/semantica-lab/DECISIONS.md:138-143`). A new
lab should be created only if it has a distinct customer-demo charter; otherwise
it duplicates the designated workbench.

## What to port, integrate, or clean-room in one week

### Port with attribution

- From root-Apache trustgraph-ui React code: `GraphExplorer`, the small chat
  pieces, source badge/panel behavior, `RagWithSourcesView`, and selected theme
  tokens (`~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/components/knowledge/GraphExplorer.tsx:19-120`;
  `~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/components/explain/RagWithSourcesView.tsx:19-147`;
  `~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/theme/colors.ts:1-59`).
- From CogniWeave MIT code: tri-pane composition, graph explorer interaction,
  compact retrieval-step display, and inbox approve/dismiss behavior
  (`~/YeeBois/dev/CogniWeave/src/components/layout/TriPane.tsx:1-38`;
  `~/YeeBois/dev/CogniWeave/src/components/graph/MacroGraph.tsx:59-140`;
  `~/YeeBois/dev/CogniWeave/src/components/chat/RetrievalGraph.tsx:1-29`;
  `~/YeeBois/dev/CogniWeave/src/components/inbox/InboxView.tsx:70-185`).
- From Graphnosis Apache code: deterministic subgraph retrieval, source-line
  display, `asOf` audit, and contradiction/owner-decision UI patterns
  (`~/YeeBois/dev/Graphnosis/README.md:140-166,173-204,292-316`).
- Integrate Cognee or Graphiti through a service/API boundary instead of
  translating either engine in the demo week (`~/YeeBois/dev/cognee/README.md:184-205,388-396`;
  `~/YeeBois/dev/graphiti/README.md:300-340`).

### Clean-room only

- The GPL-declared `trustgraph-ui/trustgraph-ui` Python proxy
  (`~/YeeBois/dev/trustgraph-ui/trustgraph-ui/pyproject.toml:5-15`).
- Any interaction copied from the separately linked FSL Graphnosis desktop app,
  whose direct license is **UNVERIFIED** (`~/YeeBois/dev/Graphnosis/README.md:519-525`).
- Customer-specific approval, order, quote, and specification workflows. None
  of the reviewed engines implements LeJeune's business authority model; the
  requirement comes from the packet (`explorations/lejeune-bolt-agentic-demo/CAPTURE.md:60-77`).

### Reference-only until corrected or verified

- The complete TrustGraph TypeScript port, because it has no root LICENSE or
  root/workbench license field (`~/YeeBois/dev/trustgraph/ts/package.json:1-70`;
  `~/YeeBois/dev/trustgraph/ts/packages/workbench/package.json:1-38`).
- TrustGraph temporal, episodic, community-summary, and runtime hybrid claims
  that are design-only or absent from the reviewed implementation
  (`~/YeeBois/dev/trustgraph/docs/tech-specs/graph-contexts.md:225-267`;
  `~/YeeBois/dev/trustgraph/docs/tech-specs/ontorag.md:638-651`).
- Cognee/CogniWeave brand media, fonts, names, and logos. Cognee's asset ledger
  is incomplete and Apache does not grant a general trademark right
  (`~/YeeBois/dev/cognee/licenses/README.md:1-4`;
  `~/YeeBois/dev/cognee/LICENSE:138-140`).

## Options matrix

Scores use 1 as worst and 5 as best. They assess the source state inspected on
2026-08-25, not a hypothetical completed implementation.

| Option | Time to demo | Wow factor | License safety | Beep-brick reuse | Service-as-software path | Total | Assessment |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| A. Brand the TrustGraph TS-port workbench | 5 | 4 | 1 | 3 | 5 | 18/25 | Fastest because the branded routes and service stack already exist (`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/App.tsx:8-41`; `~/YeeBois/dev/trustgraph/ts/deploy/docker-compose.yml:205-500`). License safety is the blocker because only the client subpackage declares Apache-2.0 (`~/YeeBois/dev/trustgraph/ts/packages/client/package.json:1-5,44`). |
| B. Extend `apps/labs/semantica` | 1 | 2 | 5 | 5 | 5 | 18/25 | Safest and deepest long-term beep path, but all three canary stages intentionally fail and the current charter excludes retrieval/UI/deploy (`apps/labs/semantica/src/canary/Command.ts:120-160`; `goals/semantica-canary/SPEC.md:49-59`). It would damage the existing construction/consumption boundary (`explorations/semantica-lab/DECISIONS.md:138-143`). |
| C. New `apps/labs/<slug>` using beep bricks plus licensed UI pieces | 3 | 5 | 4 | 5 | 5 | 22/25 | Best balanced product path if it has a genuinely separate customer-demo charter. It can use Apache/MIT source-ledger, graph, chat, tri-pane, and approval patterns with notices (`~/YeeBois/dev/trustgraph-ui/LICENSE:2-4`; `~/YeeBois/dev/CogniWeave/LICENSE:1-13`). It costs time and duplicates the current workbench unless the charter is explicit (`explorations/semantica-lab/DECISIONS.md:138-143`). |

## Recommendation

Use **Option A as the lunch-demo base only after clearing one hard gate**: add or
obtain an explicit license for the TypeScript port and record its upstream
attribution. Until then, the packet rule makes it reference-only
(`~/YeeBois/dev/trustgraph/ts/package.json:1-70`;
`~/YeeBois/dev/trustgraph/ts/packages/client/package.json:1-5,44`). If that gate
cannot be cleared immediately, choose **Option C** and put the work in
`apps/labs/trustgraph-workbench` unless a separate customer-demo charter
justifies a new slug. Do not use Option B for the lunch.

For the pitch, combine four visible moves:

1. Upload a curated, non-sensitive Office export through the existing library
   UI (`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/pages/library.tsx:67-199`).
2. Show extracted fastener, project, supplier, specification, document, and
   person-role relations in the graph explorer. This is a proposed demo model,
   not a model supplied by an upstream reference; the explorer can already
   render and filter triples (`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/pages/graph.tsx:169-210,212-323`).
3. Ask a quote/specification question and show the answer, source ledger, and
   retrieved subgraph. The port already has Graph RAG/Doc RAG/Agent modes and
   explain graphs; `RagWithSourcesView` supplies the missing document-source
   pattern (`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/pages/chat.tsx:198-313`;
   `~/YeeBois/dev/trustgraph-ui/packages/trustkit/src/components/explain/RagWithSourcesView.tsx:19-147`).
4. Capture one expert correction or preference, show the old and new knowledge,
   and require human approval before producing an order-ready action. Graphiti's
   validity/episode model or Cognee's session/permanent memory can back this;
   Graphnosis supplies the clearest owner-adjudicated interaction pattern
   (`~/YeeBois/dev/graphiti/README.md:64-81,124-138`;
   `~/YeeBois/dev/cognee/cognee/api/v1/remember/remember.py:623-673`;
   `~/YeeBois/dev/Graphnosis/README.md:173-204`).

The service engagement behind the demo is not "buy this chatbot." It is a
bounded operating service: connect approved M365 sources, define the fastener
ontology and authority rules, preserve veteran corrections with provenance,
measure retrieval/citation quality, and expand from recommendation to approved
actions. M365 ingestion, authorization, deletion, and order-system integration
remain **UNVERIFIED and out of scope for this source audit**; the brief is the
only evidence for those business requirements
(`explorations/lejeune-bolt-agentic-demo/CAPTURE.md:57-77`).

## Sources

The URLs below were read from local repository metadata or README files. No URL
was fetched during this offline audit.

| URL | What it evidenced | Access date | License |
| --- | --- | --- | --- |
| https://github.com/trustgraph-ai/trustgraph | TrustGraph engine, flow architecture, schemas, retrieval, deployment, and canonical project identity (`~/YeeBois/dev/trustgraph/trustgraph/pyproject.toml:20-27`; `~/YeeBois/dev/trustgraph/README.md:78-130`) | 2026-08-25 | Apache-2.0 (`~/YeeBois/dev/trustgraph/LICENSE:2-4`) |
| https://github.com/trustgraph-ai/trustgraph | `trustgraph-upstream` fallback mirror and comparison baseline (`~/YeeBois/dev/trustgraph-upstream/README.md:71-96,172-182`) | 2026-08-25 | Apache-2.0 (`~/YeeBois/dev/trustgraph-upstream/LICENSE:2-4`) |
| https://github.com/trustgraph-ai/trustgraph-ui | React UI/component architecture and nested Python distribution identity (`~/YeeBois/dev/trustgraph-ui/trustgraph-ui/pyproject.toml:5-15`; `~/YeeBois/dev/trustgraph-ui/README.md:1-20`) | 2026-08-25 | Root Apache-2.0; nested Python package GPL-3.0-or-later (`~/YeeBois/dev/trustgraph-ui/LICENSE:2-4`; `~/YeeBois/dev/trustgraph-ui/trustgraph-ui/pyproject.toml:11`) |
| **UNVERIFIED: no standalone repository URL declared in the TypeScript port root manifest** | Local Beep Graph TypeScript port at `~/YeeBois/dev/trustgraph/ts`; routes, workbench, service stack, and missing root license declaration (`~/YeeBois/dev/trustgraph/ts/package.json:1-70`) | 2026-08-25 | Missing at repository root; reference-only. Client subpackage says Apache-2.0 (`~/YeeBois/dev/trustgraph/ts/packages/client/package.json:44`) |
| https://github.com/topoteretes/cognee | Cognee ingestion, memory, provenance, retrieval, UI, and deployment (`~/YeeBois/dev/cognee/pyproject.toml:189-190`; `~/YeeBois/dev/cognee/README.md:64-87,184-205`) | 2026-08-25 | Apache-2.0 (`~/YeeBois/dev/cognee/pyproject.toml:10-16`) |
| https://github.com/CaptnRumpy/CogniWeave | CogniWeave Tauri architecture, UI, and local checkout identity (`~/YeeBois/dev/CogniWeave/README.md:11-60,280-305`) | 2026-08-25 | MIT (`~/YeeBois/dev/CogniWeave/LICENSE:1-13`) |
| https://github.com/getzep/graphiti | Graphiti temporal graph, hybrid retrieval, agent-memory/MCP, and deployment (`~/YeeBois/dev/graphiti/pyproject.toml:23-25`; `~/YeeBois/dev/graphiti/README.md:41-54,300-340`) | 2026-08-25 | Apache-2.0 (`~/YeeBois/dev/graphiti/pyproject.toml:1-12`) |
| https://github.com/nehloo/Graphnosis | Graphnosis local deterministic memory, checked-in UI, and repository identity (`~/YeeBois/dev/Graphnosis/package.json:2-10`; `~/YeeBois/dev/Graphnosis/README.md:47-67,489-494`) | 2026-08-25 | Apache-2.0 (`~/YeeBois/dev/Graphnosis/LICENSE:1-3`) |
| https://github.com/Graphify-Labs/graphify | Graphify extraction, provenance labels, community/query UI, and repository identity (`~/YeeBois/dev/graphify/pyproject.toml:46-49`; `~/YeeBois/dev/graphify/ARCHITECTURE.md:1-56`) | 2026-08-25 | Apache-2.0, with pre-relicense MIT portions (`~/YeeBois/dev/graphify/LICENSE:2-4`; `~/YeeBois/dev/graphify/pyproject.toml:5-12`; `~/YeeBois/dev/graphify/NOTICE:1-8`) |
| https://github.com/FalkorDB/code-graph | Falkor CodeGraph architecture, explorer/chat patterns, deploy, and retired-backend destination (`~/YeeBois/dev/falkor-codegraph/code-graph/README.md:18-47,160-168`; `~/YeeBois/dev/falkor-codegraph/code-graph-backend/README.md:1-2`) | 2026-08-25 | MIT (`~/YeeBois/dev/falkor-codegraph/code-graph/LICENSE:1-13`; `~/YeeBois/dev/falkor-codegraph/code-graph-backend/LICENSE:1-13`) |
| https://github.com/beep-effect/beep-effect/tree/main/apps/labs/trustgraph-workbench | Current in-repo TrustGraph workbench lab shell (`apps/labs/trustgraph-workbench/package.json:1-12`) | 2026-08-25 | MIT (`apps/labs/trustgraph-workbench/LICENSE:1-13`) |
| https://github.com/beep-effect/beep-effect/tree/main/apps/labs/semantica | Current in-repo Semantica construction canary (`apps/labs/semantica/package.json:1-12`; `apps/labs/semantica/README.md:1-20`) | 2026-08-25 | MIT (`apps/labs/semantica/LICENSE:1-13`) |
