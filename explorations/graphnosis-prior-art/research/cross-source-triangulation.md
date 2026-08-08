# Triangulation — RAPTOR, Chronocept, the two Graphnosis papers, the Graphnosis code, and beep-effect

Sources on disk: `survey-*.md` (8), `map-*.md` (8), `paper-{whitepaper,trained-skills,raptor,chronocept}.md`,
`paper-map-*.md` (4), `INDEX-repo.json`.
Repos: beep-effect `/home/elpresidank/YeeBois/projects/beep-effect15` @ `d1dfc4b3c1` (main, clean);
Graphnosis `/home/elpresidank/YeeBois/dev/Graphnosis` v0.11.0 @ `7a19c4b8`.
Date: 2026-08-06. Every Graphnosis `file:line` below was re-verified live in this session, not taken
from the notes.

---

## 1. RAPTOR vs the dual graph

### 1.1 They are not competitors. They are not even the same kind of object.

The framing "a recursive summary tree and a typed knowledge graph are two answers to the same
question" is the first thing to discard. They answer different questions and they sit at different
layers of the stack:

- **RAPTOR is an offline corpus-augmentation procedure.** At query time, collapsed-tree RAPTOR —
  the configuration that wins in the paper's own Figure 3 and is used for *every* main result — is
  exactly an ANN search over `all_nodes` plus a greedy token-budget fill. No tree walk, no
  traversal, no multi-hop (`paper-raptor.md` §3.4). The tree is the factory; adaptive granularity
  is the product. Summary nodes are just more documents carrying a `layer` and `childIds`.
- **The dual graph is a runtime traversal structure.** Graphnosis's contribution is that directed
  and undirected edges are co-equal, independently-queryable classes over one node set —
  `directedEdges: Map<EdgeId, DirectedEdge>` and `undirectedEdges: Map<EdgeId, UndirectedEdge>` as
  two maps over one node map (`src/core/types.ts:182-183`, verified) — with a guarded-max score
  write during traversal (`src/core/query/traverser.ts:365-369`).

So the honest first answer is: **you do not pick one.** You pick whether you want an augmented
candidate pool (RAPTOR), a traversal channel (graph), or both — and in beep-effect's ratified
architecture both are *channels*, which is a third thing neither paper describes.

### 1.2 Where each wins

**RAPTOR wins** (`paper-raptor.md` §8.2):

| Query shape | Why the tree wins |
|---|---|
| Gestalt / thematic ("what is the central theme") | The answer exists in no chunk and on no edge path. A summary node *contains* it verbatim. A graph walk has nowhere to walk to. |
| Narrative multi-hop (temporal arcs) | Entity-relation edges encode joins, not arcs. A summary stitches the arc. |
| Zero-schema corpora | One summarization pass. No extraction, no ontology, no relation typing, no disambiguation, no coreference. |
| Latency | One ANN query vs k rounds of neighborhood expansion. |

**The graph wins** (`paper-raptor.md` §8.3) — and note that every row here is a beep-effect product
requirement, not a nice-to-have:

| Query shape | Why the graph wins |
|---|---|
| Precise relational multi-hop ("which claims of patent X cite prior art assigned to Y") | The answer is a join over typed edges. A 131-token abstractive summary at 72% compression will not preserve it (Appendix C, Table 10). |
| Provenance and attribution | A summary node is derived text with a **4% hallucination rate** (Appendix E) — including a *fabricated relation*, "Ajor, Co-Tan's sister". The paper never evaluates provenance despite `children` making it trivial. |
| Incremental update | RAPTOR is a batch build. UMAP + GMM + BIC are **global fits over the whole layer**; adding one document changes the clustering, which changes every summary above it. The paper does not mention this once. |
| Cross-document / coreference | All RAPTOR experiments are effectively per-document trees. "Corpus" in the paper means one long document. RAPTOR has no coreference notion. |
| Contradiction and temporality | Summarization silently smooths conflicting sources into one fluent paragraph. A graph carries contradictory edges with distinct provenance. |

### 1.3 Cost, honestly

RAPTOR's build cost is **not** the blocker, and the mining note is right to say so:

- Build tokens: ~**1.3–2× corpus token count**, one pass, through a cheap model (`gpt-3.5-turbo` in
  the paper) — Figure 5, `paper-raptor.md` §4.1.
- Index growth: branching factor 6.7 ⇒ total nodes ≈ `1.18 × n_leaves`. **~18% larger index**
  (Appendix C, Table 10 → §4.3). Vector-store cost, ANN latency and memory are all ~18% deltas.
- Query cost: **unchanged**. Zero extra inference tokens at query time (§4.4). For a
  high-query-volume system that is the right place to have moved the cost.
- Build latency: ~20 ms/input token serially ⇒ ~25–30 min for an 80k-token document on one laptop
  — but it is embarrassingly parallel within a layer and the authors did not parallelize. Not a
  fundamental cost (§4.2).

What *is* expensive is the part the authors' own ablation prices at **0.8 accuracy points**
(Table 9, Appendix B: 56.6 vs 55.8): the UMAP + GMM + BIC clustering pipeline. That is the most
complex, most non-deterministic, most globally-coupled, and **least incrementally-updatable** part
of the system. Table 9 is the license to throw it away and use contiguous windows, or graph
communities, or anything else reasonable.

And the headline is a confound: the +20.3-point QuALITY number is `RAPTOR + GPT-4` vs
`CoLISA + DeBERTaV3-large`. The only place retrieval is isolated is Table 4 (dev set, GPT-3 reader),
where RAPTOR beats DPR by **2.0 points** (`paper-raptor.md` §7.1). The defensible
retrieval-attributable effect across every controlled comparison is **+0.5 to +4.4 vs the same
retriever without the tree**, and +1.8 to +10.2 vs DPR/BM25 at equal reader and equal token budget.
Reliably positive, never transformative. Budget engineering effort against ~2–4 points, not 20.

Against Graphnosis's doctrine: Graphnosis's whole position is a deterministic core with LLM strictly
optional, cached, pinnable. It removed the recency multiplier rather than flag it —
`CHANGELOG.md` v0.8.0: *"Retrieval is a pure function of `(graph, query)` … recency scoring is
removed, not made optional: an option would only relocate the non-determinism behind a flag."*
RAPTOR is unapologetically LLM-dependent **at index time**. That is a real doctrinal collision and
it is adjudicated in §4 below (D3).

### 1.4 Do they compose? Yes — but not the way the question frames it

**"Tree levels as node types" — no.** Do not put summary nodes in the epistemic graph as a node
type. Two reasons, both structural in beep-effect today:

1. `TextChunk` requires a **mandatory, non-optional** `span`
   (`packages/foundation/modeling/nlp/src/Handoff/Contract.ts:321-332`, verified), and `ChunkKind`
   is a *structural* granularity vocabulary — `LiteralKit(["document","paragraph","sentence","token"])`
   at `Contract.ts:183-185`. A RAPTOR summary node is not a contiguous slice of any source, so it
   cannot be a `TextChunk`. RAPTOR's `layer` is an orthogonal axis to `ChunkKind`, not a new member
   of it.
2. `EdgeRelation` is `LiteralKit(["supports","refutes","contradicts"])`
   (`packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts:13`) — a closed,
   *authority-bearing* vocabulary on a bitemporal edge. A `summarizes` edge is not an epistemic
   assertion and does not belong in that domain.

**"Graph walk seeded by tree-level retrieval" — yes, and this one is already validated by shipped
code.** Graphnosis's actual pipeline is TF-IDF seeding *then* traversal, not pure vector search
(`survey-retrieval.md` §7). The seeded-walk shape is proven; RAPTOR simply supplies better seeds
for thematic queries. But that is a **seeding policy inside the graph channel's producer**, which
`goals/hybrid-retrieval-fusion-core/SPEC.md` constraint 11 explicitly pushes out of the fusion core
("Keep graph input optional and rank-only. No graph producer, BFS, driver, or authority behavior
enters this goal"). It lands on the queued `citation-graph-retrieval-channel`, not here.

**The composition that is actually right for beep-effect is at the fusion layer, in three tiers:**

| Tier | Mechanism | Cost |
|---|---|---|
| Index | Summary nodes live in the **same** vector store as leaves, same encoder, same space (RAPTOR embeds all nodes with one SBERT model — `paper-raptor.md` §2.2), carrying `layer` and `childIds`. ~18% index growth. | Needs a vector store. beep has none (§1.5). |
| Fusion | A **leaf channel** and a **summary channel** as two *named ranked channels* with explicit weights under the existing weighted RRF. This gives the thematic:granular knob Figure 3 says matters — but *tuned*, rather than hard-coded the way tree traversal hard-codes it via fixed `(d,k)`. | **Zero new machinery.** The channel contract already names channels; two names is not a schema change. |
| Admission | A summary hit **resolves down through `childIds` to leaf spans before display**, and only leaf spans are citable. The paper leaves this on the table — provenance is "structurally available but never evaluated". | This is the seam beep's verbatim firewall already forces. |

RAPTOR's Algorithm 2 token-budget greedy fill is a **reranker-adjacent packing step**, not a
retrieval step. It belongs after fusion, never inside it.

### 1.5 What should change about `goals/hybrid-retrieval-fusion-core`

First, ground truth, because the packet reads as shipped and is not: `MAP.md:7` says
"**GRADUATED 2026-07-14**", `ops/manifest.json` says `status: active`, `goals/INDEX.md:24` says
0/4 phases, and `rg -i '\brrf\b|reciprocalRank|fuseRanked' packages/**/src/**` returns **nothing**
(`paper-map-raptor.md` §2, friction receipt 2). Nothing is implemented. Also: there is no vector
index, no local encoder, and no embedding driver in `packages/**/src` — the only live embedding
surface is the *hosted* `packages/drivers/venice-ai/src/VeniceAI.service.ts:1117-1123`, which the
locked "zero external egress" encoder decision rules out for privileged text
(`paper-map-raptor.md` §3). RAPTOR's entire query-time substrate is two queued satellites away
(`retrieval-vector-projection`, `retrieval-local-encoder`).

**Recommendation: neither source should change the fusion core's architecture. Two should change
its wording, and one of those is the highest-value single edit available.**

**R1 — Do not add RAPTOR to this packet. (from RAPTOR)**
Adding summary nodes now is designing for a store that does not exist. There is nothing to augment.

**R2 — State the derived-candidate exclusion as a deliberate Non-Goal, not an emergent consequence. (from RAPTOR)**
Constraint 7 — *"Every result preserves its pre-verified `TextAnchor`. Fusion neither invents nor
repairs spans"* — plus the acceptance criterion *"A pre-verified `TextAnchor` remains byte-for-byte
equivalent and internally consistent after fusion"* already make abstractive summary nodes
**structurally inadmissible** to the candidate pool. That is the correct default for an IP-law
product. But it is currently a *side effect* of a span-preservation rule, which means a future
summary or community-summary channel will be discovered to be illegal only after it has been built.
Add one line to Non-Goals: *derived, non-contiguous candidates (abstractive summary nodes,
community summaries) are out of scope; a candidate without a pre-verified `TextAnchor` cannot enter
the pool.* This also pre-decides the GraphRAG community-summary question, which the repo has
already rejected once —
`explorations/legal-ontology-landscape/research/04-ontology-informed-extraction.md:49`:
*"Generic GraphRAG community summaries as legal fact authority — verdict: reject."*
Cost: one sentence. Value: it converts an accident into a decision.

**R3 — Name the tie-break comparator on provenance. (from Graphnosis)** *Highest value.*
Constraint 5 requires *"one documented stable comparator independent of map iteration order"* and
**never says on what**. This is precisely the bug Graphnosis shipped, measured, and fixed
(`survey-retrieval.md` §1; `map-retrieval.md` §1). beep already owns a better brick than Graphnosis's
`{file, offset, hash}`: `SourceTextIdentity` with seven required fields including `extractor` and
`normalizationVersion` (`packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:119-145`),
so two ingests under different extractors are *distinguishable* rather than silently equal. The
missing piece is that no comparator in the repo is keyed on provenance, and the one live scored
ranking ties on pool-construction order — `packages/drivers/wink/src/WinkCorpus.service.ts:780-786`
sorts by `ascendingNumber((entry) => entry.index)`, the document's position in the compiled corpus.
Define `Order.Order` over `(locator, startChar, textDigest)` — all three recomputed identically from
the same input, none a surrogate — in `@beep/provenance`, and make SPEC-5 name it.

**R4 — Record the guarded-max rule now, in the graph channel's spec, while it costs one sentence. (from Graphnosis)**
The whitepaper's best-evidenced number decomposes the +13.2-point graph advantage as
**structure +7.2, max-wins scoring rule +6.0** (§12.4, Figure 5; answer model and TF-IDF seed pool
held fixed across arms). Nearly half the graph's advantage is `base(v) ← max(base(v), x)` rather
than `+=` — three lines of code with a proved degree-independence property. Mechanism:
additive/spreading-activation accumulation lets a high-degree but irrelevant node gather score in
proportion to its degree; max cannot, so retrieval surfaces the strongest evidence *chain* rather
than the best-connected *node*. This belongs in `citation-graph-retrieval-channel`, not the fusion
core (constraint 11 keeps graph rank-only).

**R5 — Make the ablation arms typed options on the fusion input, not ambient config. (from Graphnosis)**
Graphnosis replaced `GNOSIS_SCORE_RULE` with a typed `scoreRule?: 'max-wins' | 'additive'` option
(`traverser.ts:29`, with the env read surviving only as a fallback at `:208-210`) because an ambient
variable made scoring impure and invalidated published golden vectors. beep already bans ambient env
in domain slices — zero real `process.env` reads across `packages/{epistemic,ontology,law-practice,documents,agents}`
— so the mechanism half is law. The missing half: the fusion core's *own* ablation arms (weight
vectors, `k`, literal-tier on/off) should be typed options on the fusion input so a caller can
reproduce a published ranking. That is what makes
`explorations/rag-retrieval-projection/MAP.md`'s "Fusion weights need representative-corpus
calibration after the core seam lands" executable later instead of a rerun-and-hope.

**R6 — No change to contribution accounting.** Constraint 6 (contributions name their channel and
expose rank, configured/effective weight, RRF component, and weighted contribution; the
deterministic sum equals the fused score) is a **stronger audit surface than anything in the
Graphnosis engine**. Leave it.

**R7 — Graph-derived synonym expansion is the most portable idea in the whitepaper, and it is not a
fusion-core change.** `src/core/query/synonym-expander.ts:41-42` (verified): for each `similar-to`
or `shares-entity` edge with `weight ≥ 0.4`, cross-pollinate endpoint entities, accumulate by edge
weight, memoize in a `WeakMap` keyed on the graph's mutation signature (`:19`) — hence
`synonymMapBuildMedian: 0` in the committed benchmark. "Acme" → "ACME Inc" because they recur on the
same edges *in this corpus*, not because a dictionary says so. Zero model cost, corpus-specific
vocabulary. For an IP-law corpus (assignee name variants, inventor spellings, docket aliases) this
is genuinely attractive. Land it as a queued satellite on `explorations/rag-retrieval-projection`,
upstream of the channels, with the regex-injection and Unicode hazards from `survey-retrieval.md`
§11 attached to the ticket.

**If RAPTOR ever graduates**, build the v0 the mining note specifies (`paper-raptor.md` §8.5) and
nothing more: reuse the existing sentence-safe chunker
(`packages/foundation/capability/nlp-processing/src/Tools/ChunkBySentences.ts` — the char-budgeted
analogue of RAPTOR's 100-token sentence-safe splitter), one summarization pass over **contiguous
windows of ~7 chunks** (no UMAP, no GMM, no BIC), write summary nodes into the vector store with
`layer=1` and `childIds`, add a `layer` feature for fusion weighting. ~15% index growth, ~1.2×
corpus tokens, and — the decisive property — **fully incremental**, because contiguous windows are
local, so inserting a document rebuilds only its own summaries. Depth 2 only; depth 3 only for
book-length inputs. Do not build the clustering pipeline.

---

## 2. Chronocept vs bitemporal edges

**No. And stronger than "orthogonal" — Chronocept's temporal object is strictly *below* what
beep-effect shipped.** Three independent reasons, from `paper-map-chronocept.md`:

1. **One axis, not two, and the one it has is relative.** Chronocept has a single anchor
   (publication instant) and one relative axis. beep's `EdgeVersion` carries two half-open absolute
   axes — `[validFrom, validTo)` valid-time and `[recordedAt, expiredAt)` transaction-time, BIGINT
   epoch millis, absent upper bound as `Option.none`, *"no magic sentinel dates and no persisted
   `isLatest` flag, because 'latest' is a question you ask the axes, not a fact you store"*
   (`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:1-12`, verified
   verbatim). The read surface ships end-to-end: `readAsOf(query: EdgeAsOfQuery)` / `readLatest` /
   `record` / `supersede` at
   `packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts:61-66`, with
   `asOfWhere(logicalKey, validAt, knownAt)` in the repo, through RPC and atoms to UI.
2. **Unimodality forbids the shape IP law actually has.** Chronocept's skew-normal validity curve is
   unimodal by construction. beep's no-overlap-per-logical-key invariant permits **gaps** — so
   "valid, then invalid, then valid again" (lapse → reinstatement, term → renewal, abandonment →
   revival) is expressible as multiple rows with disjoint valid intervals. Chronocept cannot
   represent it at all.
3. **beep's own open temporal question is a refinement Chronocept never approaches.**
   `explorations/epistemic-belief-view-revision/CAPTURE.md`: *"Legal multitemporality
   (enforceability/efficacy/applicability) is explicitly NOT collapsed into the two core axes."*
   `academia-corpus-mining/research/t3-master-synthesis.md` finding 4 names the work: `validAt` does
   not collapse applicability, efficacy, enforceability, or procedural effect; `knownAt` does not
   mean observation, arrival, access, release, or model-trust time; build legal multitemporality as
   a composed downstream layer. `legal-multitemporal-validity` is a routed-but-unopened packet.

beep is also ahead on spans: Chronocept's released JSON is eight fixed string keys with empty
strings for absent axes, non-contiguous segments concatenated, **no offsets**. beep's
`EvidenceSpan` carries `startChar`/`endChar` as `NonNegativeInt` plus an exact bounded `quote`, with
`TextAnchorWidthCheck` tying `endChar − startChar` to the quote length
(`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts`).

**Three things survive the crossing, none of them the temporal object:**

- **The MATRES eight-axis modality taxonomy** (Ning et al. 2018 — *not* Chronocept's contribution;
  Chronocept borrows it). It lands on a slot that is explicitly named and explicitly empty:
  `explorations/epistemic-belief-view-revision/CAPTURE.md:45-49` Q1 lists "**semantic stance**"
  among the typed verdict families needing canonical names/owners. The nearest existing thing,
  `PracticeKgEpistemicStatus = LiteralKit(["derived-from-official-records","candidate-unreviewed"])`,
  is a *source-authority* label, orthogonal to speech-act modality. **Where it must not land:**
  `goals/epistemic-contradiction-triage` — its own SPEC Non-Goals ban detection heuristics/NLP and
  its PLAN says "add detection heuristics/NLP — stop and re-scope".
- **An anti-adoption citation against age-based confidence decay.** Table 11: exponential/memoryless
  decay is the *worst* family tested, RMSE 0.21–0.27 vs 0.02–0.05 for Gaussian/log-normal/gamma/
  skew-normal — a factor of 4–10. The live target is in the sibling repo:
  `Graphnosis/src/core/optimization/reflection.ts:262-292` `decayConfidence`, whose own docstring
  admits it "compounds on every pass" and measured "**age, not disuse**". beep has no decay anywhere
  in the epistemic packages (`rg -i 'staleness|decay|half-life' packages/**/src` returns only CLI
  goal-staleness and an unrelated `1/(1+violations)` score). So this is a **do-not-add receipt**,
  not a repair.
- **The shuffle/permutation control.** `goals/coding-agent-effectiveness-evidence-loop` has
  ablation-by-removal (a `memory-ablation` profile) but no *shuffle* arm — keep the structured input
  present, scramble its order. Removal proves the input matters; shuffle proves its *structure*
  matters. Also missing: any rule that reported metrics be algebraically independent, and any
  seeds/CI requirement on a lift claim.

**Licensing:** arXiv:2505.07637v1, **no venue printed**, dataset CC-BY-4.0, **code license absent**
⇒ reference-only under the repo's own `research/SOURCES.md` RULES block. Cite MATRES to Ning et al.
2018, not to Chronocept.

---

## 3. Papers vs the shipped engine

**Headline.** The Apache-2.0 artifact `@nehloo/graphnosis` v0.11.0 is *a deterministic dual-graph
retrieval engine with a reflection-based contradiction scanner*. The "un-brain" proper —
indelibility **enforcement**, encryption, op-log sync, `recall_as_of`, the promotion gate, the
neural/LLM overlays, the determinism-tier labels, the token boundary, and the adjudication queue
itself — is in the FSL packages or nowhere. **Roughly half the paper's guarantees are not in the
open artifact.** §15 says so; a reader skimming §1.1 will not notice.

`SPEC.md:334` (verified): *"**Status: PROPOSAL. Nothing here is implemented.** v1 is what the
reference…"* — everything under SPEC §8 is a proposal by the spec's own header.

### 3.1 SHIPPED

| Paper mechanism | Status | Evidence |
|---|---|---|
| Two edge maps over one node map (the dual graph as a *type*) | **SHIPPED** | `src/core/types.ts:79` (16 `DirectedEdgeType`), `:101` (7 `UndirectedEdgeType`), `:182-183` (`directedEdges` / `undirectedEdges` as separate `Map`s over one node map) |
| Guarded-max score write / degree-independence (Theorem 3's *write rule*) | **SHIPPED** | `src/core/query/traverser.ts:365-369` — `if (neighborScore > existing) nodeScores.set(edge.to, neighborScore)`; same guarded-max shape at the backward-directed (`:385-389`) and undirected (`:402-406`) sites |
| Ablation as a typed option rather than ambient env | **SHIPPED** | `traverser.ts:29` `scoreRule?: 'max-wins' \| 'additive'`; env read demoted to a fallback at `:208-210` |
| Graph-derived query expansion (corpus-mined synonyms) | **SHIPPED** | `src/core/query/synonym-expander.ts:41-42` (type filter + `weight < 0.4` reject), `WeakMap` memo at `:19` |
| Model-free contradiction detection, Path 2 | **SHIPPED** | `src/core/optimization/reflection.ts:104-191` — entity Jaccard > 0.6 ∧ TF-IDF cosine < 0.15 ∧ a 9-regex lexical conflict bank, both sides ≥ 80 chars; writes a `contradicts` edge at w=0.7 |
| Observation-1 (dual-graph coverage) harness | **SHIPPED, deterministic** | `tests/bench/dual-graph-and-recall.ts`, seeded `mulberry32(42)`, no network/LLM; committed result `benchmarks/dual-graph-and-recall.json` (`pctOverlap: 8.4`, `medianReachDirected: 3`, `medianReachUndirected: 90.5`, `medianReachUnion: 107`) |
| Definition 1 scoring, minus recency | **SHIPPED (partial by design)** | `traverser.ts:444-465` implements f(v) accessCount tiers, conf(v) `multiplier *= node.confidence`, e(v) `×0.3` on expiry |

### 3.2 DIVERGED — the papers predate HEAD, in both directions

| Claim | Drift |
|---|---|
| **Theorem 3, global path-maximum** | **Did not hold in the benchmarked code.** `benchmarks/evidence/manifest.json` → `traversal_order`: every run was under the pre-0.10.0 **FIFO** frontier. `CHANGELOG.md` v0.10.0: *"The paper states that a node's score is the maximum over all paths reaching it. The FIFO frontier did not deliver that… On the reference 5-node chain the successor scored **0.0216** where the theorem requires **0.216**."* The default flipped to `best-first` in 0.10.0, altering output on ~**9%** of real multi-session queries, **6%** returning a different evidence set. Every published command now carries an explicit `--traversal-order fifo`. **The degree-independence claim survives intact** (the write is a `max`, never a sum, in every version) — and that is the claim the +6.0 ablation actually tests. Global path-optimality did not. |
| **Definition 1's recency multiplier r(v)** | **Removed after the paper.** `traverser.ts:432` comment: *"a ×1.3 boost for 'accessed within the last 24 hours' makes the same file and the same query rank differently on Tuesday than on Friday. That boost has been removed."* `CHANGELOG.md` v0.8.0: *"Retrieval is a pure function of `(graph, query)` … removed, not made optional: an option would only relocate the non-determinism behind a flag."* **This is the repo moving past the paper on the paper's own principle.** Port the v0.11.0 form, never the paper's. |
| **Appendix B's "sixteen and seven" taxonomy** | A **type union, not a census**. Only 11 of 16 directed and 3 of 7 undirected types are ever *emitted*. `causes`, `depends-on`, `works-with`, `reports-to`, `collaborated-on`, `prefers` are never produced; `causes`/`depends-on`/`supports` appear only in a *read* set for transitive inference (`reflection.ts:305`). The real dual graph is directed ≈ `{contains, precedes, summarizes}` + a thin tail, undirected ≈ `{similar-to, shares-entity, co-occurs}`. Overstates the populated taxonomy ~1.5–2×. |
| **Proposition 1 (δ = 0.03, ceiling c = 0.95)** | **PARTIAL.** `confidence.ts:83,86` has `CONFIDENCE_MIN = 0.01`, `CONFIDENCE_MAX = 1` and `clampConfidence`. The `+0.03` step exists **only as a caller pattern in a JSDoc example** (`:104`). No 0.95 node-confidence ceiling exists in the SDK. |
| **"Temporal decay is dormant by product design"** | Dormant because it was **destructive**: it keyed on `lastAccessedAt`, which nothing refreshed, so it measured age not disuse; it compounded per pass; the desktop host called `reflect()` every six hours, so a node older than a couple of months hit the 0.1 floor within a day; and `generateAuditReport` reached it, **so producing an audit mutated the data it audits**. |
| **"8–13% overlap"** | Only the **8.4%** end is reproducible from committed artifacts (the 45k graph). The 15k graph's JSON — source of the 13% end, the 53-node undirected reach, the 64-node union, and the 0.28 s recall — is **not committed**. |

### 3.3 PROPOSED-ONLY (`SPEC.md` §8, self-labeled "Nothing here is implemented")

- §8.1 — `(id, rev)` node identity, the prerequisite for merge.
- §8.2 — `maxAutonomy` authority ceiling; min-composition over member nodes; **absence is
  UNSPECIFIED, not unlimited**. Verified absent: `rg -ci maxAutonomy src/` → 0.
- §8.3 — Conformance levels L1 / L2 / L3.
- §8.4 — Skill subgraphs (i.e. the entire substrate the *trained-skills* paper is written about).
- §8.5 — Byte-level reproducibility.
- §8.6 — A merge algebra, explicitly disclaimed: *"The operation — commutative, associative,
  idempotent, proven over `(id, rev)` — is downstream and **is not claimed here**."*

### 3.4 ABSENT from the OSS SDK entirely (FSL packages or nowhere)

Every one of these I re-grepped this session; all returned **zero hits** in `src/`.

| Paper mechanism | § | Status |
|---|---|---|
| `recall_as_of` time-travel recall — the Theorem-1 corollary | §5.1, §11 | **ABSENT** (`recall_as_of`, `recallAsOf` → 0) |
| Deterministic triage: θ(σ, sig), severity low/med/high, `genuine_contradiction` / `temporal_supersession` / `negation_artifact`, four suppression lanes | §8.2, Def. 2 | **ABSENT** (`negation_artifact`, `temporal_supersession` → 0). Harness lives in the FSL app repo. |
| Path 1 (append-time detection) and Path 3 (policy rules) as distinct paths | §8.1 | **ABSENT** — only the reflection scan exists |
| Encrypted op-log; `(timestamp, deviceId, seq)` LWW merge — **Theorem 2 in full** | §11 | **ABSENT** (`deviceId`, `opLog` → 0). `confidence.ts:243`: *"This package has no op-log."* |
| XChaCha20-Poly1305 / Argon2id / Ed25519 at-rest encryption | §11 | **ABSENT** (`xchacha`, `argon2` → 0) |
| `.gnn` neural overlay / GNN-LP predictor; `.gll` local-LLM overlay; the promotion gate (Design Invariant 1) | §5.1, §10 | **ABSENT** |
| Five-tier determinism taxonomy "reported in each tool's description" | §4 | **ABSENT** — `src/mcp/server.ts:38-125` registers 5 tools; not one description carries a tier |
| ≤2,000-token curated subgraph as an *enforced* cap | §4, §15 | **NOT ENFORCED** — `src/core/query/subgraph-serializer.ts` is **116 lines** with no token counter and no truncation (verified). The bound is a soft consequence of `TOP_K_NODES=20`. Contrast beep, which *does* enforce: `packages/law-practice/server/src/PracticeKg.tool-handlers.ts:58-84` (`budgetBytes`, `estimateJsonSize`, `truncated`) plus `mcp-kit/FieldTier.ts` three-tier projection with a `FetchableHandle` escape valve. |

### 3.5 The trained-skills paper — same pattern, worse ratio

The entire procedural layer is outside the OSS SDK (SPEC §8.4 is a proposal). Verified absent in
`beep-effect` as well: `skill:seq|skill:loop|skill:branch`, `AutonomyLevel|maxAutonomy|dispatch-safe`,
`vitality|SkillHealth`, `retrainQueue|citedNode|RetrainReason`, `SkillExecutionPlan|walk_skill|SkillStep`,
`TriggerTable|triggerIndex|SkillTrigger` — all zero
(`paper-map-trained-skills.md` §0.3). beep's `Skill` entity is a **47-line stub** with two fields
(`packages/agents/domain/src/entities/Skill/Skill.model.ts`).

The paper's own disclosed defects matter more than its claims:

- **Lemma 1 idempotence bug.** The linker's delete predicate matched bare `skill:loop` but not the
  parameterized `skill:loop;max=N`, so capped-loop edges **accumulated across re-derivations** and
  the fixpoint failed silently, weakening Theorem 1 and Invariant 3 until caught. In beep, `S.TemplateLiteral`
  (13 live uses) makes that class of bug unrepresentable — this is a *law*, not a port.
- **The privacy hard-lock did not engage.** The planner supported it, but **no walker passed the
  per-step tier map**. A safety control that silently no-ops.
- **No taint propagation.** The lock is per-step only; content derived from a sensitive recall,
  captured into a variable, flowing to a later cloud-routed step is **not covered**.
- **Trust calibration:** three of five regression suites are not shipped and the two that are cannot
  be run standalone; all pass counts are internal CI records. Read the design claims, not the numbers.

The two privacy failures are exactly the two a beep-effect implementation would face, and they argue
for putting the check at the **egress boundary** — where `GovernedTierGate` already sits,
fail-closed and write-ahead — rather than in a planner.

---

## 4. Disagreements, and who is right for beep-effect

beep-effect's specific case: an IP-law knowledge product with hard provenance, citation grounding,
and determinism requirements, under a standing rule that pre-publication patent text never reaches a
cloud LLM.

### D1 — Fused ranking vs co-equal independently-queryable edge classes
**Graphnosis dissents against beep's ratified design.** §5.2 files RRF fusion (MAGMA, HAGE) under
"multi-relational but *fused*" and argues for keeping classes co-equal and independently queryable
instead. beep has already locked the other way:
`explorations/rag-retrieval-projection/DECISIONS.md` — *"LOCKED — RRF ownership: beep owns weighted
RRF; candidate engines emit ranked channels; none owns fusion policy"* — and
`hybrid-retrieval-fusion-core/SPEC.md` constraints 3/5/6.

**beep is right. Do not reopen.** The paper's evidence for its side is (a) Observation 1, which the
paper itself scopes as *"empirical rather than provable"*, measured on LongMemEval chat haystacks
rather than legal corpora, and of which **only the 8.4% end is reproducible** from committed
artifacts; and (b) a +6.0 ablation that is about **max-vs-additive within a traversal**, not
fusion-vs-co-equal. Reading it as evidence against RRF is a category error. Decisively: beep's
constraint 6 — per-channel contributions exposing rank, configured/effective weight, RRF component,
and weighted contribution, deterministically summing to the fused score — is an **auditability**
property that co-equal-classes does not provide, and auditability is the product requirement here,
not a preference.

### D2 — Summary nodes in the candidate pool vs the verbatim firewall
RAPTOR retrieves **non-leaf nodes 18–57% of the time** (Table 18) at a **4% summary hallucination
rate** including fabricated *relations* (Appendix E), and never evaluates provenance despite
`children` making it trivial. beep's `docs/product/citation-grounding.md` §2 "verbatim firewall":
*"Normalization may locate; it may not speak for the source… A quote crosses only when
`source.slice(start, end) === quote`."* And `goals/citation-verified-span-substrate/SPEC.md:15-19`
explicitly excludes "fuzzy, case-folded, or lesser-match authorization passes".

**beep is right, decisively.** A hallucinated *relation* in a patent context is malpractice-shaped,
not a relevance miss. But take the structural resolution the paper leaves on the table:
**RAPTOR is admissible as a recall device, never as an evidence device** — a summary hit must
resolve through `childIds` to leaf spans before display, and only leaf spans are citable.

### D3 — Where index-time LLM cost belongs
RAPTOR moves cost to build time and is unapologetically LLM-dependent at index time. Graphnosis's
doctrine is a deterministic core with LLM strictly optional, cached, and pinnable — and it *removed*
a non-deterministic multiplier rather than flag it.

**Graphnosis is right for beep — but not for the reason people assume.** The build cost is
affordable (1.3–2× corpus tokens, one cheap pass). The disqualifying property is
**non-reproducibility**: a summary node's *text* is a function of the summarizer model version, so
rebuilding the index with a different model changes what gets retrieved and what gets shown. That
breaks the golden-vector discipline the repo depends on and makes an as-of query over the index
unanswerable. If summary nodes are ever built, the summarizer identity must be **in the node's
digest** — precisely the rule `rag-retrieval-projection/DECISIONS.md` already imposes on embeddings
(*"store model identity on every projection, never mix same-dimension vectors from different models,
and rebuild the full projection on a model change"*).

### D4 — Batch build vs incremental ingestion
RAPTOR's global UMAP/GMM/BIC fits make adding one document change the clustering and therefore every
summary above it. **The paper does not mention this once.** A KG supports incremental insertion
natively.

**The graph side is right, and for beep this is disqualifying for canonical RAPTOR.** A live,
matter-scoped IP-law corpus receives documents continuously — office actions, prior art,
correspondence. beep already accepts full-rebuild semantics for exactly **one** trigger (embedding
model change); RAPTOR would make *every document insert* a rebuild trigger, a categorically worse
regime, and `explorations/local-first-projection-sync` would inherit the pain. The contiguous-window
v0 is the only affordable form, because contiguous windows are **local**. Table 9 (clustering worth
0.8 points) is the authors' own license to make that swap.

### D5 — Tree depth: the paper vs its own tables
The paper concludes full-tree search beats layer-restricted search. Its own Tables 14 and 16
contradict that on **2 of 5 stories** (n=5, no error bars), and Tables 19–21 show layers ≥ 2 supply
**< 11% of retrieved nodes at best and < 4% typically**.

**The mining note is right against the paper: depth 2 unless the corpus is book-length.** Patent
specifications and file histories are long, but not book-length in the NarrativeQA sense (~430k
tokens).

### D6 — Confidence: reinforced/decayed vs a property of the evidence
Graphnosis reinforces confidence by access count and optionally decays by age. beep's `Confidence`
is a detector-supplied unit interval on `EvidenceSpan`, **never reinforced and never decayed** — a
property of the evidence, not of usage history.

**beep is right, and now has two independent citations.** Chronocept Table 11 prices memoryless
exponential decay as the worst family tested (RMSE 0.21–0.27 vs 0.02–0.05). Graphnosis's own
`decayConfidence` docstring is the field bug report. And Graphnosis's `SPEC.md` §6 concedes the
symmetric problem for reinforcement: *"`accessCount` is mutable state inside an otherwise
declarative file… two files with identical content can rank differently."*

### D7 — Where a determinism tier attaches
Graphnosis puts a five-tier determinism taxonomy in the MCP tool *description* (§4) — and does not
ship it (`src/mcp/server.ts:38-125`, no tier on any of the 5 tools). beep's `mcp-kit` has four MCP
hints (`ToolAnnotations.ts:43,46,53`; `SanitizedSpan.ts:246-249`) but no determinism/replayability
tier — and `idempotentHint` means "repeat calls add no effect", which is **not** "identical input →
identical result". `TierGate` is an *authority* axis; `FieldTier` is a *size/disclosure* axis.
Neither is determinism.

**Graphnosis's idea is right and beep should take it — but not its placement.** A description string
a client can ignore is not a contract. In beep's idiom the tier belongs on the operation as a
branded/phantom property of the Effect service method, so a caller that needs a replayable answer
cannot silently receive a non-replayable one. This is the one place where a mechanism *Graphnosis
never shipped* is worth shipping here.

### D8 — Adjudication (violent agreement, worth recording)
Graphnosis §14: *"What we claim is sharper than determinism: detection that surfaces the conflict
for the owner to adjudicate and never auto-resolves it. The adjudication contract, not determinism,
is the distinguishing commitment."* beep says the same thing in a schema annotation —
`packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:562-566`: *"Stable
detector or caller name; it identifies provenance, not authority"* — and in
`goals/epistemic-contradiction-triage/SPEC.md` Non-Goals: *"detection output is data, never an
authority write."*

**Both right; beep enforces it more strongly.** Graphnosis's guarantee is a *missing write path*;
beep's is table separation (`ContradictionCandidate` → `ContradictionDisposition`) plus a typed
verdict plus a write-ahead `ExecutionDecisionRecord` ledger. No change. Note the asymmetry the
epistemics map flags: beep's contradiction *detector* is a deliberate, acknowledged hole — Graphnosis
ships a model-free one (`reflection.ts:104-191`) that is a genuine donor when beep wants one.

### D9 — The trained-skills paper against itself: route judgment work to local models?
The routing arm claims 99.6% cost saving, achieved *precisely* by routing reasoning (51% of 809
steps) and writing (11%) to free local models. Its own E6 evaluation refutes it: blind,
position-counterbalanced, K=10 per capability — the local 14B held only on mechanical capabilities
(code 100%, structured-output 80%, extraction 70%) and **collapsed on judgment (reasoning 0%,
writing 0%, summarization 20%)**, while cheap *cloud* Haiku retained 75% overall and ≥60% in every
capability. The paper states the contradiction itself: *"realizing that saving without quality loss
is **not** established."*

**E6 is right; the routing arm is not.** This has a direct beep consequence, because it collides
with the OIP confidentiality rule: that rule *forces* local for pre-publication patent text, and E6
says local collapses exactly on judgment. The honest resolution is **a smaller scope for the local
step** — local for extraction, span location, structured output, classification; never local for
the judgment call — not "local for everything privileged". Any beep proposal that routes reasoning
to a local model inherits E6 as counter-evidence.

### D10 — Benchmark hygiene: the papers vs repo doctrine
RAPTOR's headline confounds retriever with reader (§7.1), and its "new SOTA METEOR" on NarrativeQA
is computed with a **modified evaluation script** compared against prior work computed with the
original (Appendix H) — the most serious methodological problem in that paper, unflagged by the
authors. The Graphnosis whitepaper is markedly more honest (it repeatedly undercuts its own headline
and its reproducibility bundle verifies), but its contradiction primitive is measured only against
sets the author or a model (GPT-5.5) authored.

**Repo doctrine already pre-empts both**, and it should be cited rather than re-derived:
`explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md:60-66` — report
exact-span and parent-region recall, retrieved-to-oracle gap, unsupported-context rejection,
latency, and abstention; *"Do not use KF1, perplexity, or overlap as an acceptance gate."*

**One thing to take wholesale:** Graphnosis's evidence-bundle discipline — per-run JSONL +
SHA-256 checksums + `manifest.json` carrying the exact command **plus a `command_provenance` field
stating how confident the author is that the recorded command is the one that ran**. That field
exists because the +6.0 arm records argv but not `GNOSIS_SCORE_RULE`, so the arm is identified by
its outcome (56.20%) rather than by provenance. beep has the same class of pain on record
(`yeet-verdict-misattribution`, `stale-artifact-false-greens`).

---

## 5. Net answer in one table

| Question | Verdict |
|---|---|
| RAPTOR vs dual graph — pick one? | **Neither.** RAPTOR is an offline candidate-pool augmentation; the dual graph is a runtime traversal channel. In beep's ratified architecture both are *channels* under weighted RRF. |
| Do they compose? | **Yes, at the fusion layer, not the node-type layer.** Leaf channel + summary channel + graph channel; summary hits resolve through `childIds` to leaf spans before display; token-budget packing after fusion. Tree-seeded graph walk is real but belongs in `citation-graph-retrieval-channel`. |
| Change `hybrid-retrieval-fusion-core`? | **No architecture change.** Two wording changes (R2 derived-candidate Non-Goal; R3 name the provenance comparator — highest value), plus R4/R5/R7 recorded on the queued satellites. |
| Chronocept vs bitemporal edges | **No — strictly below**, on all three of axis count, absolute-vs-relative anchoring, and multimodality. What survives is MATRES (not Chronocept's), a decay anti-adoption citation, and the shuffle-control gap. |
| Papers vs shipped code | The OSS SDK is **a deterministic dual-graph retrieval engine with a contradiction scanner**. `recall_as_of`, Theorem 2's op-log, encryption, overlays, the promotion gate, the §8.2 triage, determinism tiers, and the token cap are **absent**; all of SPEC §8 is **proposal**. Two shipped mechanisms have **moved past the paper** (recency removed; traversal default flipped, invalidating the published arms). |

---

## 6. Friction receipts for the packet ledger

1. **`goals/hybrid-retrieval-fusion-core` reads as shipped and is not.** `MAP.md:7` says "GRADUATED
   2026-07-14", the manifest says `active`, `goals/INDEX.md:24` says 0/4, and `rg '\brrf\b'
   packages/**/src` is empty. "Graduated" means *an exploration produced a goal packet*, not *the
   packet shipped*. Prevention: treat exploration `MAP.md` status words as pointers to a manifest,
   never as implementation state.
2. **`rg -r` is `--replace`, not `--regexp`.** `rg -ril "raptor" .` silently replaced the pattern
   with `.` and matched every file in the repo — a near-miss false positive on the first search of a
   proof-is-the-point task. Prevention: always `rg -li`, never fold `-r` into a flag cluster.
3. **`map-retrieval.md` contains embedded NUL bytes** (offset ~5909), so `grep`/`rg` treat it as
   binary and silently return "binary file matches" instead of line hits — a heading scan returned
   nothing and looked like an empty file. Prevention: `tr -d '\0'` before scanning tool-generated
   markdown, or check `file` when a grep over a known-non-empty markdown file returns nothing.
