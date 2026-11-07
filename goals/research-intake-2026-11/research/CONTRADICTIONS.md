# Research intake 2026-11 — Contradictions and evidence gaps

T3 synthesis by the orchestrating session over the routed catalog
([`ROUTING.md`](./ROUTING.md)). A cluster is a set of findings on one claim
where the readings disagree, or where the only support is a claim its own
source does not measure. Each cluster is either **resolved from captured
evidence** (stated here, no new research) or an **evidence gap** (needs sources
the intake did not hold, so it gets one `/deep-research` run). Counts are routed
findings with negative relations (`critiques`, `disputes`, `disagreesWith`)
against affirmative ones; examples cite public sources only.

## Evidence gaps (deep research)

### G1. Does ontology grounding beat retrieval at a matched context budget?

- **Packets:** `goals/agent-outcome-experiments` (the experiment design),
  `goals/legal-document-intake` (its ClaimGate is where answer validity is
  checked), `explorations/semantic-agent-graph-stack`. The topic router also
  sent G1 rows to `goals/verification-route`, but that packet builds CI
  verification footprints and checks no answers, so the recommendation does not
  belong there.
- **Disagreement:** several captures report that injecting an ontology or a
  knowledge graph improves agent answers over RAG, but the strongest one
  (arXiv 2604.00555) injects about 2,800–3,200 tokens of structure against about
  2,000 for RAG, so structure and context volume are confounded. Its OWL validity
  criterion ("the response's negation is not entailed") is too weak under
  open-world semantics to show support.
- **Gap:** no captured source compares ontology-grounded and retrieval-grounded
  prompting at an equal token budget, or uses an entailment-based (not
  non-contradiction) validity test.

### G2. Do legal research benchmarks measure recall of responsive authority?

- **Packets:** `goals/effect-native-legal-eval` (31 / 153),
  `goals/citation-extraction-engine`, `goals/uspto-prosecution-read`.
- **Disagreement:** benchmark papers score recall against the citations of one
  opinion (arXiv 2605.10186 Cat1/Cat2), while their own human audits concede that
  unmatched authorities can be real and responsive, without reporting the audit
  sample. Vendor pages (for example the DeepIP prosecution product) quote
  efficiency and allowance-rate gains with no study design, comparison group or
  workload definition.
- **Gap:** an evaluation design (or published dataset) that grades responsive
  authority rather than overlap with one opinion, and any independently measured
  allowance-rate or time-saving result for AI prosecution tools.

### G3. Do skill or prompt edits preserve mastered behavior?

- **Packets:** `goals/coding-agent-effectiveness-evidence-loop` (23 / 213),
  `goals/agent-rating-critique-fixes`, `goals/skillopt-training-pilot` (parked
  rows), `goals/agent-pool-doctrine`.
- **Disagreement:** skill-optimization and harness posts report aggregate gains;
  critiques in the same captures note that aggregate improvement does not show
  item-level regressions are absent (arXiv 2609.36043), that cross-harness
  benchmark charts are not controlled comparisons, and that a governed-skills
  evaluation measured the infrastructure workflow rather than agent outcomes
  (arXiv 2606.16523).
- **Gap:** controlled, same-harness, item-level studies of skill or prompt edits
  that report regressions alongside gains.

## Resolved from captured evidence

### R1. Text-to-SPARQL and datalake agents: completion is not correctness

arXiv 2609.17107 reports completion separately from correctness, its Table II
contradicts the later summary, its token comparison uses different successful
subsets per backend, and its repair loop can edit SELECT/GROUP BY but not a wrong
retrieval condition. The captured paper is enough: `goals/agent-outcome-experiments`
should treat its numbers as upper bounds on completion, not on answer validity.

### R2. Policy-as-code versus evidence-graph compliance

`goals/agentic-governance-laws` (13 / 103). arXiv 2605.23297 argues that
documentation-centric compliance records claims rather than checking emitted
evidence, and that engines such as OPA evaluate syntactic state, not
provenance-linked evidence. Practitioner captures note that deterministic
enforcement does not make the interpretation correct. These agree; the packet's
direction (executable checks over emitted evidence, human interpretation review)
stands without new research.

### R3. AI patent drafting and claim-check accuracy figures

`goals/claim-check-performance` (10 / 86), `goals/patent-drafting-episode-ledger`.
Vendor accuracy percentages (for example a 36%→98% accuracy claim) come without
question counts, scoring or ground truth. Academic captures (arXiv 2509.07860)
evaluate narrow scopes: cover pages from a single applicant, unreleased data.
The captured evidence already says what the packets need: no published accuracy
figure is usable as a baseline, so the packets' own measured gates stay the only
admissible numbers.

### R4. Benchmark reporting inconsistencies in single papers

Several critiques are internal to one paper (arXiv 2609.15779 says four
backbones in the abstract and uses six in the tables; arXiv 2609.09156 imposes
one citation per sentence while its own examples place several). These are
recorded on the findings and need no cross-source synthesis.

## Private partition

Contradictions involving private-partition findings are counted in the
packet totals above but not described here.

## Deep-research receipts

Three runs, one per evidence gap, sequential, each through the
`anthropic-skills:deep-research` skill in a separate Claude Opus 5.5 session.
Reports, claims (`confirmed` / `refuted` / `unresolved`, each with source and
quote) and harness receipts are in [`deep-research/`](./deep-research/).

| Cluster | Report | Confirmed | Refuted | Unresolved | Verdict |
| --- | --- | ---: | ---: | ---: | --- |
| G1 | [ontology vs RAG](./deep-research/G1-ontology-vs-rag.md) | 9 | 2 | 2 | No study shows ontology grounding beating RAG at a matched budget; the closest ones confound structure with context volume or lose the gain when tokens match. |
| G2 | [legal eval validity](./deep-research/G2-legal-eval-validity.md) | 13 | 2 | 3 | Legal citation benchmarks measure overlap with one opinion's citations, not recall of responsive authority; AI prosecution gains are vendor-reported. |
| G3 | [skill-edit regressions](./deep-research/G3-skill-edit-regressions.md) | 8 | 8 | 1 | Skill and prompt edits do not reliably preserve mastered behavior; aggregate gains coexist with item-level breakage. |

These results are evidence, not acceptance changes. The owning packets
(`agent-outcome-experiments`, `legal-document-intake`, `effect-native-legal-eval`,
`citation-extraction-engine`, `uspto-prosecution-read`,
`coding-agent-effectiveness-evidence-loop`, `agent-rating-critique-fixes`,
`agent-pool-doctrine`) carry routing amendments that point here.
