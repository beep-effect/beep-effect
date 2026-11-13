> **Preview, not an admission census.** Window 2026-11-10T04:00:00.000Z → 2026-11-17T04:00:00.000Z: cutoff is in the future.

- required contexts: 15 (expected 15; ruleset 10240248 version 54940515 effective 2026-10-27T09:49:40.844Z)

## Successful attempt-one durations

| Required lane | n | PR | Push | p50 | p95 | Max | P3 state |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Check | 94 | 66 | 28 | 1m21s | 1m56s | 2m15s | Pass |
| Codegen Drift | 156 | 127 | 29 | 1m10s | 1m36s | 1m55s | Pass |
| Commitlint | 225 | 197 | 28 | 0m31s | 0m37s | 0m49s | Pass |
| Docgen | 94 | 68 | 26 | 2m52s | 7m20s | 11m55s | Pass |
| Doctest | 95 | 67 | 28 | 1m51s | 2m57s | 3m03s | Pass |
| JSDoc Ratchet | 153 | 124 | 29 | 2m17s | 2m33s | 2m46s | Pass |
| Lint | 153 | 124 | 29 | 2m42s | 10m18s | 13m01s | Pass |
| Nix Shell | 138 | 109 | 29 | 0m24s | 1m49s | 2m04s | Pass |
| Professional Desktop IPC Stdio | 142 | 113 | 29 | 0m32s | 3m00s | 8m34s | Pass |
| Repo Sanity | 179 | 151 | 28 | 3m40s | 4m02s | 4m49s | Pass |
| SAST | 204 | 175 | 29 | 1m24s | 1m54s | 2m00s | Pass |
| Secret Scanning | 225 | 195 | 30 | 0m27s | 0m34s | 0m43s | Pass |
| Security | 202 | 173 | 29 | 1m18s | 1m32s | 2m30s | Pass |
| Test Integration | 195 | 167 | 28 | 0m03s | 0m04s | 0m06s | Pass |
| Test Unit | 112 | 91 | 21 | 12m56s | **24m00s** | 29m28s | **Breach** |

## Attempt-one failures and cancellations

| Required lane | Failures | Cancellations | Invalid spans | Incomplete shard sets |
| --- | ---: | ---: | ---: | ---: |
| Check | 43 | 4 | 0 | 0 |
| Codegen Drift | 47 | 30 | 0 | 0 |
| Commitlint | 2 | 7 | 0 | 0 |
| Docgen | 44 | 3 | 0 | 0 |
| Doctest | 42 | 4 | 0 | 0 |
| JSDoc Ratchet | 47 | 33 | 0 | 0 |
| Lint | 0 | 21 | 0 | 131 |
| Nix Shell | 71 | 24 | 0 | 0 |
| Professional Desktop IPC Stdio | 63 | 28 | 0 | 0 |
| Repo Sanity | 15 | 39 | 0 | 0 |
| SAST | 14 | 16 | 0 | 0 |
| Secret Scanning | 0 | 9 | 0 | 0 |
| Security | 21 | 11 | 0 | 0 |
| Test Integration | 2 | 35 | 0 | 0 |
| Test Unit | 26 | 35 | 0 | 132 |

## Later attempts

| Required lane | Success | Failure | Cancelled |
| --- | ---: | ---: | ---: |
| Check | 4 | 0 | 0 |
| Codegen Drift | 9 | 0 | 0 |
| Commitlint | 9 | 0 | 0 |
| Docgen | 4 | 0 | 0 |
| Doctest | 4 | 0 | 0 |
| JSDoc Ratchet | 9 | 0 | 0 |
| Lint | 9 | 0 | 0 |
| Nix Shell | 8 | 0 | 0 |
| Professional Desktop IPC Stdio | 8 | 1 | 0 |
| Repo Sanity | 3 | 6 | 0 |
| SAST | 9 | 0 | 0 |
| Secret Scanning | 9 | 0 | 0 |
| Security | 9 | 0 | 0 |
| Test Integration | 9 | 0 | 0 |
| Test Unit | 1 | 6 | 2 |

Queue tripwire: Breach — shard pickup p95 13m32s > 5m00s (n=3944).

## Per-day peak CI-active branches

Cap: 6 CI-active branches (repair decision 3, ruling 2). A run is in flight from its start to its last update; a branch is CI-active while it has a run in flight.

| UTC day | Peak concurrent runs | Peak concurrent branches | Load |
| --- | ---: | ---: | --- |
| 2026-11-10 | 9 | 8 | above cap (+2) |
| 2026-11-12 | 10 | 9 | above cap (+3) |
| 2026-11-13 | 18 | 17 | above cap (+11) |
