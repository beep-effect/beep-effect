# Agent-Legible Verification Output

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Agents read test, check, lint, build and CI output through a guessed `tail` or `grep`,
because no gate owns the shape of its answer. A seven-day census measured the cost, and
vitest-agent showed a design worth porting and widening beyond Vitest.

## Next Open Question

None. Graduated 2026-11-18 into six goal packets: `goals/gate-output-switch-on`,
`goals/agent-output-census`, `goals/gate-report-core`, `goals/gate-run-history`,
`goals/gate-report-rollout` and `goals/ci-gate-reports`. The first three start at once.
Reopen at `decompose` only if a new gate kind appears that the model cannot express.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-11-18: packet opened from an operator question; transcript census, vitest-agent source
  study, in-repo inventory and landscape sweep written; two grill rounds and a shape review
  settled; map decomposed; six goals graduated the same day.
