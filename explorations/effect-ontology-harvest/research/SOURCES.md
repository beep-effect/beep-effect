# effect-ontology @core-v2 Harvest — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy. Purpose: let an
implementing agent trace every decision back to its origin — a mined source
(repo + file:line), an upstream repo + LICENSE, an external citation, or an
in-repo brick.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ treat as reference
  only. State the discipline per repo.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Cluster / origin:** single-repo mining sweep of the local checkout
  `~/YeeBois/dev/effect-ontology` (`packages/@core-v2` src + `docs/`), executed
  by 8 codex GPT-5.6-Sol inventory agents; per-area detail in
  `research/*.md`.
- **Provenance:** codex verify gate under `reviews/` (added after inventories
  land); shared agent brief in
  [`research/MAPPING-CONTEXT.md`](./MAPPING-CONTEXT.md).

## 1. Mined source corpus

<!-- Inventory agents: append one row per load-bearing mined file (not per
item — group by file where items share a file). Keep ids `eo-<area>-NN`. -->

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| eo-cas-01 | Hash utilities and versioned embedding keys | mepuka/effect-ontology | `packages/@core-v2/src/Utils/Hash.ts:69-166` | full-digest hashing and provider/model-aware cache identity | adapt-improve |
| eo-cas-02 | Content-derived domain identities | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Identity.ts:16-145` | branded content hashes and deterministic document ids | design-reference |
| eo-cas-03 | Hash invariant property tests | mepuka/effect-ontology | `packages/@core-v2/test/Utils/Hash.test.ts:87-160` | deterministic 64-hex digest contracts | design-reference |
| eo-cas-04 | Unified extraction idempotency key | mepuka/effect-ontology | `packages/@core-v2/src/Utils/IdempotencyKey.ts:25-188` | normalized operation fingerprint across cache and persistence | adapt-improve |
| eo-cas-05 | Schema-driven storage path layout | mepuka/effect-ontology | `packages/@core-v2/src/Domain/PathLayout.ts:19-247` | reversible content-addressed ontology and run paths | adapt-improve |
| eo-cas-06 | Path layout round-trip tests | mepuka/effect-ontology | `packages/@core-v2/test/Domain/PathLayout.test.ts:8-75` | path validation and generated round trips | design-reference |
| eo-cas-07 | Multi-backend StorageService | mepuka/effect-ontology | `packages/@core-v2/src/Service/Storage.ts:7-546` | GCS/local/memory object storage, generations, and signed URLs | design-reference |
| eo-cas-08 | GCS storage integration tests | mepuka/effect-ontology | `packages/@core-v2/test/Service/Storage.gcs.test.ts:61-310` | binary, listing, and prefix-isolation contracts | design-reference |
| eo-cas-09 | ImageBlobStore | mepuka/effect-ontology | `packages/@core-v2/src/Service/ImageBlobStore.ts:22-193` | content-addressed image bytes and metadata facade | adapt-improve |
| eo-cas-10 | Image blob/store tests | mepuka/effect-ontology | `packages/@core-v2/test/Service/ImageStore.test.ts:61-151` | image byte, metadata, existence, and delete contracts | design-reference |
| eo-cas-11 | Filesystem extraction cache | mepuka/effect-ontology | `packages/@core-v2/src/Service/ExtractionCache.ts:17-110` | extraction cache seam and incomplete TTL/invalidation | skip |
| eo-cas-12 | Extraction cache tests | mepuka/effect-ontology | `packages/@core-v2/test/Service/ExtractionCache.test.ts:44-79` | cache round-trip and miss coverage | design-reference |
| eo-cas-13 | Embedding cache services | mepuka/effect-ontology | `packages/@core-v2/src/Service/EmbeddingCache.ts:20-642` | in-memory TTL/LRU and persistent two-tier cache | design-reference |
| eo-cas-14 | Embedding cache tests | mepuka/effect-ontology | `packages/@core-v2/test/Service/EmbeddingCache.test.ts:12-180` | CRUD, TestClock expiry, and LRU contracts | design-reference |
| eo-cas-15 | PostgreSQL workflow persistence layers | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/Persistence/PostgresLayer.ts:65-169` | SQL message/runner storage and sharding composition | design-reference |
| eo-cas-16 | Persistence runtime startup wiring | mepuka/effect-ontology | `packages/@core-v2/src/server.ts:73-138` | durable workflow selection and fail-fast migration startup | design-reference |
| eo-cas-17 | Embedded migration runner and catalog | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/Persistence/MigrationRunner.ts:34-547` | ordered migration gate and source-of-truth drift | design-reference |
| eo-cas-18 | Ingested-link migration | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/Persistence/migrations/004_ingested_links.sql:1-158` | content-addressed ingestion metadata and batch state | adapt-improve |
| eo-cas-19 | pgvector and hybrid-search migration | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/Persistence/migrations/010_pgvector_setup.sql:1-153` | ontology-scoped vector/text RRF retrieval | adapt-improve |
| eo-cas-20 | PostgreSQL EventLog storage | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/Persistence/EventLogStorage.ts:26-265` | encrypted replay and same-process live tailing with concurrency hazards | design-reference |
| eo-cas-21 | Initial claim ledger migration | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/Persistence/migrations/001_claims_schema.sql:5-185` | RDF-backed claims, corrections, conflicts, and evidence | adapt-improve |
| eo-cas-22 | Bitemporal-oriented timestamp migration | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/Persistence/migrations/002_bitemporal_timestamps.sql:5-47` | valid-time intervals plus assertion and derivation timestamps | adapt-improve |
| eo-cas-23 | Claim idempotency migration | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/Persistence/migrations/003_claim_idempotency.sql:5-17` | database-enforced natural-key deduplication | adapt-improve |
| eo-cas-24 | Claim persistence integration tests | mepuka/effect-ontology | `packages/@core-v2/test/Repository/Claim.integration.test.ts:502-592` | duplicate skipping and valid-time persistence | design-reference |
| eo-cas-25 | Ontology-scoped content-hash migration | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/Persistence/migrations/008_content_hash_scoping.sql:5-28` | contextual metadata over shared immutable content | adapt-improve |
| eo-cas-26 | Link ingestion content-addressing runtime | mepuka/effect-ontology | `packages/@core-v2/src/Service/LinkIngestionService.ts:124-239` | content-only blob paths and ontology-scoped lookup cache | adapt-improve |
| eo-cas-27 | Link ingestion duplicate test | mepuka/effect-ontology | `packages/@core-v2/test/Service/LinkIngestionService.test.ts:98-134` | duplicate hit bypasses object-store write | design-reference |
| eo-cas-28 | Embedding repository integration tests | mepuka/effect-ontology | `packages/@core-v2/test/Repository/Embedding.integration.test.ts:85-349` | upsert, vector, text, and weighted hybrid retrieval | design-reference |
| eo-llm-01 | Rate-limited LanguageModel layer | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/RateLimitedLanguageModel.ts:33-190` | provider-transparent rate, circuit, and telemetry decoration | adapt-improve with attribution |
| eo-llm-02 | Central LLM admission controller | mepuka/effect-ontology | `packages/@core-v2/src/Service/LlmControl/RateLimiter.ts:24-323` | request, token, concurrency, and circuit admission | adapt-improve with attribution |
| eo-llm-03 | Stage-partitioned token budget | mepuka/effect-ontology | `packages/@core-v2/src/Service/LlmControl/TokenBudget.ts:27-263` | request-scoped stage allocation and usage accounting | adapt-improve with attribution |
| eo-llm-04 | Generic circuit-breaker decorator | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/CircuitBreaker.ts:22-226` | typed failure isolation and recovery state | adapt-improve with attribution |
| eo-llm-05 | Circuit and rate-limit errors | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Error/Circuit.ts:20-50` | serializable retry and reset metadata | adapt-improve with attribution |
| eo-llm-06 | Soft/hard stage timeout service | mepuka/effect-ontology | `packages/@core-v2/src/Service/LlmControl/StageTimeout.ts:29-234` | named-stage warning and interruption deadlines | adapt-improve with attribution |
| eo-llm-07 | LLM semaphore service | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/LlmSemaphore.ts:20-88` | bracketed provider concurrency and timeout pitfalls | design-reference |
| eo-llm-08 | Retry policy factory | mepuka/effect-ontology | `packages/@core-v2/src/Service/Retry.ts:18-173` | bounded jitter and retry classification | adapt-improve with attribution |
| eo-llm-09 | Structured generation with retry | mepuka/effect-ontology | `packages/@core-v2/src/Service/LlmWithRetry.ts:29-167` | timeout, retry, schema hash, usage, and telemetry envelope | adapt-improve with attribution |
| eo-llm-10 | Execution deduplicator | mepuka/effect-ontology | `packages/@core-v2/src/Service/ExecutionDeduplicator.ts:17-141` | in-flight single-flight election with Deferred waiters | design-reference |
| eo-llm-11 | Prompt cache helper | mepuka/effect-ontology | `packages/@core-v2/src/Service/PromptCache.ts:14-72` | stable/variable prompt partition and no-op cache flag | design-reference |
| eo-llm-12 | Generate with feedback | mepuka/effect-ontology | `packages/@core-v2/src/Service/GenerateWithFeedback.ts:25-249` | structured-output repair loop and retry-policy drift | design-reference |
| eo-llm-13 | Rule-aware feedback generator | mepuka/effect-ontology | `packages/@core-v2/src/Prompt/FeedbackGenerator.ts:17-395` | schema issue paths, rule reminders, and correction prompts | adapt-improve with attribution |
| eo-llm-14 | Extraction governance consumer | mepuka/effect-ontology | `packages/@core-v2/src/Cluster/ExtractionEntityHandler.ts:171-184,242-255,331-540` | end-to-end budget, timeout, and permit lifecycle evidence | design-reference |
| eo-llm-15 | Circuit-breaker contract tests | mepuka/effect-ontology | `packages/@core-v2/test/Runtime/CircuitBreaker.test.ts:5-69` | threshold, fail-fast, and consecutive-failure reset behavior | design-reference |
| eo-llm-16 | Stage-timeout contract tests | mepuka/effect-ontology | `packages/@core-v2/test/Service/Extraction.timeout.test.ts:19-188` | soft callback, hard failure, defaults, and prediction | design-reference |
| eo-llm-17 | LLM-semaphore contract tests | mepuka/effect-ontology | `packages/@core-v2/test/Runtime/LlmSemaphore.test.ts:12-81` | concurrency bound and misleading availability coverage | design-reference |
| eo-llm-18 | Retry policy tests | mepuka/effect-ontology | `packages/@core-v2/test/Service/Retry.test.ts:5-32` | HTTP classification and unexercised network-code branch | design-reference |
| eo-llm-19 | Execution-deduplicator tests | mepuka/effect-ontology | `packages/@core-v2/test/Service/ExecutionDeduplicator.test.ts:5-43` | handle reuse and cleanup without a race test | design-reference |
| eo-llm-20 | Feedback-loop test | mepuka/effect-ontology | `packages/@core-v2/test/Service/GenerateWithFeedback.test.ts:4-12` | interface-only schedule coverage | design-reference |
| eo-wf-01 | Workflow and cluster dependency baseline | mepuka/effect-ontology | `packages/@core-v2/package.json:36-65` | Effect v3 split-package workflow/cluster versions | design-reference |
| eo-wf-02 | Locked workflow and cluster versions | mepuka/effect-ontology | `bun.lock:737-775` | resolved cluster/workflow compatibility baseline | design-reference |
| eo-wf-03 | Workflow engine runtime selection | mepuka/effect-ontology | `packages/@core-v2/src/server.ts:73-89` | PostgreSQL durable engine versus memory fallback | design-reference |
| eo-wf-04 | Batch workflow and orchestration facade | mepuka/effect-ontology | `packages/@core-v2/src/Service/WorkflowOrchestrator.ts:123-1035` | deterministic lifecycle, staged partial success, and control operations | adapt-improve with attribution |
| eo-wf-05 | Deprecated activity wrappers | mepuka/effect-ontology | `packages/@core-v2/src/Workflow/Activities.ts:16-150` | legacy non-journaled factory explicitly superseded | skip |
| eo-wf-06 | Durable extraction activities | mepuka/effect-ontology | `packages/@core-v2/src/Workflow/DurableActivities.ts:296-1040` | journaled stages, validation gate, and generation-locked ingestion | adapt-improve with attribution |
| eo-wf-07 | Streaming extraction pipeline | mepuka/effect-ontology | `packages/@core-v2/src/Workflow/StreamingExtraction.ts:29-638` | bounded chunk processing and content/systemic failure policy | adapt-improve with attribution |
| eo-wf-08 | Durable streaming extraction adapter | mepuka/effect-ontology | `packages/@core-v2/src/Workflow/StreamingExtractionActivity.ts:82-411` | ontology-version-bound runs and named-graph staging | adapt-improve with attribution |
| eo-wf-09 | Evidence-aware graph reducer | mepuka/effect-ontology | `packages/@core-v2/src/Workflow/Merge.ts:68-368` | semantic entity merge, deterministic output, and conflicts | adapt-improve with attribution |
| eo-wf-10 | Pairwise entity resolution baseline | mepuka/effect-ontology | `packages/@core-v2/src/Workflow/EntityResolution.ts:54-277` | thresholded union-find and canonical relation rewrite | design-reference |
| eo-wf-11 | Graph-based entity resolution overlay | mepuka/effect-ontology | `packages/@core-v2/src/Workflow/EntityResolutionGraph.ts:38-503` | blocked similarity graph and mention-to-resolved candidates | design-reference |
| eo-wf-12 | Cluster extraction entity protocol | mepuka/effect-ontology | `packages/@core-v2/src/Cluster/ExtractionEntity.ts:24-163` | keyed streaming, cache, cancellation, and status RPCs | design-reference |
| eo-wf-13 | Governed cluster extraction handler | mepuka/effect-ontology | `packages/@core-v2/src/Cluster/ExtractionEntityHandler.ts:171-761` | admission controls, progress, cancellation, and incomplete result projection | design-reference |
| eo-wf-14 | Criticality-aware backpressure operator | mepuka/effect-ontology | `packages/@core-v2/src/Cluster/BackpressureHandler.ts:25-282` | critical-event preservation with incorrect bounded-queue semantics | design-reference |
| eo-wf-15 | Progress streaming protocol | mepuka/effect-ontology | `packages/@core-v2/src/Contract/ProgressStreaming.ts:27-1356` | typed lifecycle, recovery, cancellation, and transport messages | adapt-improve with attribution |
| eo-wf-16 | Progress builders and manual backpressure | mepuka/effect-ontology | `packages/@core-v2/src/Service/ProgressStreaming.ts:35-595` | event construction, resumable state, and nonfunctional queue wrapper | design-reference |
| eo-wf-17 | Workflow persistence adapter | mepuka/effect-ontology | `packages/@core-v2/src/Service/WorkflowPersistence.ts:19-103` | prefixed key-value persistence with error/isolation hazards | adapt-improve with attribution |
| eo-wf-18 | Per-ontology EventLog WebSocket router | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/EventStreamRouter.ts:21-258` | ontology-scoped auth and event synchronization | design-reference |

**How these inform this packet:** per-area summaries live at the top of each
`research/<area>.md`; this table is the flat citation ledger.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [mepuka/effect-ontology](https://github.com/mepuka/effect-ontology) | MIT | port-with-attribution | LLM-governance, content-addressing/storage, workflow/streaming, domain-model, prompting/extraction, runtime/telemetry, repository patterns from `packages/@core-v2`; design rationale from `docs/` |

## 3. External research sources

None yet — this is a single-repo mining packet; external landscape citations
(if any) will be added by the docs-rationale agent or during evaluation.

## 4. In-repo capability references

<!-- The @beep/* bricks this packet composes, each with its package path,
marked reuse / extend / NET-NEW. Seeded from the mapping brief; evaluation
refines dispositions. -->

| Brick | Path | Disposition |
|-------|------|-------------|
| `@beep/schema` | `packages/foundation/modeling/schema` | reuse (schema substrate for any port) |
| `@beep/rdf` | `packages/foundation/modeling/rdf` | reuse / design-compare vs `Domain/Rdf` |
| `@beep/ontology` | `packages/foundation/modeling/ontology` | reuse / design-compare vs `Domain/Model/Ontology` |
| `@beep/identity` | `packages/foundation/modeling/identity` | reuse / design-compare vs `Domain/Identity` |
| `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | reuse / design-compare (SHACL/SPARQL contracts) |
| `@beep/provenance` | `packages/foundation/modeling/provenance` | reuse |
| `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | reuse (agent tool surfaces) |
| ontology-slice stateless CAS | `packages/ontology/use-cases/src/tools/OntologyToolService.ts` | extend / design-compare vs `Utils/Hash` + `IdempotencyKey` |
| `epistemic` slice | `packages/epistemic/*` | reuse (claim/evidence lifecycle) |
| LLM drivers | `packages/drivers/{anthropic,openai-compat,xai,venice-ai}` | reuse / extend (governance wrapping point) |
| RDF drivers | `packages/drivers/{oxigraph,shacl,n3,rdf-canonize}` | reuse |
| LLM governance capability | — | NET-NEW candidate (`foundation/capability`) |
| generic CAS/cache capability | — | NET-NEW candidate (`foundation/capability`) |
| workflow substrate | — | NET-NEW candidate (family TBD in align) |

## 5. Cross-links & provenance

- Packet: [`CAPTURE.md`](../CAPTURE.md) · [`RESEARCH.md`](../RESEARCH.md) ·
  [`DECISIONS.md`](../DECISIONS.md) · `reviews/` (codex gate)
- Goal packets scored against (north star): `goals/ontology-agent-surface`,
  `goals/semantic-foundation`, `goals/agentic-professional-runtime`,
  `goals/unified-ai-toolchain`, `goals/ip-law-knowledge-graph`,
  `goals/trustgraph-port`
- Sibling explorations: `explorations/ontology-agent-surface` (graduated),
  `explorations/legal-ontology-landscape`, `explorations/identity-as-iri`,
  `explorations/multi-provider-llm-dispatch-fallback`,
  `explorations/agent-memory-tiers-bitemporal-edges`,
  `explorations/rag-retrieval-projection`
