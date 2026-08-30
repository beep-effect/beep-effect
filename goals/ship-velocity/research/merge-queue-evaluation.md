# E8 merge queue re-evaluation

Date: 2026-08-27

Live evidence captured: 2026-08-27T13:46:59Z

## Recorded gate

The SPEC permits a merge-queue revisit only when `main` full-gauntlet success is at least 80%
over 14 days. The live `check.yml` push history from 2026-08-13 through 2026-08-27 contains 184
completed runs:

- 104 successful
- 55 failed
- 25 cancelled
- 65.4% successful among non-cancelled terminal runs (104 / 159)
- 56.5% successful across all completed runs (104 / 184)
- oldest completed run in the window: `2026-08-13T04:45:14Z`
- newest completed run in the window: `2026-08-27T08:25:35Z`

The primary non-cancelled rate is 14.6 percentage points below the flip condition.

The captured run set came from this read-only query (the counts above group the emitted TSV by
conclusion):

```bash
gh api --paginate \
  'repos/beep-effect/beep-effect/actions/workflows/check.yml/runs?branch=main&event=push&status=completed&created=2026-08-13..2026-08-27&per_page=100' \
  --jq '.workflow_runs[] | [.id,.created_at,.conclusion] | @tsv'
```

## Readiness audit

The active `main` repository ruleset is ID 10240248. It requires 17 named status checks and has
`strict_required_status_checks_policy: false`. The exact sanitized API result is frozen in
[`branch-protection-contexts.json`](./branch-protection-contexts.json); this prevents unqualified
job names such as `Check` from being mistaken for the live reusable-workflow context
`Heavy / Check`. No workflow under `.github/workflows/` currently handles `merge_group`.

The snapshot retains only branch, ruleset, enforcement, strictness, and context-name fields from:

```bash
gh api repos/beep-effect/beep-effect/rulesets/10240248
```

GitHub requires required-check workflows to handle `merge_group` before enabling a merge queue;
otherwise the queue waits for contexts that never report. The queue can replace the ordinary
"branch must be up to date" churn, but it pays a fresh required-check suite against a synthetic
merge-group SHA.

Sources:

- [Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- [The `merge_group` Actions event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group)

## Decision

Keep the merge queue disabled and leave strict required-status checks unchanged. The recorded
80% gate is not met, and enabling the queue before `merge_group` parity would deadlock required
contexts. Re-evaluate after a trailing 14-day window reaches 80%; at that point first prove
`merge_group` behavior for all 17 contexts and flip strict status checks before considering a
small queue batch.
