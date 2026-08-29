# RAG Retrieval Projection Layer — Brief

## Problem

beep needs hybrid retrieval that combines semantic, lexical, and exact-literal
signals without surrendering ranking policy to a database or vendor. The result
must be deterministic, explainable, local-first, and evidence-bearing: ranked
items carry verified spans and per-channel contributions, then remain candidate
evidence subject to `ClaimGate`. Retrieval must never become an alternate
admission path or a raw-chunk-to-LLM shortcut.

Today the repo has useful BM25 diagnostics, provenance anchors, verified-span
contracts, epistemic admission boundaries, and a prior-generation RRF scorer,
but no current three-channel fusion seam or durable vector/lexical projection.
Starting with projection would entangle the stable product policy with uncertain
PGlite extensions and encoder packaging. Start with the policy seam instead.

## Appetite

**Proposed — ratify at shape sign-off:** one focused goal for the deterministic,
fixture-driven fusion core. It includes migration and extension of the
prior-generation scorer, ranked-channel/result contracts, diagnostics, literal
floor, spans, and ClaimGate-boundary proof. It excludes storage extensions,
live encoders, ingestion orchestration, dedup, and citation BFS. Follow-on goals
carry their own P0 gates; none may expand the first goal.

## Fat-Marker Solution Sketch

```text
query
  -> semantic ranked channel (fixture first; pgvector adapter later)
  -> lexical FTS ranked channel (fixture first; tsvector/GIN adapter later)
  -> exact-literal ranked channel (fixture first; durable adapter later)
  -> beep weighted RRF
       - renormalize weights when an entire channel is empty
       - deduplicate candidate IDs across channels
       - expose each channel contribution
       - apply deterministic literal tier/floor
       - break remaining ties stably
  -> ranked span-bearing candidate/evidence packet
  -> ClaimGate (still mandatory)
```

The first seam consumes three ranked fixture streams and emits candidates whose
score explanation and pre-verified `TextAnchor` survive fusion. Later adapters
implement the same channel interface: epistemic projection queries, a
runtime-neutral local encoder, and an optional USPTO citation-graph channel.
Projection remains rebuildable and model-identified; authoritative source text,
anchors, evidence, and admission decisions remain outside the index.

## Rabbit Holes

- **PGlite 0.5.4 extension enablement:** the live package exports no vector or
  textsearch subpaths. The projection goal needs P0 proof of installation,
  migration, restart/rebuild, and query plans before pgvector/HNSW or
  `pg_textsearch` adoption.
- **Model mixing:** all projections record exact model identity. Equal dimension
  is not equal space; a model change forces a full rebuild.
- **Renderer coupling:** the encoder port stays outside the renderer. Benchmark
  WASM versus server/sidecar adapters on Linux; prefer Rust `ort` if WebKitGTK
  misses the ratified budget.
- **AGPL contamination:**
  `research/bounded-concurrency-ingest-and-dedup.md` contains CourtListener-derived
  policy details and is design-reference poison for dedup. A clean-room product
  spec and representative corpus must be independently authored.
- **Weight calibration:** ship explicit defaults and contribution diagnostics,
  but do not turn the first goal into relevance tuning. Calibration belongs to
  a representative-corpus follow-up.

## No-Gos

- No vendor- or candidate-engine-owned final fusion.
- No BM25 name or semantics for `ts_rank_cd`; call it lexical FTS.
- No webview as the durable projection worker.
- No mixing vectors produced by different models.
- No AGPL-derived dedup policy, constants, tokenization, selection, or clustering.
- No `@beep/retrieval` package by default; require the promotion negative gate.
- No raw retrieval result, chunk, or evidence bypassing `ClaimGate`.
- No projection, graph store, or embedding vector treated as authority.
