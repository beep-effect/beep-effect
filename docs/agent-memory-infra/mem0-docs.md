# TL;DR

Mem0 is a serious agent-memory API and benchmark target, but it should not become
the agentic-professional-runtime memory authority. The official docs split the
product into managed Platform and self-hosted OSS, with Platform carrying most of
the polished operational features and OSS providing configurable storage,
providers, and a self-hosted REST server
(https://docs.mem0.ai/llms.txt, https://docs.mem0.ai/platform/platform-vs-oss,
https://docs.mem0.ai/open-source/overview).

For Role A, Mem0 is at most a donor/cache/projection behind `drivers/*`: useful
patterns include ADD-only extraction, hybrid retrieval, entity linking, memory
decay, request logs, and clean REST/SDK surfaces. It is not a source of
professional truth because stored memories are extracted facts, not accepted
claim+evidence+provenance records with source spans, actor approval, and
repo-owned lifecycle (repo doctrine: `standards/memory-architecture/README.md`,
`standards/memory-architecture/01-memory-layer-taxonomy.md`,
`goals/agentic-professional-runtime/README.md`; Mem0 docs:
https://docs.mem0.ai/core-concepts/how-it-works,
https://docs.mem0.ai/core-concepts/memory-evaluation).

For Role B, Mem0 has a strong Platform MCP/plugin story for Claude Code and
Codex, but the self-hosted MCP/OpenMemory story is weakened by OpenMemory's own
sunsetting notice. That makes it plausible as an opt-in hosted dev-tooling
memory experiment, not the default local-first memory stack for this repo
(https://docs.mem0.ai/platform/mem0-mcp,
https://docs.mem0.ai/integrations/claude-code,
https://docs.mem0.ai/integrations/codex,
https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/README.md).

# Hard-gate verdicts

| Gate | Verdict | Evidence |
|---|---|---|
| 1. Self-hostable/local-first | PASS with caveats | OSS can run as an in-app library or Docker self-hosted server with dashboard, API keys, and request audit log; the server default vector store is Postgres + pgvector, while library defaults include local Qdrant and SQLite history. Truly local-first still requires local LLM/embedder configuration instead of the OpenAI defaults. OpenMemory local MCP exists, but is explicitly being sunset in favor of the newer self-hosted server. Sources: https://docs.mem0.ai/open-source/overview, https://docs.mem0.ai/open-source/setup, https://docs.mem0.ai/open-source/configuration, https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/README.md |
| 2. OSI license without copyleft trap | PASS | Mem0 docs list OSS license as Apache 2.0, and the GitHub repo identifies the project as Apache-2.0 licensed. Apache-2.0 is permissive; no SSPL/BUSL/AGPL trap was found in fetched sources. Platform remains usage-based managed SaaS, not OSS. Sources: https://docs.mem0.ai/platform/platform-vs-oss, https://github.com/mem0ai/mem0 |
| 3. TS-native or clean HTTP/MCP API | PASS with API gaps | Mem0 has Python and JavaScript/TypeScript SDKs, a self-hosted REST server, Platform REST endpoints, and hosted MCP. However, TypeScript OSS is thinner than Python: reranker and graph memory are Python-only in one config page, and OSS TypeScript lacks update/delete helpers in the operation docs. Hosted MCP is Platform-oriented; local OpenMemory MCP is sunset. Sources: https://docs.mem0.ai/open-source/configuration, https://docs.mem0.ai/open-source/features/rest-api, https://docs.mem0.ai/platform/mem0-mcp, https://docs.mem0.ai/core-concepts/memory-operations/update, https://docs.mem0.ai/core-concepts/memory-operations/delete, https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/README.md |

# Platform-vs-OSS split

The docs explicitly describe two products with one mental model: Mem0 Platform
as managed hosting and Mem0 Open Source as self-hosted memory. The llms index
routes Platform users to `MemoryClient` / `mem0ai`, and self-hosted users to
`Memory` / `mem0ai/oss`
(https://docs.mem0.ai/llms.txt).

Platform is the default recommendation in Mem0's docs for fast iteration and
production apps: no user-managed infrastructure, managed vector/LLM providers,
dashboard, autoscaling, high availability, built-in analytics, and managed
support (https://docs.mem0.ai/platform/platform-vs-oss). Platform-only or
Platform-favored features include criteria retrieval, Temporal Reasoning,
Memory Decay, webhooks, memory export, dashboard analytics, and the hosted MCP
server (https://docs.mem0.ai/platform/platform-vs-oss,
https://docs.mem0.ai/platform/features/temporal-reasoning,
https://docs.mem0.ai/platform/features/memory-decay,
https://docs.mem0.ai/platform/features/webhooks,
https://docs.mem0.ai/platform/features/memory-export,
https://docs.mem0.ai/platform/mem0-mcp).

OSS is the path when the app needs infrastructure and data control. It can run
as a Python/Node library or as a Docker self-hosted server with REST API,
dashboard, per-user API keys, and request audit log
(https://docs.mem0.ai/open-source/overview,
https://docs.mem0.ai/open-source/setup). OSS exposes component configuration for
LLM, embedder, vector store, history store, and reranker; Python has broader
feature coverage than TypeScript in the current docs
(https://docs.mem0.ai/open-source/configuration).

The Platform API Reference pages are Platform REST endpoints requiring an API
key, while the OSS REST server is documented separately as a self-hosted FastAPI
surface with no `/v1/` prefix (https://docs.mem0.ai/llms.txt,
https://docs.mem0.ai/open-source/features/rest-api). That matters for Role A:
the cleanest portable integration is not "the Platform API" alone, but a driver
that can target either Platform SDK/REST or the OSS REST server.

# Architecture & storage

Mem0's core flow is extraction after useful interactions and search before the
next model call. By default, `add` stores extracted memories rather than a
verbatim transcript; `infer=False` stores raw content exactly as provided
(https://docs.mem0.ai/core-concepts/how-it-works,
https://docs.mem0.ai/core-concepts/memory-operations/add).

The new algorithm is ADD-only during extraction. New facts are stored alongside
old facts, and explicit update/delete operations are used when the application
needs correction or erasure (https://docs.mem0.ai/core-concepts/how-it-works,
https://docs.mem0.ai/migration/platform-v2-to-v3,
https://docs.mem0.ai/migration/oss-v2-to-v3). This is a useful memory-cache
pattern, but it is not the repo's accepted-claim lifecycle because it does not
encode approval state, evidence spans, or deterministic replay as the authority.

Storage is documented as multi-store. The "How Mem0 Works" page says SQL holds
facts and metadata as the source of truth, vector DB holds embeddings, and an
entity/graph store holds relationships when graph memory is enabled
(https://docs.mem0.ai/core-concepts/how-it-works). The Memory Evaluation page
describes a different distribution: vector database as memory text/embeddings/
metadata and "primary fact storage", graph/entity store for connected memory IDs,
and SQL database for ADD history plus rolling message window
(https://docs.mem0.ai/core-concepts/memory-evaluation). That internal docs
tension reinforces that Mem0 should not define this repo's authority model.

For OSS library defaults, Mem0 uses OpenAI `gpt-5-mini`, OpenAI
`text-embedding-3-small`, local Qdrant at `/tmp/qdrant`, and SQLite history at
`~/.mem0/history.db`; the self-hosted server defaults to OpenAI models and
Postgres + pgvector (https://docs.mem0.ai/open-source/overview). The self-hosted
server now uses the official `pgvector/pgvector:pg17` image with pgvector 0.8.0,
after migrating away from the archived `ankane/pgvector` image
(https://docs.mem0.ai/migration/server-pgvector-upgrade).

Supported vector stores are broad. Python supports the full catalog, while the
TypeScript implementation currently supports Qdrant, Redis, PGVector, Supabase,
LangChain, Azure AI Search, Vectorize, Amazon S3 Vectors, Milvus, and an
in-memory store (https://docs.mem0.ai/components/vectordbs/overview). The
pgvector page documents both Python and TypeScript OSS usage, including
TypeScript `connectionString`, `embeddingModelDims`, optional HNSW/DiskANN
settings, and Python `connection_string` / connection-pool priority
(https://docs.mem0.ai/components/vectordbs/dbs/pgvector).

External graph-store support has been removed in the v3 OSS migration. The old
`enable_graph` / `graph_store` config for Neo4j, Memgraph, Kuzu, Apache AGE, and
Neptune is gone; Mem0 now stores entity links in a parallel vector-store
collection and folds entity boosts into search ranking
(https://docs.mem0.ai/migration/oss-v2-to-v3). Platform Graph Memory is also
native and schema-free: entities and memories are connected by co-occurrence,
not typed, labeled relationships (https://docs.mem0.ai/platform/features/graph-memory).

# Retrieval

Basic search converts a natural-language query to an embedding, applies filters
and optional reranking, and returns formatted memories with metadata and
timestamps (https://docs.mem0.ai/core-concepts/memory-operations/search). The
docs repeatedly warn to scope search with `user_id`, `agent_id`, or `run_id` to
avoid cross-contamination between users or sessions
(https://docs.mem0.ai/core-concepts/how-it-works,
https://docs.mem0.ai/core-concepts/memory-operations/search).

The v3 retrieval model is hybrid: semantic vector similarity, BM25 keyword
matching, entity matching, and Platform temporal scoring are fused into a single
ranking score (https://docs.mem0.ai/core-concepts/memory-evaluation,
https://docs.mem0.ai/migration/platform-v2-to-v3,
https://docs.mem0.ai/migration/oss-v2-to-v3). OSS `explain=True` exposes
`score_details` with semantic score, normalized BM25 score, entity boost, raw
combined score, maximum possible score, final score, and threshold
(https://docs.mem0.ai/core-concepts/memory-operations/search,
https://docs.mem0.ai/open-source/features/rest-api).

OSS hybrid features degrade by dependency. Without spaCy, search loses entity
extraction and BM25 lemmatization; without Qdrant `fastembed`, Qdrant loses BM25
keyword search; without entity-store availability, entity boosting is disabled.
Semantic search remains the fallback (https://docs.mem0.ai/migration/oss-v2-to-v3).

Platform Advanced Retrieval adds managed reranking and documents an additional
150-200ms latency cost; the page presents accuracy improvement as a vendor claim
without independent proof in this pass (https://docs.mem0.ai/platform/features/advanced-retrieval).

# Provenance/temporal/lifecycle

Mem0 has operational audit features, but not the repo's provenance authority.
The self-hosted server includes request logs, dashboard request visibility,
per-user API keys, and a `GET /memories/{memory_id}/history` endpoint
(https://docs.mem0.ai/open-source/setup,
https://docs.mem0.ai/open-source/features/rest-api). Platform adds async event
status, memory-history API references in the llms index, and webhooks for
`memory_add`, `memory_update`, `memory_delete`, and `memory_categorize`
(https://docs.mem0.ai/llms.txt,
https://docs.mem0.ai/platform/features/webhooks,
https://docs.mem0.ai/migration/platform-v2-to-v3).

Those features are useful for observability and debugging, but they do not
provide source-span provenance, W3C PROV-style activities, human approval gates,
or deterministic accepted-claim replay required by the professional runtime
doctrine (`goals/agentic-professional-runtime/README.md`,
`standards/memory-architecture/01-memory-layer-taxonomy.md`).

Temporal support is Platform-heavy. Platform Temporal Reasoning is a v3 feature
that is explicitly unavailable on OSS memory stores and older Platform
endpoints; it uses write-time temporal metadata and search-time ranking, with
`timestamp` on add and `reference_date` on search for reproducible relative
queries (https://docs.mem0.ai/platform/features/temporal-reasoning). Platform
Memory Timestamps allow imported memories to be anchored to event time rather
than ingestion time (https://docs.mem0.ai/platform/features/timestamp).

Memory Decay is Platform-only v3 search-time ranking bias. It tracks recent
retrieval/access history and scales ranking scores within a bounded range,
without modifying stored memories or filtering candidates out
(https://docs.mem0.ai/platform/features/memory-decay). This is a useful
interference-management donor pattern, but it is not lifecycle authority.

Explicit update and delete operations exist, but coverage differs. Platform has
single and batch updates/deletes; OSS Python supports update/delete; OSS
JavaScript docs say update and deletion helpers are not exposed yet and advise
using REST or Python when self-hosting
(https://docs.mem0.ai/core-concepts/memory-operations/update,
https://docs.mem0.ai/core-concepts/memory-operations/delete).

# Integration surface

Mem0's strongest integration surfaces are SDK, REST, and hosted MCP. Platform
and OSS both expose Python and JavaScript/TypeScript SDKs in the docs
(https://docs.mem0.ai/llms.txt,
https://docs.mem0.ai/platform/platform-vs-oss). OSS configuration supports both
Python and TypeScript component setup, but the same page says TypeScript
configures LLM, embedder, vector store, and history store while reranker and
graph memory are Python-only today
(https://docs.mem0.ai/open-source/configuration).

The self-hosted REST server exposes `/memories`, `/search`, memory history,
`/configure`, auth, API keys, request logs, and entity deletion/listing; it also
ships an OpenAPI UI at `/docs` (https://docs.mem0.ai/open-source/features/rest-api).
This is the cleanest Role A integration path if Mem0 is ever used behind a
driver.

The hosted MCP server requires a Mem0 Platform account/API key and exposes
tools for add/search/get/update/delete memories, deleting entities, listing
entities, listing events, and checking async event status
(https://docs.mem0.ai/platform/mem0-mcp). Claude Code and Codex docs add plugin
flows with lifecycle hooks that search memories before prompts and store session
summaries on stop/pre-compact
(https://docs.mem0.ai/integrations/claude-code,
https://docs.mem0.ai/integrations/codex).

The local OpenMemory MCP path is not a stable recommendation. The llms index
says self-hosted MCP ships with `openmemory/api/`, but the OpenMemory README now
starts with a sunsetting notice and tells users to use the Mem0 self-hosted
server instead (https://docs.mem0.ai/llms.txt,
https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/README.md).

# License, pricing & maturity

Mem0 OSS is documented as Apache 2.0 and free, while Platform uses usage-based
pricing and includes managed infrastructure/support
(https://docs.mem0.ai/platform/platform-vs-oss). The GitHub repo also advertises
Apache 2.0 and, at fetch time, showed about 60.4k stars, 7k forks, 2,460
commits, and repo directories for `mem0-ts`, `server`, `openmemory`,
`integrations`, and agent plugins (https://github.com/mem0ai/mem0).

Benchmark claims are vendor-authored. The docs report scores for LoCoMo,
LongMemEval, and BEAM and state that Platform scores include proprietary
optimizations not available in OSS, with OSS users told to expect directionally
similar but not identical numbers
(https://docs.mem0.ai/core-concepts/memory-evaluation). The same page says the
evaluation framework is open-sourced and supports both cloud and self-hosted
backends, but this lane did not independently reproduce any score
(https://docs.mem0.ai/core-concepts/memory-evaluation). Treat the numbers as
marketing/evaluation claims, not as verified product facts.

# Role A assessment

Verdict: LEARN / optional cache driver, not foundation.

Mem0 passes the mechanical gates for a bounded cache/projection: self-hosted
server, Apache-2.0 OSS, TypeScript SDK, REST API, and pgvector support
(https://docs.mem0.ai/open-source/overview,
https://docs.mem0.ai/open-source/features/rest-api,
https://docs.mem0.ai/components/vectordbs/dbs/pgvector,
https://github.com/mem0ai/mem0). It also has useful donor patterns for a
managed Layer 2/4 cache: ADD-only extraction, entity linking, hybrid scoring,
search explanations, memory decay, request logs, events, and explicit erasure
(https://docs.mem0.ai/migration/oss-v2-to-v3,
https://docs.mem0.ai/core-concepts/memory-operations/search,
https://docs.mem0.ai/platform/features/memory-decay,
https://docs.mem0.ai/open-source/features/rest-api).

It fails as product-runtime authority. Mem0 stores extracted/distilled memories
by default, does not expose typed legal/domain claims with source spans and
approval lifecycle, and its graph memory is schema-free entity co-occurrence
rather than ontology/provenance graph authority
(https://docs.mem0.ai/core-concepts/how-it-works,
https://docs.mem0.ai/platform/features/graph-memory,
https://docs.mem0.ai/migration/oss-v2-to-v3). That conflicts with the
agentic-professional-runtime rule that accepted truth is claim + evidence +
provenance + lifecycle, and that agents only propose candidate writes until
human/policy acceptance (`goals/agentic-professional-runtime/README.md`).

Best Role A use, if ever adopted: a replaceable `drivers/mem0` cache over
repo-owned authority that receives bounded context packets, never raw
privileged authority, and writes only candidate recall hints or retrieval traces
back into the runtime. The driver should prefer self-hosted REST with pgvector
for local control, and must keep Mem0 memory IDs separate from runtime entity
IDs because Mem0's entity IDs are retrieval scopes, not domain identity
(https://docs.mem0.ai/core-concepts/how-it-works,
https://docs.mem0.ai/open-source/features/rest-api,
https://docs.mem0.ai/components/vectordbs/dbs/pgvector).

# Role B assessment

Verdict: promising hosted plugin/MCP, weak local-first default.

For Claude/Codex dev-tooling memory, Mem0's Platform MCP/plugin is practical:
hosted MCP is one URL, exposes memory CRUD/search tools, and the Codex/Claude
plugins add lifecycle hooks for session start, prompt submit, tool use, stop,
and pre-compact summaries (https://docs.mem0.ai/platform/mem0-mcp,
https://docs.mem0.ai/integrations/claude-code,
https://docs.mem0.ai/integrations/codex). The Codex docs also document direct
MCP config via `~/.codex/config.toml` or `codex mcp add`, which makes setup
clean for hosted use (https://docs.mem0.ai/integrations/codex).

The local-first story is not strong enough for this repo's default dev memory.
OpenMemory local MCP is the only fetched source that clearly documents a local
MCP server, and it is being sunset in favor of the self-hosted server
(https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/README.md). The
self-hosted server has REST and a dashboard, but the fetched docs did not show a
non-sunset MCP adapter for that server (https://docs.mem0.ai/open-source/features/rest-api,
https://docs.mem0.ai/open-source/setup).

Operationally, the plugin hooks are powerful but invasive for this repo. They
auto-search before prompts, store summaries at stop/pre-compact, and include
pre-tool handlers that block `MEMORY.md` writes and enforce Mem0 tool-call
scope (https://docs.mem0.ai/integrations/claude-code,
https://docs.mem0.ai/integrations/codex). That can help recall quality, but it
must be reconciled with the repo's existing file-memory/Graphiti discipline
before use.

# Contradictions with prior repo assessments

`standards/memory-architecture/05-context-graph-capability-assessment.md`
classified mem0 as "external benchmark/reference only." Confirmed for Role A:
current docs strengthen the case that Mem0 is a benchmark/API/cache donor, not
authority, because graph memory is built-in entity linking, external graph-store
support is removed, and Platform temporal/decay features are ranking machinery
rather than provenance authority (https://docs.mem0.ai/migration/oss-v2-to-v3,
https://docs.mem0.ai/platform/features/graph-memory,
https://docs.mem0.ai/platform/features/temporal-reasoning,
https://docs.mem0.ai/platform/features/memory-decay).

The same prior assessment said OSS v3 migration removes graph-store support in
favor of entity linking. Confirmed exactly: the migration guide removes
`enable_graph` / `graph_store` for Neo4j, Memgraph, Kuzu, Apache AGE, and
Neptune, replaces them with a vector-store entity collection, and removes the
old `relations` response field (https://docs.mem0.ai/migration/oss-v2-to-v3).

The prior assessment underweighted Role B. Current docs show a much more
developed hosted MCP/plugin story for Claude Code and Codex than "external
benchmark/reference only" implies, but this is mainly Platform-backed and does
not change the Role A foundation verdict (https://docs.mem0.ai/platform/mem0-mcp,
https://docs.mem0.ai/integrations/claude-code,
https://docs.mem0.ai/integrations/codex).

`standards/memory-architecture/03-saas-landscape-assessment.md` does not assess
mem0 directly, so there is no direct contradiction. Its general principle that
semantic systems are candidates/caches rather than truth is reinforced by Mem0's
ADD-only, extracted-memory, vector/entity-ranking architecture
(https://docs.mem0.ai/core-concepts/how-it-works,
https://docs.mem0.ai/core-concepts/memory-evaluation).

`explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md` does
not list mem0 as one of the main donors. That omission remains defensible for
Role A because Mem0 has weaker provenance/ontology authority than TrustGraph,
Graphiti, or Cognee. The new evidence is that Mem0 may deserve a narrow Role B
dev-tooling watchlist entry because of the Codex/Claude MCP/plugin surface
(https://docs.mem0.ai/integrations/codex,
https://docs.mem0.ai/integrations/claude-code).

One official-source contradiction matters: the llms index says self-hosted MCP
ships with `openmemory/api/`, but the OpenMemory README says OpenMemory is being
sunset and directs local self-hosted users to the self-hosted server instead
(https://docs.mem0.ai/llms.txt,
https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/README.md).

# References

## Fetched URLs

- https://docs.mem0.ai/llms.txt
- https://docs.mem0.ai/platform/platform-vs-oss
- https://docs.mem0.ai/open-source/overview
- https://docs.mem0.ai/open-source/setup
- https://docs.mem0.ai/open-source/configuration
- https://docs.mem0.ai/open-source/features/overview
- https://docs.mem0.ai/open-source/features/rest-api
- https://docs.mem0.ai/core-concepts/how-it-works
- https://docs.mem0.ai/core-concepts/memory-operations/add
- https://docs.mem0.ai/core-concepts/memory-operations/search
- https://docs.mem0.ai/core-concepts/memory-operations/update
- https://docs.mem0.ai/core-concepts/memory-operations/delete
- https://docs.mem0.ai/core-concepts/memory-evaluation
- https://docs.mem0.ai/platform/features/graph-memory
- https://docs.mem0.ai/platform/features/temporal-reasoning
- https://docs.mem0.ai/platform/features/timestamp
- https://docs.mem0.ai/platform/features/memory-decay
- https://docs.mem0.ai/platform/features/advanced-retrieval
- https://docs.mem0.ai/platform/features/memory-export
- https://docs.mem0.ai/platform/features/webhooks
- https://docs.mem0.ai/platform/features/feedback-mechanism
- https://docs.mem0.ai/platform/advanced-memory-operations
- https://docs.mem0.ai/platform/mem0-mcp
- https://docs.mem0.ai/integrations/claude-code
- https://docs.mem0.ai/integrations/codex
- https://docs.mem0.ai/integrations/openclaw
- https://docs.mem0.ai/migration/oss-v2-to-v3
- https://docs.mem0.ai/migration/platform-v2-to-v3
- https://docs.mem0.ai/migration/server-pgvector-upgrade
- https://docs.mem0.ai/components/vectordbs/overview
- https://docs.mem0.ai/components/vectordbs/config
- https://docs.mem0.ai/components/vectordbs/dbs/pgvector
- https://github.com/mem0ai/mem0
- https://raw.githubusercontent.com/mem0ai/mem0/main/LICENSE
- https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/README.md

## Repo files read

- `standards/memory-architecture/README.md`
- `standards/memory-architecture/01-memory-layer-taxonomy.md`
- `goals/agentic-professional-runtime/README.md`
- `standards/memory-architecture/05-context-graph-capability-assessment.md`
- `standards/memory-architecture/03-saas-landscape-assessment.md`
- `explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md`
- `docs/agent-memory-infra/README.md`

## Linked pages from llms.txt not followed

Relevant but not fetched individually:

- https://docs.mem0.ai/introduction
- https://docs.mem0.ai/vibecoding
- https://docs.mem0.ai/platform/overview
- https://docs.mem0.ai/platform/agent-signup
- https://docs.mem0.ai/platform/quickstart
- https://docs.mem0.ai/platform/cli
- https://docs.mem0.ai/platform/features/v2-memory-filters
- https://docs.mem0.ai/platform/features/entity-scoped-memory
- https://docs.mem0.ai/platform/features/async-client
- https://docs.mem0.ai/platform/features/multimodal-support
- https://docs.mem0.ai/platform/features/custom-categories
- https://docs.mem0.ai/platform/features/criteria-retrieval
- https://docs.mem0.ai/platform/features/contextual-add
- https://docs.mem0.ai/platform/features/custom-instructions
- https://docs.mem0.ai/platform/features/direct-import
- https://docs.mem0.ai/platform/features/group-chat
- https://docs.mem0.ai/platform/faqs
- https://docs.mem0.ai/platform/contribute
- https://docs.mem0.ai/migration/oss-to-platform
- https://docs.mem0.ai/changelog/highlights
- https://docs.mem0.ai/open-source/python-quickstart
- https://docs.mem0.ai/open-source/node-quickstart
- https://docs.mem0.ai/open-source/features/metadata-filtering
- https://docs.mem0.ai/open-source/features/reranker-search
- https://docs.mem0.ai/open-source/features/reranking
- https://docs.mem0.ai/open-source/features/async-memory
- https://docs.mem0.ai/open-source/features/multimodal-support
- https://docs.mem0.ai/open-source/features/custom-instructions
- https://docs.mem0.ai/open-source/features/openai_compatibility
- https://docs.mem0.ai/integrations
- https://docs.mem0.ai/integrations/langchain
- https://docs.mem0.ai/integrations/langgraph
- https://docs.mem0.ai/integrations/langchain-tools
- https://docs.mem0.ai/integrations/llama-index
- https://docs.mem0.ai/integrations/crewai
- https://docs.mem0.ai/integrations/autogen
- https://docs.mem0.ai/integrations/agno
- https://docs.mem0.ai/integrations/mastra
- https://docs.mem0.ai/integrations/openai-agents-sdk
- https://docs.mem0.ai/integrations/google-ai-adk
- https://docs.mem0.ai/integrations/vercel-ai-sdk
- https://docs.mem0.ai/integrations/cursor
- https://docs.mem0.ai/integrations/opencode
- https://docs.mem0.ai/integrations/antigravity
- https://docs.mem0.ai/components/llms/overview
- https://docs.mem0.ai/components/llms/config
- https://docs.mem0.ai/components/embedders/overview
- https://docs.mem0.ai/components/embedders/config
- https://docs.mem0.ai/components/rerankers/overview
- https://docs.mem0.ai/components/rerankers/config

Provider-specific LLM, embedder, vector-store, reranker, API-reference, and
cookbook pages linked from the index were not fetched unless listed in the
fetched URL list above.
