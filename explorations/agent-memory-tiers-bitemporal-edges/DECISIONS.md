# Agent Memory Tiers & Bitemporal Edges — Decisions

<!--
Stage 2 (align) SEED. Each "## Q<n>" is a branch-closing fork with a RECOMMENDED
answer and grounded rationale, left **open** on purpose: the user resolves them
via `/grill-with-docs agent-memory-tiers-bitemporal-edges`, one branch at a time,
logging each resolution here and syncing manifest `openQuestions`. Recommendations
are grounded in RESEARCH.md (cited inline) — starting positions to grill, not
settled decisions. Do not over-specify; these forks shape the goal, not the code.
-->

## Research input (2026-07-08 run, recorded 2026-07-11) — forks remain open

The 13-lane memory-stack research
([`docs/agent-memory-infra/00-recommendation.md`](../../docs/agent-memory-infra/00-recommendation.md))
bears directly on four forks below; its findings strengthen the recommended
answers but do NOT close them — resolve via `/grill-with-docs` as designed:

- **Q1 (sourcing/licensing):** borrow shapes from Apache-2.0 Graphiti only
  (file-level citations in `graphiti-clone.md`: `edges.py:263-285`,
  `nodes.py:318-351`, `edge_operations.py:538-847`); no SSPL code paths —
  FalkorDB is SSPLv1, and Graphiti-with-FalkorDB bundles inherit the flag.
- **Q2 (own vs consume/defer):** unchanged; FalkorDB/GraphRAG stay deferred to
  `goals/trustgraph-port`; NEW consume-idea — Cognee's relational rollback
  ledger for projection rebuild/undo.
- **Q4 (durable truth):** reaffirmed by all thirteen lanes — Postgres
  repo-native via `@beep/epistemic-tables` + `@beep/drizzle`; no external
  graph vendor in the authority path.
- **Q6 (CONTRADICTS edge):** adopt Graphiti's invalidate-don't-delete
  semantics as the reference shape; add the Oracle's review-state enum
  (`candidate`/`machine-extracted`/`human-reviewed`/`authoritative`) to the
  edge lifecycle schema.

Also note: this packet's port is now load-bearing for dev tooling — Graphiti's
deployment is write-frozen and decommissions only after this port lands
(`standards/memory-architecture/04-decision-log.md`, 2026-07-08 entry).

---

## Q1: How do we source the borrowed memory primitives — port-with-attribution, reference-only, or clean-room?

**Recommended:** Reimplement everything in Effect-Schema and take **no runtime
dependency** on any donor. Tier the sourcing by license: (a) **port-with-attribution**
agentmemory (`rohitg00/agentmemory`, Apache-2.0) — translate its data shapes,
retention/decay math, and relation-confidence heuristic into `LiteralKit` /
`Model.Class`, preserve the Apache copyright + text in a repo attribution file,
mark ported files modified, and discard all iii-sdk / Zod / Anthropic wiring;
(b) **reference-only** Graphiti / Zep (Apache-2.0 but Python) for the bitemporal
invalidation semantics; (c) **clean-room, spec-first** the mike-derived gate /
version-source states (AGPL-3.0) — re-derive from a human-authored behavioral spec,
never transcribe column names or the enum string list, and do not launder the
schema through an LLM; (d) **idea-only** for harvest-mcp (license unverified → treat
all-rights-reserved) and screenpipe (Commercial relicense 2026-06-09). Require
`live-repo verified` provenance before borrowing any code shape.

**Rationale:** The license subtopic two-source-verifies each donor's terms.
*Computer Associates v. Altai* (AFC) filters functional ideas / standard techniques
— a 4-tier enum, `salience·exp(−λΔt)`, `tvalid`/`tvalidEnd` fields, a confidence
heuristic — out as unprotectable, while *Google v. Oracle* leaves verbatim
field-name/enum copying a fact-specific gamble; so reuse the algorithm/shape and
rename to repo idioms. agentmemory's DI/Layer patterns do not transfer regardless
(bespoke iii-sdk), and its `parseTemporalGraphXml` regex must be dropped for lack of
char-span grounding — reuse the prompt *shape* only.

**Status:** open (for /grill-with-docs)

## Q2: What does this packet own versus consume or defer?

**Recommended:** This packet **OWNS** the durable bitemporal versioned-edge store,
the claim disposition axis (active / rejected / superseded / conflicted), the
four-tier `ConsolidationTier` (reconciled with the binding taxonomy), the
retention/decay scoring + hot/warm/cold/evictable eviction, the two-axis as-of read,
and the pre-fusion (per-tier candidate generation, retention-weighted recall) +
post-fusion (session diversification, conflict/supersede filtering) edges of
retrieval. It **CONSUMES** the scored 3-channel RRF fuser (k=60) from
`explorations/rag-retrieval-projection` — the single RRF owner — supplying the
bitemporal-edge graph stream and reading span-carrying fused hits. It **DEFERS** the
FalkorDB / GraphRAG persistent projection + extraction-pipeline port to
`goals/trustgraph-port`. Do **not** build a third RRF; the graph stream's intrinsic
ranking signal (BFS distance? edge weight? recency?) is an upstream open question
owned by the RRF packet.

**Rationale:** RESEARCH "Routing cautions" + the designated-RRF-owner finding fix
this ownership; `standards/memory-architecture/05` fixes durable-truth-repo-native
vs projections/caches ("the boundary is not graph-or-no-graph, it is authority or
projection"); the completed `epistemic-claim-lifecycle-gate` explicitly deferred this
exact scope (FalkorDB, GraphRAG, bitemporal store). Getting the boundary wrong
duplicates retrieval infrastructure across three packets — the most expensive error
available here.

**Status:** open (for /grill-with-docs)

## Q3: What is the first shippable slice?

**Recommended:** Ship the **durable-truth core first**: the bitemporal versioned-edge
store (four temporal fields, `supersededBy`/`isLatest`, `sourceObservationIds`,
`EdgeContext`) + the slice-local disposition axis (active / rejected / superseded) +
the two-axis `asOf(validAt, recordedAt?)` read — wired so a rejected/superseded
claim finally has a durable place to land (today `ClaimLifecycle.service.ts:73`
branches on `verdict === "rejected"` and treats it as a silent no-op). Sequence
retention tiers / decay + `ConsolidationTier` as a **second** slice, and RRF
consumption (which depends on `rag-retrieval-projection` landing) as a **third**.

**Rationale:** `standards/memory-architecture/05` ranks durable truth as repo-native
and load-bearing, while retention tiers/decay are rebuildable projections — so the
irreversible, correctness-critical schema lands first under proof, and the
projections can be rebuilt and re-tuned later. The disposition gap is the smallest,
highest-value closure of an already-shipped epistemic spine (CandidateClaim +
Evidence + ClaimLifecycle + ClaimGate), not a greenfield megaproject.

**Status:** open (for /grill-with-docs)

## Q4: Where does durable truth live, and do we admit any external graph vendor for it?

**Recommended:** Durable truth lives in **Postgres, repo-native**, via
`@beep/epistemic-tables` (which today materializes only `UsageRecord`) + `@beep/drizzle`
— no external graph vendor (FalkorDB / Neo4j) is ever authoritative. FalkorDB /
GraphRAG is admitted only as a **rebuildable projection / cache owned by
`goals/trustgraph-port`**, never as system of record. LLM-extracted edges and
embeddings are **candidates until gated**; reuse the repo's existing LLM service
wiring + structured output (BAML / Standard-Schema) with `EvidenceSpan` char-span
grounding — do **not** import agentmemory's Anthropic-SDK extraction or its brittle
`parseTemporalGraphXml`. No new external auth surface is introduced for the durable
store; the only "auth" gate is the existing human-in-the-loop disposition decision.

**Rationale:** `standards/memory-architecture/05` sets the authority rule explicitly
and is settled — do not re-argue graph-vs-no-graph. agentmemory's KV-JSON temporal
layer forces full-scan time-queries (second-source critique), so the ported shape
must be backed by indexed relational/temporal columns. Char-span grounding
(`TextAnchorFields` / `EvidenceSpan`) is a repo invariant the donor regex lacks —
every fused/conflict hit must carry an anchor, never a bare chunk.

**Status:** open (for /grill-with-docs)

## Q5: Where does the new code live, and is the disposition axis shared-kernel or slice-local?

**Recommended:** All new code lands in the **epistemic slice**, graduating into a NEW
goal: the versioned-edge table in `@beep/epistemic-tables`; the value/entity models
(a `BitemporalFields` mixin following the `EvidenceSpan` / `TextAnchorFields` spread
idiom, the edge entity via `BaseEntity.Class` + `persist.jsonb`, `ConsolidationTier`,
and the retention sidecar) in `@beep/epistemic-domain`; and the transition / eviction
services in `@beep/epistemic-use-cases`. The disposition axis is a **new slice-local
`ClaimDisposition` / `ClaimTruthStatus`** (`LiteralKit(["active","rejected","superseded","conflicted"])`)
wired beside `lifecycle` on the claim/edge projection — **NOT** folded into the
shared-kernel `ClaimLifecycle`. `ConsolidationTier` is net-new but must reconcile with
`standards/memory-architecture/01` (4-LAYER + No-Escape Theorem), not adopt
agentmemory's enum raw. Mutable retention counters (`accessCount` / `strength` /
`RetentionScore`) live in a **separate sidecar row keyed by claimId**, never written
onto the immutable `Evidence` / `CandidateClaim` values.

**Rationale:** RESEARCH "Locked decisions" — `ClaimLifecycle` is a cross-slice
shared-kernel enum load-bearing in ≥2 slices today (`CandidateClaim.model.ts:36`,
`Distinction.model.ts:44`); widening it in place mutates a completed-retained
contract consumed outside this packet and conflates workflow-*progress* with
truth-*state*. The shared-kernel guide says keep evolving semantics slice-local until
multiple slices agree. The never-overwrite invariant forbids mutable counters on
immutable values.

**Status:** open (for /grill-with-docs)

## Q6: Do we persist an explicit CONTRADICTS edge, or rely on implicit invalidation only?

**Recommended:** **Keep both.** Persist an explicit, confidence-weighted `CONTRADICTS`
edge (the queryable redline-gate signal, agentmemory style) AND a `supersededBy`
lineage pointer with bitemporal invalidation (the store mechanic, Graphiti style).
Detection compares a new edge against related existing edges (semantic + keyword +
graph search); resolution closes valid-time via invalidation and never deletes. The
contradiction signal is an explainable *triage* input to the human gate (relation
heuristic: `supersedes +0.1`, `contradicts −0.05`), not an auto-decider.

**Rationale:** This is a genuine design fork, not a settled standard — agentmemory
persists a contradicts edge; Graphiti persists none (it only invalidates). RESEARCH
recommends "keep both" because the two serve different consumers: `CONTRADICTS` is
the queryable retrieval/gate signal, `supersededBy` is the lineage mechanic; the
doc-haus corpus adds per-anchor conflict detection (same anchor AND clause-scope OR
overlapping find-text) with an honest `resolved | ambiguous | unmatched` report and a
transitive cycle guard. RESEARCH "Open / unverified" flags this explicitly as a
recommendation to ratify — hence a grilling target.

**Status:** open (for /grill-with-docs)

## Q7: How are the bitemporal no-overlap / supersession invariants enforced, and how are open intervals represented?

**Recommended:** Represent open intervals with **Effect-Schema `Option` / half-open
intervals, not magic sentinels** — port courts-db's inclusive comparison but drop its
`1600-01-01` / `2100-01-01` substitution. Enforce the no-overlap + supersession +
cycle-guard invariants in **Effect services first** (there is no observed
`@beep/drizzle` period-overlap-exclusion helper today), backed by btree / gin /
unique indexes, and leave a documented path to Postgres exclusion constraints once a
drizzle helper exists. Lock the Graphiti supersede rule as a correctness invariant:
set the superseded edge's `invalid_at` to the invalidating edge's `valid_at`
(valid-time), and move `expired_at` to now (transaction-time) — `invalid_at = now()`
is a bug that corrupts as-of-valid queries.

**Rationale:** Codex gate-1 flagged the bitemporal storage contract as unspecified and
must-settle: the owner must define table owner + fields, open-interval representation,
btree/gin/unique index plan, the `asOf(validAt, recordedAt?)` two-axis query shape,
the no-overlap + cycle-guard policy, the migration path, and **where** invariants live
(Postgres constraints vs Effect services). Fowler's two-parameter as-of query and the
locked Graphiti gotcha are the correctness anchors; sentinels silently corrupt
as-of-valid reads.

**Status:** open (for /grill-with-docs)

---

## Carried into shape (not branch-closing forks)

Tunables / proof obligations the grilling need not resolve, but the goal must address
in shape/decompose:

- **Decay tuning.** agentmemory's hand-picked `λ=0.01` (≈69-day half-life, slow
  semantic tier), `σ=0.3`, thresholds `{0.7,0.4,0.15}` almost certainly need a
  tier-specific `λ` for working/episodic; `strength` is vestigial in the verbatim
  scorer and the MemoryBank `S+=1; t=0` spacing-aware reinforcement is better-grounded
  than `1/Δt` if `strength` must move retention. Separate "hotness" (recency) from
  "durability" (well-spaced strength).
- **Acceptance gates (Codex gate-1).** Before graduation, define datasets/fixtures +
  thresholds + proof commands for: bitemporal as-of correctness, stale-vs-fresh
  retrieval, conflict/supersession, eviction-pressure predictability, RRF
  empty-channel cases, and token-savings — so "better memory" ships as proven
  behavior on a change that touches durable memory semantics.
