## TL;DR

Zep Cloud and Graphiti should stay in the LEARN/donor lane for this repo. Zep Cloud is a managed, proprietary Context Lake around Graphiti with paid enterprise governance, sub-200ms retrieval claims, TS/Python/Go SDKs, and cloud/BYOK/BYOC deployment. Graphiti is the Apache-2.0 OSS temporal graph engine that runs locally, but it is Python-first, requires a graph database plus LLM/embedding providers, and its MCP server is documented as experimental. Sources: https://help.getzep.com/zep-vs-graphiti.md, https://help.getzep.com/graphiti/getting-started/quick-start.md, https://help.getzep.com/graphiti/getting-started/mcp-server.md, https://raw.githubusercontent.com/getzep/graphiti/main/LICENSE.

For Role A, Zep/Graphiti is useful as a temporal cache/projection donor behind `drivers/*`, never as system of record. The repo's binding doctrine says semantic memory products can be managed caches over deterministic authority, not foundations, and the professional runtime requires local-first truth with claim, evidence, provenance, and human acceptance gates. Repo sources: `standards/memory-architecture/README.md:20-24`, `standards/memory-architecture/README.md:34-42`, `goals/agentic-professional-runtime/README.md:65-105`.

For Role B, Graphiti should not survive as the primary dev-tooling memory incumbent unless it is intentionally scoped to local experiments. The docs show good temporal recall primitives and a local MCP path, but the MCP path is experimental and operationally heavier than a dev-memory layer should be. Zep's Memory MCP is more governed, but it is Enterprise-only and tied to Zep Cloud/BYOC plus an enterprise identity provider. Sources: https://help.getzep.com/graphiti/getting-started/mcp-server.md, https://help.getzep.com/memory-mcp-server.md, https://help.getzep.com/memory-mcp-server/authentication.md.

Research note: shell `curl` could not resolve `help.getzep.com`, so I consulted the provided pre-fetched root `llms.txt` copy. I then successfully fetched the live v3 index and all cited docs through the Node-backed fetch path. From the pre-fetched root index, the only links not followed as evidence pages were `https://help.getzep.com/v2/llms.txt` and `https://help.getzep.com/_mcp/server`; the v3 index and cited v3 pages were fetched live.

## Hard-gate verdicts

1. self-hostable / local-first: SPLIT. Graphiti OSS passes this gate as a local/self-hosted framework: Zep's comparison says Graphiti runs locally with pluggable backends, while Zep is managed cloud/BYOK/BYOC on a proprietary Context Graph Engine. The FAQ says Zep Community Edition is deprecated and no longer supported; BYOC is available only as an enterprise deployment. Sources: https://help.getzep.com/zep-vs-graphiti.md, https://help.getzep.com/faq.md, https://help.getzep.com/graphiti/getting-started/quick-start.md. For the repo's local-first product runtime, Zep Cloud fails unless BYOC is deliberately accepted as an enterprise deployment boundary, which is not the same as local-first desktop ownership. Repo source: `goals/agentic-professional-runtime/README.md:65-105`.

2. OSI license without copyleft trap: CONDITIONAL PASS. Graphiti itself is Apache-2.0. Source: https://raw.githubusercontent.com/getzep/graphiti/main/LICENSE. The trap is the backend choice: Graphiti docs list Neo4j, FalkorDB, and Amazon Neptune as pluggable backends, and FalkorDB's own license is SSPLv1, which this repo's hard gate treats as a fail. Sources: https://help.getzep.com/graphiti/getting-started/overview.md, https://help.getzep.com/graphiti/configuration/falkor-db-configuration.md, https://github.com/FalkorDB/FalkorDB/raw/master/LICENSE.txt. Therefore Graphiti passes only if the selected backing store also passes the repo's license gate; Graphiti plus FalkorDB does not.

3. TS-native or clean HTTP/MCP API: PASS FOR ZEP CLOUD, PARTIAL FOR GRAPHITI OSS. Zep Cloud has a TypeScript SDK package (`@getzep/zep-cloud`), Python and Go SDKs, and OpenAPI references with the API server at `https://api.getzep.com/api/v2`. Sources: https://help.getzep.com/quick-start-guide.md, https://help.getzep.com/openapi/sdk-reference.yaml. Zep also has a docs MCP server and an Enterprise Memory MCP server. Sources: https://help.getzep.com/docs-mcp-server.md, https://help.getzep.com/memory-mcp-server.md. Graphiti OSS is not TS-native; its public quickstart is Python (`pip install graphiti-core`) and its clean agent-facing surface is the experimental Graphiti MCP server. Sources: https://help.getzep.com/graphiti/getting-started/quick-start.md, https://help.getzep.com/graphiti/getting-started/mcp-server.md.

## Cloud-vs-OSS split

The official split is explicit: Graphiti is the open-source temporal knowledge graph framework and "builds the graph"; Zep operates it at enterprise scale as a governed Context Lake. Graphiti builds one Context Graph per subject and runs locally; Zep runs Graphiti inside a managed system for extraction, retrieval, storage, governance, and millions of governed Context Graphs. Source: https://help.getzep.com/zep-vs-graphiti.md.

Graph storage is a hard split. Graphiti uses pluggable backends including Neo4j, FalkorDB, and Amazon Neptune; Zep Cloud uses a proprietary, highly scalable Context Graph Engine and managed runtime. Source: https://help.getzep.com/zep-vs-graphiti.md. Graphiti's docs also describe Neo4j as the primary backend, FalkorDB local Docker support, and Neptune integration; Kuzu is present only on a deprecated configuration page. Sources: https://help.getzep.com/graphiti/configuration/neo-4-j-configuration.md, https://help.getzep.com/graphiti/configuration/falkor-db-configuration.md, https://help.getzep.com/graphiti/configuration/aws-neptune-configuration.md, https://help.getzep.com/graphiti/configuration/kuzu-db-configuration.md.

Zep-only capabilities include managed performance, dashboard graph visualization, debug logs, API logs, SDKs for Python/TypeScript/Go, RBAC, ABAC, audit, retention, multi-tenant isolation, customer-key encryption, and Cloud/BYOK/BYOC deployment. Source: https://help.getzep.com/zep-vs-graphiti.md. The security docs add SOC 2 Type II, HIPAA BAA availability for Enterprise, BYOK, BYOM, and BYOC. Source: https://help.getzep.com/security-compliance.md. Several operational features are paid-gated: Batch API is Enterprise, RBAC is Enterprise, audit logging is Enterprise, API logging starts at Flex Plus and Enterprise, BYOK and BYOM are Enterprise add-ons, and Memory MCP is Enterprise-only. Sources: https://help.getzep.com/adding-batch-data.md, https://help.getzep.com/role-based-access-control.md, https://help.getzep.com/audit-logging.md, https://help.getzep.com/api-logging.md, https://help.getzep.com/bring-your-own-key.md, https://help.getzep.com/bring-your-own-llm.md, https://help.getzep.com/memory-mcp-server.md.

Zep self-hosting is not the old local Community Edition story. The FAQ says Zep Community Edition is deprecated and no longer supported, then points users to hosted Zep Cloud, Graphiti OSS, or BYOC for enterprise customers needing VPC residency and maximum control. Source: https://help.getzep.com/faq.md.

## Architecture & storage

Zep's Context Graph is the unit of agent memory: nodes are entities, edges are facts/relationships, and the graph updates dynamically as new data arrives, invalidating outdated facts while preserving history. Zep says it builds these graphs from chat, business data, documents, JSON, and other sources, then serves token-efficient context from a governed Context Lake. Source: https://help.getzep.com/concepts.md.

Zep stores graph data as entity edges, entity nodes, and episodic nodes. Edges carry semantic facts and validity/invalidity datetimes; episodic nodes preserve raw data from chat history or `graph.add`. Source: https://help.getzep.com/graph-overview.md. Users get user graphs that integrate context across all of a user's threads, while standalone graphs support shared/domain graphs independent of a single user. Sources: https://help.getzep.com/users-and-user-graphs.md, https://help.getzep.com/create-graph.md.

The ingestion model has two main paths. Thread API persists chat messages and ingests them into the user-level graph; Graph API ingests non-chat text, JSON, and message-format business data. Sources: https://help.getzep.com/threads.md, https://help.getzep.com/adding-context.md, https://help.getzep.com/adding-messages.md, https://help.getzep.com/adding-business-data.md. Zep's Batch API handles large historical datasets asynchronously, but it is Enterprise-only. Source: https://help.getzep.com/adding-batch-data.md.

Graphiti OSS mirrors the temporal graph idea but leaves the surrounding system to the operator. It ingests unstructured and structured data, builds temporal Context Graphs, and supports pluggable graph backends plus multiple LLM and embedding providers. Sources: https://help.getzep.com/graphiti/getting-started/overview.md, https://help.getzep.com/graphiti/getting-started/quick-start.md, https://help.getzep.com/graphiti/configuration/llm-configuration.md. Graphiti supports `group_id` namespaces for isolated graph environments within one Graphiti instance, which is useful for multi-tenant or test/prod separation but is not the same as Zep's managed governance substrate. Sources: https://help.getzep.com/graphiti/core-concepts/graph-namespacing.md, https://help.getzep.com/zep-vs-graphiti.md.

## Retrieval

Zep's retrieval stance is recall-first and low-latency. The retrieval philosophy page says Zep optimizes for high recall and under-200ms retrieval regardless of Context Graph size or count, and cites public benchmark results of 94.7% accuracy at 155ms on LoCoMo and 90.2% accuracy at 162ms on LongMemEval. Source: https://help.getzep.com/retrieval-philosophy.md. Zep's Context Block page says `thread.get_user_context()` returns a low-latency P95 under 200ms block assembled from the user's graph. Source: https://help.getzep.com/retrieving-context.md.

Zep's default Context Block uses Smart Context Assembly/auto search, combines semantic search, full-text search, and breadth-first search, and may include user summary, facts, entities, episodes, observations, and thread summaries. Sources: https://help.getzep.com/retrieving-context.md, https://help.getzep.com/context-types.md. Direct graph search combines semantic similarity, BM25 full-text search, optional breadth-first search, and reciprocal-rank fusion; `scope="auto"` searches across edges, nodes, episodes, observations, and thread summaries and returns a ready-to-use context block. Source: https://help.getzep.com/searching-the-graph.md.

Graphiti OSS retrieval is also hybrid but lower-level. Its docs describe `graphiti.search(query)` as hybrid search combining semantic similarity and BM25, with optional node-distance reranking, and lower-level recipes covering edge, node, community, RRF, MMR, and cross-encoder variants. Source: https://help.getzep.com/graphiti/working-with-data/searching.md. Graphiti docs also say its hybrid retrieval uses vector similarity, BM25 full-text, and graph traversal without LLM-in-the-loop reranking. Source: https://help.getzep.com/graphiti/getting-started/overview.md.

For Role A, retrieval patterns worth porting are the bounded Context Block, source-selective context types, auto search, query-time character budgets, and provenance back-pointers. For accepted professional truth, retrieval output remains a projection over authoritative events/evidence, matching the repo's rule that context packets are bounded projections and semantic/temporal memory is a managed cache. Repo source: `standards/memory-architecture/05-context-graph-capability-assessment.md:42-58`.

## Temporal/provenance model

Facts are Zep's edge-level, precise, time-stamped relationships. Zep docs describe four timestamps: `created_at` when Zep learned a fact, `valid_at` when it became true, `invalid_at` when it stopped being true, and `expired_at` when Zep learned it stopped being true. Source: https://help.getzep.com/facts.md. The docs also state that when new data invalidates a prior fact, Zep stores invalidity on the existing edge and creates new facts as appropriate. Sources: https://help.getzep.com/concepts.md, https://help.getzep.com/facts.md.

Episodes are the raw artifacts handed to Zep: chat messages, freeform text chunks, or JSON objects. Zep stores each episode verbatim alongside derived entities, edges, and summaries, and the docs recommend episodes when an agent needs exact source truth, quotes, citations, or surrounding context. Source: https://help.getzep.com/episodes.md.

Episode associations are the main provenance mechanism in the docs. Zep says every piece of context it produces, including facts, entities, and observations, is derived from one or more episodes, and that these associations let clients trace artifacts back to source episodes. The same association model projects episode metadata onto derived artifacts for filtering and ABAC. Source: https://help.getzep.com/episode-metadata-projection.md.

Observations are cloud-side derived patterns. Zep describes them as durable, evidence-backed context derived automatically from graph structure, deduplicated/merged as new evidence arrives, retired when superseded, and read-only from the application side. Source: https://help.getzep.com/observations.md. That is useful as a cache/projection pattern, but it is not acceptable as authoritative professional judgment in this repo without evidence-linked acceptance, because the runtime's locked decision is that agents may create candidate writes and human acceptance promotes them into authoritative state. Repo source: `goals/agentic-professional-runtime/README.md:93-105`.

Graphiti's corresponding OSS primitives are temporal awareness, edge invalidation, episodes, custom entity/edge types, graph namespaces, communities, CRUD operations, and manual fact triples. Sources: https://help.getzep.com/graphiti/getting-started/overview.md, https://help.getzep.com/graphiti/core-concepts/adding-episodes.md, https://help.getzep.com/graphiti/core-concepts/custom-entity-and-edge-types.md, https://help.getzep.com/graphiti/core-concepts/communities.md, https://help.getzep.com/graphiti/core-concepts/graph-namespacing.md, https://help.getzep.com/graphiti/working-with-data/crud-operations.md, https://help.getzep.com/graphiti/working-with-data/adding-fact-triples.md.

## Integration surface

Zep Cloud has clean application integration. The quickstart installs `zep-cloud` for Python, `@getzep/zep-cloud` for TypeScript, and `github.com/getzep/zep-go/v3` for Go, then uses one client for users, threads, messages, graph add/search, and context retrieval. Source: https://help.getzep.com/quick-start-guide.md. The OpenAPI references expose a Cloud API server at `https://api.getzep.com/api/v2` with paths for threads, context, messages, users, graph ontology, graph create/add/search/read/delete, episodes, observations, thread summaries, projects, tasks, and batches. Source: https://help.getzep.com/openapi/sdk-reference.yaml.

Zep has two MCP stories. The public Documentation MCP server lets coding agents search Zep docs at `https://docs-mcp.getzep.com/mcp`. Source: https://help.getzep.com/docs-mcp-server.md. The product Memory MCP server is different: it is Enterprise-only, lets end users connect Claude/ChatGPT/Cursor-style clients to their own Zep memory through an enterprise identity provider, targets only the authenticated user's graph, and defaults to read-only writes unless an administrator enables them. Sources: https://help.getzep.com/memory-mcp-server.md, https://help.getzep.com/memory-mcp-server/authentication.md, https://help.getzep.com/memory-mcp-server/connect.md.

Graphiti OSS integration is Python-library-first plus MCP. The quickstart uses Python 3.10+, `graphiti-core`, OpenAI by default, and Neo4j/FalkorDB connection parameters. Source: https://help.getzep.com/graphiti/getting-started/quick-start.md. The LLM configuration page supports OpenAI, Azure OpenAI, Gemini, Anthropic, Groq, and local models via Ollama, with structured-output reliability caveats. Source: https://help.getzep.com/graphiti/configuration/llm-configuration.md. The Graphiti MCP server exposes Graphiti capabilities to Claude, Cursor, VS Code with Copilot, and other MCP clients, supports FalkorDB and Neo4j, multiple LLM and embedding providers, Docker Compose deployment, and HTTP/SSE/stdio-style client integration, but the docs call it experimental and subject to change. Source: https://help.getzep.com/graphiti/getting-started/mcp-server.md.

Graphiti also collects anonymous telemetry by default and supports opt-out with `GRAPHITI_TELEMETRY_ENABLED=false`. Source: https://help.getzep.com/graphiti/other/telemetry.md.

## License, pricing & maturity

Graphiti's license gate is clean at the framework layer: the fetched upstream license is Apache License 2.0. Source: https://raw.githubusercontent.com/getzep/graphiti/main/LICENSE. The local deployment stack is not automatically clean, because Graphiti backend selection is separate from Graphiti's license. FalkorDB's fetched license is Server Side Public License v1, so Graphiti plus FalkorDB fails this repo's "no SSPL/BUSL" hard gate. Source: https://github.com/FalkorDB/FalkorDB/raw/master/LICENSE.txt.

Zep Cloud is a commercial service, not an OSI-licensed runtime. The pricing page lists Free/prototyping credits, self-serve Flex and Flex Plus plans, and Enterprise custom pricing. It states credits are consumed by episode size, while retrieval, storage, threads, users, and graph storage are unmetered. Source: https://www.getzep.com/pricing/. Enterprise adds custom credits/rates, guaranteed rate limits with SLA, unlimited projects, SOC 2 Type II and HIPAA BAA, one-year audit/API logs, Slack/Teams support, a dedicated account manager, and deployment options of Cloud, Cloud + BYOK, and BYOC. Source: https://www.getzep.com/pricing/.

Maturity is uneven by role. Zep Cloud presents production enterprise controls, compliance, dashboards, API logs, BYOK/BYOM, BYOC, and support, but those benefits are paid cloud/BYOC features. Sources: https://help.getzep.com/security-compliance.md, https://www.getzep.com/pricing/. Graphiti OSS presents active docs for local quickstart, pluggable DB/LLM configuration, MCP, telemetry, namespaces, and custom ontology, but the MCP docs call the server experimental and the app developer owns the surrounding system. Sources: https://help.getzep.com/graphiti/getting-started/quick-start.md, https://help.getzep.com/graphiti/getting-started/mcp-server.md, https://help.getzep.com/zep-vs-graphiti.md.

## Role A assessment

Verdict: adopt patterns, not the platform. Zep/Graphiti should be a donor/cache/projection behind `drivers/*` only. The useful Role A patterns are bitemporal fact validity/invalidity windows, episode-backed provenance associations, metadata projection for policy/filtering, context-type selection, custom entity/edge types as domain ontology hints, and recall-first context block assembly. Sources: https://help.getzep.com/facts.md, https://help.getzep.com/episodes.md, https://help.getzep.com/episode-metadata-projection.md, https://help.getzep.com/context-types.md, https://help.getzep.com/customizing-graph-structure.md, https://help.getzep.com/retrieving-context.md.

Zep Cloud is not suitable as product-runtime memory authority. It is a managed cloud/BYOK/BYOC Context Lake with proprietary storage and paid enterprise governance, while this product is local-first and its authoritative primitive is claim plus evidence plus provenance. Sources: https://help.getzep.com/zep-vs-graphiti.md, https://help.getzep.com/faq.md, `goals/agentic-professional-runtime/README.md:65-105`. It can be a comparative benchmark or an optional enterprise deployment adapter only if its outputs remain candidate/projection data and source truth remains repo-owned.

Graphiti OSS is the better Role A research donor because it is self-hostable and Apache-2.0 at the framework layer. Sources: https://help.getzep.com/zep-vs-graphiti.md, https://raw.githubusercontent.com/getzep/graphiti/main/LICENSE. It still should not own accepted state: it is Python-first, uses LLM/embedding extraction, and depends on graph backend choices with their own operational and license risks. Sources: https://help.getzep.com/graphiti/getting-started/quick-start.md, https://help.getzep.com/graphiti/configuration/llm-configuration.md, https://help.getzep.com/graphiti/configuration/falkor-db-configuration.md, https://github.com/FalkorDB/FalkorDB/raw/master/LICENSE.txt. If used in Role A at all, it should be bounded by TTL/pruning/consolidation, rebuilt from authoritative events/evidence, and blocked from direct accepted writes, matching repo doctrine. Repo sources: `standards/memory-architecture/01-memory-layer-taxonomy.md:29-55`, `standards/memory-architecture/05-context-graph-capability-assessment.md:42-58`.

## Role B assessment

Verdict: Graphiti should not be the dev-tooling memory survivor by default. It can serve as a local experiment for temporal memory, but the official MCP server is experimental, requires a database plus LLM/embedding provider setup, and includes operational choices around FalkorDB/Neo4j, Docker, concurrency, provider rate limits, and telemetry. Sources: https://help.getzep.com/graphiti/getting-started/mcp-server.md, https://help.getzep.com/graphiti/getting-started/quick-start.md, https://help.getzep.com/graphiti/configuration/llm-configuration.md, https://help.getzep.com/graphiti/other/telemetry.md.

Zep Memory MCP is a stronger governance story but a poor default dev-tooling incumbent because it is Enterprise-only, account-enabled, IdP-gated, and aimed at end users connecting off-the-shelf agents to their own Zep user graph. Sources: https://help.getzep.com/memory-mcp-server.md, https://help.getzep.com/memory-mcp-server/authentication.md, https://help.getzep.com/memory-mcp-server/connect.md. It may be useful for enterprise product deployments, but it does not solve local Claude/Codex repo memory unless the team is already paying for Zep Enterprise and accepting cloud/BYOC memory.

For dev agents in this repo, the decisive issue is maintenance burden versus recall gain. Repo doctrine already says Graphiti is acceptable for Layer 2 only if temporal windows, promotion, competitor-density monitoring, and compression exist; it also records that naive Graphiti usage at scale was a bad fit. Repo source: `standards/memory-architecture/01-memory-layer-taxonomy.md:29-55`. Current docs confirm the temporal model is strong, but not that the dev-tooling MCP path is stable enough to be the one surviving incumbent. Source: https://help.getzep.com/graphiti/getting-started/mcp-server.md.

## Contradictions with prior repo assessments

`standards/memory-architecture/03-saas-landscape-assessment.md` classifies Graphiti/Zep as LEARN and says the temporal model is the insight. Confirmed. Current docs confirm entities/nodes, facts/edges with temporal validity, episodes as raw provenance artifacts, custom ontology/types, hybrid semantic/BM25/graph retrieval, and local Graphiti versus managed Zep. Sources: `standards/memory-architecture/03-saas-landscape-assessment.md:8-22`, https://help.getzep.com/graph-overview.md, https://help.getzep.com/facts.md, https://help.getzep.com/episodes.md, https://help.getzep.com/customizing-graph-structure.md, https://help.getzep.com/searching-the-graph.md, https://help.getzep.com/zep-vs-graphiti.md.

One `03` storage detail is stale/incomplete. It says Graphiti/Zep are backed by Neo4j, FalkorDB, Kuzu, or Neptune. Current Graphiti docs still include a Kuzu page, but that page says Kuzu support is deprecated, while the Zep-vs-Graphiti page lists Neo4j, FalkorDB, and Amazon Neptune for Graphiti and proprietary storage for Zep. Sources: `standards/memory-architecture/03-saas-landscape-assessment.md:12`, https://help.getzep.com/graphiti/configuration/kuzu-db-configuration.md, https://help.getzep.com/zep-vs-graphiti.md.

The `03` claim that Graphiti/Zep provides full provenance from facts to source episodes is mostly confirmed, but the precise current wording should be "episode associations and metadata projection", not "external symbolic verifier." Zep docs say every context artifact is derived from one or more episodes and that associations provide provenance and support ABAC/filtering. Sources: `standards/memory-architecture/03-saas-landscape-assessment.md:16`, https://help.getzep.com/episode-metadata-projection.md. This supports cache/projection use, but it does not replace repo-owned claim/evidence/provenance authority. Repo source: `standards/memory-architecture/05-context-graph-capability-assessment.md:42-58`.

`standards/memory-architecture/05-context-graph-capability-assessment.md` says Graphiti/Zep should be the primary temporal/session-memory donor and a managed Layer 2/4 cache with TTL, pruning, consolidation, and uncertainty. Confirmed. The current docs strengthen the same conclusion by making the split clearer: Graphiti gives local temporal graph primitives; Zep adds proprietary scale, governance, paid enterprise controls, and cloud/BYOC deployment. Sources: `standards/memory-architecture/05-context-graph-capability-assessment.md:20-40`, `standards/memory-architecture/05-context-graph-capability-assessment.md:178-205`, https://help.getzep.com/zep-vs-graphiti.md, https://help.getzep.com/security-compliance.md.

`05` also names FalkorDB as the graph projection engine. That is outside the Zep/Graphiti question but materially affects a Graphiti self-host stack. The current backend-license check flags a hard-gate conflict if FalkorDB is selected, because FalkorDB is SSPLv1. Sources: `standards/memory-architecture/05-context-graph-capability-assessment.md:20-40`, https://github.com/FalkorDB/FalkorDB/raw/master/LICENSE.txt.

`explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md` is broadly accurate. Its Graphiti/Zep section says Graphiti is OSS, Python-first, Apache-2.0, bitemporal, provenance-via-episodes, hybrid vector/BM25/graph retrieval, and suitable only as bounded session memory. Current docs confirm those points. Sources: `explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md:180-221`, https://help.getzep.com/graphiti/getting-started/overview.md, https://help.getzep.com/graphiti/getting-started/quick-start.md, https://raw.githubusercontent.com/getzep/graphiti/main/LICENSE, https://help.getzep.com/graphiti/working-with-data/searching.md.

The only current correction to `21` is emphasis: Zep's own docs now make the paid-cloud split sharper than a generic "commercial platform" label. Memory MCP, Batch API, RBAC, audit logging, BYOK/BYOM, and BYOC are explicitly paid/Enterprise or add-on features. Sources: https://help.getzep.com/memory-mcp-server.md, https://help.getzep.com/adding-batch-data.md, https://help.getzep.com/role-based-access-control.md, https://help.getzep.com/audit-logging.md, https://help.getzep.com/bring-your-own-key.md, https://help.getzep.com/bring-your-own-llm.md, https://www.getzep.com/pricing/.

## References

- Zep root index fetched: https://help.getzep.com/llms.txt
- Zep v3 index fetched: https://help.getzep.com/v3/llms.txt
- Zep concepts: https://help.getzep.com/concepts.md
- Architecture patterns: https://help.getzep.com/architecture-patterns.md
- Retrieval philosophy: https://help.getzep.com/retrieval-philosophy.md
- Users and user graphs: https://help.getzep.com/users-and-user-graphs.md
- Threads: https://help.getzep.com/threads.md
- Graph overview: https://help.getzep.com/graph-overview.md
- Zep vs Graph RAG: https://help.getzep.com/zep-vs-graph-rag.md
- Quick start: https://help.getzep.com/quick-start-guide.md
- Documentation MCP server: https://help.getzep.com/docs-mcp-server.md
- Debug mode: https://help.getzep.com/debug-mode.md
- Memory MCP server: https://help.getzep.com/memory-mcp-server.md
- Memory MCP authentication: https://help.getzep.com/memory-mcp-server/authentication.md
- Memory MCP client connection: https://help.getzep.com/memory-mcp-server/connect.md
- Adding context: https://help.getzep.com/adding-context.md
- Adding messages: https://help.getzep.com/adding-messages.md
- Adding business data: https://help.getzep.com/adding-business-data.md
- Batch ingestion: https://help.getzep.com/adding-batch-data.md
- Context types: https://help.getzep.com/context-types.md
- Facts: https://help.getzep.com/facts.md
- Episodes: https://help.getzep.com/episodes.md
- Observations: https://help.getzep.com/observations.md
- Episode metadata projection: https://help.getzep.com/episode-metadata-projection.md
- Retrieving context: https://help.getzep.com/retrieving-context.md
- Customizing graph structure: https://help.getzep.com/customizing-graph-structure.md
- Create graph: https://help.getzep.com/create-graph.md
- Searching the graph: https://help.getzep.com/searching-the-graph.md
- Security and compliance: https://help.getzep.com/security-compliance.md
- RBAC: https://help.getzep.com/role-based-access-control.md
- ABAC: https://help.getzep.com/attribute-based-access-control.md
- Audit logging: https://help.getzep.com/audit-logging.md
- API logging: https://help.getzep.com/api-logging.md
- Rate limits: https://help.getzep.com/rate-limits.md
- HIPAA compliance: https://help.getzep.com/hipaa-compliance.md
- BYOK: https://help.getzep.com/bring-your-own-key.md
- BYOM: https://help.getzep.com/bring-your-own-llm.md
- FAQ: https://help.getzep.com/faq.md
- Zep vs Graphiti: https://help.getzep.com/zep-vs-graphiti.md
- Graphiti welcome: https://help.getzep.com/graphiti/getting-started/welcome.md
- Graphiti overview: https://help.getzep.com/graphiti/getting-started/overview.md
- Graphiti quickstart: https://help.getzep.com/graphiti/getting-started/quick-start.md
- Graphiti MCP server: https://help.getzep.com/graphiti/getting-started/mcp-server.md
- Graphiti LLM configuration: https://help.getzep.com/graphiti/configuration/llm-configuration.md
- Graphiti Neo4j configuration: https://help.getzep.com/graphiti/configuration/neo-4-j-configuration.md
- Graphiti FalkorDB configuration: https://help.getzep.com/graphiti/configuration/falkor-db-configuration.md
- Graphiti AWS Neptune configuration: https://help.getzep.com/graphiti/configuration/aws-neptune-configuration.md
- Graphiti Kuzu configuration: https://help.getzep.com/graphiti/configuration/kuzu-db-configuration.md
- Graphiti adding episodes: https://help.getzep.com/graphiti/core-concepts/adding-episodes.md
- Graphiti custom entity and edge types: https://help.getzep.com/graphiti/core-concepts/custom-entity-and-edge-types.md
- Graphiti communities: https://help.getzep.com/graphiti/core-concepts/communities.md
- Graphiti graph namespacing: https://help.getzep.com/graphiti/core-concepts/graph-namespacing.md
- Graphiti search: https://help.getzep.com/graphiti/working-with-data/searching.md
- Graphiti CRUD: https://help.getzep.com/graphiti/working-with-data/crud-operations.md
- Graphiti adding fact triples: https://help.getzep.com/graphiti/working-with-data/adding-fact-triples.md
- Graphiti telemetry: https://help.getzep.com/graphiti/other/telemetry.md
- Zep OpenAPI index: https://help.getzep.com/openapi.yaml
- Zep OpenAPI SDK reference: https://help.getzep.com/openapi/sdk-reference.yaml
- Zep pricing: https://www.getzep.com/pricing/
- Graphiti license: https://raw.githubusercontent.com/getzep/graphiti/main/LICENSE
- Graphiti README: https://raw.githubusercontent.com/getzep/graphiti/main/README.md
- Graphiti MCP README: https://raw.githubusercontent.com/getzep/graphiti/main/mcp_server/README.md
- FalkorDB license: https://github.com/FalkorDB/FalkorDB/raw/master/LICENSE.txt
- Repo context: `standards/memory-architecture/README.md`
- Repo context: `standards/memory-architecture/01-memory-layer-taxonomy.md`
- Repo claim checked: `standards/memory-architecture/03-saas-landscape-assessment.md`
- Repo claim checked: `standards/memory-architecture/05-context-graph-capability-assessment.md`
- Repo claim checked: `explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md`
- Product context: `goals/agentic-professional-runtime/README.md`
