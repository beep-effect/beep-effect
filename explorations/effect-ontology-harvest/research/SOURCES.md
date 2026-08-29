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

- **Cluster / origin:** single-repo mining sweep of
  `effect-ontology@c148102d/` (`packages/@core-v2` src + `docs/`), executed by
  8 codex GPT-5.6-Sol inventory agents; per-area detail in
  `research/*.md`.
- **Provenance:** codex verify gate under `reviews/` (added after inventories
  land); shared agent brief in
  [`research/MAPPING-CONTEXT.md`](./MAPPING-CONTEXT.md).

### Pinned citation roots

- `effect-ontology@c148102d/` resolves to
  [`mepuka/effect-ontology@c148102d5789a5aee3fa4332bae9d45b99478e0f`](https://github.com/mepuka/effect-ontology/tree/c148102d5789a5aee3fa4332bae9d45b99478e0f).
  Unprefixed mined-source paths under `packages/@core-v2/` and `docs/` resolve
  from that tree.
- `effect-smol@f643dbb/` resolves to
  [`Effect-TS/effect-smol@f643dbb265093065dc0a61ca6133693dc2401678`](https://github.com/Effect-TS/effect-smol/tree/f643dbb265093065dc0a61ca6133693dc2401678).
  The annotated `effect@4.0.0-beta.97` and
  `@effect/ai-anthropic@4.0.0-beta.97` tags both peel to that commit. Effect
  citations continue under `packages/effect/`; Anthropic adapter citations
  continue under `packages/ai/anthropic/`. The target lock records the exact
  published versions and integrities at `bun.lock:5568` and `bun.lock:3688`,
  respectively.

## 1. Mined source corpus

<!-- Inventory agents stage one row per load-bearing mined file in their owned
area file (not per item; group by file where items share a file). After every
inventory finishes, one ledger coordinator serially merges and deduplicates
those rows here. Keep ids `eo-<area>-NN`. -->

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
| eo-dom-01 | Ontology definitions, hierarchy, and search projection | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/Ontology.ts:27-1040` | OWL/SKOS metadata and ontology query behavior | design-reference |
| eo-dom-02 | Ontology search-document contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/Model/Ontology.test.ts:11-218` | labels, definitions, relations, properties, and search text | design-reference |
| eo-dom-03 | Ontology hierarchy contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/Model/OntologyHierarchy.test.ts:5-72` | inherited properties and subclass recognition | design-reference |
| eo-dom-04 | Extracted entity knowledge graph | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/Entity.ts:18-495` | evidence-grounded entities, relations, and dual time | design-reference |
| eo-dom-05 | Entity-resolution node and edge taxonomy | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/EntityResolution.ts:1-461` | mention-to-canonical resolution with provenance | design-reference |
| eo-dom-06 | Entity-resolution graph indexes | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/EntityResolutionGraph.ts:14-111` | canonical indexes, graph state, and statistics | design-reference |
| eo-dom-07 | Entity-resolution schema contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/EntityResolution.test.ts:21-340` | tagged node and edge decoding with bounds | design-reference |
| eo-dom-08 | Batch lifecycle state machine | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/BatchWorkflow.ts:17-315` | staged processing, partial outcomes, and transitions | design-reference |
| eo-dom-09 | Batch stage handoff schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Schema/Batch.ts:18-150` | manifest and workflow activity payloads | design-reference |
| eo-dom-10 | Batch transition contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/Model/BatchWorkflow.test.ts:18-215` | progress, failure, and transition rejection | design-reference |
| eo-dom-11 | Agent execution and checkpoint model | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/Agent.ts:46-759` | events, resumable state, modes, and termination | design-reference |
| eo-dom-12 | Agent model contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/Model/Agent.test.ts:30-459` | event, checkpoint, and pipeline-state behavior | design-reference |
| eo-dom-13 | Image asset and contextual-reference model | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/Image.ts:17-496` | candidates, content assets, manifests, and prompts | design-reference |
| eo-dom-14 | Owner image-manifest contracts | mepuka/effect-ontology | `packages/@core-v2/test/Service/ImageStore.test.ts:172-304` | ordered contextual image references | design-reference |
| eo-dom-15 | Multimodal image-adapter contracts | mepuka/effect-ontology | `packages/@core-v2/test/Prompt/PromptGenerator.multimodal.test.ts:216-265` | image-reference to prompt projection | design-reference |
| eo-dom-16 | RDF primitive and graph schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Rdf/Types.ts:26-245` | branded RDF terms, triples, and quads | design-reference |
| eo-dom-17 | RDF and ontology vocabulary bundles | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Rdf/Constants.ts:13-490` | standard terms, product namespaces, and metadata | adapt-improve |
| eo-dom-18 | Domain and storage identity schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Identity.ts:16-207` | hashes, deterministic IDs, versions, and GCS addresses | design-reference |
| eo-dom-19 | Domain error export topology | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Error/index.ts:8-21` | centralized cross-boundary error taxonomy | design-reference |
| eo-dom-20 | Base error model | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Error/Base.ts:13-62` | nominal base hierarchy and implementation gaps | design-reference |
| eo-dom-21 | Workflow activity errors | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Error/Activity.ts:13-114` | stage and retry metadata | design-reference |
| eo-dom-22 | Embedding errors | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Error/Embedding.ts:19-144` | provider, retry, dimension, and token metadata | design-reference |
| eo-dom-23 | SHACL processing and policy errors | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Error/Shacl.ts:19-73` | validation lifecycle versus policy failure | design-reference |
| eo-dom-24 | Product search schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Schema/Search.ts:18-195` | faceted claim, entity, suggestion, and article search | design-reference |
| eo-dom-25 | Inference API schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Schema/Inference.ts:16-134` | profiles, delta output, jobs, and statistics | design-reference |
| eo-dom-26 | Inference contracts | mepuka/effect-ontology | `packages/@core-v2/test/Runtime/InferenceRouter.test.ts:32-117` | defaults, custom rules, and inferred output | design-reference |
| eo-dom-27 | SHACL report and policy schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Schema/Shacl.ts:13-60` | validation findings, telemetry, and workflow policy | design-reference |
| eo-dom-28 | SHACL policy contracts | mepuka/effect-ontology | `packages/@core-v2/test/Service/Shacl.policy.test.ts:68-217` | policy failure and telemetry semantics | design-reference |
| eo-dom-29 | Claim, assertion, derivation, and event schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Schema/KnowledgeModel.ts:1-710` | evidence-backed statements and derivation lineage | adapt-improve |
| eo-dom-30 | Knowledge-model event contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/Schema/KnowledgeModel.test.ts:21-210` | event IDs, participants, facts, and source-document bounds | design-reference |
| eo-prompt-01 | Extraction rule intermediate representation | mepuka/effect-ontology | `packages/@core-v2/src/Prompt/ExtractionRule.ts:19-135` | structured prompt, schema, and feedback policy | adapt-improve with attribution |
| eo-prompt-02 | Ontology-derived extraction rule sets | mepuka/effect-ontology | `packages/@core-v2/src/Prompt/RuleSet.ts:35-135,588-756` | static plus runtime ontology constraints | adapt-improve with attribution |
| eo-prompt-03 | Rule-set schema annotation generator | mepuka/effect-ontology | `packages/@core-v2/src/Prompt/SchemaGenerator.ts:36-194` | intended prompt-schema synchronization | design-reference |
| eo-prompt-04 | Ontology-aware structured prompt compiler | mepuka/effect-ontology | `packages/@core-v2/src/Prompt/PromptGenerator.ts:90-735` | SKOS/OWL guidance, cache partition, examples | adapt-improve with attribution |
| eo-prompt-05 | Mention extraction schema | mepuka/effect-ontology | `packages/@core-v2/src/Schema/MentionFactory.ts:18-70` | recognition-before-typing seam | design-reference |
| eo-prompt-06 | Ontology-derived entity schema factory | mepuka/effect-ontology | `packages/@core-v2/src/Schema/EntityFactory.ts:121-165,205-348` | runtime class and attribute constraints | port-now with attribution |
| eo-prompt-07 | Stage-bound relation schema factory | mepuka/effect-ontology | `packages/@core-v2/src/Schema/RelationFactory.ts:39-115,152-305` | entity-ID and property-range closure | port-now with attribution |
| eo-prompt-08 | Ontology-constrained extraction services | mepuka/effect-ontology | `packages/@core-v2/src/Service/Extraction.ts:87-323,366-453,506-805` | prompt/schema execution and IRI expansion | adapt-improve with attribution |
| eo-prompt-09 | Shared agent task and pipeline configuration | mepuka/effect-ontology | `packages/@core-v2/src/Service/Agent/types.ts:38-247` | universal pipeline envelope and modes | design-reference |
| eo-prompt-10 | Agent adapter kit | mepuka/effect-ontology | `packages/@core-v2/src/Service/Agent/AgentKit.ts:60-349` | ingestion, extraction, validation, correction adapters | design-reference |
| eo-prompt-11 | Agent coordinator | mepuka/effect-ontology | `packages/@core-v2/src/Service/Agent/AgentCoordinator.ts:130-738,854-1070` | sequential, loop, parallel, events, checkpoints | design-reference |
| eo-prompt-12 | SHACL corrector agent | mepuka/effect-ontology | `packages/@core-v2/src/Service/Agent/CorrectorAgent.ts:83-286,316-762` | violation-to-correction proposals and unsafe mutation | adapt-improve with attribution |
| eo-prompt-13 | Cross-batch entity resolver | mepuka/effect-ontology | `packages/@core-v2/src/Service/CrossBatchEntityResolver.ts:63-90,112-388` | hybrid blocking and persistent canonicalization | adapt-improve with attribution |
| eo-prompt-14 | External entity reconciliation | mepuka/effect-ontology | `packages/@core-v2/src/Service/ReconciliationService.ts:40-98,127-227,263-497` | thresholded Wikidata linking and review queue | adapt-improve with attribution |
| eo-prompt-15 | Curation feedback service | mepuka/effect-ontology | `packages/@core-v2/src/Service/Curation.ts:69-317,380-447` | reviewed claims to positive/negative examples | adapt-improve with attribution |
| eo-prompt-16 | Batched document classifier | mepuka/effect-ontology | `packages/@core-v2/src/Service/DocumentClassifier.ts:27-218,247-462` | preprocessing classification and silent fallback | skip |
| eo-prompt-17 | Provider-neutral embedding service | mepuka/effect-ontology | `packages/@core-v2/src/Service/Embedding.ts:29-168` | task-aware cache-through embedding | adapt-improve with attribution |
| eo-prompt-18 | Embedding request resolver | mepuka/effect-ontology | `packages/@core-v2/src/Service/EmbeddingResolver.ts:23-95` | request coalescing and provider-size batching | adapt-improve with attribution |
| eo-prompt-19 | Embedding provider fallback | mepuka/effect-ontology | `packages/@core-v2/src/Service/EmbeddingFallback.ts:78-250` | circuit-protected fallback with metadata flaw | design-reference |
| eo-prompt-20 | Embedding vector invariants | mepuka/effect-ontology | `packages/@core-v2/src/Service/EmbeddingProvider.ts:121-149` | provider contract and dimension mismatch behavior | design-reference |
| eo-prompt-21 | Voyage embedding dimensions | mepuka/effect-ontology | `packages/@core-v2/src/Service/VoyageEmbeddingProvider.ts:52-64` | model-specific vector-space identity | design-reference |
| eo-prompt-22 | Collision-aware IRI local-name mapping | mepuka/effect-ontology | `packages/@core-v2/src/Utils/Iri.ts:152-203` | aligned-ontology vocabulary ambiguity | adapt-improve with attribution |
| eo-prompt-23 | Ontology property metadata model | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/Ontology.ts:443-500` | domain, range, range-kind, and functional constraints | design-reference |
| eo-rt-01 | Production runtime bundles | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/ProductionRuntime.ts:65-234` | provider-selected LLM decoration, extraction, tracing, and infrastructure composition | adapt-improve with attribution |
| eo-rt-02 | Final server runtime and lifecycle | mepuka/effect-ontology | `packages/@core-v2/src/server.ts:140-163,230-314` | app-level Layer graph, startup, health, and graceful shutdown | design-reference |
| eo-rt-03 | Deterministic test runtime | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/TestRuntime.ts:49-246` | production-shaped mocks, config override, and managed runtime | design-reference |
| eo-rt-04 | Pluggable cluster runtime | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/ClusterRuntime.ts:42-134` | SQLite/caller-provided SQL single-runner composition | design-reference |
| eo-rt-05 | Workflow dependency bundles | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/WorkflowLayers.ts:47-583` | pre-provided service bundles, construction order, and open test seams | design-reference |
| eo-rt-06 | Config-driven embedding layers | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/EmbeddingLayers.ts:45-183` | dynamic embedding provider, limiter, cache, metrics, and config composition | design-reference |
| eo-rt-07 | Health-check service | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/HealthCheck.ts:17-153` | liveness, readiness, and bounded deep dependency checks | adapt-improve with attribution |
| eo-rt-08 | Health HTTP routes | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/HttpServer.ts:1049-1076` | probe endpoints and status mapping | design-reference |
| eo-rt-09 | Graceful shutdown service | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/Shutdown.ts:16-148` | admission cutoff, in-flight accounting, and bounded drain | adapt-improve with attribution |
| eo-rt-10 | Shutdown request middleware | mepuka/effect-ontology | `packages/@core-v2/src/Runtime/HttpMiddleware.ts:98-115` | HTTP request tracking around shutdown | design-reference |
| eo-rt-11 | Effect-native OTLP tracing Layer | mepuka/effect-ontology | `packages/@core-v2/src/Telemetry/Tracing.ts:21-73` | trace export, shutdown, and disabled/test wiring | skip |
| eo-rt-12 | In-memory Prometheus metrics service | mepuka/effect-ontology | `packages/@core-v2/src/Telemetry/Metrics.ts:19-315` | extraction, LLM, and embedding-cache metric vocabulary | design-reference |
| eo-rt-13 | LLM token cost calculator | mepuka/effect-ontology | `packages/@core-v2/src/Telemetry/CostCalculator.ts:10-68` | model pricing and token-to-USD estimation | adapt-improve with attribution |
| eo-rt-14 | GenAI and extraction span semantics | mepuka/effect-ontology | `packages/@core-v2/src/Telemetry/LlmAttributes.ts:19-189` | PII-minimized usage, cost, retry, error, and extraction attributes | adapt-improve with attribution |
**How these inform this packet:** per-area summaries live at the top of each
`research/<area>.md`; this table is the flat citation ledger.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [mepuka/effect-ontology@c148102d](https://github.com/mepuka/effect-ontology/tree/c148102d5789a5aee3fa4332bae9d45b99478e0f) | MIT | port-with-attribution | LLM-governance, content-addressing/storage, workflow/streaming, domain-model, prompting/extraction, runtime/telemetry, repository patterns from `packages/@core-v2`; design rationale from `docs/` |
| [Effect-TS/effect-smol@f643dbb](https://github.com/Effect-TS/effect-smol/tree/f643dbb265093065dc0a61ca6133693dc2401678) | MIT | pinned API/source reference | Effect v4 and Anthropic adapter migration evidence at the commits behind the locked beta.97 packages |

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
