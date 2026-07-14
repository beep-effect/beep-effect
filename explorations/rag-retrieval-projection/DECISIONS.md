# RAG Retrieval Projection Layer — Decisions

The align gate closed on 2026-07-14. All eight decisions below are locked.
Deferred items are implementation gates, not unresolved exploration questions.

## 2026-07-14 — LOCKED — RRF ownership

**Question:** Who owns final hybrid ranking?

**Answer:** beep owns weighted RRF fusion in-repo. Migrate the prior-generation
`../beep-effect4/packages/knowledge/server/src/GraphRAG/RrfScorer.ts` and
`../beep-effect4/packages/knowledge/server/test/GraphRAG/RrfScorer.test.ts`, then
extend them for three-channel weights, empty-channel renormalization, a
deterministic literal tier/floor, span-bearing results, and exposed per-channel
contributions. Candidate engines emit ranked channels; none owns fusion policy.

**Rationale:** The literal floor, cold-start renormalization, stable ordering,
and diagnostics are beep product invariants. This also fulfills the
`goals/epistemic-bitemporal-edge-core` contract that defers RRF to this packet as
sole owner.

**Rejected:** Vendor/database-owned hybrid fusion; score-magnitude alpha fusion;
duplicating RRF in the epistemic edge packet.

## 2026-07-14 — LOCKED — first slice

**Question:** What is the first graduating vertical slice?

**Answer:** `hybrid-retrieval-fusion-core`: query to three ranked fixture
channels to weighted RRF to literal-floor ordering to span-bearing ranked
candidates with per-channel contributions. Fixtures cover an empty channel,
fuzzy consensus versus an exact phrase, duplicate IDs across channels, stable
tie-breaking, and a pre-verified `TextAnchor`. Proof must show the result remains
a candidate/evidence packet that cannot bypass `ClaimGate`.

**Rationale:** This creates the stable ranked-channel seam before storage,
encoder, ingestion, or graph adapters exist. It is deterministic and
fixture-driven, so it is not spike-gated.

**Rejected:** The pre-draft read-path vertical that bundled pgvector, chunking,
embedding, and fusion; a full ingestion stack; a vendor-backed spike as the
first goal.

## 2026-07-14 — LOCKED — satellites outside the first goal

**Question:** Are dedup and citation BFS part of the first goal?

**Answer:** No. MinHash/LSH may graduate later as
`retrieval-evidence-dedup`, only after an independently authored clean-room
policy and representative corpus. Citation acquisition and bounded BFS may
graduate as `citation-graph-retrieval-channel`, consuming `@beep/uspto` and
emitting a ranked channel into fusion. External graph storage is
driver-isolated and non-authoritative.

**Rationale:** Neither satellite is required to prove fusion. CourtListener is
AGPL, and `research/bounded-concurrency-ingest-and-dedup.md` reproduces
AGPL-derived constants, tokenization, representative-selection, and clustering
details; those details are design-reference poison and cannot drive the
implementation. Citation BFS separately depends on live ODP edge availability.

**Rejected:** Copying or paraphrasing CourtListener policy; treating the poisoned
research note as a product spec; putting dedup or BFS into fusion-core; allowing
the graph channel or graph store to own RRF or authority.

## 2026-07-14 — LOCKED — lexical default

**Question:** What is the default lexical ranked channel?

**Answer:** A generated `tsvector` STORED column, GIN index, and `ts_rank_cd`,
named honestly **lexical FTS**. `pg_textsearch` is a later upgrade behind the
same ranked-channel interface. In-memory BM25 from `@beep/nlp-processing` is
reserved for fixtures and diagnostics.

**Rationale:** Rank-only channel contracts allow a later scorer swap without
changing fusion. The live checkout pins `@electric-sql/pglite` 0.5.4 and exposes
neither vector nor textsearch subpaths, so extension enablement needs independent
P0 proof in the projection goal.

**Rejected:** Calling `ts_rank_cd` BM25; making `pg_textsearch` the default
without installation, migration, restart, query-plan, and license proof; using
in-memory BM25 as durable projection storage.

## 2026-07-14 — LOCKED — embedding contract

**Question:** What vector and model contract does projection expose?

**Answer:** Normalized `vector(768)` with `vector_cosine_ops`. The provisional
default is `nomic-embed-text-v1.5` (Apache-2.0, asymmetric prefixes).
EmbeddingGemma is opt-in only after explicit Gemma Terms acceptance. Store model
identity on every projection, never mix same-dimension vectors from different
models, and rebuild the full projection on a model change. A US-IP bake-off
ratifies the final model: nomic versus `bge-base-en-v1.5`, with Gemma optional.

**Rationale:** Dimension compatibility does not imply embedding-space
compatibility. A rebuildable, model-identified projection preserves authority
and makes migrations explicit.

**Rejected:** EmbeddingGemma as an implicit default; hosted Gemini; mixing model
spaces; rolling partial model replacement; dimension changes without a new
projection contract.

## 2026-07-14 — LOCKED — encoder runtime

**Question:** Where and how does local encoding run?

**Answer:** Define a runtime-neutral encoder port outside the renderer. Durable
projection work runs server-side or in a sidecar; the webview is never the
projection worker. Select the initial local adapter through a P0 benchmark of
cold start/RSS, chunks per second at representative lengths, cancellation and
bounded concurrency, packaged artifact size, Linux restart/rebuild, byte-identical
model identification, and zero external egress. Prefer Rust `ort` if
WebKitGTK/WASM misses budget.

**Rationale:** Projection must survive renderer lifecycle and remain measurable,
cancellable, offline, and runtime-swappable.

**Rejected:** Webview-owned durable encoding; choosing WASM or Rust without the
benchmark; external embedding egress; adopting transformers.js, ONNX Runtime,
`ort`, or Candle before a license-of-record entry exists in `SOURCES.md`.

## 2026-07-14 — LOCKED — placement

**Question:** Where do the contracts and adapters live?

**Answer:** Do not create `@beep/retrieval` for the first goal. Extend
`packages/foundation/capability/nlp-processing` for fusion contracts, weighted
RRF, and diagnostics; `packages/foundation/modeling/nlp` for generic vector and
result schemas; `packages/foundation/modeling/provenance` for anchor
construction; and `packages/foundation/capability/langextract` for window
normalization, offsets, and straddles against the verified-span contract.
Projection tables live in `packages/epistemic/tables`, query ports in
`packages/epistemic/use-cases`, composition/adapters/builders in
`packages/epistemic/server`, extension registration in `packages/drivers/pglite`,
ONNX wrappers in `packages/drivers/*`, and patent citation acquisition in
`packages/drivers/uspto`.

**Rationale:** A short live symbol/topology audit found coherent existing homes.
A new package is justified only if extension proves incoherent and a promotion
record passes the negative gate.

**Rejected:** The pre-draft `@beep/retrieval` package; persistence in foundation;
driver concerns in domain packages; retired repo-export catalog discovery.

## 2026-07-14 — LOCKED — attach versus standalone

**Question:** Does this work attach to another packet or graduate independently?

**Answer:** This exploration graduates its own goals: fusion-core first, then
projection, encoder, dedup, and citation BFS as gated follow-ons under this map.

**Rationale:** This packet solely owns fusion and its follow-on seams, while
sibling packets consume contracts without double-owning implementation.

**Rejected:** Attaching fusion to `epistemic-bitemporal-edge-core`; folding the
whole fan-out into `local-first-projection-sync`; one omnibus goal.

## 2026-07-14 — DEFERRED implementation gates

| Gate | Deferred decision | Reason / unblock condition |
| --- | --- | --- |
| `pg_textsearch` spike | Whether to adopt true BM25 as a lexical upgrade | Requires license-of-record plus PGlite installation, migration, restart, query-plan, and stability proof. |
| Embedding bake-off | Final default model | Requires representative US-IP corpus results for nomic, BGE, and optionally Gemma after terms acceptance. |
| Encoder benchmark | Initial runtime adapter | Requires the locked P0 measurements on the target Linux packaging path. |
| Dedup policy authoring | Whether and how dedup graduates | Requires a clean-room product spec and representative corpus authored without the poisoned AGPL-derived note. |
| BFS edge-availability spike | Whether citation BFS can ship against ODP | Requires proof that live ODP exposes sufficient citation edges through `@beep/uspto`. |
| PGlite extension proof | Projection extension mechanism | Requires proof for `@electric-sql/pglite` 0.5.4, whose live exports contain no vector/textsearch subpaths. |
