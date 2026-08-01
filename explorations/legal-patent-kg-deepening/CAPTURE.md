# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-01

Spark (verbatim intent): "I have compiled another set of research documents &
repositories from which I would like to extract the 'gold' from relevant to
this repository. … I want to orchestrate the /deep-research on these documents
and create a new exploration packet /explore. I think it relevant to [run]
through /adhd."

Corpus: `/home/elpresidank/YeeBois/research/legal-patent-ontology-knowledge-graph-and-related-research/`
— ~120 papers (PDF/HTML, ~100 unique after dedupe; several exact-duplicate
filenames), ~24 cloned repos, 4,491 files total, plus `links.md` (15 URLs:
FIBO Legal Core, UFO-L project page, LegalRuleML 1.0 spec, ScienceDirect /
Springer / IEEE / ResearchGate papers). `links.md` is in scope as fetch
targets.

Named curiosity from kickoff: **FOPNet** ("a comprehensive functional semantic
knowledge graph for deep technical analysis in patents",
https://www.researchgate.net/publication/401398955). Pairs with "A Functional
Model of Patent Knowledge Based on Functional Ontology.html" already in the
corpus — the functional-patent-knowledge angle is an explicit priority thread,
not one row among 120.

Corpus clusters (from the initial inventory sweep):

- Legal core ontologies + Hohfeldian formalization: UFO / UFO-L (multiple,
  incl. the Portuguese thesis), LKIF-Core, legal relations / legal core
  ontology patterns, Hohfeldian knowledge bases, powers/subjections/
  disabilities/immunities, network models of legal relations.
- Patent knowledge graphs: Patent-KG, KLIPA, patent entity alignment (GCN),
  linked open data for US patents, USPTO class ontology, patentlego /
  patentprocess ontologies, patent data mining / landscape studies.
- Legal GraphRAG + temporal norm reasoning: ontology-driven GraphRAG for
  legal norms (hierarchical/temporal/deterministic), LegalGraphRAG,
  RAG structural/temporal/causal limitations, LRMoo diachronic norm
  evolution (two variants), legal reasoning paths from court judgments,
  French Cassation / criminal appeals KGs, Zep temporal KG agent memory.
- Patent LLM authoring + multi-agent IP workflows: PatentGPT, PAP2PAT,
  PatentWriter, patent claim generation quality, patent concept generation,
  AI-orchestrated multi-agent IP management, AgentODRL, ODRL usage policies,
  Symboleo contract specification, smart legal contract NLP conversion.
- Ontology engineering with LLMs: LLM-assisted ontology engineering (French
  legal KG), accelerating KG/ontology engineering with LLMs, llm4oe SLR,
  collaborative human+LLM legal KG construction, legal ontology learning /
  population repos.
- Cloned repos (triage lane): lkif-core (wave-1 overlap), CommonCoreOntologies,
  GLEIO, DAOnt, O3POntology, patentlego-ontology, patentprocess-ontology,
  USPTO_ClassOntology, semanticlaw, raglex, LegalDatasets, LegalPP,
  LegalCaseKnowledgeGraph, cjeu-ontology-mappings, legal-ontology-population,
  Legal-Ontology-Learning, CapturingLegalReasoningPaths, ai-legal-claude,
  awesome-legal-data, knowledge_graph, Legal-Ontologies, LegalPapers,
  llm4oe-slr, and misc.

Relation to prior strand: this is **wave 2** of the legal/patent ontology-KG
strand. Wave 1 = [`legal-ontology-landscape`](../legal-ontology-landscape/README.md)
(graduated 2026-07-14; execution in
[`goals/semantic-foundation`](../../goals/semantic-foundation/README.md)).
Wave-2 findings build on — and must not silently re-litigate — wave-1
conclusions and semantic-foundation's locked scope (SKOS schemes under
`https://ns.beep.sh/`, FOLIO alignments, `@beep/ontology` registry/loader, no
graph store). New fronts wave 1 did not cover: Hohfeld formalization depth,
patent-KG construction, functional patent knowledge (FOPNet), legal GraphRAG,
diachronic norm evolution, patent-drafting LLM benchmarks.

Corpus hygiene noted at intake: `pimpbunny.com_cookies.txt` (browser cookie
export — possible live session tokens; excluded from mining, flagged for
deletion), `Screencast_20260730_125536.gif`, `Screenshot_20260730_000548.png`
(unrelated screen captures), several duplicate PDFs (same paper, two
filenames — dedupe by content hash during catalog pass).

Campaign design was grilled and locked the same day — see
[`DECISIONS.md`](./DECISIONS.md).
