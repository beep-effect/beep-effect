# Opportunities & friction receipts

## 2026-10-05 — hosted queue saturation expires the monitor's settle budget

- **Doing:** babysitting PR #1420 (docs-only) with `yeet monitor --until-ready --detach`.
- **Evidence:** at 20:50Z the `Check` workflow was `queued`/`pending` with zero
  started jobs for 15 branches (oldest since 19:50Z); the head's run
  `37368989712` was `pending` with 0 jobs; the monitor ended
  `settle: required-pending → settle-timeout` after 30m listing every required
  context as missing. `gh pr checks` showed 0 failing.
- **Cost:** one wasted monitor job, a manual diagnosis, and a re-submit with
  `--settle-timeout "3 hours"`.
- **Would have prevented it:** the monitor distinguishing "run exists but has
  no jobs after N minutes" (queue saturation, environment-only) from a missing
  context, and either holding the budget like `heavy-not-admitted` does or
  printing a `queue-saturated` gate line with the repo-wide queued count.
  Related: the ci-lane-economics branch-cap governor.
