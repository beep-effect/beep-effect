# Unratified census output generated 2026-09-12 by the population-resolution fix lane; the P3 session ratifies it.

- required contexts: 18 (expected 18; ruleset 10240248 version 48600030 effective 2026-09-03T17:12:53.589Z)

## Successful attempt-one durations

| Required lane | n | PR | Push | p50 | p95 | Max | P3 state |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Check | 211 | 211 | 0 | 11m38s | **20m39s** | 32m01s | **Breach** |
| Codegen Drift | 329 | 329 | 0 | 0m18s | 3m12s | 7m05s | Pass |
| Commitlint | 326 | 326 | 0 | 1m14s | 1m47s | 2m11s | Pass |
| Coverage Regression | 164 | 164 | 0 | 12m40s | **30m59s** | 32m31s | **Breach** |
| Docgen | 291 | 291 | 0 | 2m08s | 14m56s | 15m38s | Pass |
| Doctest | 327 | 327 | 0 | 1m41s | 6m00s | 6m44s | Pass |
| JSDoc Ratchet | 245 | 245 | 0 | 9m18s | 9m49s | 10m42s | Pass |
| Knip | 325 | 325 | 0 | 1m35s | 2m06s | 2m33s | Pass |
| Lint | 285 | 285 | 0 | 5m08s | 14m36s | 21m39s | Pass |
| Lint Policy | 213 | 213 | 0 | 7m58s | 10m29s | 11m14s | Pass |
| Nix Shell | 319 | 319 | 0 | 1m55s | 2m37s | 3m04s | Pass |
| Professional Desktop IPC Stdio | 332 | 332 | 0 | 0m18s | 2m23s | 4m40s | Pass |
| Repo Sanity | 281 | 281 | 0 | 3m38s | 6m36s | 12m36s | Pass |
| SAST | 324 | 324 | 0 | 1m40s | 3m27s | 4m06s | Pass |
| Secret Scanning | 326 | 326 | 0 | 0m51s | 1m19s | 1m43s | Pass |
| Security | 330 | 330 | 0 | 0m48s | 1m21s | 1m52s | Pass |
| Test Integration | 313 | 313 | 0 | 2m42s | 6m16s | 9m18s | Pass |
| Test Unit | 222 | 222 | 0 | 12m13s | 16m51s | 21m06s | Pass |

## Attempt-one failures and cancellations

| Required lane | Failures | Cancellations | Invalid spans | Incomplete shard sets |
| --- | ---: | ---: | ---: | ---: |
| Check | 32 | 126 | 0 | 0 |
| Codegen Drift | 4 | 36 | 0 | 0 |
| Commitlint | 4 | 39 | 0 | 0 |
| Coverage Regression | 66 | 139 | 0 | 0 |
| Docgen | 13 | 65 | 0 | 0 |
| Doctest | 1 | 41 | 0 | 0 |
| JSDoc Ratchet | 10 | 114 | 0 | 0 |
| Knip | 2 | 42 | 0 | 0 |
| Lint | 3 | 81 | 0 | 2 |
| Lint Policy | 55 | 101 | 0 | 0 |
| Nix Shell | 0 | 50 | 0 | 0 |
| Professional Desktop IPC Stdio | 2 | 35 | 0 | 0 |
| Repo Sanity | 20 | 68 | 0 | 0 |
| SAST | 1 | 44 | 0 | 0 |
| Secret Scanning | 8 | 35 | 0 | 0 |
| Security | 5 | 34 | 0 | 0 |
| Test Integration | 5 | 51 | 0 | 0 |
| Test Unit | 22 | 125 | 0 | 2 |

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

Queue tripwire: Breach — shard pickup p95 8m33s > 5m00s (n=1845).
