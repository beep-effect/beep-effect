# Academia Corpus Mining

## Status

Stage: `align`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

519 research PDFs landed in `~/Downloads/research-7-24-26` from Academia.edu
interest recommendations — two waves (June 29: LLM agents, memory,
metacognition, neuro-symbolic, document understanding; July 24–25: legal
ontologies, AI-and-law). With five non-PDF papers that is 524 files,
normalized to **443 canonical papers** (the early "444 unique titles" figure
was the preliminary filename estimate). Mine them against the repo's live
work streams and land the intelligence here for later goal graduation.

## Next Open Question

Wave 2 (deferred, parked revival trigger once the dispatch fully lands):
run the approved second mining pass over the June-29 ~240-paper backlog,
starting with the 97 legal-NLP/extraction papers. Everything else is
decided or explicitly deferred into routed targets — see the nine align
entries in [`DECISIONS.md`](./DECISIONS.md).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - method, per-cluster findings map, capability inventory, high-priority routes.
4. [`research/t3-master-synthesis.md`](./research/t3-master-synthesis.md) - repo-grounded master synthesis: ten findings, 36-route table, 13 align questions. Cluster detail in `research/t3-*.md`.
5. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
6. [`research/prior-synthesis-legal-ontologies.md`](./research/prior-synthesis-legal-ontologies.md) - June-29 prior synthesis (72 papers deep-read), adopted as prior-art anchor. **ERRATA WARNING (2026-07-25):** its code snippets are NOT safe to copy — 36 of 56 TypeScript fences carry verified defects (removed Effect-v4 APIs, invented `@beep/*` symbols, a falsely-claimed publication gate). Read [`reviews/2026-07-25-codex-prior-synthesis-snippet-audit.md`](./reviews/2026-07-25-codex-prior-synthesis-snippet-audit.md) first; the file itself stays byte-identical because the audit and the prior-72 reconstruction cite its exact line numbers.
7. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
8. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-25 (align): interview closed nine decisions (see DECISIONS.md
  align entries) — dispatch all 15 high-priority routes as bounded notes +
  2 new capture packets (`agent-execution-sandbox`,
  `model-artifact-admission`); replace prose-to-proof fact language
  (separate PR); belief views first over the bitemporal core;
  argumentation first after M1; one metacognition protocol; wave 2 (97
  legal-NLP papers) approved-deferred; packet parks after dispatch.
  Stage → `align`; 11 dispatch notes landed in target packets.
- 2026-07-25 (close): S8 QA gate passed — adversarial codex review
  ([`reviews/2026-07-25-codex-research-qa.md`](./reviews/2026-07-25-codex-research-qa.md))
  verdict FIX-THEN-SHIP: zero Effect-v4/`@beep/*` defects, zero copyright or
  provenance violations, all counts verified exact; 3 documentation-contract
  findings (corpus-count provenance, catalog header contract, path-count
  off-by-one) fixed same session.
- 2026-07-25 (evening): T2 + T3 complete → stage `research`. 185 Sol-max
  deep-reads (42 gold / 125 silver / 15 bronze / 3 dross, zero quote
  violations); 7 cluster reports + repo-grounded master synthesis landed in
  `research/`; RESEARCH.md finished (per-cluster map, 36-route table — 15
  high-priority); manifest openQuestions rewritten from the master's 13
  align questions.
- 2026-07-25 (later): snippet audit landed — 36/56 fences defective, 13
  findings (7 foundational); errata banners added at entry points, synthesis
  kept byte-identical (see DECISIONS.md). T2 deep-reads running (185 papers,
  Sol max).
- 2026-07-25: packet opened; grilling closed 7 decisions (see DECISIONS.md);
  prior June-29 synthesis adopted into `research/`; S0–S2 + T1 triage
  complete (443 papers: 185 deep-read / 93 maybe / 165 catalog-only);
  external normalized corpus library established at
  `~/YeeBois/research/academia-2026-07/` (public repo — no copyrighted
  PDFs/full texts committed here).
