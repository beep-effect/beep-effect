# P3 admission-week p95 census — 2026-09-04 to 2026-09-11

## Verdict

**Admission denied. P3 and the manifest stay active.** The first complete
half-open UTC week after PR #982 merged, `2026-09-04T00:00:00Z` through
`2026-09-11T00:00:00Z`, was censused on 2026-09-21 with the canonical command
and fails the charter on three counts:

- `Check`: **20m19s p95** (breach by 19s; 12m41s the prior censused week).
- `Coverage Regression`: **30m58s p95** (breach; 15m20s the prior censused
  week).
- Shard-pickup queue tripwire: **8m22s p95** over the 5m00s limit
  (n=2190 shard pickups).

The two lanes that PR #982 repaired both clear the bar. Effective critical
paths from the earliest successful shard start through the literal
aggregator's completion:

- `Lint`: **14m38s p95** (design projection 12m30s; charter margin 5m22s).
- `Test Unit`: **16m31s p95** (design projection 16m30s; charter margin 3m29s).

The other fourteen required lanes pass. The context-set check passed at
exactly 18.

## Command and reproduction

```sh
bun run beep ci lane-timings --window --workflow check.yml --event all --since 2026-09-04T00:00:00Z --until 2026-09-11T00:00:00Z --markdown
```

- Required contexts: 18 (expected 18), resolved from ruleset `10240248`
  history version `48600030`, effective `2026-09-03T17:12:53.589Z`, the
  latest version strictly before the exclusive `--until`. The live ruleset
  has held 17 contexts since `Heavy / Coverage Regression` was removed at
  `2026-09-12T01:46:53Z`; the census still measures the window's ratified
  population.
- Two earlier attempts on 2026-09-21 aborted with a single transient
  `local error: tls: bad record MAC` from one `gh api` jobs page each; the
  collector does not retry. The reported run used a PATH shim that retried
  idempotent `gh api` reads on transport errors. Three pages needed one retry
  each (two `bad record MAC`, one `received record with version 1c10`); all
  succeeded on the first retry. The receipt is in
  [OPPORTUNITIES.md](./OPPORTUNITIES.md).
- The unratified 2026-09-12 output in
  [admission-census-2026-09-04-window.md](./admission-census-2026-09-04-window.md)
  was PR-event only; its lede now marks it superseded by this verdict. This
  census adds 59 to 69 push waves per lane; every
  verdict is unchanged, and no lane moved more than 20s at p95 except
  `Check` (20m39s to 20m19s).

Only attempt-one successful non-negative spans enter nearest-rank p50/p95.
Failures, cancellations, reruns, invalid spans, and incomplete shard sets are
attribution only and are tabulated below.

## Successful attempt-one durations

| Required lane | n | PR | Push | p50 | p95 | Max | P3 state |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Check | 277 | 211 | 66 | 13m30s | **20m19s** | 32m01s | **Breach** |
| Codegen Drift | 398 | 329 | 69 | 0m19s | 3m25s | 7m35s | Pass |
| Commitlint | 392 | 326 | 66 | 1m14s | 1m48s | 2m11s | Pass |
| Coverage Regression | 223 | 164 | 59 | 13m45s | **30m58s** | 32m31s | **Breach** |
| Docgen | 360 | 291 | 69 | 2m15s | 14m55s | 15m38s | Pass |
| Doctest | 396 | 327 | 69 | 1m52s | 6m00s | 6m44s | Pass |
| JSDoc Ratchet | 314 | 245 | 69 | 9m19s | 9m53s | 10m42s | Pass |
| Knip | 394 | 325 | 69 | 1m35s | 2m06s | 2m40s | Pass |
| Lint | 354 | 285 | 69 | 4m46s | 14m38s | 21m39s | Pass |
| Lint Policy | 277 | 213 | 64 | 8m01s | 10m33s | 11m25s | Pass |
| Nix Shell | 388 | 319 | 69 | 1m57s | 2m40s | 3m11s | Pass |
| Professional Desktop IPC Stdio | 400 | 332 | 68 | 0m20s | 3m36s | 5m10s | Pass |
| Repo Sanity | 346 | 281 | 65 | 3m35s | 6m36s | 12m36s | Pass |
| SAST | 392 | 324 | 68 | 1m36s | 3m26s | 4m06s | Pass |
| Secret Scanning | 395 | 326 | 69 | 0m51s | 1m20s | 2m03s | Pass |
| Security | 399 | 330 | 69 | 0m48s | 1m20s | 1m52s | Pass |
| Test Integration | 382 | 313 | 69 | 3m16s | 6m16s | 9m46s | Pass |
| Test Unit | 288 | 222 | 66 | 12m20s | 16m31s | 21m06s | Pass |

## Attempt-one failures and cancellations

| Required lane | Failures | Cancellations | Invalid spans | Incomplete shard sets |
| --- | ---: | ---: | ---: | ---: |
| Check | 35 | 126 | 0 | 0 |
| Codegen Drift | 4 | 36 | 0 | 0 |
| Commitlint | 7 | 39 | 0 | 0 |
| Coverage Regression | 76 | 139 | 0 | 0 |
| Docgen | 13 | 65 | 0 | 0 |
| Doctest | 1 | 41 | 0 | 0 |
| JSDoc Ratchet | 10 | 114 | 0 | 0 |
| Knip | 2 | 42 | 0 | 0 |
| Lint | 3 | 81 | 0 | 26 |
| Lint Policy | 60 | 101 | 0 | 0 |
| Nix Shell | 0 | 50 | 0 | 0 |
| Professional Desktop IPC Stdio | 3 | 35 | 0 | 0 |
| Repo Sanity | 24 | 68 | 0 | 0 |
| SAST | 2 | 44 | 0 | 0 |
| Secret Scanning | 8 | 35 | 0 | 0 |
| Security | 5 | 34 | 0 | 0 |
| Test Integration | 5 | 51 | 0 | 0 |
| Test Unit | 25 | 125 | 0 | 26 |

## Later attempts

| Required lane | Success | Failure | Cancelled |
| --- | ---: | ---: | ---: |
| Check | 29 | 4 | 3 |
| Codegen Drift | 36 | 0 | 0 |
| Commitlint | 36 | 0 | 0 |
| Coverage Regression | 26 | 8 | 2 |
| Docgen | 36 | 0 | 0 |
| Doctest | 36 | 0 | 0 |
| JSDoc Ratchet | 36 | 0 | 0 |
| Knip | 36 | 0 | 0 |
| Lint | 36 | 0 | 0 |
| Lint Policy | 34 | 1 | 1 |
| Nix Shell | 36 | 0 | 0 |
| Professional Desktop IPC Stdio | 35 | 1 | 0 |
| Repo Sanity | 33 | 3 | 0 |
| SAST | 36 | 0 | 0 |
| Secret Scanning | 36 | 0 | 0 |
| Security | 36 | 0 | 0 |
| Test Integration | 36 | 0 | 0 |
| Test Unit | 35 | 1 | 0 |

Queue tripwire: **Breach** — shard pickup p95 8m22s > 5m00s (n=2190).

## Attribution notes

- `Check` sits 19s over the bar with a 32m01s maximum and 35 attempt-one
  failures; its p50 rose from 6m39s to 13m30s across the two censused weeks,
  so the tail is a lane-wide slowdown, not a single anomalous runner. The
  lane was not touched by PR #982 and has no signed repair.
- `Coverage Regression` doubled at p95 (15m20s to 30m58s) with 76 attempt-one
  failures and 26 later-attempt successes. The operator removed it from the
  required set on 2026-09-12, after the window, so it will not appear in a
  future population; that removal does not retroactively admit this week.
- The 26 incomplete shard sets each for `Lint` and `Test Unit` are all push
  waves (the PR-only census reported 2). They are excluded from the
  percentiles by the shard-set rule and do not affect the verdict.
- The pickup tripwire is a free hosted-runner queue signal, separate from job
  duration: shards waited 8m22s at p95 for a runner. It is the reason the
  repaired lanes carry less margin than their design projections.

## Consequences

- P3 stays `in progress` and `ops/manifest.json` stays `active`.
- The next admission window cannot reuse this population. With the live set
  at 17 contexts, the packet must ratify the 17-context population and its
  effective date before a new half-open week is censused, or the command
  will correctly fail closed again.
- A signed repair decision is owed for `Check` and for the shard-pickup queue
  before a new window opens. Coverage Regression needs no repair for
  admission because it left the required set, but its doubled duration is
  a standing cost signal for `ci-fleet-endgame`.
