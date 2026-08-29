# Graphnosis whitepaper — "The Un-Brain" — full read notes

**Source PDF:** `/home/elpresidank/YeeBois/projects/beep-effect15/explorations/graphnosis-prior-art/assets/graphnosis-whitepaper.pdf`
(35 pages, created 2026-06-26)

**Full title:** *The Un-Brain: A local-first, indelible knowledge multi-graph for private AI memory
with deterministic, owner-adjudicated contradiction handling*

**Author:** Nelu Lazar. Affiliation: Nehloo Interactive LLC · Nehloo Foundation, Inc.
ORCID 0009-0008-5548-4109. **Status: Preprint** (not peer-reviewed).
**DOI: 10.5281/zenodo.20843387** — this is the paper the repo README points at.

**Artifacts named in the paper:**
- `@nehloo/graphnosis` — Apache-2.0, `github.com/nehloo/Graphnosis` (the local checkout at
  `/home/elpresidank/YeeBois/dev/Graphnosis`)
- `graphnosis-secure-sync` — source-available under the **Functional Source License**,
  `github.com/nehloo-interactive/graphnosis-secure-sync` (NOT in the local checkout)
- `graphnosis-app` — desktop app, also FSL (NOT in the local checkout)

**Local checkout inspected:** `@nehloo/graphnosis` **v0.11.0**, HEAD `7a19c4b8` (2026-08-04).
The paper describes the **v0.6.1–v0.7.3** line. That six-week gap matters and is the source of
several of the divergences recorded below.

---

## 1. The thesis, in one paragraph

An LLM has no state between sessions, so memory management falls on the human, who is a bad store
under load. The systems built to fix this inherit the *brain's* two silent failure modes:
**silent decay** (facts evicted, summarized away, or buried, with no record that anything was lost)
and — the paper's real target — **silent contradiction resolution** (a new statement disagrees with
a stored one and the system quietly overwrites, averages, or picks a winner, never telling the
owner their memory just changed its mind). The paper's claim: *a memory that silently rewrites
itself is more dangerous than no memory at all, precisely because it is trusted.*

The proposed object is an **un-brain**: keep the brain's cognitive virtues (association,
reinforcement, instant recall), invert its constraints (never decay, never silently reconcile).
Instantiated as Graphnosis, a local-first knowledge multi-graph.

**The load-bearing behavioral contract — the "adjudication contract":**

> "when a new statement conflicts with one already stored, Graphnosis does not overwrite it,
> average the two, or pick a winner: it records the conflict as a first-class, provenance-bearing
> relation, surfaces both sides at recall time, and stops. The resolution belongs to the owner, not
> the system — *you decide what the ground truth is*. This is a guarantee of **design**, not
> accuracy: there is no code path by which Graphnosis silently resolves a contradiction." (§1)

Restated in §16 as the closing claim: "no code path silently resolves a contradiction on the
owner's behalf. That guarantee holds by construction, independent of any benchmark, which is why no
answer-model confound can explain it away."

---

## 2. What it claims RAG / vector stores get wrong

§1: "This is deliberately **not retrieval-augmented generation**."

The argument, in the paper's own terms:

1. **RAG has no evolving knowledge state.** "Vanilla passage-retrieval RAG retrieves passages from
   a document corpus to condition a single generation; by itself it holds no evolving knowledge
   state, does not notice when two retrieved passages disagree, and carries nothing across calls
   (stateful RAG and agent-memory hybrids add some of this)." The inversion is *a persistent,
   owner-held knowledge state — typed, indelible, synchronized across devices, and actively checked
   for contradictions — that any model may query but none owns.* "Retrieval is one operation over
   that state, not its definition."
2. **Documents are the wrong encoding for a machine consumer.** The founding question was "whether
   knowledge could be encoded for its *consumer* — an AI traversing structure — rather than for a
   human reading a document," on the premise that "prose, transcripts, and PDFs are lossy and noisy
   for machine consumption." Hence the canonical layer is a machine-native encrypted binary
   (`.gai`).
3. **Long context is read unevenly.** Cites Liu et al. 2024's U-shaped *lost-in-the-middle* effect:
   "a long document is not only lossy to encode but poorly positioned to be read, whereas a small,
   dense, typed subgraph (the bounded ≤2,000-token excerpt of §4) presents the model with all the
   relevant facts, none in the middle."
4. **Embedding similarity is structurally incapable of the guarantee** — via a cited impossibility
   result (§13, Barman et al. 2026a, below).

The organizing principle: **"determinism first."** Every guarantee that bears on correctness —
indelibility, contradiction *surfacing*, conflict-free merge — is computed deterministically with
no model in the loop. Optional local-LLM and neural layers are additive, physically separate
files, removable at any time.

---

## 3. Contributions as the paper itself splits them

The paper splits **research contributions** (empirically testable or formally provable) from
**system/engineering contributions** (§1.1). Reproduced with my own ARGUED / MEASURED / ASSERTED tag:

| # | Contribution | Section | Status per the paper | My tag |
|---|---|---|---|---|
| 1 | Deterministic, owner-adjudicated contradiction detection — three-path consistency primitive, no model in the loop, surfaces rather than resolves | §8 | "an argued observation over the systems we examined, not a uniqueness claim" | **ARGUED**, with a *measured* routing benchmark (§12.6) |
| 2 | Two-stage precision/recall design for contradiction triage (high-precision ingest pass + recall-oriented reflection pass + deterministic admission filter) | §8 | design | **ARGUED / measured routing** |
| 3 | Node-set indelibility, formalized (Theorem 1) | §5 | "guarantees enforced *by construction*, not deep results" | **PROVED (trivially)** |
| 4 | Last-writer-wins determinism under a strict total order (Theorem 2) | §11 | ditto | **PROVED (standard)** |
| 5 | Hub-independent retrieval, formalized (Theorem 3); ablation attributes **+6.0 pts** | §7, §12.4 | proved + ablated | **PROVED + MEASURED** |
| 6 | Measured dual-graph coverage (Observation 1): only **8–13%** of directly-connected node pairs are joined by both edge classes | §5.2 | "empirical rather than provable: a measured, reproducible property" | **MEASURED** |

The paper is unusually candid about #3–#5: "Contributions 3–5 are guarantees enforced *by
construction*, not deep results; we formalize them because a memory substrate should be held to
them … not because the proofs are hard."

System/engineering contributions: strict promotion gate (Design Invariant 1); zero-API construction
pipeline; **graph-derived query expansion** (synonyms mined from the cortex's own similarity edges,
no thesaurus, no embedding model); a small feed-forward link predictor (GNN-LP, CPU-trainable, no
GPU/Python); a five-tier determinism taxonomy applied to every operation; portable,
end-to-end-encrypted memory reachable by any MCP client.

---

## 4. The dual-graph argument (§5.2, Observation 1) — the core structural claim

### 4.1 The statement

> **Observation 1 (Dual-Graph Coverage).** "A typed graph that carries both directed and undirected
> edges within a layer covers retrieval paths a single-relation store misses — a supersession chain
> versus an entity-overlap cluster. On graphs built from the public LongMemEval haystacks
> (15k–45k nodes), the two edge classes are largely disjoint: of all directly-connected node pairs,
> only **8–13% are linked by both** classes, the rest splitting between directed-only and
> undirected-only — so a single-relation store misses on the order of half the graph's direct
> connections … at the ≤3-hop depth recall uses, directed edges yield short ordered chains
> (median reach ≈ 3 nodes) while undirected edges bound associative neighborhoods (median reach
> 53–90), and their union reaches strictly more than either alone (64–107)."

### 4.2 The distinguishing move, precisely stated

The paper is careful *not* to claim novelty in having two edge types. The claim is about
**exposure**:

> "It is not that Graphnosis carries two edge types; many systems do. It is that directed and
> undirected edges are kept as **co-equal, independently-queryable** classes over one node set —
> both first-class traversal targets, joined in a single recall — rather than one class being
> collapsed, pooled, or demoted to an auxiliary set."

Surveyed alternatives and how they differ:
- **Directed-only entity-relationship stores:** Mem0, Zep/Graphiti, Semantica, Cortex, Atlas.
- **Collapsed to undirected for clustering/PageRank:** GraphRAG's Leiden graph; HippoRAG's PPR graph.
- **Multi-relational but fused:** MAGMA (traverses selected relation views independently, *then
  fuses the resulting subgraphs* via RRF + a policy-guided beam), HAGE (relation-specific views
  combined by a learned, query-conditioned QueryRouter).
- **HippoRAG is named as the nearest relative** — "the overlap is genuine: it places relation and
  synonymy edges over the same phrase nodes. The difference is one of *use*, not vocabulary —
  HippoRAG pools both into a single graph and runs Personalized PageRank over their union, with
  synonymy as an auxiliary edge set feeding one ranking, whereas Graphnosis keeps the two as
  distinct, independently-queryable edge types."

**Figure S1** (p.33) draws exactly this: three panels over the *same six nodes* —
(L) directed-only [Mem0, Zep, Cortex, Atlas]: 5 blue arrows, one ordered class;
(M) pooled/fused [GraphRAG, HippoRAG, MAGMA, HAGE]: all relations flattened to one undifferentiated
grey ranking; (R) co-equal dual [Graphnosis]: blue directed arrows *plus* green dashed undirected
links, with the a–d and e–f pairs marked as the ones carrying **both** classes — "8–13% do."

### 4.3 There is no formal statement of the dual graph

**Important:** the dual-graph property is deliberately *not* a theorem. It is an **Observation** —
"empirical rather than provable." The only semi-formal statement is the graph tuple in §5.1:

```
G = (G_canonical, G_gnn, G_llm)          # three physically separate layers
```
with, *within* a layer, nodes carrying a type and edges carrying a type and weight, directed
(`causes`, `precedes`, `supersedes`, `depends-on`) or undirected (`similar-to`, `shares-entity`).
The multi-graph framing: "Because a single node pair may be joined by both a directed and an
undirected edge, each layer is a *multi-graph* (parallel typed edges) in the graph-theoretic sense;
the store is thus a multi-graph within each layer, across the three physical layers, and across the
owner's federated engrams."

The taxonomy — **sixteen directed and seven undirected types** — is Appendix B, and the paper notes
that two of the directed types, `contradicts` and `supersedes`, "are the contract's own machinery
(§8), so the representation literally contains the behavior the system is named for."

---

## 5. Verification against the actual repo

I checked every mechanism the paper describes against
`/home/elpresidank/YeeBois/dev/Graphnosis` (v0.11.0, `7a19c4b8`).

### 5.1 VERIFIED — edge-type taxonomy matches exactly

`src/core/types.ts:79-109` — 16 directed, 7 undirected, exactly as Appendix B lists.

```ts
// src/core/types.ts:79
export type DirectedEdgeType =
  | 'causes' | 'depends-on' | 'precedes' | 'contains' | 'defines' | 'cites'
  | 'contradicts' | 'supports' | 'supersedes' | 'discussed-in'
  | 'knows' | 'works-with' | 'reports-to' | 'collaborated-on' | 'prefers'
  | 'summarizes';                                                   // = 16

// src/core/types.ts:101
export type UndirectedEdgeType =
  | 'similar-to' | 'co-occurs' | 'shares-entity' | 'shares-topic'
  | 'same-source' | 'same-person' | 'related-to';                   // = 7
```

Node/edge data shapes (portable):
```ts
GraphNode      { id, content, contentHash, type, source:{file,offset,line?,section?},
                 entities: string[], metadata, level, confidence,
                 createdAt, lastAccessedAt, accessCount, validUntil? }
DirectedEdge   { id, from, to, type, weight /*0-1*/, evidence?, createdAt? }
UndirectedEdge { id, nodes: [NodeId, NodeId], type, weight, createdAt? }
KnowledgeGraph { id, name, nodes: Map, directedEdges: Map, undirectedEdges: Map,
                 levels, metadata }
```
Note the shape choice that *makes* the dual graph: directed and undirected edges live in **two
separate maps on the same node map**, not one edge map with a `directed: boolean` flag. That is the
"co-equal, independently-queryable" claim expressed in a type.

### 5.2 CAVEAT — the taxonomy is a type union, not a census of edges actually built

Appendix B is sourced from the type declaration ("as constructed by the deployed system
(`src/core/types.ts`, v0.7.2)"), not from a census of a real graph. Counting *production* sites in
v0.11.0 (excluding the declaration, the CLI viewers, and the Next.js app):

**Directed types actually emitted by some code path (11 of 16):**
- `contains` w=1.0, `precedes` w=0.8, `cites` w=0.7, `defines` w=0.6 —
  `src/core/graph/directed-edges.ts:29,37,46,57` (the only four the base document-ingest pipeline
  produces)
- `summarizes` — session summarizer
- `discussed-in` (`src/core/extraction/identity-extractor.ts:124`), `knows` (`:175`)
- `supports` (`src/core/corrections/correction-engine.ts:181`), `supersedes` (correction path)
- `contradicts` w=0.7 (`src/core/optimization/reflection.ts:145`)

**Never emitted anywhere in the SDK (6 of 16):** `causes`, `depends-on`, `works-with`,
`reports-to`, `collaborated-on`, `prefers`. `causes`/`depends-on`/`supports` appear only in a
*read* set for transitive inference (`reflection.ts:305`:
`const transitiveTypes = new Set(['causes','depends-on','supports'])`) — consumed if present,
never produced.

**Undirected types actually emitted (3 of 7):** `similar-to` (weight = TF-IDF cosine, admitted at
`SIMILARITY_THRESHOLD = 0.3`, `undirected-edges.ts:136`), `shares-entity` (weight = entity Jaccard,
`ENTITY_JACCARD_THRESHOLD = 0.2`, `:147`; also identity-extractor `:138`), `co-occurs` (fixed
w=0.4, `:176`). **Never emitted:** `shares-topic`, `same-source`, `same-person`, `related-to`.

So the real dual graph in the measured corpus is: directed ≈ `{contains, precedes, summarizes}` +
a thin tail; undirected ≈ `{similar-to, shares-entity, co-occurs}`. The "sixteen and seven" figure
overstates the populated taxonomy roughly 1.5×–2×. The paper's phrase "grouped by function" invites
reading the table as a description of what a graph contains; it is a description of what the type
system permits.

### 5.3 VERIFIED — the Observation 1 harness ships and is deterministic

`tests/bench/dual-graph-and-recall.ts` — "Fully deterministic: fixed dataset slice + seeded RNG
for seed sampling. No network, no API keys, no LLM." Seeded `mulberry32(42)`. The coverage
definition is unordered pair-set overlap:

```ts
const pairKey = (a,b) => (a < b ? `${a}|${b}` : `${b}|${a}`);   // :78
for (const e of graph.directedEdges.values())   D.add(pairKey(e.from, e.to));       // :101
for (const e of graph.undirectedEdges.values()) U.add(pairKey(e.nodes[0], e.nodes[1])); // :103
pctOverlap = 100 * |D∩U| / |D∪U|
```
Reachability compares three BFS adjacency maps over the same node set at `HOPS=3`: `dirAdj`
(direction-respecting), `undAdj` (both ways), `uniAdj` (union).

### 5.4 The committed measurement — `benchmarks/dual-graph-and-recall.json`, transcribed in full

```json
config:  { questions 12, reps 15, queries 12, seeds 500, hops 3, rngSeed 42,
           dataset "data/longmemeval/longmemeval_s.json" }
hardware:{ cpu "Apple M3 Max", cores 14, ramGB 38.7, node "v20.20.2" }
graph:   { nodes 44973, directedEdges 201258, undirectedEdges 134334, buildMs 25829.1 }

c2_oneHop:
  directedPairs   188500      pctOnlyDirected    56.4
  undirectedPairs 126750      pctOnlyUndirected  35.2
  overlap          24335      pctOverlap          8.4     <-- the low end of "8-13%"
  onlyDirected    164165
  onlyUndirected  102415
  unionPairs      290915

c2_reachability (median over 453 connected seeds of 500, 3 hops):
  medianReachDirected     3        medianPctOnlyDirected    1.3
  medianReachUndirected  90.5      medianPctOnlyUndirected 84.8
  medianReachUnion      107        medianPctMixedOnly       3.5
                                   medianPctBothClasses     0.5

recallLatencyMs: n 180, median 1409.4, p95 2278.6, mean 1530.1,
                 synonymMapBuildMedian 0, queryDependentMedian 1409.4
size:            gaiBytes 63593997, jsonBytes 72277131, jsonToGaiRatio 1.14, gaiPctOfJson 88
```

Reconciliation with the paper:
- **8.4%** is the 45k-node graph. The paper's range is "8–13%"; the 13% end must come from the 15k
  graph, whose JSON is **not committed**. Only one of the two measurements is reproducible here.
- "median reach ≈ 3 nodes" directed ✔ (=3). "median 53–90" undirected — 90.5 here; the 53 end is
  the uncommitted 15k run. "union 64–107" — 107 here.
- "1.4 s at 45k nodes" ✔ (1409.4 ms). "0.28 s on a 15k-node cortex" — uncommitted.
- "~88% the size of the equivalent JSON" ✔ (`gaiPctOfJson: 88`).

**My reading of what the numbers actually show.** `medianPctOnlyUndirected = 84.8` and
`medianReachDirected = 3` mean that at recall depth the undirected class does nearly all of the
reach work; the directed class contributes a 3-node ordered chain. The two classes *are* strongly
complementary (`medianPctBothClasses = 0.5%` — essentially nothing is reachable both ways
independently), which is the paper's point. But "co-equal" is a statement about **exposure to the
query API**, not about **contribution to reach**, and the reach numbers are lopsided ~30:1. The
paper never claims otherwise, but the word "co-equal" does a lot of quiet work.

### 5.5 VERIFIED — the hub-independence mechanism (Theorem 3) is in the code, exactly as stated

> **Theorem 3 (Hub-independence of retrieval).** "The traversal writes a node's score only through
> the guarded update base(v) ← max(base(v), x) … a maximum over the seed-rooted paths P(v) the
> traversal explores — per-hop decay δ = 0.6, edge weight w_e, and γ_e = ½ for a backward-directed
> step, 1 otherwise — never a sum. Consequently base(v) is invariant to the multiplicity of edges
> incident on v … Node in-degree confers no score; no node is promoted by edge count alone."

```
base(v) = max over p ∈ P(v) of  s(seed_p) · Π_{e∈p} δ · w_e · γ_e
```

Code, `src/core/query/traverser.ts`:
- `DECAY_FACTOR = 0.6` (`src/core/constants.ts:18`), `MAX_TRAVERSAL_HOPS = 3` (`:17`),
  `TOP_K_NODES = 20` (`:19`), `SEED_COUNT = 5` (`:20`)
- `const decayedScore = score * DECAY_FACTOR;` — `traverser.ts:356`
- outgoing directed: `neighborScore = decayedScore * edge.weight` (`:363`), guarded write
  `if (neighborScore > existing) nodeScores.set(edge.to, neighborScore)` (`:369`)
- **backward** directed: `neighborScore = decayedScore * edge.weight * 0.5;
  // Lower weight for backward traversal` (`:383`) — this is γ_e = ½ verbatim
- undirected: `neighborScore = decayedScore * edge.weight` (`:400`), same guarded write (`:406`)

The **ablation hook is real and gated**, `traverser.ts:201-210`:
```ts
// Ablation hook — default OFF; the shipped scoring rule is max-score-wins.
// With GNOSIS_SCORE_RULE=additive the three update sites accumulate path
// scores (existing + neighborScore) instead of taking the max ...
const additiveScoring = opts.scoreRule !== undefined
  ? opts.scoreRule === 'additive'
  : process.env.GNOSIS_SCORE_RULE === 'additive';
```
Router seed budgets confirm the paper's "typically 20–50 nodes": `src/core/query/router.ts:114-143`
returns `{maxSeeds: 24, maxNodes: 20}` … `{maxSeeds: 40, maxNodes: 50, diversifyByFile: true,
preferSummarySeeds: true}` per question category.

### 5.6 **DIVERGENCE (important)** — Theorem 3's path-maximum did not hold in the benchmarked code

`benchmarks/evidence/manifest.json` → `traversal_order`, verbatim:

> "Every run in this bundle was produced under the **pre-0.10.0 FIFO traversal frontier**, which was
> the only behaviour that existed at the time. SDK 0.10.0 changed the DEFAULT to 'best-first' — the
> paper's path-maximum semantics (Theorem 3) — which alters retrieval output on roughly **9% of
> real multi-session queries, 6% of them returning a different set of evidence nodes** … **These are
> NOT 0.10.0 numbers, and none of them should be compared against a 0.10.0 run** — the arms must be
> re-measured for that."

And `CHANGELOG.md` v0.10.0 (2026-08-02):

> "The paper states that a node's score is the maximum over all paths reaching it. The FIFO frontier
> did not deliver that: a joined node received the maximum but its SUCCESSORS inherited from
> whichever path happened to dequeue first, off by the ratio of the two edge weights and unbounded
> in it. **On the reference 5-node chain the successor scored 0.0216 where the theorem requires
> 0.216.**"

Every command in `manifest.json` now carries an explicit `--traversal-order fifo` so the published
numbers still reproduce on ≥0.10.0.

**Is this a gotcha?** Partly, and the paper half-anticipates it. §7 already says: "the traversal
expands each node once, at its first dequeue, P(v) is the explored path set, so base(v) is an
*order-dependent lower bound* on the global maximum over all paths; the no-sum and
degree-independence properties hold exactly regardless — only global path-optimality is heuristic."
So: **the degree-independence claim survives intact** (the guard is a `max`, never a sum, in every
version), and that is the claim the +6.0 ablation tests. **Global path-optimality did not hold** in
the benchmarked build, and the changelog quantifies the miss as unbounded in the edge-weight ratio —
noticeably blunter than "order-dependent lower bound."

The honest summary: Theorem 3 as *proved* is about the write rule and is true of the shipped code;
Theorem 3 as *named* ("hub-independence of retrieval") is true; the paper's own §7 caveat is the
part that turned out to be doing the load-bearing work, and it took a code change and a 9%/6%
behavioral delta to close it.

### 5.7 **DIVERGENCE** — Definition 1's recency multiplier was removed after the paper

> **Definition 1 (Temporal retrieval score).** score(v) = base(v) · r(v) · f(v) · conf(v) · e(v)
>
> r(v) = 1.3 if Δ_acc < 1 day; 1.1 if Δ_acc < 7 days; else 1.0
> f(v) = 1.2 if acc > 10;      1.1 if acc > 3;        else 1.0
> e(v) = 0.3 if now > validUntil; else 1.0

In v0.11.0, `traverser.ts:444-465` implements f(v), conf(v), e(v) **exactly** — but r(v) is gone:

```ts
if (node.accessCount > 10) multiplier *= 1.2;        // f(v) ✔ :451
else if (node.accessCount > 3) multiplier *= 1.1;    // f(v) ✔ :452
multiplier *= node.confidence;                        // conf(v) ✔ :457
if (now !== undefined && isExpired(node, now, supersededIds)) multiplier *= 0.3;  // e(v) ✔ :464
```
with the comment at `:432`: "a ×1.3 boost for 'accessed within the last 24 hours' makes the same
file and the same query rank differently on Tuesday than on Friday. **That boost has been removed.**"

`CHANGELOG.md` v0.8.0 (2026-07-26): "**Retrieval is a pure function of `(graph, query)`** …
Wall-clock **recency** scoring is **removed**, not made optional: an option would only relocate the
non-determinism behind a flag."

This is the repo **moving past the paper** on the paper's own principle. §7 admits the weakness —
"Recall is in this sense stateful (it reads wall-clock time and updates each surfaced node's access
metadata), so the determinism this paper claims is of construction (§6) and merge (Theorem 2), not
of ranking" — and the code subsequently removed it. Anyone porting Definition 1 should port the
v0.11.0 form, not the paper's.

Related admission in `SPEC.md` §6 (Known weaknesses): "`accessCount` is mutable state inside an
otherwise declarative file. It makes ranking depend on usage history, which is intended, but it also
means two files with identical content can rank differently."

### 5.8 VERIFIED — graph-derived query expansion

§7: "a query is expanded with synonyms mined not from a thesaurus or an embedding model but from
the cortex's *own* undirected edges: for each `similar-to` or `shares-entity` edge above a weight
threshold, the entities of its endpoints become candidate synonyms, accumulated by edge weight, and
the strongest few per term are kept. 'Acme' expands to 'ACME Inc' because the two recur on the same
edges in *this* corpus, not because a dictionary says so."

`src/core/query/synonym-expander.ts:39-60`:
```ts
for (const edge of graph.undirectedEdges.values()) {
  if (edge.type !== 'similar-to' && edge.type !== 'shares-entity') continue;
  if (edge.weight < 0.4) continue;                 // the threshold
  // cross-pollinate entities of both endpoints, accumulate by edge.weight
  map.set(lowerB, (map.get(lowerB) || 0) + edge.weight);
```
Memoized per graph object with a `WeakMap` keyed on `(undirectedEdges.size, version, updatedAt)` —
which is why `synonymMapBuildMedian: 0` in the benchmark JSON.

This is the single most **portable** idea in the paper: the associative half of the dual graph is
reused as a corpus-specific thesaurus for query rewriting, at zero model cost, and its cache
invalidation is a cheap mutation signature.

### 5.9 VERIFIED (partly) — contradiction detection Path 2

`src/core/optimization/reflection.ts:104-158`, deterministic and model-free:
- group nodes by shared *meaningful* entity (entity length ≥ 4, not all-digits, not in
  `GENERIC_TERMS`); skip document/section/person nodes; skip content < 50 chars
- per entity, skip if fewer than 2 or more than 30 nodes; compare each node against the next ≤4
- require **≥2 shared meaningful entities**, `jaccardSimilarity(entities) > 0.6`,
  `cosineSimilarity(tfidf) < 0.15` — "High entity overlap + low content similarity = potential
  contradiction … Tighter thresholds: overlap > 0.6 (was 0.5), similarity < 0.15 (was 0.2)"
- then a lexical gate `detectConflictSignals` (`:160-191`) — a regex bank
  (`/\bnot\s+(?:a|an|the)\s/`, `/\bno longer\b/`, `/\bwas\s+(?:not|never)\b/`, `/\breplaced\s+by\b/`,
  `/\bcontrary\s+to\b/`, `/\bis\s+(?:incorrect|wrong|false|inaccurate)\b/`, `/\breclassified\b/`,
  `/\bdisputed\b/`, `/\bdisproven\b/`) — at least one side must fire, and both sides must be ≥80
  chars
- on a hit: push a `Contradiction {nodeA, nodeB, sharedEntities, description, detectedAt,
  resolved:false}` **and** write a `contradicts` directed edge at **w = 0.7** with
  `evidence: "Conflicting claims about <entity>"`

This is genuinely deterministic, genuinely model-free, and matches the paper's §8.1 Path 2
description ("high entity overlap and low content similarity, then tests for conflict signals …
tuned for recall").

The `ReflectOptions.decay` doc-comment is worth reading in full for a real operational bug report:
time-decay keyed on `lastAccessedAt`, which nothing refreshed, so decay measured *age, not disuse*;
traversal multiplies by `node.confidence`; the desktop host reached `reflect()` every six hours; "a
node older than a couple of months fell to the 0.1 floor within a day and was suppressed in
retrieval. `generateAuditReport` reached it too, which made producing an audit mutate the data it
audits." Decay is now off by default. This is Proposition 1's "the temporal-decay function in the
code … is dormant by product design" — but the reason it is dormant is that it was destructive.

### 5.10 **NOT IMPLEMENTED in the Apache-2.0 SDK** (I looked; these are in the FSL packages)

I grepped `src/` for each. All absent:

| Paper mechanism | Section | Status in `@nehloo/graphnosis` v0.11.0 |
|---|---|---|
| Deterministic triage θ(σ, sig), severity low/med/high, temporal verdicts `genuine_contradiction`/`temporal_supersession`/`negation_artifact`, four lanes | §8.2, Def. 2 | **NOT IMPLEMENTED** — zero hits for `triage`, `severity`, `negation_artifact`. Paper places the harness at `apps/desktop-sidecar/tests/contradiction-eval/` (the FSL app repo) |
| Path 1 (append-time detection) and Path 3 (policy rules) | §8.1 | **NOT FOUND** as distinct paths; only the reflection scan exists |
| `recall_as_of` time-travel recall | §5.1, §11 | **NOT IMPLEMENTED** — zero hits (`recall_as_of`, `recallAsOf`). There *is* `tests/unit/query-asof-determinism.test.ts`, so an as-of query path may exist under another name |
| Encrypted op-log, `(timestamp, deviceId, seq)` LWW merge (**Theorem 2**) | §11 | **NOT IMPLEMENTED** — zero hits for `deviceId`, `opLog`. `confidence.ts:243` says outright: "**This package has no op-log**, and adding one for this operation alone would…" |
| XChaCha20-Poly1305 / Argon2id / Ed25519 at-rest encryption | §11 | **NOT IMPLEMENTED** — zero hits. In `graphnosis-secure-sync` (FSL) |
| `.gnn` neural overlay / GNN-LP link predictor; `.gll` local-LLM overlay; the promotion gate (Design Invariant 1) | §5.1, §10 | **NOT IMPLEMENTED** — zero hits for `gnn`, `.gll` |
| Five-tier determinism taxonomy reported "in each tool's description" | §4 | **NOT IMPLEMENTED** — `src/mcp/server.ts:38-125` registers 5 tools (`load_graph`, `ingest_files`, `update_graph`, `query`, `export`); **not one description carries a determinism tier** |
| ≤2,000-token curated subgraph as an *enforced* cap | §4, §15 | **NOT ENFORCED** — `src/core/query/subgraph-serializer.ts` (116 lines) has no token counter and no truncation. The MCP `query` tool description says "**~2K tokens**" (approximate). The bound is a soft consequence of `TOP_K_NODES=20` / router `maxNodes` 20–50 |
| Proposition 1's δ = 0.03 and ceiling c = 0.95 | §5.3 | **PARTIAL** — `CONFIDENCE_MIN = 0.01`, `CONFIDENCE_MAX = 1` (`confidence.ts:83,86`), plus `clampConfidence`. The `+0.03` step appears **only as a caller pattern in a JSDoc example** (`:104`); no 0.95 node-confidence ceiling exists in the SDK |
| A merge algebra over the `.gai` format | — | `SPEC.md` §8.6: "**A merge algebra.** … The operation — commutative, associative, idempotent, proven over `(id, rev)` — is downstream and **is not claimed here.**" And SPEC §8 as a whole: "**Status: PROPOSAL. Nothing here is implemented.**" |

**None of this is concealed** — §15 says plainly that sync and the app are separate FSL packages.
But a reader who takes "Graphnosis is released as open source (Apache-2.0)" as covering the paper's
guarantees will be wrong about roughly half of them. The Apache-2.0 artifact is a
**deterministic dual-graph retrieval engine with a reflection-based contradiction scanner**. The
indelibility/encryption/sync/adjudication-queue machinery — i.e. the *un-brain* proper — is not in it.

---

## 6. The determinism argument

### 6.1 The five-tier taxonomy (§4) — transcribed

| Tier | Guarantee | Examples |
|---|---|---|
| **Deterministic** | Identical input → identical result; no LLM, no randomness; auditable | recall, structured queries, source/engram operations, contradiction detection |
| **Approximate** | Similarity scan, no LLM, but results may vary across runs due to LSH randomness | near-duplicate detection (`audit_memory`, `check_duplicate`) |
| **Conditional** | Deterministic by default; non-deterministic only when an optional local LLM or the neural overlay is enabled, with the path reported | correction/edit, skill training |
| **Mixed** | Deterministic core with a clearly separated inferred overlay | recall when neural/LLM overlays intersect the result |
| **Non-deterministic** | Requires a local LLM; output varies | strategic synthesis, predictions, distillation |

"The Approximate tier is small but distinct: it covers exactly the two similarity-scan tools, which
are LSH-based and therefore neither LLM-driven nor bit-for-bit reproducible."

The design idea worth stealing: **the tier is part of the tool contract**, surfaced to the calling
agent in the MCP tool description, so a client can reason about whether an answer is replayable.
(Not implemented in the open SDK — §5.10.)

### 6.2 What determinism is and is not claimed for

Precisely scoped in §7 and §13:
- Claimed: determinism **of construction** (§6 — no embedding or generation API at ingest) and
  **of merge** (Theorem 2).
- **Not** claimed for ranking, at paper time: "Recall is in this sense stateful (it reads wall-clock
  time and updates each surfaced node's access metadata) … the benchmark configurations are
  stateless — one query per freshly built graph — so no reinforcement compounds."
- **Not** claimed for the overlays: "We claim no determinism for them and no benchmark result rests
  on them."
- §13 scoping: "Of the three structural properties, two carry non-trivial proofs (indelibility;
  LWW determinism) and one is a design invariant true by construction (the promotion gate). **We do
  not claim three co-equal theorems.**"

### 6.3 The determinism-vs-adjudication distinction — the sharpest argumentative move

§14: "Determinism alone does not close the gap: Semantica [Hawksight AI 2026] performs
deterministic, model-free conflict detection over a typed provenance graph, **yet still resolves
automatically** — by credibility-weighted, temporal, or majority-voting strategies. What we claim is
therefore sharper than determinism: detection that *surfaces the conflict for the owner to
adjudicate and never auto-resolves it*. **The adjudication contract, not determinism, is the
distinguishing commitment.**"

And the two-axis decomposition of the failure mode: "(i) an LLM judges the conflict, and (ii) the
resolution is automatic — silently selecting a winner or invalidating a fact (Zep today; Mem0's
earlier update phase…). Graphnosis differs on both axes."

### 6.4 Theorems, verbatim-ish

**Theorem 1 (Node-Set Indelibility).** "Let N_t be the set of node identifiers present in the
canonical layer after the first t write operations. Under the canonical-layer write semantics —
every write is either an append (insert a new node) or a soft-delete (a tombstone that lowers a
node's confidence to a floor but retains it) — the node set is monotone non-decreasing:
t ≤ t' ⟹ N_t ⊆ N_t'." *Proof: induction on t; no write path deletes an identifier.*
Consequence: "the worst case for any memory is quieter retrieval, not erasure." Time-travel recall
(`recall_as_of`) is presented as a direct corollary.

**Theorem 2 (LWW Determinism).** Operations tagged with a key and `(τ, d, s)` = (timestamp,
deviceId, seq), ordered by the lexicographic relation `o ≺ o' ⟺ (τ,d,s) <_lex (τ',d',s')`;
`S(O) = fold_≺(O)`. Then S is permutation-invariant: `S(π(O)) = S(O)` for every permutation π.
*Proof: `(τ,d,s)` are drawn from totally ordered domains and device ids are unique, so ≺ is a strict
total order — antisymmetric even when timestamps tie — a finite set admits exactly one sorted
enumeration, hence sorting any permutation produces the identical sequence.* Followed by the useful
negative note: "A timestamp-only comparator is not antisymmetric under equal timestamps and so fails
permutation-invariance; the strict total order is what restores it, and a permutation test in the
sync layer's suite checks it empirically."

**Theorem 3** — §5.5 above.

**Proposition 1 (Saturation Convergence).** `w_{n+1} = min(c, w_n + δ)`, δ = 0.03, ceiling
c = 0.95 for node confidence / c = 1.0 for edge weights. Monotone non-decreasing, bounded, reaches
c in at most `⌈(c − w_0)/δ⌉` reinforcements, never exceeding it.

**Design Invariant 1 (The Promotion Gate).** Predicted content (`.gnn`, `.gll`) and attested
content (`.gai`) are separated "as a property of the write-path lattice: exactly one user-gated
operation (an approved `edit`) crosses the boundary from predicted to attested, and no inference
loop can. We present this as an invariant enforced by construction — the file boundary is the
on-disk expression of it — rather than as a theorem, because proving set-disjointness would restate
the premise."

**Figure 3** (p.13) transcribes the op-log entry shape:
```
| timestamp | deviceId | seq | op | key | value |
(timestamp, deviceId, seq) = strict total order; op ∈ {insert, delete-tombstone}
Device A order: [ts10·A#1 insert loc="Piatra Neamț"], [ts20·B#1 insert loc="Brașov"],
                [ts15·A#2 delete oldAddr]
Device B order: [ts15·A#2 delete oldAddr], [ts20·B#1 insert loc="Brașov"],
                [ts10·A#1 insert loc="Piatra Neamț"]
Converged (both): loc = "Brașov" (ts20 > ts10 → last writer wins);
                  oldAddr = ∞ tombstoned, deprioritized, recoverable, never removed
```

---

## 7. Evaluation — every number, with its conditions

### 7.1 Setup (§12.1)

- Benchmark: **LongMemEval_S**, public, 500 questions, `xiaowu0162/LongMemEval`
- **Official methodology, official judge prompts, judge = GPT-4o**, run verbatim
- **Only Graphnosis was re-run.** "comparator figures are leaderboard-reported, not re-run in our
  harness"
- Headline configs produced on the **v0.6.1–v0.7.2** line, commits `df7d714`–`48785ba`; headline at
  `a27c400` (v0.7.1); additive-scoring arm added at the **v0.7.3** tag; the two naïve-top-k
  structure-ablation arms re-run at commit `7476744` under a seed-sharing hook
- Retrieval stack in every row: **TF-IDF over a pure-TypeScript lexical index** — "no Python, no
  vector database, no GPU, no fine-tuning"

### 7.2 Configuration decomposition (§12.2, Figure 4) — MEASURED

| Configuration | Embeddings | Query enrichment | Answer model | Accuracy |
|---|---|---|---|---|
| Fully on-device | none (local) | local LLM | local Llama 3.2 3B | **41.60%** (208/500) |
| Zero-embedding-API | none (local) | cloud (gpt-4o-mini) | GPT-4o (cloud) | **64.60%** (323/500) |
| Zero-embedding-API, no enrichment | none (local) | none | GPT-4o (cloud) | **62.20%** (311/500) |
| Cloud-paired | cloud | cloud | GPT-4o (cloud) | **78.00%** (390/500) |

Reference line on Figure 4: **Zep 71.2%** — "published reference, not rerun" (Zep's own figure).

Author's own reading, quoted: "the **answer model is the dominant lever**: moving from the local 3B
to GPT-4o, embeddings held local, is the largest single jump. Second, the genuinely
owner-controlled number — fully on-device, no cloud calls of any kind — is 41.60%. **We do not
present 78.00% as evidence that Graphnosis is accurate in isolation**; it is evidence that a
local-first memory layer *does not break* a strong answer model while adding privacy, indelibility,
and contradiction detection."

### 7.3 Per-category accuracy at 78.00% (§12.2) — MEASURED

| Question type | Accuracy |
|---|---|
| Single-session, user | 94.29% (66/70) |
| Single-session, assistant | 89.29% (50/56) |
| Single-session, preference | 56.67% (17/30) |
| Multi-session | 65.41% (87/133) |
| Temporal reasoning | 75.94% (101/133) |
| Knowledge update | 88.46% (69/78) |
| *Abstention (subset)* | 90.00% (27/30) |

Appendix A reconciliation (abstention `_abs` items are distributed across four categories, not a
standalone class): non-abstention **363/470** + abstention **27/30** = **390/500**.

| Category | Non-abstention | Abstention | Combined |
|---|---|---|---|
| single-session-user | 60/64 | 6/6 | 66/70 |
| single-session-assistant | 50/56 | 0/0 | 50/56 |
| knowledge-update | 64/72 | 5/6 | 69/78 |
| temporal-reasoning | 95/127 | 6/6 | 101/133 |
| multi-session | 77/121 | 10/12 | 87/133 |
| single-session-preference | 17/30 | 0/0 | 17/30 |
| **Total** | **363/470** | **27/30** | **390/500 (78.00%)** |

### 7.4 The one cross-system comparison (§12.3)

78.00% vs Zep's published **71.20%** = **+6.8 points / +34 questions**. Conditions stated with
unusual care:
- "Both numbers are end-to-end accuracy on the same LongMemEval_S questions under the official
  methodology, but Zep's is a *published leaderboard result, produced by its authors in their own
  harness — not re-run by us*."
- "the GPT-4o judge variance we observe (±1–2 questions per category at temperature 0 across our own
  passes)" — so +34 questions dwarfs judge noise.
- **The self-undercut, quoted:** "What carries the margin is the cloud-paired configuration, not the
  zero-API substrate: the substrate scores **62.20–64.60% (§12.2) — *below* Zep** — so the lead over
  Zep depends on the cloud answer model and embeddings. The architecture's stand-alone contribution
  is the deterministic contradiction primitive (§12.6), not a raw QA-accuracy win."
- Mem0's **94.8%** is named and *not* contested: "an ADD-only store that accumulates every fact and
  retrieves deeply (top-50–200 memories per question) — but those systems pair different memory
  designs with different readers, and published figures across the field use heterogeneous metrics
  (retrieval recall@k versus end-to-end QA), so ranking them in a single column would compare
  different quantities."

This is the most intellectually honest passage in the paper.

### 7.5 The retrieval ablation (§12.4, Figure 5) — MEASURED, the paper's best evidence

Answer model held fixed (GPT-4o, no query enrichment), **identical TF-IDF seed pool** across all
three arms, only the retrieval *structure* varies:

| Retrieval | Accuracy |
|---|---|
| **Graphnosis graph** — traversal + typed edges | **62.20%** (311/500) |
| Naïve top-k — same seeds, no graph | 49.00% (245/500) |
| Full-context — no retrieval, whole history concatenated | 22.60% (113/500) |

→ **+13.2 points** for graph over naïve top-k; **+39.6 points** over full-context.
Full-context "fails outright on the longest histories (**nine questions overflowed the context
window**)."

**On-device mirror:** answer model swapped to local Llama 3.2 3B — dual graph **41.60%** (208/500)
vs naïve top-k **35.80%** (179/500) = **+5.8 points**. "conservative, since the graph arm counts
**eight Ollama generation errors as incorrect**." (The evidence manifest says 8; §12.2 also says 8.)

**Decomposition of the +13.2 (structure vs scoring rule):**

| Arm | Accuracy | Delta |
|---|---|---|
| Graph + max-wins (Theorem 3) | 62.20% (311/500) | — |
| Graph + **additive** scoring (`GNOSIS_SCORE_RULE=additive`) | **56.20%** (281/500) | −6.0 |
| Naïve top-k (no graph) | 49.00% (245/500) | −13.2 |

→ **structure alone = +7.2**, **max-wins scoring rule = +6.0** (Theorem 3), "nearly half the dual
graph's advantage is the scoring rule that makes recall hub-independent."

The mechanism story for why max beats additive, §7: "Additive (spreading-activation / PageRank-style)
accumulation would let a high-degree but irrelevant node gather score in proportion to its degree;
the max rule cannot, so retrieval surfaces the single strongest evidence chain rather than the
best-connected node."

### 7.6 Efficiency (§12.5) — MEASURED

- Delivered subgraph: **median 35 nodes/query, mean 36, p95 45**, "rising to ~120 on the densest
  questions once session-summary and sibling-turn context are layered onto the 20–50-node seed set"
- Answer-model latency (GPT-4o): **median 1.6 s, p95 3.1 s**
- Per-question graph build (reconstructs each question's session history from scratch): **median
  12.9 s** — "a benchmark artifact, not a steady-state cost"
- Isolated micro-benchmark, Apple M3 Max (14 cores, 38.7 GB, Node 20), no answer model, no rebuild:
  warm `recall` (query → ranked subgraph) **median 0.28 s on a 15k-node cortex** and **1.4 s at 45k
  nodes** — VERIFIED for 45k (1409.4 ms in the committed JSON); the 15k run is not committed
- Format: `.gai` container is **~88% of the equivalent JSON** at every size measured — VERIFIED
  (`gaiPctOfJson: 88`). Honest framing: "MessagePack removes structural overhead, but node text is
  the irreducible floor, so the format's value is machine-native parsing, an integrity tag, and
  at-rest encryption rather than dramatic compaction."

### 7.7 The contradiction-triage benchmark (§12.6, Figure 6) — MEASURED, and it is the honest core

Three labeled sets, all scored against the **frozen, deterministic, model-free** triage:

**(a) The 71-pair author-constructed set** — composition transcribed:
- **35 genuine-conflict positives**, of which **28 are grounded in LongMemEval_S knowledge-update
  values** (examples given: a charity-5K best of 27:12 later 25:50; a mortgage pre-approval of
  $350k later $400k; a Gold-tier threshold of 300 stars later 120), "atomized into the shape the
  triage actually sees"; the other **7 are curated** — **5 entity-anchored conflicts** (a person's
  location, an organization's HQ, a project's lead, a database's engine) and **2 first-person
  identity flips** carrying no shared named entity (a dietary identity; a home city)
- The rest: temporal supersessions, negation artifacts, near-duplicates, weak-shared-entity pairs,
  complementary same-subject facts, and **six same-subject / different-attribute numeric pairs**
- "Shared entities are computed by the production entity extractor, not supplied by hand."

**Figure 6 confusion matrix — transcribed in full** (rows = human-correct lane, cols = lane chosen):

|  | queue | supersession | negation | suppress |
|---|---|---|---|---|
| **queue** | **35** | 0 | 0 | 0 |
| **supersession** | 0 | **7** | 0 | 0 |
| **negation** | 0 | 0 | **4** | 0 |
| **suppress** | 0 | 0 | 0 | **25** |

"100% on the 71-pair author-constructed regression set · 0 off-diagonal · 0 false positives.
**Regression coverage, not a generalization estimate.**"

**(b) Held-out instance set: 24 instances**, "whose subjects and values are disjoint from the
71-pair set and which were authored *after* the rules were fixed" → **23/24 (95.8%)** to the correct
lane, **zero false positives**. The single miss: "a knowledge-update item whose frequency change
(*every week → every other week*) the near-duplicate guard absorbed because the two phrasings differ
by a single token." Explicitly labeled "**held-out-*instance* validation under frozen rules, not
third-party-blind construction**."

**(c) Model-authored held-out set: 45 pairs.** GPT-5.5, "given only the four lane *definitions* and
never the triage rules," authored and labeled 45 memory pairs spanning value types the tuning sets
under-represent (contact details, hosting providers, policies, dated changes).
- First run against the frozen triage: **21/45 (46.7%)** agreement.
- Disagreements clustered: "the rules reliably caught conflicts exposing a shared named entity and a
  modeled signal but **missed conflicts whose subject is a common noun** (*'my dentist is X'* vs
  *'…my Y'* — no shared named entity) or whose value type trips no signal (a month, a country, a
  hosting provider)."
- After "**two principled extensions**, a frame-general value-conflict signal and narrative-temporal
  supersession": **35/45 (77.8%)**, conflict recall 5/18 → 15/18, "**no regression** on the 71-pair
  or held-out sets and unchanged non-conflict precision (15/15 suppressed; 0/6 adversarial false
  positives)."
- **Residual gaps named:** "value conflicts carried by lowercase tokens (an email local-part, a
  password), synonymy-negation restatements that surface as low-value queue items, and one
  dated-numeric pair that the model and the rules route to different lanes with equal
  justification."
- **The caveat the author writes themselves:** "the 77.8% follows **post-hoc category-level (not
  item-level) tuning**. It characterizes a **recall envelope** (entity-anchored, numeric,
  framed-relation, identity, explicit-temporal, and narrative-supersession conflicts) rather than
  asserting completeness."

**(d) Adversarial probe** that changed the design: "*X has 50 engineers* versus *X has 200 customers*
— same subject, *different attribute* — read as a conflict (two of six probe pairs). A second fix
requires the differing value to quantify the same attribute."

**The paper's own verdict on this evidence (§13):** "The contradiction evaluation is
author-shaped, and we say so plainly. The 71-pair set co-evolved with the rules; the 24-instance
held-out set and the 45-pair set are author- and model-authored — frozen, but not independently
labeled. Together they establish *regression coverage* and *bounded generalization* … **The evidence
the centerpiece still lacks, and that we name as the clear next step, is a pre-registered,
third-party (human-authored) labeled set with published labels, run against the frozen triage and
against Zep/Graphiti, Mem0, Semantica, and Pith under one harness.**"

### 7.8 Reproducibility — I verified it, and it holds

All eight arms ship as sanitized per-question JSONL at `benchmarks/evidence/` with SHA-256 digests
in `checksums.txt` and per-run commands in `manifest.json`. I ran the paper's own verification
recipe (`grep -c '"correct":true' <file>`) on all eight:

| File | Claimed | `grep -c` | Lines |
|---|---|---|---|
| `cloud-paired-78.0.jsonl` | 390 | **390** ✔ | 500 |
| `zero-embed-enrich-64.6.jsonl` | 323 | **323** ✔ | 500 |
| `zero-embed-noenrich-62.2.jsonl` | 311 | **311** ✔ | 500 |
| `on-device-41.6.jsonl` | 208 | **208** ✔ | 500 |
| `on-device-naive-topk-35.8.jsonl` | 179 | **179** ✔ | 500 |
| `ablation-naive-topk-49.0.jsonl` | 245 | **245** ✔ | 500 |
| `ablation-full-context-22.6.jsonl` | 113 | **113** ✔ | 500 |
| `ablation-additive-scoring-56.2.jsonl` | 281 | **281** ✔ | 500 |

Every numerator reconciles. Dataset `question`/`gold` text is stripped for license reasons; records
key to the public dataset by `question_id` and retain `predicted`, `correct`, `judgeRaw`, and model
ids.

Exact reproducing commands (from `manifest.json`), which reveal conditions the paper's prose does
not:
```
78.0%  --answer-model gpt-4o --retrieval hybrid    --enable-router --enable-session-summaries \
                                                    --enable-preference-extraction --traversal-order fifo
64.6%  --answer-model gpt-4o --retrieval tfidf     --enable-router --enable-session-summaries \
                                                    --enable-preference-extraction --traversal-order fifo
62.2%  --answer-model gpt-4o --retrieval tfidf     --enable-router --traversal-order fifo
41.6%  --answer-model llama3.2:3b --retrieval tfidf --enable-router --ollama --traversal-order fifo
49.0%  --answer-model gpt-4o --retrieval naive-topk --enable-router --traversal-order fifo
35.8%  --answer-model llama3.2:3b --retrieval naive-topk --enable-router --ollama --traversal-order fifo
22.6%  --answer-model gpt-4o --retrieval full-context --traversal-order fifo
56.2%  GNOSIS_SCORE_RULE=additive ... --retrieval tfidf --enable-router --traversal-order fifo
```
Default `--max-nodes` is **30** (not stated in the paper). Note the flag-parsing footgun documented
in the manifest: `run.ts` enables booleans by bare presence, so `--enable-router=true` silently
leaves the flag *unset*.

**One real provenance gap, disclosed by the author** — the +6.0 Theorem-3 arm:
> "the run's results.md records argv but **NOT the `GNOSIS_SCORE_RULE` env var** (a harness gap, now
> fixed for future runs); this arm is identified by its **distinct 56.20% score** vs the 62.20%
> max-wins arm that shares the same argv."

So the single arm that carries the Theorem-3 attribution is identified by its *outcome*, not by
recorded provenance. The changelog's v0.10.0 fix (`scoreRule` option replacing the env var:
"Scoring was not a pure function of its inputs: an ambient variable changed rankings for an
identical graph and query, with nothing in the API to reveal it, so **no published golden vector was
valid without also declaring an environment**") is precisely a correction of this failure.

---

## 8. Related work as the paper frames it (§14)

Capability matrix (Yes / partial / auto / keeps both / — / No), transcribed:

| System | Local-first | Typed multi-layer graph | Surfaces contradictions† | E2E-encrypted sync | Model-free construction |
|---|---|---|---|---|---|
| Mem0 | partial‡ | partial | keeps both | No | No |
| Zep | partial‡ | partial | auto | No | No |
| Sentra | partial | partial | — | No | No |
| Semantica | partial | partial | auto | No | **Yes** |
| Pith | Yes | partial | — | No | **Yes** |
| Atlas | Yes | partial | partial | No | partial |
| MemGPT / Letta | partial‡ | No | No | No | No |
| GraphRAG family | Yes | partial | No | No | No |
| HippoRAG | Yes | No | No | No | No |
| LangChain / LangGraph | Yes | No | No | No | **Yes** |
| Platform memory features | No | No | No | No | No |
| Tenure *(concurrent)* | Yes | partial | **Yes** | not assessed | No |
| Cortex *(concurrent)* | Yes | partial | auto | **Yes** | No |
| **Graphnosis** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |

† `Yes` = detects deterministically (no LLM) and surfaces for owner adjudication, never auto-resolving.
`auto` = detects but resolves automatically. `keeps both` = accumulates without surfacing or resolving.
`partial` = surfaces some conflicts but not all. `—` = not documented. `No` = not addressed.
‡ Mem0, Zep (via Graphiti), and Letta are Apache-2.0 and self-hostable with a local model; the
`partial` mark reflects their default hosted/cloud posture, not an inability to run locally.

**Appendix C is a source audit with pinned versions and verbatim quotes** (access date 2026-06-25) —
a genuinely good practice. Highlights:
- **Mem0** (`ts-v3.0.10`, main `0fbbb2f5`) — README: *"Single-pass ADD-only extraction — one LLM
  call, no UPDATE/DELETE. Memories accumulate; nothing is overwritten."*
- **Zep/Graphiti** (`v0.29.2`, main `413b9b2e`) — README: *"Automatic fact invalidation with
  temporal history preserved"*; blog: *"We mark conflicting edges as 'expired' by setting the
  `expired_at` field."*
- **Semantica** (v0.5.0, main `e87f0832`) — README: *"Resolve using multiple strategies"*
  (`credibility_weighted`, `temporal`, `voting`); *"Conflicts are detected, not silently
  overwritten."* Model-free: *"The reasoning engines, KG construction, and provenance layer are
  fully deterministic; no LLM is required to use them."*
- **Atlas** (master, pushed 2026-06-13) — *"Strategic + core_protected route to a human-readable
  Obsidian markdown queue… routine items auto-resolve via the AGM operator without prompting."*
- **Tenure** (arXiv:2605.11325, Flynt, May 2026) — merger *"does not silently overwrite: it queues
  the conflict for user review, preserving both versions until the user resolves it"* — **the same
  adjudication contract, reached independently**. Over a typed 14-field belief schema, not a
  co-equal dual graph; evaluates on its own PrecisionMemBench.
- **MAGMA** (arXiv:2601.03236) — *"selects relevant relational views, traverses them independently,
  and fuses the resulting subgraphs"* via RRF + policy-guided beam.
- **HAGE** (arXiv:2605.09942) — *"relation-specific graph views over shared memory nodes"* combined
  by a learned QueryRouter (softmax over query-conditioned edge scores).
- **SuperLocalMemory V3** (arXiv:2603.14588) — zero-LLM contradiction detection via sheaf
  cohomology; *"creates a supersedes edge from the newer memory to the older contradicted memory"* —
  auto-resolves.
- **Cortex** (github.com/gambletan/cortex v2.2.0) — AES-256-GCM + Argon2id; directed SPO triples
  only; *"Contradiction detection — Automatic with confidence scores"*; *"Merge uses Last-Writer-Wins
  with Hybrid Logical Clocks"*, no convergence proof.
- **Heirloom** (v1.0.4) — *"XChaCha20-Poly1305 authenticated encryption with an Argon2id-derived key
  (m=64 MiB, t=3, p=1)"* — **the same crypto primitives as Graphnosis §11**; flat store, no typed
  graph.
- **Bicameral** (yhl999) — append-only hash-chained ledger, owner-gated promotion, *"Pure graph pass
  — no LLM calls"*; but contradiction closure **auto-invalidates** the superseded fact.
- **OIDA** (arXiv:2604.11759) — *"contradictions should be represented as persistent signed
  relations, not rediscovered from raw text at query time"*; specifies no detector.

**The paper's own conclusion about its novelty** (§14, "The conjunction we claim"): "the
contribution is not a list of separable firsts but one **bundle** we did not find assembled in any
system we examined — and that each concurrent system realizes only in part." The three properties:
co-equal dual graph, total deterministic adjudication contract, inspectable deterministic substrate.
And: "Individually, none of the bundle's ingredients is ours to claim as a first."

---

## 9. Independent theoretical support the paper leans on (§13)

**Barman et al. 2026a, *The Price of Meaning: Why Every Semantic Memory System Forgets*
(arXiv:2603.27116)** — the **No-Escape theorem**: "any *semantically continuous, kernel-threshold*
memory — the embedding-similarity design under most production memory systems — cannot
simultaneously eliminate interference-driven forgetting and associative false recall, and … the
architectures escaping the result are exactly those adding *'an external symbolic verifier or exact
episodic record'*." The quantified cost: "a pure keyword store agrees with embedding retrieval on
only **15.5% of queries**." **Not peer-reviewed** — "The result is a 2026 preprint, not yet
peer-reviewed."

**Barman et al. 2026b, *The Geometry of Forgetting* (arXiv:2604.06222)** — argues the brain's memory
failures are "*not bugs of biological implementation but features of any system that organizes
information by meaning*," and that embedding memory reproduces them with no phenomenon-specific
engineering. The paper's rhetorical pivot: "The un-brain takes the opposite stance: these are not
features to reproduce but failures to repair … Two programs reach opposite architectures from the
same evidence: one mimics the brain, the other inverts it. That inversion is what *un-brain* names."

Sentra is identified as the commercial arm of that same research line — so the paper is using a
competitor's impossibility result as its strongest external motivation. That is a clean move and the
paper says so: "Sentra's own impossibility result, however, is among the strongest external
motivations for our design (§13)."

---

## 10. Stated limitations — collected

The paper's limitations are unusually well distributed rather than ghettoized. Full list:

1. **Storage grows monotonically.** "Indelibility guarantees auditability and resistance to silent
   hard deletion, at the cost of monotonically growing storage and the need for prominence (not
   deletion) to manage attention." (§13)
2. **Recall ceilings.** "Determinism-first design guarantees reproducibility and removes a class of
   model-introduced errors, at the cost of recall ceilings that a learned retriever might exceed."
   (§13)
3. **Detection scope.** "Path 1/2 detect *lexically or relationally explicit* disagreement; they do
   not catch purely numerical drift with no shared linguistic signal, and recall is lower on very
   small graphs. The system is calibrated for graphs of hundreds to thousands of nodes." (§8.1)
4. **Author-shaped contradiction evaluation.** §13, quoted in full at §7.7 above. The named next
   step is a pre-registered third-party labeled set run against Zep/Graphiti, Mem0, Semantica, Pith.
5. **The 77.8% is post-hoc category-tuned** and characterizes a recall envelope, not completeness
   (§12.6).
6. **Not a leaderboard win.** "The substrate scores 62.20–64.60% — *below* Zep — so the lead over Zep
   depends on the cloud answer model and embeddings." (§12.3)
7. **The one cross-system number is a juxtaposition, not a controlled comparison** — Zep's figure is
   published, not re-run (§12.1, §12.3).
8. **Threat model bounded explicitly.** "we do *not* claim protection against an adversary executing
   code as the unlocked user — that is the job of OS/hardware isolation, not the application — nor
   against malware, dependency supply-chain compromise, or a coerced passphrase. We state this
   boundary explicitly rather than overclaim." (§11) And §4: "This is the AI-client threat model; it
   does not by itself speak to OS-level compromise, device backups, or the encrypted-sync path."
9. **Weakest categories named:** multi-session reasoning 65.41% and user-preference recall 56.67%
   "remain the clearest targets for future work" (§12.2). §13: "The largest measured gap is
   multi-session reasoning; hierarchical session summaries are a natural next step."
10. **No TOP_K / MAX_HOPS sweep.** "A full TOP_K / MAX_HOPS sensitivity sweep is left to future
    work." (§7)
11. **Graph-derived query expansion is not independently ablated.** "like every component of the
    retrieval pipeline it is not isolated by a dedicated ablation, and we leave its independent
    contribution and its relation to prior query-expansion methods to future work." (§7)
12. **Theorem scoping.** "We do not claim three co-equal theorems." (§13)
13. **Per-question graph build (median 12.9 s) is a benchmark artifact**, not a steady-state cost
    (§12.5).
14. **Alzheimer's application is out of scope.** "it requires clinical validation and regulatory
    frameworks out of scope here; we note it as a direction, not a result." (§2)
15. **On-device dense retrieval is unmeasured.** "We benchmark the TF-IDF on-device arm here and
    leave the on-device-dense measurement to ongoing work." (§12.2)
16. **The 15.5% and No-Escape results rest on a non-peer-reviewed preprint** (§13, said outright).
17. **`.gai` SPEC §6 known weaknesses:** 32-bit `contentHash` ("at least one collision at roughly 5%
    by 20,000 nodes and 25% by 50,000 … A reader MUST NOT treat equal `contentHash` as proof of
    equal content"); header counts unauthenticated when unsigned; "the checksum is not a MAC";
    `accessCount` makes ranking depend on usage history. Plus: "A third implementation passing all
    ten [conformance fixtures] is what would make `.gai` a standard rather than a file layout. Until
    then this document describes one program."

---

## 11. Authorship note (§Acknowledgments) — worth recording verbatim

> "Implementation was AI-assisted under the author's design specifications. During the preparation of
> this work the author used Claude (Anthropic) for coding assistance and drafting support, and then
> GPT-5.5 and Codex 5.3 (OpenAI) for independent hostile review of the claims over a few iterations;
> the author reviewed and edited all content, independently verified every reference and empirical
> result, and takes full responsibility for the scientific claims and the final text. **No AI system
> is an author.**"

Also §12.6: the model-authored held-out set was generated by **GPT-5.5**. So an AI system both
hostile-reviewed the claims and authored one of the three evaluation sets. Disclosed, but it is a
real constraint on the independence of set (c).

---

## 12. What is worth porting to a TypeScript/Effect codebase

Ranked by how much mechanism survives the port:

1. **Two edge maps over one node map.** `directedEdges: Map<EdgeId, DirectedEdge>` and
   `undirectedEdges: Map<EdgeId, UndirectedEdge>` with `UndirectedEdge.nodes: [NodeId, NodeId]`
   (an unordered pair, not from/to). The type-level split is what makes "co-equal, independently
   queryable" real rather than rhetorical. In an Effect/schema idiom: two `S.Class` edge schemas
   over one `HashMap` of nodes, with a tagged union only at the traversal boundary.
2. **The guarded max write in traversal.** `base(v) ← max(base(v), x)`, never `+=`. Three lines of
   code, a proved degree-independence property, and a measured +6.0 points against the additive
   alternative. This is the single highest-value, lowest-cost idea in the paper.
3. **The ablation hook as a first-class option, not an env var.** The `scoreRule?: 'max-wins' |
   'additive'` option — and the reason it replaced `GNOSIS_SCORE_RULE`: an ambient variable made
   scoring impure and invalidated published golden vectors. Ship the alternative rule behind an
   explicit option so the ablation is reproducible by a caller.
4. **Graph-derived query expansion.** Mine synonyms from the corpus's own `similar-to` /
   `shares-entity` edges above a weight threshold, accumulate by edge weight, cache per graph object
   keyed on `(edgeCount, version, updatedAt)`. Zero model cost, corpus-specific vocabulary,
   trivially memoizable.
5. **The prompt wire format.** A compact, typed, LLM-legible subgraph serialization
   (`src/core/query/subgraph-serializer.ts:63-99`):
   ```
   === KNOWLEDGE SUBGRAPH (N nodes, M edges) ===

   --- SESSION SUMMARIES ---
   [n1|summary|0.87|session:S12|date:2023-05-20] <content>

   --- NODES ---
   [n5|fact|0.61|src:User (turn 3)|date:2023-05-20] <content>

   --- DIRECTED ---
   n1 -[summarizes:0.9]-> n5

   --- UNDIRECTED ---
   n5 ~[shares-entity:0.4]~ n9
   ```
   Short ids `n1..nK` assigned by descending score; scores to 2dp; edge weights to 1dp; two edge
   sections kept visually distinct (`-[..]->` vs `~[..]~`). This is the concrete form of "a typed
   subgraph beats flat chunks," and it is worth +13.2 points in their harness.
6. **The five-tier determinism taxonomy as part of the tool contract.** Even unimplemented in the
   SDK, the *idea* — every MCP tool advertises whether its result is replayable — is a clean
   contract for agent-facing APIs and maps naturally onto an Effect service where the tier is a
   phantom/branded property of the operation.
7. **The adjudication contract as an invariant, not a feature.** "There is no code path by which the
   system silently resolves a contradiction." That is a statement provable by construction (a
   missing write path) rather than by test, and it is exactly the kind of guarantee a schema-first,
   Effect-typed design can encode: make the resolution operation require an owner-token in its
   requirements channel.
8. **Deterministic triage as a `cascade`, not a threshold.** Definition 2's shape — a signal-aware
   anchor floor `θ(σ, sig) ∈ {0,1,2}`, a severity `σ ∈ {low,medium,high}`, a disjunction of four
   model-free conflict signals, then a set of suppression lanes, each failure written to an
   auditable lane with the failing reason rather than dropped. "Because θ, σ, sig, and the lanes are
   all rule-based, the operating point is itself reproducible and inspectable." The lane taxonomy is
   "a deterministic classification of *what to surface*, never a resolution of *which fact wins*."
9. **The evidence-bundle discipline.** Per-run JSONL + SHA-256 checksums + `manifest.json` with the
   exact command, plus an explicit `command_provenance` field that says *how confident* the author is
   that the recorded command is the one that ran (`exact — confirmed by author` /
   `confirmed — author-attested` / the honest gap on the additive arm). Copy this wholesale for any
   benchmark claim.

---

## 13. Bottom line

The paper is substantially more honest than its abstract's font weight suggests. It repeatedly
undercuts its own headline (78.00% is "not evidence that Graphnosis is accurate in isolation"; the
substrate alone is "*below* Zep"; the contradiction evaluation is "author-shaped, and we say so
plainly"; Mem0's 94.8% is named and not contested). The reproducibility bundle is real and I
verified all eight numerators.

The two claims that survive scrutiny best are **(a)** the +13.2 / +7.2 / +6.0 retrieval ablation,
because the answer model and seed pool are genuinely held fixed and the evidence files reconcile,
and **(b)** the dual-graph coverage measurement, because the harness is committed, seeded, and
network-free.

The two claims to treat with most caution are **(a)** the "8–13%" range, of which only the 8.4% end
is reproducible from committed artifacts, and **(b)** the contradiction primitive as the "stand-alone
contribution," which is measured only against sets the author or a model authored, and whose
implementation (the §8.2 triage) is not in the open-source artifact at all.

The largest gap between paper and repo is scope: the Apache-2.0 SDK is a deterministic dual-graph
retrieval engine with a reflection-based contradiction scanner. Indelibility enforcement, encryption,
op-log sync, `recall_as_of`, the promotion gate, the neural/LLM overlays, the determinism-tier
labels, the ≤2,000-token boundary, and the adjudication queue itself all live in the FSL packages or
nowhere. The paper says so in §15; a reader skimming §1.1 will not notice.
