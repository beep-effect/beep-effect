# RAG Retrieval Projection Layer — Research

<!--
Stage 1. Cite every external claim (inline URL). In-repo inventory is verified
against the filesystem (rg/ls); genuine gaps are marked NOT FOUND. Raw per-subtopic
findings live in research/<subtopic>.md — this file is the synthesis.
-->

This packet owns the **hybrid three-channel weighted-RRF policy** and graduates
its own fusion, projection, encoder, dedup, and citation-channel goals. The
fixture-driven fusion seam lands first; `goals/epistemic-bitemporal-edge-core`
defers RRF to it and does not rebuild it. Five research threads back the
synthesis below; each links to its raw file.

## 2026-07-14 Amendment — align-gate corrections

- **Runtime correction:** the live checkout pins `@electric-sql/pglite` **0.5.4**
  (`package.json`, `bun.lock`, and installed package agree). Its installed
  `exports` contain **no vector or textsearch subpaths**. The earlier 0.4.6
  runtime description below is stale; pgvector and `pg_textsearch` enablement
  each require fresh P0 proof rather than assumed subpath registration.
- **Live-source inventory:** a 2026-07-14 search of `packages/**/src` found no
  RRF/reciprocal-rank implementation, generated `tsvector`, or HNSW projection.
  It did find in-memory BM25 corpus/similarity tools under
  `packages/foundation/capability/nlp-processing/src/Tools/` and their canonical
  schemas in `packages/foundation/modeling/nlp/src/Core/Vectorization.ts`. These
  are fixture/diagnostic capabilities, not the durable lexical projection.
- **Migration source:** the prior-generation scorer and tests at
  `../beep-effect4/packages/knowledge/server/src/GraphRAG/RrfScorer.ts` and
  `../beep-effect4/packages/knowledge/server/test/GraphRAG/RrfScorer.test.ts`
  are migration material. The current-generation three-channel weights,
  empty-channel renormalization, literal tier/floor, spans, contributions, and
  deterministic tie behavior remain net-new extensions.
- **RRF-owner contract:** `goals/epistemic-bitemporal-edge-core` explicitly
  defers RRF to this packet. Candidate retrieval engines emit ranked streams;
  this packet is the sole owner of final fusion policy.
- **License reconciliation:** `research/SOURCES.md` is authoritative for
  **agentmemory = Apache-2.0**. The older `RESEARCH.md:377-380` statement that
  grouped agentmemory with unknown-license sources is superseded and must not
  control port discipline.
- **Dedup contamination boundary:**
  `research/bounded-concurrency-ingest-and-dedup.md` reproduces CourtListener
  AGPL-derived policy details. Treat those details as design-reference poison;
  any dedup goal requires an independently authored clean-room product policy
  and representative corpus.

## External Landscape

### Hybrid retrieval & RRF fusion contract — raw: [research/rrf-fusion-and-retrieval-contract.md](research/rrf-fusion-and-retrieval-contract.md)

Reciprocal Rank Fusion is the published method of Cormack, Clarke & Büttcher,
*"Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods"*,
SIGIR 2009; the paper gives `RRFscore(d) = Σ_r 1/(k + r(d))` and states verbatim that
"k = 60 was fixed during a pilot investigation and not altered" and "was near-optimal,
but that the choice was not critical"
(https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf). k=60 is the universal vendor
default — Azure AI Search ("performs best when you set k to a small value, such as 60",
https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking), OpenSearch
("By default, the rank constant is set to 60",
https://opensearch.org/blog/introducing-reciprocal-rank-fusion-hybrid-search/),
Elasticsearch (`rank_constant` "Defaults to 60",
https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion),
and LangChain `EnsembleRetriever` (`c: int = 60`, MIT,
https://sj-langchain.readthedocs.io/en/latest/_modules/langchain/retrievers/ensemble.html).
High k rewards cross-channel *consensus* (a doc must rank well across systems), low k
rewards a single top pick
(https://bigdataboutique.com/blog/reciprocal-rank-fusion-how-it-works-and-when-to-use-it);
the per-query contribution is bounded by ≈`1/k`, so **fused scores are not probabilities
and not comparable across queries** — threshold per-channel before fusion, rank after
(https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking).

RRF beats alpha-weighted *score* fusion (LegalEase's `alpha*bm25 + (1-alpha)*dense`)
because BM25 is unbounded while cosine lives in [0,1], so score fusion must normalize two
incompatible distributions and is brittle to drift
(https://www.maxpetrusenko.com/blog/rrf-vs-weighted-fusion-for-hybrid-ranking;
https://avchauzov.github.io/blog/2025/hybrid-retrieval-rrf-rank-fusion/). MongoDB names
the canonical pair precisely — *Reciprocal Rank Fusion* (rank-based, normalization-free)
vs *Relative Score Fusion* (normalize to [0,1] then weight)
(https://medium.com/mongodb/reciprocal-rank-fusion-and-relative-score-fusion-classic-hybrid-search-techniques-3bf91008b81d).
**Weighted RRF** (`contribution = weight × 1/(rank + k)`) is GA in Elasticsearch
(https://www.elastic.co/search-labs/blog/weighted-reciprocal-rank-fusion-rrf) and Azure,
matching agentmemory's captured snippet; vendor guidance: boost lexical weight for
precise-term/identifier queries, semantic weight for conceptual queries.

Two beep-specific deviations are *not* industry-standard. (1) **Whole-empty-channel weight
renormalization**: standards zero a missing *document* (LangChain inits each doc at 0.0;
Elasticsearch absent docs contribute zero), but no surveyed vendor renormalizes weights
when an entire channel is empty — OpenSearch explicitly leaves this unimplemented ("missing
items default to a score of 0.0, but this may not be optimal"). agentmemory's `totalW`
renormalization is therefore a justified beep-owned cold-start policy, not a borrowed
standard. (2) **Literal-match floor**: pure RRF does *not* guarantee an exact lexical hit
outranks fuzzy consensus — softwaredoug benchmarks conclude "RRF is not enough" and tier
candidates by match quality (all-terms-exact > partial > pure-vector)
(https://softwaredoug.com/blog/2025/03/13/elasticsearch-hybrid-search-strategies;
corroborated https://secondary.ai/blog/hybrid-keyword-search). This is the single most
important reason beep owns the fusion rather than delegating to a vector DB's built-in RRF:
the floor needs a dedicated literal-phrase channel **plus a hard tie-break**, not weight
alone. Optional post-fusion stages: source-authority as a *multiplicative* weight kept
orthogonal to relevance (.gov/.edu as high-trust TLDs,
https://backlinko.com/google-trustrank; AuthorityBench arXiv 2026,
https://arxiv.org/html/2603.25092v1), and a pluggable cross-encoder rerank
(`bge-reranker-v2-m3` local vs Cohere Rerank cloud,
https://www.pinecone.io/learn/series/rag/rerankers/) + MMR diversification
(`(1−λ)·rel − λ·max sim`, https://docs.opensearch.org/latest/vector-search/specialized-operations/vector-search-mmr/),
each carrying its own separate score à la Azure's `@search.rerankerScore`.

### pgvector HNSW projection under PGlite — raw: [research/pgvector-hnsw-projection-under-pglite.md](research/pgvector-hnsw-projection-under-pglite.md)

HNSW has two build params (`m`=16, `ef_construction`=64 by default) and one query param
(`hnsw.ef_search`=40), syntax `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)
WITH (m=16, ef_construction=64)`, cosine operator `<=>`
(https://github.com/pgvector/pgvector/blob/master/README.md). Three load-bearing gotchas:
(1) **`ef_search` must be ≥ the `LIMIT k`** — the index fetches `ef_search` candidates then
Postgres applies `WHERE`, so a selective filter can silently drop below `LIMIT` or to empty;
pgvector 0.8.0 added `hnsw.iterative_scan` to auto-expand
(https://neon.com/docs/ai/ai-vector-search-optimization;
https://www.postgresql.org/about/news/pgvector-080-released-2952/). (2) **Opclass/operator
mismatch silently degrades to a seq scan** — an index built `vector_cosine_ops` but queried
with `<->`/`<#>` falls back with no warning; the Drizzle column op (`vector_cosine_ops`) and
query helper (`cosineDistance` = `<=>`) MUST agree; verify with `EXPLAIN`
(https://www.paradedb.com/learn/postgresql/tuning-pgvector). (3) **HNSW indexes only ≤2000
dims on the `vector` type** (the 8KB-page limit), ≤4000 on `halfvec`, ≤64000 on `bit`
(https://github.com/pgvector/pgvector/blob/master/README.md;
https://github.com/pgvector/pgvector/issues/461) — so a native ≤768-dim local model fits
`vector(768)` HNSW cleanly while Gemini's 3072 default needs `halfvec(3072)` or MRL
truncation. Build the index *after* bulk load (matches the rebuildable-projection model).

PGlite is "Postgres in WASM" based on **PostgreSQL 17**, ~3 MB gzipped
(https://pglite.dev/docs/about); pgvector is an **external** extension package (~42.9 KB,
not core-bundled), enabled via `CREATE EXTENSION IF NOT EXISTS vector;` after registering it
in the `extensions` map (https://pglite.dev/extensions/). The live checkout now resolves
`@electric-sql/pglite@0.5.4` through `@effect/sql-pglite@4.0.0-beta.97`, and its installed
package exports neither a vector nor textsearch subpath. Extension enablement is therefore a
P0 projection-goal proof, not an assumed registration step. Drizzle ships the vector schema
(`vector('embedding',{dimensions})` + `.op('vector_cosine_ops')`) and distance helpers
(`cosineDistance`, `l2Distance`, …); thresholded top-k is `sql\`1 - (${cosineDistance(...)})\``
+ `.where(gt(similarity, …))`, but the `1 - distance DESC` ordering may not hit the index —
verify with `EXPLAIN`, order by raw distance ASC if needed
(https://orm.drizzle.team/docs/guides/vector-similarity-search;
https://github.com/drizzle-team/drizzle-orm-docs/issues/436). A dated integration gotcha:
`"$libdir/vector": No such file or directory` under PGlite was fixed by drizzle-orm PR #3824
(2024-12-22) — pin a drizzle-orm version that includes it
(https://github.com/drizzle-team/drizzle-orm/pull/3824). FTS keep-in-sync: doc-haus's "FTS5
external-content + triggers" is a SQLite construct (https://www.sqlite.org/fts5.html); under
Postgres the equivalent is a **generated `tsvector` STORED column + GIN index** (self-syncing,
no triggers, https://www.postgresql.org/docs/current/textsearch-tables.html) or the external
`pg_textsearch` BM25 extension if the PGlite build ships it
(https://www.tigerdata.com/blog/introducing-pg_textsearch-true-bm25-ranking-hybrid-retrieval-postgres).
HNSW builds hold the graph in `maintenance_work_mem` (64 MB default), tighter in WASM — the
main local scaling risk; keep corpora per-matter and rebuild rather than maintain one giant
index (https://www.crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector). Record
**provider + model + dimension + version** next to the vectors; a silent model swap corrupts
similarity with no error, and because vectors are a rebuildable projection the migration rule
is re-embed-from-source + rebuild-index (blue-green pointer switch), never rolling-update in
place (https://zilliz.com/ai-faq/how-do-i-handle-versioning-of-embedding-models-in-production;
https://callsphere.ai/blog/migrating-vector-databases-pinecone-pgvector-weaviate-embeddings).

### Local-first embedding model — raw: [research/local-first-embedding-models.md](research/local-first-embedding-models.md)

Hosted Gemini is migration-hostile: the embedding line shuts down on a ~6-month cadence and
the spaces are mutually incompatible (every swap = full corpus re-embed). Per the official
deprecations table, `embedding-001`/`embedding-gecko-001`/`gemini-embedding-exp-03-07` shut
down **2025-10-30**, `text-embedding-004` **2026-01-14**, and `gemini-embedding-001` (the
current GA the CAPTURE referenced) is scheduled to shut down **2026-07-14** — ~2 weeks from
this research (2026-06-29) (https://ai.google.dev/gemini-api/docs/deprecations.md.txt). The
nominal replacement is `gemini-embedding-2` (3072-dim default, MRL-truncatable), but it is
**Public Preview, not GA**, and is served on the `v1beta` API surface — Google's launch page
labels it "Public Preview" (https://blog.google/technology/developers/gemini-embedding-2/) and
the API examples use `v1beta` (https://ai.google.dev/gemini-api/docs/embeddings;
https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2/).
This reinforces (does not weaken) the local-first default: the only GA-stable hosted embedding
line is itself on a deprecation clock, so do not pin Gemini. **768 is the convergent interop
dimension** — InLegalBERT, EmbeddingGemma-300m, bge-base, gte-base, and nomic-embed-text-v1.5
are all natively 768, and 768 is one of Gemini's recommended MRL targets — so size the schema
against `vector(768)` + `vector_cosine_ops`, which fits the HNSW cap with margin and lets a
future Gemini provider drop into the same column via `output_dimensionality=768`. Recommended
default: **EmbeddingGemma-300m (ONNX)** — Gemma-3 lineage, 768 native (MRL→512/256/128), 2048
context, MTEB-English-v2 ≈ 69.67, with `onnx-community/embeddinggemma-300m-ONNX` shipping q8/q4
WASM variants for transformers.js (https://huggingface.co/blog/embeddinggemma;
https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX). InLegalBERT is a *wiring
reference only*: it is a masked-LM (raw BERT pooling is a poor retriever — the founding
motivation of Sentence-BERT, https://arxiv.org/abs/1908.10084) and trained on Indian case law,
wrong jurisdiction for US IP (https://huggingface.co/law-ai/InLegalBERT). The breadcrumb
prefix (`docName › section`) maps onto native asymmetric document prompts — EmbeddingGemma's
document prompt has a `title:` slot (query = `"task: search result | query: "`, document =
`"title: {title} | text: "`) — so the breadcrumb belongs in `title:`, not jammed into the
body. **Tauri-webview runnability**: the onnxruntime-web WASM backend (q8) works in every
webview, but WebGPU is *not* universal — WebKitGTK on Linux has no WebGPU
(https://www.mail-archive.com/webkit-gtk@lists.webkit.org/msg03883.html; Tauri request #6381
closed not-planned), so on the user's Linux box size perf against WASM, where a 300M model is
the realistic ceiling. This surfaces an align-stage fork: webview-WASM embeddings vs a
Rust-side ONNX sidecar (`ort`/Candle) that sidesteps both the WASM ceiling and the WebGPU gap.

### Offset-preserving char-span chunking — raw: [research/offset-preserving-char-span-chunking.md](research/offset-preserving-char-span-chunking.md)

The chunker is a **windowing layer that composes with — does not duplicate —** beep's
existing langextract aligner. The round-trip invariant already exists in-repo
(`text.slice(startChar, endChar) === quote`) and is **UTF-16 code-unit based**: JS
`.length`/`.slice`/indexing all count UTF-16 code units
(https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length),
so the chunker MUST emit `charStart/charEnd` as UTF-16 offsets into the exact same JS string
langextract aligns against, or the round-trip breaks. Google's reference langextract
(`chunking.py`, **Apache-2.0**, port-safe to study) tracks char offsets per-token and
aggregates to chunk spans, with boundary priority sentence > newline > never-split-a-token and
`max_char_buffer` default 1000 (recommended 1000–2000 for 32K+ models) — anchoring the
packet's ~2000-char target as the upper end of langextract's own band
(https://github.com/google/langextract/blob/main/langextract/chunking.py;
https://deepwiki.com/google/langextract). Critically, **re-derive offsets by search, not
arithmetic accumulation**: LangChain's `add_start_index` re-finds each chunk via `text.find`
rather than summing slice lengths, because unit-mismatch (token-count overlap vs char length)
produces wrong/negative `start_index`
(https://raw.githubusercontent.com/langchain-ai/langchain/master/libs/text-splitters/langchain_text_splitters/base.py;
bugs https://github.com/langchain-ai/langchain/issues/18972,
https://github.com/langchain-ai/langchain/issues/17642). **Never split a surrogate pair at a
boundary** — slicing inside one yields a lone surrogate and breaks the `quote` round-trip
(https://george.mand.is/2026/05/my-favorite-bugs-invalid-surrogate-pairs/); snap cuts to
code-point boundaries (`for...of`/`[...str]`), with grapheme-cluster safety
(`Intl.Segmenter`) a cosmetic nice-to-have. LSP 3.17's `positionEncoding` (defaults to and
mandates `utf-16`) is the standards precedent for pinning one declared offset unit
(https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/);
LlamaIndex `TextNode.start_char_idx` and Chonkie `Chunk.start_index/end_index` confirm
char-offsets are first-class returned metadata, not afterthoughts
(https://docs.llamaindex.ai/en/stable/api_reference/node_parsers/sentence_splitter/;
https://docs.chonkie.ai/oss/chunkers/recursive-chunker). Document-aware (clause/heading)
chunking moves recall more than swapping embedding models (~9% recall gap on the same corpus,
https://www.trychroma.com/research/evaluating-chunking), but a Jan-2026 analysis warns of a
~2500-token "context cliff" and that default overlap "adds no measurable benefit" — treat
chunk size (~2000 chars ≈ ~500 tokens) and overlap as metric-tuned knobs
(https://www.digitalapplied.com/blog/rag-chunking-strategies-2026-retrieval-quality-playbook).

### Bounded-concurrency ingest, dedup & BFS — raw: [research/bounded-concurrency-ingest-and-dedup.md](research/bounded-concurrency-ingest-and-dedup.md)

The lawyergpt Go semaphore pattern maps directly onto Effect `Stream.mapEffect(f,
{concurrency: n})` — a bounded `concurrency` runs up to n effects with built-in backpressure,
making a manual semaphore unnecessary, and **preserves source order by default** (only relaxed
with `unordered: true`) (https://effect.website/docs/stream/operations/). The repo-pinned
`effect@4.0.0-beta.91` `Stream.mapEffect` options surface is exactly
`{ concurrency?: number | "unbounded"; unordered?: boolean }` (verified against
`node_modules/effect/src/Stream.ts`); there is **no `bufferSize` option** on this operator in v4,
so the bounded-concurrency design here depends only on `concurrency` (with `unordered` left at its
order-preserving default). The captured
`numSemaphore = ceil(len(files)/2)` is an anti-pattern to *drop*, not port — it scales
concurrency with input size rather than the constrained resource (DB pool / embedding
throughput); the idiomatic replacement is a fixed `concurrency: n`, avoiding
`concurrency: "unbounded"` which spawns a fiber per element with no backpressure
(https://effect.website/docs/concurrency/basic-concurrency/). Per-chunk transactions use
`@effect/sql` `withTransaction` (BEGIN/COMMIT, auto-rollback on failure *or interruption*,
nested via SAVEPOINT on Postgres/PGlite) inside the `mapEffect` body so a poisoned chunk
interrupts only its own fiber (https://deepwiki.com/Effect-TS/effect/6-data-persistence). The
"202-then-process" shape: validate synchronously, return `202 Accepted` with `Location` +
`Retry-After`, status endpoint `303 See Other` on completion
(https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply);
Effect-side, fork off the request fiber with `Effect.forkDaemon` (the maintainers' own
fire-and-forget/202 recipe, https://github.com/Effect-TS/website/issues/263) or `forkScoped`
for graceful shutdown, handing accepted jobs onto a back-pressured `Queue`.

**Evidence-cluster dedup**: courtlistener's MinHash/LSH parenthetical clustering is
**AGPL-3.0**, but the library it wraps, **`datasketch`, is MIT**
(https://github.com/ekzhu/datasketch; https://pypi.org/project/datasketch/) — so the LSH/MinHash
*math* comes clean-room from MIT datasketch. **License hazard to avoid:** there is no independent
"courtlistener spec" — the only artifact describing CourtListener's clustering *policy*
(constants, tokenization sequence, representative selection, BFS clustering behavior) is the
AGPL implementation file `cl/citations/group_parentheticals.py` itself. A clean-room
re-implementation therefore CANNOT lift that policy from the AGPL caller. The policy must be
authored as an independently-written beep product spec (tuned from first principles for legal
evidence spans), or, if AGPL-observed behavior is genuinely required, produced via a real
two-person clean-room where the implementing engineer never reads the AGPL source. Do NOT copy
the AGPL file's parameter set, token pipeline, or selection rules into the build plan. MinHash signature: `num_perm` permutations `h_i(x)=((a_i·x+b_i) mod p) &
maxHash` with `p = 2^61-1`, `maxHash = 2^32-1` (the Carter–Wegman strongly-universal family,
https://en.wikipedia.org/wiki/Universal_hashing); LSH banding splits into `b` bands of `r`
rows, candidate prob `P(s) = 1 - (1 - s^r)^b` (the S-curve, Stanford CS345
http://infolab.stanford.edu/~ullman/mining/2006/lectureslides/cs345-lsh.pdf), with `(b,r)`
chosen by grid-search to a target threshold. **BigInt caveat**: `p = 2^61-1 > 2^53`, so a JS
port needs `BigInt` (or a 2^31-1 variant / Wasm) for the multiply-mod. courtlistener's
`num_perm=64`/`threshold=0.5` were tuned for short holding-summaries — re-derive for legal
evidence spans, don't hardcode. Dedup sits *before* the candidate→approved ClaimGate, not on a
retrieval-feeds-LLM path. **Citation-graph BFS** (depth-cap 2, per-level frontier ceiling
`slice(0,50)`, `{from,to}` edge list) is a standard bounded traversal re-expressible as
level-wise `Effect.forEach(frontier, …, {concurrency: n})`, but **must source edges from the
USPTO ODP / PatentSearch API (`api.uspto.gov`), never the sunset PatentsView legacy API**
(410 Gone since 2025-05-01, https://data.uspto.gov/support/transition-guide/patentsview).

## In-Repo Capability Inventory

beep already owns most of the substrate this layer composes over. All paths below were
verified via `ls`/`rg` on 2026-06-29; package names resolved from each `package.json`.

**Already-built, compose / reuse (do NOT rebuild):**

- **`@beep/provenance`** — `packages/foundation/modeling/provenance/src/TextAnchor.ts`. The
  canonical char-span value `{ startChar, endChar, quote }`, half-open `[start,end)`, with the
  documented invariant `text.slice(startChar,endChar) === quote` and `isWellOrdered`. The
  chunker's `charStart/charEnd` and the retrieval contract's per-candidate provenance reuse
  this verbatim.
- **`@beep/langextract`** — `packages/foundation/capability/langextract/src/Extraction/index.ts`
  (`GroundedExtraction` carrying `span?: Contract.Span`, `alignmentStatus`, `matchedText`) and
  `.../src/Alignment/index.ts` (UTF-16 `indexOf`→fuzzy aligner, code-point iteration). The
  chunker is a windowing layer *upstream* of this; a chunk-local `span` composes to a
  document-global `TextAnchor` via `{ chunk.charStart + span.start, … }` with zero new
  alignment code. NOTE: langextract V1 **defers streaming** (locked) — see Constraints.
- **`@beep/nlp`** — `packages/foundation/capability/nlp/src/Handoff/Contract.ts` defines
  `Span` (`{ start, end }` NonNegativeInt, half-open, `end ≥ start` check) plus
  `Provenance`/`TextChunk`/`Mention`. This is the `Contract.Span` langextract imports
  (`import { Contract } from "@beep/nlp/Handoff"`); the chunker emits and the retrieval
  channels return this shape, not bare text. (`@beep/nlp` also wraps the `wink` driver.)
- **`@beep/md`** — `packages/foundation/modeling/md/src/` (`Md.model.ts`/`Md.render.ts`/
  `Md.utils.ts`). Produces the single normalized markdown source string the chunker windows
  over; offsets are UTF-16 indices into this string.
- **`@beep/epistemic-domain`** — `packages/epistemic/domain/src/` (entities + values), with
  persisted siblings `@beep/epistemic-tables` (`packages/epistemic/tables/src/`),
  `@beep/epistemic-server`, `@beep/epistemic-use-cases`. The Claim/Evidence/gate spine the
  retrieval contract hands off into — outputs flow as `CandidateClaim` + `Evidence` spans
  through the ClaimGate, not raw chunks to an LLM.
- **`@beep/law-practice-domain`** — `packages/law-practice/domain/src/entities/` already has
  `Claim`, `OfficeAction`, `PatentAsset`, `PriorArtReference`, `Rejection`, `Matter`,
  `Distinction`, `LegalClient`, `LegalContact`. IP-law entities are extend-targets, not gaps.
- **`@beep/pglite`** — `packages/drivers/pglite/src/PgliteClient.service.ts`. The local-first
  Postgres-in-WASM authority store. **Runtime chain re-verified 2026-07-14:** the driver imports
  `@effect/sql-pglite/PgliteClient`; `@effect/sql-pglite@4.0.0-beta.97` depends on
  `@electric-sql/pglite ^0.5.4`, resolved to **0.5.4**. The installed package exports neither
  vector nor textsearch subpaths. Extension enablement and registration are NET-NEW P0 proof.
- **`@beep/drizzle`** — `packages/drivers/drizzle/src/` (`Drizzle.service.ts`,
  `EntityTable.models.ts`). The ORM layer; `.transaction(...)` is used at
  `packages/workspace/server/src/aggregates/Thread/ThreadStore.repo.ts:376`, and the PGlite
  integration is exercised at
  `packages/workspace/server/test/integration/ThreadStoreDrizzleRepository.pglite.test.ts`.
- **Bounded-concurrency + transaction primitives already in use** — `effect@4.0.0-beta.91`
  (v4 `Semaphore.make(n)` top-level module): `Semaphore.make` at
  `packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyServices.ts:914`; a
  hand-rolled `withTransaction` (BEGIN/COMMIT/ROLLBACK, nested) at
  `packages/drivers/duckdb/src/DuckDb.service.ts:256`; `Stream.mapEffect` at
  `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:145`. The ingestion
  pipeline re-expresses lawyergpt's semaphore over these — no new concurrency machinery.
- **`@beep/semantic-web`** (`packages/foundation/capability/semantic-web`) + **`@beep/rdf`**
  (`packages/foundation/modeling/rdf`) — the KG/graph-projection substrate the optional graph
  channel and citation-BFS land against.
- **File-ingestion plumbing** — `@beep/file-processing`
  (`packages/foundation/capability/file-processing`) + drivers `@beep/tika`, `@beep/libpff`.
  PDF/DOCX text extraction feeding `@beep/md` → chunker.
- **`@beep/uspto`** driver — `packages/drivers/uspto/src/`, targets ODP
  `https://api.uspto.gov` (verified `Uspto.config.ts:26`). Sources citation-BFS edges. Gov
  data driver skeletons exist for `courtlistener`, `ecfr`, `dol`, `federal-register`,
  `govinfo` (`packages/drivers/*`).

**Genuine gaps (this packet builds them):**

- **pgvector / HNSW vector projection schema** — **NOT FOUND**. No `vector_cosine_ops`,
  `hnsw`, `halfvec`, `vector(...)` column, or `cosineDistance` usage in any `packages/**`
  source (the only `pgvector` hit is a Docker image-tag resolver,
  `.../VersionSync/internal/resolvers/DockerResolver.ts`). The PGlite service does not wire
  the `vector` extension. NET-NEW: register pgvector in PGlite, define the Drizzle
  `vector(768)` projection schema + HNSW index + thresholded top-k.
- **Hybrid 3-channel RRF fusion service** — **NOT FOUND**. No `reciprocal rank`/`rrf`/
  `hybrid search` in any `packages/**` source (hits are all in `docs/`, `standards/`, and
  `goals/repo-codegraph-jsdoc` research prose, never executable). NET-NEW, and this packet is
  the designated single owner (k=60, literal-floor, empty-channel renorm).
- **Local text-embedding pipeline** — **NOT FOUND**. No `feature-extraction`/transformers.js/
  text-embedding pipeline in `packages/**`; the only ONNX usage is `@beep/face-detection`
  (image, not text). NET-NEW: runtime-neutral encoder port, provisional
  `nomic-embed-text-v1.5` adapter, model identity, and asymmetric-prefix strategy.
- **Offset-preserving char-span chunker** — **NOT FOUND** as a standalone capability (the
  windowing layer between `@beep/md` and `@beep/langextract`). The *aligner* exists; the
  *sectionizer/slicer that emits `{chunkText, charStart, charEnd, breadcrumb}`* does not.
  NET-NEW.
- **AGPL-clean MinHash/LSH evidence-cluster dedup** — **NOT FOUND**. NET-NEW; use only MIT
  `datasketch` math plus an independently authored beep policy and representative corpus.
- **Generated-`tsvector` lexical/FTS channel** — **NOT FOUND** in `packages/**` (no `tsvector`
  column). NET-NEW (generated STORED column + GIN). Note this is a *lexical FTS* path ranked by
  `ts_rank_cd` (cover-density), **not** BM25; true BM25 requires the external `pg_textsearch`
  extension if the PGlite build ships it.

## Constraints

### Deprecations (dated)

- **Gemini embedding shutdowns** (https://ai.google.dev/gemini-api/docs/deprecations.md.txt):
  `embedding-001`, `embedding-gecko-001`, `gemini-embedding-exp-03-07` → **2025-10-30**;
  `text-embedding-004` → **2026-01-14**; `gemini-embedding-001` → **2026-07-14** (~2 weeks
  out). Nominal replacement `gemini-embedding-2` (3072-dim) is **Public Preview on `v1beta`, not
  GA** (https://blog.google/technology/developers/gemini-embedding-2/). Spaces are mutually incompatible → every
  forced swap costs a full corpus re-embed. **Do NOT pin Gemini**; keep the column dimension
  locally owned.
- **USPTO PatentsView legacy API** — discontinued, `410 Gone` since **2025-05-01** (announced
  Oct 2024) (https://data.uspto.gov/support/transition-guide/patentsview). Citation-BFS edges
  must come from the ODP/PatentSearch API (`api.uspto.gov`); the `@beep/uspto` driver already
  targets ODP and must **NEVER** use PatentsView.
- **pgvector 0.8.0** features (`hnsw.iterative_scan`, improved filter cost) require ≥0.8.0; no
  vector subpath exists in the installed `@electric-sql/pglite@0.5.4`, so both the extension
  artifact/version and enablement mechanism are UNVERIFIED. Prove them before depending on
  `iterative_scan`.
  drizzle-orm must include **PR #3824** (2024-12-22) for vector columns under PGlite.

### Licensing gravity (reimplement, don't copy)

- **AGPL-3.0 → take the math from MIT, author the policy independently**: courtlistener
  (`cl/citations/group_parentheticals.py`, MinHash/LSH dedup) is AGPL. The wrapped algorithm
  library **`datasketch` is MIT**, so the LSH/MinHash math is clean-room from datasketch.
  **There is no separate non-AGPL "courtlistener spec"** — that file *is* the only policy
  description, so its constants, tokenization, and representative-selection rules must NOT be
  reproduced from the AGPL source. Author the clustering policy as an independent beep product
  spec (or run a two-person clean-room). Never copy AGPL source.
- **UNKNOWN license → reimplement, do not copy source**: **lawyergpt** (the
  schema/bounded-concurrency/threshold patterns). **agentmemory is Apache-2.0** per the
  authoritative `research/SOURCES.md` ledger and may be ported with attribution. The RRF
  *formula* is a published method (SIGIR 2009, no copyright on the formula).
- **MIT → safe to study/adapt**: **doc-haus** (3-channel + literal-floor + char-span design),
  **LangChain `EnsembleRetriever`** (weighted-RRF reference), **InLegalBERT** weights (wiring
  reference only, wrong jurisdiction). **Apache-2.0**: Google **langextract** `chunking.py`
  (port-safe), nomic-embed-text-v1.5.
- **EmbeddingGemma license is NOT Apache** despite one conflicting summary — the Gemma family
  ships under the **Gemma Terms of Use** (gated acceptance on HF; commercial-use-permitted but
  carries Google's prohibited-use policy,
  https://ai.google.dev/gemma/docs/embeddinggemma/model_card). Confirm before adopting as
  default; fully-permissive fallbacks if purity is mandatory: `bge-base-en-v1.5` (MIT),
  `gte-base`, `nomic-embed-text-v1.5` (Apache) — all 768-dim ONNX.
- **`bge-reranker-v2-m3` open-weights license UNVERIFIED** — confirm before bundling. **Cohere
  Rerank is a commercial cloud API** — not privilege-safe (opt-in for non-privileged work only).

### Locked decisions (carry into align/shape)

- **This packet is the single owner** of hybrid three-channel weighted-RRF policy (k=60).
  `goals/epistemic-bitemporal-edge-core` defers RRF here; candidate engines and sibling packets
  emit/consume ranked-channel contracts and do not rebuild fusion.
- **Vectors are a rebuildable projection, not authority** — the authoritative row is the
  text + char-span offsets in PGlite; the `vector` column + HNSW index are derived and
  reconstructable. Migration = re-embed-from-source + rebuild-index, never rolling-update.
- **k=60** kept (deliberately uncritical default; do not spend appetite tuning it).
- **RRF (rank fusion) is the default**; alpha/Relative-Score fusion is an opt-in alternate mode
  only where score magnitude must be preserved.
- **Literal-match floor is a hard guarantee** (dedicated literal-phrase channel + tie-break,
  not weight alone) — beep's own invariant; off-the-shelf RRF does not provide it.
- **Empty-channel weight renormalization** (sum surviving weights to 1) — beep-owned cold-start
  policy, externally unspecified; ratify in DECISIONS.
- **`vector(768)` + `vector_cosine_ops` HNSW** is the default column shape; the column op and
  the query helper (`cosineDistance` = `<=>`) MUST agree (mismatch = silent seq scan).
- **UTF-16 code-unit offsets** are the single declared chunker unit (matching `TextAnchor`);
  re-derive offsets by search, never arithmetic accumulation; never split a surrogate pair.
- **Bounded `Stream.mapEffect(concurrency: n)`** sized to the constrained resource — drop
  lawyergpt's `ceil(len/2)` input-scaled semaphore.
- **langextract V1 defers streaming** (locked) — the chunker is a non-streaming windowing layer;
  anything Partial/streaming is a conflicting net-new, not a langextract dup.

### Auth / secret / offline boundaries

- **Local-first, provider-neutral, offline-capable**: the embedding encoder runs in-process
  (ONNX/transformers.js WASM or a Rust `ort` sidecar) with no API round-trip and no secret. No
  embedding provider key is pinned.
- **WebGPU is NOT available in WebKitGTK** (Linux Tauri webview). The renderer never owns
  durable projection work. Benchmark runtime-neutral server/sidecar adapters on the target
  Linux packaging path; prefer Rust `ort` if a WASM adapter misses the ratified budget.
- **Privilege-safety wall**: retrieval outputs flow as `CandidateClaim` + `Evidence` spans
  through the **ClaimGate**, NEVER raw chunks to an LLM (lawyergpt's un-gated tool-calling RAG
  is the explicit anti-pattern). Cross-encoder rerank defaults to a local `bge-reranker`-class
  model; cloud Cohere Rerank is opt-in for non-privileged work only.

### Routing cautions

- **Chunker ownership (single home):** this packet owns the offset-preserving char-span chunker
  *implementation* — the NET-NEW windowing/sectionizer between `@beep/md` and `@beep/langextract`
  listed under Genuine gaps and named in the README spark. `goals/langextract-capability` does
  **not** own a standalone windowing chunker: its SPEC non-goals decline to duplicate standalone
  `chunk`/`window` primitives (`goals/langextract-capability/SPEC.md:21`), and its scope is
  LLM extraction + deterministic alignment over already-windowed text, with V1 public offsets as
  JS string indices (`SPEC.md:87`). Only the chunker's *offset contract* (UTF-16 code-unit
  offsets; chunk-local `Contract.Span` composing to a document-global `TextAnchor`) is shared, so
  the two stay coupled without either goal re-implementing the source-offset windowing code.
  (Earlier drafts pointed the chunker at `goals/langextract-capability` P4 as its build home; that
  was a false ownership boundary — corrected here.)
- **Dedup sits before the ClaimGate**, ranking the most-described idea higher — a pre-gate
  ranking step, not a retrieval→LLM path.
- **PGlite HNSW build memory** (`maintenance_work_mem`, tight in WASM) is the main local scaling
  risk — keep corpora per-matter and rebuild the projection rather than maintaining one giant
  index; needs a local 10k–100k-chunk spike (UNVERIFIED, no published PGlite benchmark).
- **`pg_textsearch` (BM25) load/stability inside the shipped PGlite WASM build is UNVERIFIED** —
  keep generated-`tsvector` + GIN as the safe lexical/FTS-channel fallback. **`ts_rank_cd` is
  cover-density ranking, NOT BM25** — downstream tests must not assert BM25 semantics against the
  fallback; reserve true BM25 for `pg_textsearch`.
- IP-law entities are **extend-targets** on `@beep/law-practice-domain`, never net-new; the
  source-authority legal-domain taxonomy (court/agency/reporter domains) should reuse court-vocab
  datasets from `goals/official-data-sync-foundation`, not be re-authored here.

---

_Codex gate-1 folded 2026-06-29: 3 blocking + 3 advisory addressed._
