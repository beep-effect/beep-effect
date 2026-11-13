---
title: "First main closure-gate runs after #3145 failed before the digest comparison"
date: 2026-11-13
kind: checkpoint
lane: "fix/ci-binary-closure-ev010"
pullRequest: 3165
reversal: "Revert #3165's squash commit; the release workflow then fails at the closure step again and the closure test needs its EV010 inventory row back."
---

#3145 merged as 87c4dc204c8 on 2026-11-13. The first four `Beep CI Binary` runs on main after it failed in "Compare the closure digest with the latest release" with `Missing required flag: --list` (job 131612442366 and siblings): runs 43342046581, 43342105606, 43342142443 and 43342189531, on main pushes 87c4dc204c8 through d1c7c6cb63f. `beep ci binary-closure` declared `--list` as a boolean flag without a default, so the CLI required it, and the workflow calls the command with `--out` only. Every run stopped before compile, so no release was cut and the pinned binary at `.github/actions/fetch-beep-ci/action.yml` was never affected. The two runs before #3145 (61ac4497363, f3cd33a2969) passed on the old path trigger.

These runs therefore say nothing yet about closure skips: none reached the digest comparison. #3165 gives `--list` a default of false and adds `ci-binary-closure-command.test.ts`, which runs the workflow's exact `--out`-only invocation through the registered command (red without the default, green with it). The same command with the default in place exits 0 in about 3 s and writes a 345-file closure JSON. In the same PR, `ci-binary-closure.test.ts` resolves the checkout root with `fs.realPath` inside each test, which satisfies EV010 without the inventory row #3145 added (S31). The first main push after #3165 publishes the first digest-recording release; the closure-skip reading is the main push after that whose closure is unchanged.
