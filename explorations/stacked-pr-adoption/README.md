# Stacked PR Adoption

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

During the 2026-10-05/06 burn-down, one fix PR (#1436) blocked about twelve
others. Lanes copied its commits instead of stacking on it, and informal
stacks onto `goals/push-first-publish` ran CI only by accident. Can GitHub's
native stacked PRs cut CI cost and give agents a clean way to express PR
dependencies?

## Next Open Question

None. The packet graduated on 2026-11-10 into
[`goals/yeet-async-merge-and-stacks`](../../goals/yeet-async-merge-and-stacks/README.md).

It reopens at decompose when one of the gated candidates in
[`MAP.md`](./MAP.md) fires:

- merge-queue routing, when `explorations/github-merge-queue` meets its
  flip condition;
- Heavy on the lowest unmerged layer only, once stacks are routine;
- a dependency edge for joins and fans, if the goal's pilot shows they
  still matter.

The goal's pilot also reports back here: it settles whether GitHub restacks
a partially merged stack when its trunk moves.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`BRIEF.md`](./BRIEF.md) and [`MAP.md`](./MAP.md) - the shaped pitch and its decomposition into one goal and three gated candidates.
3. [`research/stack-test-2026-11.md`](./research/stack-test-2026-11.md) - the native-stack test of 2026-11-10.
4. [`DECISIONS.md`](./DECISIONS.md) - the 2026-11-09 and 2026-11-10 rulings, then the 2026-10-13 align rulings they amend.
5. [`RESEARCH.md`](./RESEARCH.md) - the 2026-11-09 reground, then the 2026-10-13 refresh and the 2026-10-05 recommendation.
6. [`CAPTURE.md`](./CAPTURE.md) - the operator's request and why-now.
7. [`research/SOURCES.md`](./research/SOURCES.md) - citations and tool licenses.
8. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - friction receipts.

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
- 2026-11-10: the stack test ran and passed. Three probe layers (#3049,
  #3050, #3051) landed through the async merge endpoint, layer 1 alone and
  layers 2 and 3 together, with no force-push by the lane. Every blocker it
  found is in Yeet. Two more grill rounds settled the next step and the
  shape; `BRIEF.md` and `MAP.md` were written and the packet graduated into
  `goals/yeet-async-merge-and-stacks`. Stage path: align, research (the
  test), align, shape, decompose, graduate.
