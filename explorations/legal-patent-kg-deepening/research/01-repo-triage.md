# Corpus Repository Triage

Date: 2026-08-01

This is a shallow triage of the 24 repositories mapped as R01-R24 in
[`00-catalog.json`](./00-catalog.json). Each verdict uses only the repository
README, repository license evidence, and a depth-two file tree; source files
were not deep-read.

## Verdict counts

| Verdict | Count |
| --- | ---: |
| `deep-mine` | 9 |
| `reference-only` | 11 |
| `skip` | 4 |
| **Total** | **24** |

Missing license evidence imposes a `reference-only` ceiling even when the
repository is technically rich. Share-alike/copyleft material may inform only
a clean-room pattern; permissive material may be ported with attribution.

## Deep-mine shortlist

| ID | Repository | Why it earns an xhigh pass | Reuse discipline |
| --- | --- | --- | --- |
| R04 | `cjeu-ontology-mappings` | Concrete cross-ontology mapping workbook for CJEU case-law properties. | Port with attribution. |
| R05 | `CommonCoreOntologies` | Modular and merged BFO-aligned mid-level ontologies plus ontology-release patterns. | Port with attribution. |
| R06 | `DAOnt` | Legal ontology plus executable SPARQL compliance pattern spanning duties, permissions, prohibitions, exceptions, and contracts. | Clean-room pattern only. |
| R10 | `Legal-Ontology-Learning` | Compact ontology-learning pipeline with topic, word, and cluster stages suitable for pattern extraction. | Port with attribution. |
| R13 | `LegalDatasets` | Normalized legal-document JSONL contract and a broad set of scraper and dataset-preparation lanes. | Port with attribution. |
| R15 | `LegalPP` | LegalLPP dataset and text-guided KG-completion implementation for legal-provision prediction. | Port with attribution. |
| R17 | `llm4oe-slr` | Structured evidence tables for LLM-supported ontology-engineering tasks, methods, evaluation, and experiment datasets. | Port with attribution. |
| R19 | `patentlego-ontology` | Explicit functional patent-block schema with typed resources and reusable system-connection templates, despite being prose rather than OWL. | Clean-room pattern only. |
| R23 | `semanticlaw` | Small, inspectable Swiss-law RDF vocabulary, example statute graphs, and collection helper. | Port with attribution. |

The exact extraction paths are recorded in
[`01-repo-triage.json`](./01-repo-triage.json).

## FOPNet priority finding

R22 is the repository actually holding the FOPNet-priority implementation. It
contains Function-Object-Property patent triples, sample patent/IPC data,
weighted semantic-similarity algorithms, and MAP, MRR, NDCG, and recall
evaluation code. It does **not** earn `deep-mine`: neither a LICENSE file nor
license terms were found in its README or shallow project metadata. Its
verdict is therefore `reference-only`; later work may cite it and its paper,
but must not extract or port its code or data without separate license
clearance.

R12 was catalog-tagged with FOPNet themes, but its actual contents are a
Chinese legal-case narrative-and-triples dataset and are unrelated to FOPNet.

## License table

| ID | Repository | License | Verdict | License consequence |
| --- | --- | --- | --- | --- |
| R01 | `ai-legal-claude` | `none-found` | `skip` | No reuse; irrelevant to the campaign. |
| R02 | `awesome-legal-data` | `CC0-1.0` | `reference-only` | Lookup list only; no extraction target. |
| R03 | `CapturingLegalReasoningPaths` | `none-found` | `reference-only` | Citation and inspection only. |
| R04 | `cjeu-ontology-mappings` | `CC-BY-4.0` | `deep-mine` | Port with attribution. |
| R05 | `CommonCoreOntologies` | `BSD-3-Clause` | `deep-mine` | Port with attribution. |
| R06 | `DAOnt` | `CC-BY-SA-4.0` | `deep-mine` | Clean-room pattern only. |
| R07 | `GLEIO` | `none-found` | `reference-only` | Citation and inspection only. |
| R08 | `knowledge_graph` | `none-found` | `reference-only` | Citation and inspection only. |
| R09 | `Legal-Ontologies` | `CC-BY-SA-4.0` | `reference-only` | Lookup list only; no extraction target. |
| R10 | `Legal-Ontology-Learning` | `MIT` | `deep-mine` | Port with attribution. |
| R11 | `legal-ontology-population` | `none-found` | `reference-only` | Citation and inspection only. |
| R12 | `LegalCaseKnowledgeGraph` | `none-found` | `reference-only` | Citation and inspection only. |
| R13 | `LegalDatasets` | `Apache-2.0` | `deep-mine` | Port with attribution. |
| R14 | `LegalPapers` | `none-found` | `reference-only` | Citation and inspection only. |
| R15 | `LegalPP` | `MIT` | `deep-mine` | Port with attribution. |
| R16 | `lkif-core` | `CC-BY-4.0` | `skip` | Already covered in wave 1; no duplicate mine. |
| R17 | `llm4oe-slr` | `CC-BY-4.0` | `deep-mine` | Port with attribution. |
| R18 | `O3POntology` | `MIT` | `skip` | Permissive, but irrelevant to legal/patent scope. |
| R19 | `patentlego-ontology` | `CC-BY-SA-4.0` | `deep-mine` | Clean-room pattern only. |
| R20 | `patentprocess-ontology` | `EPL-1.0+` | `skip` | Copyleft and empty boilerplate; no mine. |
| R21 | `raglex` | `none-found` | `reference-only` | Architecture reference only. |
| R22 | `Semantic-Text-Similarity-STS-with-functional-semantic-knowledge-FOP-in-patents` | `none-found` | `reference-only` | FOPNet reference only pending license clearance. |
| R23 | `semanticlaw` | `Apache-2.0` | `deep-mine` | Port with attribution. |
| R24 | `USPTO_ClassOntology` | `none-found` | `reference-only` | Citation and inspection only; LICENSE is zero bytes. |

## Wave-1 overlaps

Only R16 (`lkif-core`) is a confirmed wave-1 overlap. The
[`legal-ontology-landscape`](../../legal-ontology-landscape/RESEARCH.md)
packet already vendored, verified, and assessed seven LKIF-Core modules and
settled on slice/inspire rather than wholesale import. R16 is therefore a
`skip` for this campaign's repo-mining wave.

Some reference lists mention artifacts considered in wave 1, but their own
central artifacts were not mined there; those rows remain
`wave1Overlap: false`.
