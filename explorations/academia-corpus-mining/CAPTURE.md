# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-07-25

The spark: Academia.edu sent interest-based recommendations; the resulting
download pile at `~/Downloads/research-7-24-26` is 519 PDFs + 6 non-PDFs
(3 docx, 1 doc, 2 md), ~357 MB, 444 unique titles after stripping " (N)"
duplicate suffixes. Intent: turn the pile into actionable repo intelligence
instead of letting it rot in Downloads.

Two distinct download waves, visible in file mtimes:

- **June 29 (342 PDFs)** — LLM agents, memory architectures, metacognition,
  neuro-symbolic reasoning, prompt engineering, document understanding.
- **July 24–25 (177 PDFs)** — legal ontologies, AI-and-law, patent/IP
  semantics.

Buried discovery in the same folder: `Legal_Ontologies_for_beep-effect.md` — a
**prior June-29 multi-agent synthesis** (~120 agents, ~4.8M tokens): 72 papers
deep-read (19-paper "most-similar" set + 53 triaged from 449 candidates in
the `ontology_research/IP_ONTOLOGY_AI_RESEARCH/pdfs` shelf of the standing research library (machine-local)), plus a
~240-paper catalogued-but-unread backlog ("next seam to mine — especially
legal-NLP/extraction ~97"). Its footer says "move it into the repo if you want
it tracked" — it never was. Adopted into this packet as
[`research/prior-synthesis-legal-ontologies.md`](./research/prior-synthesis-legal-ontologies.md).
Caveat recorded there: Appendix B has **no file-level list** of the 72
deep-read papers — only §10 short-name tables — so overlap reconstruction is
fuzzy-match with bias toward inclusion.

Standing library context: the standing research library (machine-local, outside the repo) already holds 1,161 PDFs
across themed dirs (ontology_research, law_stuff, memory_knowledge_semanticweb,
knowledge-graphs, patent_stuff, layout_stuff, dms_stuff, …). This corpus is
marked against it, not merged into it.

Mining frame (four lenses, equally weighted):

1. Memory / bitemporal / No-Escape doctrine corroboration
   (`standards/memory-architecture`, `goals/epistemic-bitemporal-edge-core`).
2. Legal ontology & semantic foundation (`goals/semantic-foundation`,
   `goals/identity-iri-fold`, `explorations/legal-ontology-landscape`).
3. Retrieval / citation grounding / doc structure
   (`goals/hybrid-retrieval-fusion-core`,
   `goals/citation-verified-span-substrate`, `goals/law-doc-structure-oa-slice`).
4. Agent architecture: metacognition / neuro-symbolic / security
   (`goals/ingestion-secret-scrub`, agents slice).

Off-topic strata exist (crypto forecasting, quantum, misc engineering) —
catalogued-only, no deep-read spend.

Pipeline home: normalized corpus (full texts, metadata, per-paper notes'
working copies) lives externally in the machine-local `academia-2026-07` research corpus
because this repo is public and copyrighted full texts must never be
committed. The packet commits only derived intelligence: catalog, syntheses,
sources ledger, routing table.
