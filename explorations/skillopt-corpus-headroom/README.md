# SkillOpt Corpus Headroom

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `capture`
Status: `parked`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The harness-evidence-ledger rerun showed that the SkillOpt corpus cannot
separate a better skill from noise at Opus 5.5. Automated skill training needs
a corpus with headroom before another run is worth its quota.

## Next Open Question

What corpus gives a measurable gap at the current target model: more
validation items, harder tasks, or both? Parked until the operator asks for
skill training again or a new model release changes the baseline.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the evidence and the prerequisites for a next run.
3. [`DECISIONS.md`](./DECISIONS.md) - why the packet is parked.

## Trail

- 2026-10-01: packet opened and parked from the harness-evidence-ledger close
  (PR #1362).
