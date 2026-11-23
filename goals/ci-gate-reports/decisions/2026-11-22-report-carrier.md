---
title: "The report carrier is the per-job task-outcome artifact, widened to hold the gate records"
date: 2026-11-22
lane: "goals/ci-gate-reports-p0"
reversal: "Upload the gate records as a separate gate-reports artifact per job and read that in the lookup"
---

The feed's carrier is the existing per-job task-outcome artifact, widened. Each hosted gate job uploads one artifact, `task-outcomes-<run>-<attempt>-<job>-<partition>` (name unchanged, so `Ci/RouteCorpus.ts` keeps finding it), uploaded `if: always()` with `retention-days: 30`. It holds:

- `.beep/ci-task-outcomes/record.json`, a `task-outcomes/v2` record;
- every gate record and log the job wrote, at their repo-relative paths: `<package>/.beep/gates/<gate>/report.json` and `report.log`, and the root's `.beep/gates/<gate>/…` (`recordLocation` in `@beep/repo-gate-record/GatePaths`).

**Record schema (`task-outcomes/v2`).** `{ schemaVersion: "task-outcomes/v2", job, runId, runAttempt, tasks: HostedTaskOutcome[], reports: GateFeedEntry[] }`. `GateFeedEntry` is `{ gate: GateName, subject, record: RepoRelativePath, log: RepoRelativePath }`, an index into the same artifact. It carries no verdict or counts: those stay in the `gate-report/v1` record it points to, so no fact is stored twice. Readers decode `v1 | v2` while v1 artifacts are inside their 30-day window, then drop v1.

**Evidence for the six criteria** (live REST reads against `main`, 2026-11-22):

1. *Red runs are carried.* The task-outcome upload already runs `always()`. Run 44994851897's red `Test Unit (repo-cli-8)` uploaded `task-outcomes-44994851897-1-test-unit-shard-repo-cli-8`. But that record and a green one (run 45042229032, `test-unit-shard-unit-e`) both decode to `tasks: []`, so today's record carries no failure facts. Widening it with the gate records is what makes a red job's facts survive. The Turbo remote cache fails here: Turbo writes cache entries only for tasks that succeed.
2. *Keyed by commit.* `GET /actions/workflows/{check.yml}/runs?head_sha=<mergeBase>&event=push&status=completed` resolves main at a SHA. A miss is common: 18 of main's last 40 Check runs were `cancelled` without running, because the concurrency group keeps one pending run. So the fallback is one listing, `…/runs?branch=main&event=push&status=completed&created=<=<merge base run's created_at>&per_page=100`, intersected locally with `git rev-list --first-parent <mergeBase>`. The lookup never pages further: no ancestor in that page means "no main baseline". The Turbo remote cache fails here: it is keyed by task hash, not commit.
3. *Bounded requests.* A hit at the merge base takes 3 REST requests: the runs by `head_sha`, `GET /actions/runs/{id}/artifacts?name=<exact name>` (one artifact, no paging of a run's 137 artifacts), and `GET /actions/artifacts/{id}/zip`. An ancestor hit takes 4. Measured: merge base `bc49cb6` had a cancelled Check run (request 1). Request 2 listed 66 completed runs; the nearest first-parent ancestor was `4e3343774cc`, 4 commits back (run 45042229032). Request 3 returned artifact 14763290472, and request 4 returned its zip (`record.json`, 110 bytes). No GraphQL. Each further job requested adds 2 (artifact, zip). These reads ran through `gh api`; the ledger proof comes with the `GitHubClient` lookup in P3 (its fixture test asserts at most five).
4. *Retention.* `retention-days: 30` on every task-outcome upload. The sampled artifact expires 2026-12-22, 30 days after creation. Gate uploads that today use 7 days (`turbo-summary-verify-*` in `heavy.yml`) do not carry the feed.
5. *No new paid service.* Workflow artifacts on the existing GitHub plan, uploaded with the runner's token. The lookup spends REST on an agent identity's existing quota.
6. *One record per job, no second copy.* One artifact and one record per job. A separate `gate-reports-*` artifact beside `task-outcomes-*` would pass criteria 1 to 5 but fail this one: two artifacts per job, both indexing the same job, and about 50 more artifacts per Check run on top of today's 137.

**Rejected:** the Turbo remote cache (fails 1, 2 and 6); a separate gate-report artifact (fails 6).

The P2 workflow PRs add the record and upload to the gate jobs that lack one today: Docs Policy, Test Plan, Coverage Regression, Professional Desktop IPC Stdio, Fallow Advisory, JSDoc Ratchet, Nix Shell, SAST, every `heavy.yml` lane, Storybook, the nightly Property Laws Sweep and the Lane Probe.
