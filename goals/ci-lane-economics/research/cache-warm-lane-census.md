# Cache-warm required-lane census — 2026-08-13

## Decision

P0 passes its `>=10 waves` alternative exit bar. The cache-warm corpus contains
10 completed Check workflow waves after the first write-enabled `main` seed
wave: 7 pull requests and 3 pushes. It is deliberately not presented as the
one-week alternative.

The census opens P1 with three current p95 breaches: `Coverage Regression`
29.5 minutes, `Lint` 24.3 minutes, and `Lint Policy` 20.6 minutes. Every other
required context is under 20 minutes at p95.

## Method

- Source: GitHub Actions REST run, all-attempt job, check annotation, and job
  log endpoints for the `Check` workflow; required contexts come from ruleset
  `10240248`, read live on 2026-08-13.
- Required-set boundary: the live ruleset contains 16 contexts. The visible
  `JSDoc Ratchet` job is not required and is therefore outside this table; a
  stale repo-local descriptor that marked it required is repaired in P2.
- Cache boundary: `#673` deployed the remote cache and `#674` wired Check.
  Run [`31697910572`][seed] was the first write-enabled `main` seed wave. Its
  0/131 `Lint` task hits and 45.5-minute wall time are retained as warm-up
  provenance but excluded from the cache-warm percentiles below.
- Population: the next 10 completed PR/push waves. A lane contributes duration
  only when its job record has `run_attempt == 1`, `conclusion == "success"`,
  and valid `started_at`/`completed_at` timestamps. Successful jobs inside a
  later-cancelled workflow still qualify; failed/cancelled jobs do not.
- Wall time: `completed_at - started_at` at the job level. Pickup latency is
  kept separate because reruns rewrite run-level start time; attempt-one pickup
  p95 ranged from 1.6 to 3.8 minutes across these lanes.
- Percentiles: nearest-rank over the sorted successful attempt-one durations.
  With 8-10 samples, p95 is intentionally the observed maximum.
- Turbo rate: task-weighted `Cached: X cached, Y total` from the final Turbo
  summary line in successful attempt-one job logs. Zero-task jobs add neither
  hits nor tasks. A workflow declaration of `uses_turbo: "false"` is `n/a`
  even if incidental implementation details touch Turbo.

## Required-lane table

| Required lane | Placement | n | p50 min | p95 min | Turbo task hits | P1 signal |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Lint | `ubuntu-24.04` | 8 | 7.2 | **24.3** | 295/635 (46.5%) | Breach; hosted runner stays the cheapest placement, but cache cannot cover the parallel non-Turbo helper wall. |
| Lint Policy | `beep-ec2-heavy` | 10 | 10.5 | **20.6** | n/a | Breach by 0.6m; #678 makes the later samples 10.4-10.9m, so re-prove before buying more fleet. |
| Check | `beep-ec2-heavy` | 10 | 9.4 | 16.0 | 618/897 (68.9%) | Meets charter; retain until a hosted shadow proves a free-runner re-fit. |
| Test Unit | `ubuntu-24.04` | 9 | 7.8 | 17.6 | 386/531 (72.7%) | Meets charter on the free runner; retain. |
| Test Integration | `beep-ec2-heavy` | 10 | 2.7 | 6.8 | 474/489 (96.9%) | Meets charter with strong reuse; retain pending cost review. |
| Docgen | `beep-ec2-heavy` | 10 | 2.9 | 13.4 | n/a | Meets charter; `uses_turbo: "false"`, so no cache rate is claimed. |
| Codegen Drift | `ubuntu-24.04` | 10 | 2.8 | 3.3 | n/a | Meets charter on the free runner; retain. |
| Repo Sanity | `ubuntu-24.04` | 10 | 3.3 | 4.1 | n/a | Meets charter on the free runner; retain. |
| Coverage Regression | `beep-ec2-heavy` | 9 | 13.6 | **29.5** | 540/1171 (46.1%) | Breach; coverage work is cache-bypassed, so placement alone is not the lever. |
| Knip | `ubuntu-24.04` | 10 | 1.7 | 3.1 | n/a | Meets charter on the free runner; retain. |
| Commitlint | `ubuntu-24.04` | 10 | 1.5 | 1.8 | n/a | Meets charter on the free runner; retain. |
| Secret Scanning | `ubuntu-24.04` | 10 | 0.9 | 1.0 | n/a | Meets charter on the free runner; retain. |
| Security | `ubuntu-24.04` | 10 | 1.1 | 1.8 | n/a | Meets charter on the free runner; retain. |
| SAST | `ubuntu-24.04` | 10 | 1.7 | 2.3 | n/a | Meets charter on the free runner; retain. |
| Nix Shell | `ubuntu-24.04` | 10 | 1.5 | 1.9 | n/a | Meets charter on the free runner; retain. |
| Professional Desktop IPC Stdio | `ubuntu-24.04` | 10 | 1.1 | 1.5 | n/a | Meets charter; 2/10 jobs took the explicit conditional-skip path. |

## Wave inventory

| Run | Event | Workflow conclusion | Treatment |
| --- | --- | --- | --- |
| [`31702329770`][r1] | PR | success | Included. |
| [`31702538150`][r2] | PR | success | Included. |
| [`31704718065`][r3] | push | success | Included. |
| [`31705253722`][r4] | PR | success | Included. |
| [`31705343220`][r5] | PR | success | Included. |
| [`31706849971`][r6] | push | failure | Successful lane jobs included; failed `Lint` attributed below. |
| [`31707587333`][r7] | PR | success | Included. |
| [`31707670380`][r8] | PR | success | Included; global-input change legitimately produced zero-hit tails. |
| [`31710029391`][r9] | push | failure | Successful lane jobs included; failed `Lint` attributed below. |
| [`31711092998`][r10] | PR | cancelled | Successful lane jobs included; failure and supersession cancellation attributed below. |

The window runs from 2026-08-13 12:55:05Z through 14:59:50Z. This satisfies
the packet's explicit wave-count alternative, not its representative-week
alternative.

## Flake and cancellation attribution

| Run / job | Record | Attribution | Percentile treatment |
| --- | --- | --- | --- |
| [`31706849971`][r6] / `94471485440` | `Lint` failure | GitHub-hosted runner received a shutdown signal; lane exited 130 after repository work had begun. Infrastructure flake. | Excluded. |
| [`31710029391`][r9] / `94480274346` | `Lint` failure | Same GitHub-hosted shutdown/exit-130 signature. Infrastructure flake. | Excluded. |
| [`31711092998`][r10] / `94483991020` | `Coverage Regression` failure | Real test failure: `window is not defined` during `HeroVideo.tsx` Atom registry teardown. The next PR head contains the targeted fix. | Excluded. |
| [`31711092998`][r10] / `94483991280` | `Test Unit` cancelled | Lane and cleanup steps succeeded, but the job record was cancelled because a higher-priority run for the same PR merge ref superseded it. | Excluded. |

There are no later-attempt job records in this corpus. The two runner shutdowns
and one repo-test failure remain visible as attribution; none are laundered
into the duration or cache percentiles.

## Cache interpretation

The cache is functioning, not collapsing. Repeated graphs reached 96.9% task
hits in `Test Integration`, while the zero-hit PR waves changed root graph
inputs and deleted packages; their logs still report remote caching enabled.
Those are valid tail cases. `Coverage Regression` remains structurally
expensive because coverage tasks are force-executed/cache-bypassed. `Lint`
also runs a wall of non-Turbo helpers beside its Turbo task, so a 127/131-hit
push still took 24.3 minutes. P1 must therefore target graph/helper placement
and sharding rather than interpreting a low aggregate percentage as a cache
transport outage.

[seed]: https://github.com/beep-effect/beep-effect/actions/runs/31697910572
[r1]: https://github.com/beep-effect/beep-effect/actions/runs/31702329770
[r2]: https://github.com/beep-effect/beep-effect/actions/runs/31702538150
[r3]: https://github.com/beep-effect/beep-effect/actions/runs/31704718065
[r4]: https://github.com/beep-effect/beep-effect/actions/runs/31705253722
[r5]: https://github.com/beep-effect/beep-effect/actions/runs/31705343220
[r6]: https://github.com/beep-effect/beep-effect/actions/runs/31706849971
[r7]: https://github.com/beep-effect/beep-effect/actions/runs/31707587333
[r8]: https://github.com/beep-effect/beep-effect/actions/runs/31707670380
[r9]: https://github.com/beep-effect/beep-effect/actions/runs/31710029391
[r10]: https://github.com/beep-effect/beep-effect/actions/runs/31711092998
