# Hybrid Retrieval Fusion Core — Sources & Provenance

This implementation ledger carries only the fusion-core sources. The source
exploration's ledger remains primary:
[`explorations/rag-retrieval-projection/research/SOURCES.md`](../../../explorations/rag-retrieval-projection/research/SOURCES.md).

- **Source exploration:** `explorations/rag-retrieval-projection`
- **Ratified contract:** exploration `DECISIONS.md`, `BRIEF.md`, and `MAP.md`
- **Migration classification:** the prior scorer and test are same-project
  Apache-2.0 material from the sibling `beep-effect4` checkout, recorded as
  **MIGRATION**, not as an external mined source.

## 1. Migration corpus

| Source | Location | Behavior carried forward | Disposition |
| --- | --- | --- | --- |
| Prior-generation scorer | `../beep-effect4/packages/knowledge/server/src/GraphRAG/RrfScorer.ts:8-81` | `k=60`, `1/(k+rank)`, rank aggregation, list fusion, and graph-hop rank assignment | **MIGRATE, THEN EXTEND** in `@beep/nlp-processing` |
| Prior-generation tests | `../beep-effect4/packages/knowledge/server/test/GraphRAG/RrfScorer.test.ts:14-124` | component/aggregate math, embedding+graph combination, multi-list fusion, graph-hop ranks, empty input, single-list order | **MIGRATE AS PARITY BASELINE** before new fixtures |

The implementation may rename or reshape APIs to satisfy current repo laws, but
P0 must first preserve every observable behavior in the migrated test matrix.
Current extensions are named channels and weights, empty-channel
renormalization, literal tier/floor, stable ties, spans, schemas, and exposed
contributions.

## 2. Relevant mined sources and licenses

| Nugget | Upstream | Source | License | Disposition here |
| --- | --- | --- | --- | --- |
| `agentmemory#1` | agentmemory | `src/state/hybrid-search.ts:194-219` | Apache-2.0 | port with attribution: three-stream shape and empty-channel weight renormalization |
| `doc-haus#1` | doc-haus | `dochaus/tool/search-document.ts:42-121` | MIT | adapt three-channel, char-span, and literal-floor design |
| `LegalEase#5` | LegalEase | `backend/services/hybrid_search.py:44-58` | MIT | negative reference: do not fuse incompatible raw score distributions |

### License of record

| Material | License record | Discipline |
| --- | --- | --- |
| `beep-effect4` scorer/test | `../beep-effect4/LICENSE` — Apache-2.0; same project and repository lineage | migrate with source path recorded; preserve notices/history |
| Current `beep-effect3` target | `LICENSE` and `packages/foundation/capability/nlp-processing/LICENSE` — Apache-2.0 | native destination |
| agentmemory | Apache-2.0 per exploration ledger | port with attribution |
| doc-haus | MIT per exploration ledger | adapt with attribution |
| LegalEase | MIT per exploration ledger | reference the rejected pattern only |

No AGPL or unknown-license source informs fusion implementation. In particular,
the CourtListener-derived dedup note is design-reference poison and is excluded
from this goal. The RRF formula is the published method; external sources below
ground the method and policy tradeoffs, not copied code.

## 3. External research sources

- Cormack, Clarke & Büttcher, *Reciprocal Rank Fusion outperforms Condorcet and
  individual Rank Learning Methods*, SIGIR 2009:
  https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf
- Azure AI Search hybrid ranking (`k` near 60):
  https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking
- Elasticsearch weighted reciprocal rank fusion:
  https://www.elastic.co/search-labs/blog/weighted-reciprocal-rank-fusion-rrf
- Literal-floor design reference:
  https://softwaredoug.com/blog/2025/03/13/elasticsearch-hybrid-search-strategies

The complete citation list and raw synthesis live in the exploration's
[`rrf-fusion-and-retrieval-contract.md`](../../../explorations/rag-retrieval-projection/research/rrf-fusion-and-retrieval-contract.md).

## 4. In-repo capabilities

| Capability | Path | Disposition |
| --- | --- | --- |
| Fusion home and tool contracts | `packages/foundation/capability/nlp-processing/src/Tools/` | extend; ranked channels/results, weighted RRF, diagnostics, and literal policy are NET-NEW |
| In-memory corpus diagnostics | `packages/foundation/capability/nlp-processing/src/Tools/{CreateCorpus,LearnCorpus,QueryCorpus,CorpusStats,TextSimilarity}.ts` | reuse for fixture/diagnostic conventions only |
| Generic vector contracts | `packages/foundation/modeling/nlp/src/Core/Vectorization.ts` | reuse/extend only if P0 proves a generic schema belongs there |
| Canonical span | `packages/foundation/modeling/provenance/src/TextAnchor.ts` | reuse pre-verified `TextAnchor`; fusion does not construct or repair it |
| Candidate/admission spine | `packages/epistemic/domain/src/entities/CandidateClaim/`; `packages/epistemic/use-cases/src/ClaimGate/` | reuse as boundary proof; fusion cannot emit admission |

The 2026-07-14 exploration audit found no current RRF owner in `packages/**/src`
and identified `@beep/nlp-processing` as the coherent extension point. P0 repeats
the live source/barrel audit before implementation because checkout topology is
the source of truth.

## 5. Cross-links

- Source exploration: [`README`](../../../explorations/rag-retrieval-projection/README.md),
  [`BRIEF`](../../../explorations/rag-retrieval-projection/BRIEF.md),
  [`MAP`](../../../explorations/rag-retrieval-projection/MAP.md),
  [`DECISIONS`](../../../explorations/rag-retrieval-projection/DECISIONS.md), and
  [`primary ledger`](../../../explorations/rag-retrieval-projection/research/SOURCES.md).
- Consumer contract: [`epistemic-bitemporal-edge-core`](../../epistemic-bitemporal-edge-core/README.md)
  defers RRF to this goal as sole owner.
- Verified-span substrate: [`citation-verified-span-substrate`](../../citation-verified-span-substrate/README.md).
- Queued only: `retrieval-vector-projection`, `retrieval-local-encoder`,
  `retrieval-evidence-dedup`, and `citation-graph-retrieval-channel`.
