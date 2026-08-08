# Graphnosis survey — territory: ingestion, extraction, enrichment & examples

Repo: `/home/elpresidank/YeeBois/dev/Graphnosis` (Apache-2.0, TypeScript, Next.js app + SDK + MCP + CLI).
Scope read in full: `src/core/ingestion/parsers/*.ts`, `src/core/extraction/*.ts`,
`src/core/enrichment/*.ts`, `src/core/giki/giki-generator.ts`, `src/examples/**`.
Adjacent files read for mechanism: `src/core/graph/graph-builder.ts`,
`src/core/graph/directed-edges.ts`, `src/core/graph/incremental.ts`,
`src/core/graph/retirement.ts`, `src/core/constants.ts`, `src/core/query/answer.ts`,
`src/core/query/router.ts`, `src/sdk/index.ts`, `src/mcp/tools/ingest_files.ts`,
`src/app/api/examples/[dataset]/route.ts`, `tests/unit/*.test.ts`,
`tests/longmemeval/official/ingest.ts`, `AGENTS.md`, `CHANGELOG.md`.

---

## 0. Shape of the territory

The whole ingest side is a **funnel to one shape**:

```
bytes/text ──parser──▶ ParsedDocument { title, sections: ParsedSection[], sourceFile, metadata }
ParsedSection = { title, content, depth, children: ParsedSection[] }
                          │
                     chunkDocument()
                          ▼
              ExtractedChunk[] { content, type, source{file,offset,section},
                                 entities[], metadata, parentId?, order, links[] }
                          │
                     buildGraph() / addDocumentsToGraph()
                          ▼
              KnowledgeGraph { nodes: Map, directedEdges: Map, undirectedEdges: Map }
```

Every parser — markdown, HTML, CSV/JSON, PDF, image EXIF, video container metadata,
subtitles, conversation transcripts, Wikipedia, arXiv, NASA, Wikimedia — produces the
same `ParsedDocument`. Nothing downstream special-cases a source type. That is the single
biggest structural decision in this territory and it is why an EXIF GPS tag and a
Wikipedia paragraph go through identical chunking, entity extraction, TF-IDF indexing and
edge building.

There is a hard split between a **deterministic, zero-API core** (parsers, chunker,
entity extractor, identity extractor, TF-IDF, edge building) and **optional LLM passes**
(node enrichment, session summarization, preference extraction, image vision). The
optional passes are the only place an API key is required, they are cached on disk, and —
except for session summarization — they write *only* into `node.metadata`.

The code is unusually heavily commented, and the comments are **postmortems**: nearly
every non-obvious branch carries the failure it was written to prevent, often with
measured numbers (`"invented 95 of 211 identities"`, `"80 of 3,747 nodes at q=1 (2.1%)"`,
`"evidence ORDER differed on 21/40"`). Reading this repo, the comments are as valuable as
the code. That is itself a process finding.

---

## 1. Chunking

### 1.1 The chunk tree

`chunkDocument(doc, { chunkSize })` (`src/core/extraction/chunker.ts:41`) emits a flat
`ExtractedChunk[]` that encodes a tree via `parentId`:

- one `document` chunk (content = `doc.title`), pushed first so its `order` is 0;
- per section, one `section` chunk (content = `section.title`);
- per section, N content chunks split from `section.content`;
- recursion into `section.children`.

`order` is assigned so that it equals the chunk's index in the output array
(`order = chunks.length` after each recursive call, `chunker.ts:73`, `chunker.ts:143`).

### 1.2 ONE CANONICAL CHUNK IDENTITY (the load-bearing bug fix)

`chunker.ts:47-56`:

```
// ONE CANONICAL CHUNK IDENTITY. `parentId` must be the parent's `chunkKey`
// — `<file>:<type>:<order>` — because that is the only key the graph builder
// resolves edge endpoints through. It previously used a separate synthetic
// shape (`doc:<file>`, `section:<file>:<title>`), which the resolver could
// never match, so EVERY hierarchy edge was silently discarded and its child
// left structurally parentless. Those parentless nodes are exactly what an
// orphan sweep then deletes.
```

The resolver is `chunkKey` in `src/core/graph/directed-edges.ts:77-79`:

```ts
export function chunkKey(chunk: ExtractedChunk): string {
  return `${chunk.source.file}:${chunk.type}:${chunk.order}`;
}
```

and the chunker mints ids in exactly that shape:
`const docChunkId = `${doc.sourceFile}:document:0`` (`chunker.ts:56`) and
`const sectionId = `${sourceFile}:section:${sectionOrder}`` (`chunker.ts:93`).

`buildGraph` then does key→nanoid remapping and **drops any edge whose endpoint key
doesn't resolve** (`graph-builder.ts:88-95`), silently. That silence is what made the
original bug invisible: hierarchy edges vanished, children became orphans, and the
(then-enabled) orphan sweep hard-deleted them.

The failure cascade is the interesting part: *identity mismatch → silent edge drop →
structural orphan → node deletion → content that entered the system is unfindable and
nothing reports it*. The fix is not clever code, it is a **single identity function used
by both the producer and the resolver**.

Related: `graph-builder.ts:131-156` disables `removeOrphans` by default with measured
justification — `"Measured on the LongMemEval corpus that silently discarded 80 of 3,747
nodes at q=1 (2.1%) and 467 of 19,416 at q=5 (2.4%)"` — and states the principle:
*"An unconnected node is still a memory. It simply has no neighbours yet."* Edge pruning
is kept (it removes weak edges, never nodes) and measured at 0 edges removed in practice.

### 1.3 The MIN_CHUNK_LENGTH complete-unit exemption

`chunker.ts:109-121` is the best small idea in the chunker:

```
// MIN_CHUNK_LENGTH exists to drop prose FRAGMENTS left over by splitting —
// a trailing clause, a stray bullet marker. It must not be applied to a
// COMPLETE unit that simply happens to be short. A conversation turn like
// "Paris.", "Blue" or "March 8" is a whole answer, and dropping it removed
// the very thing a question was about while leaving its section heading in
// place, so the graph looked intact and the answer was gone.
//
// A unit is complete when it is the only chunk its section produced: no
// split happened, so nothing was truncated.
const isCompleteUnit = textChunks.length === 1;
if (text.length < MIN_CHUNK_LENGTH && !isCompleteUnit) continue;
```

The mechanism: **"was this text truncated?" is answered structurally, by asking whether
the splitter produced more than one piece**, not by any length or content heuristic. If
the section produced exactly one chunk, no split occurred, so the chunk is whatever the
author wrote and a length floor is meaningless. If it produced several, the short ones
are leftovers of splitting and the floor applies.

`MIN_CHUNK_LENGTH = 20`, `MAX_CHUNK_LENGTH = 500`, `MAX_CHUNK_SENTENCES = 3`
(`src/core/constants.ts:60-62`).

The regression test is `tests/unit/graph-integrity.test.ts:88-102` (defect class C2):
`Paris.` / `March 8` / `Blue` must survive chunking, and a genuine fragment beside
siblings must still be dropped.

### 1.4 Chunk-size presets

`chunker.ts:5-39` exposes `ChunkSizePreset = 'fine' | 'balanced' | 'coarse'` mapping to
`{maxLength, maxSentences}` of `{300,2}` / `{MAX_CHUNK_LENGTH, MAX_CHUNK_SENTENCES}` /
`{2500,6}`. Two design notes worth stealing:

- the docstring states the *cost* of each preset, not just the size
  (`"More semantic vectors, finer-grained recall, higher embedding cost per ingest"`);
- `balanced` is deliberately wired to the historical constants
  (`"Keep balanced aligned with the historical constants so existing tests / behaviour
  don't drift when a caller upgrades"`), i.e. the default preset is defined as
  *whatever the previous behaviour was*, so introducing the vocabulary is a no-op.

The preset threads through `AddDocumentsOptions` (`incremental.ts:25-30`) and the SDK
`IngestOptions` (`sdk/index.ts:122-135`).

### 1.5 Metadata inheritance

`chunker.ts:67-72`:

```
// Process each section recursively. Pass doc.metadata so per-document
// context (e.g., sessionDate / sessionId for LongMemEval) propagates to
// every child chunk - previously it was lost, which meant temporal
// questions had zero date grounding at query time.
```

`inheritedMetadata` is spread into every section chunk (`chunker.ts:99`) and every content
chunk (`chunker.ts:132`). This is the mechanism by which `sessionDate` reaches a leaf node
that a retrieval hit will later serialize into a prompt. Document-level facts must be
**copied down**, not looked up, because retrieval returns leaves, not documents.

### 1.6 Splitting and classification

- `splitIntoChunks` (`chunker.ts:147-174`): paragraph-first (`/\n\n+/`); a paragraph under
  `maxLength` is a chunk verbatim; otherwise sentence-split and greedily accumulate until
  `maxSentences` or `maxLength`.
- `splitSentences` (`chunker.ts:176-189`): one lookbehind regex covering Latin/CJK/Arabic/
  Greek ano teleia/Thai/Ethiopic/Armenian/Devanagari terminators:
  `/(?<=[.!?…‽。！？؟؛·ฯ።፤։।])\s*/`.
- `classifyChunk` (`chunker.ts:191-298`) assigns `NodeType` ∈
  `definition | event | data-point | claim | fact` by regex, with pattern lists in ~13
  languages per category. Definition detection is additionally gated on
  `text.length < 200`. Data-point detection is script-neutral (percent, 8 currency
  symbols, magnitude words including `万`/`亿`/`백만`).
  Note: the regex union is rebuilt with `new RegExp([...].join('|'))` **on every call**,
  i.e. per chunk. No memoization.
- `extractLinks` (`chunker.ts:300-327`) — see hardening below.

---

## 2. Entity extraction vs identity extraction (the split)

This is the clearest conceptual separation in the territory, and the reason the split
exists is stated explicitly.

### 2.1 `extractEntities(text): string[]` — deliberately over-generous, lexical

`src/core/extraction/entity-extractor.ts:5-213`. Pure regex NER over a `Set<string>`,
covering, in order:

| category | mechanism | line |
|---|---|---|
| multi-word capitalized phrases | `/(\p{Lu}\p{Ll}+(?:[\s\-]\p{Lu}\p{Ll}+)+)/gu` | 11-13 |
| single capitalized words **not at sentence start** (`i` starts at 1) minus a stoplist | 18-27 |
| CJK ideograph runs (2+), Katakana runs, Hangul runs | 32-47 |
| Indic / Arabic / Hebrew / Thai / Georgian / Ethiopic / Myanmar / Khmer / Tibetan / Sinhala runs | 51-110 |
| years 1000–2099, ISO dates, European `d/m/y` and `d.m.y` | 115-130 |
| acronyms `\b\p{Lu}{2,}\b` minus roman numerals / AM,PM,AD,BC / day abbrevs | 133-138 |
| backtick terms, camelCase/PascalCase, `dot.notation` identifiers | 143-158 |
| quoted terms in 7 quote conventions incl. `«»`, `„"`, `「」`, `『』` | 161-169 |
| parenthetical terms 2-60 chars containing a letter | 172-177 |
| emails, URLs, `#hashtags`, `@mentions` | 180-195 |
| numbers with units (kg/km/°C/GB/MHz/ms/…), currency amounts in 8 symbols + 20 ISO codes | 198-211 |

Two curated stoplists: `COMMON_CAPITALIZED` (~250 function words across EN/FR/ES/PT/DE/
IT/RO/NL/PL/CS/TR/SV/NO/DA/RU, with an explicit comment `"German — careful, German
capitalizes all nouns"`, `entity-extractor.ts:216-275`) and `COMMON_ACRONYMS_TO_SKIP`
(`:277-283`).

The entities are used as (a) a lexical retrieval surface, (b) the input to
`shares-entity` undirected edges (Jaccard ≥ 0.2, `constants.ts:14`), and (c) the input to
identity extraction. Over-extraction is a deliberate bias here.

### 2.2 `extractIdentities(graph)` — a *second, stricter* pass over the graph

`src/core/extraction/identity-extractor.ts:16-197`. Runs **inside `buildGraph`**
(`graph-builder.ts:129`), after nodes exist, so it operates on the graph, not on text.

The mechanism is a **two-pass structural gate** (`identity-extractor.ts:26-56`) — the
finding of this territory:

```
// Document and section nodes carry titles and headings. Entity extraction is
// intentionally generous there for lexical retrieval, but a heading such as
// "Project Overview" is not evidence that a person exists — on this repo's own
// markdown that heuristic invented 95 of 211 identities ("Governing Law",
// "Related Work") and not one real person.
//
// So structural nodes may not ORIGINATE an identity. They may still corroborate
// one that content has already established... Dropping it outright would silently
// cost them mention count, confidence, and their `knows` / `discussed-in` edges —
// which is a different and unintended change from refusing to let a heading
// invent a person.
//
// Hence two passes: content nodes establish the name set, structural nodes may
// only add to names already in it.
```

Implementation is a stable sort putting non-structural nodes first, then one loop with a
one-line guard:

```ts
const isStructural = (t: string): boolean => t === 'document' || t === 'section';
const ordered = [...graph.nodes].sort((a, b) => { /* structural last */ });
...
if (structural && !entityMentions.has(normalized)) continue;   // :56
```

**The generalizable rule: a signal source can be granted the right to CORROBORATE
without the right to ORIGINATE.** Most systems only have a binary trust/exclude switch
per source, and both settings are wrong here.

The negative-control fixture in `tests/unit/graph-integrity.test.ts:200-259` (defect class
C6) is exemplary: it asserts (a) people named in `fact`, `claim` and `event` nodes all
become identities — with a comment explaining that a single content type in the fixture
would let an over-broad guard `type !== 'fact'` pass while deleting identities from every
other type; (b) `Project Overview` / `Release Notes` do **not** become people; (c) a
`section` node titled `Ada Lovelace` still raises Ada's `mentionCount` to ≥2.

Other mechanics in identity extraction:

- `isLikelyPerson` (`:199-208`): ≥2 whitespace-separated words, each matching
  `^\p{Lu}\p{Ll}+$`, not all-caps, not all-digits. See antipattern #1.
- Person node confidence: `Math.min(0.5 + mentions.count * 0.1, 0.95)` (`:110`).
- `discussed-in` directed edges from each mentioning node → person, weight 0.6 (`:118-130`).
- `shares-entity` undirected edges between mentioning nodes, but **windowed**:
  `for j in [i+1, min(i+5, n))` (`:133-144`) — a bounded 4-neighbour window instead of the
  full O(n²) clique. This is a real scaling decision.
- `knows` edges between co-mentioned persons, weight `min(0.3 + overlap*0.1, 0.9)`,
  **emitted symmetrically as two directed edges** with the comment
  `"so both directions render in Atlas"` (`:169-181`) — i.e. a visualization requirement
  leaking into the data model, honestly labeled.
- `inferPersonAttributes` (`:214-299`): ±100 chars around the name, matched against
  role patterns in 13 languages and org patterns built from language-specific
  prepositions + institution suffixes (`University|Institute|Lab|Corporation`,
  `Université|Institut|Laboratoire`, `Universität|Institut|Labor|GmbH|AG`, …).
- The invariant-repair note at `:86-100` is worth reading in full: person nodes used to
  write `contentHash = "person:${name}"`, a *semantic key* instead of a hash, which made
  the stated invariant `∀n: n.contentHash = h(n.content)` **false by construction on every
  graph containing a person node — which is every graph**. The comment then reasons about
  what the key was load-bearing for (grouping same-name person nodes in the deduplicator)
  before concluding that effect is already gone, and names where identity now lives
  (`metadata.personName` and `entities[0]`). That is how to remove a field.

---

## 3. Enrichment: keeping the deterministic core deterministic

Four files, three passes, one cache.

### 3.1 `node-enricher.ts` — optional, metadata-only, pure candidate selection

- `EnrichedNodeData = { synthesis, context, sourceQuality: 'primary'|'secondary'|'inference'|'unknown' }`
  (`node-enricher.ts:8-12`). Header comment: *"Runs as an optional post-construction pass
  (costs ~$0.50-2 per dataset)"* (`:4-6`).
- `applyEnrichment` (`:156-161`) writes **only** `node.metadata.{synthesis,context,
  sourceQuality,enrichedAt}`. It never touches `content`, `contentHash`, `type`,
  `entities`, `confidence`, or edges. So the graph's identity, hashes, dedup behaviour and
  retrieval scores are untouched by enrichment; enrichment is strictly additive
  presentation metadata. Consumers read it opportunistically (`giki-generator.ts:47`
  boosts relevance by 0.1 when `metadata.synthesis` exists; `:100`, `:128`, `:140` render
  it if present).
- `getEnrichmentCandidates` (`:114-142`) is a **pure function** (graph → NodeId[]) that
  ranks by `confidence * (1 + accessCount*0.1) * (1 + connectionCount*0.05)`, skips
  structural nodes, already-enriched nodes, nodes < 30 chars, and retired nodes — see §3.2.
  The prompt builder (`:21-53`) and the response parser (`:94-111`) are also pure. The
  *only* impure thing is the caller's LLM call: the module ships prompt-in / parse-out and
  never performs I/O itself. That is why the core stays deterministic — the LLM boundary is
  a pair of pure functions plus a caller-owned network call.
- `parseEnrichmentResponse` (`:94-111`) is defensive: extract the first `{...}` blob with
  `response.match(/\{[\s\S]*\}/)`, `JSON.parse`, require `synthesis` and `context`,
  default `sourceQuality` to `'unknown'`, return `null` on any throw. The identical
  pattern is repeated in `session-summarizer.ts:68-83` and
  `preference-extractor.ts:114-137`. Every LLM pass in the repo treats model output as
  untrusted text, never as JSON.
- `getNodeNeighborhood` (`:56-91`) collects up to `maxNeighbors*2` neighbours across both
  edge maps, sorts by edge weight, returns top-N — so the prompt shows the node's
  *strongest* context, capped. The prompt renders neighbours as
  `- [<edgeType>, weight 0.87, outgoing] <content[0..120]>` (`:26-30`) — typed edges are
  in the prompt, which is the project's core thesis applied to enrichment.
- Prompt discipline (`:49-52`): `"synthesis should be insight, not repetition. 'Turing's
  1936 paper introduced computability' not 'Paper was submitted in 1936'"` — a
  contrastive example rather than an adjective.

### 3.2 The retirement gate at the two non-prompt exits

`node-enricher.ts:128-131`:

```
// Enrichment SENDS node content to an LLM. Forgotten content must not leave
// the machine any more than it may enter a prompt, and confidence ordering
// is not a gate: a retired node at priority 0 is still inside a 200-node
// batch on a small graph.
if (isRetired(node, now, supersededIds)) continue;
```

`giki-generator.ts:52-58`:

```
// A generated topic page is published output, so the retirement rule that
// governs prompts governs it too. Gating on confidence alone would have
// worked here by accident (retired nodes sit at 0, and `relevance > 0`
// filters them) — but that is the confidence-as-liveness conflation this
// codebase has been bitten by twice, and it silently breaks the moment
// anything adds a floor to the multiplier.
if (isRetired(node, now, supersededIds)) continue;
```

Both consult the same predicate `isRetired(node, now, supersededIds)` from
`src/core/graph/retirement.ts`, which is documented as *"ONE definition of 'retired',
shared by every site that decides liveness"* (`retirement.ts:3-33`) and which explicitly
separates administrative retirement (`retiredBy` / `deletedAt` / `forgottenAt` / an
outgoing `supersedes` edge) from content expiry (`validUntil` reached with no
administrative marker), and states *"Confidence is NOT a liveness signal in either
direction. It is a ranking weight."*

`CHANGELOG.md:526-533` frames it as an exit-enumeration problem:

> **Retired content no longer leaves the graph by the two non-prompt exits.** A Giki topic
> page is published output and enrichment ships node content to an LLM; both ranked by
> confidence, which put a retired node *last* rather than out — and last is inside a
> 200-node enrichment batch. Both now consult the retirement predicate. Giki had also been
> correct only by accident…

The transferable rule: **enumerate every path by which stored content leaves the system
(prompt, LLM enrichment, published page, export, log) and route all of them through one
liveness predicate. Ranking is not gating.** "Last in a ranked list" is inside any batch
whose size exceeds the list's tail.

Regression coverage: `tests/unit/retirement.test.ts:342`, `:348`, `:380` assert a secret
string is absent from `generateGikiPage(...).content` after retirement.

### 3.3 `enrichment-cache.ts` — versioned envelope, content-hash key

`src/core/enrichment/enrichment-cache.ts` (72 lines, whole file is the mechanism):

```ts
export const CACHE_VERSION = 1;
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache', 'enrichment');
export type EnrichmentKind = 'session-summary' | 'preference-extraction';
interface CacheEnvelope<T> { version, kind, hash, createdAt, payload: T }
// path: data/cache/enrichment/{kind}-{hash}.json
```

- `readCache` (`:43-56`) returns `null` when `version !== CACHE_VERSION` **or**
  `kind !== kind` — a version bump turns every old entry into a miss automatically, no
  eviction pass needed.
- `hashContent` (`:32-41`) is DJB2 → base36, with the comment *"Duplicated rather than
  cross-imported to keep enrichment independent of the graph module's internals."*
  (See antipattern #2 — this is a 32-bit hash used as a cache key.)
- Everything is `try {} catch { return null }` — a cache is never allowed to fail a run.

### 3.4 Prompt version in the cache key (the Run-21 postmortem)

`preference-extractor.ts:146-166`:

```
// Prompt version. Bump when the extraction prompt changes so cache entries
// from older prompt versions don't leak into fresh runs. Last bumped when
// the prompt was tightened (cap=3, strict disqualifiers) — see Run 21 post-
// mortem: without a version field the cache served stale permissive
// extractions and the 500q re-run was a no-op.
const PROMPT_VERSION = 'v2-strict-cap3';

function cacheKey(question, sessionDate, turns) {
  const payload = PROMPT_VERSION + '||' + question + '||' + sessionDate + '||' +
    turns.map(t => `${t.role}:${t.content}`).join('\n');
  return hashContent(payload);
}
```

**The cache key must include everything that determines the output — and the prompt is an
input.** The named failure mode is the worst kind: you change a prompt, re-run a 500-question
benchmark, and *the entire run is a no-op served from cache* while looking like a clean
experiment. Note also that the key mixes the *question* so identical sessions across
different questions get distinct entries (`:154-155`).

`temperature: 0` is set on both LLM passes with an explicit statement about cache
interaction:

- `preference-extractor.ts:231-234`: *"Keep cold-cache extraction as stable as the
  provider permits. Warm cache entries are intentionally not invalidated."*
- `session-summarizer.ts:114-117`: *"A cache miss should not introduce avoidable sampling
  variance into the graph. Existing warm entries remain valid; no cache version is changed."*

i.e. a determinism improvement was landed **without** invalidating the cache, and that
decision is recorded rather than assumed.

### 3.5 The lane-pool concurrency idiom (used verbatim twice)

`session-summarizer.ts:224-233` and `preference-extractor.ts:209-266`:

```ts
let cursor = 0;
async function lane(): Promise<void> {
  while (cursor < items.length) {
    const myIdx = cursor++;
    const item = items[myIdx];
    /* cache read → maybe LLM → write cache → accumulate → onProgress */
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => lane()));
```

Comment: *"True lane pool: each lane pulls the next item as soon as it's free, so one slow
gpt-4o-mini call doesn't stall a whole batch of 6."* (`session-summarizer.ts:223-224`).
Default concurrency 6, with a stated justification (`preference-extractor.ts:44-46`:
*"The OpenAI per-org rate limits comfortably absorb 6 concurrent gpt-4o-mini calls"*).
`onProgress(done, total, cacheHits)` exists specifically *"so the CLI can print a live
'summarized X/Y' line instead of a 20s gap"* (`:149-151`).

Also notable: `EnrichSessionGraphOptions.cacheOnly` (`session-summarizer.ts:142-144`):
*"Never call the summarizer on a cache miss. Used by retrieval-only measurements that must
remain offline and must not mutate the cache."* — a dedicated flag so a measurement run
cannot accidentally pay for, or pollute, the cache.

---

## 4. Preference extraction (query-time, category-gated)

`src/core/enrichment/preference-extractor.ts`. Header (`:1-22`) states the problem
precisely:

> Preference questions ask the assistant to make a recommendation that reflects known user
> tastes ("Can you suggest a hotel for my trip to Miami?"). The retrieval layer already
> surfaces the right session(s), but the preference signals themselves are typically
> scattered across many small mentions rather than stated as a single fact. When the prompt
> carries raw turn evidence alone, the answer model often over-generalizes or grounds in
> **assistant recommendations from past sessions** instead of the user's own statements.

That is a genuine domain insight: for preference questions, *retrieval is not the
bottleneck; distillation and voice attribution are*.

Mechanism:

1. **Gated on the router's category.** `answer.ts:209-234`: runs only when
   `opts.enablePreferenceExtraction && effectiveCategory === 'single-session-preference'
   && opts.documents?.length > 0`. The category comes from
   `router?.category ?? opts.questionType` (`answer.ts:214`); the router
   (`src/core/query/router.ts:1-57`) classifies by regex into six LongMemEval categories
   and explicitly refuses to use ground-truth labels by default
   (*"we publish an honest leaderboard number measured the same way as Zep / Mastra"*,
   `router.ts:16-18`).
2. **One LLM call per haystack session**, lane-pooled at 6.
3. **Prompt is a shortlist extractor with a hard cap and an explicit "return nothing"
   instruction** (`:68-107`):
   - `"Return AT MOST 3 statements. Prefer zero over loose matches. A statement qualifies
     only if omitting it would make the recommendation worse or wrong."`
   - Qualifying: concrete preference/constraint/dislike/allergy/prior choice that *narrows*
     the recommendation; a fact about the user's situation the recommender must respect.
     Examples are given in three languages each.
   - Disqualifying, enumerated: generic habits, **past assistant suggestions even when the
     user engaged with them**, world facts, restatements of the question, off-topic
     statements, filler (`"that sounds good", "merci", "danke", "mulțumesc"`).
   - `"If none qualify, return an empty list — this is the correct answer for most sessions."`
   - Voice rules: preserve first-person voice and original language; each statement must be
     self-contained.
4. **Rendered as a labeled, prioritized prompt block** (`renderPreferenceBlock`, `:275-292`):

```
--- USER PREFERENCE STATEMENTS ---
(Distilled user-voice statements extracted from the haystack sessions. Prefer these when
grounding preference-type answers.)
- I prefer window seats [session:abc|date:2023-03-31 (Fri)|turn:3]
```

   prepended to the serialized subgraph (`answer.ts:233-234`), so distilled evidence
   precedes raw turn evidence. Empty input → empty string, *"so the caller can
   unconditionally concatenate"* (`:273-274`).
5. **Cost model is in the header** (`:20-22`): `~30 preference questions × ~50 sessions ×
   ~$0.0005 ≈ $0.75 per cold 500q run`, near-zero warm.

The two ideas most worth stealing: **(a) an LLM extraction pass whose success criterion is
"usually returns nothing", with the disqualifiers enumerated as a list rather than implied;
(b) attributing the *voice* of an extracted statement (user vs assistant) as a first-class
requirement, because "the assistant recommended X last time" is the dominant false positive
for preference questions.**

---

## 5. Session summarization (level-1 index nodes)

`src/core/enrichment/session-summarizer.ts`. Header (`:1-12`):

> A full haystack has ~50 sessions × ~50 turns ≈ 2500 turn nodes — retrieval at 20-50
> nodes can't cover all of them. A summary node per session gives multi-session +
> temporal-reasoning questions a dense, seed-able index of "what happened in this session"
> **without displacing turn-level evidence** for targeted single-session questions.

`SessionSummary = { summary, entities[], dates[], claims[] }` (`:28-33`). The prompt
(`:35-66`) asks for a ~200-token dense paragraph plus canonical entities, referenced dates
(prefer `YYYY-MM-DD`), and *"short atomic statements worth indexing separately, in the
speaker's voice and language"*.

`enrichSessionGraph(graph, docs, opts)` (`:162-338`) is the graph-level hook. Mechanism:

- Group existing turn nodes by session by scanning `node.source.file` for the
  `conversation:` prefix (`:170-179`) — session membership is recovered from the source
  path convention `conversation:{questionId}/{sessionId}`.
- `skipEmpty` (default true) skips sessions whose turns were all pruned (`:194-195`).
- Cache key = `hashContent(sessionDate + '|' + turns.map(t => role:content).join('\n'))`
  (`:231-235`) — note: **no prompt version here**, unlike the preference extractor.
- The summary node (`:270-297`):
  - `type: 'session-summary'`, `level: 1` — *"Summary level — above raw turn nodes at
    level 0"*;
  - `source.file` = the session's source file, `source.section = 'session-summary'`, so the
    summary is attributable to the same source as its turns;
  - `confidence: 0.8` (below the 0.9 given to extracted content — a synthesized node is
    deliberately ranked under primary evidence);
  - `entities: summary.entities.slice(0, 20)`;
  - **`claims` and `dates` are stored as `' || '`-joined strings** with the comment
    *"Store claims as a delimited string so the metadata type stays
    Record<string, string | number> — serializer can split on `||`"* (`:287-290`). An
    honest, ugly workaround for a metadata value type that cannot hold arrays, documented
    at the site.
- **`summarizes` edges** summary → each turn, `weight: 0.7` with the comment
  *"Weight 0.7 > the pruner's minDirectedWeight so these edges survive optimization"*
  (`:302-304`; pruner floor is `minDirectedWeight: 0.05` in `graph-builder.ts:151`, and
  the LongMemEval runner may use a stricter one). Choosing an edge weight **against a
  known downstream threshold** and saying so is good practice.
- `addDocument(graph.tfidfIndex, summaryNode.id, content)` per summary (`:318`), then
  `computeIdf(graph.tfidfIndex)` **once** after the loop (`:330-331`) —
  *"cheaper than once per doc"*. Note this mutates global IDF and therefore every existing
  node's scores; the tradeoff is not discussed.
- Returns `{ summaryCount, edgeCount, cacheHits, llmCalls, failures }` — every optional
  pass in this repo returns a cache-hit / call / failure tally, which is what makes the
  cost model auditable.

Design summary: **a summary is a node in the same graph, at a distinct level, with a
distinct type, wired to its evidence by a typed edge, indexed in the same lexical index,
and ranked slightly below primary evidence.** It is not a side table. That means one
retrieval path serves both "what happened in March" and "what exactly did I say".

---

## 6. Multilingual by construction

Not a bolt-on. Three layers all assume mixed-script corpora:

1. **Deterministic layer** — sentence terminators across 9 script families
   (`chunker.ts:176-189`); classification patterns in ~13 languages per category
   (`chunker.ts:191-298`); entity extraction with dedicated run-detectors for 15+
   non-Latin scripts (`entity-extractor.ts:29-110`); a ~250-entry multilingual capitalized
   stoplist (`:216-275`); Unicode-aware person detection `^\p{Lu}\p{Ll}+$`
   (`identity-extractor.ts:207`); role/organization patterns in 13 languages
   (`identity-extractor.ts:234-289`); PDF header heuristics keyed on section words in 12
   languages incl. `摘要`, `서론`, `введение` (`pdf-parser.ts:155`); conversation role-label
   detection in 7 languages (`conversation-parser.ts:29-39`).
2. **LLM prompts explicitly forbid translation.**
   `session-summarizer.ts:45-49`:
   > Write the summary in the SAME language as the transcript. Preserve entities in their
   > original script (don't transliterate: keep "東京" not "Tokyo" if the transcript is in
   > Japanese, keep "Müller" not "Mueller", keep "București" not "Bucharest").

   `preference-extractor.ts:70-74`:
   > Extract statements in the user's ORIGINAL language — do not translate. Preserve names,
   > places, and terms in their original script. Match semantically across languages (a
   > French preference is relevant to an English question about the same topic).
3. **Cross-language matching is the LLM's job, exact-script preservation is the index's
   requirement.** The reason is mechanical: summaries and claims are re-indexed into the
   same TF-IDF index as the original turns (`session-summarizer.ts:318`). A summary that
   transliterated `București → Bucharest` would produce a summary node that cannot be
   retrieved by the same query that retrieves its own evidence. Translating at
   summarization time silently breaks lexical recall.

---

## 7. Parsers

### 7.1 PDF — the strongest parser code in the repo

`src/core/ingestion/parsers/pdf-parser.ts`.

**Position-aware glyph joining** (`:11-44`) — the mechanism:

```ts
const gap = next.transform[4] - (item.transform[4] + item.width);   // x-origin delta
const fontSize = Math.abs(item.transform[3]) || 10;                 // y-scale ≈ font size
if (gap > fontSize * 0.2) text += ' ';                              // else concatenate
...
return text.normalize('NFC');
```

Rationale in the docstring: *"Blindly joining with ' ' splits words in PDFs where each
glyph is a separate item (common in Eastern European and other diacritic-heavy PDFs)…
After joining we run NFC normalization so combining diacritic sequences ('a' + '̆')
collapse into precomposed forms ('ă')."* `item.hasEOL` forces a newline.

This is ~20 lines, dependency-free given pdfjs `TextItem`s, and directly portable. The two
insights: (a) inter-item spacing must be measured in **font-size-relative units**, not
absolute; (b) **NFC after join, not before** — the combining marks may arrive as separate
text items, so normalizing per item does nothing.

**Bounded extraction** (`:46-107`):
- `PAGE_BATCH_SIZE = 10` with the comment *"Each batch is a Promise.all that blocks the
  event loop until all pages in it are rendered — keep this small so the sidecar stays
  responsive between batches."*
- `const yieldToLoop = () => new Promise<void>(r => setImmediate(r));` awaited between
  batches (`:90`, `:102`).
- `DEFAULT_MAX_PAGES = 2000` (`:68`), *"Bounds latency/memory for an attacker-supplied PDF
  while still covering the overwhelming majority of legitimate documents. Opt out with
  `maxPages: Infinity`."*
- **Truncation is recorded in the content itself**, not only in metadata (`:106-108`):
  `fullText += "\n\n[Note: This PDF has 3000 pages. Only the first 2000 pages were
  ingested.]"` plus `metadata.truncated = 1`, `metadata.pagesIngested`. So a model reading
  a retrieved chunk can see the corpus was cut.
- Dependency choice is documented with the alternatives considered (`:70-75`):
  *"unpdf wraps pdfjs-dist for serverless/Node runtimes — same upstream engine as
  pdf-parse@2.x but configured to avoid the LoopbackPort structuredClone failure path that
  breaks pdf-parse@2 in Node. Replaces pdf-parse as of SDK 0.4.0; chosen over alternatives
  (pdfreader, pdf2json, mupdf-js) because it preserves pdfjs-quality text extraction with
  the smallest API/output drift."*
- Section detection (`:140-193`) is heuristic: a line is a header if it is <80 chars,
  starts with `\p{Lu}`, and doesn't end with `.` or `。`; or matches `^\d+\.?\s+\p{Lu}`; or
  matches a 12-language section-word list. Fallback to a single `Content` section.
- Metadata via `getMeta` in a try/catch, falling back to filename (`:114-124`).

### 7.2 Adversarial-input bounding across the ingest surface

A consistent posture: **every ingest input is treated as attacker-controlled and each
parser's worst case is bounded, with the specific pathological input named.**

`chunker.ts:300-327` (`extractLinks`) is the sharpest example:

```
// Guard against pathological inputs... cap the scan region so an
// adversarial document can never make this dominate ingest time.
const MAX_SCAN = 256 * 1024;
const scan = text.length > MAX_SCAN ? text.slice(0, MAX_SCAN) : text;

// Quantifiers are BOUNDED on purpose. An unbounded `[^\]]+` / `[^)]+` makes
// the matcher O(n²) on long runs of unbalanced brackets (e.g. "[[[[…"): at
// every `[` the engine rescans to end-of-string for a closing `]`. A few
// hundred KB of such input froze the event loop for minutes. Bounding the
// groups keeps it linear; excluding whitespace from the URL (real URLs have
// none) shrinks the backtracking surface further.
const mdLinks = scan.matchAll(/\[([^\]]{1,500})\]\(([^)\s]{1,2048})\)/g);
const wikiLinks = scan.matchAll(/\[\[([^\]]{1,500})\]\]/g);
```

Three distinct techniques in one 28-line function: a scan cap, bounded quantifiers with
domain-justified limits, and a narrowed character class justified by the domain ("real URLs
have no whitespace"). The named symptom — *the event loop froze for minutes* — is what
makes this a security finding rather than a style note.

Companions: `pdf-parser.ts:56-68` (page cap + explicit opt-out), `image-parser.ts:1-9`
(*"Every ingested image is attacker-controlled content, so the parser must be robust
against malformed IFD structures; exifr is actively maintained and fuzz-tested for exactly
that. Input size is bounded upstream by the sidecar's ingest byte cap."* — the abandoned
`exif-parser@0.1.x` was replaced for this reason), `incremental.ts:56-68` (batch key
conflict validated **before any node is written**, so a rejected append leaves the graph
untouched: *"Throwing mid-loop would leave the graph half-mutated… which is a worse failure
than the orphan it replaces"*).

### 7.3 Markdown

`src/core/ingestion/parsers/markdown-parser.ts`. Stack-based `#`-heading tree builder
(`:72-104`), naive `---` frontmatter with numeric coercion (`:50-63`), title = first `# `
(`:42-48`).

The interesting part is the **headerless-content fallback** (`:11-32`):

```
// Headerless-content fallback: if the input is non-empty prose but has
// no `#` heading anywhere, `buildSectionTree` returns an empty array
// because it only attaches content lines to an open section. That made
// the chunker emit zero content nodes and the caller's `appendMarkdown`
// looked like a no-op — biting MCP `remember` callers that pass plain
// prose without a synthetic header (a common AI-client shape).
```

Fix: wrap the post-frontmatter body in one synthetic section titled with the resolved
document title. The observation *"a common AI-client shape"* is the useful part: an MCP
`remember(text)` call is naked prose, and a parser tuned for authored documents silently
drops it.

### 7.4 Conversation

`src/core/ingestion/parsers/conversation-parser.ts`. Four formats behind one entry point
with sniffing (`:25-41`):

- ChatGPT: `content.includes('"mapping"') && content.includes('"message"')`
- Slack: `'"type": "message"' && '"channel"'`
- Claude: role-label prefixes in 7 languages (`Human:`, `Utilisateur:`, `Пользователь:`, …)
  or a `> ` quote marker
- fallback `raw`

Every structured parser falls back to `parseRaw(content, sourceFile)` inside its own
`catch` (`:114-116`, `:136-138`), so a malformed export degrades to paragraph-splitting
rather than throwing.

`conversationToDocument` (`:177-198`) filters `system` messages and maps each remaining
message to a `ParsedSection` titled `` `${role === 'user' ? 'User' : 'Assistant'} (turn
${Math.floor(i/2)+1})` ``. See antipattern #3 — this is where role provenance is lost.

`sourceFile` becomes `conversation:${conv.id}`, which is the convention
`enrichSessionGraph` later greps for (`session-summarizer.ts:174-175`).

LongMemEval wiring (`tests/longmemeval/official/ingest.ts`) is worth noting:
`normalizeDate` (`:17-33`) converts `"2023/03/31 (Fri) 14:13"` → `"2023-03-31 (Fri)"` with
the rationale *"the day-of-week is useful for temporal questions ('last Friday') but the
time-of-day is noise and the slashes don't match the YYYY-MM-DD format the prompt
promises… so every node + today's-date preamble agrees on format"* — i.e. **the ingest
normalizer's target format is dictated by what the prompt template claims**. And each
question gets an isolated graph (`:81-83`) so there is no cross-question contamination.

### 7.5 HTML, CSV/JSON, image, video

- **HTML** (`html-parser.ts`): cheerio; strips `script, style, nav, footer, header, aside,
  .sidebar, .nav` (`:8`); picks `main, article, .content, .docs-content, body` first match
  (`:26`); flattens **direct children only** into `{tagName, text}` and then runs a
  heading-accumulator state machine (`:29-59`); `pre`/`code` are re-fenced as
  ```` ``` ```` blocks so code survives into the graph as code (`:54-56`).
- **CSV** (`csv-parser.ts`): papaparse with `header/skipEmptyLines/dynamicTyping`; emits a
  synthetic **`Schema` section** in prose — *"This dataset has 412 rows and 7 columns:
  a, b, c."* (`:18-23`) — then row batches of 10 rendered as `col: value, col: value`
  lines (`:26-41`). Turning tabular structure into a sentence so the same TF-IDF/entity
  path works is the notable move. `parseJson` (`:56-110`) mirrors it: arrays batch like
  CSV, objects become one section per top-level key with values JSON-stringified and
  truncated at 1000 chars.
- **Image** (`image-parser.ts`): the "$0 path" — EXIF only, no API calls (`:18-19`). Every
  extracted tag is rendered as an **English sentence**: `"Image was taken at GPS
  coordinates: latitude 37.774900, longitude -122.419400. Altitude: 15.2m."` (`:92-97`),
  `"This image was captured on 2024-03-15T…"`, `"Camera make: Canon. Camera model: …"`.
  Filename is mined too: `report-q3-final.jpg` → *"Image filename suggests: report q3
  final."* (`:142-152`). Vision is strictly opt-in and double-gated on
  `options.enableVision && process.env.OPENAI_API_KEY` (`:157`), and its failure is logged
  through `redactId(sourceFile)` (`:163`) rather than raw. The vision call
  (`:186-211`) asks for `{description, objects[], text, mood}` at `maxOutputTokens: 300`
  and maps each field to its own section, including an explicit `Text Content (OCR)`
  section.
- **Video** (`video-parser.ts`): container metadata via `music-metadata`, same
  metadata-as-prose treatment (`:24-102`); `parseSubtitles` (`:158-203`) strips
  sequence numbers, `-->` timing lines and `WEBVTT`, then batches text blocks 10 at a
  time into `Transcript 1-10` sections. See antipattern #6.

**The generalizable idea across image/video/CSV: render non-prose sources as prose
sentences at parse time.** Cost: verbosity and some fabricated phrasing. Benefit: zero
special-casing downstream — one chunker, one entity extractor, one index, one retrieval
path, and the LLM reads natural language instead of a serialized record.

---

## 8. What "giki" is

`giki` = **graph + wiki**: LLM-free, deterministic generation of human-readable topic
pages **from the graph**, with per-line citations back to node ids. It is the "human audit
trail" leg of the project's thesis (`AGENTS.md:27`), the counterweight to the
deliberately-unreadable `.gai` binary format
(`src/app/view-gai/page.tsx:224`: *"The format is designed for AI consumption, not human
editing — that's what the Giki and Audit pages are for."*).

`src/core/giki/giki-generator.ts`, 275 lines, no LLM anywhere.

**Relevance scoring** (`:26-63`) — additive then multiplicative:

```
entity substring match      +0.5
content substring match     +0.3
person node name match      +0.8
metadata.synthesis present  +0.1
relevance *= node.confidence
skip if isRetired(...)
keep if relevance > 0        → top 50 by relevance
```

**Type-partitioned page layout** (`:79-197`) — the structure is derived from `NodeType`:

| section | source | cap | note |
|---|---|---|---|
| lead | `definition` nodes, else top `fact` | 3 / 1 | synthesis rendered in italics above the content |
| `## Key People` | `person` nodes | 10 | |
| `## Timeline` | `event` nodes **sorted by year extracted from content** (`:81-85`, `extractYear` `:267-270`) | 15 | rendered `**1936** — …` |
| `## Key Facts` | `fact` nodes | ~14 | skips ids already used |
| `## Data` | `data-point` nodes | 10 | |
| `## Claims & Attributions` | `claim` nodes | 5 | preceded by `> *The following are attributed claims, not verified facts.*` and each line carries `(confidence: 72%)` |
| `## Relationships` | non-structural directed edges touching used nodes | 15 | `"A..." **type** "B..." (weight: 0.70)` |
| `## Sources` | `[...new Set(topNodes.map(n => n.node.source.file))]` | — | |

**Citation format**: every rendered line ends with `^[node:${node.id}]^` (`:101`, `:116`,
`:129`, `:141`, `:150`, `:161`), and the footer states the format explicitly (`:186-188`):

```
*Generated by Graphnosis from 37 graph nodes across 4 source(s).*
*Node citations use ^[node:ID]^ format for traceability.*
```

**Index generation** (`:200-241`): top 30 entities by mention count across all nodes, plus
every `person` node's content, capped at 40 topics; each becomes a page; plus an index page
listing `- [Title](slug.md) — N nodes`.

Served at `GET /api/graph/giki` with `?topic=`, `?index=true`, `?format=markdown`
(download as `giki-full.md`) — `src/app/api/graph/giki/route.ts`, UI at
`src/app/giki/page.tsx`.

**Why this matters as an idea**: the deterministic type classification done at *chunk time*
(`classifyChunk`) is what makes a *typed, sectioned* wiki page generatable with zero
inference at *render time*. Definition/event/data-point/claim/fact is not decoration — it
is the page schema. And treating claims differently from facts, with an explicit "these are
attributed, not verified" banner and a visible confidence percentage, is honest surfacing
of the epistemic distinction the node types already carry.

Deficiencies: see antipattern #5.

---

## 9. Example corpora

Five corpora under `src/examples/<name>/{config.ts,fetcher.ts}`, each with the same
two-file shape and the same exported contract:

```ts
fetchAll<X>(onProgress?: (current: number, total: number, title: string) => void)
  : Promise<ParsedDocument[]>
```

Registered in one table (`src/app/api/examples/[dataset]/route.ts:11-41`) mapping slug →
`{name, fetcher, label}`; the route calls the fetcher, logs progress, calls `buildGraph`,
stores the result, and returns node/edge counts.

| corpus | what | size | selection criterion (verbatim) | rate limit |
|---|---|---|---|---|
| `wikipedia` | History of Computing articles via `wtf_wikipedia` | 50 titles | *"Selected for rich cross-references, dates, people, and concepts"* (`config.ts:1-2`) | 100ms (`fetcher.ts:53-54`) |
| `arxiv` | Transformer papers, **abstracts only** via the Atom API | 25 | *"~25 foundational papers that heavily cite each other"* (`config.ts:2`) | 3s, *"arXiv rate limit: max 1 request per 3 seconds"* (`fetcher.ts:128-129`) |
| `nextjs-docs` | MDX from `raw.githubusercontent.com/vercel/next.js/canary/docs` | 31 files | curated route through getting-started → guides → API reference | 200ms (`fetcher.ts:47-48`) |
| `nasa-mars` | Mars rover photo metadata (10 sols × ≤5 photos) **plus 6 hand-written mission facts** | ~16 docs | hybrid live-API + curated prose | 2s, DEMO_KEY note (`fetcher.ts:122-123`) |
| `cc-gallery` | Wikimedia Commons image metadata (no image bytes) | 10 | CC/PD only, cross-domain overlap with the other corpora | 500ms (`fetcher.ts:162-163`) |

Notable design choices:

- **Corpora are chosen for graph density, not volume.** Both prose corpora say so
  explicitly. 50 Wikipedia articles about computing history maximize person nodes, dates
  and cross-references; 25 mutually-citing transformer papers maximize `cites` edges.
  A demo corpus for a *graph* product must be selected for edges.
- **Deliberate cross-corpus entity overlap.** `cc-gallery` includes `File:Eniac.jpg` and
  `File:Alan Turing Aged 16.jpg` (also in the Wikipedia corpus) and Mars imagery (also in
  the NASA corpus) — `config.ts:39-51`, `:21-32`. So multi-corpus ingests demonstrably
  produce cross-source `shares-entity` edges.
- **Each corpus exercises a different ingest modality**: encyclopedic prose with a native
  section tree; short abstracts synthesized into four fixed sections; MDX needing
  pre-processing; live JSON API rows + curated markdown facts; pure metadata records. One
  suite covers most of the parser matrix.
- **Fetch is cheap by construction**: arXiv uses abstracts *"instead of full PDFs for the
  PoC (faster, no PDF parsing needed)"* (`arxiv/fetcher.ts:4-5`); cc-gallery fetches
  metadata only *"doesn't download full images (saves bandwidth)"*
  (`cc-gallery/fetcher.ts:5`); nasa-mars caps at 5 photos per sol
  *"to keep dataset manageable"* (`:30-31`).
- **Every fetcher is failure-tolerant per item**: `try/catch → return null`, and
  `fetchAll*` simply omits nulls. One dead URL never fails an ingest.
- **Rate limits are per-source, documented in code and again in `AGENTS.md:76`**
  (*"Rate limiting: Wikipedia (100ms), arXiv (3s), NASA (2s) between API requests"*).
- Corpus-specific pre-processing lives in the fetcher, not the parser:
  `nextjs-docs/fetcher.ts:13-19` strips `import` lines, self-closing JSX, JSX blocks, JSX
  comments and frontmatter before handing off to `parseMarkdown` — the shared parser stays
  format-pure.
- `nasa-mars/config.ts:19-43` embeds 6 hand-written ~500-char paragraphs of Mars facts.
  These are dense with dates, measurements and proper nouns — i.e. they are *fixture prose
  engineered to exercise `classifyChunk`'s event / data-point paths*, though that isn't
  stated.

---

## 10. Ingest provenance & test craft (process findings)

### 10.1 Ingest policy id, stamped twice, with a `'mixed'` vintage

`src/core/types.ts:7-12`:

```ts
/**
 * Source-chunk write policy introduced by M2. Source nodes written under this
 * policy keep exact-content observations distinct across source files and carry
 * the same id in `node.metadata.ingestPolicyId`.
 */
export const CURRENT_INGEST_POLICY_ID = 'source-provenance-v1';
```

Stamped on the graph (`graph-builder.ts:124`) **and on every node**
(`graph-builder.ts:58`, `incremental.ts:190-192`). Appending to a graph built under an
older/absent policy sets the graph marker to `'mixed'` rather than relabelling
(`incremental.ts:289-292`):

```ts
graph.metadata.ingestPolicyId =
  startNodeCount === 0 || graph.metadata.ingestPolicyId === CURRENT_INGEST_POLICY_ID
    ? CURRENT_INGEST_POLICY_ID
    : 'mixed';
```

The rule: **legacy nodes stay absent-marked; the container advertises mixed vintage.** You
can therefore always tell, per node, which ingest semantics produced it — which matters
because the semantics genuinely changed (cross-source identical content used to collapse;
under `source-provenance-v1` it stays attributable to both sources).

### 10.2 Semantic, not byte-identical, parity

`tests/unit/ingest-path-parity.test.ts:1-14` opens by *defining the invariant and its
exclusions*:

```
 * The invariant is semantic, not byte-identical:
 *   - every source chunk survives with its own provenance and multiplicity;
 *   - source-local `contains` / `precedes` relationships are identical;
 *   - source metadata and edge integrity agree.
 *
 * Random node/edge ids, corpus-wide identity extraction, forward-only
 * cross-document relationships, and exact undirected-edge equality are
 * deliberately outside this assertion.
```

Implementation: a content fingerprint
`[source.file, source.offset, source.section, type, content, metadata.chunkOrder]`
(`:89-97`), compared as sorted multisets between `build()` (bulk) and repeated `append()`
(`:79-111`); a check that identical evidence stays attributable to **both** source files
(`:113-120`); structural-edge fingerprints compared by endpoint fingerprint rather than id
(`:122-141`); dangling-endpoint count zero on both paths (`:143-155`); policy stamping on
both graph and nodes, surviving a `.gai` round-trip (`:161-176`); and a simulated pre-M2
graph asserting mixed vintage (`:178-196`).

**Naming what the assertion excludes is what makes the test maintainable.** Without it,
the next person either weakens it or chases nondeterminism that was never in scope.

### 10.3 Defect-class-named tests, no framework

`tests/unit/graph-integrity.test.ts:1-13`:

```
 * Graph construction integrity — six defects that all shared one symptom:
 * content entered the system and quietly failed to be findable.
 *
 * C1 hierarchy edges survive key remapping
 * C2 short complete units are not discarded as fragments
 * C3 documentCount tracks documents.size, and IDF drops vanished terms
 * C4 dedup preserves source provenance and same-source idempotency
 * C5 appended nodes link to nodes already in the graph
 * C6 structural headings do not become person identities
 *
 * Run: tsx tests/unit/graph-integrity.test.ts
```

The test files are plain `tsx` scripts with a five-line `check(name, cond, detail)` helper
and `process.exit(failures === 0 ? 0 : 1)` — no framework at all. Failure messages carry
the *consequence*, not just the mismatch:
`"${orphaned}/${g.nodes.size} orphaned — these are what an orphan sweep deletes"` (`:61`),
`"a complete answer-bearing turn was dropped as a fragment"` (`:95`),
`"stale IDF lets a query score a term no document contains"` (`:119`),
`"Ada mentionCount=1 — the heading was dropped, not counted"` (`:59` of the C6 block).

Two more craft details:

- **The fixture asserts its own premise.**
  `tests/unit/ingest-determinism.test.ts:84-89` checks that two builds mint *disjoint* node
  id sets before testing determinism, with the failure message
  `"ids may have become deterministic, revisit this test"` — guarding against a vacuous
  pass.
- **The header explains why the *previous* test was insufficient**
  (`ingest-determinism.test.ts:1-17`): the older `traversal-determinism.test.ts`
  hand-authors ids `'a','b',…` and so never exercises the `nanoid()` ids production uses;
  the consequence was measured — *"on a 40-question sample, evidence ORDER differed on
  21/40 and the evidence SET on 6/40 between two builds inside one single-threaded
  process."*

The naming convention `C1…C6` (defect classes) rather than `describe('chunker')` means each
assertion is anchored to a real incident, and a regression names the incident it revives.

---

## 11. Antipatterns / things not to copy

### A1. `isLikelyPerson` makes every Title-Case phrase a human being

`identity-extractor.ts:199-208` — a "person" is any string of ≥2 whitespace-separated words
each matching `^\p{Lu}\p{Ll}+$`. Combined with `extractEntities`' multi-word capitalized
phrase rule (`entity-extractor.ts:11-13`, which does **not** consult
`COMMON_CAPITALIZED`), the arXiv corpus turns *"Attention Is All You Need"*,
*"Deep Residual Learning"*, *"Machine Learning"*, *"New York"* and *"Related Work"* into
`person` nodes with `role`/`organization` attributes guessed from ±100 chars, `knows` edges
to each other and `discussed-in` edges to their sources.

The two-pass structural gate (§2.2) fixed only the *structural-node* origination path; the
content path is unguarded. And the documented mention threshold is dead code:

```ts
for (const [name, mentions] of entityMentions) {
  if (mentions.count < 1) continue;   // :75-76 — count is >= 1 by construction
```

with the comment above it claiming *"Create person nodes for entities mentioned at least
once"* (`:72`). So there is effectively **no** frequency threshold at all — one mention
anywhere mints a person. A `>= 2` or `>= 3` threshold is the obvious cheap fix and the code
is shaped as though it once had one.

Cost is also quadratic: the co-mention pass is `for i, for j>i` over all persons with
`aMentions.nodeIds.filter(id => bMentions.nodeIds.includes(id))` inside — O(P² · M²) with
array `includes` (`:158-184`). With P inflated by false persons this is the dominant ingest
cost on a title-heavy corpus.

### A2. 32-bit DJB2 as an LLM-cache key

`enrichment-cache.ts:32-41` uses a 32-bit DJB2 → base36 hash, duplicated from the graph
module *"to keep enrichment independent of the graph module's internals"*. The very same
repo documents this hash's collision profile in `incremental.ts:89-95`:

> `contentHash` is a 32-bit DJB2 value: at cortex scale collisions stop being hypothetical
> — the birthday bound puts at least one collision at roughly 5% by 20k nodes and 25% by
> 50k — and a collision here does not surface as an error.

The session-summary cache is sized at *"~25k LongMemEval_s sessions"*
(`session-summarizer.ts:11`), i.e. squarely in the 5-25% regime. A collision here does not
produce a wrong node id — it **serves another session's summary as this session's summary
node**, or another question's preference statements into this question's prompt, with no
error and no way to detect it after the fact. Use a 128-bit content hash (or at minimum
store the full key material in the envelope and verify it on read — the envelope already
has a `hash` field but `readCache` never checks anything except `version` and `kind`,
`:50-51`).

Also: `CACHE_DIR = path.join(process.cwd(), 'data', 'cache', 'enrichment')`
(`enrichment-cache.ts:16`) makes a *library*'s cache location depend on the caller's
working directory, and there is no size bound, TTL or eviction on a directory that grows to
25k JSON files.

### A3. Role provenance is destroyed at parse time, then string-sniffed back

`conversationToDocument` (`conversation-parser.ts:177-186`) encodes the message role **only
into a rendered display string**:

```ts
title: `${msg.role === 'user' ? 'User' : 'Assistant'} (turn ${Math.floor(i / 2) + 1})`,
```

There is no `role` field on `ParsedSection` and no `role` in the section metadata.
Downstream, two separate files independently re-derive it by prefix-matching that
presentation string:

- `session-summarizer.ts:200-203`: `const role = s.title.startsWith('User') ? 'user' : 'assistant';`
- `preference-extractor.ts:139-144`: the identical five lines, duplicated.

So the whole "user voice vs assistant voice" distinction — the thing the preference
extractor's prompt spends a paragraph on (`preference-extractor.ts:89-90`: *"Past assistant
suggestions, even when the user engaged with them"* is the top disqualifier) — round-trips
through a human-readable label. Renaming the label to `"user (turn 3)"` silently
reclassifies every turn in the corpus as assistant.

The knock-on: `inferUserProfile` (`identity-extractor.ts:309-346`) filters on
`node.metadata.role !== 'user'`, and **nothing in the codebase ever writes
`metadata.role`** — the chunker writes `{...inheritedMetadata, sectionTitle}`
(`chunker.ts:132`), and `conversationToDocument`'s doc metadata is
`{source, format, messageCount, startedAt}`. So `inferUserProfile` always skips every node
and returns an empty `UserProfile` with empty `preferences` and `domains`. It is also
exported and **never called** anywhere in `src/` or `tests/`. A silently-vacuous public
API is worse than a missing one.

Turn numbering `Math.floor(i / 2) + 1` additionally assumes strict user/assistant
alternation after system filtering; two consecutive user messages desynchronize every
subsequent turn label — and those labels are what `PreferenceStatement.turn` cites back to
the answer model.

### A4. `parseRaw` fabricates roles by paragraph parity

`conversation-parser.ts:151-168`:

```ts
const messages = paragraphs.map((p, i) => ({
  role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
  content: p.trim(),
}));
```

`detectFormat` (`:25-41`) routes *anything it doesn't recognize* here, and every structured
parser falls back here on a parse error. So a malformed ChatGPT export becomes a transcript
whose speaker attribution is *invented from paragraph index parity*. In a system whose
entire premise is attributable, citable evidence — and whose preference extractor's job is
to distinguish user voice from assistant voice — synthesizing provenance rather than
recording "unknown" is the wrong default. `role: 'unknown'` (or refusing to produce a
`ParsedConversation` at all) preserves the ability to tell.

Notably, the LongMemEval harness sets `format: 'raw'` on conversations whose roles it *does*
know (`tests/longmemeval/official/ingest.ts:51`), bypassing the parser — which is the tell
that the raw path isn't trusted internally either.

### A5. Giki: an unused parameter, no index, and page-level duplicate citations

`giki-generator.ts:243-265` — `getTopicRelationships(graph, nodeIds, topic)` **never reads
`topic`**. It scans every directed edge in the graph, keeps any edge touching a used node
(minus `contains`/`precedes`), and the caller slices to 15. So the "Relationships" section
is "an arbitrary 15 edges incident to this page's nodes", not "relationships about this
topic", and it is presented to the reader as the latter.

Cost profile: `generateGikiIndex` (`:200-223`) calls `generateGikiPage` up to **40 times**,
and each call does a full `graph.nodes` scan for relevance, a full `graph.directedEdges`
scan for relationships, and its own `collectSupersededIds(graph)` (another full edge scan,
`:23`). That is O(40 · (N + E)) with three passes each and no shared index — for a
deterministic derivation that could be computed in one pass over the graph.

Within a page, de-duplication of citations is applied only in the "Key Facts" branch
(`:139`, `if (usedNodeIds.includes(node.id)) continue;` — itself a linear scan inside a
loop). A `person` node whose content matches the topic can be cited in both the lead
(via the `fact` branch) and "Key People"; `usedNodeIds` is used both as the dedup set and
as the page's declared citation list, so the footer's *"Generated from N graph nodes"*
double-counts.

### A6. A roadmap advertisement is written into the graph as retrievable knowledge

`video-parser.ts:129-137`:

```ts
if (options.enableTranscription && process.env.OPENAI_API_KEY) {
  sections.push({
    title: 'Transcription',
    content: 'Audio transcription via Whisper API is a planned feature. Currently, the ' +
      'framework is in place but requires ffmpeg for audio extraction from video ' +
      'containers. Contribute at github.com/nehloo/Graphnosis.',
    depth: 1, children: [],
  });
}
```

Asking for transcription produces a `ParsedSection` that becomes a chunk, becomes a node,
is entity-extracted (`Whisper`, `API`, `ffmpeg`, `github.com/nehloo/Graphnosis` all match
extractor rules), is TF-IDF indexed, and can be returned as *evidence* in a query subgraph
and serialized into an LLM prompt — indistinguishable from ingested content. An
unimplemented feature must fail, no-op, or set a metadata flag; it must never write
placeholder prose into the knowledge store. (The same file's `catch` branch, `:103-111`,
correctly writes a factual "metadata extraction not available" section instead, which shows
the authors know the difference.)

---

## 12. Smaller observations that didn't earn a finding slot

- `MIN_CHUNK_LENGTH`/`MAX_CHUNK_LENGTH`/`MAX_CHUNK_SENTENCES` live in a shared
  `constants.ts` alongside retrieval tunables, and several constants there carry
  paragraph-length experiment writeups (`SEED_OVERSAMPLE`, `constants.ts:27-57`, documents
  a measured 4-point LongMemEval regression, a paired p-value, and an explicit statement of
  *which experiment would settle it*). Tunables-with-experiment-log is a good pattern.
- `section` nodes (headings) **are** TF-IDF indexed while `document` nodes are not, with a
  stated reason: *"their short, high-signal titles are exactly what users type when
  searching. document nodes (top-level title only) are still excluded as they duplicate
  section content and add noise"* (`graph-builder.ts:73-78`, mirrored in
  `incremental.ts:155-158`).
- `attachEmbeddings` (`graph-builder.ts:169-200`) is a separate async pass *"Kept separate
  from buildGraph so the sync ingestion path stays sync for every existing caller"*, and it
  always attaches an index even when empty *"so subsequent queryHybrid / hasEmbeddings calls
  don't gaslight the caller with 'call buildEmbeddings first' when they already did"*
  (`:187-189`).
- `IngestOptions.maxPages` JSDoc claims *"Default `Infinity` (no cap)"*
  (`sdk/index.ts:131-133`) while `parsePdf` defaults to `DEFAULT_MAX_PAGES = 2000` and
  truncates (`pdf-parser.ts:66-81`). Additionally `appendFolder`
  (`sdk/index.ts:600-648`) accepts neither `chunkSize` nor `maxPages`, so a directory
  ingest silently caps every PDF at 2000 pages and cannot use chunk presets at all.
- `appendText` wraps input as `` `# ${source}\n\n${text}` `` (`sdk/index.ts:513-515`), so a
  filename becomes an H1 → a `document` node and a `section` node, both entity-extracted.
  Meanwhile `parseMarkdown` already has a headerless fallback (§7.3) that would handle naked
  prose without inventing a heading. Two mechanisms for the same problem, one of which
  injects the filename into the knowledge content.
- The MCP `ingest_files` tool (`src/mcp/tools/ingest_files.ts:71-95`) supports a narrower
  extension set (`.md/.markdown/.txt/.html/.htm/.csv/.pdf`) than the SDK
  (`+.json`) — two dispatch tables that can drift.
- `parseCsv` uses `dynamicTyping: true`, so `"007"` becomes `7` and `"1-2"` may become a
  date depending on papaparse behaviour, before being stringified back into prose. Lossy
  round-trip on identifier-like columns.
- `html-parser` only walks `body.children()` — direct children of the first matching
  container. A page whose content is inside a single wrapper `<div>` yields exactly one
  `Content` section with all text concatenated, i.e. no section tree at all.
- Every enrichment result type reports `{cacheHits, llmCalls, failures}`; `failures` is
  counted but never surfaced as an error anywhere in the runners — a silent-failure budget
  with no alarm threshold.
