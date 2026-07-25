# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## Method (2026-07-25)

A tiered mining pipeline over the 443-paper canonical corpus (see
[`research/INVENTORY.md`](./research/INVENTORY.md) for the external library
and [`research/paper-catalog.jsonl`](./research/paper-catalog.jsonl) for the
per-paper inventory):

- **T1 triage** — all 443 papers, codex `gpt-5.6-luna` (medium), 37 batches,
  schema-validated output: lens, theme, relevance (0–100), verdict.
  Result: 185 deep-read / 93 maybe / 165 catalog-only; 79 papers off-topic.
- **T2 deep-reads** — all 185 deep-read verdicts (cap lifted at the user
  checkpoint), codex `gpt-5.6-sol` at **max** reasoning, one structured note
  per paper (claims with evidence kind + quotes hard-bounded ≤ 25 words,
  repo hooks per lens with actionability class, tier).
  Result: 185/185 notes, zero failures, zero quote violations.
  Tiers: **42 gold / 125 silver / 15 bronze / 3 dross**.
- **T3 syntheses** — 7 theme clusters (memory-bitemporal 25,
  legal-ontology-design 39, legal-norms-reasoning 24,
  retrieval-citation-grounding 10, doc-structure-legal-nlp 39,
  agent-metacognition-neurosymbolic 23, agent-security-orchestration 25) +
  one repo-grounded master synthesis, codex `gpt-5.6-sol` max, repo cwd
  read-only. Reports live in [`research/`](./research/) as `t3-*.md` and
  [`research/t3-master-synthesis.md`](./research/t3-master-synthesis.md).

Prior art baseline: the June-29 prior synthesis (72 papers deep-read,
adopted as
[`research/prior-synthesis-legal-ontologies.md`](./research/prior-synthesis-legal-ontologies.md))
— this run's findings are framed as **delta** against it. Its code snippets
are errata-flagged (see the README Read-This-First prior-synthesis entry).

## External Landscape (2026-07-25)

Full findings live in the seven cluster reports and the master synthesis
under [`research/`](./research/); this section is the compressed map. The
corpus's headline is architectural, not technological: **exact records below
rebuildable semantics, and typed verdicts instead of one truth flag.** Shape
validity, retrieval rank, entailment, ontology consistency, attorney
acceptance, and action authorization are independent predicates — none
converts a contestable proposition into source truth
([master synthesis](./research/t3-master-synthesis.md), Executive verdict +
finding 1).

Per cluster (each report: verdict → design challenges → direct patterns →
corroborations → delta vs June-29 → tensions → routing):

- **[memory-bitemporal](./research/t3-memory-bitemporal.md)** (25 papers) —
  justifies a stricter split between immutable evidence and every
  interpretation of it; the bitemporal goal's core decisions are strongly
  supported. Corrections: the memory taxonomy must separate an exact
  episodic corpus from prunable semantic projections; two-axis time is not
  complete legal temporality; gate success and non-contradiction are not
  truth states.
- **[legal-ontology-design](./research/t3-legal-ontology-design.md)** (39) —
  rejects a universal legal ontology in favor of purpose-scoped modules;
  `semantic-foundation` M1 rightly stays a bounded SKOS registry/loader and
  `identity-iri-fold` stays deterministic. Stable IRIs identify records;
  they do not establish timeless meaning or legal equivalence.
- **[legal-norms-reasoning](./research/t3-legal-norms-reasoning.md)** (24) —
  the layer after SKOS is qualified legal argumentation, not "more
  ontology": attacks, defeats, and accepted conclusions are projections
  scoped to theory, proof standard, procedure, jurisdiction, and time.
  Flags `docs/product/prose-to-proof.md` as too strong where attorney
  approval "makes a candidate a fact."
- **[retrieval-citation-grounding](./research/t3-retrieval-citation-grounding.md)**
  (10) — validates candidate-first retrieval while narrowing "verified":
  exact anchoring proves which text would be emitted, never that a
  proposition is supported or currently authoritative. Next gap: a
  qualifier-aware claim-to-evidence stance layer between exact anchors and
  legal admission.
- **[doc-structure-legal-nlp](./research/t3-doc-structure-legal-nlp.md)**
  (39) — keeps both doc-structure goal slices narrow and deterministic;
  the boundary contribution is that UTF-16 text spans cover only one
  coordinate space — scanned/tabular/graphical evidence needs typed
  artifact/page-region/composite anchors as a follow-on, not a widening.
- **[agent-metacognition-neurosymbolic](./research/t3-agent-metacognition-neurosymbolic.md)**
  (23) — metacognition as a governed, typed, event-sourced control
  protocol: monitors emit non-authoritative cues; later observations decide
  whether an intervention worked; no reflection text escapes No-Escape.
- **[agent-security-orchestration](./research/t3-agent-security-orchestration.md)**
  (25) — agent security is a property of the whole typed trajectory. Five
  decisions must stay distinct: prompt admission, evidence verification,
  acceptance, action authorization, release. None implies the next.

**Delta vs the June-29 prior synthesis** (master, "Delta" section):
genuinely new — the typed-verdict decomposition, episodic/semantic layer
split, composite evidence anchors, trajectory-level agent lifecycle;
corrected — the prior synthesis's "ClaimGate admission makes the
institutional fact obtain" framing (admission is workflow status, not
substantive truth). Evidence quality is strongest as architectural
convergence and negative evidence, weakest as production validation — no
paper demonstrates the full privileged-USPTO target (master, "Honest
limits").

## In-Repo Capability Inventory

The four mining lenses map onto live repo streams (reuse targets — none
modified by this packet):

| Lens | Stream | Path | Status |
|------|--------|------|--------|
| 1 memory-bitemporal | No-Escape doctrine | `standards/memory-architecture/00-no-escape-theorem.md` | standard, binding |
| 1 | Memory layer taxonomy + agent ops | `standards/memory-architecture/01-memory-layer-taxonomy.md`, `.../06-agent-memory-operations.md` | standard |
| 1 | Bitemporal edge core | `goals/epistemic-bitemporal-edge-core/SPEC.md` | goal packet |
| 2 legal-ontology | Semantic foundation | `goals/semantic-foundation/SPEC.md` | goal packet |
| 2 | Identity as IRI | `goals/identity-iri-fold/README.md` | goal packet |
| 2 | Legal ontology landscape | `explorations/legal-ontology-landscape/` | sibling exploration |
| 3 retrieval-citation | Hybrid retrieval fusion | `goals/hybrid-retrieval-fusion-core/SPEC.md` | goal packet |
| 3 | Citation-verified spans | `goals/citation-verified-span-substrate/SPEC.md` | goal packet |
| 3 | Citation extraction | `goals/citation-extraction-engine/SPEC.md` | goal packet |
| 3 | OA doc structure | `goals/law-doc-structure-oa-slice/SPEC.md` | goal packet |
| 3 | Citation grounding prose | `docs/product/citation-grounding.md` | product doc |
| 4 agent-architecture | Prose-to-Proof | `docs/product/prose-to-proof.md` | product doc |
| 4 | Ingestion secret scrub | `goals/ingestion-secret-scrub/SPEC.md` | goal packet |

## Consolidated Routing Table

The canonical table is in the
[master synthesis](./research/t3-master-synthesis.md#consolidated-routing-table)
— **36 routes** (10 `attach-to`, 10 `extend`, 16 `new-exploration`;
15 high / 18 medium / 3 low priority), merged and deduplicated from the
seven cluster reports. Recorded, not executed (gold-intake precedent). All
18 distinct external repo paths cited by the table (plus this packet's own
self-route) were existence-verified on 2026-07-25.

The 15 high-priority routes in one line each:

| Route | Target |
|-------|--------|
| extend | `docs/product/prose-to-proof.md` — approval records scoped disposition, not truth |
| extend | `standards/memory-architecture/01-memory-layer-taxonomy.md` — split exact episodic records from prunable projections |
| attach-to | `goals/epistemic-bitemporal-edge-core` — boundary fixtures (competing lineages, qualifier-complete assessments) |
| attach-to | `goals/semantic-foundation` — CQ/asserted-entailed/OWA-CWA diagnostics without widening M1 |
| attach-to | `goals/identity-iri-fold` — negative fold fixtures; scoped reversible mappings outside the fold |
| attach-to | `goals/citation-verified-span-substrate` — verified-anchor output explicitly non-authorizing |
| attach-to | `goals/hybrid-retrieval-fusion-core` — RRF scores explicitly non-epistemic; wrong-entity diagnostics |
| attach-to | `goals/citation-extraction-engine` — preserve stage identity, ambiguity, unsupported slots |
| attach-to | `goals/law-doc-structure-oa-slice` — full-pipeline coverage/abstention evidence |
| extend | `goals/agentic-professional-runtime` — typed capabilities, decision-complete approval, outcome contracts |
| attach-to | `goals/ingestion-secret-scrub` — prove `safeForPrompt` ≠ action authorization/egress policy |
| extend | `explorations/agent-governance-control-plane` — trajectory envelopes, commitments, budgets |
| extend | `explorations/citation-grounding-hallucination-guard` — anchor-to-stance-to-authority follow-on |
| new-exploration | `agent-execution-sandbox` — default-deny execution authority + immutable execution records |
| new-exploration | `model-artifact-admission` — bind qualification to exact model/adapter/prompt/digest |

## Constraints Discovered

- **Copyright (public repo):** PDFs and full extracted texts never enter the
  repo; the external library holds them. Committed artifacts carry quotes
  hard-bounded at 25 words (enforced by the T2 validator; zero violations).
- **No canonical URLs/DOIs:** Academia.edu recommendation downloads carry no
  stable canonical identifiers; SOURCES.md rules forbid reconstructing them.
  Canonical metadata appears only where actually verified.
- **Generated-code API drift:** the prior synthesis's snippets failed
  adversarial audit (36/56 fences defective vs vendored Effect
  4.0.0-beta.101 and live `@beep/*` sources). All new pipeline outputs go
  through the same Effect-v4/beep-API verification lens at the S8 QA gate;
  treat any code sketch in `research/t3-*.md` as design intent, not
  copy-paste material, until that gate passes.
- **Quota discipline:** codex quota exhaustion pauses the pipeline
  (`ops/PAUSED` sentinel) for a human decision; the metered OpenAI API key
  is never an automatic fallback.
