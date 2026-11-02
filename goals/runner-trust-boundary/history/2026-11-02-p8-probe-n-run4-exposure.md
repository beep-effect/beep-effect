# P8 Probe N run 4: exposure measurement, 2026-11-02

Operator-chosen measurement, dispatched from `main` at `98aac53e9b` (after
#2566) with `ops/post-release-replay.sh main KILL 12`. The held session ran
with the worker binary removed, so no offered job could execute. Runner names
are instance ids. No credential or host address appears here.

## Timeline (UTC)

| Time | Event | Source |
| --- | --- | --- |
| 13:26:19 | run `41452707373` job `Shadow Probe` starts on `beep-ci-i-0dcd7b8c35132bd15` | job record |
| 13:26:23 | listener stopped with SIGKILL | serial console |
| 13:26:25 to 13:29:00 | attempts 1 to 6 refused: session already exists | serial console |
| 13:29:31 | attempt 7 accepted; hold starts (720 s, no worker binary) | serial console |
| 13:30:29 | one decoy `fleet-shadow-check.yml` run `41453550130` dispatched | operator script |
| 13:32:19 | decoy job starts on a different, newly launched runner `beep-ci-i-0a4270e146a787e7d` and succeeds | job record |
| 13:30:02 to 13:40:43 | 32 real `Heavy / ...` jobs start while the session is held, each on its own new runner | job records |
| 13:41:19 | GitHub cancels the probe job on its 10-minute timeout | job record |
| 13:41:32 | held session ends: the runner reports its registration removed | serial console |
| 13:41:39 to 13:44:48 | 13 more real `Heavy / ...` jobs start on their own new runners, after the held session ended | job records |
| 13:43:56 | disposable second host `i-0edc21df5f85ecbb2` replays; refused, registration deleted | its serial console |
| 13:44:36 | second host terminate requested; `terminated` on re-read | operator script |

## Result

- For the full 12 minutes the replayed session stayed connected, its listener
  printed no "Running job" line, the line the runner prints when it takes a
  job, and no job record names its runner. The probe watched for that line and
  for the listener's exit only; it did not retain the rest of the listener
  log, so an offer that failed before that line cannot be ruled out. The
  decoy and all 32 real heavy jobs that started during the hold went to other
  runners, each on its own new runner.
- The replayed session ended 13 seconds after GitHub cancelled the original
  job, when the registration was deleted. A later replay from a second host
  was refused.
- The only job ever recorded for `beep-ci-i-0dcd7b8c35132bd15` is the probe
  job itself.

## Reading

Within this measurement, an ephemeral registration that already holds its one
job is not offered another job through a replayed session, and the replayed
session ends when the original job ends. The replay therefore did not reach
any job beyond the one the job code already controlled. This is one
observation of GitHub's server behaviour, not a documented guarantee; the
operator decides whether it is enough to accept E1 as a residual or to add a
structural fix.

## Job counts

Counted from GitHub job records, not from the console. The full listing of
every job on a `beep-ci-*` runner that started 13:26:00 to 13:45:00 is
[`2026-11-02-p8-probe-n-run4-jobs.tsv`](./2026-11-02-p8-probe-n-run4-jobs.tsv)
(57 jobs). It was produced by listing every workflow run created since
12:00:00 with `gh api --paginate .../actions/runs`, reading each run's jobs with
`filter=all`, and keeping jobs whose `runner_name` starts with `beep-ci-`.

| Window (UTC) | Jobs started | On `beep-ci-i-0dcd7b8c35132bd15` |
| --- | --- | --- |
| 13:29:31 to 13:41:32 (hold) | 33: the decoy and 32 `Heavy / ...` jobs, on 33 distinct runners | 0 |
| 13:41:32 to 13:45:00 | 13 `Heavy / ...` jobs | 0 |
