# Source: The AI Barrister Flight Simulator

- **Title:** The AI Barrister Flight Simulator: A Neuro-Symbolic Benchmark for Structured Legal Reasoning
- **Authors:** David Scott Lewis, Enrique Zueco (AIXC Research, Zaragoza, Spain)
- **Venue:** ICLR 2026 workshop paper
- **Source URL:** https://openreview.net/pdf/42ef464c05efa3c750f623b7df2fe74aefe677c3.pdf
  (content-addressed attachment; behind OpenReview's browser-verification wall — local copy is canonical)
- **Local copy:** `sources/ai-barrister-flight-simulator-iclr2026.pdf` (388 KB, 
  pdfTeX, created 2026-04-30)
- **Added:** 2026-08-10, operator request, alongside the OpenLink ai-agent-skills mining pass

## What it is

A neuro-symbolic benchmark that evaluates *how* an LLM reasons over legal structure rather
than merely *whether* it reaches the correct answer. Three layers: a symbolic Legal Knowledge
Graph (statutes, case law, doctrinal tests, jurisdictional rules, temporal relations, citation
networks with annotated scenario subgraphs and gold reasoning paths), a neural LLM, and a
symbolic controller orchestrating a four-stage pipeline (Retrieval → Generation → Symbolic
Checking → Repair).

Five task families (multi-hop citation, jurisdiction-constrained, temporal validity,
doctrine-structure, multi-query consistency) and four structure-aware metrics:

- **CVR** — Constraint Violation Rate
- **HAR** — Hallucination Rate
- **PA** — Path Alignment (against gold reasoning paths)
- **NC** — Node Coverage

Headline numbers (50-scenario suite, 3 seeds): KG-RAG pipeline 98.0% accuracy with HAR 0.005
and PA 0.830 vs 77.3% / HAR 0.138 for baseline LLM; adding the controller cuts HAR to 0.003.
PA and NC are significant predictors of correctness (r = 0.259 / 0.302); a logistic model over
CVR+PA+NC predicts answer correctness at 98.0%. Code/LKG/scenarios "released upon acceptance."

## Why it's in this packet

- **Gold-reasoning-path evaluation** is the missing evaluation layer for beep's legal KG work
  (citation-verified-span substrate, legal-position relator, epistemic belief/evidence stack):
  grade agents on path fidelity through the graph, not endpoint accuracy.
- The **LKG schema** (jurisdictional boundaries, temporal precedent validity, doctrinal
  multi-element tests as first-class graph objects) is a direct comp for the patent/legal KG
  schema design — worth a side-by-side against the beep legal domain models.
- The **controller's post-hoc symbolic checking + repair loop** is the same shape as the
  OpenLink rdf-infographic "harness contract" gates being mined in this pass: neural output,
  mechanical verification, bounded repair. Convergent pattern worth naming in the packet.
- **Structure-aware metrics as CI gates**: CVR/HAR/PA/NC are schema-checkable numbers an
  Effect-native eval harness could compute against a gold subgraph — candidate for the
  agent-effectiveness evidence loop.

## Caveats

- Workshop paper, small suite (50 scenarios), self-reported; artifacts not yet released.
- Only pp. 1-2 read closely at capture time; deep read (architecture §3, metrics §5,
  correlation analysis §6) is packet research-phase work.
