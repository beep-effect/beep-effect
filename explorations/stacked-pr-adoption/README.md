# Stacked PR Adoption

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `align`
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

Run the supervised native-stack test (decision `stack-test-shape`): three
layers on a probe file, L1 merged alone, L2 and L3 merged from the top
through the async merge endpoint. Record every fact in
`research/stack-test-2026-11.md`.

Then, in align, with the results:

- Is porting `yeet merge-gate` to `merge-async` worth a standalone PR? It
  is the shared first step for stacks and for the merge queue.
- Does the rest of the Yeet stack slice (stack linking, a stack-level ready
  verdict, the review window on a cascade) earn a goal packet, given that
  a stack fits 8 of the 12 dependency structures seen in 14 days?
- Does the health half of `stacks-reopen-gate` still gate routine use?

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`DECISIONS.md`](./DECISIONS.md) - the 2026-11-09 reground rulings, then the 2026-10-13 align rulings they amend.
3. [`RESEARCH.md`](./RESEARCH.md) - the 2026-11-09 reground, then the 2026-10-13 refresh and the 2026-10-05 recommendation, Q0–Q4 answers and Heavy measurement.
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
- 2026-11-09: regrounded after four weeks parked. Demand is met (5 and 7
  live chains a week) and `main` health is just short (73.6% against 80%);
  a Check run now costs about 400 hosted runner-minutes and queues for
  minutes. One grill round settled three rulings: the packet reopens at
  align and the stack test runs now, in a three-layer shape; ruling B3's
  "or stacked" is struck, so the Yeet skill's non-`main`-base ban is the
  only doctrine; the automated main-red hold is retired. The inherited-red
  figures went to `explorations/github-merge-queue`. Stage loop: align to
  research (the test) and back.
