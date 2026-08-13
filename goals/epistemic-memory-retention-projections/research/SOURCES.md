# epistemic-memory-retention-projections — inherited source corpus

Primary ledger: `explorations/agent-memory-tiers-bitemporal-edges/research/SOURCES.md`.
This file reproduces the graduation-time corpus for implementation convenience;
the exploration ledger remains the primary copy.

# Agent Memory Tiers & Bitemporal Edges — Sources & Provenance

Provenance ledger joining this packet's design back to its mined gold nuggets,
the upstream repos + licenses they came from, the external research citations on
disk, and the in-repo `@beep/*` bricks it composes. Derived from the gold-intake
cluster **"Four-tier agent-memory schema w/ confidence + conflict edges"** (15
verified nuggets, route `new-exploration`).

- **Cluster:** Four-tier agent-memory schema w/ confidence + conflict edges
- **Route:** `new-exploration` → graduates into a NEW goal extending the epistemic slice
- **Gold-intake provenance:** [`ROUTING.md`](../../../explorations/_gold-intake/ROUTING.md) ·
  [`routing.json`](../../../explorations/_gold-intake/routing.json) ·
  [`GOLD_SYNTHESIS.md`](../../../explorations/_gold-intake/GOLD_SYNTHESIS.md) (items 8 "four-tier
  agent-memory schema" and the GraphRAG/RRF retrieval item)
- **Packet codex review:** [`reviews/2026-06-29-codex-research.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/reviews/2026-06-29-codex-research.md) (gate-1: 6 blocking + 7 advisory folded)
- **Theme span:** agent-memory, governance-ops, kg-ontology-reasoning, legal-nlp, provenance-evidence
- **Wave histogram:** P1×5, P2×7, P3×3

> This ledger is ADDITIVE. It does not restate or revise RESEARCH.md / DECISIONS.md;
> it indexes them. Every external URL below is reproduced from on-disk packet
> files — none invented. Upstream repos are named (not URL'd) from the source bundle.

---

## 1. Mined source corpus (gold nuggets)

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| agentmemory#2 | Bitemporal, versioned KG edges w/ provenance + never-overwrite | agentmemory | `src/types.ts:411-435` | provenance-evidence | P1 | port-with-attribution (shape only) |
| agentmemory#6 | Four-tier memory model + confidence/provenance per fact | agentmemory | `src/types.ts:494-527` | agent-memory | P1 | port-with-attribution (reconcile w/ layer standard) |
| doc-haus#7 | Candidate→approved redline gate: pending queue, ctx.ask, conflict/supersede | doc-haus | `dochaus/lib/redlines.ts:86-108` | agent-memory | P1 | study → reimplement (MIT, attributable) |
| mike#4 | Candidate edit → human accept/reject gate (`document_edits`) | mike | `backend/schema.sql:284-304` | governance-ops | P1 | clean-room (AGPL — spec-first, no transcription) |
| mike#6 | Version lineage w/ authorship/provenance source enum | mike | `backend/schema.sql:244-253` | provenance-evidence | P1 | clean-room (AGPL — re-derive enum from behavior) |
| agentmemory#5 | Retention scoring: salience × exp decay + reinforcement; hot/warm/cold/evictable | agentmemory | `src/functions/retention.ts:81-95` | agent-memory | P2 | port-with-attribution (re-tune λ per tier) |
| agentmemory#7 | Heuristic confidence for typed relations (supersedes/contradicts/…) | agentmemory | `src/functions/relations.ts:10-37` | agent-memory | P2 | port-with-attribution (triage signal, not auto-decider) |
| courts-db#4 | Temporal validity filtering of courts by `date_found` | courts-db | `courts_db/__init__.py:150-167` | kg-ontology-reasoning | P2 | port-with-attribution (BSD-2; drop magic sentinels) |
| doc-haus#10 | Amendment-chain resolution + transitive lineage w/ cycle guard | doc-haus | `dochaus/tool/amendment-chain.ts:42-65` | kg-ontology-reasoning | P2 | study → reimplement (MIT) |
| harvest-mcp#2 | Param classification taxonomy: classification + confidence + source | harvest-mcp | `src/types/index.ts:187-242` | provenance-evidence | P2 | reimplement IDEA ONLY (unknown license = no grant) |
| research-squad#10 | Agent-memory compress/snapshot/restore prompt suite | research-squad | `baml_src/agents/memory_manager.baml:437-485` | agent-memory | P2 | study → reimplement (MIT) |
| research-squad#8 | Source quality / authority evidence schema | research-squad | `baml_src/types.baml:100-117` | provenance-evidence | P2 | port-with-attribution (MIT) |
| agentmemory#3 | XML-schema LLM extraction prompt + regex parser | agentmemory | `src/functions/temporal-graph.ts:14-46` | legal-nlp | P3 | study (reuse prompt SHAPE only; add span grounding) |
| courtlistener#9 | Additive bitmask provenance for multi-source records (`DocketSources`) | courtlistener | `cl/search/docket_sources.py:10-47` | provenance-evidence | P3 | reference only (AGPL — clean-room if used) |
| screenpipe#3 | Namespaced tag linking across heterogeneous content | screenpipe | `packages/screenpipe-mcp/src/index.ts:330-340` | agent-memory | P3 | reference pattern only (commercial license) |

### How these inform this packet

**Bitemporal versioned edges (net-new store).** `agentmemory#2` is the near-perfect
template — `GraphEdge` carries `tvalid/tvalidEnd` (valid time), `version/supersededBy/isLatest`
(assertion history), `sourceObservationIds[]` (provenance), and an `EdgeContext`. *Take* the
field shape and the load-bearing contract — **"NEVER overwrite existing relationships — always
create new versioned edges"** — but reimplement in Effect-Schema as a `BitemporalFields` mixin
(mirror `EvidenceSpan`'s `{ ...TextAnchorFields }` idiom). *Leave* the iii-sdk/KV-blob storage —
RESEARCH locks "back the shape with indexed columns." `courts-db#4` (BSD-2) contributes the
**as-of comparison** (`date_start <= date_found <= date_end`); port the inclusive interval test,
but use Effect `Option`/open-interval, not `1600-01-01`/`2100-01-01` sentinels.

**Four-tier memory + decay (net-new tier).** `agentmemory#6` gives the
`ConsolidationTier = working|episodic|semantic|procedural` enum and the
`SemanticMemory { fact; confidence; sourceMemoryIds[]; accessCount; strength; … }` shape;
`agentmemory#5` the retention scorer `min(1, salience·exp(−λΔt) + reinforcementBoost)` with
hot/warm/cold/evictable thresholds and dryRun-first eviction. *Take* the algorithm and tier
concept; *leave* the raw enum — DECISIONS/RESEARCH require reconciling against the binding
`standards/memory-architecture/01-memory-layer-taxonomy.md` (a different 4-LAYER cut), and the
λ=0.01 default is a slow-semantic tuning that needs a tier-specific λ. `research-squad#10`
(snapshot/restore) is the MemGPT-style working-tier compression analog.

**Claim lifecycle: rejected/superseded/conflict (orthogonal disposition axis).** `doc-haus#7`
is a working candidate→approved redline gate with conflict detection (same anchor AND
clause-scope OR overlapping find-text) and a distinct `superseded` status; `doc-haus#10` adds
transitive amendment-chain resolution with a **cycle guard** and honest
`resolved|ambiguous|unmatched` reporting that refuses to fabricate edges. `mike#4`/`mike#6`
mirror the relational shape — a `pending|accepted|rejected` gate kept *distinct* from a
version-source lineage enum. The load-bearing lesson (locked in RESEARCH): keep the admission
pipeline and the disposition axis orthogonal — `rejected`/`superseded` are terminal dispositions,
not pipeline stages, so they land in a **new slice-local `ClaimDisposition`**, never folded into
the shared-kernel `ClaimLifecycle`. `agentmemory#7`'s `supersedes +0.1 / contradicts −0.05`
heuristic is an explainable triage signal feeding the human gate, not an auto-decider.

**Provenance / confidence / source tagging.** `harvest-mcp#2` (reimplement idea only) and
`research-squad#8` both model a fallible proposal tagged with `confidence` + a how-derived
`source` enum (`heuristic|llm|manual|consistency_analysis`) — the exact CandidateClaim shape
for the source-of-derivation field. `courtlistener#9`'s additive bitmask `DocketSources` is a
serendipitous fast-filter index for an Evidence source-mix (reference only — AGPL).
`screenpipe#3`'s namespaced-tag cross-store linking is reference-only inspiration (commercial).

**Extraction prompt (P3, careful).** `agentmemory#3`'s XML temporal-graph prompt weights
relations 1.0 explicit / 0.5 inferred / 0.1 speculative — reuse the **prompt SHAPE only**.
Do NOT copy `parseTemporalGraphXml` (brittle regex, no char-span grounding); add
EvidenceSpan grounding or use Standard-Schema structured output.

---

## 2. Upstream repositories & licenses

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| agentmemory (`rohitg00/agentmemory`) | T1 | Apache-2.0 | **port-with-attribution** (preserve copyright + Apache text; mark ported files modified; §3 patent grant de-risks the decay math) | Bitemporal `GraphEdge` shape, `ConsolidationTier`/`SemanticMemory`, retention + relation-confidence algorithms — data shapes + algorithms ONLY (no iii-sdk/Zod/DI) |
| courtlistener (Free Law Project) | T1 | AGPL-3.0-only | **clean-room** (copyleft — pattern not code; §13 SaaS disclosure risk) | `DocketSources` additive-bitmask provenance idea (reference) |
| courts-db (Free Law Project) | T1 | BSD-2-Clause | **port-with-attribution** (permissive) | `filter_courts_by_date` inclusive as-of interval comparison |
| doc-haus | T1 | MIT | **port-with-attribution** (permissive; lowest-friction RRF/anchor prior art) | Redline candidate-gate + conflict/supersede semantics; amendment-chain w/ cycle guard; `RRF_K=60` anchor pattern |
| harvest-mcp | T2 | unknown (no LICENSE) | **reimplement idea only** (GitHub: no license = no grant → treat all-rights-reserved) | Classification + confidence + `source` enum shape — concept only, copy nothing |
| mike (`willchen96/mike`) | T1 | AGPL-3.0-only | **clean-room, spec-first** (re-derive from human-authored behavioral spec; never transcribe column names / enum string list) | `pending|accepted|rejected` gate states; version-source authorship enum — re-derived shapes |
| research-squad | T1 | MIT | **port-with-attribution** (permissive) | MemorySnapshot compress/restore prompt suite; Source authority/quality evidence schema; Effect machinery (Schedule/Layer patterns) |
| screenpipe | T3 | LicenseRef-Screenpipe-Commercial | **reference pattern only** (most restrictive in corpus; relicensed MIT→Commercial 2026-06-09) | Namespaced-tag cross-store linking design — reimplement from scratch |

> **Cautions (echoed from the source bundle):**
> - **License gravity is load-bearing.** mike (AGPL) and courtlistener (AGPL) are clean-room
>   reimplement ONLY — a cross-language translation of copyleft code is a derivative work that
>   would force AGPL + §13 network-disclosure onto the whole memory slice. Feeding mike's
>   `schema.sql` to an LLM to "rewrite in Effect-Schema" likely does NOT satisfy the clean-room
>   firewall (AI-as-intermediary is legally untested). screenpipe#3 (commercial) and harvest-mcp#2
>   (unknown license) → reference/reimplement, copy nothing. agentmemory is Apache-2.0 but is plain
>   TS + Zod v4 + bespoke iii-sdk, NOT Effect — DI/Layer/service patterns do NOT transfer; port
>   data shapes + algorithms only.
> - **Do NOT copy `parseTemporalGraphXml`** (brittle regex, lacks beep's required char-span
>   grounding) — reuse the prompt SHAPE only and add span grounding.
> - **RRF overlap (singleton retrieval layer).** The RRF/FalkorDB-projection sub-capability
>   OVERLAPS GOLD_SYNTHESIS's GraphRAG/RRF item, `explorations/rag-retrieval-projection` (the
>   designated RRF owner), and `goals/trustgraph-port` (FalkorDB/GraphRAG). CONSUME one shared
>   RRF layer; do not build a third. Validate `k=60` (Cormack 2009; k∈[40,80] comparable), fuse
>   on rank only, never score-normalize across BM25/cosine/graph streams.
> - **PatentsView/USPTO-ODP deprecations** in agentmemory's web-enrichment are out of scope here.
> - **Keep zero IP-law vocabulary** in the epistemic/memory slice (federation + no-vocabulary
>   invariants from the completed gate). All borrowed shapes are domain-neutral memory primitives.

---

## 3. External research sources

Reproduced verbatim from this packet's RESEARCH.md / `research/*.md` (External Landscape +
Constraints). Grouped by sub-area; none invented.

**Bitemporal theory & never-overwrite**
- Transaction time / valid time (Snodgrass & Ahn) — https://en.wikipedia.org/wiki/Transaction_time
- SQL:2011 temporal features — https://www.researchgate.net/publication/261845780_Temporal_features_in_SQL2011
- Fowler, *Bitemporal History* (two-param as-of read) — https://martinfowler.com/articles/bitemporal-history.html
- Event sourcing / append-only — https://dev.to/jakub_zalas/deriving-state-from-events-1plj
- Bi-temporal SCD Type 2 — https://softwarepatternslexicon.com/bitemporal-modeling/bi-temporal-data-warehouses/bi-temporal-slowly-changing-dimensions-scd-type-2/ · https://en.wikipedia.org/wiki/Slowly_changing_dimension

**Graphiti / Zep temporal KG (primary)**
- Graphiti `edges.py` — https://raw.githubusercontent.com/getzep/graphiti/main/graphiti_core/edges.py
- Zep paper (timeline T/T′) — https://arxiv.org/html/2501.13956v1
- Temporal KG (invalidate-not-delete) — https://www.getzep.com/ai-agents/temporal-knowledge-graph/ · https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/
- Repo (v0.29.2, Apache-2.0) — https://github.com/getzep/graphiti

**agentmemory (closest shape match)**
- `src/types.ts` — https://raw.githubusercontent.com/rohitg00/agentmemory/main/src/types.ts
- `src/functions/retention.ts` — https://raw.githubusercontent.com/rohitg00/agentmemory/main/src/functions/retention.ts
- `src/functions/relations.ts` — https://raw.githubusercontent.com/rohitg00/agentmemory/main/src/functions/relations.ts
- Repo + LICENSE + package.json — https://github.com/rohitg00/agentmemory · https://github.com/rohitg00/agentmemory/blob/main/LICENSE · https://github.com/rohitg00/agentmemory/blob/main/package.json
- Second-source critique (KV full-scan) — https://github.com/akitaonrails/ai-memory/blob/main/docs/research-agentmemory.md
- **Name-collision warning** (cite `rohitg00`, NOT) — https://github.com/JordanMcCann/agentmemory

**Cognitive grounding for decay / tiers**
- Stanford Generative Agents — https://ar5iv.labs.arxiv.org/html/2304.03442
- MemoryBank (Ebbinghaus) — https://ar5iv.labs.arxiv.org/html/2305.10250
- ACT-R base-level activation — http://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2021/07/ACTR2021anderson.pdf
- FSRS / spacing effect — https://deepwiki.com/open-spaced-repetition/fsrs-optimizer/7.3-comparison-with-sm-2 · https://pmc.ncbi.nlm.nih.gov/articles/PMC5476736/
- Tulving/Squire taxonomy — https://inpact-psychologyconference.org/wp-content/uploads/2024/07/202401OP003.pdf · http://whoville.ucsd.edu/PDFs/384_Squire_%20NeurobiolLearnMem2004.pdf
- MemGPT/Letta virtual context — https://www.leoniemonigatti.com/blog/memgpt.html

**Claim lifecycle, conflict & human gate**
- LangChain/LangGraph HITL — https://docs.langchain.com/oss/python/langchain/human-in-the-loop · https://medium.com/data-science-collective/architecting-human-in-the-loop-agents-interrupts-persistence-and-state-management-in-langgraph-fa36c9663d6f

**As-of read filter**
- courts-db `__init__.py` + repo — https://raw.githubusercontent.com/freelawproject/courts-db/main/courts_db/__init__.py · https://github.com/freelawproject/courts-db

**RRF retrieval (consume, do not rebuild)**
- Cormack, Clarke & Büttcher SIGIR '09 — https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf
- Elasticsearch RRF (`rank_constant`=60) — https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion
- OpenSearch RRF — https://opensearch.org/blog/introducing-reciprocal-rank-fusion-hybrid-search/
- Azure AI Search hybrid ranking — https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking
- Weighted RRF — https://www.elastic.co/search-labs/blog/weighted-reciprocal-rank-fusion-rrf

**License analysis (clean-room / copyright)**
- AI license laundering — https://dev.to/pickuma/ai-license-laundering-how-code-generators-strip-open-source-obligations-2i0m
- GitHub no-license = no grant — https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
- screenpipe relicense — https://screenpipe.com/blog/screenpipe-license-update
- mike (AGPL) repo/LICENSE — https://github.com/willchen96/mike · https://github.com/willchen96/mike/blob/main/LICENSE · https://github.com/willchen96/mike/blob/main/backend/migrations/000_one_shot_schema.sql
- *CA v. Altai* (AFC test) — https://en.wikipedia.org/wiki/Computer_Associates_International,_Inc._v._Altai,_Inc.
- *Google v. Oracle* — https://www.supremecourt.gov/opinions/20pdf/18-956_d18f.pdf
- Clean-room design — https://en.wikipedia.org/wiki/Clean-room_design · https://writing.kemitchell.com/2021/01/24/Reading-AGPL
- Apache-2.0 text — https://www.apache.org/licenses/LICENSE-2.0

> Per-subtopic raw source lists live in the five `research/*.md` files linked from
> RESEARCH.md's "External Landscape" header.

---

## 4. In-repo capability references

The `@beep/*` bricks this packet composes (from the bundle's secondaryTargets + RESEARCH.md's
In-Repo Capability Inventory). Paths verified in RESEARCH on 2026-06-29.

| Capability | Package path | Status |
| --- | --- | --- |
| `LiteralKit` / `UnitInterval` / `EntitySchema.persist` | `@beep/schema` (`packages/foundation/modeling/schema/src/`) | **reuse** — edge-relation vocab, disposition enum, source enum |
| `Confidence = UnitInterval`; `EvidenceSpan` (`{...TextAnchorFields, confidence}`) | `@beep/epistemic-domain` (`packages/epistemic/domain/src/values/EvidenceSpan/`) | **reuse** — do not rebuild a confidence primitive; `BitemporalFields` follows this mixin |
| `TextAnchorFields` (half-open `slice(start,end)===quote`) | `@beep/provenance` (`packages/foundation/modeling/provenance/src/TextAnchor.ts`) | **reuse** — RRF/conflict hits MUST carry an anchor |
| `Evidence` / `CandidateClaim` (`BaseEntity.Class` + `persist.{jsonb,literal,text}`) | `@beep/epistemic-domain` (`packages/epistemic/domain/src/entities/`) | **extend** — versioned-edge entity parallels the `lifecycle` + jsonb-`snapshot` template |
| `ClaimLifecycle` (4-state shared-kernel enum) | `@beep/shared-domain` (`packages/shared/domain/src/values/ClaimLifecycle/`) | **reuse, DO NOT widen** — load-bearing in epistemic + law-practice; new `ClaimDisposition` is slice-local |
| `ClaimGate` verdict + `ClaimLifecycle.service` (rejected = silent no-op today) | `@beep/epistemic` use-cases (`packages/epistemic/use-cases/src/ClaimLifecycle/`) | **extend** — give rejected/superseded a durable disposition landing spot + conflict/supersede pass |
| PROV-O substrate (`ProvDateTime`, `Revision`, `wasRevisionOf`/`wasDerivedFrom`) | `@beep/semantic-web` (`packages/foundation/capability/semantic-web/src/prov.ts`) | **reuse/extend** — project supersession chain to PROV (note: no public `ProvDateTimeChecks` export) |
| `@beep/epistemic-tables` (today only `UsageRecord`) | `packages/epistemic/tables/src/` | **NET-NEW** — greenfield bitemporal edge / disposition / version-lineage store |
| `@beep/drizzle` timestamp columns + index hints | `packages/.../drizzle` | **reuse** — but NO period-overlap/exclusion-constraint helper exists yet |
| Retention/working-set + MemorySnapshot services | new `@beep/agents-use-cases` | **NET-NEW** — no working-memory/decay tier exists |

Governing standards (compose on, do not re-argue):
`standards/memory-architecture/01-memory-layer-taxonomy.md` (4-LAYER taxonomy + No-Escape
Theorem — reconcile `ConsolidationTier` against it), `…/05-context-graph-capability-assessment.md`
(authority-vs-projection boundary), `…/03-saas-landscape-assessment.md`.

---

## 5. Cross-links & provenance

- **Cluster id:** "Four-tier agent-memory schema w/ confidence + conflict edges" (gold-intake, 15 nuggets, route `new-exploration`)
- **Exploration ↔ goal / sibling links** (bundle `secondaryTargets`):
  - `goals/epistemic-claim-lifecycle-gate` — completed-retained; explicitly deferred the bitemporal store + RRF; this packet graduates a NEW goal, never edits the closed gate
  - `standards/memory-architecture` — governing taxonomy + authority/projection boundary
  - `goals/agentic-professional-runtime` — downstream consumer of the memory layer
  - `goals/trustgraph-port` — FalkorDB/GraphRAG retrieval home (Phase 1 scoreless lane)
  - `explorations/rag-retrieval-projection` — **single RRF owner**; this packet CONSUMES it (supplies the bitemporal-edge graph stream, reads span-carrying fused hits)
  - `explorations/_gold-intake` — source corpus
- **This packet's own trail:** [`CAPTURE.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/CAPTURE.md) · [`RESEARCH.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/RESEARCH.md) ·
  [`DECISIONS.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md) (7 pre-drafted forks Q1–Q7) · [`BRIEF.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/BRIEF.md) ·
  [`MAP.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/MAP.md) · [`README.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/README.md)
- **Sub-research:** [`research/bitemporal-versioned-edge-modeling.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/research/bitemporal-versioned-edge-modeling.md) ·
  [`research/claim-lifecycle-rejected-superseded-and-conflict.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/research/claim-lifecycle-rejected-superseded-and-conflict.md) ·
  [`research/memory-tier-decay-and-eviction.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/research/memory-tier-decay-and-eviction.md) ·
  [`research/rrf-retrieval-layer-consumption.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/research/rrf-retrieval-layer-consumption.md) ·
  [`research/license-aware-clean-room-reimplementation.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/research/license-aware-clean-room-reimplementation.md)
- **Codex review:** [`reviews/2026-06-29-codex-research.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/reviews/2026-06-29-codex-research.md)
- **Gold synthesis:** [`GOLD_SYNTHESIS.md`](../../../explorations/_gold-intake/GOLD_SYNTHESIS.md) §"Agent memory
  & learning" (item 8: four-tier schema; retention; relation-confidence) and the GraphRAG/RRF
  retrieval item
