# Epistemic Contradiction Detection

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Contradictions have a judge but no detective. `goals/epistemic-contradiction-triage`
ships the adjudication surface and assumes candidates arrive already-found;
nothing in the tree finds them. This packet is the producer: deterministic,
model-free detection of typed direct conflicts, emitted against triage's
already-shipped `ContradictionCandidate` contract. **Detection proposes; triage
disposes.**

Graduated 2026-08-06 from
[`explorations/graphnosis-prior-art`](../../explorations/graphnosis-prior-art/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/epistemic-contradiction-detection/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth, including the Open
   Contract Question P0 must settle.
3. [`PLAN.md`](./PLAN.md) - active execution plan, P0-P4.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger,
   back-linked to the source exploration.
6. [`history/`](./history/) - evidence and closeouts, once they exist.

## Current Phase

P0 Research — not started. Next concrete action: re-verify the `file:line`
citations in [`SPEC.md`](./SPEC.md) against the live tree, then answer the Open
Contract Question (where conflict class rides on the shipped contract) on the
record before any schema is written.

## Provenance

Back-links, not copies:

- [`explorations/graphnosis-prior-art`](../../explorations/graphnosis-prior-art/README.md)
  is the source exploration. This packet is **packet A** of its two graduations
  ([`BRIEF.md`](../../explorations/graphnosis-prior-art/BRIEF.md) §Problem A,
  §Solution Sketch A); the decision that carved it out is **Q1** in
  [`DECISIONS.md`](../../explorations/graphnosis-prior-art/DECISIONS.md)
  (2026-08-06), with **Q6** (determinism ships with golden vectors) and **Q9**
  (modality is belief-view revision's vocabulary) shaping its contents.
- [`goals/epistemic-contradiction-triage`](../epistemic-contradiction-triage/README.md)
  is the downstream consumer and the owner of the contract this packet produces
  against: `ContradictionCandidate`, `ContradictionAssessment`,
  `ContradictionMatchBasis`, all shipped in
  `packages/epistemic/domain/src/{values,entities}/Contradiction/`.
- [`explorations/epistemic-belief-view-revision`](../../explorations/epistemic-belief-view-revision/README.md)
  owns the MATRES modality vocabulary this packet consumes. It is at **capture**
  stage; this packet does **not** block on it.

## Latest Evidence

Not started.

## Notes

High-signal constraints that do not belong in the normative spec:

- **The boundary is one-way.** Triage's stop-and-re-scope clause
  (`goals/epistemic-contradiction-triage/SPEC.md:138-139`) stays law. This
  packet exists to answer that clause, not to relax it — and triage has not
  closed (P2 verify in flight), which is one more reason v1 produces against
  the shipped schema instead of extending it.
- **Confidence is a constant, not a score.** The shipped
  `ContradictionAssessment` requires `confidence`, and v1 satisfies it with a
  documented per-class constant. The moment a tuned threshold or similarity
  score appears in a design doc, scope has escaped.
- **The modality default is a deliberate false-positive admission.** Absent
  modality means `comparable`, so a hypothetical can be flagged against a
  factual. That is acceptable *only* because every candidate lands in human
  triage. Do not "fix" it by inventing a taxonomy here — the vocabulary is
  belief-view revision's per Q9. Cite Ning et al. 2018 (MATRES).
- **Quarantine travels.** No donor (Graphnosis) or Chronocept quantitative
  results appear in this packet's prose; clean-room only, per
  [`explorations/graphnosis-prior-art/research/SOURCES.md`](../../explorations/graphnosis-prior-art/research/SOURCES.md).
