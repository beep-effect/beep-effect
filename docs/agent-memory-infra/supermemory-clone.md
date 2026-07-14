## TL;DR

Supermemory remains **IGNORE as a foundation** for the agentic-professional-runtime memory layer. The clone is valuable as a reference for API shape, MCP wrapper design, memory-profile prompting, graph visualization, and versioned memory relations, but it does not provide an auditable, source-buildable memory engine for the product's durable truth layer. The repo's own local-development path points the web app at `https://api.supermemory.ai`, and the MCP server is a Cloudflare Worker wrapper around the Supermemory API rather than a standalone memory backend (`upstream/supermemory/CONTRIBUTING.md:48-55`, `upstream/supermemory/apps/web/.env.example:1`, `upstream/supermemory/apps/mcp/README.md:227-256`).

The useful idea set is real, so "nothing to take" is too strong. The clone exposes document/memory separation, chunk and memory schemas, source joins, version chains, `updates`/`extends`/`derives` relations, `isLatest`, `isForgotten`, `forgetAfter`, per-container isolation, query rewriting, reranking, memory/profile retrieval modes, and a React graph component that renders document-memory and memory-memory relationships (`upstream/supermemory/packages/validation/schemas.ts:61-124`, `upstream/supermemory/packages/validation/schemas.ts:239-294`, `upstream/supermemory/apps/docs/search/overview.mdx:181-205`, `upstream/supermemory/packages/memory-graph/README.md:49-69`). These are donor patterns only.

For Role A, use Supermemory concepts only behind `drivers/*` as cache/projection patterns. Do not adopt its auto-evolving semantic graph as system of record because the authoritative engine is opaque in this repo and its docs explicitly frame memory as automatically extracted, connected, updated, and forgotten (`upstream/supermemory/apps/docs/concepts/graph-memory.mdx:8-26`, `upstream/supermemory/apps/docs/concepts/graph-memory.mdx:74-93`). For Role B, the MCP and coding-agent integrations are interesting but should be opt-in and disposable; the MCP implementation defaults to hosted API URLs, validates through the API, and its end-to-end tests need API keys and tolerate eventual consistency (`upstream/supermemory/apps/mcp/src/index.ts:25-32`, `upstream/supermemory/apps/mcp/src/auth.ts:21-35`, `upstream/supermemory/apps/mcp/e2e/helpers.ts:123-168`).

## Hard-gate verdicts

1. **Self-hostable/local-first from this repo: FAIL.**

   The README and docs advertise a local binary path: `supermemory local`, `supermemory-server`, first boot with a generated API key, embedded graph engine, local embeddings, and a local API at `http://localhost:6767` (`upstream/supermemory/README.md:320-348`, `upstream/supermemory/apps/docs/self-hosting/quickstart.mdx:8-45`). The same docs say local state lives in `./.supermemory` or `$SUPERMEMORY_DATA_DIR` and that files are stored on local disk (`upstream/supermemory/apps/docs/self-hosting/quickstart.mdx:133-141`, `upstream/supermemory/apps/docs/self-hosting/configuration.mdx:60-75`).

   The source tree observed in this clone does not prove a full source self-host. The root package is a private workspace with apps and packages, but its scripts are app/package orchestration scripts, not a source-buildable `supermemory-server` engine (`upstream/supermemory/package.json:1-22`). The contributor guide's `dev:local` starts the web, MCP, docs, and graph apps while explicitly pointing the web app at `NEXT_PUBLIC_BACKEND_URL=https://api.supermemory.ai` (`upstream/supermemory/CONTRIBUTING.md:48-55`). The web client and auth helper also default to `https://api.supermemory.ai` (`upstream/supermemory/packages/lib/api.ts:451-466`, `upstream/supermemory/apps/web/lib/auth.ts:13`). That is local UI/tooling against a remote API, not a complete local-first memory backend.

2. **OSI license without copyleft trap: PASS.**

   The clone has a root MIT license at `upstream/supermemory/LICENSE` (`upstream/supermemory/LICENSE:1-21`). The React memory graph package also declares MIT in its README (`upstream/supermemory/packages/memory-graph/README.md:86-88`). No SSPL, BUSL, or AGPL license was observed in the files used for this assessment.

3. **TS-native or clean HTTP/MCP API: PASS WITH SCOPE.**

   The integration surface is clean: docs show `/v3/documents`, `/v4/search`, `/v4/profile`, and spaces for self-hosted/local API use (`upstream/supermemory/apps/docs/self-hosting/overview.mdx:24-31`, `upstream/supermemory/apps/docs/self-hosting/quickstart.mdx:53-131`). The TypeScript API schemas cover add/update/search/profile and memory search responses (`upstream/supermemory/packages/validation/api.ts:141-173`, `upstream/supermemory/packages/validation/api.ts:333-464`, `upstream/supermemory/packages/validation/api.ts:466-555`, `upstream/supermemory/packages/validation/api.ts:677-788`). The MCP server is TypeScript and exposes memory, recall, profile, projects, graph data, and a context prompt (`upstream/supermemory/apps/mcp/src/server.ts:77-130`, `upstream/supermemory/apps/mcp/src/server.ts:132-190`, `upstream/supermemory/apps/mcp/src/server.ts:294-420`, `upstream/supermemory/apps/mcp/src/server.ts:439-517`).

   The scope limit matters: the TypeScript code in this repo is primarily clients, schemas, UI, tools, and wrappers. The core storage/retrieval engine behind the advertised API is not exposed as auditable TypeScript source in the files read.

## OSS-vs-SaaS reality check

**What the OSS clone actually contains:** a monorepo with app surfaces and packages, including web, browser extension, docs, MCP, memory graph playground, Raycast extension, UI/lib/hooks/validation, AI/tool packages, and Python wrapper packages (`upstream/supermemory/CONTRIBUTING.md:58-83`). The root workspace confirms `apps/*` and `packages/*` workspaces and top-level scripts for building/dev/linting/checking these packages (`upstream/supermemory/package.json:1-22`).

**What is API-backed or hosted-service-backed:** the web app's example environment points at `https://api.supermemory.ai` (`upstream/supermemory/apps/web/.env.example:1`), the shared frontend API wrapper defaults to that hosted base URL (`upstream/supermemory/packages/lib/api.ts:451-466`), and the MCP app's environment/defaults also target `https://api.supermemory.ai` (`upstream/supermemory/apps/mcp/wrangler.jsonc:13-15`, `upstream/supermemory/apps/mcp/src/index.ts:25-32`). The MCP README describes the architecture as MCP client to MCP server to Supermemory API, with Durable Objects storing MCP session state and not the memory corpus (`upstream/supermemory/apps/mcp/README.md:227-256`).

**What exists only as docs or downloaded binary behavior:** self-hosting docs say the same memory engine is packaged as a single binary with no Docker/database requirement, and that it includes embedded graph engine, local embeddings, API key generation, and local endpoints (`upstream/supermemory/apps/docs/self-hosting/overview.mdx:8-31`). The quickstart installs by `curl`, `npx`, or `bunx` and runs `supermemory-server`, which stores state in `.supermemory` (`upstream/supermemory/apps/docs/self-hosting/quickstart.mdx:8-45`, `upstream/supermemory/apps/docs/self-hosting/quickstart.mdx:133-141`). That behavior is documented in the clone, but the full source for that engine was not present in the app/package structure read above.

**Hosted/platform-only features:** the self-hosting overview says local mode lacks connectors and managed MCP, while hosted/platform has connectors, managed MCP, tuned proprietary extraction, and managed scale (`upstream/supermemory/apps/docs/self-hosting/overview.mdx:59-74`). The configuration docs repeat that connectors, the managed MCP endpoint, optimized memory extraction, and managed scale are platform-only (`upstream/supermemory/apps/docs/self-hosting/configuration.mdx:106-123`). This directly supports the "OSS repo is not the SaaS" concern.

## Architecture & storage

The observed conceptual architecture is document ingestion into documents, chunks, and semantic memories. The README claims Supermemory extracts facts, profiles, contradictions, forgetting, RAG, connectors, and file processing from one API (`upstream/supermemory/README.md:33-40`, `upstream/supermemory/README.md:380-398`). The docs describe documents as raw inputs and memories as semantic chunks/facts that are embedded, connected, and updated over time (`upstream/supermemory/apps/docs/concepts/how-it-works.mdx:36-59`).

The storage model visible in source is schema-level, not storage-engine-level. `Document` includes IDs, org/user/connection identifiers, content, title, summary, URL/source/type/status, metadata, raw content, token/word/chunk counts, summary embeddings, and timestamps (`upstream/supermemory/packages/validation/schemas.ts:61-100`). `Chunk` includes content, embedded content, position, metadata, embedding fields, and created time (`upstream/supermemory/packages/validation/schemas.ts:106-124`). `Space` includes container text index fields, while `MemoryEntry` includes memory text, versioning, latest/root/parent fields, relations, source count, inference/static/forgotten flags, forget scheduling/reason, embeddings, metadata, and timestamps (`upstream/supermemory/packages/validation/schemas.ts:218-279`). `MemoryDocumentSource` joins memories to documents with relevance and source metadata (`upstream/supermemory/packages/validation/schemas.ts:287-294`).

The local storage story is documented but not source-proven. Self-host docs say the local binary uses embedded graph and embedding components, stores state under `./.supermemory`, stores files on disk, and can use local/Ollama models (`upstream/supermemory/apps/docs/self-hosting/overview.mdx:24-44`, `upstream/supermemory/apps/docs/self-hosting/configuration.mdx:19-75`). The clone's checked source exposes schemas, clients, wrappers, and UI around that model, but not the implementation of ingestion queues, graph persistence, vector indexing, contradiction detection, or memory extraction.

The most portable architecture idea is the distinction between raw documents and derived memories, with a graph edge layer for source and memory-memory relations. The graph component expects caller-provided `DocumentWithMemories[]`, not a bundled backend, and renders document nodes, memory nodes, document similarity, and memory version chains (`upstream/supermemory/packages/memory-graph/README.md:49-69`, `upstream/supermemory/packages/memory-graph/src/types.ts:155-198`).

## Retrieval

The retrieval surface has two main API families: `/v3/search` for documents/chunks and `/v4/search` for memories. Search docs say `/v3/search` focuses on documents/chunks, while `/v4/search` searches extracted memories and can include related memories and source documents (`upstream/supermemory/apps/docs/search/overview.mdx:48-67`, `upstream/supermemory/apps/docs/search/overview.mdx:181-205`). The schemas expose thresholds, filters, container tags, full-doc/summary inclusion, matching-chunk selection, query rewriting, reranking, and response timing (`upstream/supermemory/packages/validation/api.ts:333-464`, `upstream/supermemory/packages/validation/api.ts:466-555`, `upstream/supermemory/packages/validation/api.ts:643-647`).

The advertised memory retrieval path is hybrid: search memories first, fall back to document chunks, merge and dedupe by score, optionally rerank, and return related parents/children plus source documents (`upstream/supermemory/apps/docs/search/overview.mdx:181-205`, `upstream/supermemory/apps/docs/search/overview.mdx:284-327`, `upstream/supermemory/apps/docs/search/overview.mdx:375-408`). Query rewriting generates multiple variations, parallelizes searches, and adds latency; reranking uses a secondary model/ranking process and also adds latency (`upstream/supermemory/apps/docs/search/query-rewriting.mdx:9-21`, `upstream/supermemory/apps/docs/search/reranking.mdx:7-18`, `upstream/supermemory/apps/docs/search/reranking.mdx:136-160`).

The MCP recall implementation calls `client.search.memories` with hybrid defaults and includes full documents, summaries, related memories, and related documents (`upstream/supermemory/apps/mcp/src/client.ts:243-289`, `upstream/supermemory/apps/mcp/src/server.ts:622-727`). The AI/tooling wrappers also retrieve `/v4/profile` and search results, then format static, dynamic, and search memory sections for prompt injection (`upstream/supermemory/packages/tools/src/shared/memory-client.ts:24-65`, `upstream/supermemory/packages/tools/src/shared/memory-client.ts:88-175`, `upstream/supermemory/packages/tools/src/shared/prompt-builder.ts:10-32`).

The limitation is that these files show retrieval contracts and wrappers, not the internal retrieval implementation. There is no auditable source here for embedding generation, graph traversal scoring, contradiction invalidation, temporal filtering, or reranker execution. For this repo's runtime, the retrieval ideas can inform projection/cache drivers, but exact claim retrieval still needs local deterministic source-of-truth records.

## Provenance/temporal/lifecycle

The clone has a better provenance/lifecycle vocabulary than a plain vector store. `MemoryDocumentSource` records memory-document source links, relevance score, source metadata, and added time (`upstream/supermemory/packages/validation/schemas.ts:287-294`). The API response model can include `sourceAddedAt`, `sourceRelevanceScore`, `sourceMetadata`, and a `spaceContainerTag` on memory entries (`upstream/supermemory/packages/validation/api.ts:1045-1094`). The memory graph package preserves the same fields for visualization (`upstream/supermemory/packages/memory-graph/src/api-types.ts:1-49`).

Temporal/version handling is also explicit. The docs describe `updates` as replacing outdated information while preserving prior versions and marking the latest memory with `isLatest` (`upstream/supermemory/apps/docs/concepts/how-it-works.mdx:62-83`). They describe `extends` as additive information and `derives` as inferred conclusions (`upstream/supermemory/apps/docs/concepts/how-it-works.mdx:84-120`). The graph-memory docs add automatic forgetting through time-based forgetting, contradiction resolution, and noise filtering (`upstream/supermemory/apps/docs/concepts/graph-memory.mdx:14-52`, `upstream/supermemory/apps/docs/concepts/graph-memory.mdx:74-93`).

The source model backs those docs with `version`, `isLatest`, `parentMemoryId`, `rootMemoryId`, `memoryRelations`, `isInference`, `isForgotten`, `isStatic`, `forgetAfter`, and `forgetReason` fields (`upstream/supermemory/packages/validation/schemas.ts:239-279`). The graph renderer consumes parent/root/version/relation fields and builds edges from `memoryRelations` with a fallback to `parentMemoryId` (`upstream/supermemory/packages/memory-graph/src/types.ts:5-27`, `upstream/supermemory/packages/memory-graph/src/hooks/use-graph-data.ts:402-456`). The version-chain code walks parent and child chains from memory nodes (`upstream/supermemory/packages/memory-graph/src/canvas/version-chain.ts:11-105`).

This is not enough for the professional-runtime durable layer. The provenance fields are document/memory/source metadata, not exact claim-plus-evidence-plus-source-span authority. The docs also emphasize automatic relation creation and cleanup with no manual relationships, tags, or cleanup (`upstream/supermemory/apps/docs/concepts/graph-memory.mdx:108-127`). That automation is useful for recall projection, but it is the wrong control plane for legal/professional claims that need reviewable evidence and lifecycle states.

## Integration surface

Supermemory has a strong integration surface. The README shows TypeScript and Python SDK examples for adding content, profiles, and search (`upstream/supermemory/README.md:196-247`, `upstream/supermemory/README.md:264-315`). The AI SDK package supports memory tools and an optional `baseUrl` for self-hosted targets (`upstream/supermemory/packages/ai-sdk/README.md:105-131`, `upstream/supermemory/packages/ai-sdk/README.md:167-213`). Its source creates a Supermemory SDK client and exposes search/add tools (`upstream/supermemory/packages/ai-sdk/src/tools.ts:1-34`, `upstream/supermemory/packages/ai-sdk/src/tools.ts:40-133`).

The `@supermemory/tools` package targets AI SDK, OpenAI, and Mastra integrations and includes memory/profile prompt injection, per-turn caching, automatic capture modes, and configurable prompt templates (`upstream/supermemory/packages/tools/README.md:1-18`, `upstream/supermemory/packages/tools/README.md:58-63`, `upstream/supermemory/packages/tools/README.md:115-220`, `upstream/supermemory/packages/tools/README.md:223-302`). Source defaults the API base URL to `https://api.supermemory.ai` unless overridden (`upstream/supermemory/packages/tools/src/shared/context.ts:9-42`). Its Vercel middleware has options for container tag, API key, custom ID, retrieval mode, capture behavior, base URL, prompt template, and retrieval timeout (`upstream/supermemory/packages/tools/src/vercel/middleware.ts:118-205`, `upstream/supermemory/packages/tools/src/vercel/middleware.ts:232-298`).

The MCP surface is polished but API-dependent. The MCP README lists `memory`, `recall`, `whoAmI`, profile/projects resources, and a `context` prompt (`upstream/supermemory/apps/mcp/README.md:75-135`). The implementation registers those tools/resources/prompts and persists MCP client info in Durable Object storage (`upstream/supermemory/apps/mcp/src/server.ts:32-65`, `upstream/supermemory/apps/mcp/src/server.ts:77-130`, `upstream/supermemory/apps/mcp/src/server.ts:132-190`, `upstream/supermemory/apps/mcp/src/server.ts:439-517`). Auth validation calls the Supermemory API for `/v3/session` and `/v3/mcp/session-with-key` (`upstream/supermemory/apps/mcp/src/auth.ts:21-35`, `upstream/supermemory/apps/mcp/src/auth.ts:96-107`).

The coding-agent integration docs are mostly install/integration documentation, not in-repo plugin source. The Claude Code docs say the plugin requires a Supermemory Pro plan, can target self-host with `SUPERMEMORY_API_URL=http://localhost:6767`, captures Edit/Write/Bash/Task activity, and injects context on session start (`upstream/supermemory/apps/docs/integrations/claude-code.mdx:16-23`, `upstream/supermemory/apps/docs/integrations/claude-code.mdx:61-109`). The Codex docs describe an external plugin with hooks for recall/capture, privacy redaction, user/project container tags, explicit search/save/forget/status skills, and configurable thresholds/profile injection (`upstream/supermemory/apps/docs/integrations/codex.mdx:8-15`, `upstream/supermemory/apps/docs/integrations/codex.mdx:48-100`, `upstream/supermemory/apps/docs/integrations/codex.mdx:130-154`).

## License & maturity

The legal posture is straightforward: root license is MIT (`upstream/supermemory/LICENSE:1-21`). The memory-graph package also presents itself as MIT (`upstream/supermemory/packages/memory-graph/README.md:86-88`).

The maturity posture is mixed. The repo has extensive docs, typed schemas, UI packages, tool wrappers, MCP code, and e2e tests. However, the MCP tests default to hosted MCP/API URLs, skip without `SUPERMEMORY_API_KEY`, and use polling windows for eventual consistency on recall and forget (`upstream/supermemory/apps/mcp/e2e/helpers.ts:4-10`, `upstream/supermemory/apps/mcp/e2e/memory.test.ts:14-43`, `upstream/supermemory/apps/mcp/e2e/memory.test.ts:65-92`). The helpers explicitly poll recall and forget because memory availability and removal are asynchronous (`upstream/supermemory/apps/mcp/e2e/helpers.ts:123-168`).

There are also doc/model mismatches that matter for adoption. The self-hosting overview says local self-host lacks connectors, while the README markets connectors as part of the broader product (`upstream/supermemory/apps/docs/self-hosting/overview.mdx:59-74`, `upstream/supermemory/README.md:264-315`). The validation schema's connection providers are only Notion, Google Drive, and OneDrive, which is narrower than the marketing/docs list of connectors (`upstream/supermemory/packages/validation/schemas.ts:126-167`). The docs also say singular `containerTag` is current and plural `containerTags` is deprecated, while some older filtering docs still describe plural exact-array matching (`upstream/supermemory/apps/docs/concepts/container-tags.mdx:75-81`, `upstream/supermemory/apps/docs/concepts/filtering.mdx:23-47`).

These are not fatal for a managed cache integration, but they are enough to reject Supermemory as the foundation for a legal/professional source-of-truth runtime.

## Role A assessment

**Verdict: do not adopt; mine for projection/cache patterns only.**

As product-runtime memory, Supermemory is not suitable as the system of record. Its own docs position memory as automatic extraction, graph connection, update, derivation, and forgetting (`upstream/supermemory/apps/docs/concepts/graph-memory.mdx:8-26`, `upstream/supermemory/apps/docs/concepts/graph-memory.mdx:74-127`). The clone exposes source metadata and version chains, but not exact evidence-span authority or a source-buildable engine for validating extraction/retrieval semantics (`upstream/supermemory/packages/validation/schemas.ts:239-294`, `upstream/supermemory/packages/validation/api.ts:1045-1094`).

Good donor patterns for `drivers/*`:

- Keep a clear distinction between raw documents, chunks, and extracted memories; the schemas model those as separate entities with explicit status, metadata, embeddings, counts, and timestamps (`upstream/supermemory/packages/validation/schemas.ts:61-124`, `upstream/supermemory/packages/validation/schemas.ts:239-279`).
- Model memory-to-document source links separately from memory nodes; `MemoryDocumentSource` carries document ID, relevance, metadata, and add time (`upstream/supermemory/packages/validation/schemas.ts:287-294`).
- Treat memory relations as typed candidate/projection edges; Supermemory's docs and graph code distinguish updates, extends, derives, parent/root chains, and latest status (`upstream/supermemory/apps/docs/concepts/how-it-works.mdx:62-120`, `upstream/supermemory/packages/memory-graph/src/hooks/use-graph-data.ts:402-456`).
- Use namespace isolation similar to `containerTag`; docs say each tag maps to its own vector namespace and avoids shared-index filtering (`upstream/supermemory/apps/docs/concepts/container-tags.mdx:8-42`).
- Consider the memory-graph component as a visualization donor because it is a React/TypeScript package that takes supplied documents with memory entries and renders graph relationships (`upstream/supermemory/packages/memory-graph/README.md:49-69`, `upstream/supermemory/packages/memory-graph/src/types.ts:155-198`).
- Borrow the retrieval-mode split between profile, query/search, and full modes from the tools package; this maps cleanly to context-budgeted agent prompts without making memory authoritative (`upstream/supermemory/packages/tools/README.md:115-178`, `upstream/supermemory/packages/tools/src/tools-shared.ts:121-176`).

Adoption boundary: Supermemory may be a donor/cache/projection driver behind durable claim/evidence/provenance records. It should never own accepted claims, evidence spans, lifecycle state, or human-review status.

## Role B assessment

**Verdict: not a default coding-agent memory substrate; acceptable only as an opt-in personal recall cache.**

For Claude/Codex tooling, the appeal is obvious: docs describe session-start recall, hook-based capture, tool-event capture, explicit search/save/forget/status commands, project/user scopes, privacy redaction, profile injection, and configurable similarity/context limits (`upstream/supermemory/apps/docs/integrations/claude-code.mdx:61-109`, `upstream/supermemory/apps/docs/integrations/codex.mdx:48-100`, `upstream/supermemory/apps/docs/integrations/codex.mdx:130-154`). The MCP server also gives standard `memory` and `recall` tools and a context prompt that injects profile data (`upstream/supermemory/apps/mcp/src/server.ts:108-130`, `upstream/supermemory/apps/mcp/src/server.ts:439-517`).

The risks are operational and epistemic. The Claude plugin docs state a Pro-plan requirement, while the Codex plugin source is external to this clone (`upstream/supermemory/apps/docs/integrations/claude-code.mdx:16-23`, `upstream/supermemory/apps/docs/integrations/codex.mdx:8-15`). The MCP app defaults to hosted API URLs and validates auth through the Supermemory API (`upstream/supermemory/apps/mcp/src/index.ts:25-32`, `upstream/supermemory/apps/mcp/src/auth.ts:21-35`, `upstream/supermemory/apps/mcp/src/auth.ts:96-107`). Its e2e tests require hosted credentials and explicitly handle eventual consistency for recall and forget (`upstream/supermemory/apps/mcp/e2e/memory.test.ts:14-43`, `upstream/supermemory/apps/mcp/e2e/memory.test.ts:65-92`).

For dev tooling, this makes Supermemory weaker than repo-native deterministic memory plus a local graph/file memory path. It can help a single developer remember prior chats or project facts, but it should not be trusted for current-code truth, PR decisions, or durable repo knowledge unless backed by exact local citations and current checkout verification.

## Contradictions with prior repo assessments

The prior "IGNORE" verdict is mostly confirmed. The clone does not expose the full memory engine as auditable source, its local dev path points at the hosted API, and platform-only docs reserve connectors, managed MCP, optimized extraction, and managed scale for hosted/platform modes (`upstream/supermemory/CONTRIBUTING.md:48-55`, `upstream/supermemory/packages/lib/api.ts:451-466`, `upstream/supermemory/apps/docs/self-hosting/overview.mdx:59-74`, `upstream/supermemory/apps/docs/self-hosting/configuration.mdx:106-123`). That supports "opaque" and "not a foundation."

The "nothing to take" part is refuted. There are useful, source-observed patterns worth porting or adapting: document/chunk/memory schemas, memory-source joins, version chains, memory relation types, forgetting flags, container namespaces, retrieval modes, per-turn prompt cache, and a graph visualization package (`upstream/supermemory/packages/validation/schemas.ts:61-124`, `upstream/supermemory/packages/validation/schemas.ts:239-294`, `upstream/supermemory/apps/docs/concepts/container-tags.mdx:8-42`, `upstream/supermemory/packages/tools/src/shared/cache.ts:4-29`, `upstream/supermemory/packages/memory-graph/README.md:49-69`).

The prior "auth reliability issues" claim is not independently confirmed by source inspection alone. The clone does show a nontrivial MCP auth path through API key and OAuth validation, and the MCP tests cover hosted login/API-key behavior, but static files cannot prove reliability in production (`upstream/supermemory/apps/mcp/src/index.ts:68-152`, `upstream/supermemory/apps/mcp/e2e/helpers.ts:4-10`, `upstream/supermemory/apps/mcp/e2e/memory.test.ts:14-43`). The honest update is: auth remains a risk, not a source-proven defect.

## References

- `upstream/supermemory/LICENSE`: root MIT license.
- `upstream/supermemory/README.md`: product claims, SDK/API examples, MCP quickstart, local binary docs, under-the-hood claims.
- `upstream/supermemory/package.json`: root workspace/scripts.
- `upstream/supermemory/CONTRIBUTING.md`: local dev behavior and repo structure.
- `upstream/supermemory/apps/web/.env.example`: hosted API default for web app.
- `upstream/supermemory/apps/web/lib/auth.ts`: hosted auth default.
- `upstream/supermemory/packages/lib/api.ts`: frontend API client default base URL.
- `upstream/supermemory/packages/validation/schemas.ts`: document, chunk, space, connection, memory, source-link schemas.
- `upstream/supermemory/packages/validation/api.ts`: add/update/search/profile/search response schemas.
- `upstream/supermemory/apps/docs/self-hosting/overview.mdx`: self-host claims and platform-only feature matrix.
- `upstream/supermemory/apps/docs/self-hosting/quickstart.mdx`: local binary install/run/state behavior.
- `upstream/supermemory/apps/docs/self-hosting/configuration.mdx`: local config, files, models, queue, and platform-only features.
- `upstream/supermemory/apps/docs/concepts/how-it-works.mdx`: document/memory model and relation semantics.
- `upstream/supermemory/apps/docs/concepts/graph-memory.mdx`: automatic graph memory, updates, derives, forgetting.
- `upstream/supermemory/apps/docs/concepts/memory-vs-rag.mdx`: memory pipeline and temporal/relational claims.
- `upstream/supermemory/apps/docs/concepts/container-tags.mdx`: namespace/container semantics.
- `upstream/supermemory/apps/docs/concepts/filtering.mdx`: metadata/container filtering docs.
- `upstream/supermemory/apps/docs/search/overview.mdx`: `/v3` and `/v4` search behavior.
- `upstream/supermemory/apps/docs/search/query-rewriting.mdx`: query rewrite behavior.
- `upstream/supermemory/apps/docs/search/reranking.mdx`: reranking behavior.
- `upstream/supermemory/apps/mcp/README.md`: MCP tools, environment, tests, and architecture.
- `upstream/supermemory/apps/mcp/wrangler.jsonc`: hosted API default and Durable Object binding.
- `upstream/supermemory/apps/mcp/src/index.ts`: MCP default URLs, auth proxy, request validation.
- `upstream/supermemory/apps/mcp/src/auth.ts`: API key/OAuth validation.
- `upstream/supermemory/apps/mcp/src/client.ts`: Supermemory SDK wrapper used by MCP.
- `upstream/supermemory/apps/mcp/src/server.ts`: MCP tools, resources, graph tools, prompt, and recall handling.
- `upstream/supermemory/apps/mcp/e2e/helpers.ts`: hosted test defaults and eventual-consistency polling helpers.
- `upstream/supermemory/apps/mcp/e2e/memory.test.ts`: MCP memory/recall/forget behavior tests.
- `upstream/supermemory/packages/memory-graph/README.md`: graph package purpose, features, props, license.
- `upstream/supermemory/packages/memory-graph/src/api-types.ts`: graph memory/document API types.
- `upstream/supermemory/packages/memory-graph/src/types.ts`: graph node/edge/prop types.
- `upstream/supermemory/packages/memory-graph/src/hooks/use-graph-data.ts`: graph edge and cluster construction.
- `upstream/supermemory/packages/memory-graph/src/canvas/version-chain.ts`: version chain traversal.
- `upstream/supermemory/packages/ai-sdk/README.md`: AI SDK tools and self-host base URL.
- `upstream/supermemory/packages/ai-sdk/src/tools.ts`: AI SDK client/tool wrapper.
- `upstream/supermemory/packages/tools/README.md`: tool package, prompt injection, modes, capture, templates.
- `upstream/supermemory/packages/tools/src/shared/context.ts`: tools API base URL and client construction.
- `upstream/supermemory/packages/tools/src/shared/cache.ts`: per-turn memory cache.
- `upstream/supermemory/packages/tools/src/shared/memory-client.ts`: profile/search fetch and memory text assembly.
- `upstream/supermemory/packages/tools/src/shared/prompt-builder.ts`: default prompt builder.
- `upstream/supermemory/packages/tools/src/tools-shared.ts`: tool defaults and memory dedupe priorities.
- `upstream/supermemory/packages/tools/src/vercel/middleware.ts`: Vercel middleware options, retrieval, prompt injection, capture.
- `upstream/supermemory/apps/docs/integrations/claude-code.mdx`: Claude Code integration behavior and limits.
- `upstream/supermemory/apps/docs/integrations/codex.mdx`: Codex integration behavior and limits.
