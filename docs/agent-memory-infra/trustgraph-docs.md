# TL;DR

TrustGraph passes the three hard gates as a self-hostable Apache-2.0 system with clean HTTP/WebSocket APIs, an official Python SDK, documented TypeScript client libraries, and MCP tool integration. The best product fit is not "adopt TrustGraph as memory truth"; it is "borrow the context-core packaging, named-graph provenance, query trace, and API boundary patterns behind repo-owned drivers." Official docs describe Docker/Podman, Minikube, Kubernetes, cloud, and self-host options, plus graph/vector/structured/object storage and RAG/agent services. Sources: https://trustgraph.ai/llms.txt, https://docs.trustgraph.ai/overview/architecture.html, https://docs.trustgraph.ai/deployment/choosing-deployment.html, https://docs.trustgraph.ai/guides/building/typescript-libraries.html.

Role A verdict: strong LEARN/BUILD donor, weak direct runtime dependency. It maps well to the repo's authority/projection/cache doctrine because TrustGraph's own docs separate source provenance, core facts, and retrieval traces, but its microservice/runtime scope is too broad for authoritative professional-services memory. Sources: https://docs.trustgraph.ai/overview/explainability.html, https://docs.trustgraph.ai/guides/context-cores/, `standards/memory-architecture/05-context-graph-capability-assessment.md` section "Authority Model".

Role B verdict: useful lab/reference, not the default dev-agent memory stack. Local footprint is heavy, MCP docs are mixed, and the MCP guide itself says the page needs a rewrite and that production deployment/authentication may not be ready, while the maturity page labels MCP server support production-ready with ecosystem security caveats. Sources: https://docs.trustgraph.ai/guides/mcp-integration/, https://docs.trustgraph.ai/overview/maturity.html.

# Hard-gate verdicts

| Gate | Verdict | Evidence |
|---|---:|---|
| 1. self-hostable/local-first | PASS, with footprint caveat | TrustGraph documents local Docker/Podman, local Minikube, global cloud, European cloud, and self-host deployments. Docker/Podman is described as local evaluation/development with 8GB RAM/4 CPU/20GB disk in the deployment chooser, while the detailed compose guide asks for 12GB+ RAM and 8 CPUs for the containers. Sources: https://docs.trustgraph.ai/deployment/choosing-deployment.html, https://docs.trustgraph.ai/deployment/compose.html. |
| 2. OSI license without copyleft trap | PASS | The GitHub repository and license file identify Apache-2.0. No SSPL, BUSL, AGPL, or copyleft service clause was found in the fetched license source. Sources: https://github.com/trustgraph-ai/trustgraph, https://github.com/trustgraph-ai/trustgraph/blob/master/LICENSE. |
| 3. TS-native or clean HTTP/MCP API | PASS | The core repo is Python-heavy, but the gate is satisfied by clean integration surfaces: REST API, WebSocket API, Python API, TypeScript client/React libraries, CLI, and MCP tool invocation/configuration. Sources: https://docs.trustgraph.ai/reference/apis/rest.html, https://docs.trustgraph.ai/reference/apis/websocket.html, https://docs.trustgraph.ai/reference/apis/python, https://docs.trustgraph.ai/guides/building/typescript-libraries.html, https://docs.trustgraph.ai/guides/mcp-integration/. |

# Architecture & storage

TrustGraph is a modular, event-driven microservice platform. The architecture page describes Apache Pulsar as the messaging backbone, Cassandra for metadata/state/operational data, Garage as S3-compatible object storage, and Grafana/Loki for observability. It also lists pluggable graph stores (Cassandra, Neo4j, Memgraph, FalkorDB), vector stores (Qdrant, Milvus), and a Cassandra-backed structure store. Source: https://docs.trustgraph.ai/overview/architecture.html.

The storage shape matches the repo's prior "graph + vector + row/structured + object" characterization, but current official docs are more precise: Cassandra is both operational metadata/state and, in some modes, a graph/structured backend; Garage owns source documents/artifacts; Qdrant is the recommended vector store in the maturity matrix. Sources: https://docs.trustgraph.ai/overview/architecture.html, https://docs.trustgraph.ai/overview/maturity.html.

The operational model is not a small embedded memory library. Processors communicate through pub/sub queues, flows chain processors, and blueprints define reusable flow templates. The architecture page gives examples such as document extraction (`pdf-decoder -> chunker -> kg-extract-relationships -> triple-store`) and GraphRAG (`api-gateway -> graph-rag -> prompt -> text-completion`). Source: https://docs.trustgraph.ai/overview/architecture.html.

Deployment options are broad. The deployment chooser covers Docker/Podman Compose, local Minikube, OVHcloud, Scaleway, AWS RKE2, Azure AKS, GCP, and self-host GPU deployments. The AWS RKE guide describes Pulumi-managed RKE2, AWS Bedrock integration, EBS persistent storage, Grafana/Prometheus, IAM policies, and a 3-node configurable cluster. Sources: https://docs.trustgraph.ai/deployment/choosing-deployment.html, https://docs.trustgraph.ai/deployment/aws-rke.html.

# Retrieval

TrustGraph exposes DocumentRAG, GraphRAG, OntologyRAG, SPARQL query, triple queries, structured/row queries, NLP-to-structured query, graph embeddings, document embeddings, row embeddings, prompt, text completion, and agent services through the REST/WebSocket gateway. Source: https://docs.trustgraph.ai/reference/apis/rest.html.

GraphRAG retrieval is graph-grounded and explainability-aware: the query flow extracts concepts from the question, explores graph edges, focuses on selected edges, and synthesizes the answer. Document RAG retrieves document chunks by similarity. Agent queries record ReAct reasoning iterations when explainability is enabled. Source: https://docs.trustgraph.ai/overview/explainability.html.

Context Cores are the relevant knowledge-packaging unit. The context-core guide says a core contains graph edges, schema information, and graph embeddings; cores can be downloaded as files, uploaded, loaded into retrieval stores, and managed as offline/online/loaded states. Source: https://docs.trustgraph.ai/guides/context-cores/.

Document loading is asynchronous in the REST API. The text-load endpoint accepts a document, queues it for chunking, embedding, storage, and indexing, returns 202 immediately, and does not return synchronous processing status. Source: https://docs.trustgraph.ai/reference/apis/rest.html.

# Provenance/temporal/lifecycle

TrustGraph's strongest fit is provenance. The explainability page documents three named graphs: the default graph for core knowledge facts, `urn:graph:source` for extraction provenance, and `urn:graph:retrieval` for query-time explainability. It explicitly says these remain queryable through the same interfaces while keeping explainability metadata out of the retrieval graph. Source: https://docs.trustgraph.ai/overview/explainability.html.

Extraction provenance is modeled with W3C PROV-O. The documented lineage is Document -> Pages -> Chunks -> Subgraphs, linked by `prov:wasDerivedFrom`, so an extracted edge can be traced back to the exact chunk, page, and source document. Source: https://docs.trustgraph.ai/overview/explainability.html.

Query-time lifecycle is persistent, not ephemeral. GraphRAG traces include question timestamp, grounding, exploration, focus, synthesis, and per-edge reasoning; Document RAG and Agent traces are also stored. The page states that reasoning traces are persisted as RDF triples in `urn:graph:retrieval` for later audit, comparison, dashboarding, and review. Source: https://docs.trustgraph.ai/overview/explainability.html.

Temporal semantics are weaker than the repo's Graphiti/Zep temporal model. The fetched TrustGraph pages show timestamps, persistence, provenance chains, freshness controls, and versionable/loadable Context Cores, but they do not specify bitemporal validity windows, auto-invalidation, or conflict-time semantics. Sources: https://docs.trustgraph.ai/overview/explainability.html, https://github.com/trustgraph-ai/trustgraph, https://docs.trustgraph.ai/guides/context-cores/.

The prior repo phrase "trust scoring" should be treated as UNCLEAR from these fetched primary sources. Current official pages substantiate provenance, authority ranking/freshness controls in Context Cores, source and retrieval traces, and auditability; they do not document a concrete trust-score/reputation algorithm in the fetched pages. Sources: https://github.com/trustgraph-ai/trustgraph, https://docs.trustgraph.ai/overview/explainability.html.

# Integration surface

External clients should use the API gateway rather than direct pub/sub. The architecture page says the gateway exposes REST and WebSocket interfaces, both support roughly the same functionality, and direct Pulsar access is generally not recommended for external clients because queue topology is complex and Pulsar should be treated as an internal implementation detail. Source: https://docs.trustgraph.ai/overview/architecture.html.

REST is documented as a workspace-aware API with bearer-token authentication, global IAM services, workspace-scoped config/flow/librarian/knowledge/collection services, and flow-scoped RAG/query/load/agent services. Field names use kebab-case. Source: https://docs.trustgraph.ai/reference/apis/rest.html.

WebSocket is documented as a single persistent, multiplexed, asynchronous connection with request IDs, streaming responses, and schemas reused from the REST API. The client authenticates in-band by sending the bearer token as the first message after connecting. Source: https://docs.trustgraph.ai/reference/apis/websocket.html.

Python is the most complete official SDK surface. The Python API docs show `trustgraph.api.Api`, REST/WebSocket clients, bulk operations, metrics, data types, and typed exception classes; the default local URL is `http://localhost:8088/`. Source: https://docs.trustgraph.ai/reference/apis/python.

TypeScript is a real integration surface but not the core implementation. The TypeScript docs list `trustgraph-client` as a pure TypeScript WebSocket client, plus `trustgraph-react-provider` and `trustgraph-react-state`; the same page is marked "needs work" for new Workbench API/component updates. The GitHub repository language split is Python 98.4%, Shell 1.2%, Other 0.4%. Sources: https://docs.trustgraph.ai/guides/building/typescript-libraries.html, https://github.com/trustgraph-ai/trustgraph.

MCP support exists at both API/CLI and agent-tool levels. The REST API lists an MCP Tool flow-scoped service; the MCP guide shows `tg-set-mcp-tool`, `tg-invoke-mcp-tool`, `tg-set-tool --type mcp-tool`, and `tg-show-mcp-tools`. However, the MCP guide is explicitly marked as needing a complete rewrite and warns that production deployment/authentication may not be ready, while the maturity page calls MCP server support production-ready with security caveats. Sources: https://docs.trustgraph.ai/reference/apis/rest.html, https://docs.trustgraph.ai/guides/mcp-integration/, https://docs.trustgraph.ai/overview/maturity.html.

# License, pricing & maturity

License: PASS. The repository and license file identify Apache-2.0, and the official docs footer also links Apache 2.0. Sources: https://github.com/trustgraph-ai/trustgraph, https://github.com/trustgraph-ai/trustgraph/blob/master/LICENSE, https://docs.trustgraph.ai/overview/architecture.html.

Pricing/cloud-vs-OSS split: the fetched primary pages do not show public numeric pricing. The docs say enterprise support and integration are provided by Knownext Inc.; they list Business/Standard Support, Enterprise/Mission-Critical Support, site-specific integration, tailored deployment automation, security hardening, continuous compatibility testing, and strategic co-innovation. Source: https://docs.trustgraph.ai/overview/enterprise.html.

The open-source edition has a deliberately simple access model: one workspace per user, read/write or admin access, and built-in reader/writer/admin roles. Enterprise offerings can add multi-workspace permissions, external identity providers such as OIDC/SAML/LDAP, fine-grained rules, and cross-workspace administration. Source: https://docs.trustgraph.ai/overview/workspaces.html.

Maturity is stronger than the older repo notes imply, but uneven. The maturity page marks core GraphRAG, OntologyRAG, DocumentRAG, integrated extraction, Agent ReAct, API Gateway REST/WebSocket, MCP server support, Qdrant, Cassandra, Neo4j, Memgraph, and FalkorDB as production-ready. It says Scaleway and OVHcloud Kubernetes deployments have full e2e CI suites, while Azure AKS is evaluation and AWS EC2 is evaluation. Source: https://docs.trustgraph.ai/overview/maturity.html.

The production-operations docs are not equally mature. The production considerations page is explicitly a placeholder and says security, performance/scaling, high availability, backup/recovery, monitoring, resource planning, network configuration, database configuration, SSL/TLS, compliance, maintenance, and disaster recovery content are "Coming soon." Source: https://docs.trustgraph.ai/deployment/production-considerations.html.

Activity: the GitHub page fetched during this run showed a public repository with 2.3k stars, 269 forks, 1,468 commits, 24 open issues, and Apache-2.0 license. The changelog documents v2.1 explainability/provenance, v2.2 agent orchestration/RabbitMQ/SPARQL/WebSocket/MCP auth changes, and many tests around orchestrator provenance. Sources: https://github.com/trustgraph-ai/trustgraph, https://docs.trustgraph.ai/reference/changelog/trustgraph.html.

# Role A assessment

Role A verdict: PASS as a donor/cache/projection pattern source; FAIL as system of record. The repo requires durable truth to stay repo-native, schema-first, evidence-backed, provenance-tracked, and replayable, with graph/RAG/semantic memory only producing candidates, caches, context packets, retrieval hints, and inspection UX. Local doctrine checked: `standards/memory-architecture/05-context-graph-capability-assessment.md` sections "Decision" and "Authority Model"; `standards/memory-architecture/README.md` sections "Core Thesis" and "Three Imperatives".

Architecture fit is good behind a driver boundary. TrustGraph's API gateway, Context Cores, named graphs, and retrieval traces can be represented as rebuildable projections over accepted runtime claims and evidence. This aligns with the product runtime's local-first governed workspace where durable assertions carry evidence, provenance, lifecycle, and cost. Sources: https://docs.trustgraph.ai/overview/architecture.html, https://docs.trustgraph.ai/overview/explainability.html, https://docs.trustgraph.ai/guides/context-cores/, `goals/agentic-professional-runtime/README.md` section "Product Thesis".

Storage and retrieval patterns worth borrowing: context-core packaging; separate source/retrieval/fact graphs; import/export of triples and embeddings; REST/WebSocket APIs; async document ingestion; GraphRAG/DocumentRAG/OntologyRAG service shape; SPARQL and triples query surfaces. Sources: https://docs.trustgraph.ai/guides/context-cores/, https://docs.trustgraph.ai/overview/explainability.html, https://docs.trustgraph.ai/reference/apis/rest.html.

Boundaries to reject for Role A: TrustGraph's broad agent runtime, service mesh, flow manager, and LLM-mediated extraction cannot become accepted legal/professional truth. They can create candidate extracts, retrieval packets, and explainability traces only after the repo's own evidence/acceptance lifecycle gates them. Local doctrine checked: `standards/memory-architecture/01-memory-layer-taxonomy.md` sections "Layer 4" and "Query Routing Principle"; `standards/memory-architecture/05-context-graph-capability-assessment.md` section "Authority Model".

# Role B assessment

Role B verdict: UNCLEAR/weak for default Claude/Codex dev-tooling memory. TrustGraph can expose MCP tools and persistent agent traces, but its local footprint is much heavier than repo-file memory or a small MCP service. Docker/Podman compose needs significant local resources in the detailed guide, and Minikube asks for still more. Sources: https://docs.trustgraph.ai/deployment/compose.html, https://docs.trustgraph.ai/deployment/minikube.html.

Recall quality should be strong for source-grounded graph/doc queries because GraphRAG, DocumentRAG, source provenance, and persistent reasoning traces are first-class features. The risk is not recall capability; it is operating a full platform to support dev-agent memory, and then preventing the semantic layer from becoming authoritative. Sources: https://docs.trustgraph.ai/overview/explainability.html, https://docs.trustgraph.ai/reference/apis/rest.html.

MCP reliability is mixed. The official maturity page labels MCP server support production-ready but warns about MCP ecosystem security; the MCP integration guide itself is marked as needing a complete rewrite and says production deployment/authentication may not be ready. Changelog v2.2 added `GATEWAY_SECRET` support for MCP server to API gateway authentication, which improves the story but does not remove the documentation mismatch. Sources: https://docs.trustgraph.ai/overview/maturity.html, https://docs.trustgraph.ai/guides/mcp-integration/, https://docs.trustgraph.ai/reference/changelog/trustgraph.html.

Maintenance burden is high for Role B. A useful setup would require containers, gateway auth, workspaces, storage, model provider configuration, monitoring, and MCP tool configuration. For Claude/Codex agent memory, TrustGraph is better as an evaluation/reference lane or shared graph lab than as the default recall substrate. Sources: https://docs.trustgraph.ai/deployment/compose.html, https://docs.trustgraph.ai/overview/architecture.html, https://docs.trustgraph.ai/overview/workspaces.html.

# Contradictions with prior repo assessments

`standards/memory-architecture/03-saas-landscape-assessment.md` section "TrustGraph" is mostly confirmed. Its LEARN + BUILD verdict and "do not deploy TrustGraph itself; implement these concepts in BeepGraph" remain aligned with current official docs and with the product's authority boundary. The architecture claim is confirmed at a high level by the architecture docs. Sources: https://docs.trustgraph.ai/overview/architecture.html, local lines 44-58 of `standards/memory-architecture/03-saas-landscape-assessment.md`.

The same `03` section is stale on operational maturity. It says documentation is thin on performance and failure recovery and cites "20+ containers"; the current docs now include a formal maturity matrix, CI/test counts, production-ready labels for several backends/deployments, and a 6-service quickstart in `llms.txt`. But the "production considerations" page remains a placeholder, so the concern is reduced, not eliminated. Sources: https://docs.trustgraph.ai/overview/maturity.html, https://docs.trustgraph.ai/deployment/production-considerations.html, https://trustgraph.ai/llms.txt.

The `03` "trust/reputation scoring" claim is not confirmed by the fetched primary sources. Current official pages substantiate provenance, authority ranking/freshness controls, and explainability traces, but not a documented trust-score or reputation algorithm in the pages fetched for this lane. Sources: https://github.com/trustgraph-ai/trustgraph, https://docs.trustgraph.ai/overview/explainability.html, local lines 50-58 of `standards/memory-architecture/03-saas-landscape-assessment.md`.

`standards/memory-architecture/05-context-graph-capability-assessment.md` section "TrustGraph" is confirmed and sharpened. The docs back separate core/source/retrieval graphs, PROV-O extraction provenance, persistent query traces, Context Cores, graph/vector/object/structured storage, and REST/WebSocket/TypeScript integration surfaces. Sources: https://docs.trustgraph.ai/overview/explainability.html, https://docs.trustgraph.ai/guides/context-cores/, https://docs.trustgraph.ai/overview/architecture.html, https://docs.trustgraph.ai/guides/building/typescript-libraries.html, local lines 62-99 of `standards/memory-architecture/05-context-graph-capability-assessment.md`.

`05` remains correct that TrustGraph should not win package topology or source-of-truth status. Current docs make that more important, not less, because TrustGraph is a broad agentic runtime with flows, processors, Workbench, IAM/workspaces, deployment packages, RAG, MCP, and agent orchestration. Sources: https://docs.trustgraph.ai/overview/architecture.html, https://docs.trustgraph.ai/overview/workspaces.html, https://docs.trustgraph.ai/reference/changelog/trustgraph.html, local lines 86-99 of `standards/memory-architecture/05-context-graph-capability-assessment.md`.

`explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md` section "2.1 TrustGraph" is confirmed on the borrowing thesis: provenance/explainability shell, three named graphs, PROV-O traces, Context Cores packaging, Python/service-platform orientation, and rejection of schema-light triples as authority. It is stale on activity numbers: this run fetched 2.3k stars and 1,468 commits, not the earlier 2.2k/~1,425 snapshot. Sources: https://github.com/trustgraph-ai/trustgraph, https://docs.trustgraph.ai/overview/explainability.html, local lines 56-85 of `explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md`.

# References

Fetch note: Firecrawl CLI was attempted first for `https://trustgraph.ai/llms.txt` and returned `Error: fetch failed`. Browser fetch succeeded, so the machine-local scratch fallback copy of `trustgraph-llms.txt` was not used. Links omitted because of network failure: none.

Official TrustGraph pages fetched or cited:

- https://trustgraph.ai/llms.txt
- https://docs.trustgraph.ai/overview/architecture.html
- https://docs.trustgraph.ai/overview/explainability.html
- https://docs.trustgraph.ai/overview/maturity.html
- https://docs.trustgraph.ai/overview/enterprise.html
- https://docs.trustgraph.ai/overview/workspaces.html
- https://docs.trustgraph.ai/deployment/
- https://docs.trustgraph.ai/deployment/choosing-deployment.html
- https://docs.trustgraph.ai/deployment/compose.html
- https://docs.trustgraph.ai/deployment/cli-configuration.html
- https://docs.trustgraph.ai/deployment/minikube.html
- https://docs.trustgraph.ai/deployment/aws-rke.html
- https://docs.trustgraph.ai/deployment/self-hosting-intro.html
- https://docs.trustgraph.ai/deployment/production-considerations.html
- https://docs.trustgraph.ai/guides/context-cores/
- https://docs.trustgraph.ai/guides/building/typescript-libraries.html
- https://docs.trustgraph.ai/guides/mcp-integration/
- https://docs.trustgraph.ai/reference/apis/rest.html
- https://docs.trustgraph.ai/reference/apis/websocket.html
- https://docs.trustgraph.ai/reference/apis/python
- https://docs.trustgraph.ai/reference/cli/
- https://docs.trustgraph.ai/reference/changelog/trustgraph.html
- https://github.com/trustgraph-ai/trustgraph
- https://github.com/trustgraph-ai/trustgraph/blob/master/LICENSE

Repo context and prior assessments checked:

- `standards/memory-architecture/README.md`
- `standards/memory-architecture/01-memory-layer-taxonomy.md`
- `goals/agentic-professional-runtime/README.md`
- `standards/memory-architecture/03-saas-landscape-assessment.md`
- `standards/memory-architecture/05-context-graph-capability-assessment.md`
- `explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md`
