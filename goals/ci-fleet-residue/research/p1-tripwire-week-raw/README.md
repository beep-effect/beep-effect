# P1 tripwire-week raw evidence

Raw GitHub Actions API captures behind
`../p1-tripwire-week-evidence.md`. All content is public API data
(actions runs, jobs, check-run annotations, one job log); nothing here is
secret-bearing. Committed so the attribution table can be regenerated and
audited after GitHub's retention expires.

## Files

- `runs-window.jsonl` — every workflow run created 2026-08-16..2026-08-24,
  one JSON object per line (fetched 2026-08-24T05:44Z):

  ```sh
  gh api "repos/beep-effect/beep-effect/actions/runs?created=2026-08-16..2026-08-24&per_page=100" \
    --paginate -q '.workflow_runs[] | {id, name, run_attempt, conclusion,
    status, created_at, run_started_at, event, head_branch, html_url}'
  ```

- `reruns.jsonl` — the 16 rows above with `run_attempt > 1`.
- `rerun-evidence/jobs-<run_id>.json` — attempt-1 jobs for each re-run
  (`/actions/runs/<id>/attempts/1/jobs`): per-job conclusion, runner name,
  labels, and non-success steps.
- `rerun-evidence/jobs-32040357343-attempt2.json` — attempt-2 jobs for the
  one run that reached `run_attempt: 3`, so every prior attempt is
  classified (review hardening, PR #778).
- `rerun-evidence/annotations-<job_id>.json` — check-run annotations for
  every non-successful job above (`/check-runs/<job_id>/annotations`,
  messages truncated to 300 chars).
- `rerun-evidence/job-95420324181.log` — full log of the self-hosted
  attempt-2 setup failure of run 32040357343: `actions/checkout` download
  HTTP 429/502/429, "Failed to download archive ... after 3 attempts".

## Window-extension capture (2026-08-24)

Re-runs created on 2026-08-24 up to 06:39Z were re-checked with the same
recipe (`created=2026-08-24..2026-08-25`): the only row is run
32688837330 (the out-of-window interruption already attributed in the
report).
