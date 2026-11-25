---
title: "Missed-event check also starts when a fleet-queuing workflow is requested"
date: 2026-11-25
lane: "feat/ci-missed-event-workflow-run"
reversal: "remove the workflow_run trigger and the guard job from fleet-missed-event-check.yml and the --guard mode from the check; the cron and dispatch triggers keep working as before"
---

GitHub throttles the check's cron (`3-59/10 * * * *`) to about one run every 7-10 hours, so it cannot carry the 10-minute cadence the gate expects. The workflow now also starts on `workflow_run` `requested` for `Check`, `Heavy Admit` and `Cache Warm`, the workflows that queue fleet jobs, keeping `schedule` and `workflow_dispatch`.

- **Security.** `workflow_run` runs the default branch's copy with that branch's secrets. Both jobs check out `github.event.repository.default_branch` explicitly and never read or run the triggering run's code, as in `rerun-runner-loss.yml`.
- **Guard.** A `guard` job (job token with `actions: read`, plus `contents: read` for its checkout; no environment, no App token) runs `beep ci fleet-missed-event-check --guard` and writes `run=true|false` to `$GITHUB_OUTPUT`. The check job `needs` it with `if: ${{ !cancelled() && needs.guard.outputs.run != 'false' }}`, so it skips only on the guard's explicit `run=false`, and a guard job that crashes before writing its output still lets the check run. It skips (green, check job skipped) when the previous checking run's check job started less than 8 minutes ago. The previous checking run is the newest earlier run of the workflow, from any event, whose `Fleet Missed-Event Check` job started and was neither skipped nor cancelled, so the guard looks past guard-skipped and concurrency-cancelled runs. A `workflow_dispatch` always runs; any read failure fails open to `run=true`. The single workflow-level concurrency group stays (`cancel-in-progress: false`).
- **Previous run and gap.** The summary's previous run uses the same previous-checking-run walk (it replaced the `?event=schedule&per_page=5` read, so cron, `workflow_run` and dispatch runs all count) and measures from check-job start to check-job start. A gap over 30 minutes is a finding for the gate only when at least one fleet job the check read was created inside it; otherwise the summary prints it as information. The fleet jobs come from the check's two-hour lookback, so the count is a lower bound for longer gaps.
- **Cost.** The guard reads one runs listing (30 runs) and one jobs listing per earlier run until it finds a checking run, usually one or two, on the job token's budget.
