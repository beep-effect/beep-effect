# P3 live-week p95 evidence — 2026-08-30 snapshot

## Verdict

**P3 is not complete.** The representative UTC week from
`2026-08-23T00:00:00Z` through `2026-08-30T00:00:00Z` proves the signed
Coverage outcome below 20 minutes, but two required lanes breach the charter:

- `Lint`: **20m31s p95**.
- `Test Unit`: **22m48s p95**.

Coverage Regression is **16m26s p95**. The packet therefore advances from P2
execution into P3 evidence and repair, not into closeout.

## Boundary and method

The census reads all Check workflow runs created in the half-open UTC interval.
There are 476 runs: 371 pull-request and 105 push waves. Of those, 469 runs
instantiate at least one required job: 369 pull-request and 100 push waves.

For each job, wall time is `completed_at - started_at`. A duration enters the
percentile population only when `run_attempt == 1`, `conclusion == success`,
and both timestamps form a non-negative span. Percentiles use nearest rank, so
p95 selects `ceil(0.95 * n)` after ascending sort. Failed, cancelled, skipped,
nonterminal, and later-attempt jobs do not enter the duration population.

Required contexts come from live ruleset `10240248`. It changed at
`2026-08-26T04:16:24Z` from the prior 16-context set to 17 contexts, added
`Heavy / Doctest`, and prefixed the reusable-workflow contexts with `Heavy /`.
The join normalizes that prefix back to the stable lane name. Doctest has 235
successful attempt-one observations across both PR and push events inside this
week, but the first full week entirely after its promotion ends at
`2026-09-02T04:16:24Z`.

## Successful attempt-one durations

| Required lane | n | PR | Push | p50 | p95 | Max | P3 state |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Check | 407 | 310 | 97 | 6m06s | 12m55s | 15m43s | Pass |
| Codegen Drift | 460 | 360 | 100 | 1m59s | 3m50s | 9m53s | Pass |
| Commitlint | 446 | 353 | 93 | 0m58s | 1m19s | 1m49s | Pass |
| Coverage Regression | 287 | 233 | 54 | 9m53s | 16m26s | 21m24s | Pass |
| Docgen | 437 | 337 | 100 | 1m45s | 7m26s | 9m29s | Pass |
| Doctest | 235 | 187 | 48 | 1m06s | 3m21s | 4m35s | Pass; partial promotion week |
| Knip | 461 | 361 | 100 | 1m14s | 1m32s | 2m12s | Pass |
| Lint | 435 | 335 | 100 | 6m21s | **20m31s** | 23m41s | **Breach** |
| Lint Policy | 415 | 321 | 94 | 5m48s | 7m08s | 11m15s | Pass |
| Nix Shell | 459 | 359 | 100 | 1m36s | 2m00s | 2m16s | Pass |
| Professional Desktop IPC Stdio | 464 | 364 | 100 | 1m04s | 1m35s | 4m32s | Pass |
| Repo Sanity | 450 | 350 | 100 | 3m01s | 4m25s | 6m55s | Pass |
| SAST | 460 | 360 | 100 | 1m14s | 1m51s | 2m52s | Pass |
| Secret Scanning | 460 | 360 | 100 | 0m53s | 1m44s | 9m05s | Pass |
| Security | 461 | 361 | 100 | 0m27s | 0m42s | 1m41s | Pass |
| Test Integration | 450 | 350 | 100 | 2m13s | 3m25s | 4m27s | Pass |
| Test Unit | 379 | 318 | 61 | 7m32s | **22m48s** | 27m13s | **Breach** |

The maximum is retained as tail context but does not replace the charter's p95
gate. Coverage has a 21m24s maximum and still passes p95; Lint and Test Unit
fail on the percentile itself.

## Non-success and later-attempt population

These records are deliberately separate from the percentile table.

| Required lane | Attempt-one failures | Attempt-one cancellations |
| --- | ---: | ---: |
| Check | 25 | 37 |
| Codegen Drift | 0 | 9 |
| Commitlint | 14 | 9 |
| Coverage Regression | 138 | 44 |
| Docgen | 13 | 19 |
| Doctest | 1 | 13 |
| Knip | 0 | 8 |
| Lint | 0 | 34 |
| Lint Policy | 22 | 32 |
| Nix Shell | 0 | 10 |
| Professional Desktop IPC Stdio | 0 | 5 |
| Repo Sanity | 5 | 14 |
| SAST | 0 | 9 |
| Secret Scanning | 0 | 9 |
| Security | 0 | 8 |
| Test Integration | 1 | 18 |
| Test Unit | 55 | 35 |

Twelve workflows reached attempt two and one reached attempt three. Each
preexisting required lane therefore has 12 attempt-two job records and one
attempt-three record; Doctest, introduced during the window, has six and one.
The later attempts are excluded even when green. Coverage, Lint, and Lint
Policy each retain one later-attempt cancellation; Test Integration retains one
later-attempt failure; Test Unit retains eleven successes, one failure, and one
cancellation. The remaining later-attempt records are successful.

The high failure counts are not duration evidence and do not rescue or worsen
the percentile calculation. They remain admission evidence requiring separate
source, test, or infrastructure attribution.

## Current-ruleset partial observation

The exact current-ruleset clock begins at `2026-08-26T04:16:24Z`. Through the
2026-08-30 capture, 84 main-push runs supplied 78 instantiated attempt-one job
waves. `Heavy / Doctest` already has 78 successes at 3m36s p95. Test Unit has
33 successes at **23m56s p95**, so merely waiting for the seven-day boundary
cannot prove the charter without changing the observed tail.

Non-success jobs remain outside the percentiles. In this partial population,
attempt-one failures are: Coverage Regression 50, Test Unit 44, Lint Policy 4,
Commitlint 3, and Check 2. Five required jobs were nonterminal at capture and
five workflows were cancelled. There were no reruns. These counts require
source/infrastructure attribution before any new admission decision.

## Tail attribution and next decision

Test Unit is a structural cold-cache breach, not a pickup or setup artifact.
Representative zero-hit jobs spend 21m56s-24m39s inside the 132-task Turbo
lane at concurrency two. `@beep/repo-cli#test` is the indivisible long pole at
roughly eight to nine minutes. Root dependency and lockfile changes legitimately
invalidate the full graph, so cache warmth improves the median but cannot prove
the p95 charter. Separately, 43 of the 44 current Test Unit failures repeat one
stale `quality-tasks.test.ts` assertion; the remaining failure is a scheduler
ordering assertion. Those failures do not enter the successful-duration p95.

Lint is also a structural broad-graph tail after the #684 policy de-duplication,
not an old-shape artifact. Its p95 job spent 17m41s in a 130-task Turbo lane
with 126 misses, plus 1m51s in hosted-runner disk cleanup. The maximum spent
18m33s on 132 cache misses and 4m12s in cleanup. The current partial push p95
improved to 17m42s, but the sample is not a full current-ruleset week and its
maximum is exactly 20m00s, leaving no admitted margin.

The standing P1 row retains Test Unit on hosted runners based on the earlier
17.6-minute p95 and retains Lint on hosted with package-graph de-duplication.
This week falsifies both assumptions. The existing decision does not authorize
another shard, concurrency change, or fleet move. P3 therefore remains active
until a new signed repair decision is costed against the unchanged $100/month
projection and $200/month ceiling, implemented without weakening the security
rails, and admitted on a fresh representative week.
