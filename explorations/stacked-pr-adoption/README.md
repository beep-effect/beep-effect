# Stacked PR Adoption

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `research`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

During the 2026-10-05/06 burn-down, one fix PR (#1436) blocked about twelve
others. Lanes copied its commits instead of stacking on it, and informal
stacks onto `goals/push-first-publish` ran CI only by accident. Can GitHub's
native stacked PRs cut CI cost and give agents a clean way to express PR
dependencies?

## Next Open Question

Align: adopt native stacks by hand for dependent lanes now, with every layer
running the full matrix, or keep the ship-velocity E7 deferral until Yeet
has a stack model? Decide this together with the main-red admission hold,
which is the larger lever on the measured day. See the RESEARCH.md
recommendation and the manifest `openQuestions`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`RESEARCH.md`](./RESEARCH.md) - recommendation, Q0–Q4 answers, 2026-10-05 Heavy measurement.
3. [`CAPTURE.md`](./CAPTURE.md) - the operator's request and why-now.
4. [`research/SOURCES.md`](./research/SOURCES.md) - citations and tool licenses.
5. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - friction receipts.

## Trail

- 2026-10-05: packet opened. It is a new packet because both earlier homes
  have graduated: `agent-pipeline-velocity` and `beep-ci-operational-ontology`
  have status `graduated`, and the ship-velocity goal that ran the E7/E8
  stack and merge-queue trial closed on 2026-09-02. Their stacking rulings
  are cited as inputs to align, not edited. Capture and research landed in
  the same session; stage `research`, ready for align.
