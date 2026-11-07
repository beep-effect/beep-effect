# Research intake 2026-11 — ADHD follow-on portfolio

- **Date:** 2026-11-07
- **Skill:** `adhd`, run once. Five isolated divergent branches with six ideas
  each, scored and clustered in the parent session, then three isolated focus
  branches on the top survivors.
- **Model:** `claude-opus-5-5` for the parent and every branch.
- **Frames:** regulator, competitor trying to break it, inversion, logistics,
  biology (the wild frame).
- **Question:** given the routed evidence catalog, which follow-on candidates
  should graduate into new exploration or goal packets? These would be work the
  catalog justifies but no live packet owns.
- **Inputs:** [`ROUTING.md`](./ROUTING.md),
  [`CONTRADICTIONS.md`](./CONTRADICTIONS.md),
  [`deep-research/`](./deep-research/) (G1–G3 reports and claims), and
  [`routing.jsonl`](./routing.jsonl). Row ids below are abbreviated to their
  last segment. Search `routing.jsonl` for the suffix to find the full row.

The 30 ideas fell into six clusters:

- parked-evidence returns (five branches);
- behavioral equivalence of routes and model bumps (five);
- firm-side prosecution AI-use capture (four);
- judge independence (two);
- ontology-grounding validity (four);
- legal relevance pooling (three).

Ownership was checked against packet status in `ops/manifest.json` and against
the SPEC and GOAL text of each candidate owner.

## Surviving candidates

Weighted score: novelty 0.35 + viability 0.40 + fit 0.25. ★ marks the pick
that is not obvious but is viable.

| # | Candidate | Thesis | Evidence | Home | Kind | First experiment |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Matched-budget grounding pilot | Before the product invests in ontology or KG context assembly, test whether structure beats retrieval at equal tokens. Only the temporal, comparison and role strata are likely to show a difference. | [G1 verdict and implications](./deep-research/G1-ontology-vs-rag.md#verdict); [G1 claims](./deep-research/G1-claims.jsonl); routed 2604.00555 rows `…11b2b92:1` (citesAsEvidence, evidence loop) and `…11b2b92:2` | New packet. The G1 implication went to `agent-outcome-experiments`, which is paused and scoped to Phoenix route outcomes (its SPEC line 40). `lejeune-demo-corpus-and-ontology` owns the frozen corpus but refuses scope beyond fixtures. `legal-document-intake` D6 assumes graph grounding without testing it. `explorations/semantic-agent-graph-stack` is still choosing its first consumer. | goal (bounded pilot) | On the LeJeune bundle, generate about 50 template questions per stratum from source spans, not graph paths. Build a serializer for the triples, prose, permuted and truncated arms, and commit token counts matched within ±2% under one tokenizer before any model call. |
| 2 ★ | Prosecution AI-use ledger | Starting now, record which AI tool touched which claim and argument in each office-action response, with examiner and art unit frozen from the official record. Allowance and time effects can only be measured later if the record exists, and it cannot be backfilled. | [G2 prosecution findings and implications](./deep-research/G2-legal-eval-validity.md#goalsuspto-prosecution-read); [G2 claims](./deep-research/G2-claims.jsonl); vendor rows `…1771:0`, `…1771:3` (uspto-prosecution-read, discusses) and `…1771:2` (parked under closed `law-practice-office-action-spike`) | New packet. `uspto-prosecution-read` is a read-only driver and excludes law-practice overlays (its SPEC lines 31–33). `patent-drafting-episode-ledger` (paused) is pre-filing only and has no office-action, examiner or tool-identity fields. The G2 implication names the need but gives it no owner. | exploration | Write the schema `ProsecutionResponseEpisode`, with a `LiteralKit` touch extent (`none, suggested, drafted, attorney-edited, unknown`) and a frozen covariate snapshot. Then check with `rg` whether `@beep/uspto` already decodes examiner name and group art unit. Before any analysis is built, estimate statistical power from the firm's own yearly volume of office actions. |
| 3 | Judge lineage and calibration | A cited LLM-judge score should carry the judge's model lineage and the subject's lineage, and should be admissible only after a measured κ against human labels. The repo's own `qa.judge` (`claude-opus-5-5`) grades Claude-orchestrated work, which is the same-lineage case. | [G1 implications](./deep-research/G1-ontology-vs-rag.md#goalsagent-outcome-experiments) (judge outside the family plus a κ sample); [G2 implications](./deep-research/G2-legal-eval-validity.md#goalseffect-native-legal-eval) (validate the judge against lawyer labels); rows `…46cebd8372:7` (2605.10186 depends on LLM judging), `…8a013:5` (2610.37242: LLM second annotator saw the machine labels) and `…1515:4` (2610.00609: judge vs human agreement) | New packet with four consumers. `effect-native-legal-eval` owns a typed judge service but has no lineage or κ gate. `skill-contract-gate-certificates` owns the QA judge certificate, but its scope is parity, not validity. `agent-outcome-experiments` calibrates human annotations, not judges. `agentic-governance-laws` has no judge content. | exploration (grill first) | Write a `ModelLineage` LiteralKit projected from the tool-owned model manifest, plus `JudgeProvenance { judgeModel, judgeLineage, subjectModel, subjectLineage, relation }`. Add it as an optional field on the QA judge certificate. A fixture with a Fable subject and an Opus judge must report `same-lineage`. |

### Notes on the survivors

1. **Grounding pilot.**
   - *Decision it changes:* whether `legal-document-intake` D6 and the
     semantic-agent-graph-stack consumer pick should build KG context
     assembly. The alternative is to ship retrieval plus a claim-level
     entailment check and keep the KG as a projection for provenance and
     rules.
   - *Load-bearing risk:* the LeJeune corpus is small and synthetic, so the
     ontology arm can end up grading its own homework. Pre-register the pilot
     as able only to kill the hypothesis or license a second run on a
     `legal-document-intake` KG slice built from filed or public patent
     material. It can never confirm a product claim on its own.
   - *Children:*
     - Measure the open-world unknown rate on the no-context and RAG outputs
       before building the ontology arm.
     - Keep the relation-permuted ontology as a standing canary: a
       graph-grounded feature must beat its permuted twin at equal tokens.
     - Emit results as Phoenix experiment rows, so a resumed
       `agent-outcome-experiments` inherits a first experiment that is not
       about routes.
2. **Prosecution ledger.**
   - *Load-bearing risk:* volume and selection. A solo firm files dozens of
     responses a year across many examiners, and the attorney chooses AI help
     by difficulty. Treat any missing row as `unknown`, never as "no AI".
     Have tools emit touch events themselves, so the attorney marks only
     outside tools.
   - *Value before any statistics:* the same rows yield a candor and audit
     report of which AI touched which argument and whether it was reviewed.
   - *Children:*
     - Randomize assisted versus unassisted drafting for arguments of similar
       difficulty within a response.
     - Store a checksummed covariate freeze, so that later drift in the
       USPTO's Open Data Portal (ODP) records cannot rewrite history.
3. **Judge lineage.**
   - *Load-bearing risk:* the supply of human labels. The firm has one
     attorney and expert κ is about 0.52, so a small calibration slice either
     blocks every legal score or turns into a rubber stamp.
   - Set the admission margin relative to the attorney's own test-retest κ,
     measured on a set double-labelled weeks apart, not as a fixed number.
   - Resolve proxied and Cursor routes by observed model identity, never by
     route name.
   - Open policy question for the grill: should vision QA get a recorded
     same-lineage waiver, or a cross-lineage second judge (Sol or Grok) on a
     sampled subset?

## Pruned candidates

| Candidate | Reason pruned |
| --- | --- |
| Responsive-authority legal eval design (TREC-style pooling, two lawyer judges, bpref/infAP, "fabricated" kept separate from "real but unmatched") | **Owned.** `goals/effect-native-legal-eval` (paused, live) owns the judge service and the rubrics, and the [G2 implications](./deep-research/G2-legal-eval-validity.md#goalseffect-native-legal-eval) are addressed to it with a routing amendment. Its first step on resume: an attorney audit of a small sample of 2605.10186 outputs for the unreported category (iv) rate (row `…46cebd8372:5`). |
| Firm-local qrels pool built from the attorney's filed work in batched "germinal centre" rounds | **Trap.** The TREC Legal design needs at least two assessors and an adjudicating topic authority. A solo firm has one, and expert κ is about 0.52, so single-rater qrels would be called ground truth when they are not. If the legal eval packet resumes, use it as a calibration slice for candidate 3, not as truth. |
| Item-level regression gate for skill and prompt edits (mastered suite, NFR, exact McNemar test) | **Owned.** `goals/coding-agent-effectiveness-evidence-loop` (active) owns the held-out paired eval corpus (its SPEC line 178), and the [G3 implications](./deep-research/G3-skill-edit-regressions.md#goalscoding-agent-effectiveness-evidence-loop) tell it to add the mastered suite and to grow the 12-task corpus. Row `…da8a2be3b:0` is routed there. A new packet would split the corpus that the gate depends on. |
| Behavioural-equivalence certificate for fallback routes (Opus, Sol, Cursor, Grok) and for model or harness bumps | **Owned, and a trap if it runs alone.** `goals/agent-pool-doctrine` (active) carries the [G3 implication](./deep-research/G3-skill-edit-regressions.md#goalsagent-pool-doctrine). Without the evidence loop's mastered corpus, four routes × k ≥ 5 repeats spends quota to measure noise, because run-to-run variation is 2–6 pp. It should consume the evidence loop's gate when that gate exists. |
| Gated deep read (T2) of the legal-ontology pile, 379 PDFs selected at T1 | **Gated, with a live trigger.** This packet's SPEC already re-points the trigger: it fires when `goals/legal-document-intake` or a live successor of the graduated legal-ontology explorations names the pile in its plan. Firing it now produces readings with no consumer. The useful refinement, which is to pull only the PDFs a plan step names in batches sized to that step, belongs to whoever fires the trigger. |
| Parked-findings returns desk (re-adopt or tombstone the 5,118 parked rows) | **Owned by this packet, and a trap as a manual sweep.** Parking is the designed disposition, and the generator re-derives rows when packets change state. The real defect is that rows parked under a *graduated* exploration (for example 174 under `citation-grounding-hallucination-guard`) are not routed to the goal it graduated into. Fix that inside the `research-intake-2026-11` router as a successor-resolution rule. Do not re-triage the rows by hand. |
| Cross-dock consolidation of the parked `provenance-shared-claim-kernel` and `practice-kg-mcp` findings onto `citation-extraction-engine` | **Trap.** Both owners are closed, and their findings are retained evidence. Forcing them onto an unrelated active packet would add misrouting. The successor rule above covers any legitimate destination. |
| Routing scope-fit gate, or router-poisoning audit | **Owned by this packet.** The defect it targets is real: the [G1 implications](./deep-research/G1-ontology-vs-rag.md#goalsverification-route) address `goals/verification-route`, which builds CI footprints and has no answer-verification role. That is a correction to `CONTRADICTIONS.md` and the G1 report in this lane, not a new packet. |
| Open-world validity gate: entailment support labels, unknown rate, adversarial fixtures that pass "negation not entailed" | **Owned.** `goals/legal-document-intake` (active) owns the critic-loop ClaimGate on the `@beep/shacl` driver (decision D7-S1 in its SPEC). Its target was mislabelled `verification-route`. Route the G1 validity implications to the ClaimGate, with the exploit fixtures as its test corpus. |
| SHACL closed-world completeness checks as the validity test | **Trap as stated.** [G1](./deep-research/G1-ontology-vs-rag.md#goalsverification-route) says SHACL conformance is a shape check, not a support check. Swapping one non-support test for another repeats the original error. Completeness belongs beside entailment in the ClaimGate, not in place of it. |
| Selective ontology on temporal and comparison questions only ("myelin") | **Merged.** This is the stratified design of survivor 1 and depends on its pilot result. It is not a separate packet. |
| Parked-finding refusal ledger with reason codes and expiry | **Owned and duplicative.** Every parked row in `routing.jsonl` already has a reason and a re-entry trigger. Expiry dates would add bookkeeping without changing any decision. |

## Fixes found in this lane, not packets

Two defects surfaced. Neither became a packet. The lane owner should fix both
here:

- The G1 implications are addressed to `goals/verification-route`, which has no
  answer-verification role.
- Rows parked under graduated explorations are not resolved to their successor
  goals.

## Lane follow-up (2026-11-07)

Both defects noted above were fixed in the same lane: `CONTRADICTIONS.md` now
addresses G1 to `agent-outcome-experiments` and `legal-document-intake`, and
findings parked under a graduated exploration route to its first live successor
goal (`ROUTING.md`, Method).
