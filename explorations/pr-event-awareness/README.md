# PR Event Awareness for Orchestrating Agents

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `capture`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

An orchestrating agent babysitting a PR should know within seconds when the
PR goes conflicted, a review comment lands, or a CI job fails, and should be
able to hand each actionable event to a fixer lane as it drops. During the
time-to-certainty C3 closeout train the operator was that notification path
three times.

## Next Open Question

What is the measured end-to-end latency today from a GitHub event to the
owning session acting on it through `yeet monitor --watch` → inbox → hook,
and which of the three gaps it leaves (push source, idle wake, lane dispatch)
is the binding one? Answering that is the first research task; it decides
whether the seconds target needs a webhook source at all.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger, pre-seeded with the verified in-repo bricks.
4. `RESEARCH.md` - prior art + capability inventory (stage 1, not yet present).
5. `DECISIONS.md` - grilling log (stage 2, not yet present).
6. `BRIEF.md` - shaped pitch (stage 3, not yet present).
7. `MAP.md` - decomposition (stage 4, not yet present).

## Trail

- 2026-09-12: packet opened from the C3 closeout session. Captured the
  operator's spark and proposal (webhook → proxy → message to the PR-owning
  session → sub-agent fan-out), the orchestrator's assessment, the evidence
  from the #1102/#1126/#1130/#1131 train, and a live-checkout inventory
  showing that the ship-velocity A1–A4 bricks already cover polling,
  transition typing, inbox convergence, wave coalescing, and owner lookup.
  The reframed gap is push source + idle wake + lane dispatch. Capture is
  complete enough to start research; the operator does not want this built
  immediately.
