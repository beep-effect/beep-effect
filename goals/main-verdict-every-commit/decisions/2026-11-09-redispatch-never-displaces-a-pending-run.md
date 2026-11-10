---
title: "Re-dispatch fills idle main capacity and never displaces a pending main run"
date: 2026-11-09
reversal: "Disable the re-dispatch job with its repository variable, or revert its workflow PR."
---

While main Check pushes share one concurrency group (`.github/workflows/check.yml` lines 12 to 14), GitHub keeps one pending run per group, so re-running a cancelled main run while another is pending would cancel that newer run and trade one missing verdict for another; the runner-loss classifier already refuses such reruns for this reason (`superseded-head`, `packages/tooling/tool/cli/src/commands/Ci/RunnerLossRerun.ts` lines 28 to 32). Re-dispatch therefore re-runs a missing non-docs main verdict only when no main Check run is queued or pending, newest unverdicted SHA first, with a per-SHA attempt ceiling in the style of the runner-loss rerun. It extends the `workflow_run` pattern of `.github/workflows/rerun-runner-loss.yml` (today it acts only on `conclusion == 'failure'`) as a separate job or subcommand, so the workflow list and runner-loss classifier that yeet-monitor-app-identity widens stay unchanged; missing-verdict detection reads the certainty scorecard's main census, never a second census. Rejected: re-running every cancelled main run immediately (fights the shared group); a new census here (duplicates MEAS-01).
Source: this goal's lever check, 2026-11-09 (check.yml:12-14; rerun-runner-loss.yml job `if`; RunnerLossRerun.ts:28-32).
