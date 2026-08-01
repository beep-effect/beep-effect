# Legal & Patent KG Deepening — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy. Purpose: let an
implementing agent trace every decision back to its origin — a mined source
(repo + file:line), an upstream repo + LICENSE, an external citation, or an
in-repo brick.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ treat as reference
  only. State the discipline per repo.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Cluster / origin:** hand-curated intake corpus at
  `/home/elpresidank/YeeBois/research/legal-patent-ontology-knowledge-graph-and-related-research/`
  (~120 papers, ~24 cloned repos, `links.md` with 15 seed URLs), assembled
  2026-07-31 → 2026-08-01.
- **Provenance:** corpus inventory in [`../CAPTURE.md`](../CAPTURE.md);
  campaign design in [`../DECISIONS.md`](../DECISIONS.md). Wave-1 ledger:
  [`../../legal-ontology-landscape/`](../../legal-ontology-landscape/README.md).

## 1. Mined source corpus

<!-- Fills during mining waves: one row per unique paper/URL distillate, with
its distillate path under research/mined/ and track theme. -->

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| (pending) | mining wave 1 not yet launched | | | | |

## 2. Upstream repositories & licenses

<!-- Fills during repo triage: one row per corpus repo that survives triage,
with SPDX license and port discipline. Repos overlapping wave-1 holdings noted
delta-only. -->

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| R02 `awesome-legal-data` | `CC0-1.0` | reference only | Dataset and portal lookup list. |
| R03 `CapturingLegalReasoningPaths` | `none-found` | reference only | Reasoning-path ontology, prompts, and annotated-data reference. |
| R04 `cjeu-ontology-mappings` | `CC-BY-4.0` | port with attribution | CJEU cross-ontology mapping workbook. |
| R05 `CommonCoreOntologies` | `BSD-3-Clause` | port with attribution | Mid-level ontology modules and release patterns. |
| R06 `DAOnt` | `CC-BY-SA-4.0` | clean-room pattern only | Data Act deontic and executable compliance patterns. |
| R07 `GLEIO` | `none-found` | reference only | LEI ontology and temporal-reference-data design. |
| R08 `knowledge_graph` | `none-found` | reference only | SEC litigation extraction and nested-KG reference. |
| R09 `Legal-Ontologies` | `CC-BY-SA-4.0` | reference only | Legal ontology and KG lookup list. |
| R10 `Legal-Ontology-Learning` | `MIT` | port with attribution | Ontology-learning pipeline patterns. |
| R11 `legal-ontology-population` | `none-found` | reference only | LKIF-to-YAGO mapping reference. |
| R12 `LegalCaseKnowledgeGraph` | `none-found` | reference only | Chinese case narrative and triples dataset reference. |
| R13 `LegalDatasets` | `Apache-2.0` | port with attribution | Legal-document schema and dataset-intake patterns. |
| R14 `LegalPapers` | `none-found` | reference only | Legal-intelligence bibliography. |
| R15 `LegalPP` | `MIT` | port with attribution | LegalLPP dataset and text-guided KG-completion patterns. |
| R17 `llm4oe-slr` | `CC-BY-4.0` | port with attribution | Structured LLM-for-ontology-engineering evidence tables. |
| R19 `patentlego-ontology` | `CC-BY-SA-4.0` | clean-room pattern only | Functional patent-block vocabulary and connection patterns. |
| R21 `raglex` | `none-found` | reference only | Legal corpus, citation graph, and retrieval architecture. |
| R22 FOPNet STS | `none-found` | reference only | FOP patent-triple and similarity approach; no code or data extraction. |
| R23 `semanticlaw` | `Apache-2.0` | port with attribution | Swiss-law RDF vocabulary and collection patterns. |
| R24 `USPTO_ClassOntology` | `none-found` | reference only | USPTO class-definition and claim-overlap reference. |

Full 24-row triage, including skipped repositories and exact mine targets:
[`01-repo-triage.md`](./01-repo-triage.md) and
[`01-repo-triage.json`](./01-repo-triage.json).

## 3. External research sources

- `links.md` seed URLs (15) — reproduced into the catalog during wave 1;
  includes FIBO Legal Core, UFO-L project page, LegalRuleML 1.0 spec, and the
  FOPNet ResearchGate entry (priority thread).

## 4. In-repo capability references

See [`../RESEARCH.md`](../RESEARCH.md) § In-Repo Capability Inventory —
verified per-brick rows land here as mining cites them.

## 5. Cross-links & provenance

- Wave 1: [`legal-ontology-landscape`](../../legal-ontology-landscape/README.md)
  (graduated; standing conclusions) → execution in
  [`goals/semantic-foundation`](../../../goals/semantic-foundation/README.md).
- Artifact contracts: [`_gold-intake`](../../_gold-intake/ROUTING-SEED.md)
  v1 nugget catalog / routing-seed / handoff schemas.
- Campaign grill log: [`../DECISIONS.md`](../DECISIONS.md).
