# RAG Retrieval Projection Layer — Map

## Candidate Goal Packets

| Slug | Status | Mission | Depends on / gate |
| --- | --- | --- | --- |
| [`hybrid-retrieval-fusion-core`](../../goals/hybrid-retrieval-fusion-core/README.md) | **GRADUATED 2026-07-14** | Migrate and extend beep's weighted RRF into a deterministic three-channel, literal-floor, span-bearing fusion seam with per-channel contributions and ClaimGate-boundary proof. | No spike gate; fixture-driven. |
| `retrieval-vector-projection` | Gated follow-on | Add rebuildable, model-identified `vector(768)`/HNSW projection plus generated-`tsvector`/GIN lexical FTS and ranked-channel adapters. | Fusion core; PGlite 0.5.4 extension proof. |
| `retrieval-local-encoder` | Gated follow-on | Implement the runtime-neutral local encoder port and the benchmark-selected server/sidecar adapter with zero egress. | Fusion core; encoder P0 benchmark; model bake-off; license-of-record entries. |
| `retrieval-evidence-dedup` | Optional gated follow-on | Cluster near-duplicate evidence before admission while preserving representative spans. | Independent clean-room policy and representative corpus; must not use the poisoned AGPL-derived note. |
| `citation-graph-retrieval-channel` | Gated follow-on | Consume citation edges through `@beep/uspto`, run bounded BFS, and emit a ranked graph channel into beep fusion. | Fusion core; live ODP edge-availability spike. |

## Sequencing

1. Graduate `hybrid-retrieval-fusion-core` now. It fixes the ranked-channel and
   result seam without depending on storage or runtime experiments.
2. Run projection and encoder P0 gates independently; their adapters target the
   fusion seam and may proceed without changing fusion policy.
3. Add citation BFS only after ODP edge proof. The graph channel emits ranks and
   never owns fusion; external graph storage stays driver-isolated and
   non-authoritative.
4. Consider dedup only after a clean-room product policy and representative
   corpus exist. It is optional, not a hidden dependency of retrieval.

## First Vertical Slice

Given one query and three ranked fixture channels, fusion produces a stable list
of unique, span-bearing candidates. Fixtures prove:

- empty-channel weight renormalization;
- fuzzy multi-channel consensus cannot outrank the required exact-phrase tier;
- duplicate IDs merge while exposing each channel's contribution;
- stable deterministic ordering for equal totals;
- a pre-verified `TextAnchor` remains valid; and
- the output type is a candidate/evidence packet accepted only through
  `ClaimGate`, never an admitted claim or direct LLM context.

## Cross-Packet Contracts

| Packet | Contract |
| --- | --- |
| `goals/epistemic-bitemporal-edge-core` | Defers RRF to this exploration as sole owner; consumes the fusion contract and does not reimplement policy. |
| `explorations/local-first-projection-sync` | Owns fan-out/sync boundaries; retrieval projection plugs into that boundary without double-owning sync or fusion. |
| `goals/citation-verified-span-substrate` | Supplies the verified-span/anchor contract consumed by fusion results and later windowing adapters. |

## Capability Check

| Component | Live capability / exact path | Disposition |
| --- | --- | --- |
| Prior-generation RRF | `../beep-effect4/packages/knowledge/server/src/GraphRAG/RrfScorer.ts`; `../beep-effect4/packages/knowledge/server/test/GraphRAG/RrfScorer.test.ts` | **MIGRATE, THEN EXTEND**; current-generation fusion is still NET-NEW. |
| Fusion home | `packages/foundation/capability/nlp-processing/src/Tools/index.ts` | Extend existing capability; weighted RRF, ranked-channel contracts, diagnostics, literal tier, and contributions are **NET-NEW**. |
| BM25 fixtures/diagnostics | `packages/foundation/capability/nlp-processing/src/Tools/CreateCorpus.ts`; `LearnCorpus.ts`; `QueryCorpus.ts`; `CorpusStats.ts`; `TextSimilarity.ts` | Reuse only for in-memory fixtures/diagnostics, not durable lexical projection. |
| Generic vector schemas | `packages/foundation/modeling/nlp/src/Core/Vectorization.ts` | Extend; generic ranked result/contribution schemas are **NET-NEW**. |
| Provenance anchor | `packages/foundation/modeling/provenance/src/TextAnchor.ts` | Reuse verified `TextAnchor`; anchor construction additions extend this package. |
| Windowing/straddles | `packages/foundation/capability/langextract/src/` | Extend against the verified-span contract; normalization/offset/straddle behavior is **NET-NEW**. |
| Admission boundary | `packages/epistemic/` (`domain`, `tables`, `use-cases`, `server`) | Reuse Claim/Evidence/ClaimGate spine; projection tables and ranked query ports are **NET-NEW**. |
| Local database driver | `packages/drivers/pglite/src/PgliteClient.service.ts` | Extend only after P0 extension proof; vector/textsearch registration is **NET-NEW**. |
| Patent edges | `packages/drivers/uspto/src/` | Extend for citation acquisition after ODP proof; bounded BFS channel is **NET-NEW**. |
| Local encoder | No text-embedding driver found in `packages/**/src` | Encoder port, ONNX wrapper, model identity, and benchmark-selected adapter are **NET-NEW**. |

The live 2026-07-14 audit found no RRF, `tsvector`, or HNSW implementation in
`packages/**/src`. It did find the BM25 tools above and the canonical
`Vectorization.ts`. No `@beep/retrieval` package is warranted unless extension
later proves incoherent and a promotion record passes the negative gate.

## Inherited Risks

- PGlite extension loading and HNSW query-plan behavior are unproven on 0.5.4.
- Embedding model selection and runtime packaging remain measured P0 gates.
- Model identity and full-rebuild semantics must prevent mixed vector spaces.
- Dedup is contamination-sensitive and cannot use the existing AGPL-derived note.
- Fusion weights need representative-corpus calibration after the core seam lands.
