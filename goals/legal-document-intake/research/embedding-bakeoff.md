# Embedding Bake-Off

Freshness: dated 2026-07-08.

This note answers P0 research task 3 for the legal-document-intake packet:
which local ONNX-runnable embedding model should back the future local
embedding driver for pgvector retrieval. Scope is desk evaluation only. No
models were downloaded or benchmarked. CPU-latency ranges below are
approximate-from-knowledge (unverified) and must be replaced by local
benchmarks before P5 implementation.

`SPEC.md` decision coverage: D10 requires local ONNX embeddings for privacy and
offline search, and names BGE-M3 / Nomic as P0 candidates. D6 fixes storage as
Postgres/PGlite projection with pgvector, so the model choice must be stable
enough to set vector dimensions in schema/migrations.

## Existing Repo Infrastructure

Repo inspection command:

```sh
rg -n "pgvector|embedding|onnx" packages --glob '**/src/**/*.{ts,tsx}'
```

Findings:

| Area | Paths | Finding |
| --- | --- | --- |
| ONNX runtime precedent | `packages/drivers/face-detection/src/FaceDetection.service.ts`, `FaceDetection.models.ts`, `FaceDetection.errors.ts`, `packages/tooling/tool/cli/src/commands/Files/Files.service.ts` | `onnxruntime-node` is already used for the face-detection driver and examples reference local `.onnx` model paths. This is useful driver precedent, but it is image-specific and has no text tokenizer/embedding pipeline. |
| Remote embeddings | `packages/drivers/venice-ai/src/VeniceAI.service.ts:1120` | VeniceAI exposes a remote `/embeddings` API path. This does not satisfy D10 because bulk privileged text would leave the machine. |
| Generic vector abstractions | `packages/foundation/modeling/nlp/src/Algebra/Monoid.ts`, `packages/foundation/modeling/nlp/src/Ontology/Kind.ts` | There are generic vector/embedding-adjacent types and algebra examples, but no retrieval index, model driver, tokenizer, or pgvector table wiring. |
| pgvector | `packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/DockerResolver.ts` | Only tooling knows how to resolve pgvector Docker tags. No package source currently implements pgvector schema, migrations, vector columns, indexes, or retrieval services. |

Conclusion: the local embedding driver is net-new. The repo already has enough
ONNX runtime precedent to keep implementation Effect-first and local, but P5
still needs a tokenizer/model packaging decision, vector-dimension migration,
pgvector index choice, fixture Layer, and runtime health checks.

## Legal And Long-Document Quality Context

LegalBench-RAG is the relevant legal retrieval benchmark. Its paper introduces
6,858 legal query-answer pairs over more than 79M characters and focuses on
precise snippet retrieval, not merely retrieving a broad document id
(arXiv:2408.10343, https://arxiv.org/abs/2408.10343). The published baseline
described in the paper used OpenAI `text-embedding-3-large`, SQLite Vec, and
Cohere reranking; it did not publish head-to-head numbers for BGE-M3,
Nomic, GTE, E5, Snowflake Arctic, or Jina. Therefore, candidate-specific
legal scores below are recorded as "no direct LegalBench-RAG score found" when
appropriate.

For long-document retrieval evidence, BGE-M3 reports support for retrieval
from short sentences to long documents up to 8,192 tokens and claims strong
multilingual, cross-lingual, and long-document retrieval results
(arXiv:2402.03216, https://arxiv.org/abs/2402.03216). Nomic Embed reports an
8,192-context English model and claims MTEB plus LoCo long-context strength
(arXiv:2402.01613, https://arxiv.org/abs/2402.01613). GTE multilingual is the
model family from the mGTE paper, which reports a native 8,192-token
multilingual encoder and says the base model matches large BGE-M3-class
quality with better efficiency on long-context retrieval
(arXiv:2407.19669, https://arxiv.org/abs/2407.19669). Jina v3 reports
570M parameters, 8,192 context, default 1,024-dimensional embeddings, and MTEB
multilingual/long-context strength (arXiv:2409.10173,
https://arxiv.org/abs/2409.10173). Arctic Embed 2.0 reports multilingual and
English benchmark competitiveness plus Matryoshka storage support
(arXiv:2412.04506, https://arxiv.org/abs/2412.04506). Multilingual E5 remains
a strong general multilingual baseline, but its 512-token context is a bad fit
for long legal chunks (arXiv:2402.05672, https://arxiv.org/abs/2402.05672).

## Candidate Comparison

RAM estimates are approximate-from-knowledge (unverified), derived from stated
parameter counts and dtype size: fp32 roughly 4 bytes/parameter, fp16 roughly
2 bytes/parameter, plus tokenizer/session buffers. CPU latency estimates assume
a modern desktop/laptop CPU, ONNX Runtime, batch size 1, and no repo benchmark.

| Candidate | Dimensionality | Context length | Model size / RAM footprint | Expected CPU latency | Multilingual support | Legal / long-doc retrieval quality signal | License | ONNX availability | Source / citation status |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |
| `BAAI/bge-m3` | 1,024 | 8,192 | 568M params; approx 1.1GB fp16 / 2.3GB fp32 weights before runtime buffers | Short query approx 250-900ms; 1k-token chunk approx 0.8-3s | More than 100 languages | Best overall fit: dense, sparse, and multi-vector retrieval modes; long-doc and multilingual claims in M3 paper. No direct LegalBench-RAG candidate score found. | MIT | Local ONNX should be feasible via Transformers/Optimum export; first-party ONNX package not verified in this pass | Model card facts from https://huggingface.co/BAAI/bge-m3; paper source https://arxiv.org/abs/2402.03216; latency/RAM approximate-from-knowledge (unverified) |
| `nomic-ai/nomic-embed-text-v1.5` | 768 | 8,192 | 0.1B params; approx 0.2GB fp16 / 0.4GB fp32 weights before runtime buffers | Short query approx 40-180ms; 1k-token chunk approx 150-600ms | English | Strong lightweight fallback: MTEB and LoCo long-context signal from Nomic Embed report. No direct LegalBench-RAG candidate score found. | Apache-2.0 | Local ONNX should be feasible/exportable; first-party ONNX package not verified in this pass | Model card facts from https://huggingface.co/nomic-ai/nomic-embed-text-v1.5; paper source https://arxiv.org/abs/2402.01613; latency/RAM approximate-from-knowledge (unverified) |
| `Alibaba-NLP/gte-multilingual-base` | 768 | 8,192 | 305M params; approx 0.6GB fp16 / 1.2GB fp32 weights before runtime buffers | Short query approx 120-450ms; 1k-token chunk approx 400ms-1.5s | 75 languages | Strong reserve candidate: mGTE paper positions base model near large BGE-M3-class quality with better efficiency on long-context retrieval. No direct LegalBench-RAG candidate score found. | Apache-2.0 | Local ONNX should be feasible/exportable; first-party ONNX package not verified in this pass | Model card facts from https://huggingface.co/Alibaba-NLP/gte-multilingual-base; paper source https://arxiv.org/abs/2407.19669; latency/RAM approximate-from-knowledge (unverified) |
| `intfloat/multilingual-e5-large` | 1,024 | 512 | Approx 0.6B params; approx 1.2GB fp16 / 2.4GB fp32 weights before runtime buffers | Short query approx 150-650ms; chunk latency lower than 8k models because input is capped near 512 tokens | 94 languages | Good multilingual baseline, but the 512-token limit forces aggressive chunking and loses long-clause context. No direct LegalBench-RAG candidate score found. | MIT | Best verified ONNX signal in this pass: model-card scrape reported ONNX availability | Model card facts from https://huggingface.co/intfloat/multilingual-e5-large; paper source https://arxiv.org/abs/2402.05672; ONNX signal from live model-card extraction; latency/RAM approximate-from-knowledge (unverified) |
| `Snowflake/snowflake-arctic-embed-l-v2.0` | 1,024 | 8,192 (model-card extraction for long-context family; verify before implementation) | 568M params, 303M non-embedding params; approx 1.1GB fp16 / 2.3GB fp32 weights before runtime buffers | Short query approx 250-900ms; 1k-token chunk approx 0.8-3s | 74 languages | Strong quality signal from Arctic Embed 2.0: multilingual and English benchmark competitiveness plus Matryoshka storage support. No direct LegalBench-RAG candidate score found. | Apache-2.0 | Local ONNX should be feasible/exportable; first-party ONNX package not verified in this pass | Model card facts from https://huggingface.co/Snowflake/snowflake-arctic-embed-l-v2.0; paper source https://arxiv.org/abs/2412.04506; latency/RAM approximate-from-knowledge (unverified) |
| `jinaai/jina-embeddings-v3` | Default 1,024; supports reduced Matryoshka sizes down to 32 | 8,192 | 0.6B / 570M params; approx 1.1GB fp16 / 2.4GB fp32 weights before runtime buffers | Short query approx 250ms-1s; 1k-token chunk approx 0.8-3s | 94 languages | Strong long-context multilingual signal and task LoRA support. Not recommended for default because the model card license is non-commercial. No direct LegalBench-RAG candidate score found. | CC-BY-NC-4.0 | Local ONNX should be feasible/exportable; first-party ONNX package not verified in this pass | Model card facts from https://huggingface.co/jinaai/jina-embeddings-v3; paper source https://arxiv.org/abs/2409.10173; latency/RAM approximate-from-knowledge (unverified) |
| `mixedbread-ai/mxbai-embed-large-v1` | 512 | Not verified in this pass | 0.3B params; approx 0.6GB fp16 / 1.2GB fp32 weights before runtime buffers | Short query approx 100-450ms; chunk latency depends on verified max length | Unknown from current scrape | Credible MTEB-quality English candidate, but context length and multilingual support were not verified here, so it is weaker for legal long-doc default selection. | Apache-2.0 | Scrape reported ONNX availability, but details were not verified | Model card facts from https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1; latency/RAM approximate-from-knowledge (unverified) |

## Target Numbers

These are P5 acceptance targets for the driver and retrieval service. They are
not claims about current repo performance.

### A. KG Symbolic-Entry Search

Workload: short natural-language query against KG node labels, edge labels,
aliases, taxonomy concepts, matter names, and source-title metadata. Embeddings
are precomputed for entries; only the user query is embedded at request time.

Latency target, local warm runtime:

| Segment | p50 target | p95 target |
| --- | ---: | ---: |
| Query embedding only | <= 250ms with default; <= 100ms with fallback |
| pgvector top-k over <= 250k symbolic entries | <= 30ms | <= 100ms |
| End-to-end semantic entry search | <= 300ms | <= 850ms |

Recall target on a curated legal KG alias fixture:

| Metric | Target |
| --- | ---: |
| Recall@5 | >= 0.90 |
| Recall@10 | >= 0.95 |
| Recall@20 | >= 0.98 |
| MRR@10 | >= 0.85 |

Rationale: symbolic-entry search is controlled vocabulary retrieval. It should
be fast and high-recall because graph traversal and ClaimGate checks happen
after semantic entry selection.

### B. Document Semantic Search

Workload: natural-language query against pre-chunked filed legal documents,
with result chunks carrying document id, span offsets, taxonomy path, DMS link,
and KG provenance. Chunk embeddings are precomputed during intake/background
indexing.

Latency target, local warm runtime:

| Segment | p50 target | p95 target |
| --- | ---: | ---: |
| Query embedding only | <= 350ms with default; <= 150ms with fallback |
| pgvector top-k over <= 1M chunks | <= 120ms | <= 400ms |
| End-to-end top-50 chunk retrieval before rerank/traversal | <= 700ms | <= 2,000ms |
| Background chunk embedding | Non-interactive; target <= 2s p95 per 1k-token chunk on default model, <= 700ms p95 on fallback |

Recall target on repo fixtures plus LegalBench-RAG-mini-style evaluation:

| Metric | Target |
| --- | ---: |
| Exact source chunk Recall@10 | >= 0.65 |
| Exact source chunk Recall@20 | >= 0.75 |
| Exact source chunk Recall@50 | >= 0.88 |
| Span-overlap Recall@50 after chunk expansion | >= 0.90 |

Rationale: LegalBench-RAG shows precise legal snippet retrieval is materially
harder than broad document retrieval. The driver should optimize for high
candidate recall at top-50, then let reranking, KG traversal, taxonomy filters,
and span alignment improve precision.

## Recommendation

Default model: `BAAI/bge-m3`.

Use BGE-M3 as the driver default because it best satisfies D10 and D6 together:
it is local/offline capable, MIT licensed, 1,024-dimensional for manageable
pgvector storage, long-context at 8,192 tokens, multilingual, and has the
strongest direct long-document retrieval signal among commercially usable
candidates. Its dense/sparse/multi-vector design also leaves room for a future
hybrid retrieval path without changing the domain contract. The main risk is
desktop CPU cost; P5 should require a quantized ONNX package and a benchmark
gate before making it the only enabled model.

Fallback model: `nomic-ai/nomic-embed-text-v1.5`.

Use Nomic as the fallback when local CPU/RAM or packaging makes BGE-M3 too
heavy. It keeps the important 8,192-token context, has a much smaller 0.1B
parameter footprint, uses 768-dimensional vectors, and is Apache-2.0. The
tradeoff is English-only coverage and weaker multilingual future-proofing. For
a U.S.-centered legal desktop workload that is an acceptable fallback; if
multilingual support becomes a hard requirement and BGE-M3 is too heavy,
`Alibaba-NLP/gte-multilingual-base` is the reserve candidate to benchmark next.

Implementation compatibility notes for P5:

- The vector dimension must be a model-family config contract, not a hidden
  constant, because BGE-M3 is 1,024-dimensional and Nomic/GTE are
  768-dimensional.
- Persist model id, model revision/checksum, dimension, normalization mode,
  pooling strategy, tokenizer id, and chunker version next to embeddings so a
  model swap can trigger safe reindexing.
- Treat ONNX availability as an implementation proof item. This desk pass did
  not verify first-party ONNX packages for all recommended candidates.
- Use fixture-mode Layers with deterministic tiny vectors for tests; do not
  require real model files in normal unit tests.

## Proposed SPEC Supersession

None. This research affirms D10 rather than superseding it: the local embedding
driver should default to BGE-M3 and keep Nomic as the lightweight fallback.
D6 still stands: pgvector remains the storage target, with vector dimensions
made explicit in driver/index configuration.
