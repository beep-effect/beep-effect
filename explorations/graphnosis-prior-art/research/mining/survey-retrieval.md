# Graphnosis — retrieval pipeline & the determinism doctrine

Survey of `/home/elpresidank/YeeBois/dev/Graphnosis` (Apache-2.0, `@nehloo/graphnosis`).
Territory: `src/core/query/*`, `src/core/similarity/*`, plus README determinism sections
and the tests that guard them.

All line references were read directly, not grepped.

---

## 0. The shape of the thing

Retrieval is a **staged pure pipeline** over an in-memory dual graph, with every stage
in its own module and every stage's contract written into the option comments:

```
question
  │
  ├─ decomposeQuery(question)                    query-decomposer.ts    → sub-queries
  ├─ buildSynonymMap(graph) + expandQuery(...)   synonym-expander.ts    → ≤5 variants each
  │      (map memoized per-graph on a mutation signature)
  ├─ findSeeds(variant, tfidfIndex, …)           seed-finder.ts         → TF-IDF seed pool
  ├─ findSeedsByEmbedding(qVec, embIndex, …)     seed-finder.ts         → optional semantic pool
  │      (pools MAX-merged by nodeId)
  ├─ diversifySeedsBySource(...)                 query-engine.ts        → round-robin by source file
  ├─ traverseGraph(graph, seeds, …)              traverser.ts           → best-first BFS w/ decay
  ├─ downweightSummaryChildren(...)              query-engine.ts        → ×0.5 on summarizes-children
  ├─ expandWithStructuralContext(...)            query-engine.ts        → post-cut structural budget
  ├─ rerankByEmbedding(...)                      query-engine.ts        → 50/50 blend, optional
  ├─ stripRetired(...)                           query-engine.ts        → 4th retirement gate
  └─ serializeSubgraph(...)                      subgraph-serializer.ts → the prompt string
```

`queryGraph` is `src/core/query/query-engine.ts:183-441`. The stage boundaries are
labelled "Step 1 … Step 5" in the source and each has a *why* comment, not a *what*
comment. The dominant editorial style of this repo is: **the comment records the
defect that produced the code, with the measurement.** This is the single most
portable thing in the repo and I flag it as a process finding.

---

## 1. The tie-break module — the crown jewel

`src/core/query/tie-break.ts` is 91 lines, 37 of which are a doc comment that
tells the whole story.

### The mechanism

```ts
export interface TieKey { file: string; offset: number; hash: string; }

export function tieBreakKey(graph, nodeId): TieKey | null {
  const node = graph?.nodes.get(nodeId);
  if (!node) return null;
  return {
    file: node.source?.file ?? '',
    offset: node.source?.offset ?? 0,
    hash: node.contentHash ?? '',
  };
}

export function compareTieKeys(a, b): number {
  if (a === null || b === null) return 0;          // nulls compare EQUAL
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.offset !== b.offset) return a.offset - b.offset;
  if (a.hash !== b.hash) return a.hash < b.hash ? -1 : 1;
  return 0;
}

export function byScoreThenSource(graph) { /* memoised keyOf, score desc then compareTieKeys */ }
export function entryByScoreThenSource(graph) { /* same ordering over [NodeId, number] tuples */ }
```
(`tie-break.ts:40-91`)

### Why it exists — the four sub-decisions

1. **Score is not a total order.** `tie-break.ts:6-11`: "On a real corpus many nodes
   tie exactly — near-duplicate notes, templated content, the steps of one procedure —
   and `Array.prototype.sort` being stable means tied nodes otherwise keep whatever
   order they were DISCOVERED in, which is an artifact of how the candidate pool was
   built rather than anything about the query."

2. **Tie-breaking on node id is WRONG, and they shipped it and measured it.**
   `tie-break.ts:12-21`: ids come from `nanoid()` (graph-builder, incremental,
   session-summarizer) so they are not stable across ingests. "Measured on a
   40-question sample: evidence order differed on 21/40 and the evidence SET on 6/40,
   between two builds inside one single-threaded process. An id tie-break does not
   make ranking reproducible; it makes it reproducibly arbitrary within a build and
   freshly arbitrary between builds."

   This is the load-bearing insight. Most systems that "add a deterministic tie-break"
   reach for the surrogate key, which is exactly the field that is *not* stable under
   re-ingest.

3. **Tie on PROVENANCE, which survives re-ingest.** file → offset → contentHash.
   `tie-break.ts:23-27`: "All three are written into the `.gai` file and all three are
   recomputed identically from the same input, so the ordering holds across ingests,
   machines, processes and candidate-generation strategies."

4. **Compare fields one at a time, never a concatenated string key.**
   `tie-break.ts:29-32`: "there is no separator that provably cannot occur in a file
   path, and a wrong separator silently makes two different nodes compare equal."
   This is a genuinely under-appreciated bug class — `${file}|${offset}|${hash}` is
   the obvious implementation and it is wrong for paths.

5. **Unresolvable key → return 0, never fall back to id.** `tie-break.ts:33-36`:
   "A stable sort then preserves insertion order, which is what the engine did before
   any tie-break existed and which reproduced identically run to run.
   Arbitrary-but-stable beats random."

6. **Key memoisation inside the comparator factory** (`tie-break.ts:73-81`) because a
   sort touches each element O(log n) times and every lookup walks the node map.

### Where it is applied

- seed ranking, TF-IDF arm: `seed-finder.ts:134`
- seed ranking, embedding arm: `seed-finder.ts:163`
- merged seed pool before diversification: `query-engine.ts:323`
- final node selection in traversal: `traverser.ts:482`, used at `:499` and `:535`

**A second, independent tie-break lives in the traversal frontier** — the max-heap
compares `(score, seq)` where `seq` is a monotonic insertion index
(`traverser.ts:236, 252-253`): "A binary max-heap on `score`, with the insertion index
as a deterministic tie-break so an equal-scored pair cannot reorder between two runs on
the same graph — the same discipline `entryByScoreThenSource` applies to the final
ranking."

That is the real finding: **a heap introduces a nondeterminism an array did not have,
and they noticed.** Test §4 of `tests/unit/traversal-path-maximum.test.ts:291-317`
builds a deliberately tie-heavy graph (all weights 0.5) and asserts 8 identical
traversals produce byte-identical output — "a heap without a total order would reorder
between runs".

**Third**: `expandWithStructuralContext` has its own hand-rolled 7-level total order for
structural additions (`query-engine.ts:682-692`): priority → score → file →
chunkOrder → offset → section → type → contentHash. And the per-file chunk ordering at
`:605-611` is a 5-level cascade. These are inline rather than routed through
`tie-break.ts`, which is a mild inconsistency but the discipline is the same.

---

## 2. `asOf` — one named instant, and the three-time-field design

`query-engine.ts:42-181` is the `QueryOptions` interface. Three separate temporal
fields, and the doc comments explain why they are separate rather than one:

| field | default | governs |
|---|---|---|
| `now` | **unset** | *ranking* — expiry damping (×0.3) and the telemetry stamp. Never membership. |
| `retiredAt` | **`Date.now()`** | *membership* — the instant the four retirement gates assess against. |
| `asOf` | unset | supplies the DEFAULT for both; an explicit `now`/`retiredAt` still wins. |

Resolution is one line: `const retiredAt = opts.retiredAt ?? opts.asOf ?? Date.now();`
(`query-engine.ts:231`) and `const rankingNow = opts.now ?? opts.asOf;` (`:234`).

### The bug that forced the split

`query-engine.ts:99-109`: "letting `now` drive retirement meant a caller who passed a
historical instant for as-of RANKING silently re-admitted content that had been
forgotten after that instant."

Read that carefully — it is a **privacy/erasure bug produced by a determinism feature**.
The user asks for "rank as of last March"; retirement inherits that instant; content the
owner forgot in April comes back into the prompt. The fix was to make retirement default
to the wall clock *even though that costs the "retrieval reads no clock" property*:

`query-engine.ts:82-86`: "Reading the clock here is a deliberate trade against the
'retrieval reads no clock' property: **a guarantee a caller must opt into is not a
guarantee.**"

### Then the second-order problem, which is the actual novel bit

Having split the fields, the as-of-everything case had no name. `query-engine.ts:105-109`:
"a caller had to know to set two fields to the same value, and one of them (`retiredAt`)
defaults to the wall clock while the other defaults to unset. **Determinism you can only
get by reading an option list and correctly combining two fields is not a property anyone
relies on.** `asOf` is that combination, asked for by name."

Precedence is deliberately asymmetric so the dangerous direction stays closed
(`query-engine.ts:110-117`): `{asOf: T}` = "the graph as it stood at T";
`{asOf: T, retiredAt: 0}` = the audit view (rank as of T, retirement gates off);
a bare `now` still never affects retirement.

The README states this as the product claim (`README.md:292-316`): "Retrieval writes
nothing, and ranking depends only on the serialized graph state plus the query — so two
queries against the same `.gai` can be diffed and any difference is a real change. **The
one clock it reads is retirement**".

### The golden vector that guards it

`tests/unit/query-asof-determinism.test.ts`. Three things worth stealing:

- **The vector is over CONTENT and SCORE, never ids** (`:17-25`): ids are `nanoid()`, so
  freezing them produces a test that fails every run for an unrelated reason. Ranking
  ties are broken by `contentHash`, which is derived from content, so the ordered
  `(content, score)` sequence is stable even though the ids under it are not.
  *The test's comparison key is chosen to match the tie-break's key.*
- **The frozen literal, with the anti-pattern named in the comment** (`:101-110`):
  "The first draft of this block read `const GOLDEN = got;` — comparing the measurement
  to itself, which passes unconditionally and proves nothing… it is easy to write by
  accident because it looks like a golden vector and prints like one."
- **A discrimination check** (`:122-130`): a *different* question must produce a
  *different* vector, "or the golden vector is just asserting that retrieval returns
  something."
- Plus a regression guard that `now:1` alone still cannot re-admit retired content
  (`:133-142`) and that `asOf + retiredAt:0` returns ≥ `asOf` alone (`:144-152`).

---

## 3. Four independent retirement gates and the "unreachable guard" doctrine

Retired content is kept out of the prompt at **four** places, and the reasoning for each
is different:

1. **Seed admission** — `seed-finder.ts:22-37, 47-51`. This is "the one that matters
   most": a retired node stays in the TF-IDF index by design, "so without this filter it
   comes back as the rank-1 seed of the next query whose terms it matches, and every
   later stage inherits it." Applied *before* the top-K cut (`:129-135`) "so a tombstone
   cannot consume a seed slot that a live node would otherwise have taken."

2. **Traversal** — `traverser.ts:110-123, 196-199, 362/382/399`. Closes the path seeding
   alone cannot: "the `supersedes` edge runs old → new, so a query that seeds cleanly on
   the NEW node walks one backward hop straight into the fact it replaced"
   (`traverser.ts:380-382`). And crucially it blocks **conduction**, not just membership
   (`:189-193`): "leaving it as a pass-through would let a deleted node relay score
   between two nodes it alone connects, which is retrieval reading content the user
   forgot."

3. **Structural expansion** — `query-engine.ts:584-589`. The comment records the previous
   defect: the gate here tested `typeof validUntil === 'number'` with no instant at all,
   "which retires a still-valid temporal fact — a node valid until next year — years
   early, and disagreed with the traversal stage of the same read path."

4. **`stripRetired` before serialization** — `query-engine.ts:719-755`. Explicitly a
   *forward* guard: "Every future stage added between traversal and serialization — a
   reranker, a dedup pass, a host-supplied overlay — gets audited by this line for free."

### The instant is resolved ONCE

`query-engine.ts:220-231`: "Resolved ONCE so the four gates cannot disagree with each
other mid-query — a node that is live for seeding and retired for serialization, or the
reverse, is how a tombstone gets a slot no live node can use."

### The gate they deliberately DID NOT add

`traverser.ts:488-494` — inside the final selection filter:

> "No retirement check here. Every path into `nodeScores` — seed admission and the three
> conduction guards — is already gated, so a filter at this point is unreachable, and an
> unreachable guard cannot be mutation-tested: deleting it was caught 0 times in 10 runs.
> **Shipping a guard no test can fail buys false confidence, not safety.** The one
> deliberate second layer is `stripRetired` in query-engine, which IS exported and
> directly tested."

This is a mutation-testing-informed decision about *defense in depth*: a redundant guard
is only kept when it is independently testable. `stripRetired` is exported specifically
so it can be tested directly, and its doc says so (`:728-731`): "Given one instant
resolved per query, the three upstream gates make this unreachable today — which is
exactly why it cannot be proven through `queryGraph` and is tested directly instead. It
guards the stages that do not exist yet."

### The gate is passed as a PREDICATE, not as the graph

`seed-finder.ts:33-36` and `query-engine.ts:262-274`: the retirement gate travels into the
seed finder as `isRetiredSeed: (nodeId) => boolean` rather than as `graph` + an instant,
because `graph` *also* switches on provenance tie-breaking — "so routing the gate through
it would silently change seed ORDER as a side effect of turning retirement on… this change
must be measurement-neutral on corpora that contain no retired nodes at all."

That is a first-class insight about **capability plumbing in a measured system**: passing
a fat object to enable one behaviour silently enables every other behaviour keyed on it.

### The retirement/expiry split itself

`src/core/graph/retirement.ts` is outside the strict territory but is the shared vocabulary
the four gates use. Key facts:

- `isRetired` = administrative act (`retiredBy`, legacy `deletedAt`/`forgottenAt`, or a
  `supersedes` edge **corroborated by a `validUntil` stamp**) AND the instant has passed
  (`retirement.ts:34-45`).
- `isExpired` = `validUntil` reached with **no** administrative marker → damped ×0.3 in
  ranking, still eligible (`retirement.ts:56-64`, applied at `traverser.ts:463-465`).
- Before the split, `isRetired` was `validUntil != null && validUntil <= now`, which
  "treated every expired temporal fact as forgotten — 'my parking permit expires 30 June'
  vanished from prompts as though the owner had retracted it" (`retirement.ts:20-24`).
- The supersedes edge is **corroborating evidence, not a marker in its own right**
  (`retirement.ts:85-96`): it is a public union member with no direction validation, so a
  caller-supplied edge would otherwise "silently retire a live node at full confidence —
  markerless, clock-free (`validUntil` undefined means retired at EVERY as-of instant,
  including the `retiredAt: 0` audit hatch), persisted through `.gai`, and not undone by
  re-ingesting the source."
- **Confidence is never a liveness signal** in either direction (`retirement.ts:26-29`,
  `traverser.ts:454-456`): time-decay drives live memories to the same 0.1 floor a
  correction used to write, so keying liveness on it is ambiguous.
- `RETIRED_CONFIDENCE = 0`, not 0.1, precisely so it is distinguishable from decayed-live
  (`retirement.ts:127-135`).
- `blocksReingest` (`retirement.ts:236-243`): retired-by-`supersede` blocks re-ingest of
  the identical source text (the file still holds the text the user corrected away);
  retired-by-`delete` does not (forgetting a source then re-adding the file restores it).

---

## 4. `traversalOrder: best-first` — the (node, hop) dominance argument

This is the most technically interesting piece of algorithm work in the repo.

### The claim and the naive proof

`traverser.ts:31-45`: default `'best-first'` implements the paper's Theorem 3 — a node's
score is the MAXIMUM over all paths reaching it. Every hop multiplies by
`DECAY_FACTOR = 0.6` and an edge weight in (0,1], so score strictly decreases along any
path and pops arrive in non-increasing order; therefore the first pop of a node is its
path maximum and a node-keyed `visited` set is safe.

### Why that proof is INCOMPLETE — and they say so in the comment

`traverser.ts:45-50` and the full argument at `:291-308`:

> "an entry carries two resources, not one: its score AND how many hops it has left. A node
> first popped at (score 0.5, hop 2) can expand only one more level; a later entry at
> (score 0.3, hop 1) is worse on score but has budget to reach a level the first can never
> touch, and skipping it truncates the search."

So under a **hop budget** the search state is `(node, hop)`, not `node`. The fix:

```ts
const expandedAtHop = new Map<NodeId, number>();   // DOMINANCE, not membership
…
const prev = expandedAtHop.get(nodeId);
if (prev !== undefined && prev <= hop) continue;   // re-expand only at a STRICTLY smaller hop
expandedAtHop.set(nodeId, hop);
```
(`traverser.ts:309, 346-349`)

Because pops are non-increasing in score, every prior expansion of that node already had
score ≥ this one's, so **the only thing that can justify a repeat is strictly more hop
budget** — one comparison, and each node is bounded to ≤ `maxHops` expansions.

### How the bug was found

`traverser.ts:299-303`: "Caught by the random differential in
`tests/unit/traversal-path-maximum.test.ts` — **1 disagreement in 200 graphs, which
neither the hand-built counterexample nor 400 corpus queries found.**"

### The enqueue guard, and its cost measurement

`traverser.ts:311-340`, `worthVisiting(id, neighborScore, existing, nextHop)`:

- Under FIFO it is exactly the old `neighborScore > existing`.
- Under best-first the guard is keyed on **the best score seen for that node at that hop**
  (`bestAtHop: Map<NodeId, number[]>`), because "an entry that cannot improve a node's
  score can still be worth queueing when it arrives with more hop budget."
- "Admitting every such entry is correct but ruinous: **measured at 3.1× the FIFO query
  time on an 18,968-node graph**, because a node already scored higher was re-queued once
  per incoming edge. Keying on (node, hop) keeps every strictly better state and drops only
  states a queued entry already dominates on both score and budget, which bounds the heap
  at |V| × maxHops entries."
- Plus a cheap early return (`:326-333`): entries at the hop limit are popped and discarded
  without expanding, so pushing them is a heap insert + sift + pop + sift for nothing.
  "Measured on a 20,000-node graph: **86% of best-first pushes were these, and dropping
  them took the traversal from 110 ms to 47 ms.**" Their correctness argument for the skip:
  the score is already recorded in `nodeScores` before the call, so skipping the push
  cannot change any output.

### The premise is enforced at the LOAD FUNNEL, not just true today

`traverser.ts:50-57` admits the (0,1] edge-weight premise was asserted only for the ingest
path and *not* for `readGai` / the SQLite loader / `fromSerializable`. Test §2b of
`tests/unit/traversal-path-maximum.test.ts:139-172` then closes it: `fromSerializable`
must **refuse** `Infinity`, `NaN`, `-0.5`, `0`, and `1/DECAY_FACTOR` — while still
**accepting** `1.0000000000000002`, because "a 1-ULP cosine overshoot is a float artifact,
not a violation of intent, and it exists in already-written files. Refusing to open a
memory over one ULP would be a data-availability bug introduced in the name of a
correctness one."

And the source of that ULP is clamped: `cosine.ts:65-71` — "identical vectors measure
1.0000000000000002 often enough to matter, and **that value becomes an EDGE WEIGHT**.
Since 0.10.0 the traversal's path-maximum proof requires each hop's multiplier to stay
below 1, so a 1-ULP overshoot is the difference between an invariant that holds by
construction and one that holds by luck."

**A float-precision clamp in a similarity function is load-bearing for an algorithmic
correctness proof three modules away.** That linkage is spelled out in the code.

### Flipping the default was treated as a release decision

`traverser.ts:63-68`: "FLIPPING THIS DEFAULT WAS A RELEASE DECISION, not a code-review one.
It changes retrieval output on ~9% of real multi-session queries (6% get a different node
SET, not merely a different order), which invalidates every LongMemEval arm and the latency
tables measured before 0.10.0. **Those numbers must be re-run, not carried forward.**"

And `'fifo'` is kept purely as a reproduction path for published measurements — with a
follow-through most repos skip: `answer.ts:33-43` exposes `traversalOrder`/`scoreRule` on
the *answer* helper too, because "that escape hatch was unreachable from here, so no
benchmark harness built on `answerQuestion` could actually take it. **A reproduction path
that the harness cannot express is not a reproduction path.**"

The README carries the same honesty to the marketing surface (`README.md:415-423`): the
headline benchmark number is *deliberately not quoted* because the release line changed
retrieval.

---

## 5. Killing ambient state: env vars are not inputs

`traverser.ts:16-28` on `scoreRule`:

> "This used to be readable ONLY from `process.env.GNOSIS_SCORE_RULE`, at call time, inside
> this function. Scoring was therefore not a pure function of its inputs: an adopter with
> that variable set in their environment got different rankings from an identical graph and
> an identical query, with nothing in the API to reveal it, and **any published golden
> vector was valid only alongside an undeclared env state.** T4 ('same query, same memory,
> same answer') cannot hold under those conditions."

Resolution keeps the env var as a deprecated fallback so ablation harnesses keep running,
but the explicit option always wins (`traverser.ts:208-210`):

```ts
const additiveScoring = opts.scoreRule !== undefined
  ? opts.scoreRule === 'additive'
  : process.env.GNOSIS_SCORE_RULE === 'additive';
```

## 6. Retrieval is a READ: no clock, no write

`traverser.ts:414-441` is the design statement:

- **RANKING** is a pure function of `(graph, seeds)` by default. No clock, nothing written.
- **MEMBERSHIP** (retirement) defaults to the wall clock, deliberately.
- Standing **earned by use** is scored from `accessCount`, which is serialized graph state
  — "A memory recalled forty times outranks one recalled twice — permanently and
  reproducibly, because the count travels in the file."
- Standing **decided by the wall clock** was removed: "A ×1.3 boost for 'accessed within
  the last 24 hours' makes the same file and the same query rank differently on Tuesday
  than on Friday. That boost has been removed."
- Telemetry writes (`lastAccessedAt`, `accessCount++`) are opt-in via `recordAccess` AND
  require `now` (`:469-473`): "Telemetry is a write, and a write is never a side effect of
  a read."

`tests/unit/traversal-determinism.test.ts` guards all of it, including a subtle one at
`:88-111`: two nodes identical *except* for `lastAccessedAt` must rank identically **even
when a clock IS supplied**.

The retired-node conduction tests (`:194-253`) are notable for their own reason:

> "All THREE edge directions are exercised separately. BFS walks outgoing edges, incoming
> edges backwards, and undirected edges, in three separate loops with three separate
> guards — a fixture that covers only the outgoing one passes with the other two guards
> deleted. **(Measured: it did.)**"

Plus the retired-*seed* case (`:243-252`): "Dropping it from the result while still walking
out of it would let a forgotten memory choose the evidence without appearing in it —
invisible in the prompt, decisive over its contents. This is the case a 'filter the final
selection' guard misses."

And the `sourceFloor` tests pin *magnitude*, not just presence (`:318-323`): "Without a
second value, any `round < N` bound passes — including an unbounded round-robin, which is
the mechanism blamed for a measured four-point benchmark regression elsewhere in this repo."

---

## 7. Seeding-then-traversal vs pure vector search

### Seeding

Two independent seed pools, **max-merged by nodeId** into one map
(`query-engine.ts:276-316`):

- TF-IDF arm: each of the ≤5×6 expanded query variants contributes
  `SEED_COUNT * SEED_OVERSAMPLE` = 5 candidates; the caller's real budget (`maxSeeds`) is
  applied **once, after dedup** (`query-engine.ts:279-292`).
- Embedding arm: `embedCap = skipTfidf ? maxSeeds * 2 : 16`.

The merge is only sound because **both arms are on the same [0,1]-ish cosine scale**, and
this is stated as a contract (`seed-finder.ts:143-149`):

> "`minScore` and the returned `score` are both on the cosine scale, [-1, 1]. That is
> load-bearing twice over: the threshold is meaningless against an unbounded quantity, and
> `queryGraph` MAX-MERGES these scores into the same seed pool as the TF-IDF arm… Until
> 0.11.0 this used a bare dot product, so both contracts held only for unit-norm vectors —
> true for OpenAI, not guaranteed by the `EmbeddingAdapter` interface."

`cosine.ts:1-22` is the post-mortem: "Two local copies of 'dense cosine' previously lived
in `query/` — one of them divided by the norms and one did not, **and both were named for
a cosine.** The unnormalized one returned a bare dot product, so its caller's `minScore`
threshold was being compared against an UNBOUNDED quantity: a score of 250 cleared a
threshold of 1.0, the strictest value a cosine-scaled knob can even express. It is exactly
right whenever both vectors are unit-norm and exactly wrong otherwise, **which is the worst
failure mode available**."

### Candidate restriction via postings — exact, not approximate

`seed-finder.ts:107-127` + `tfidf.ts:243-285`. A `DerivedIndex` (per-node tf-idf vectors +
term→nodes postings) is cached in a `WeakMap` keyed on the index object, invalidated by a
`generation` counter bumped by every writer (`tfidf.ts:230-241`).

The correctness argument is that the restriction is **exact, not a heuristic**
(`tfidf.ts:256-265`): "cosine similarity is a sum over SHARED terms, so a document sharing
none of the query's terms scores exactly zero and is discarded anyway. Restricting scoring
to the union therefore produces the same non-zero result set as a full scan."

Invalidation is whole-index, and they justify that too (`tfidf.ts:230-238`): "IDF is a
corpus-wide statistic, so appending a single document changes the weight of every term in
every other document. A per-node invalidation would leave the rest of the cache
confidently wrong." The test (`tests/unit/derived-index.test.ts:1-16`) names the two
properties as PARITY and FRESHNESS and is written so removing either fails.

### Diversification: two distinct knobs, and the honest measurement of both

- `diversify` (default **true**) — round-robin seeds by `source.file`
  (`query-engine.ts:447-479`). Scope note at `:127-134`: "this shapes what ENTERS
  traversal, not what survives it… On a six-source counting fixture, **seed
  diversification alone still left 19 of 20 final nodes belonging to one source.**"
- `sourceFloor` (default **OFF**) — reserve N final subgraph slots per source
  (`query-engine.ts:136-155`, implemented `traverser.ts:502-538`). The framing is the good
  part: "Score alone answers 'what is most relevant', which is right for a lookup and
  **wrong for an aggregation**… The answer that comes back is then a correct count of an
  incomplete set, **stated with the confidence of a complete one.**"
- And it is left off *because the trade is real*: "Measured on conversation-shaped content
  at floor 1: sources in the subgraph 9 → 12, deepest source 7 nodes → 2, **40% of the
  subgraph replaced**… Left off by default for that reason — it is a trade to measure per
  corpus, not a strict improvement." Explicitly NOT wired to `diversify`
  (`query-engine.ts:366-375`) because that would change retrieval for every existing caller.

Implementation detail worth noting: after the floor picks members, the result is re-sorted
into score order — "the floor decides membership, not presentation" (`traverser.ts:534-535`).

### Structural nodes conduct but do not occupy

`traverser.ts:149-173` — `document`/`section` nodes "exist to give the graph shape rather
than to answer anything." In a conversation ingest their headings are "turn 3"/"user 1".
They matter for **connectivity** (a document joins every section, each section its turns),
so once hierarchy edges resolved, "a single reachable turn puts an entire source two hops
away, scaffolding included — and **on a 30-node budget that measured 18 slots of headings
against 12 of content**."

Resolution: they are dropped **before selection** unless they were seeds
(`traverser.ts:484-498`) — "a '## Deployment checklist' is real signal, which is why
section nodes are indexed on purpose. What they no longer do is occupy a slot merely for
having been walked through." The seed exemption is the elegant part: *if the query matched
the heading, the heading is the hit.*

### Post-cut structural expansion — a separate budget

`query-engine.ts:556-717`, budget = `floor(maxNodes * STRUCTURAL_EXPANSION_BUDGET_SHARE)`
where the share is 0.5 (`constants.ts:21-25`): the slots "sit beside, rather than inside,
`TOP_K_NODES` so traversal cannot evict the anchor that earns the context."

Two rules:
- **Conversation rule**: for each selected `Assistant (turn N)` chunk, admit the paired
  `User (turn N)` chunks at `0.9 ×` the anchor's score, priority 0 (`:631-646`).
- **Document rule**: within the same file, admit chunks by distance from the nearest
  anchor, `anchorScore * 0.9^distance`, priority 1 (`:648-679`). Conversation-shaped files
  are excluded wholesale so a summary node cannot unroll a session.

The load-bearing subtlety (`query-engine.ts:653-657`): **distance is persisted
`chunkOrder`, not position among surviving live chunks.** "Two common gaps make those
disagree: section nodes between content already occupy intervening orders on every
multi-section document, and retirement leaves holes in the sequence. Survivor-index
distance understates both — treating the next live content neighbor as adjacent."

### The ablation hook that makes the baseline honest

`seedsOnly: true` (`query-engine.ts:176-180`, `:328-344`) returns the merged seed pool the
graph arm would traverse from — same decomposition, same synonym expansion, same seed
budget — with no traversal, typed edges, or temporal scoring. `answer.ts:125-180` consumes
it as the `naive-topk` baseline "so the only difference from the graph arm is the graph
structure itself."

That is the right way to build a flat-RAG control arm and most papers do not do it: they
compare against a *differently seeded* top-k, which moves two variables at once.

---

## 8. Subgraph → prompt serialization

`src/core/query/subgraph-serializer.ts`, 116 lines. Output:

```
=== KNOWLEDGE SUBGRAPH (N nodes, M edges) ===

--- SESSION SUMMARIES ---
[n1|summary|0.83|session:s3|date:2024-05-02] <content>
  claims: I bought 30 lbs of coffee beans | I switched to a light roast

--- NODES ---
[n2|fact|0.49|src:User (turn 4)|date:2024-05-02] <content>

--- DIRECTED ---
n2 -[causes:0.8]-> n5

--- UNDIRECTED ---
n2 ~[similar-to:0.4]~ n7
```

Mechanisms worth naming:

1. **Short ids assigned by rank** (`:24-28`): `n1..nK` in score order. The model never sees
   a `nanoid` — which is both token-efficient and, incidentally, prevents unstable ids from
   leaking into the prompt at all. Edges are emitted only when *both* endpoints resolved to
   a short id (`:82-86`).
2. **Three separate blocks with different epistemic roles** (`:30-36`): summaries are
   "index-level context (what happened in each session)", turns are "the ground-truth
   quotes". `document`/`section` nodes are filtered out of the evidence block entirely.
3. **`claims:` sub-lines on summaries** (`:49-58`): atomic, countable facts in the user's
   own voice, split on ` || `, capped at 10 — "so the LLM can enumerate countable events
   directly rather than inferring them from compressed prose." The multi-session prompt
   block then instructs the model to start there (`router.ts:176-186`).
4. **Inline metadata as pipe-delimited tags**: `src:` (provenance, §1 of their five
   requirements) and `date:YYYY-MM-DD (Day)` (temporal reasoning). The prompt teaches the
   model to treat the day-of-week in the tag as authoritative
   (`query-engine.ts:836-844`).
5. **Weights are printed** (`:84`, `:97`) at 1 decimal, scores at 2 — the model sees edge
   strength, not just edge existence.
6. `serializeEnrichedSubgraph` (`query-engine.ts:758-790`) appends an
   `--- ENRICHED INSIGHTS ---` block for nodes carrying LLM `synthesis`, skipping any
   below score 0.1.
7. The empty case is a fixed string, not an empty prompt (`query-engine.ts:352`).

**Note the coupling to §1**: the serializer sorts by score *alone* (`:18-22`). The
tie-break comment (`tie-break.ts:15-17`) calls this out as why the ordering defect reached
the prompt. It is safe today only because ES2019+ `Array.prototype.sort` is stable and the
input arrives pre-tie-broken. That is an implicit contract with no test on it.

---

## 9. Why they refuse to port the engine to other languages

`README.md:61-67` — a boxed note under "Use it from any language":

> "There is one implementation of the engine, on purpose. Retrieval from a fixed graph is
> deterministic — the same `.gai` and question give the same subgraph — and **independent
> ports are the fastest way to lose that, because tie-breaking, hash iteration order and
> Unicode handling all differ subtly between runtimes.** Cold ingest that enables optional
> LLM summaries is not deterministic unless those generated summaries are pinned. So other
> languages get a process boundary, not a rewrite."

Every clause maps to something concrete in the code I read:

- **tie-breaking** → `tie-break.ts` in full; the field-at-a-time comparison; the `null → 0`
  fallback that relies on `Array.prototype.sort` stability, which is ES2019-specified but
  *not* guaranteed by Python's `sorted` in the same way, and definitely not by Go's
  `sort.Slice`.
- **hash iteration order** → the pipeline is saturated with `Map`/`Set` iteration whose
  order feeds results: `seedMap.values()` (`query-engine.ts:323`), `candidates` Set
  (`seed-finder.ts:113-120`), `nodeScores` entries (`traverser.ts:487`), `candidateById`
  values (`query-engine.ts:681`), `graph.directedEdges.values()` in edge collection
  (`traverser.ts:547`). JS `Map`/`Set` are **insertion-ordered by spec**; Go maps are
  deliberately randomized; Python dicts are insertion-ordered but `set` is not. A port
  would silently produce a different subgraph anywhere the tie-break returns 0.
- **Unicode** → `asciiFoldAnalyzer` does NFD + combining-mark strip
  (`analyzer.ts:64-75`); `unicodeAnalyzer` uses `\p{L}\p{N}\p{M}` (`:102-109`);
  `createLocaleAnalyzer` uses `toLocaleLowerCase(lang)` for Turkish dotted-I
  (`:121-134`); `synonym-expander.ts:91-98` replaces `\b` with lookarounds against
  `[\p{L}\p{N}\p{M}_]` because "`\b` is ASCII-only: for a fully non-Latin word ('știe',
  '记住') `\bștie\b` never matches". NFD normalization forms and locale-lowercasing tables
  differ across runtimes and ICU versions.
- **the LLM escape hatch** → they name the one place determinism does *not* hold: cold
  ingest with optional LLM summaries.

The compensating design is **a process boundary, not a rewrite**: HTTP (`serve`, port 7777)
and MCP over the same binary (`README.md:47-59`), plus a `.gai` **conformance suite**
(`spec/conformance.mjs`) shipped so a hypothetical second reader can be checked:

> "Half the fixtures are malformed on purpose: the useful question about a format reader is
> not what it accepts but what it REFUSES. A reader that parses `bad-checksum.gai` without
> complaint is not conforming, however well it handles valid input. A second
> implementation, in any language, should be able to run the same fixtures and reach the
> same verdicts."

So: **one engine, many callers, a spec'd format, and a conformance suite that tests
refusals.** That is a coherent multi-language strategy that does not require porting the
determinism-critical code.

---

## 10. The analyzer identity / fail-closed contract

Not strictly "retrieval" but it is the substrate the determinism rests on.

- `TextAnalyzer` has a stable `id` persisted on both `IndexProvenance.adapterId` and
  `GraphMetadata.analyzerAdapterId` (`analyzer.ts:27-40`). "Two analyzers with the same
  `id` MUST produce token streams compatible for cross-comparison."
- `EmbeddingAdapter.id` follows the same rule with a stated encoding convention
  (`embedding-adapter.ts:23-41`): `'openai:text-embedding-3-small@1536'`,
  `'voyage:voyage-3-large@1024:document'` — "encode every property that affects the vector
  space: model name, output dimension, intent."
- Load-time mismatch **throws** `AnalyzerMismatchError` rather than substituting a default
  (`tfidf.ts:213-219`, `analyzer.ts:190-201`): "Returns `undefined` for ids this build does
  not know… callers should surface that as a mismatch rather than silently substituting a
  default, which is the drift this whole mechanism exists to prevent."
- **The migration contract** (`analyzer.ts:167-183`) is the sharp part: a shipped
  analyzer's behaviour may never be changed in place, because `rebuildIndex()`'s
  fail-closed guarantee only holds if a graph can still *obtain* the analyzer it was built
  with. So the buggy `ascii-fold` (union stopwords) is preserved verbatim forever, and new
  graphs default to `ascii-fold-en`. "Adopting the corrected analyzer is an explicit act —
  a full re-ingest from retained sources — not something that happens underneath a user on
  upgrade."

### The union-stopword bug, and the asymmetry that decides the default

`analyzer.ts:136-160`. `STOPWORDS` was the union of 16 languages (1,047 terms), so:

```
"my car broke during the war"  ->  ["broke"]
```

`car` is French ("because"), `war` is German ("was"), `die` is Dutch. Also lost: `same`,
`once`, `one`, `come`, `also`, `can`, `no`.

The decision rule is the reusable bit:

> "a MISSING stopword is nearly free — a function word has high document frequency, so idf
> drives its weight toward zero and it barely moves cosine. A WRONG stopword is destructive
> and unrecoverable: the term never enters the index, so no query can ever retrieve on it.
> **Union-by-default optimizes the cheap direction at the expense of the expensive one.**"

### One canonical index rebuild

`buildIndexFromGraph` (`tfidf.ts:182-228`) exists because three loaders disagreed:

| loader | sections | analyzer |
|---|---|---|
| the builder | IN | graph's analyzer, id stamped |
| SDK `rebuildIndex` | IN | resolved, fails closed |
| MCP cache | **OUT** | `ascii-fold` **unconditionally**, no check |

"`documentCount` appears in the idf numerator for every term, so changing which nodes are
indexed changes the score of every query — **the same file scored differently depending on
which loader opened it.**" Fixed policy: exclude `document` (title-only, duplicates section
content), include `section`, skip blanks, resolve the analyzer or throw. `mcp/tfidf-cache.ts`
now delegates and its cache key includes `analyzerId` alongside mtime.

Related: `addDocument` counts **distinct documents, not calls** (`tfidf.ts:81-90`) because
it doubles as an upsert — "incrementing unconditionally made `documentCount` drift above
`documents.size`, one per edit, permanently… the longer a cortex is used the further it
drifts." And `computeIdf` **rebuilds rather than merges** (`tfidf.ts:103-110`) because
editing a node can remove a term from the corpus entirely.

### The morphology fallback and the "wrong key is worse than no key" law

`tfidf.ts:142-179`. Query-time-only plural/singular fallback (`-es`, `-s`, `+s`). The
insight (`:150-157`):

> "The recovered weight MUST be stored under the form that actually exists in the index,
> not under the query's spelling… a weight filed under the query spelling can never meet
> its document — **while still enlarging the query norm, which strictly LOWERS the score of
> every document that does match on other terms.** Filed that way the fallback was worse
> than no fallback at all: an unmatched term contributes 0 and is harmless, but a mis-keyed
> one is a penalty. Measured on a plural/singular fixture, the true document scored 0.488
> mis-keyed, 0.699 with the fallback removed, and 1.000 keyed canonically."

Plus accumulate-not-assign (`:173-176`) because "sensor" and "sensors" in one question
normalize onto the same canonical key.

---

## 11. Synonym expansion — regex-injection and Unicode hazards

`synonym-expander.ts`. The synonym map is built from the graph's own `similar-to` /
`shares-entity` edges with weight ≥ 0.4, cross-pollinating node entities, keeping the top
5 related terms per entity with weight > 0.5 (`:35-78`).

- **Memoised per graph object** in a `WeakMap` keyed by a cheap mutation signature
  `(undirectedEdges.size, metadata.version, metadata.updatedAt)` (`:10-33`). The soundness
  argument is stated: "a miss only ever costs a rebuild, never a stale result. The WeakMap
  keys on object identity, so distinct graphs never collide regardless of signature."
- **`escapeRegExp` on synonym terms** (`:80-89`), because terms are entity names extracted
  from user content: "'c++', 'node.js', 'US$' are all real. Unescaped, 'c++' throws
  SyntaxError ('nothing to repeat') **and takes the whole `queryGraph()` call down with
  it**; 'node.js' silently matches 'nodeXjs'." This is user-content-driven regex
  construction — a real DoS/correctness surface most codebases get wrong.
- **Replacer function, not a bare replacement string** (`:120-123`), because a synonym
  containing `$` ("US$") would be interpreted as a replacement pattern.
- **Unicode word boundaries** replacing `\b` (`:91-98`), as quoted in §9.
- **Short-term guard** (`:136-143`): terms of length ≤ 2 get boundary anchors because a
  single-char entity "x" would corrupt every word containing the letter
  ("expected" → "e<syn>pected"); longer terms keep documented substring behaviour.
- **The containment pass runs exactly once**, at the first word's position, to preserve
  insertion order (the final `slice(0,5)` is order-sensitive) while collapsing an
  O(terms × words) scan to O(terms) (`:108-115`, `:131`, `:152`).

`query-decomposer.ts` is aggressively multilingual: conjunction splitting across 9
languages, `\p{Lu}\p{Ll}` capitalized-phrase extraction, 7 quote styles including
guillemets and CJK brackets, CJK character-run extraction, and action-concept mapping
across ~12 languages. Capped at 6 sub-queries.

---

## 12. The router — question-type classification driving retrieval dials

`src/core/query/router.ts`. Six LongMemEval categories. One function
(`classifyQuestion`, `:97-107`) maps question text → category by ordered regex, first match
wins; a second (`getRetrievalStrategy`, `:109-145`) maps category → dials; a third
(`buildCategoryPromptBlock`, `:151-208`) maps category → prompt directive.

| category | maxSeeds | maxNodes | diversify | preferSummarySeeds |
|---|---|---|---|---|
| single-session-user / -assistant | 24 | 20 | false | false |
| single-session-preference | 28 | 25 | false | false |
| multi-session | 40 | 50 | true | true |
| temporal-reasoning | 32 | 40 | true | true |
| knowledge-update | 32 | 40 | true | true |

Design notes worth keeping:

- **Ordering is the algorithm.** `STRONG_AGGREGATION_INTENT` runs *before* temporal and
  knowledge-update, with a negative lookahead excluding pure time-elapsed forms — so
  "how many events in the past month" is a count, not a temporal question, while "how many
  days have passed" still is (`router.ts:82-89`). `PREFERENCE_INTENT` runs before
  knowledge-update because "my current setup" would otherwise trigger KU's "current".
- **Ground truth is never used by default** (`router.ts:16-18`): "Runtime detection is
  prioritised. Ground-truth `question_type` is never used by default — we publish an honest
  leaderboard number measured the same way as Zep / Mastra." `RouterDecision.source` records
  `'regex' | 'explicit'` for telemetry (`:36-43`).
- **The router is A/B-gated.** `useRouter` defaults false and the legacy inline-regex path
  is preserved verbatim so "Run 14's behavior [is] byte-for-byte reproducible"
  (`query-engine.ts:170-175`, `:189-217`, `:846-876`).
- **Category → blocked edge types.** `routerBlockedEdges` (`query-engine.ts:519-526`) blocks
  the `summarizes` edge for single-session questions so a summary seed cannot unroll an
  entire session; blocked types are dropped from the serialized subgraph too, not just from
  traversal (`traverser.ts:542-552`).
- **Summary-child down-weighting** (`query-engine.ts:532-550`): when a summary survives,
  halve its `summarizes` children so the prompt is not filled with fact-duplicated material.

### `blockedEvidencePrefixes` — the generic version of the same idea

`traverser.ts:100-108`. Edges carry an `evidence` string; traversal will not *follow* an
edge whose evidence starts with a blocked prefix. The motivating case is trained skills:

> "A skill is a chain of step nodes joined by `precedes` edges tagged `skill:seq`. Those
> nodes live in the same lexical index as ordinary knowledge, so a factual query can seed
> into one step by vocabulary overlap — and then unroll the ENTIRE procedure into a budget
> meant for facts. **The harm is the chain, not the node**: one relevant step surfacing is
> the cortex working. So this blocks propagation, never membership."

And the SDK deliberately declines to set a default (`query-engine.ts:69-73`): "the SDK is
generic and has no opinion about what an evidence namespace means. **The host that OWNS a
namespace — the app, for 'skill:' — sets it at its own retrieval boundary.**"

That is a clean layering rule: *namespace semantics belong to whoever mints the namespace.*

---

## 13. Process craft inventory

| practice | evidence |
|---|---|
| Comments record the defect + the measurement that produced the code | throughout; e.g. `traverser.ts:326-333` (110ms→47ms), `tie-break.ts:17-21` (21/40, 6/40), `constants.ts:41-47` (−4 pts, p=0.006) |
| Non-vacuity assertions inside tests | `traversal-path-maximum.test.ts:98-100` ("the two orders genuinely DIFFER"), `:285-288` ("the random graphs DO exercise the defect"), `:132` ("the check is not vacuous") |
| Random differential vs brute force with a deterministic PRNG | `traversal-path-maximum.test.ts:174-289` — mulberry32, 2000 trials, exhaustive path enumeration; "a test that fails one run in twenty is not a guard" |
| Fixture design chosen so the defect *can* appear | `:236-238` "Weights… deliberately spread so path maxima disagree with arrival order — a uniform-weight graph cannot exhibit the defect, which is exactly why the synthetic T3 corpus showed zero difference"; `:242-246` a third of edges undirected because "a differential that skips a whole branch proves nothing about it"; `:254-258` multiple seeds at different scores so heapify is not trivially ordered |
| Mutation testing used to *delete* guards, not only to add tests | `traverser.ts:488-494` ("deleting it was caught 0 times in 10 runs"); `traversal-determinism.test.ts:198-201` ("Measured: it did") |
| Golden vectors keyed on stable fields, with an explicit "do not regenerate reflexively" note | `query-asof-determinism.test.ts:17-25, 101-110` |
| Evidence bundles that verify themselves | `benchmarks/evidence/verify.mjs` — sha256 checksums, filename-vs-rows accuracy, and every asserted delta recomputed; exists because a manifest claimed +11.8 when its rows gave 13.40 and "nothing caught it because nothing was checking" |
| Delta pairing is named so you cannot compare across two changed variables | `verify.mjs` DELTAS comment: "13.2 is the TF-IDF graph-vs-flat delta (62.2 − 49.0) and comparing 78.0 against the same flat arm instead would move two variables at once" |
| Format conformance suite that tests REFUSALS | `spec/conformance.mjs:1-14` |
| Constants carry their own decision record | `constants.ts:27-57` — `SEED_OVERSAMPLE = 1` with the for/against measurement and "the next retrieval experiment should reserve depth in the top few sessions, not widen this global pool" |
| A benchmark number is withdrawn when the code under it changes | `README.md:415-423` |
| Legacy-format fixture checked into the repo | `tests/fixtures/legacy-v080-four-producers.gai` + `legacy-retirement-v080.test.ts` |

---

## 14. Antipatterns / things not to copy

1. **`compareSeeds` is exported dead code whose doc contradicts its body.**
   `seed-finder.ts:80-94`: a 9-line JSDoc explains provenance tie-breaking and warns against
   node ids; the body is `return b.score - a.score;` — score only, no provenance. `grep`
   across `src`, `tests`, `spec` finds zero call sites. A reader porting this file would
   reasonably copy it as "the seed comparator" and lose the entire tie-break discipline.

2. **The serializer's own sort is not tie-broken.** `subgraph-serializer.ts:18-22` sorts by
   score alone. It happens to preserve the upstream tie-break because ES2019 `sort` is
   stable and the input is pre-ordered — an implicit, untested contract in the *one module
   whose output reaches the model*, and precisely the module the tie-break doc blames for
   the original leak (`tie-break.ts:15-17`).

3. **Per-query O(V + E) rebuilds.** `traverseGraph` builds three full adjacency maps over
   *every* edge on every call (`traverser.ts:213-233`), and `collectSupersededIds` scans all
   directed edges (`retirement.ts:216-222`, called at `query-engine.ts:238`), and
   `expandWithStructuralContext` iterates every node in the graph and re-sorts every file's
   chunks (`query-engine.ts:584-612`), and final edge collection scans all edges again
   (`traverser.ts:547, 555`). The TF-IDF side has a generation-invalidated `DerivedIndex`
   and the synonym map has a WeakMap cache — the *graph* side has neither. Cost is
   proportional to corpus size, not result size, on every question.

4. **`process.env.GNOSIS_SCORE_RULE` is still a live fallback** (`traverser.ts:208-210`).
   The module's own doc calls it the reason "T4 cannot hold" and "any published golden
   vector was valid only alongside an undeclared env state" — and then keeps it reachable
   for callers who pass no explicit `scoreRule`, which is the default path. Deprecated-but-
   live ambient state in the function whose purity is the product claim.

5. **The router is a wall of hand-tuned English regexes calibrated to one benchmark.**
   `router.ts:45-95` — five multi-hundred-character alternations, explicitly "Calibrated
   against the actual LongMemEval_s question distribution", including literal
   `valentine'?s day` and `new year'?s` (`:65`). It is monolingual while
   `query-decomposer.ts` and the analyzers are carefully multilingual, ordering is
   load-bearing and untested here, and the phrase list is a standing overfit-to-the-eval
   risk. Steal the *architecture* (classify → dials + prompt block, with `source` recorded
   and ground-truth off by default); do not steal the patterns.

6. **Prompt-block duplication.** The multi-session/aggregation directive exists twice,
   verbatim: `query-engine.ts:861-874` (legacy inline path) and `router.ts:176-187`. Kept
   deliberately for A/B parity, but it is copy-paste that will drift, and there is no test
   asserting the two remain identical.

Minor: `getTfidfVector` is imported but unused in `seed-finder.ts:4`.
`rerankByEmbedding` (`query-engine.ts:485-514`) mutates `result.scores` in place and
renormalizes traversal scores by the per-query max, so post-rerank scores are not
comparable across queries — fine for ordering, misleading if surfaced.

---

## 15. One-paragraph summary

Graphnosis treats "the same question against the same file returns the same subgraph" as a
product-level guarantee and then does the unglamorous work to actually hold it: a
centralized comparator keyed on `(source.file, source.offset, contentHash)` rather than the
`nanoid` primary key, because ids are re-minted per ingest; a max-heap frontier with a
monotonic insertion-index tie-break so the heap cannot reorder ties; three deliberately
separate time inputs (`now` for ranking, `retiredAt` for membership, `asOf` naming their
combination) whose separation was forced by a real leak where a historical ranking instant
re-admitted forgotten content; four independent retirement gates with the instant resolved
once per query; ambient `process.env` scoring pulled into typed options because "a published
golden vector was valid only alongside an undeclared env state"; and a stated refusal to
port the engine to other languages because tie-breaking, hash-iteration order and Unicode
handling differ across runtimes — offering a process boundary and a `.gai` conformance suite
instead. The retrieval pipeline itself is seed-then-walk rather than pure vector search:
lexical (or hybrid) seeding into an exact postings-restricted TF-IDF candidate set,
round-robin source diversification, a best-first BFS over `(node, hop)` dominance state that
implements a documented path-maximum theorem, structural nodes that conduct but do not
occupy budget, a separate post-cut structural-completion budget, and a serializer that hands
the model rank-assigned short ids, typed edges with weights, and provenance/date tags. The
most transferable asset in the repo is not any single algorithm — it is the commenting
discipline: nearly every non-obvious line carries the defect it was written to fix and the
measurement that decided it.
