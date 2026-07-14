# RAG Retrieval Projection Layer — Sources & Provenance

One-line: the provenance ledger joining this packet's design back to its mined gold
nuggets, their upstream repos + licenses, the external research citations on disk, and the
in-repo bricks it composes. Derived from the gold-intake cluster **"RAG ingestion +
char-span chunking"** (14 verified nuggets, route `mixed`, wave P3).

- **Cluster:** RAG ingestion + char-span chunking (14 nuggets, 3 P1 / 5 P2 / 6 P3)
- **Route:** `mixed` · primaryTarget `rag-retrieval-projection` (this packet)
- **Gold-intake provenance:**
  [`ROUTING.md`](../../_gold-intake/ROUTING.md) (cluster row + RRF single-owner rule),
  [`routing.json`](../../_gold-intake/routing.json),
  [`GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) (§9 triple-stream RRF fusion;
  nugget detail at the `agentmemory#1` / `doc-haus#1` / `uspto-patents-mcp#2` entries).
- **Packet codex review:** [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md)
  (research-gate: 3 blocking + 3 advisory folded; "Confirmed sound" backs §1/§3/§4 below).

---

## 1. Mined source corpus (gold nuggets)

All 14 cluster nuggets. `file:line` is the upstream source location as recorded in the
catalog (repos identified by name + license only — the catalog carries no repo URLs, so none
are invented here).

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `agentmemory#1` | Triple-stream hybrid retrieval (BM25 + vector + graph) fused via RRF | agentmemory | `src/state/hybrid-search.ts:194-219` | kg-ontology-reasoning | P1 | **port with attribution** (Apache-2.0; RRF formula is published) |
| `doc-haus#1` | Hybrid retrieval w/ RRF fusion + char-span citations + auto-attached defs/cross-refs | doc-haus | `dochaus/tool/search-document.ts:42-121` | provenance-evidence | P1 | **study** (MIT, adapt 3-channel + literal-floor design) |
| `uspto-patents-mcp#2` | Bounded BFS over the patent citation graph (forward/backward/both) | uspto-patents-mcp | `src/patentsview.ts:89-149` | kg-ontology-reasoning | P1 | **port** (MIT; re-source edges from `api.uspto.gov`, never PatentsView) |
| `agentmemory#12` | Scale-driven graph index design (name-index / edge-key / node-degree side indexes) | agentmemory | `src/state/schema.ts:24-39` | kg-ontology-reasoning | P2 | **study** (Apache-2.0; blueprint for local-scale projection) |
| `courtlistener#10` | MinHash/LSH clustering of near-duplicate holding summaries (parentheticals) | courtlistener | `cl/citations/group_parentheticals.py:39-59` | legal-nlp | P2 | **port → clean-room** (AGPL-3.0; take MIT `datasketch` math, author policy independently) |
| `doc-haus#11` | Clause-aware sectionizer + char-offset chunker w/ breadcrumb-prefixed embeddings | doc-haus | `services/ingest/src/ingest.ts:20-49` | data-ingestion | P2 | **port** (MIT; the NET-NEW chunker recipe) |
| `doc-haus#6` | Per-matter local index schema: char-span chunks + structure tables + FTS5 + redline queue | doc-haus | `services/ingest/src/db.ts:27-161` | data-ingestion | P2 | **study** (MIT; maps to PGlite authority + FalkorDB projection split) |
| `lawyergpt#2` | Bounded-concurrency async ingestion (semaphore + per-file txn) | lawyergpt | `api/main.go:176-298` | effect-ts | P2 | **study → reimplement** (unknown license; drop `ceil(n/2)` anti-pattern) |
| `Juris.AI#4` | In-browser legal embeddings via InLegalBERT (transformers.js, local-first) | Juris.AI | `src/app/legal-bert/model.ts:12-39` | legal-nlp | P3 | **study** (MIT; pipeline wiring only — wrong jurisdiction, scoring is a stub) |
| `LegalEase#5` | Hybrid BM25 + dense-vector retrieval w/ weighted score fusion | LegalEase | `backend/services/hybrid_search.py:44-58` | data-ingestion | P3 | **study** (MIT; the alpha-fusion RRF *rejects* — Relative-Score alternate only) |
| `lawyergpt#3` | pgvector HNSW cosine schema + thresholded top-k retrieval (Drizzle) | lawyergpt | `frontend/src/lib/db/schema/embeddings.ts:5-20` | data-ingestion | P3 | **study → reimplement** (unknown license; near drop-in projection reference) |
| `lawyergpt#4` | Vercel AI SDK tool-calling RAG route (the un-gated pattern beep rejects) | lawyergpt | `frontend/src/app/api/chat/[id]/route.ts:50-58` | mcp-design | P3 | **reference** (NEGATIVE; outputs must carry CandidateClaim+Evidence, not raw chunks) |
| `lawyergpt#6` | Rune-aware fixed-size text chunker | lawyergpt | `api/pkg/main.go:21-35` | provenance-evidence | P3 | **skip** (superseded by offset-preserving chunker; no char-span tracking) |
| `research-squad#9` | Source-authority inference from URL (primary-source taxonomy) | research-squad | `src/services/MultiAgentOrchestratorService.ts:962-981` | data-ingestion | P3 | **adopt** (MIT; citation-authority ranking taxonomy, extend with legal domains) |

### How these inform this packet

**Hybrid RRF fusion — the retrieval core (this packet's single-owner mandate).**
`agentmemory#1` is the load-bearing port: the renormalized weights when a channel is empty —
`if (totalW > 0) { effectiveBm25W /= totalW; … }` over
`combinedScore = Σ effectiveW · 1/(RRF_K + rank)` — is the cold-start policy beep adopts (RES
§External Landscape calls this an externally-unspecified beep-owned policy, not a borrowed
standard). `doc-haus#1` contributes the *shape*: three channels over the same chunks, each hit
returning `doc/section/charStart/charEnd`, plus the "literal hit must not be outscored by fuzzy
hits" insight that becomes beep's hard literal-match floor. `LegalEase#5`'s
`alpha*bm25 + (1-alpha)*dense` is the **anti-pattern to leave** — score fusion normalizes two
incompatible distributions (BM25 unbounded, cosine [0,1]); rank-based RRF is the default, alpha
fusion an opt-in alternate only where score magnitude must be preserved.

**Projection schema (pgvector / HNSW).** `lawyergpt#3` is a near drop-in reference for the
Drizzle `vector(…, vector_cosine_ops)` HNSW column + `1 - cosineDistance` thresholded top-k —
**take the schema pattern, reimplement** (unknown license) and pin `vector(768)` not lawyergpt's
768-via-Gemini (Gemini is on a deprecation clock; see §2 cautions). Vectors stay a rebuildable
projection, never authority.

**Char-span chunking (NET-NEW windowing layer).** `doc-haus#11` is the concrete recipe:
`sectionize()` accumulating exact char offsets + `chunkSection()` slicing ~2000-char chunks
preserving `charStart/charEnd`, and the `embed.ts` breadcrumb (`docName › section`) prepended to
the chunk body. `doc-haus#6`'s per-matter SQLite schema (char-span chunks + structure tables +
FTS5 + meta model-version guard) maps onto the PGlite-authority / FalkorDB-projection split —
study the layout, not the SQLite specifics. `lawyergpt#6`'s rune-aware chunker is **skipped**:
correct on multibyte boundaries but tracks no char offsets, so it cannot carry provenance.

**Bounded-concurrency ingestion.** `lawyergpt#2`'s semaphore + per-file transaction is
**reimplemented** as Effect `Stream.mapEffect(f, {concurrency: n})` + `@effect/sql`
`withTransaction` per chunk; the captured `numSemaphore = ceil(len(files)/2)` is explicitly
dropped (scales concurrency to input size, not the constrained resource).

**Graph projection + citation BFS.** `uspto-patents-mcp#2`'s depth-capped BFS with per-level
frontier ceiling (`slice(0,50)`) and `{from,to}` edge list ports to level-wise
`Effect.forEach(frontier, …, {concurrency: n})`, edges sourced from `api.uspto.gov` (PatentsView
is `410 Gone`). `agentmemory#12`'s name-index / edge-key / node-degree side indexes are the
study-blueprint for keeping the FalkorDB/PGlite projection scan-free locally.

**Pre-gate dedup + authority ranking.** `courtlistener#10`'s MinHash/LSH near-dup clustering is
**clean-room only** (AGPL — see §2). Take the LSH/MinHash math from MIT `datasketch`; author the
clustering *policy* (constants, tokenization, representative selection) as an independent beep
spec — the AGPL file is the only "courtlistener spec," so it must not be lifted. Dedup sits
*before* the ClaimGate. `research-squad#9`'s `.gov/.edu/arxiv` primary-source taxonomy is
**adopted** as an orthogonal multiplicative authority weight (extend with court/agency/reporter
domains, reusing `goals/official-data-sync-foundation` vocab, not re-authored).

**Negative reference.** `lawyergpt#4`'s `getInformation` tool returning raw chunks straight to
`streamText` is the **un-gated RAG beep forbids** — kept only as a Zod tool-definition shape to
re-implement under `@effect-rpc` with provenance-carrying outputs.

`Juris.AI#4` (InLegalBERT transformers.js pipeline) is a **wiring reference only**: the
feature-extraction `pooling:"mean", normalize:true` call is the gold; the model is wrong
jurisdiction (Indian case law) and its relevance scorer is a `Math.random` stub.

> **Cluster owns the RRF layer outright** (no split). Per ROUTING.md's RRF single-owner rule,
> `goals/epistemic-bitemporal-edge-core` explicitly defers RRF to this packet. Candidate engines
> and sibling packets consume ranked-channel/fusion contracts — they do not rebuild policy.

---

## 2. Upstream repositories & licenses

One row per `reposUsed` entry. "Port discipline" derives from the license: copyleft/unknown →
clean-room reimplement (pattern, not code); permissive (MIT/Apache-2.0) → port-with-attribution.

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| agentmemory | T1 | Apache-2.0 | port-with-attribution (RRF formula itself is uncopyrightable published method) | RRF empty-channel renormalization (`#1`); name-index/edge-key/node-degree graph side indexes (`#12`) |
| doc-haus | T1 | MIT | port-with-attribution | 3-channel RRF + literal-floor + char-span citation design (`#1`); clause sectionizer + breadcrumb chunker (`#11`); per-matter index schema (`#6`) |
| uspto-patents-mcp | T2 | MIT | port-with-attribution (re-source edges from `api.uspto.gov`; upstream PatentSearch paused/sunset) | depth-capped citation-graph BFS + `{from,to}` edge list (`#2`) |
| courtlistener | T1 | AGPL-3.0-only | **CLEAN-ROOM REIMPLEMENT ONLY** — do not copy source; take MinHash/LSH math from MIT `datasketch`, author clustering policy independently | dedup/cluster *intent* (`#10`) — never the AGPL file's constants/tokenization/selection rules |
| lawyergpt | T2 | **unknown** | **REIMPLEMENT, do not copy source** — pattern-reference only | bounded-concurrency ingest (`#2`), pgvector HNSW schema (`#3`), fixed-size chunker (`#6` skipped), un-gated RAG (`#4` negative) |
| Juris.AI | T2 | MIT | port-with-attribution (wiring only) | transformers.js feature-extraction embedding pipeline wiring (`#4`) |
| LegalEase | T2 | MIT | port-with-attribution | hybrid BM25+dense alpha fusion (`#5`) — kept as the *rejected* Relative-Score alternate |
| research-squad | T1 | MIT | port-with-attribution | URL primary-source / authority taxonomy (`#9`) |
| pgvector | extension | **NEEDS-LICENSE-RECORD** | **NO ADOPTION** until exact artifact/version license is recorded | Candidate `vector(768)`/HNSW projection extension; PGlite 0.5.4 enablement also requires P0 proof. |
| pg_textsearch | extension | **NEEDS-LICENSE-RECORD** | **NO ADOPTION** until exact artifact/version license is recorded | Optional true-BM25 lexical upgrade behind the ranked-channel interface; not the default lexical FTS path. |

> **Cautions (echoed verbatim from the bundle — load-bearing):**
> - **lawyergpt license is UNKNOWN** → reimplement patterns, do not copy source. lawyergpt pins
>   Gemini embeddings: `embedding-001`/`embedding-gecko-001`/`gemini-embedding-exp-03-07` shut
>   down Oct 2025, `text-embedding-004` shut down 2026-01-14; current GA `gemini-embedding-001`
>   (3072-dim default, Matryoshka-truncatable) means any pgvector column dimension + HNSW index
>   must match the chosen `output_dimensionality`. beep is provider-neutral/local-first
>   (PGlite+Drizzle, local ONNX embeddings) → do NOT pin Gemini and keep vectors as projection,
>   not authority. doc-haus is MIT (safe to study/adapt). lawyergpt's un-gated tool-calling RAG
>   (raw chunks to LLM, "use your own knowledge") is an explicit ANTI-PATTERN beep rejects —
>   outputs must carry CandidateClaim+Evidence provenance spans through the ClaimGate, not bare
>   chunks.
> - **`courtlistener#10` (MinHash/LSH near-dup clustering, rec=port) is AGPL-3.0** → do not use
>   its constants, tokenization, representative-selection, or clustering policy. Author a
>   clean-room product spec and representative corpus independently; use only clean math sources.
> - **RRF retrieval fusion:** this packet is the DESIGNATED single owner of hybrid three-channel
>   weighted-RRF policy; `goals/epistemic-bitemporal-edge-core` defers RRF here and consumes the
>   resulting contract rather than rebuilding it.

---

## 3. External research sources

Citations actually present in this packet's `RESEARCH.md` / `research/*.md` (titles + URLs as
they appear on disk). Grouped by the research thread that carries them.

**RRF fusion contract** (RES §External Landscape; raw
[`rrf-fusion-and-retrieval-contract.md`](rrf-fusion-and-retrieval-contract.md)):
- Cormack, Clarke & Büttcher, *"Reciprocal Rank Fusion outperforms Condorcet…"*, SIGIR 2009 — https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf
- Azure AI Search hybrid ranking (k≈60 default) — https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking
- OpenSearch RRF (rank constant 60) — https://opensearch.org/blog/introducing-reciprocal-rank-fusion-hybrid-search/
- Elasticsearch RRF (`rank_constant` default 60) — https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion
- Weighted RRF GA — https://www.elastic.co/search-labs/blog/weighted-reciprocal-rank-fusion-rrf
- LangChain `EnsembleRetriever` (`c: int = 60`, MIT) — https://sj-langchain.readthedocs.io/en/latest/_modules/langchain/retrievers/ensemble.html
- High vs low k behavior — https://bigdataboutique.com/blog/reciprocal-rank-fusion-how-it-works-and-when-to-use-it
- RRF vs weighted/score fusion — https://www.maxpetrusenko.com/blog/rrf-vs-weighted-fusion-for-hybrid-ranking · https://avchauzov.github.io/blog/2025/hybrid-retrieval-rrf-rank-fusion/ · https://medium.com/mongodb/reciprocal-rank-fusion-and-relative-score-fusion-classic-hybrid-search-techniques-3bf91008b81d
- Literal-floor "RRF is not enough" — https://softwaredoug.com/blog/2025/03/13/elasticsearch-hybrid-search-strategies · https://secondary.ai/blog/hybrid-keyword-search
- Source-authority / reranker / MMR — https://backlinko.com/google-trustrank · https://arxiv.org/html/2603.25092v1 · https://www.pinecone.io/learn/series/rag/rerankers/ · https://docs.opensearch.org/latest/vector-search/specialized-operations/vector-search-mmr/

**pgvector HNSW projection** (raw
[`pgvector-hnsw-projection-under-pglite.md`](pgvector-hnsw-projection-under-pglite.md)):
- pgvector README (HNSW params, dim caps, `<=>`) — https://github.com/pgvector/pgvector/blob/master/README.md · dim-cap issue https://github.com/pgvector/pgvector/issues/461
- `ef_search` ≥ LIMIT / iterative_scan — https://neon.com/docs/ai/ai-vector-search-optimization · https://www.postgresql.org/about/news/pgvector-080-released-2952/
- Opclass/operator mismatch → seq scan — https://www.paradedb.com/learn/postgresql/tuning-pgvector
- PGlite (Postgres-in-WASM, PG17) — https://pglite.dev/docs/about · extensions https://pglite.dev/extensions/
- Drizzle vector similarity — https://orm.drizzle.team/docs/guides/vector-similarity-search · ordering issue https://github.com/drizzle-team/drizzle-orm-docs/issues/436 · PGlite `$libdir/vector` fix PR https://github.com/drizzle-team/drizzle-orm/pull/3824
- SQLite FTS5 vs Postgres generated `tsvector` + GIN — https://www.sqlite.org/fts5.html · https://www.postgresql.org/docs/current/textsearch-tables.html · `pg_textsearch` BM25 https://www.tigerdata.com/blog/introducing-pg_textsearch-true-bm25-ranking-hybrid-retrieval-postgres
- HNSW build memory — https://www.crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector
- Embedding-model versioning / re-embed migration — https://zilliz.com/ai-faq/how-do-i-handle-versioning-of-embedding-models-in-production · https://callsphere.ai/blog/migrating-vector-databases-pinecone-pgvector-weaviate-embeddings

**Local-first embedding models** (raw
[`local-first-embedding-models.md`](local-first-embedding-models.md)):
- Gemini deprecations table — https://ai.google.dev/gemini-api/docs/deprecations.md.txt
- `gemini-embedding-2` Public Preview — https://blog.google/technology/developers/gemini-embedding-2/ · https://ai.google.dev/gemini-api/docs/embeddings · https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2/
- EmbeddingGemma-300m — https://huggingface.co/blog/embeddinggemma · https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX · Gemma Terms model card https://ai.google.dev/gemma/docs/embeddinggemma/model_card
- Sentence-BERT (raw BERT is a poor retriever) — https://arxiv.org/abs/1908.10084 · InLegalBERT https://huggingface.co/law-ai/InLegalBERT
- WebGPU absent in WebKitGTK — https://www.mail-archive.com/webkit-gtk@lists.webkit.org/msg03883.html

**Offset-preserving char-span chunking** (raw
[`offset-preserving-char-span-chunking.md`](offset-preserving-char-span-chunking.md)):
- JS String UTF-16 length/slice — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length
- Google langextract `chunking.py` (Apache-2.0) — https://github.com/google/langextract/blob/main/langextract/chunking.py · https://deepwiki.com/google/langextract
- LangChain `add_start_index` (re-find by search) — https://raw.githubusercontent.com/langchain-ai/langchain/master/libs/text-splitters/langchain_text_splitters/base.py · bugs https://github.com/langchain-ai/langchain/issues/18972 · https://github.com/langchain-ai/langchain/issues/17642
- Surrogate-pair split bug — https://george.mand.is/2026/05/my-favorite-bugs-invalid-surrogate-pairs/
- LSP 3.17 `positionEncoding` precedent — https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/
- LlamaIndex / Chonkie char-offset metadata — https://docs.llamaindex.ai/en/stable/api_reference/node_parsers/sentence_splitter/ · https://docs.chonkie.ai/oss/chunkers/recursive-chunker
- Chunking-quality evidence — https://www.trychroma.com/research/evaluating-chunking · https://www.digitalapplied.com/blog/rag-chunking-strategies-2026-retrieval-quality-playbook

**Bounded-concurrency ingest, dedup & BFS** (raw
[`bounded-concurrency-ingest-and-dedup.md`](bounded-concurrency-ingest-and-dedup.md)):
- Effect `Stream.mapEffect` concurrency — https://effect.website/docs/stream/operations/ · basic concurrency https://effect.website/docs/concurrency/basic-concurrency/
- `@effect/sql` transactions — https://deepwiki.com/Effect-TS/effect/6-data-persistence
- 202-then-process async request-reply — https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply · `forkDaemon` recipe https://github.com/Effect-TS/website/issues/263
- `datasketch` (MIT, MinHash/LSH math) — https://github.com/ekzhu/datasketch · https://pypi.org/project/datasketch/
- Universal hashing / LSH banding — https://en.wikipedia.org/wiki/Universal_hashing · http://infolab.stanford.edu/~ullman/mining/2006/lectureslides/cs345-lsh.pdf
- USPTO PatentsView legacy `410 Gone` — https://data.uspto.gov/support/transition-guide/patentsview

---

## 4. In-repo capability references

`@beep/*` bricks this packet composes (from `secondaryTargets` + the RES In-Repo Inventory).
Marked reuse / extend / NET-NEW. Paths verified in RES on 2026-06-29.

**Reuse (compose, do NOT rebuild):**
- `@beep/provenance` — `packages/foundation/modeling/provenance/src/TextAnchor.ts`. Canonical
  char-span `{ startChar, endChar, quote }`, invariant `text.slice(startChar,endChar)===quote`.
- `@beep/langextract` — `packages/foundation/capability/langextract/src/`
  (`Extraction/index.ts` `GroundedExtraction.span`, `Alignment/index.ts` UTF-16 aligner). Chunker
  is the windowing layer *upstream* of this. (secondaryTarget)
- `@beep/nlp` — `packages/foundation/capability/nlp/src/Handoff/Contract.ts` (`Span`,
  `Provenance`, `TextChunk`, `Mention`); the `Contract.Span` langextract imports.
- `@beep/md` — `packages/foundation/modeling/md/src/`. Normalized markdown source string the
  chunker windows over.
- `@beep/epistemic-domain` (+ `-tables`/`-server`/`-use-cases`) — `packages/epistemic/`. The
  Claim/Evidence/ClaimGate spine retrieval hands off into (CandidateClaim+Evidence, not raw chunks).
- `@beep/law-practice-domain` — `packages/law-practice/domain/src/entities/`
  (`Claim`, `PriorArtReference`, `PatentAsset`, `OfficeAction`, …). IP entities are **extend**-targets.
- `@beep/pglite` — `packages/drivers/pglite/src/PgliteClient.service.ts`. Local-first authority
  store. **2026-07-14 correction:** the live runtime resolves through
  `@effect/sql-pglite@4.0.0-beta.97` to `@electric-sql/pglite@0.5.4`; the installed package has
  no vector or textsearch subpath exports. Both extension paths are unproven and require P0
  enablement proof rather than simple registration.
- `@beep/drizzle` — `packages/drivers/drizzle/src/`. ORM + `.transaction(...)`.
- `@beep/semantic-web` (`packages/foundation/capability/semantic-web`) + `@beep/rdf`
  (`packages/foundation/modeling/rdf`). KG/graph-projection substrate for the optional graph
  channel + citation-BFS. (secondaryTarget; final GraphRAG retrieval-service home)
- `@beep/file-processing` (`packages/foundation/capability/file-processing`) + `@beep/tika`,
  `@beep/libpff`. PDF/DOCX extraction feeding `@beep/md` → chunker.
- `@beep/uspto` — `packages/drivers/uspto/src/` (targets `https://api.uspto.gov`). Citation-BFS edges.
- Concurrency/txn primitives already in use — `effect@4.0.0-beta.91` `Semaphore.make`,
  `Stream.mapEffect`, Drizzle/DuckDB transaction precedents.

**NET-NEW (this packet builds):**
- **pgvector / HNSW `vector(768)` projection schema** + thresholded top-k — NOT FOUND in
  `packages/**`; register the `vector` extension in PGlite, define the Drizzle column + HNSW index.
- **Hybrid 3-channel RRF fusion service** (k=60, literal-floor, empty-channel renorm) — NOT FOUND;
  this packet is the designated single owner.
- **Local text-embedding pipeline** (runtime-neutral port; provisional
  `nomic-embed-text-v1.5`, with final model selected by bake-off) — NOT FOUND (only ONNX usage
  is image `@beep/face-detection`).
- **Offset-preserving char-span chunker** (windowing/sectionizer between `@beep/md` and
  `@beep/langextract`) — NOT FOUND; the aligner exists, the slicer does not.
- **AGPL-clean MinHash/LSH evidence-cluster dedup** — NET-NEW, clean-room from MIT `datasketch`.
- **Generated-`tsvector` lexical/FTS channel** (GIN, `ts_rank_cd` — *not* BM25) — NET-NEW.

---

## 5. Cross-links & provenance

- **Cluster id:** RAG ingestion + char-span chunking (`routing.json` →
  `rag-retrieval-projection`, route `mixed`, wave P3, 14 nuggets).
- **Sibling / consumer links** (bundle `crossref` is empty; these are the routing-level couplings):
  - `goals/epistemic-bitemporal-edge-core` — defers RRF to this packet as sole owner and
    consumes the fusion contract without rebuilding policy.
  - `goals/langextract-capability` (secondaryTarget) — shares only the chunker's *offset contract*
    (UTF-16 code-unit offsets; chunk-local `Contract.Span` → document-global `TextAnchor`); its SPEC
    non-goals decline a standalone windowing chunker (`SPEC.md:21`). This packet owns the chunker
    implementation. (Codex blocking #3 resolved — see review.)
  - `goals/ip-law-knowledge-graph` (secondaryTarget) — IP entities are **extend**-targets on
    `@beep/law-practice-domain`, not net-new here.
- **Packet artifacts:** [`../RESEARCH.md`](../RESEARCH.md) (synthesis + In-Repo Inventory +
  Constraints), [`../DECISIONS.md`](../DECISIONS.md) (pre-drafted Q1–Q7 + recommended answers),
  [`../CAPTURE.md`](../CAPTURE.md), [`../README.md`](../README.md), [`../MAP.md`](../MAP.md),
  [`../BRIEF.md`](../BRIEF.md).
- **Codex review:** [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md)
  (3 blocking folded: PGlite runtime version mis-grounding, AGPL clean-room hazard, chunker
  ownership; 3 advisory: `tsvector`≠BM25, `Stream.mapEffect` options, Gemini-2 preview wording).
- **Gold synthesis:** [`../../_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md)
  §9 (triple-stream RRF fusion + citation-graph BFS) and the per-nugget entries for `agentmemory#1`,
  `doc-haus#1`/`#6`/`#11`, `uspto-patents-mcp#2`, `courtlistener#10`, `lawyergpt#2`–`#6`.
