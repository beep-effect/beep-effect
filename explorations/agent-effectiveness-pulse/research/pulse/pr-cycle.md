# PR Cycle-Time Pulse (GitHub REST)

> Provenance: main-session `gh` extraction, 2026-07-14 (UTC). Fills the
> GitHub lane that the codex bottleneck lane could not reach (GraphQL 502s +
> sandbox token unavailability). REST endpoint, 371 merged PRs, created
> 2025-08-21 → 2026-07-14.

## Distribution (create → merge)

- p50 **52.0m**, p75 143.5m, p90 **6.72h**, p99 50.9h, max 6.0d.
- **31%** merge in <15 minutes; **53%** in <1 hour; **94%** in <1 day.

## Monthly trend (merge month, median / p90)

| Month | n | Median | p90 |
|---|---:|---:|---:|
| 2026-03 | 19 | 60m | 3.0h |
| 2026-04 | 19 | 77m | 7.5h |
| 2026-05 | 85 | 73m | 2.9h |
| 2026-06 | 82 | 113m | 19.6h |
| 2026-07 (partial) | 102 | 51m | 6.0h |

(Months before 2026-03 had near-zero medians — direct-merge era, tiny n.)

## The tail is parked batches, not CI

The 12 slowest PRs cluster: #351–#354 all ~39–40h, all merged 2026-07-10
within the same window — a parked batch landed together. Same pattern for
#176/#177 (≈143h, both merged 2026-05-29) and #259/#267 (Jun 20–21). This is
**operator-absence / batching latency**, not check execution or review churn.
Combined with the yeet lane's finding (recurring attributed failure =
`full:pre-push`; post-cutoff failures = unattributed publish-mode), the
end-to-end picture: the *typical* PR is fast (sub-hour); the p90+ tail is
dominated by PRs waiting for the operator to return, with June's p90 spike
(19.6h) coinciding with heavy parallel-clone activity.

## Reproduce

```sh
gh api "repos/beep-effect/beep-effect/pulls?state=closed&per_page=100&sort=updated&direction=desc" \
  --paginate --jq '.[] | select(.merged_at != null) |
  [.number, .created_at, .merged_at] | @tsv'
# then diff merged_at - created_at per row; percentiles by sort index.
```

## Limitations

- REST `changed_files` was not populated on the list endpoint, so
  size-vs-latency was not computed (needs per-PR fetch; deferred).
- `updated`-sorted pagination window covers all 371 merged PRs in this repo's
  lifetime; monthly rows with small n are noisy.
- Create→merge conflates check time, review time, and operator absence; the
  batch-clustering of the slowest PRs is the disambiguating evidence here.
