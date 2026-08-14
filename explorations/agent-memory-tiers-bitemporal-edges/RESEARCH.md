# Agent Memory Tiers & Bitemporal Edges — Research

<!--
Stage 1 synthesis. Two halves: cited external prior art, and the in-repo
substrate to compose over. Raw per-subtopic findings (full quotes, line-level
gotchas, source lists) live in research/<subtopic>.md — linked inline. Dated
2026-06-29; research goes stale.
-->

## External Landscape

Synthesized from five research passes; raw detail + full source lists in
[`research/bitemporal-versioned-edge-modeling.md`](research/bitemporal-versioned-edge-modeling.md),
[`research/claim-lifecycle-rejected-superseded-and-conflict.md`](research/claim-lifecycle-rejected-superseded-and-conflict.md),
[`research/memory-tier-decay-and-eviction.md`](research/memory-tier-decay-and-eviction.md),
[`research/rrf-retrieval-layer-consumption.md`](research/rrf-retrieval-layer-consumption.md),
[`research/license-aware-clean-room-reimplementation.md`](research/license-aware-clean-room-reimplementation.md).

### Bitemporal theory — the vocabulary to standardize on

- Two orthogonal time axes are the standard: *valid time* (when a fact is true
  in the world) vs *transaction time* (when the fact is stored/known). Coined by
  Snodgrass & Ahn (1986); basis of SQL:2011's "application-time period tables"
  (valid-time), "system-versioned tables" (transaction-time), and the bitemporal
  combination. — https://en.wikipedia.org/wiki/Transaction_time ,
  https://www.researchgate.net/publication/261845780_Temporal_features_in_SQL2011
- Never-overwrite = append-only record history. Fowler (canonical): "Record
  history itself *is* append only… We just append the later knowledge we
  gained." The as-of read takes **two** parameters, one per axis
  (`salaryAt(validDate, recordDate)`) — the repo as-of read must accept
  `(asOfValid, asOfKnown?)`, not a single date. —
  https://martinfowler.com/articles/bitemporal-history.html
- [Raw + field-name reconciliation table](research/bitemporal-versioned-edge-modeling.md).

### Graphiti / Zep — the canonical agent-memory temporal KG (primary)

- Graphiti's `EntityEdge` stores all four bitemporal points: `valid_at` /
  `invalid_at` (valid time), `expired_at` (transaction-time close) + inherited
  `created_at`, alongside `fact`, `fact_embedding`, `episodes[]`, `attributes`,
  `group_id`, source/target node uuids. The Zep paper formalizes this as timeline
  **T** (valid: `t_valid`/`t_invalid`) and **T′** (transaction:
  `t'_created`/`t'_expired`). —
  https://raw.githubusercontent.com/getzep/graphiti/main/graphiti_core/edges.py ,
  https://arxiv.org/html/2501.13956v1
- **Invalidation closes the valid-time window, never deletes.** Load-bearing
  gotcha: Graphiti sets the superseded edge's `invalid_at` to the *`valid_at` of
  the invalidating edge* (the moment the new fact became true), NOT to ingestion
  time; `expired_at` (transaction axis) is what moves to "now." A naive
  `invalid_at = now()` supersede pass corrupts as-of-valid queries. —
  https://arxiv.org/html/2501.13956v1 ,
  https://www.getzep.com/ai-agents/temporal-knowledge-graph/
- Contradictions are *detected* (semantic + keyword + graph search compares a new
  edge against related existing edges) and *resolved* by invalidation, preserving
  history — Graphiti persists **no** explicit "contradicts" edge. —
  https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/
- Current: Graphiti **v0.29.2 (2026-06-08)**, **Apache-2.0** (Python → reuse
  shape/algorithm, not as a dependency). — https://github.com/getzep/graphiti

### agentmemory (`rohitg00/agentmemory`) — the closest shape match (primary)

- `GraphEdge` is genuinely bitemporal (`tcommit` + `tvalid`/`tvalidEnd`) and
  carries `version`/`supersededBy`/`isLatest`, `sourceObservationIds[]`,
  `EdgeContext { reasoning, sentiment, alternatives, situationalFactors,
  confidence }`, and `stale`. `GraphEdgeType` is a closed literal union that
  already bakes `succeeded_by`/`rejected` into the relation vocabulary. —
  https://raw.githubusercontent.com/rohitg00/agentmemory/main/src/types.ts
- Four-tier `ConsolidationTier = "working" | "episodic" | "semantic" |
  "procedural"`; `SemanticMemory { fact; confidence; sourceSessionIds[];
  sourceMemoryIds[]; accessCount; lastAccessedAt; strength; … }`. —
  https://raw.githubusercontent.com/rohitg00/agentmemory/main/src/types.ts
- Retention scoring (verbatim `src/functions/retention.ts`): `computeRetention =
  min(1, salience · exp(−λ·Δt_days) + reinforcementBoost)` where
  `reinforcementBoost = σ · Σ(1/daysSinceAccess_i)`; `DEFAULT_DECAY = { lambda:
  0.01, sigma: 0.3, tierThresholds: { hot: 0.7, warm: 0.4, cold: 0.15 } }`;
  below 0.15 = evictable. Eviction is `dryRun`-first, `maxEvictions` hard-capped
  at 1,000/call, audit batched per-invocation. —
  https://raw.githubusercontent.com/rohitg00/agentmemory/main/src/functions/retention.ts
- **Derived parameter math (load-bearing for tier boundaries):** λ=0.01/day ⇒
  half-life ≈ 69.3 days; a max-salience never-reaccessed memory survives ~190
  days before evictable — a *slow semantic-tier* tuning. A sub-week working tier
  needs a tier-specific λ (≈0.1 → 6.9 d, ≈0.5 → 1.4 d). The `1/Δt` reinforcement
  is recency-dominated/jittery (any touch < ~1 day forces hot); `strength` is
  **vestigial** in the verbatim scorer (only `salience` + `accessTimestamps`
  feed it). — [decay subtopic, §B/§F](research/memory-tier-decay-and-eviction.md)
- Heuristic relation confidence (verified vs source `src/functions/relations.ts`):
  base 0.5 + min(sharedSessions·0.1, 0.3) + recency(±0.1) + `supersedes` **+0.1**
  / `contradicts` **−0.05**, clamped [0,1]; `extends`/`derives`/`related` carry
  **no** weight. This is an explainable *triage* signal for the human gate, not an
  auto-decider. —
  https://raw.githubusercontent.com/rohitg00/agentmemory/main/src/functions/relations.ts
- Status: latest tag **v0.9.27 (2026-06-07)**, Apache-2.0, TS + Zod v4 + bespoke
  `iii-sdk` (Worker/Function/Trigger) — DI/Layer patterns do NOT transfer.
  Second-source critique: temporal layer stored as KV JSON blobs ⇒ every
  time-query is a full scan; port the *shape*, back it with indexed columns. —
  https://github.com/rohitg00/agentmemory ,
  https://github.com/akitaonrails/ai-memory/blob/main/docs/research-agentmemory.md
- **Name-collision warning:** ≥3 repos named "agentmemory." The corpus one is
  `rohitg00/agentmemory` (TS/Zod/Apache-2.0), NOT `JordanMcCann/agentmemory`
  (Python/MIT, different 6-signal composite retrieval, no supersedes/contradicts
  weights). Cite the right one when porting. —
  https://github.com/JordanMcCann/agentmemory

### Cognitive grounding for decay / tiers (cross-source verification)

- Exponential temporal decay is the LLM-memory consensus shape: Stanford
  **Generative Agents** `recency = 0.995^(hours)` × importance(1–10) × relevance,
  min-max normalized. — https://ar5iv.labs.arxiv.org/html/2304.03442
- **MemoryBank** ports the Ebbinghaus forgetting curve `R = e^(−t/S)` with `S`
  init 1, `S += 1` and `t = 0` on recall — strength lengthens the decay
  timescale (the better-grounded way to make `strength`/`accessCount` actually
  move retention, vs agentmemory's additive recency term). —
  https://ar5iv.labs.arxiv.org/html/2305.10250
- **ACT-R** base-level activation `B_i = ln(Σ t_j^(−d))`, d≈0.5 — a multi-trace
  *power law*; aggregate human forgetting fits power-law better than a single
  exponential, so agentmemory's `exp(−λΔt)` is a deliberate simplification. —
  http://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2021/07/ACTR2021anderson.pdf
- **FSRS** (spacing effect): reviewing too soon barely strengthens; agentmemory's
  `1/daysSinceAccess` rewards sub-day re-touches — the *opposite* of spacing.
  Separate "hotness" (recency) from "durability" (well-spaced strength). —
  https://deepwiki.com/open-spaced-repetition/fsrs-optimizer/7.3-comparison-with-sm-2 ,
  https://pmc.ncbi.nlm.nih.gov/articles/PMC5476736/
- Taxonomy maps onto Tulving (episodic vs semantic) + Squire (adds procedural;
  working memory is a separate Baddeley short-term store) — agentmemory's flat
  4-tier enum collapses two orthogonal axes; reconcile against the repo's binding
  standard rather than adopt raw. —
  https://inpact-psychologyconference.org/wp-content/uploads/2024/07/202401OP003.pdf ,
  http://whoville.ucsd.edu/PDFs/384_Squire_%20NeurobiolLearnMem2004.pdf
- Working-tier compression = MemGPT/Letta virtual context: bounded main context
  + paged external context, evict-oldest + recursive compressed summary
  ("memory consolidation"). Matches research-squad's snapshot/restore pattern and
  agentmemory's working→episodic step. — https://www.leoniemonigatti.com/blog/memgpt.html

### Claim lifecycle, conflict, and the human gate (additive states)

- Never-overwrite is corroborated by three independent primaries: **event
  sourcing** (never delete events; add compensating events; reinterpret the past
  from the future — https://dev.to/jakub_zalas/deriving-state-from-events-1plj),
  **bi-temporal SCD Type 2** (close old row with `valid_to` + `is_current=false`,
  insert new current row; open `valid_to` = live —
  https://softwarepatternslexicon.com/bitemporal-modeling/bi-temporal-data-warehouses/bi-temporal-slowly-changing-dimensions-scd-type-2/ ,
  https://en.wikipedia.org/wiki/Slowly_changing_dimension), and **Graphiti**
  (invalidate-not-delete).
- **Design recommendation (architectural judgment, not a settled fact):** keep
  the admission pipeline and the disposition axis *orthogonal* — do not widen one
  enum. `rejected`/`superseded` are terminal dispositions, not pipeline stages.
  This mirrors how `mike` keeps `document_edits.status (pending|accepted|rejected)`
  distinct from version lineage, and matches LangChain/LangGraph HITL, which
  stores the decision axis ("pending, approved, rejected, expired") separately and
  persists the full envelope to an immutable audit store via `interrupt()` +
  checkpointer. — https://docs.langchain.com/oss/python/langchain/human-in-the-loop ,
  https://medium.com/data-science-collective/architecting-human-in-the-loop-agents-interrupts-persistence-and-state-management-in-langgraph-fa36c9663d6f
- **Conflict representation — keep both** (open design choice): an explicit,
  confidence-weighted `CONTRADICTS` edge (the queryable redline-gate signal,
  agentmemory style) AND a `supersededBy` lineage pointer with bitemporal
  invalidation (the store mechanic, Graphiti style). Per-anchor supersede +
  amendment-chain semantics come from the doc-haus corpus (private; study only):
  conflicting = same anchor AND (clause-scope OR overlapping find-text), newest
  per paragraph stays pending; transitive lineage with a **cycle guard** and
  honest `resolved | ambiguous | unmatched` reporting that refuses to fabricate
  edges. — [claim-lifecycle subtopic](research/claim-lifecycle-rejected-superseded-and-conflict.md)

### As-of read filter (port the comparison, not the sentinels)

- courts-db (**BSD-2-Clause**) `filter_courts_by_date`: inclusive range
  `date_start <= date_found <= date_end`, with non-strict sentinel substitution
  (`1600-01-01` / `2100-01-01`) for nulls. Port the inclusive comparison but
  prefer Effect-Schema `Option`/open-interval over magic sentinels; two-axis
  as-of = the single comparison applied independently on valid- and
  transaction-time (Fowler's two-param query). —
  https://raw.githubusercontent.com/freelawproject/courts-db/main/courts_db/__init__.py ,
  https://github.com/freelawproject/courts-db

### RRF retrieval — consume, do not rebuild

- RRF origin: Cormack, Clarke & Büttcher, SIGIR '09 —
  `RRFscore(d) = Σ 1/(k + r(d))`, "k = 60 was fixed during a pilot investigation."
  Table 1 MAP across k∈[40,80] spans only .2138–.2147 (<0.5% rel.), confirming
  CAPTURE's "[40,80] comparable"; k→0 over-favors top-1, k→500 degrades. —
  https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf
- Industry defaults converge (adversarial cross-check): Elasticsearch
  `rank_constant` defaults 60, equal-weight base, rank-only
  (https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion);
  OpenSearch default 60, "focuses exclusively on rank positions," avoids score
  normalization (https://opensearch.org/blog/introducing-reciprocal-rank-fusion-hybrid-search/);
  Azure AI Search `1/(rank+k)`, k≈60, explicitly notes BM25 vs cosine ranges are
  incomparable (updated 2026-06-11)
  (https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking).
  **Validation: fuse on rank; do NOT min-max/z-score normalize BM25 vs cosine vs
  graph scores.**
- Weighted RRF (`weight × 1/(rank+k)`, weights non-negative, not auto-normalized)
  is distinct from the agentmemory *weight-renormalization* pattern (zero out
  absent streams, renormalize present weights to sum 1) — graceful local-first
  degradation, application-level, NOT the cross-stream score normalization RRF
  avoids. Both compose; keep separate. —
  https://www.elastic.co/search-labs/blog/weighted-reciprocal-rank-fusion-rrf
- doc-haus (**MIT**, safe to study) independently pins `RRF_K = 60`,
  `CANDIDATES = 20`, fuses cosine + FTS5/BM25 + literal-phrase channel, emits
  `doc/section/charStart/charEnd` — carries the "a literal hit must not be
  outscored by fuzzy hits" insight. — [RRF subtopic](research/rrf-retrieval-layer-consumption.md)

## In-Repo Capability Inventory

All paths verified via `ls`/`rg` on 2026-06-29 (working tree, branch
`legal-drivers`). Cross-checked against the routing tree-snapshot.

### Already provides — compose these bricks

- **Schema kit `@beep/schema`** — `LiteralKit` is the canonical literal-union
  idiom (imported as `import { LiteralKit } from "@beep/schema"`, used by
  `ClaimLifecycle.model.ts:14,38`). Use it for the edge-relation-type vocabulary,
  the disposition enum (`active`/`rejected`/`superseded`), and the authorship
  source enum. `UnitInterval` lives at `@beep/schema/UnitInterval`
  (`packages/foundation/modeling/schema/src/UnitInterval.ts` exports
  `UnitInterval`, `isUnitInterval`, `ZERO`, `ONE`, `complement` — there is **no**
  `ln` alias; prior draft cite removed).
  `EntitySchema.persist.{literal,jsonb,text}` (`@beep/schema/EntitySchema`)
  is the persisted-column idiom.
- **Per-fact confidence — ALREADY COVERED.** `Confidence = UnitInterval` re-export
  at `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:15,28`
  (`@beep/epistemic-domain`). `EdgeContext.confidence` and `SemanticMemory.confidence`
  map directly onto it — do not rebuild a confidence primitive.
- **Char-span grounding — ALREADY COVERED.** `TextAnchorFields` spread idiom at
  `packages/foundation/modeling/provenance/src/TextAnchor.ts:37,63` (`@beep/provenance`,
  exported from `@beep/provenance/TextAnchor`); the half-open invariant is
  `text.slice(start,end) === quote`. `EvidenceSpan`
  (`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:78`)
  composes `{ ...TextAnchorFields, confidence: Confidence }` with
  `startChar/endChar/quote`. A `BitemporalFields` spread should follow this exact
  mixin pattern. RRF/conflict hits must *carry* a TextAnchor/EvidenceSpan, never
  bare chunks.
- **Persisted-entity idiom.** `Evidence`
  (`packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts:32`) uses
  `BaseEntity.Class` (`@beep/shared-domain/entity/BaseEntity`) + `persist.jsonb`
  (for `span`) / `persist.text`. The versioned-edge entity should use
  `persist.jsonb` for `EdgeContext`/`sourceObservationIds` and timestamp columns
  for the four temporal fields. `CandidateClaim`
  (`packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts:36-47`)
  persists `lifecycle` via `persist.literal({columnName:"lifecycle"})` + an
  `UnknownRecord` `snapshot` jsonb — the exact template the new disposition column
  parallels.
- **Forward-only admission pipeline.** `ClaimLifecycle`
  (`packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts:38`,
  `@beep/shared-domain`) = `LiteralKit(["candidate","shape_valid","consistency_checked","admitted"])`,
  a 4-state cross-slice kernel enum with **no durable `rejected`/`superseded`
  member**. **Correction (prior draft was wrong):** `rejected` is NOT absent
  repo-wide — it already exists as a `ClaimGate` *verdict*
  (`packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts:82`,
  `ClaimGateVerdict = LiteralKit(["admitted","rejected"])`,
  `ClaimGateResult.toTaggedUnion("verdict")` carrying `violations`), and the
  transition service
  (`packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts:73`)
  branches on `gateResult.verdict === "rejected"` and treats it as a **silent
  no-op** — the rejection has nowhere durable to land. The real gap is the
  missing durable *disposition* (not a missing rejected concept). Do not claim
  `rg rejected|superseded` returns zero; that hides the existing gate semantics.
- **PROV-O substrate (richer than agentmemory's flat KV).**
  `packages/foundation/modeling/rdf/src/Prov.ts` (`@beep/rdf`,
  `@beep/semantic-web/prov`) exports `ObjectRef` (IRI/CURIE/local, brandable),
  the public `ProvDateTime` / `ProvDateTimeEncoded` schemas (lines 120/165;
  ISO-8601 + `DateTime.make`-parseable). **Correction:** there is NO exported
  `ProvDateTimeChecks` — `provDateTimeChecks` is a *private* lowercase
  `S.makeFilterGroup` const (line 38; the `$I\`ProvDateTimeChecks\`` at line 54 is
  only its annotation identifier, not an export), so importing it would fail.
  Reuse the exported `ProvDateTime` for the four bitemporal timestamps, or add a
  deliberate public export of the checks group in `@beep/semantic-web/prov`
  before depending on a checks helper. The file also exports a `Revision` PROV
  class (line 746) with `wasRevisionOf`/`wasDerivedFrom` (lines 262-263). Project the
  supersession chain: edge ⇒ `prov:Entity`, `supersededBy` ⇒ `prov:wasRevisionOf`,
  `sourceObservationIds` ⇒ `prov:wasDerivedFrom`, extraction ⇒ `prov:Activity`.
- **Binding memory-layer standard.** `standards/memory-architecture/01-memory-layer-taxonomy.md`
  defines a four-LAYER cut (1 Long-Term/Durable, 2 Short-Term/Session, 3
  Procedural/Code-Intelligence, 4 Relational/Conceptual) tied to a "No-Escape
  Theorem" (line 3). This is *conceptual, not implemented*, and is a **different
  cut** from agentmemory's `ConsolidationTier` — the exploration must reconcile
  the two, not adopt agentmemory raw.
- **Repo prior-art baseline — the donor portfolio is already assessed.** Two
  governing standards predate this packet's five external passes and must anchor
  the synthesis: `standards/memory-architecture/05-context-graph-capability-assessment.md`
  already evaluates Graphiti/Zep, GraphZep, Cognee, LangGraph/LangMem, Letta,
  mem0, TrustGraph, Microsoft GraphRAG, FalkorDB, and OpenClaw, and fixes the
  **authority rule**: "durable truth is repo-native" while external/graph systems
  may only produce *candidates, projections, caches, context packets, or donor
  capabilities* — "the boundary is not graph-or-no-graph, it is authority or
  projection" (lines 10-13, 44-45). `standards/memory-architecture/03-saas-landscape-assessment.md`
  covers Graphiti/Zep and OpenClaw memory/dreaming. **Mapping for this packet:**
  the bitemporal versioned-edge store + claim disposition are *durable truth*
  (repo-owned, schema-first); retention tiers/decay scoring and any FalkorDB/
  GraphRAG graph are *rebuildable projections/caches*; LLM-extracted edges and
  embeddings are *candidates* until gated. Do not re-argue these settled
  authority boundaries — compose on top of them.
- **Shipped epistemic gate spine.** Goals `epistemic-claim-lifecycle-gate` and
  `provenance-shared-claim-kernel` (both `completed-retained`) shipped
  CandidateClaim + Evidence + ClaimLifecycle + SHACL-backed ClaimGate. **Scoping
  correction (live `goals/epistemic-claim-lifecycle-gate/SPEC.md`):** the SPEC
  explicitly defers *FalkorDB / persistent projection store* (line 32), *the v3
  GraphRAG / extraction-pipeline port* (line 34), *richer SHACL than the bounded
  adapter* (line 36), and *matter-wall enforcement* (line 40) — it does **not**
  document durable `rejected`/`superseded` states as an explicit deferral. The
  shipped gate implements admitted/rejected verdicts and leaves rejected claims
  unchanged (`ClaimLifecycle.service.ts:73`); durable rejected/superseded
  *disposition* is simply **unimplemented**, and the bitemporal edge store + RRF
  consumption are the genuinely deferred-or-net-new scope of this packet.
- **Designated RRF owner exists.** `explorations/rag-retrieval-projection/CAPTURE.md`
  is the single owner of the scored 3-channel RRF fuser (k=60) + pgvector HNSW
  projection; it states this packet and `goals/trustgraph-port` CONSUME it.
  `goals/trustgraph-port/SPEC.md` Phase 1 is a *scoreless deterministic ordering*
  lane (no RRF) that contributes a future FalkorDB/GraphRAG graph stream.

### Genuine gaps (NOT FOUND in `packages/`)

- **`ConsolidationTier` four-tier enum — NOT FOUND** (`rg ConsolidationTier
  packages/` → zero hits). Net-new (reconcile with the layer standard).
- **`accessCount` / `strength` / `lastAccessedAt` / retention-decay scoring /
  hot-warm-cold-evictable tiers — NOT FOUND** (`rg accessCount packages/` → zero).
  No working-memory/decay tier exists.
- **Bitemporal versioned edge fields (`validFrom`/`tvalidEnd`/`supersededBy`/
  `isLatest`/`recordedAt`/`expiredAt`) and any persisted edge store — NOT FOUND**
  (`rg bitemporal|validFrom|tvalidEnd|supersededBy packages/` → zero). The owning
  table package `@beep/epistemic-tables` currently materializes **only**
  `UsageRecord` (`packages/epistemic/tables/src/entities/UsageRecord/`,
  exposed as the `n` namespace) — there is no claim, evidence, or versioned-edge
  table, so the bitemporal store is greenfield, not an extension. `@beep/drizzle`
  offers timestamp columns + generic index hints, but **no observed helper** for
  period-overlap exclusion constraints, open intervals, or supersession
  invariants — the storage work is larger than "add four timestamp columns"
  (see the storage-contract item under Open / unverified).
- **`rejected` + `superseded` claim states / disposition axis — NOT FOUND** as a
  durable state (only a transient gate *verdict* exists; `ClaimLifecycle` has no
  such member).
- **Conflict / contradiction edges + per-anchor supersede pass — NOT FOUND.** No
  conflict detection of any kind in `packages/`.
- **RRF / reciprocal-rank fusion — NOT FOUND** (`rg -i reciprocal.?rank|rrf_k|
  rankConstant packages/ apps/` → zero non-doc hits). This is a *coordination*
  gap (build it once in `rag-retrieval-projection`), not a code-dedup gap.

## Constraints

### Licensing gravity (reimplement-not-copy; full mechanics in
[license subtopic](research/license-aware-clean-room-reimplementation.md))

- **agentmemory `rohitg00/agentmemory` = Apache-2.0** (two-source verified: LICENSE
  "© 2026 Rohit Ghumare" + `package.json`). PORT-WITH-ATTRIBUTION: translate
  algorithm + shape into Effect-Schema, preserve copyright + Apache text in a repo
  attribution file, mark ported files modified. No root `NOTICE` file ⇒ no
  NOTICE-reproduction duty. Apache §3 patent grant de-risks the retention/decay
  math. Discard all iii-sdk/Zod/Anthropic wiring (DI/Layer does not transfer). Do
  NOT copy `parseTemporalGraphXml` (brittle regex, no char-span grounding) — reuse
  the *prompt shape* only and add EvidenceSpan grounding.
- **Graphiti / Zep = Apache-2.0** but Python — reference patterns/shapes,
  reimplement; not a dependency.
- **mike `willchen96/mike` = AGPL-3.0** (LICENSE = GNU AGPL; declared AGPL-3.0-only).
  **CLEAN-ROOM, spec-first, no source contact.** A cross-language translation of
  copyleft code is a derivative work that would force AGPL (+ §13 SaaS network
  disclosure) onto the whole memory slice. **Critical workflow caution:** feeding
  mike's `schema.sql` to an LLM to "rewrite in Effect-Schema" likely does NOT
  satisfy the clean-room firewall (AI-as-intermediary is legally untested —
  https://dev.to/pickuma/ai-license-laundering-how-code-generators-strip-open-source-obligations-2i0m).
  Re-derive the two shapes (`pending|accepted|rejected` gate states; version-source
  enum) from a human-authored behavioral *spec*, renamed to repo idioms — never
  transcribe column names or the 6-value enum string list.
- **harvest-mcp = repo identity + license UNVERIFIED** (could not locate the repo
  bearing the `ClassifiedParameter` taxonomy; all GitHub "harvest-mcp" hits are
  Harvest-SaaS servers). Treat as **all-rights-reserved** (GitHub: no license =
  no grant — https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).
  REIMPLEMENT THE IDEA ONLY (the `source: heuristic|llm|manual|consistency_analysis`
  enum), copy nothing.
- **screenpipe = LicenseRef-Screenpipe-Commercial** (relicensed MIT→Commercial
  **2026-06-09**, source-available, bans embedding/hosting/competing use without a
  paid license — https://screenpipe.com/blog/screenpipe-license-update). Most
  restrictive in the corpus; CAPTURE was authored *after* the relicense so the
  commercial terms govern. REFERENCE PATTERN ONLY (namespaced-tag cross-store
  linking), reimplement from scratch. (Possible MIT escape hatch via a pre-relicense
  commit — UNVERIFIED, not relied upon.)
- **doc-haus = MIT** (gold-intake `explorations/_gold-intake/research/per-repo/doc-haus.md:6`
  records `License: MIT`; a fork of OpenCode retargeted onto legal docs). SAFE TO
  STUDY and the lowest-friction RRF/citation prior art (it pins `RRF_K = 60`,
  `CANDIDATES = 20`, emits `doc/section/charStart/charEnd`). **Consistency fix
  (Codex gate-1):** earlier routing notes that tagged doc-haus "license
  unknown/private-corpus" referred to a *different* cluster and are untrusted
  here — doc-haus is MIT for this packet, so its RRF/anchor patterns may be
  reimplemented with attribution. Any doc-haus claim that cannot be tied to the
  MIT-verified repo (private-corpus-only assertions) stays untrusted until
  second-sourced.
- **Why abstract shapes are likely safe to reimplement, but verbatim copying is
  not:** *Computer Associates v. Altai* (AFC test) filters out functional ideas /
  standard techniques (a 4-tier enum, salience×exp-decay, `tvalid/tvalidEnd`
  fields, a confidence heuristic) as unprotectable — reuse the idea/algorithm,
  reimplement the expression
  (https://en.wikipedia.org/wiki/Computer_Associates_International,_Inc._v._Altai,_Inc.).
  *Google v. Oracle* (2021) left API-shape copyrightability **undecided** — copying
  field-name/enum shapes verbatim is a fact-specific fair-use gamble, so rename to
  Effect-Schema idioms to sidestep it
  (https://www.supremecourt.gov/opinions/20pdf/18-956_d18f.pdf).

### Deprecations / version pins (with dates)

- **agentmemory pins `iii-engine` v0.11.2** and refuses to attach to 0.11.6+ (new
  sandbox model). Latest tag **v0.9.27 (2026-06-07)**; the temporal layer is KV
  JSON blobs (full-scan time queries) — back the ported shape with indexed
  relational/temporal columns (drizzle tables), not blobs.
  **Authoritative dependency snapshot (Codex gate-1):** the canonical
  `package.json` read is the one cited in the
  [license subtopic](research/license-aware-clean-room-reimplementation.md) —
  `iii-sdk@0.11.2`, `zod@^4.0.0`, `@anthropic-ai/claude-agent-sdk`,
  `@anthropic-ai/sdk`, `dotenv`, `@clack/prompts`, `picocolors`; **no `effect`/
  `@effect/schema`**. The decay subtopic's looser "Anthropic/OpenAI/Gemini SDKs +
  `@xenova/transformers`" list is an *older corpus observation* and must not be
  used for license or dependency-risk analysis; only the dated `package.json`
  snapshot is load-bearing. Either way the conclusion holds: DI/Layer wiring does
  not transfer; only data shapes + algorithms port.
- **Graphiti v0.29.2 (2026-06-08)**; Azure RRF doc updated **2026-06-11**.
- **PatentsView/USPTO-ODP deprecations** appear in agentmemory's web-enrichment
  but are **out of scope** for this memory cluster (CAPTURE cautions; routing
  tree-snapshot routes USPTO work to `uspto-patent-driver-depth`, "NEVER
  PatentsView (sunset)").

### Locked decisions / architectural invariants

- **Never-overwrite / always-version is the governing invariant** (Fowler +
  event-sourcing + SCD2 + Graphiti, all agreeing). Supersede by closing
  valid-time, not deleting; mutable retention counters (`accessCount`/`strength`/
  `RetentionScore`) must live in a *separate sidecar row keyed by claimId*, never
  written onto the immutable `Evidence`/`CandidateClaim` values.
- **Graphiti supersede gotcha (locked correctness rule):** set the superseded
  edge's `invalid_at` to the invalidating edge's `valid_at` (valid-time), move
  `expired_at` to now (transaction-time). `invalid_at = now()` is a bug.
- **Additive-only against the completed gate:** `ClaimLifecycle` is a
  cross-slice **shared-kernel** enum, and it is *load-bearing in ≥2 slices today*:
  `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts:36`
  (`lifecycle: ClaimLifecycle`) and
  `packages/law-practice/domain/src/entities/Distinction/Distinction.model.ts:44`
  (`lifecycleState: ClaimLifecycle`) both type off it. Widening it in place
  mutates a completed-retained contract consumed outside this packet and turns a
  workflow-*progress* enum into a truth-*state* enum — the shared-kernel guide
  says keep evolving semantics in a concrete slice until multiple slices agree.
  ⇒ a new disposition axis (a slice-local `ClaimDisposition`/`ClaimTruthStatus`
  with `active`/`rejected`/`superseded`/`conflicted`) belongs in the **new
  slice**, wired beside lifecycle on the claim/edge projection — never folded
  into the pipeline enum. **Note:** the
  [license subtopic](research/license-aware-clean-room-reimplementation.md)
  line that says the mike-derived states should "extend existing forward-only
  `ClaimLifecycle`" is superseded by this orthogonality rule and has been
  corrected there.
- **Reconcile, don't override, the binding taxonomy:** the new `ConsolidationTier`
  must reconcile with `standards/memory-architecture/01-memory-layer-taxonomy.md`
  (4-LAYER + No-Escape Theorem), which is the governing taxonomy — not adopt
  agentmemory's enum raw.
- **No IP-law vocabulary in the epistemic/memory slice** (federation +
  no-vocabulary invariants from the completed gate). All borrowed shapes are
  domain-neutral memory primitives — porting them does not breach this, but keep
  it intact.
- **RRF: rank-only fusion + k=60 are *imported* constraints; do NOT min-max/
  z-score across BM25/cosine/graph streams** (Cormack 2009; [40,80] comparable).
  **Scope correction (Codex gate-1):** empty-channel *weight-renormalization*
  (zero out absent streams, renormalize present weights to sum 1) and any literal-
  phrase floors are **not** an industry-standard RRF rule — they are a local
  Beep-owned invariant that must be ratified in
  `explorations/rag-retrieval-projection` (its
  `research/rrf-fusion-and-retrieval-contract.md` owns this), not locked here.
  This packet *depends on* that contract rather than defining it.

### Routing cautions

- **Do NOT build a third RRF.** `rag-retrieval-projection` is the single owner of
  the scored hybrid fuser; this packet **consumes** it (supplies the
  bitemporal-edge graph stream + reads span-carrying fused hits) and owns only
  pre-fusion (per-tier candidate generation, retention-weighted recall) and
  post-fusion (session diversification, conflict/supersede filtering). The graph
  stream's intrinsic ranking signal (BFS distance? edge weight? recency?) is an
  **open question owned upstream** by the RRF packet. `goals/trustgraph-port`
  Phase 1 is a separate scoreless lane (no RRF) — whether it ever feeds RRF is
  unresolved.
- **This is a NEW exploration, not an in-place extend** of
  `epistemic-claim-lifecycle-gate` (completed-retained; explicitly deferred this
  scope). It graduates into a NEW goal extending the epistemic slice, with
  `standards/memory-architecture` as governing taxonomy and `goals/trustgraph-port`
  as the FalkorDB/GraphRAG retrieval home.

### Open / unverified (carry into align/shape)

- Explicit-`contradicts`-edge vs implicit-invalidation is a genuine **design**
  choice (agentmemory persists one; Graphiti does not) — "keep both" is a
  recommendation to ratify, not a verified standard.
- `supersededBy`/`isLatest` are project nomenclature, not standardized terms
  (SCD2 `is_current`/`valid_to`, Graphiti `t_invalid`/`expired_at` are the
  web-verified equivalents).
- agentmemory `strength` is vestigial in the verbatim scorer — confirm no other
  code path consumes it before porting as load-bearing; the MemoryBank `S+=1;t=0`
  pattern is the better-grounded reinforcement if strength must move retention.
- λ=0.01 / σ=0.3 / thresholds {0.7,0.4,0.15} are hand-picked agentmemory defaults
  (slow semantic tier) — a tier-specific λ for working/episodic is almost
  certainly needed; this is a design decision, not a sourced fact.
- doc-haus, mike, harvest-mcp, research-squad source claims derive from the
  gold-intake CAPTURE corpus (private, not web-verifiable except mike's LICENSE +
  one-shot schema, which *were* confirmed). Treat licenses/line-numbers as
  CAPTURE-asserted; re-confirm before any code reuse.
- **Provenance markers required before any code borrow (Codex gate-1).** Each
  donor claim must carry one of: `live-repo verified` (read against the actual
  repo/LICENSE — agentmemory, Graphiti/Zep, mike, screenpipe, courts-db),
  `gold-intake note` (private per-repo notes — doc-haus MIT), `private corpus
  asserted` (CAPTURE routing only — research-squad, harvest-mcp shapes), or
  `unverified` (harvest-mcp repo identity). **Rule:** require `live-repo verified`
  before borrowing any code shape, API, or license conclusion; private-corpus
  ideas are clean-room *concept-only* until second-sourced.
- **Bitemporal storage contract is unspecified and must be settled in shape/
  decompose (Codex gate-1).** Greenfield against `@beep/epistemic-tables` (today
  only `UsageRecord`). The owner packet must define: table owner + schema fields,
  open-interval representation (Effect `Option`/half-open, not magic sentinels),
  btree/gin/unique index plan, the `asOf(validAt, recordedAt?)` two-axis query
  shape, the no-overlap policy and cycle-guard policy, the migration path, and
  **whether overlap/supersession invariants are enforced in Postgres exclusion
  constraints or in Effect services** (no observed `@beep/drizzle` helper for
  period-overlap constraints exists yet).
- **Acceptance gates are not yet measurable (Codex gate-1).** Before this packet
  graduates, the goal must define datasets/fixtures + thresholds + proof commands
  for: bitemporal as-of correctness, stale-vs-fresh retrieval, conflict/
  supersession, eviction-pressure predictability, RRF empty-channel cases, and
  token-savings — so "better memory" ships as proven behavior, not subjective
  claims, on a change that touches durable memory semantics.

---

_Codex gate-1 folded 2026-06-29: 6 blocking + 7 advisory addressed._
