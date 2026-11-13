---
title: "The re-run API accepts a cancelled push run; whether it re-enters the shared main group is undocumented, so re-dispatch fires only when nothing is pending"
date: 2026-11-13
lane: "claude/amazing-swirles-67011b"
reversal: "If slice 4's first post-merge re-dispatch shows the re-run bypasses the concurrency group (or is refused), restate this decision with that run's evidence and widen or drop the idle-only gate."
---

P0 fact for slice 4 (re-dispatch): does `POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun` accept a cancelled push run, and does the rerun re-enter `check.yml`'s shared main concurrency group? Read from GitHub's documentation and read-only `gh api` calls on 2026-11-13; no main run was re-run or cancelled.

Documented:

- The REST reference for "Re-run a workflow" ("Re-runs your workflow run using its id") states no restriction on the run's conclusion, documents only `201 Created`, and takes only `enable_debug_logging`. `rerun-failed-jobs` re-runs "failed jobs and their dependent jobs"; the docs do not say a cancelled job counts as failed, so re-dispatch uses the whole-run endpoint.
- "Re-running workflows and jobs": re-runs are possible up to 30 days after the initial run, use the original event's `GITHUB_SHA` and `GITHUB_REF`, and run with the privileges of the actor who triggered the original run. A re-run therefore stays a `push` run on `refs/heads/main` for the same SHA, which the verdict definition (decision `every-main-commit-verdict`) counts.
- Neither the REST reference nor the re-run page nor the concurrency pages mention re-runs and concurrency together. The concurrency reference says a group holds at most one running and, under the default `queue: single`, one pending run, and that a newly queued run cancels and replaces the pending one.

Observed (read-only):

- Cancelled main push runs expose `rerun_url` and no `concurrency` field in the run payload; for example run 43337600976 (head 7b8116b26cb, attempt 1, cancelled before any job: `total_count` 0).
- On 2026-11-12 between 19:20:42Z and 19:22:00Z four consecutive main push runs (43289187669, 43289242017, 43289284656, 43289325218) were each cancelled 15 to 30 s after creation, when the next push's run was created, with no job started: GitHub's pending-run replacement in the shared group.
- The only main push re-runs in the last 100 main push runs are re-runs of failed attempts (43289409901 attempt 2 by `github-actions[bot]`, 42642693204 attempts 2 and 3). No cancelled main push run has been re-run, so no live record shows whether a re-run queues behind, or displaces, a pending run in the group.

Conclusion: the endpoint accepts a completed run with no documented conclusion restriction, so a cancelled push run is re-runnable by contract, within 30 days and for its original SHA. Whether the re-run joins the `${{ github.workflow }}-${{ github.ref }}` group is undocumented; this goal keeps the conservative reading the runner-loss classifier already encodes (the `superseded-head` reason in `RunnerLossRerun.ts`: "re-running it would cancel the current head's run") and the decision `redispatch-never-displaces-a-pending-run`: re-dispatch fires only when no main Check run is queued or pending. Slice 4 proves both halves on its first post-merge re-dispatch (a `workflow_run` job runs from `main`'s copy) and records the attempt's `run_attempt`, start time and any concurrently pending main run; a 4xx on a cancelled run there reopens this decision.

Found in passing: the concurrency reference now documents `queue: max` (up to 100 pending runs per group, FIFO not guaranteed, not combinable with `cancel-in-progress: true`). It would keep superseded main pushes pending instead of cancelling them, which bears on the 82-of-100 pending-supersession finding in the SPEC's Constraints. `check.yml` sets `cancel-in-progress` by expression (true for pull requests), so adopting it needs a design for the PR branch and a replay of the queueing cost. It is not adopted here; it is recorded as an input for slice 2's replay and slice 4's design.
Source: docs.github.com REST "Workflow runs" (re-run a workflow, re-run failed jobs), "Re-running workflows and jobs", workflow syntax `concurrency` and "Control the concurrency of workflows and jobs", read 2026-11-13; `gh api repos/{owner}/{repo}/actions/workflows/check.yml/runs?branch=main&event=push` and `.../actions/runs/{id}/attempts/{n}` (read-only).
