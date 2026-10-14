# Stacked PR Adoption

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `align`
Status: `parked`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

During the 2026-10-05/06 burn-down, one fix PR (#1436) blocked about twelve
others. Lanes copied its commits instead of stacking on it, and informal
stacks onto `goals/push-first-publish` ran CI only by accident. Can GitHub's
native stacked PRs cut CI cost and give agents a clean way to express PR
dependencies?

## Next Open Question

None while parked. The packet reopens when either trigger in
[`DECISIONS.md`](./DECISIONS.md) fires:

- `stacks-reopen-gate`: `main` required-green at least 80% of the time over
  14 days, and at least 3 live dependency chains a week. The first step is
  the supervised two-layer stack test.
- `automated-hold-trigger`: unblocker starvation or inherited-red waste over
  the measured thresholds, or S11 ending.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`DECISIONS.md`](./DECISIONS.md) - the 2026-10-13 align rulings and re-entry triggers.
3. [`RESEARCH.md`](./RESEARCH.md) - 2026-10-13 refresh, then the 2026-10-05 recommendation, Q0–Q4 answers and Heavy measurement.
4. [`CAPTURE.md`](./CAPTURE.md) - the operator's request and why-now.
5. [`research/SOURCES.md`](./research/SOURCES.md) - citations and tool licenses.
6. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - friction receipts.

## Trail

- 2026-10-05: packet opened. It is a new packet because both earlier homes
  have graduated: `agent-pipeline-velocity` and `beep-ci-operational-ontology`
  have status `graduated`, and the ship-velocity goal that ran the E7/E8
  stack and merge-queue trial closed on 2026-09-02. Their stacking rulings
  are cited as inputs to align, not edited. Capture and research landed in
  the same session; stage `research`, ready for align.
- 2026-10-13: align settled in one `/grill-with-docs` session across 14
  decisions. Native stacks are deferred behind a health-and-demand gate, and
  a written dependent-lane rule replaces them. The main-red hold becomes a
  doctrine-only unblocker rule (`unblocks-main`). S11 stands repo-wide with a
  same-day fix deadline. The Coverage Regression and Lint Policy cost goes to
  ci-lane-economics. The doctrine landed in AGENTS.md and in the orchestrate
  and Yeet skills. A standalone Yeet PR fixes the PR-creation base. Packet
  parked.
- 2026-10-14: after operator ruling S23 ("I want things done"), the
  executable residue landed. The S11 ready-fallback sentences in the
  orchestrate and Yeet skills now require every review thread answered and
  use the guarded `yeet gh pr ready`, as promised on a #1619 thread. The
  non-required Heavy lanes finding is now in
  `goals/ci-lane-economics/research/OPPORTUNITIES.md`. Everything else in
  the packet waits on its re-entry gates.
