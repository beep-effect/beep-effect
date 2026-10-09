# Sources

- **Cluster / origin:** `academia-corpus-mining` wave-2 synthesis
  (`synthesis/wave2-synthesis.md` in the machine-local academia-2026-07 research corpus), routing ratified 2026-08-17.
- **Paper evidence:** `0a8de1437753`, `b7ab12db479a` — resolvable via the corpus's `text/`,
  `meta/`, `notes/`, and `resolved-index.jsonl`.

## 2026-10-09 — Source ledger for evidence-signals/v1

### Machine-local academia-2026-07 research corpus (reference-only)

| Paper id | Title | DOI from resolved-index.jsonl | Source location and disposition |
| --- | --- | --- | --- |
| 0a8de1437753 | Uncertainty Management in the Construction of Knowledge Graphs: a Survey | [10.48550/arxiv.2405.16929](https://doi.org/10.48550/arxiv.2405.16929) | notes/0a8de1437753.json, sections 5.2/8.2 named there; reference-only |
| b7ab12db479a | Populating Web-Scale Knowledge Graphs Using Distantly Supervised Relation Extraction and Validation | [10.3390/info12080316](https://doi.org/10.3390/info12080316) | notes/b7ab12db479a.json, sections 3/3.2/3.3/4.3 named there; reference-only |

The corpus synthesis/wave2-synthesis.md sections 4–6, new findings, honest
limits and routing table were inspected read-only. Claims above are bounded by
the note evidence and limitations; full paper text was not needed. License
reuse permission was not verified: no paper prose or implementation is copied.

### Public primary sources

Fetched with curl on 2026-10-09 UTC; every response HTTP 200. Scratch receipts
retain timestamps, effective URLs, content digests and extracted-text locators.
All sources are reference-only; implementation license compatibility is
unverified and no upstream code is used.

| Source URL | Inspected locator | Disposition |
| --- | --- | --- |
| [Primary source](https://www.w3.org/TR/prov-o/) | 3.1 Starting Point Terms | reference-only |
| [Primary source](https://nanopub.net/guidelines/working_draft/) | Basic Elements; community working draft | reference-only |
| [Primary source](https://www.w3.org/TR/annotation-model/) | Motivation and Purpose; external-resource metadata | reference-only |
| [Primary source](https://www.vldb.org/pvldb/vol2/vldb09-pvldb47.pdf) | Introduction; source-dependence model assumptions | reference-only |
| [Primary source](https://proceedings.mlr.press/v70/guo17a/guo17a.pdf) | Calibration definition; temperature scaling | reference-only |
| [Primary source](https://papers.nips.cc/paper_files/paper/2017/file/4a8423d5e91fda00bb7e46540e2b0cf1-Paper.pdf) | Selective risk, coverage and threshold procedure | reference-only |
| [Primary source](https://www.w3.org/TR/shacl/) | Severity; sh:conforms and validation report | reference-only |

### In-repo bricks and design provenance

Every path below was inspected on the lane merged with main at `36027982f2`.
Package/field/type/producer details are in [RESEARCH](../RESEARCH.md#in-repo-capability-inventory).
These are composition references, not implementation claims.

- `explorations/academia-corpus-mining/research/t3-master-synthesis.md` — in-repo composition/design reference.
- `explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md` — in-repo composition/design reference.
- `goals/epistemic-bitemporal-edge-core/research/2026-08-17-academia-wave2-reentry.md` — in-repo composition/design reference.
- `packages/foundation/modeling/schema/src/UnitInterval.ts` — in-repo composition/design reference.
- `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts` — in-repo composition/design reference.
- `packages/foundation/capability/langextract/src/Extraction/Extraction.model.ts` — in-repo composition/design reference.
- `packages/foundation/capability/langextract/src/Alignment/Alignment.model.ts` — in-repo composition/design reference.
- `packages/foundation/modeling/nlp/src/Handoff/Contract.ts` — in-repo composition/design reference.
- `packages/foundation/modeling/nlp/src/Handoff/index.ts` — in-repo composition/design reference.
- `packages/foundation/modeling/provenance/src/TextAnchor.ts` — in-repo composition/design reference.
- `packages/epistemic/domain/src/values/ClaimEvidenceReview/ClaimEvidenceReview.model.ts` — in-repo composition/design reference.
- `packages/epistemic/domain/src/entities/ClaimDisposition/ClaimDisposition.model.ts` — in-repo composition/design reference.
- `packages/epistemic/domain/src/values/ClaimDispositionStatus/ClaimDispositionStatus.model.ts` — in-repo composition/design reference.
- `packages/shared/domain/src/identity/Epistemic/ClaimDispositionId.ts` — in-repo composition/design reference.
- `packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts` — in-repo composition/design reference.
- `packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts` — in-repo composition/design reference.
- `packages/foundation/capability/file-processing/src/PageOcr/PageOcr.schema.ts` — in-repo composition/design reference.
- `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts` — in-repo composition/design reference.
- `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts` — in-repo composition/design reference.
- `packages/law-practice/use-cases/src/DocketIntake/DocketReview.schemas.ts` — in-repo composition/design reference.
- `packages/epistemic/tables/src/entities/Evidence/Evidence.table.ts` — in-repo composition/design reference.
- `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts` — in-repo composition/design reference.
- `packages/_internal/db-admin/src/migrations/EpistemicEdge.ts` — in-repo composition/design reference.
- `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts` — in-repo composition/design reference.
- `goals/legal-document-intake/SPEC.md` — in-repo composition/design reference.
- `goals/semantic-foundation/PLAN.md` — in-repo composition/design reference.
- `goals/epistemic-claim-lifecycle-gate/SPEC.md` — in-repo composition/design reference.
- `explorations/ingestion-security-secret-governance/research/secret-pii-scrub-and-audit.md` — in-repo composition/design reference.
- `explorations/gpu-document-ocr/RESEARCH.md` — in-repo composition/design reference.
- `explorations/oppold-corpus-overhaul/MAP.md` — in-repo composition/design reference.
- `explorations/oppold-corpus-overhaul/research/2026-08-24-graduation-dossier.md` — in-repo composition/design reference.

No external implementation repo was mined or ported. Live domain source and
NLP public subpath exports were checked instead of the obsolete root export
catalog. NOT FOUND gaps and gated dependencies remain explicit in RESEARCH.
