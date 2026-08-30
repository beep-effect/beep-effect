# Building a TypeScript code knowledge graph: the definitive stack

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

**FalkorDB, Claude Sonnet 4.5, Voyage Code 3, and ts-morph form the optimal foundation for a hybrid AST-JSDoc knowledge graph system in a Turborepo monorepo.** This stack delivers zero-config embedded development, research-backed graph schema design, and incremental indexing that avoids full-repo recomputation. The recommendations below are grounded in benchmarks, production evidence from systems like Sourcegraph and CodeQL, and the ICSE 2025 paper proving that graph-structured code context significantly outperforms flat retrieval for AI code generation.

The system architecture centers on a proven pattern: tree-sitter for fast incremental parsing, ts-morph for deep type resolution, FalkorDB for graph storage with native vector search, and an MCP server that extracts sub-graphs to ground AI coding agents. Every choice below optimizes for quality first, with cost as secondary consideration.

---

## 1. FalkorDB wins the graph database comparison decisively

**FalkorDB with falkordblite-ts is the only database offering zero-config embedded TypeScript mode, Cypher support, and native vector search simultaneously.** After evaluating 10 graph databases across 9 criteria, no alternative matches this combination for a code knowledge graph.

The core technical advantage is **GraphBLAS sparse matrix algebra**. Unlike Neo4j's node-by-node traversal, FalkorDB treats the graph as a mathematical adjacency matrix where each multi-hop traversal becomes a sparse matrix multiplication. For the exact query pattern code knowledge graphs use most — "find all transitive dependencies of module X" via `MATCH (m:Module)-[:DEPENDS_ON*1..10]->(dep)` — this is theoretically optimal. Benchmarks show **500× faster p99 latency** versus Neo4j on aggregate expansion operations and **7× less memory** for identical datasets.

The embedded mode transforms developer experience. Running `npm install falkordblite` auto-installs pre-built Redis + FalkorDB binaries and connects via Unix socket — no Docker, no ports, no configuration. Migration to production is a single import change from `falkordblite` to `falkordb`. FalkorDB also has a dedicated Code Graph tool on GitHub demonstrating knowledge graphs of CrewAI, LangChain, and other repositories — this is a proven, not theoretical, use case.

**KùzuDB was archived in late 2025**, eliminating what would have been the strongest alternative (MIT license, true in-process embedding, 18× faster ingestion). **Memgraph** is the best fallback — C++ in-memory engine, full Cypher support, uses the standard `neo4j-driver` npm package, and has vector search — but requires Docker with no embedded option. **Neo4j Community Edition** suffers from JVM overhead (7× more memory), no embedded TypeScript mode, and a crippled community edition that prohibits switching back if you ever trial Enterprise.

| Feature | FalkorDB | Memgraph | Neo4j CE | SurrealDB |
|---------|----------|----------|----------|-----------|
| Cypher support | ✅ OpenCypher | ✅ Full | ✅ Native | ❌ SurrealQL |
| Embedded TypeScript | ✅ falkordblite | ❌ Docker only | ❌ Java only | ✅ WASM |
| Vector search | ✅ HNSW native | ✅ HNSW native | ✅ (v5.x) | ✅ HNSW |
| Multi-hop speed | ⭐ GraphBLAS | ⭐ In-memory | 🔴 Disk/JVM | ⚠️ Unproven |
| Memory footprint | ~1–2 GB | ~400 MB | ~4–8 GB | ~1–2 GB |
| Code graph ecosystem | ✅ Dedicated tooling | ❌ None | ❌ None | ❌ None |

Worth noting: even major code intelligence platforms don't use off-the-shelf graph databases — Joern uses a custom in-memory graph (OverflowDB), CodeQL uses a custom binary format, and Sourcegraph uses PostgreSQL + Redis. FalkorDB is actually better-positioned than what these tools use because it provides native graph semantics with a real query language.

---

## 2. Claude Sonnet 4.5 dominates every pipeline stage

**Claude Sonnet 4.5 is the optimal model across code understanding, NL-to-Cypher translation, JSDoc generation, and most code review tasks**, with Opus 4.5 reserved for the deepest multi-step review scenarios. Quality-first doesn't mean most-expensive — Sonnet delivers ≥97% of Opus quality at 20% of the cost.

For **code understanding and generation grounding**, Sonnet 4.5 achieves **77.2% on SWE-bench Verified** — the highest at its price tier. Replit reported going from 9% to **0% error rate** switching from Sonnet 4 to Sonnet 4.5 on internal code editing benchmarks. Claude's instruction-following precision means it respects structured graph context (types, dependencies, signatures) rather than hallucinating, and multiple developer evaluations confirm superior TypeScript type system understanding over GPT-4.1 and Gemini 2.5 Pro.

For **NL-to-Cypher translation**, the Neo4j Text2Cypher 2024 benchmark showed GPT-4o achieving the highest BLEU score of **0.8017** — but Claude Sonnet 4.5 wasn't included in that benchmark, and its substantial lead on structured output tasks makes it the strongest current zero-shot choice. The critical practical insight: **schema-aware prompting with 3–5 few-shot examples dramatically improves all models**, and the performance gap between models shrinks considerably when you provide the full graph schema plus example queries.

For **code review**, reserve **Claude Opus 4.5** for deep, multi-step analysis — it scores **65.4% on Terminal-Bench 2.0** and excels at tracing dependency impacts across a PR. For high-volume automated reviews, Sonnet 4.5 handles most scenarios excellently (developers preferred it 59% of the time over prior Opus versions in Claude Code testing).

For **JSDoc generation**, Sonnet 4.5's combination of TypeScript understanding, instruction following, and tendency to say "I don't know" rather than fabricate makes it optimal for high-volume documentation tasks at $3/$15 per million tokens.

**Gemini 2.5 Pro** is the strongest runner-up with its **1M token context window** — valuable if you need to feed entire codebase context. **DeepSeek V3** offers competitive coding benchmarks at dramatically lower cost for budget-sensitive batch processing.

---

## 3. Voyage Code 3 is the definitive code embedding model

**Voyage Code 3 outperforms OpenAI text-embedding-3-large by 13.8%** across 238 code retrieval datasets and offers a **32K token context window** — four times OpenAI's 8K — enabling embedding of entire TypeScript files without chunking.

Voyage Code 3 was specifically trained on code with a "carefully tuned code-to-text ratio" across **300+ programming languages** including TypeScript. It supports flexible dimensionality (256, 512, 1024, 2048) via Matryoshka learning and multiple quantization formats (float, int8, binary) for storage optimization. At **$0.22 per million tokens**, embedding a medium codebase of ~50K functions costs approximately $5.50 for the initial run, with incremental re-embedding on changes being negligible.

For **self-hosted** scenarios, **Qodo-Embed-1-7B** achieves **71.5 on CoIR** (Code Information Retrieval Benchmark) — the highest score of any model. The 1.5B parameter variant scores 68.5–70.1, beating OpenAI text-embedding-3-large (65.17) while running on consumer GPUs. Qodo's research specifically demonstrated that OpenAI's general-purpose embeddings fail to distinguish between "analyzing failures" versus "handling failures" in code — a critical failure mode for code search.

**OpenAI text-embedding-3-large should not be used for code-specific tasks.** It scores only 65.17 on CoIR versus Voyage Code 3's dominance. **CodeBERT and GraphCodeBERT** are legacy models with 512-token context windows — far too small for meaningful TypeScript code chunks. **Nomic Embed Code** is an excellent open-source option (Apache 2.0, full transparency) but limited to 2048-token context.

The recommended hybrid approach: use **Voyage Code 3** for all code embeddings and pair with **Nomic CodeRankEmbed-137M** (137M parameters, MIT license, 8192 context) as a lightweight reranker for retrieval pipelines.

---

## 4. A 15-node, 17-relationship schema backed by CPG, SCIP, and CodeQL research

The graph schema synthesizes proven elements from four established code analysis systems: Joern's Code Property Graph (multi-representation fusion and content hashing), SCIP's globally unique symbol identifiers, CodeQL's rich TypeScript type modeling, and the ICSE 2025 paper's graph-based retrieval methodology.

**The ICSE 2025 paper "Knowledge Graph Based Repository-Level Code Generation"** provides the strongest direct evidence: providing code sub-graphs as context to LLMs "significantly outperforms baseline approach" on EvoCodeBench. The **CodeGraphGPT** paper (2024) found an **8.73% average improvement in code coverage** and **84.4% reduction in manual crash analysis** using graph-structured code context. AWS Graph-RAG research confirms that "graph-RAG reduces hallucinations because aggregations are computed by the database, relationships are explicit, and missing data returns empty results instead of fabricated answers."

The schema defines **15 node types**: File, Module, Function, Class, Interface, TypeAlias, Variable, Parameter, Enum, Import, Export, JSDocComment, Namespace, Property, and Decorator. Each node carries a `hash` property (SHA-256 of content) for change detection — a pattern proven in the CPG specification — plus a `generatedDescription` property for LLM-generated summaries that the ICSE 2025 paper proved boosts retrieval accuracy.

Critical node properties for **Function** nodes specifically include: `name`, `qualifiedName` (SCIP-style globally unique identifier), `signature` (full TypeScript signature), `returnType`, `complexity` (cyclomatic), `jsdocComment`, `jsdocTags`, `generatedDescription`, `codeSnippet`, `hash`, `isExported`, `isAsync`, `decorators`, and `typeParameters`. The `qualifiedName` follows SCIP's scheme for preventing entity confusion across files and packages — proven at Sourcegraph and Meta scale.

The **17 relationship types** divide into four categories:

- **Structural**: CONTAINS, DEFINED_IN, HAS_PARAMETER
- **Type system**: EXTENDS, IMPLEMENTS, RETURNS_TYPE, TYPE_OF, HAS_TYPE_PARAMETER
- **Dependency/usage**: IMPORTS, EXPORTS, CALLS, REFERENCES, DEPENDS_ON, USES
- **Inheritance/documentation**: OVERRIDES, DECORATES, DOCUMENTED_BY

The **CALLS** relationship is among the most valuable for AI grounding — CodeGraphGPT's call graph context produced measurable improvements in code generation quality. The **DOCUMENTED_BY** relationship should carry `signatureHash`, `lastValidated`, and `driftDetected` properties to enable automated documentation freshness tracking.

The proven sub-graph extraction strategy: from a matched entity, traverse **2 hops** following CALLS, CONTAINS, IMPORTS, EXTENDS, IMPLEMENTS, and TYPE_OF edges, then serialize the sub-graph with explicit relationship labels for LLM consumption. This 2-hop boundary was validated by the ICSE 2025 paper as the optimal context unit.

---

## 5. FalkorDBLite locally, Railway for first production deploy

The deployment architecture follows three stages: embedded for development, PaaS for initial production, and VPS for cost optimization.

**Local development** uses falkordblite as a zero-config embedded database. The entire dev environment starts with `npm install && turbo dev` — no Docker, no external services. FalkorDBLite starts an embedded `redis-server` with FalkorDB module over Unix socket, supports persistence via a `path` option with automatic RDB snapshots, and covers Linux x64 and macOS arm64 (Windows via WSL2). This same approach works in **CI without service containers** — GitHub Actions runs simply install npm dependencies and execute `turbo run index-graph`.

**First production deployment** targets **Railway** at **$5–15/month**. Railway has a one-click FalkorDB deployment template, usage-based billing (you pay for actual CPU/memory utilization, not provisioned resources), visual service topology, and private networking between services. Deploy the graph database, indexer, and MCP server as separate Railway services on the same project.

**Cost optimization** migrates to a **Hetzner VPS at €3.79/month** (CX22: 2 vCPU, 4 GB RAM) running Docker Compose with Coolify for management. This single VPS handles the entire stack. Alternatively, **Fly.io** at ~$3.50/month works but requires careful volume management for persistence.

For **CI/CD**, cache the FalkorDBLite persistence directory and hash manifest as GitHub Actions cache artifacts:

```yaml
- uses: actions/cache@v4
  with:
    path: .falkordb-data/
    key: graph-${{ hashFiles('packages/*/src/**') }}
    restore-keys: graph-
```

This enables incremental graph builds across CI runs without Docker-in-Docker complexity.

---

## 6. Content-addressed hashing integrates naturally with Turborepo

The incremental indexing architecture operates at two levels: **Turborepo handles package-level change detection** via `--affected` or `--filter`, and a **custom hash manifest handles file-level incremental updates** within each package.

The `turbo.json` configuration defines an `index-graph` task with explicit `inputs` restricted to source files (`src/**/*.ts`, `package.json`, `tsconfig.json`) and `outputs` capturing the hash manifest and graph cache directory. Running `turbo run index-graph --affected` executes the indexing task only in packages that changed since the base branch. Within each package, the indexer maintains a `.graph-hashes.json` manifest mapping each file path to its SHA-256 content hash, list of created entity IDs, imports, and exported symbols.

The incremental update cycle: (1) **@parcel/watcher** detects changed files (the same native watcher Turborepo uses internally), (2) content hashes are compared against the manifest to skip unchanged files, (3) **tree-sitter** performs incremental parsing of only changed files (it has built-in incremental parsing that reuses unchanged subtree structure), (4) changed entities are upserted to FalkorDB using `MERGE` operations, (5) cross-file relationships are rebuilt for changed files plus their direct dependents (queried from the graph itself: `MATCH (changed:File)-[:EXPORTS]->(sym)<-[:IMPORTS]-(dependent:File)`), and (6) embeddings are batched and re-generated only for changed entities via a debounced queue.

The critical lesson from **code-graph-rag's realtime_updater.py**: per-file node replacement is cheap, but cross-file **relationships** (CALLS, IMPORTS) need broader recalculation to avoid stale edges. Their approach recalculates all CALLS relationships on every file change. The better approach for a Turborepo monorepo is maintaining the import graph within FalkorDB itself and rebuilding relationships only for the changed file plus its **2-hop dependents** — sufficient for consistency without full-repo recalculation.

**@parcel/watcher** beats chokidar for this use case because of its unique **post-restart change detection** — it can detect what changed even after a process restart, enabling warm-start incremental indexing. It uses native C++ OS-level APIs (FSEvents on macOS, inotify on Linux) and avoids chokidar's file descriptor exhaustion issues on large codebases.

---

## 7. Five JSDoc tags deliver 80% of AI grounding value

The **DeepCodeSeek** paper (2025) provides the strongest evidence: JSDoc summaries improved retrieval accuracy by **31 percentage points** over raw code while being 3× more token-efficient (mean 807 tokens versus 2,280 for raw code). Every gap in documentation is an invitation for AI hallucination.

**Tier 1 tags** (essential for every exported function):

- **@param** and **@returns** — core function contracts. Omit type annotations in TypeScript (the compiler provides them) but keep semantic descriptions. The fintech incident documented in 2024 showed that missing @param documentation caused 6 weeks of silent integration failures when AI passed a raw ID instead of an object.
- **@example** — arguably the single highest-value tag. Concrete usage examples provide verifiable grounding, serve as staleness detectors (stale examples won't compile), and Mintlify research emphasizes that "complete request and response examples with realistic data" are among the highest-leverage content for preventing hallucinations.
- **@throws** — TypeScript cannot express thrown types in the type system, making this JSDoc-only information. AI models frequently omit error handling without this context.
- **@deprecated** with migration path — critical temporal signal that prevents AI from suggesting deprecated APIs. A single line like `@deprecated Use {@link newMethod} instead — removed in v3.0` eliminates entire categories of wrong suggestions.

**Tier 2 custom tags** (highest novel grounding signal per token):

- **@pure** — single token, massive signal. Tells AI the function has no side effects, is safe to memoize, can be used in map/filter chains.
- **@side-effect** — documents mutations beyond return value ("Writes to database", "Sends email"). Prevents AI from calling side-effecting functions in loops or tests.
- **@business-rule** — documents WHY, not WHAT. Business logic is invisible in code structure and impossible for AI to infer. Example: `@business-rule Discount cannot exceed 30% per regulatory requirement SEC-2024-115`.
- **@idempotent** — tells AI the operation is safe to retry, critical for distributed systems code generation.

**Use JSDoc over TSDoc** for this project. JSDoc has massive ecosystem maturity, universal AI training data coverage (all LLMs are trained on JSDoc), full custom tag support via `definedTags` in eslint-plugin-jsdoc, and better extensibility. Enable `jsdoc/no-types` to avoid duplicating TypeScript types in documentation — focus JSDoc exclusively on semantic intent the type system cannot express.

---

## 8. A three-layer pipeline keeps documentation fresh automatically

Documentation freshness integrates with the knowledge graph through **signature hashing on DOCUMENTED_BY edges** — when a function's signature hash changes but its JSDoc content hash doesn't, the `driftDetected` flag is set, and staleness cascades to dependents via the graph.

The **PR-level check** runs as a GitHub Actions workflow on every pull request touching TypeScript files. It extracts changed function signatures using the TypeScript compiler, compares @param and @returns tags against actual parameters and return types, and posts a review comment listing every function where code changed but JSDoc may be stale. This catches drift at the point of introduction.

The **weekly audit** runs on a cron schedule, computing a documentation health score across the entire repository: coverage (percentage of public exports with JSDoc), freshness (percentage of JSDoc validated after its last code change), and completeness (presence of @param, @returns, @throws, @example). When the health score drops below a threshold, it auto-creates a GitHub issue with the priority files to fix.

The **AI-assisted suggestion** workflow triggers on larger PRs or PRs labeled `needs-docs`. It extracts changed signatures, feeds them with graph context to Claude Sonnet 4.5, and posts inline review comments with suggested JSDoc updates including @business-rule, @side-effect, and @throws tags. The **drift** CLI tool (TypeScript-specific, outputs machine-readable JSON) is purpose-built for this — commands like `drift fix`, `drift enrich`, and `drift review` integrate directly with agent-driven fix workflows.

For production-grade documentation management, **Swimm** is the most mature option — SOC 2 + ISO 27001 certified, with patented Auto-sync that detects code-coupled documentation drift and auto-syncs trivial changes (renames, moves) while flagging significant changes for human review. For a lightweight open-source alternative, **DocuMate** provides health scoring, drift detection, and AI generation via GitHub Copilot CLI.

---

## 9. The definitive TypeScript library stack

Each component selection prioritizes type safety, active maintenance, and ecosystem alignment with the FalkorDB + Turborepo architecture.

**AST parsing: ts-morph** (primary) with tree-sitter as a complementary fast parser. ts-morph is the only option providing full TypeScript type resolution — knowing that `foo()` returns `Promise<User>`, that `Bar` extends `Base`, that an import resolves to a specific file. SWC and tree-sitter are parsing-only with zero type information. Use tree-sitter (~1.2M weekly downloads, incremental parsing) for fast file-change detection and structural extraction, then hand off to ts-morph (~1.2M weekly downloads, written in TypeScript by the Deno team) for deep analysis. The `@swc/core` parser's AST format is non-standard and designed for transpilation, not analysis.

**Graph database client: falkordb** (falkordb-ts). TypeScript-first, actively maintained (last commit February 2026), with the unique falkordblite embedded option. The API surface is typed with full `Graph` methods: `query`, `roQuery`, `delete`, `copy`, `explain`, `profile`, `constraints`, `indexes`. For Cypher query construction, pair with **@neo4j/cypher-builder** (~15K weekly downloads, official Neo4j library, v2.10.0 January 2026) — it generates openCypher-compatible queries that work with FalkorDB, with programmatic AST construction and automatic parameter binding that prevents injection.

**MCP server: @modelcontextprotocol/sdk** — the only option. Anthropic-backed, TypeScript-first, Zod-based schema validation, supports tools/resources/prompts, with stdio and HTTP transports. Version 2.x with releases every 1–2 weeks.

**File watching: @parcel/watcher** (~14M weekly downloads). Native C++ addon using OS-level APIs, no file descriptor exhaustion on large codebases, unique post-restart change detection, and Watchman backend support. Used by Turborepo itself, Tailwind, Nx, and VSCode. **Chokidar** (~97M weekly downloads) is the runner-up for environments where native addon compilation is problematic.

**JSDoc parsing: @microsoft/tsdoc** (~2.5M weekly downloads). Designed for TypeScript, handles edge cases other parsers miss, extensible via `tsdoc.json` for custom tags, used by TypeDoc and API Extractor. **doctrine** (the previous standard) is officially deprecated. For linting and CI enforcement, **eslint-plugin-jsdoc** remains the standard — it uses **comment-parser** internally (~12M weekly downloads) and supports custom tag definitions.

**Embedding client: Vercel AI SDK** (`ai` package, ~1M+ weekly downloads) with the `voyage-ai-provider` for Voyage Code 3 access. Provider-agnostic `embed()` / `embedMany()` API, swap providers with a one-line change, TypeScript-first with excellent generics. Avoid LangChain.js for embedding-only needs — it's a heavy framework with excessive transitive dependencies.

**Testing: Vitest + falkordblite**. Vitest (~15M weekly downloads) is faster than Jest with native ESM support and TypeScript-first design. falkordblite eliminates the need for testcontainers entirely — `const db = await FalkorDB.open()` in test setup provides a real graph database with zero Docker dependency. Clean the graph between tests with `MATCH (n) DETACH DELETE n`.

---

## Conclusion

This architecture achieves a rare combination: **zero-config local development** (one `npm install` starts everything), **research-backed schema design** (drawing from CPG, SCIP, CodeQL, and the ICSE 2025 paper proving graph context outperforms flat retrieval), and **incremental efficiency** (content-addressed hashing plus Turborepo's `--affected` flag avoids full-repo recomputation).

The three decisions with the highest impact are: choosing FalkorDB with embedded mode (which eliminates the Docker dependency that kills developer adoption of graph-based tools), using Voyage Code 3 for embeddings (13.8% better than OpenAI on code retrieval), and implementing the signature-hash-based documentation freshness detection that catches JSDoc drift at PR time rather than letting it accumulate.

The most underappreciated finding is from the JSDoc research: structured documentation summaries are **3× more token-efficient** than raw code while delivering **31 percentage points better** retrieval accuracy. Investing in comprehensive @example, @throws, @business-rule, and @side-effect tags produces outsized returns in AI grounding quality — the tags are read thousands of times by AI agents for every one time they're written by a developer.
