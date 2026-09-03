# P3 current-ruleset week p95 evidence — 2026-09-03

## Verdict

**P3 remains incomplete.** The first complete half-open week under required
ruleset `10240248`, `2026-08-26T04:16:24Z` through
`2026-09-02T04:16:24Z`, still breaches the 20-minute p95 charter:

- `Lint`: **21m00s p95**.
- `Test Unit`: **24m50s p95**.

All other required lanes pass. Coverage Regression remains admitted at
15m20s p95. The new evidence strengthens the need for a signed repair; it does
not authorize an execution-shape change by itself.

## Boundary and population law

The REST census contains 649 Check workflow runs: 543 pull-request and 106
push runs. Of those, 639 instantiate at least one required job: 541 PR and 98
push waves. The first run was created at `2026-08-26T04:27:09Z`; the final run
at `2026-08-31T18:52:30Z`. No Check run was created in the remaining interval
before the boundary closed.

Required contexts are the 17 live contexts in ruleset `10240248`. The join
normalizes `Heavy / ` back to the stable lane name. A duration enters the
population only when `run_attempt == 1`, `conclusion == success`, and
`completed_at - started_at` is non-negative. p50 and p95 use nearest rank
`ceil(p*n)` after ascending sort. Runner pickup, failures, cancellations, and
later attempts are excluded from percentiles and reported separately.

## Successful attempt-one durations

| Required lane | n | PR | Push | p50 | p95 | Max | P3 state |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Check | 440 | 344 | 96 | 6m39s | 12m41s | 14m28s | Pass |
| Codegen Drift | 571 | 473 | 98 | 0m19s | 3m35s | 9m53s | Pass |
| Commitlint | 556 | 461 | 95 | 1m06s | 1m37s | 2m16s | Pass |
| Coverage Regression | 279 | 235 | 44 | 11m10s | 15m20s | 21m24s | Pass |
| Docgen | 517 | 419 | 98 | 1m55s | 7m11s | 11m49s | Pass |
| Doctest | 559 | 461 | 98 | 1m20s | 3m34s | 4m35s | Pass |
| Knip | 555 | 457 | 98 | 1m23s | 1m53s | 3m01s | Pass |
| Lint | 477 | 379 | 98 | 4m11s | **21m00s** | 23m41s | **Breach** |
| Lint Policy | 449 | 355 | 94 | 6m15s | 6m53s | 8m05s | Pass |
| Nix Shell | 554 | 456 | 98 | 1m45s | 2m17s | 2m48s | Pass |
| Professional Desktop IPC Stdio | 584 | 486 | 98 | 1m04s | 1m45s | 2m25s | Pass |
| Repo Sanity | 520 | 422 | 98 | 3m07s | 4m35s | 10m02s | Pass |
| SAST | 561 | 463 | 98 | 1m26s | 2m14s | 3m41s | Pass |
| Secret Scanning | 568 | 470 | 98 | 0m54s | 1m09s | 9m05s | Pass |
| Security | 571 | 473 | 98 | 0m28s | 0m39s | 1m13s | Pass |
| Test Integration | 549 | 451 | 98 | 2m23s | 3m20s | 4m33s | Pass |
| Test Unit | 388 | 334 | 54 | 9m40s | **24m50s** | 31m17s | **Breach** |

The maxima remain tail context, not substitutes for the p95 gate.

## Attempt-one failures and cancellations

| Required lane | Failures | Cancellations |
| --- | ---: | ---: |
| Check | 36 | 163 |
| Codegen Drift | 0 | 68 |
| Commitlint | 8 | 75 |
| Coverage Regression | 181 | 179 |
| Docgen | 24 | 98 |
| Doctest | 3 | 77 |
| Knip | 6 | 78 |
| Lint | 0 | 162 |
| Lint Policy | 47 | 143 |
| Nix Shell | 1 | 84 |
| Professional Desktop IPC Stdio | 1 | 54 |
| Repo Sanity | 18 | 101 |
| SAST | 0 | 78 |
| Secret Scanning | 6 | 65 |
| Security | 0 | 68 |
| Test Integration | 1 | 89 |
| Test Unit | 63 | 188 |

These are attribution evidence only. High cancellations reflect superseded PR
waves under `cancel-in-progress`; neither category enters a percentile.

## Later attempts

Fourteen workflows reached attempt two and two of those reached attempt three.
The table combines attempt-two and attempt-three required-job records.

| Required lane | Success | Failure | Cancelled |
| --- | ---: | ---: | ---: |
| Check | 15 | 0 | 1 |
| Codegen Drift | 16 | 0 | 0 |
| Commitlint | 16 | 0 | 0 |
| Coverage Regression | 13 | 2 | 1 |
| Docgen | 15 | 0 | 1 |
| Doctest | 15 | 0 | 1 |
| Knip | 16 | 0 | 0 |
| Lint | 16 | 0 | 0 |
| Lint Policy | 15 | 0 | 1 |
| Nix Shell | 16 | 0 | 0 |
| Professional Desktop IPC Stdio | 16 | 0 | 0 |
| Repo Sanity | 16 | 0 | 0 |
| SAST | 16 | 0 | 0 |
| Secret Scanning | 16 | 0 | 0 |
| Security | 16 | 0 | 0 |
| Test Integration | 14 | 1 | 1 |
| Test Unit | 14 | 1 | 1 |

Later attempts remain excluded even when green.

## Method

The capture was produced on 2026-09-03. Raw pages and intermediate joins live
outside the repository under `~/.cache/beep/handoffs/ci-lane-economics/raw/`.
The exact run-list command was executed once for each event:

```bash
START=2026-08-26T04:16:24Z
END=2026-09-02T04:16:24Z
RAW=~/.cache/beep/handoffs/ci-lane-economics/raw/current-ruleset-week
for event in pull_request push; do
  gh api --method GET \
    repos/beep-effect/beep-effect/actions/workflows/check.yml/runs \
    -f "created=$START..$END" -f "event=$event" -F per_page=100 \
    --paginate --slurp > "$RAW/runs-$event.pages.json"
done
```

`jq -s` flattened the page arrays, de-duplicated by run id, reapplied the
half-open predicate `created_at >= START and created_at < END`, and sorted by
`created_at,id`. Jobs were then fetched with eight bounded workers, one output
file per run, before an ordered merge:

```bash
jq -r '.[].id' "$RAW/runs.json" > "$RAW/run-ids.txt"
export RAW
xargs -n 1 -P 8 bash -c '
  gh api "repos/beep-effect/beep-effect/actions/runs/$1/jobs?filter=all&per_page=100" \
    --paginate --slurp > "$RAW/jobs/$1.pages.json"
' _ < "$RAW/run-ids.txt"
while read -r id; do
  jq -c --argjson run_id "$id" \
    '[.[] | .jobs[]?] | {run_id:$run_id,jobs:.}' "$RAW/jobs/$id.pages.json"
done < "$RAW/run-ids.txt" > "$RAW/jobs-ordered.ndjson"
```

The reducer joined run event/head provenance to jobs, normalized the Heavy
prefix, enforced the population law above, and selected nearest-rank values.
The full tail attribution is in `tail-attribution.md`.
