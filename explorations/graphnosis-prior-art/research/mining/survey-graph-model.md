# Graphnosis survey — territory: dual-graph data model & mutation semantics

Repo: `/home/elpresidank/YeeBois/dev/Graphnosis` (Apache-2.0, `@nehloo/graphnosis` v0.11.0,
Nehloo Interactive LLC). Read at commit `7a19c4b`.

Files read in full for this territory:

- `src/core/types.ts` (394 lines)
- `src/core/constants.ts` (265)
- `src/core/graph/content-hash.ts` (50)
- `src/core/graph/graph-builder.ts` (202)
- `src/core/graph/graph-store.ts` (132)
- `src/core/graph/directed-edges.ts` (103)
- `src/core/graph/undirected-edges.ts` (345)
- `src/core/graph/incremental.ts` (306)
- `src/core/graph/retirement.ts` (243)
- `src/core/persistence/sqlite-store.ts` (330)

Read for context because they define or consume the model's semantics:
`src/core/query/traverser.ts`, `src/core/query/tie-break.ts`,
`src/core/corrections/correction-engine.ts`, `src/core/corrections/confidence.ts`,
`src/core/optimization/deduplicator.ts`, parts of `src/core/query/query-engine.ts`
and `src/core/query/seed-finder.ts`, `SPEC.md` §3–§8, `AGENTS.md`, `CHANGELOG.md`,
`tests/unit/{graph-integrity,traversal-path-maximum,legacy-retirement-v080}.test.ts`.

---

## 0. What this territory actually is

The data model is deliberately tiny — five interfaces and three string-literal unions —
and essentially all the intellectual content lives in (a) the *semantics* attached to
three or four scalar fields, and (b) 800+ lines of load-bearing comments that record
measured defects and the reasoning behind each rule. The comment density is not padding:
almost every comment in `retirement.ts`, `incremental.ts`, `undirected-edges.ts` and
`graph-store.ts` names a specific defect that shipped, the corpus it was measured on, and
the counterfactual that was rejected. This repo is, in effect, a worked example of
"the invariant plus the receipt for why the invariant exists" as a code-comment discipline.

The dual graph itself is almost trivially simple. The interesting content is:

1. the **retirement / expiry split** and its knock-on effect on re-ingest;
2. the **identity story** (nanoid ids, content hash, chunk key, provenance ordering);
3. the **determinism discipline** — the repo treats "same file + same query ⇒ same answer"
   (they call it T4) as a hard requirement and repeatedly refuses otherwise-attractive
   designs because they leak nondeterminism;
4. **policy provenance in graph metadata** — because derived edges are persisted and never
   rebuilt, the *policy* that built them has to travel in the file.

---

## 1. The dual graph, verbatim

`src/core/types.ts:50-127`:

```ts
export interface GraphNode {
  id: NodeId;                       // nanoid, fresh per ingest
  content: string;
  contentHash: string;              // DJB2/36, see §4
  type: NodeType;
  source: SourceReference;          // { file, offset, line?, section? }
  entities: string[];
  metadata: Record<string, string | number>;
  level: number;                    // hierarchy level (0 = leaf, 1+ = summary)
  confidence: number;               // 0-1, extraction confidence
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  validUntil?: number;              // dual-meaning; see §2
}

export interface DirectedEdge   { id; from: NodeId; to: NodeId; type: DirectedEdgeType;
                                  weight: number /*0-1*/; evidence?: string; createdAt?: number }
export interface UndirectedEdge { id; nodes: [NodeId, NodeId]; type: UndirectedEdgeType;
                                  weight: number; createdAt?: number }

export interface KnowledgeGraph {
  id; name;
  nodes: Map<NodeId, GraphNode>;
  directedEdges: Map<EdgeId, DirectedEdge>;
  undirectedEdges: Map<EdgeId, UndirectedEdge>;
  levels: number;
  metadata: GraphMetadata;
}
```

Vocabularies (`types.ts:16-41`, `:79-109`):

- `NodeType` — 20 members in 6 semantic families: content (`fact concept entity event
  definition claim data-point`), structural (`section document`), identity (`person
  organization preference`), conversation (`conversation message`), multimodal (`image
  video transcript visual-description`), and one benchmark-driven type (`session-summary`).
- `DirectedEdgeType` — 15 members: logic/structure (`causes depends-on precedes contains
  defines cites contradicts supports`), temporal/identity (`supersedes discussed-in knows
  works-with reports-to collaborated-on prefers`), plus `summarizes`.
- `UndirectedEdgeType` — 7: `similar-to co-occurs shares-entity shares-topic same-source
  same-person related-to`.

Note the honesty of the comments: several members are annotated with the exact reason they
exist (`| 'summarizes'` carries "LongMemEval Phase 2: session-summary → turn"). The
vocabulary was grown by benchmark pressure and they say so.

**Direction conventions that matter.** `supersedes` runs **old → new** (`SPEC.md:150`,
`correction-engine.ts:276-285`). This is the single most consequential arrow in the model,
because it means a query that seeds cleanly on the *new* node is one backward hop away
from the fact it replaced — see §5.

### Why both layers are walked together

`src/core/query/traverser.ts:212-233` builds three adjacency maps from the same node set —
`outEdges`, `inEdges` (directed, indexed both ways), and `undirectedAdj` — and then, in one
frontier pop (`:358-411`), relaxes all three:

```ts
// out:        neighborScore = decayedScore * edge.weight
// in (back):  neighborScore = decayedScore * edge.weight * 0.5   // backward penalty
// undirected: neighborScore = decayedScore * edge.weight
```

So the layers are not alternatives or fallbacks — they contribute into one `nodeScores` map
in the same pass, and the only asymmetry is that following a directed edge *backwards*
costs an extra ×0.5. `SPEC.md:261-270` elevates this to a conformance expectation:

> a reader claiming to implement dual-graph retrieval is expected to: walk **both** edge
> layers in one pass rather than treating undirected edges as a fallback; decay score with
> distance from the seed; treat `weight` as a multiplier on propagated score; break ranking
> ties deterministically.

The design claim (AGENTS.md "Architecture Principles" #1) is that typed logic edges give
the LLM chain-of-thought paths, while association edges give recall breadth, and that having
both over the *same* node set is what makes a single walk produce "reasoning + neighbourhood"
instead of one or the other. That's the thesis; the repo does not present a controlled
ablation of "dual vs directed-only", only a max-wins vs additive scoring ablation
(`tests/ablation-scoring/maxwins-vs-additive.ts`).

---

## 2. `validUntil` carries two different facts — and the disambiguator is a marker

This is the strongest single idea in the territory.

`types.ts:64-75` documents the field's four states:

```
//   - unset                              → live
//   - set, still in the FUTURE           → live (temporal fact not yet due)
//   - set, reached, WITH retirement mark → retired (excluded from prompts)
//   - set, reached, NO retirement mark   → expired (damped in ranking, still
//                                         eligible — see `isExpired`)
// Never test this field by hand for liveness; use `isRetired` / `isExpired`.
```

`retirement.ts:3-33` explains the defect this replaced:

> Before this split, `isRetired` was `validUntil != null && validUntil <= now`. That treated
> every expired temporal fact as forgotten — "my parking permit expires 30 June" vanished
> from prompts as though the owner had retracted it.

And the naive fix (gate on `retiredBy`/`deletedAt` alone) had the opposite failure:

> Gating on `retiredBy`/`deletedAt` alone then un-forgot every pre-`retiredBy` supersede and
> forget tombstone: those producers never wrote `deletedAt`.

The resulting three-predicate API (`retirement.ts:34-108`):

```ts
isRetired(node, now, supersededIds?)               // administrative ∧ (validUntil ≤ now)
isExpired(node, now, supersededIds?)               // validUntil ≤ now ∧ ¬administrative
isAdministrativelyRetired(node, supersededIds?)    // clock-free
```

`isAdministrativelyRetired` (`:98-108`) is a four-way OR over markers of *different
generations*:

```ts
const by = node.metadata?.retiredBy;
if (by === 'delete' || by === 'supersede') return true;   // current
if (typeof node.metadata?.deletedAt === 'number') return true;   // legacy applyDelete
if (typeof node.metadata?.forgottenAt === 'number') return true; // legacy forget/cascade
if (supersededIds?.has(node.id) && typeof node.validUntil === 'number') return true; // legacy supersede
```

The last clause is the subtle one, and the comment (`retirement.ts:87-96`) is worth quoting
in full because it is a genuine security-flavoured argument about a public type union:

> The edge is CORROBORATING evidence, not a marker in its own right: it only counts when the
> node also carries a retirement stamp (`validUntil`). … Without that condition, `supersedes`
> becomes a liveness switch: it is a first-class member of the public `DirectedEdge['type']`
> union with no direction validation, so any caller-supplied edge would silently retire a
> live node at full confidence — markerless (nothing on the node), clock-free (`validUntil`
> undefined means retired at EVERY as-of instant, including the `retiredAt: 0` audit hatch),
> persisted through `.gai`, and not undone by re-ingesting the source.

Consequence for ranking: expired-but-not-retired nodes are damped ×0.3 rather than removed
(`traverser.ts:463-465`), and retired nodes are never scored at all.

Clock-free by construction: `isAdministrativelyRetired` takes no `now`, which is what lets
`retiredAt: 0` work as an audit hatch that re-admits every tombstone
(`retirement.ts:40-44`).

---

## 3. Retirement *reason* is the re-ingest key — the sharpest mutation-semantics idea

`retirement.ts:110-135` defines:

```ts
export type RetirementReason = 'delete' | 'supersede';
export const RETIRED_CONFIDENCE = 0;
```

with the asymmetry spelled out:

> - `delete` — the user asked to forget this content. Re-adding the source SHOULD restore it:
>   forgetting is not a permanent ban on a string.
> - `supersede` — the user asserted the stored fact was WRONG and replaced it. Re-syncing the
>   unchanged source must NOT resurrect it; the file still carrying the old text is precisely
>   why the correction existed.

`blocksReingest` (`retirement.ts:236-243`) is the four-line predicate that encodes it:

```ts
export function blocksReingest(node, now, supersededIds?): boolean {
  if (!isRetired(node, now, supersededIds)) return true;      // live → ordinary dedup
  return retirementReasonOf(node, supersededIds) === 'supersede';
}
```

`incremental.ts:70-95` documents the previous, wrong test (`confidence > 0.1`) and both
directions in which it failed:

> Keying on confidence dropped superseded nodes out of this set, so re-appending an
> unchanged source re-created the corrected-away fact as a live 0.9-confidence node,
> unmarked, outranking its own retired original.
> … Confidence is not consulted at all: `reflect({ decay: true })` drives LIVE memories to
> the same 0.1 floor a correction used to write, so the old test also duplicated any
> sufficiently old live node on re-append.

**Retirement hardens, never softens.** `applyDelete` only stamps `deletedAt`/`deleteReason`
when `retireNode` actually retired the node (`correction-engine.ts:229-236`), so a delete
cannot downgrade an existing supersede. `applySupersede` does the reverse unconditionally
(`correction-engine.ts:303-313`):

```ts
oldNode.metadata.retiredBy = 'supersede';   // hardening is unconditional
if (retired) { oldNode.metadata.deletedAt = now; ... }  // instant markers are not
```

`retireNode`'s JSDoc (`retirement.ts:137-155`) explains why `supersededIds` must be passed:
it is the only site that *decides* retirement and then *mutates*, so an unrecognised legacy
tomb is not merely served — it gets `retiredBy: 'delete'` stamped over a supersede, and
because `retirementReasonOf` reads the recorded reason before the structural edge, that
wrong reason permanently outranks the surviving evidence. "A v0.8.0-era graph stays
repairable by a later release; one this function has downgraded does not."

There is a purpose-built fixture for exactly this:
`tests/fixtures/legacy-v080-four-producers.gai`, written by the *actual* v0.8.0 public API
via `git archive v0.8.0 → write-legacy-gai.mts`, containing one node per legacy producer
with a distinctive secret string. `tests/unit/legacy-retirement-v080.test.ts:1-60` documents
the four marker shapes. This is expensive-but-correct backward-compat testing: they refused
to hand-build nodes because "it is about what published tags persisted".

### Indelibility as an architectural law

Edits are not in-place since 0.10.0. `applyEdit` **is** `applySupersede`
(`correction-engine.ts:107-136`): retire the old node, mint a new one, connect old → new
with a `supersedes` edge. The comment names two consequences of the old in-place edit that
the conformance audit found:

> - A re-ingest silently UNDID a correction. `appendMarkdown` re-reads the whole source
>   file, which still carries the original text, and because the edit left no trace nothing
>   suppressed it.
> - A node's identity became ambiguous. One node could answer to either the original or the
>   corrected fact depending on when a reader looked, which made "which facts were live at
>   time T" unanswerable.

`applyEdit` additionally **refuses** on a retired target (`:116-133`): since an edit now
mints a *live* node, editing a forgotten memory would resurrect its content as live content.

Consequently `RETIRED_CONFIDENCE = 0` and `CONFIDENCE_MIN = 0.01` — the gap is deliberate
(`confidence.ts:61-83`): a caller can never write 0 onto a live node, because that would
forge the tombstone signal *and* suppress the node with no marker (score is multiplied by
confidence, so 0 sorts it last under any budget).

---

## 4. Identity: three separate keys, none of them sufficient alone

There are three identity-ish keys in the model and they do different jobs.

**(a) `id` — nanoid, fresh on every ingest.** Explicitly *not* stable across builds.
`graph-builder.ts:44`, `incremental.ts:176`. This is the fact that forces everything in §6.

**(b) `contentHash` — DJB2 → base36, 32-bit.** `content-hash.ts` exists because there were
three byte-identical private `simpleHash` copies (graph-builder, incremental,
correction-engine):

```ts
export function simpleHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) & 0xffffffff;
  return hash.toString(36);
}
export const contentHashOf = simpleHash;  // "named for what it means rather than how it works"
```

The header comment (`content-hash.ts:1-26`) states the invariant it serves
(`I5: ∀n: n.contentHash = h(n.content)` — "that statement needs a single `h` to be checkable
at all"), the collision risk (~25% at 50k nodes), the resulting rule ("Every consumer that
MERGES or DROPS on a hash match must therefore verify content before acting"), the UTF-16
caveat (`charCodeAt` walks code units, so astral chars contribute two surrogates), and why
it is *not* being widened: "changing the function changes every `contentHash` in every
existing `.gai` file, which is a format-breaking migration, not a refactor. Widening it to
SHA-256 is a `.gai` v2 decision." `SPEC.md` §6 repeats it as a published known weakness.

Both merge sites honour the rule:
- `incremental.ts:159-167` buckets by hash and then compares content + type + file + section;
- `deduplicator.ts:38-60` sub-groups a hash bucket by exact content before merging, because
  it *hard-deletes* the loser. "A collision leaves both nodes standing, which is the correct
  failure direction: a redundant node costs space, a destroyed one costs a memory."

**(c) `chunkKey(chunk) = ${file}:${type}:${order}`** (`directed-edges.ts:77-79`) — the
*build-time* key that lets the two edge builders talk about chunks before nodes exist.
`graph-builder.ts:41-46,86-95` maps chunkKey → nodeId and then remaps every raw edge.
This key is positional and therefore fragile under source edits, which drives §5.

---

## 5. Incremental append semantics — the most hard-won code here

`addDocumentsToGraph` (`incremental.ts:33-305`) is 270 lines of which maybe 90 are code.

**Step 0 — whole-batch pre-validation** (`:44-68`). Two chunks in one call with the same
`(file, type, order)` key but different bodies is rejected *before any node is written*:

```ts
throw new Error(`Conflicting snapshots of "${file}" in one append: chunk ${key} was supplied
with two different bodies. Append one version per call, or forget the source before re-appending it.`);
```

Reasoning: "Throwing mid-loop would leave the graph half-mutated — some nodes added, no
index, no edges — which is a worse failure than the orphan it replaces." The prior behaviour
was that the second body overwrote the first's key→id mapping, leaving the first node active
but unindexed and unlinked — "an orphan handed back in `newNodeIds` that could never be
retrieved."

**Step 1 — eligibility to block** is `blocksReingest`, bucketed by hash (`:96-105`).

**Step 2 — three-tier duplicate resolution** (`:111-203`):

1. *In-batch collapse* keyed on `chunkKey` + content + type (`:122-126`). "Chunk order is
   what makes this safe to key on here: two copies of one document produce identical orders,
   while a passage genuinely repeated inside one document produces different ones."
2. *Cross-call duplicate* keyed on `(content, type, source.file, source.section)` and
   **deliberately not chunk order** (`:159-167`):
   > Order is a positional index over the whole document, so inserting or deleting a single
   > paragraph shifts every chunk below it. Matching on it made re-appending an EDITED source
   > re-store the entire tail as second active copies — indexed, parented, and served as
   > query seeds — compounding on every subsequent edit.
3. *Multiplicity* preserved by `consumedMatches: Set<NodeId>` — N identical passages consume
   N distinct stored nodes, one each, "so the Nth occurrence matches the Nth stored node
   wherever the text has moved to."

The `source.section` inclusion has its own three-paragraph justification (`:141-158`),
recording that the *first* version of this repair left it out and what broke: because
`consumedMatches` pairs incoming document order against stored bucket order, a source with
the same passage under `Alpha` and `Beta`, re-appended in `Beta, Alpha` order, had its Beta
occurrence claim the stored Alpha node — and a later continuation under Beta then got the
mislabelled node as its `precedes` predecessor. "That edge is not dangling, it is wrong."
The residual cost is named too (renaming a heading re-stores the tail under the new heading
and leaves the old copy attributed to the old one) and accepted: "Explicit additive history
beats silently mislabelled nodes."

A matched duplicate reuses the stored node's id for the chunk key
(`:170-173`) so unchanged parents still resolve during edge remapping.

**Step 4 — directed edges** are deduped on a signature `${from}\0${to}\0${type}` against the
whole existing set, and only added if they touch a new node (`:227-242`).

**Step 5 — the two-pass undirected build** is the interesting part; see §7.

**Step 6 — metadata** (`:286-297`): `ingestPolicyId` becomes `'mixed'` when a legacy graph
receives current-policy nodes; `version++` on every append.

---

## 6. Determinism discipline (their "T4") — the repo's spine

They treat "same query, same memory, same answer" as a testable law and repeatedly reject
convenient designs that break it.

**Tie-breaking on provenance, never on id.** `src/core/query/tie-break.ts:1-63`. The
comment records a shipped-and-measured defect:

> The obvious fix is to break ties on node id. That is WRONG here, and it was shipped and
> measured before being caught: ids come from `nanoid()` … Measured on a 40-question sample:
> evidence order differed on 21/40 and the evidence SET on 6/40, between two builds inside
> one single-threaded process. An id tie-break does not make ranking reproducible; it makes
> it reproducibly arbitrary within a build and freshly arbitrary between builds.

The key is `(source.file, source.offset, contentHash)`, compared **field by field**:

> Fields are compared one at a time rather than concatenated into a single string key: there
> is no separator that provably cannot occur in a file path, and a wrong separator silently
> makes two different nodes compare equal.

Unresolvable nodes return `0` rather than falling back to id, so a stable sort preserves
insertion order — "Arbitrary-but-stable beats random." Keys are memoised per comparator
because a sort touches each element O(log n) times.

There is a *second*, richer provenance comparator in
`undirected-edges.ts:194-251` — `provenanceComparator(nodesById)` on six fields
`(file, offset, section, type, contentHash, metadata.chunkOrder)` — used for edge-building
order rather than result ranking. Its doc comment is a small masterclass in test honesty:

> Exported for direct testing, and that is not incidental. Reaching this comparator through a
> built graph requires many equal-scoring candidates competing for one capped slot, and that
> fixture cannot be constructed: candidates that share enough vocabulary with a probe to
> clear SIMILARITY_THRESHOLD necessarily share it with each other, so "many mutually
> dissimilar candidates, all above threshold to one probe" is geometrically impossible here —
> measured at 0 edges created for every pool size from 11 to 30. Two successive integration
> fixtures that claimed to guard this comparator were therefore inert, each passing 20/20
> against a surgically reverted comparator. Testing the ordering directly is the only honest
> guard.

**The inverse ruling** appears in `traverser.ts:486-499`: a retirement filter at the final
selection step was *removed* because every path into `nodeScores` is already gated, so the
guard was unreachable — "deleting it was caught 0 times in 10 runs. Shipping a guard no test
can fail buys false confidence, not safety." Meanwhile `stripRetired` in `query-engine.ts`
is kept as an equally-unreachable fourth gate *because it is exported and directly tested*
and because it sits at the last point before content becomes a prompt string: "Every future
stage added between traversal and serialization — a reranker, a dedup pass, a host-supplied
overlay — gets audited by this line for free." The pair of rulings is coherent: defense in
depth is allowed exactly where it is directly testable and sits on a boundary.

**Three named instants.** `query-engine.ts:60-125` splits time into:
- `now` — ranking-only: expiry damping and telemetry stamps. Never affects membership.
- `retiredAt` — retirement membership. Defaults to the **wall clock**, never to `now`,
  because "a caller who passed a historical instant for recency / as-of ranking re-admitted
  content forgotten after that instant". `retiredAt: 0` is the audit hatch.
- `asOf` — supplies the default for both; an explicit `now`/`retiredAt` still wins. Added
  because "Determinism you can only get by reading an option list and correctly combining
  two fields is not a property anyone relies on."

`retiredAt` and `supersededIds` are each resolved **once per query**
(`query-engine.ts:219-237`) so the four gates cannot disagree mid-query — "a node that is
live for seeding and retired for serialization, or the reverse, is how a tombstone gets a
slot no live node can use."

**Wall-clock recency boosts were deleted** (`traverser.ts:414-443`): frequency standing is
scored from `accessCount` (which is serialized graph state, so it travels in the file), while
"a ×1.3 boost for accessed-within-24h makes the same file and the same query rank
differently on Tuesday than on Friday."

**Retrieval is a read.** `recordAccess` is off by default (`traverser.ts:89-92`); the
confidence module states as a law that nothing under `src/core/query/` imports it, "and a
test enforces that by scanning the source" (`confidence.ts:48-54`).

**Env-var-driven scoring was demoted.** `scoreRule` used to be readable only from
`process.env.GNOSIS_SCORE_RULE` at call time inside `traverseGraph`; the comment
(`traverser.ts:16-28`) notes an adopter with that variable set "got different rankings from
an identical graph and an identical query, with nothing in the API to reveal it, and any
published golden vector was valid only alongside an undeclared env state."

---

## 7. Edge construction: policies, caps and the cross-generation gap

### Directed edges (`directed-edges.ts`)

Purely structural/lexical, from chunks, with fixed weights:
`contains` 1.0 (parent→child), `precedes` 0.8 (sibling n-1 → n), `cites` 0.7 (resolved
internal links), `defines` 0.6 (definition chunk → every chunk whose lowercased content
contains the extracted term). `extractDefinedTerm` is four English regexes over the sentence
prefix (`:90-103`). No LLM anywhere on this path.

### Undirected edges (`undirected-edges.ts`)

Two passes:

1. **Similarity/entity.** Inverted term index over content chunks; candidates = chunks
   sharing a term whose posting list has `< 500` entries; narrowed to
   `MAX_SIMILARITY_CANDIDATES = 50`; accept as `similar-to` at TF-IDF cosine ≥ 0.3, else try
   `shares-entity` at Jaccard ≥ 0.2; `MAX_EDGES_PER_NODE = 10` degree cap; `seen` pair set
   keyed on the sorted id pair.
2. **Co-occurrence.** Group content chunks by `${file}:${section||'root'}`, then connect
   each chunk to the next 3 in the group with fixed weight 0.4 (`:165-180`).

**`CandidatePolicy` is persisted metadata.** `undirected-edges.ts:20-46` defines
`'index-order' | 'idf-ranked'` and — crucially — explains *why the policy id has to travel
in the file*:

> Exists because edges are PERSISTED and never rebuilt on load, so a graph ingested under two
> different policies carries both, permanently, with no other way to tell. `analyzerAdapterId`
> pins how content was tokenized; this pins how it was linked.

`GraphMetadata` therefore carries three provenance ids (`types.ts:141-176`):
`analyzerAdapterId` (fails closed with `AnalyzerMismatchError` on load), `edgePolicyId`,
`ingestPolicyId` (`'source-provenance-v1' | 'mixed' | absent`). The default candidate policy
stays `'index-order'` "so upgrading changes nothing silently. Adopting 'idf-ranked' is an
explicit act — a re-ingest."

Also notable: under `idf-ranked`, unmapped candidates are filtered out *before* the
`slice(0, 50)` so they cannot burn slots (`:102-112`), and the sort tie-breaks on chunk index
"because ranking must not introduce non-determinism (T4)". And K is deliberately **not**
widened by the ranking change: "Ranking reorders an unchanged universe; it never widens it."

### `buildCrossGenerationEdges` — the incremental-KG failure mode most builds have

`undirected-edges.ts:261-345` + `incremental.ts:258-284`. The problem statement is the
finding:

> `buildUndirectedEdges` derives its term index from the chunks handed to it, so on an
> incremental append it only ever sees the new batch: new nodes get linked to each other and
> to nothing else. Each ingest therefore lands as its own connected component, however much
> vocabulary it shares with what is already stored, and the isolation compounds with every
> append.
> Retrieval still reaches old and new material, because seeding runs over the corpus-wide
> lexical index — but it reaches them SEPARATELY, as unrelated results, rather than as one
> neighbourhood a walk can cross.

That last sentence is the diagnosis that makes the bug findable at all: it is *invisible* to
seed-level recall metrics and only shows up in traversal reach.

Mechanism of the fix: use the query path's own derived postings index
(`getDerivedIndex(tfidfIndex)`), accumulate per-existing-node **shared-IDF mass**, skip terms
with ≥ 500 postings, rank candidates by mass with `provenanceComparator` as tie-break, take
50, then apply the *same* threshold, the *same* degree cap and the *same* edge type as the
in-batch pass. Degree is seeded from the edges that already exist (`incremental.ts:271-274`
counts every endpoint of every existing undirected edge) so the cap is honoured across both
passes rather than each pass spending the whole budget.

### Orphan nodes are no longer deleted

`graph-builder.ts:131-156`:

> `removeOrphans` is FALSE by design. It used to be true, which hard-deleted every node left
> without an edge … Measured on the LongMemEval corpus that silently discarded 80 of 3,747
> nodes at q=1 (2.1%) and 467 of 19,416 at q=5 (2.4%).
> An unconnected node is still a memory. It simply has no neighbours yet — and on the
> incremental path a later ingest may well give it some. Deleting it is a retrieval-tuning
> decision destroying user content.

Edge pruning is retained (`minDirectedWeight 0.05`, `minUndirectedWeight 0.1`) and reported
as removing 0 edges in practice on that corpus.

---

## 8. Load-path validation: `assertEdgeWeights`

`graph-store.ts:35-101`. Every load path — `readGai`, `fromBuffer`, the SQLite loader, the
public `fromSerializable` — funnels through `fromSerializable`, which is why the invariant is
enforced there. The bound is chosen from the *proof*, not the writers' convention:

```ts
const CEILING = 1 / DECAY_FACTOR;                 // 1/0.6 ≈ 1.667
const bad = (w: number) => !Number.isFinite(w) || w <= 0 || w >= CEILING;
```

Reasoning, condensed from the comment:

- Since 0.10.0 traversal returns the **maximum over paths** (their Theorem 3), and the proof
  that a best-first frontier delivers that requires score to strictly decrease along a path —
  which holds only while each hop's multiplier `DECAY_FACTOR * w` stays below 1.
- Writers emit `(0, 1]` and cosine is clamped, but files written before that clamp carry
  1-ULP overshoots (`1.0000000000000002` "was measured on a real round-trip in the test
  suite"), and "refusing to open an existing memory over one ULP would be a data-availability
  bug introduced in the name of a correctness one."
- Failure mode if unchecked: "scores rise along a path, heap pops stop arriving in
  non-increasing order, the dominance test discards strictly better entries, and retrieval
  returns a confidently wrong ranking. `Infinity` is worse still — every reachable node ties
  at Infinity and the ranking collapses onto the tie-break."
- And the honest note that the `.gai` checksum "is an additive byte sum its own writer
  documents as catching corruption, not tampering", so a bad file is plausible.

Errors are coded (`gaiError('GRAPH_EDGE_WEIGHT_INVALID', …)`); the dangling-edge check lives
in the reader (`gai-reader.ts:146-157`, `GAI_DANGLING_EDGE`).

Gap they acknowledge (`traverser.ts:50-56`): the weight premise is asserted for graphs built
by the ingest path but is *not* enforced against a caller mutating a weight in place after
load. (It **is** now enforced on the deserialization paths, contradicting that stale comment
— the comment says "It is NOT enforced on the deserialization paths", which
`assertEdgeWeights` now does. Minor doc drift.)

---

## 9. Structural nodes: they conduct, they do not consume budget

`traverser.ts:149-173`. `document`/`section` nodes carry a title or a heading. In a
conversation ingest those headings are "turn 3" / "user 1" — no answer content. But they are
the *connectivity* backbone: document→section→turn via `contains`.

Once the hierarchy edges started resolving correctly (defect C1 in
`tests/unit/graph-integrity.test.ts`), a single reachable turn put an entire source two hops
away — "on a 30-node budget that measured 18 slots of headings against 12 of content."

The rule that emerged: structural nodes **conduct** score and **can be seeds** (a
"## Deployment checklist" heading is real signal, which is why section nodes are TF-IDF
indexed on purpose — `graph-builder.ts:73-79`), but they are dropped before final selection
if they were only *walked through* (`traverser.ts:486-498`). Document nodes are excluded from
the index entirely (title duplicates section content). `SPEC.md:127-131` states this as a
policy-not-format decision:

> `document` and `section` are **structural** … They exist to connect the graph. Whether a
> reader surfaces them as evidence is a policy decision, not a format one.

---

## 10. Persistence (`sqlite-store.ts`)

Straightforward relational mapping: `graphs / nodes / directed_edges / undirected_edges`,
JSON-encoded `source`, `entities`, `metadata`, `metadata` blob on the graph row. WAL mode,
`foreign_keys = ON`, indexes on `graph_id`, node `type`, node `content_hash`, directed
`from_node`/`to_node`.

`saveGraph` is **DELETE-everything-then-reinsert inside one transaction** (`:128-170`).
`loadGraph` reassembles a `SerializableGraph` and funnels through `fromSerializable`, so the
edge-weight gate applies (`:251`).

`recordNodeAccess` is the one incremental write path (`:273-286`).

`openSqliteStore(dbPath)` is the SDK entry point that avoids `process.cwd()`, but it is
implemented by **swapping the module-level `db` singleton around each call** (`:316-329`):

```ts
const withSingleton = <T>(fn: () => T): T => {
  const prev = db; db = handle;
  try { return fn(); } finally { db = prev; }
};
```

See antipatterns.

---

## 11. Process craft worth stealing

- **Comment-as-defect-ledger.** Nearly every non-obvious rule carries: the symptom, the
  corpus and numbers it was measured on, the rejected alternative, and the residual cost that
  was accepted. Examples: `graph-builder.ts:131-147` (80/3747, 467/19416),
  `tie-break.ts:16-21` (21/40, 6/40), `traverser.ts:325-333` (86% of pushes, 110 ms → 47 ms),
  `constants.ts:27-57` (SEED_OVERSAMPLE, with a paired p-value), `correction-engine.ts:398-413`
  (`forgetTopic('aster')` retired 2,151 nodes, 127 via 'Pilaster').
- **Constants file carries the experiment log.** `SEED_OVERSAMPLE = 1` is 30 lines of "for /
  against / what the next experiment should be" (`constants.ts:27-57`). The value is shipped
  at the boring setting *and* the reason the exciting setting lost is preserved.
- **SPEC.md has a "§6 Known weaknesses" section**: "Stated here because a specification that
  hides its soft spots is worse than one that names them." It lists the 32-bit hash, the
  unauthenticated header counts, the checksum-is-not-a-MAC, and `accessCount` being mutable
  state inside an otherwise declarative file.
- **Conformance fixtures with expected outcomes** (`spec/fixtures/`, `node spec/conformance.mjs`,
  10 files, 6 of which must be *rejected*), plus the honest line: "A third implementation
  passing all ten is what would make `.gai` a standard rather than a file layout. Until then
  this document describes one program."
- **Tests are plain `tsx` scripts with a hand-rolled `check()`**, run as a 26-command `&&`
  chain in `package.json`'s `test` script. No test framework. Each test file opens with a
  prose header naming the defect class it guards.
- **Differential/random testing where a hand-built example is provably insufficient**:
  `traversal-path-maximum.test.ts` compares the heap against brute-force enumeration of every
  path on randomly generated graphs — "One hand-built example proves one example; the random
  differential is what would catch a sift bug." It found 1 disagreement in 200 graphs that
  neither the hand-built counterexample nor 400 corpus queries found.
- **Mutation testing used as an argument for deleting a guard** (`traverser.ts:490-494`).
- **Legacy fixtures generated from real published tags** (`git archive v0.8.0`), not hand-built.
- **Changelog written for the caller's failure modes**, including "three changes are visible
  to callers even though none of them removes or renames a public export", and a distinction
  between the reader's view (additive) and the constructor's view (breaking).
- **Release-decision framing in code comments**: flipping `traversalOrder` default "WAS A
  RELEASE DECISION, not a code-review one. It changes retrieval output on ~9% of real
  multi-session queries … which invalidates every LongMemEval arm and the latency tables
  measured before 0.10.0. Those numbers must be re-run, not carried forward."

---

## 12. Antipatterns / do-not-copy

1. **Module-global mutable graph + db singletons, with a swap hack for multi-instance use.**
   `graph-store.ts:8` (`let currentGraph`), `sqlite-store.ts:34` (`let db`), and
   `openSqliteStore`'s `withSingleton` (`:316-329`) which mutates a module global inside
   try/finally. This is non-reentrant: two `SqliteStore` handles in one process, or any
   `await` interleaving inside a swapped region, silently cross-wire. The fix is trivial
   (pass the handle explicitly / make the store a closure over its own handle), and the file
   even admits "In a production system, this would be backed by a database" — but the SDK
   ships this.

2. **`eval('require')` for optional native deps** (`sqlite-store.ts:15-32`) — chosen to
   satisfy both the Next.js ESM build and the CJS SDK build without tsc transforming it.
   Defeats bundler analysis and any CSP/`--disallow-code-generation-from-strings` context;
   `createRequire(import.meta.url)` or a dynamic `import()` is the modern answer.

3. **Full-rewrite persistence.** `saveGraph` (`sqlite-store.ts:128-170`) deletes every node
   and edge row for the graph and reinserts them on every save — O(|V|+|E|) per call — which
   directly contradicts the incremental-append API (`addDocumentsToGraph`) it exists to
   persist. Additionally the schema declares FKs only on `graph_id`; `from_node`, `to_node`,
   `node_a`, `node_b` have **no** FK and there is no index on undirected endpoints
   (`:76-106`). So the SQL store can hold dangling edges that the `.gai` reader would reject
   outright (`gai-reader.ts:146-157`), and the constraint is only re-imposed at load time.

4. **The documented degree cap is not actually enforced.** `MAX_EDGES_PER_NODE = 10` is
   checked and accounted only in the similarity/entity pass (`undirected-edges.ts:124-125,
   138-139, 148-150`). The co-occurrence pass (`:165-180`) adds up to 3 edges per chunk with
   **no** degree check and never updates `edgeCountPerNode`. `AGENTS.md` nonetheless states
   "Max 10 edges per node: Prevents hub explosion" as a performance bound. A reader porting
   the "capped degree" claim gets an uncapped `co-occurs` layer.

5. **`defines` edges are O(n²) substring matching with regex-guessed subjects.**
   `directed-edges.ts:50-61` loops every chunk × every other chunk doing
   `other.content.toLowerCase().includes(definedTerm.toLowerCase())`, where `definedTerm`
   comes from four English-only sentence-prefix regexes (`:90-103`). No weight threshold, no
   degree cap, no word-boundary check — so a definition of a short/common term ("a data point
   is …") links to a large fraction of the corpus at weight 0.6, and the pass is quadratic in
   chunk count. Contrast the care taken in `forgetByTopic`, where exactly this substring
   problem was found and fixed with a Unicode word-boundary regex
   (`correction-engine.ts:398-422`) — the same fix was never applied here.

6. **Load-bearing semantics live in an untyped `metadata: Record<string, string | number>`.**
   `types.ts:57`. Liveness (`retiredBy`, `deletedAt`, `forgottenAt`), lineage (`retiredAt`,
   `retiredReason`), ingest provenance (`ingestPolicyId`, `chunkOrder`) and the confidence
   audit trail (`confidenceSetAt/From/To/Reason/Writes`) are all string keys in a free-form
   bag that `SPEC.md` §3.1 explicitly declares "Free-form" and that no load path validates.
   The result is that `isRetired` — a security-relevant predicate — is a sequence of
   `typeof x === 'number'` and string comparisons against untyped values
   (`retirement.ts:98-108`), and nothing prevents a third-party writer from producing a node
   whose markers are subtly wrong. The declared fields (`confidence`, `validUntil`) *are*
   typed and *are* validated; the ones that actually decide visibility are not.

7. *(bonus, lower confidence)* **`AGENTS.md` contradicts the shipped invariants.** It states
   "Auto-pruning: Orphan nodes (zero edges) are removed after graph construction" (false since
   `removeOrphans: false`, `graph-builder.ts:148-156`), "Soft-delete sets validUntil +
   confidence 0.1" (false — `RETIRED_CONFIDENCE = 0`, `retirement.ts:135`), and "Content hash
   deduplication: Identical content produces identical hashes; duplicates are merged" without
   the collision caveat that the code and SPEC both treat as load-bearing. This is the file an
   AI agent reads first; a stale agent-guide is worse than none, because the code comments and
   the guide now disagree about the invariants and only one of them is tested.

---

## 13. Numbers and constants worth remembering

| constant | value | file |
|---|---|---|
| `SIMILARITY_THRESHOLD` | 0.3 (cosine, `similar-to`) | constants.ts:12 |
| `DEDUP_THRESHOLD` | 0.95 | constants.ts:13 |
| `ENTITY_JACCARD_THRESHOLD` | 0.2 (`shares-entity`) | constants.ts:14 |
| `MAX_TRAVERSAL_HOPS` | 3 | constants.ts:17 |
| `DECAY_FACTOR` | 0.6 per hop | constants.ts:18 |
| `TOP_K_NODES` | 20 | constants.ts:19 |
| `SEED_COUNT` | 5 | constants.ts:20 |
| `STRUCTURAL_EXPANSION_BUDGET_SHARE` | 0.5 (beside, not inside, TOP_K) | constants.ts:21-25 |
| `SEED_OVERSAMPLE` | 1 (deliberately disabled; 8 cost ~4 pts on LongMemEval) | constants.ts:27-57 |
| `MAX_SIMILARITY_CANDIDATES` | 50 | undirected-edges.ts:17 |
| `MAX_EDGES_PER_NODE` | 10 (similarity pass only) | undirected-edges.ts:18 |
| posting-list skip | terms in ≥ 500 chunks | undirected-edges.ts:89, 310 |
| co-occurrence window | next 3 in section, weight 0.4 | undirected-edges.ts:168, 176 |
| backward directed hop | ×0.5 | traverser.ts:383 |
| expired damping | ×0.3 | traverser.ts:463-465 |
| accessCount boosts | >10 → ×1.2, >3 → ×1.1 | traverser.ts:451-452 |
| default extraction confidence | 0.9 | graph-builder.ts:61, incremental.ts:194 |
| human-correction confidence | 1.0 | correction-engine.ts:163 |
| `RETIRED_CONFIDENCE` / `CONFIDENCE_MIN` / `CONFIDENCE_MAX` | 0 / 0.01 / 1 | retirement.ts:135, confidence.ts:83, 86 |
| edge-weight load ceiling | `1 / DECAY_FACTOR` ≈ 1.667 | graph-store.ts:71 |
| auto-prune threshold | graphs > 50 nodes; min weights 0.05 / 0.1 | graph-builder.ts:148-156 |

---

## 14. What a `.gai` v2 would change (SPEC §8, proposal only)

Not implemented, but the reasoning is the most valuable part of the spec for anyone designing
a versioned knowledge artifact:

- **§8.0 "one break, once"** — the governing constraint on spending a format break.
- **§8.1 `(id, rev)` node identity.** Today one id maps to exactly one node, which is why
  merge is undefined: a merge of two engrams that both edited `n1` must produce a graph
  containing *both* revisions marked in conflict, and with one slot per id all three
  available options are wrong ("overwrite one (silent loss) … mint a fresh id for the loser
  (losing the fact that these are two revisions of the same thing) … or emit the conflict edge
  as the self-loop `n1 → n1`, which asserts that a fact conflicts with itself"). `id` stable
  across content change, `rev` monotone from 1, exactly one `head` per id, conflict = an id
  with more than one head. Migration is mechanical (every v1 node is `rev = 1`, head). They
  are explicit that this gives merge *a place to put a conflict* but does not define the merge
  algebra.
- **§8.2 `maxAutonomy: 'L0'|'L1'|'L2'|'L3'` as node metadata**, with five rules that make it
  meaningful: a ceiling is a maximum never a grant; it is **monotone under composition** (a
  subgraph's ceiling is the MIN over its members, so borrowing a skill cannot raise the
  borrower's ceiling); it survives transport; **absence is not permission** (unspecified ⇒ most
  restrictive); and the writer of a node cannot raise its own ceiling ("what proposes an
  action does not approve its own limits"). They also admit it is advisory until a conformance
  level mandates it.
- **§8.3 conformance levels L1/L2/L3 declared per layer**, with the argument that a *format*
  benefits from many implementations (that is what proves the bytes are unambiguous) while a
  *retrieval engine* does not ("ranking is a design position, and two engines that rank
  differently are not two implementations of one thing").
