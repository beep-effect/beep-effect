# P3 admission-week p95 census, window 3 — 2026-09-23 to 2026-09-30

## Verdict

**Admission denied. P3 and the manifest stay active.** The first complete
half-open UTC week after the last repair merge (#1194, 2026-09-22T16:34Z),
`2026-09-23T00:00:00Z` through `2026-09-30T00:00:00Z`, was censused on
2026-10-01 with the canonical command. It fails on three counts:

- `Test Unit`: **35m00s p95** (p50 12m21s, max 55m45s).
- `Lint`: **29m16s p95** (p50 5m46s, max 63m24s).
- Shard-pickup queue tripwire: **23m58s p95**, against a 5m00s limit
  (n=5244 shard pickups).

The other fourteen required lanes pass. The context-set check passed at
exactly 16 against ruleset `10240248` version `50918272` (effective
2026-09-25T14:46:59.802Z), which the census command did not yet know. It
failed closed by name, and this census ratified it (see "Population").

The repairs held. The shard bodies are flat and inside their projection. The
breach comes from the runner queue: run volume rose 10–25× from 2026-09-25
onward, and shards waited up to 59 minutes for a free hosted runner. The two
quiet days before the surge (09-23, 09-24) clear every gate.

## Command and reproduction

```sh
bun run beep ci lane-timings --window --workflow check.yml --event all --since 2026-09-23T00:00:00Z --until 2026-09-30T00:00:00Z --markdown
```

- No `--preview`; the window was complete when the census ran.
- The first run exited 1 with `Ruleset 10240248 version 50918272 is not a
  ratified admission population.` The version was ratified at 16 contexts
  (below), and the rerun exited 0. The same command with `--tsv` produced
  18,727 rows and was used for the per-day and per-shard tables.
- No `gh api` retries were needed for the census itself. The shard pull
  below used up to three retries per run; none fired.

## Population

`gh api repos/beep-effect/beep-effect/rulesets/10240248/history` lists
`50918272` (2026-09-25T14:46:59.802Z) after `49479116`. Diffing the
`required_status_checks` contexts of the two versions shows exactly one
removal: `Heavy / Lint Policy`. The result is 16 contexts, and the live
ruleset matches. The same operator account authored both versions. No packet,
PR, or ledger entry recorded the change. Window 3 therefore straddles two
populations: 17 contexts for its first 2.6 days, then 16. The census
resolves the version in force at `--until` by design, so `Lint Policy` is out
of the admission table. The table in
`packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` now carries
`50918272 → 16`.

## Successful attempt-one durations

| Required lane | n | PR | Push | p50 | p95 | Max | P3 state |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Check | 259 | 196 | 63 | 2m53s | 9m28s | 10m42s | Pass |
| Codegen Drift | 743 | 678 | 65 | 2m31s | 4m45s | 14m37s | Pass |
| Commitlint | 747 | 692 | 55 | 1m32s | 2m14s | 2m48s | Pass |
| Docgen | 258 | 197 | 61 | 4m51s | 12m00s | 13m40s | Pass |
| Doctest | 298 | 233 | 65 | 2m57s | 5m37s | 6m39s | Pass |
| JSDoc Ratchet | 548 | 483 | 65 | 9m17s | 9m53s | 10m55s | Pass |
| Knip | 750 | 685 | 65 | 2m03s | 2m44s | 3m35s | Pass |
| Lint | 655 | 590 | 65 | 5m46s | **29m16s** | 63m24s | **Breach** |
| Nix Shell | 744 | 679 | 65 | 2m10s | 3m07s | 4m19s | Pass |
| Professional Desktop IPC Stdio | 782 | 717 | 65 | 0m37s | 3m47s | 5m13s | Pass |
| Repo Sanity | 640 | 576 | 64 | 4m40s | 6m46s | 13m11s | Pass |
| SAST | 746 | 681 | 65 | 2m00s | 3m19s | 5m00s | Pass |
| Secret Scanning | 763 | 698 | 65 | 1m14s | 3m37s | 5m07s | Pass |
| Security | 755 | 692 | 63 | 0m53s | 1m25s | 1m38s | Pass |
| Test Integration | 285 | 221 | 64 | 3m25s | 4m27s | 5m08s | Pass |
| Test Unit | 566 | 502 | 64 | 12m21s | **35m00s** | 55m45s | **Breach** |

`Lint` and `Test Unit` are effective spans: they run from the earliest
successful shard start through the literal aggregator's completion. Queue
time before the first shard starts is excluded and is reported separately as
pickup. Queue time for any later shard is included, because the span stays
open until that shard runs and the aggregator completes. Under saturation
the shards of one run start minutes apart, which stretches the span. That
effect, plus the separate pickup tripwire, is the queue signal below.

`Lint Policy` is not a required context under `50918272` and is not measured
here. Its window-2 handoff to `goals/time-to-certainty` C4 depended on a
window-3 measurement that this census does not provide, so the C4 trigger is
recorded as unresolved, not cleared.

## Test Unit shard halves

Attempt-one successful `Test Unit (…)` jobs from the 566 census-population
runs, taken from `gh api repos/beep-effect/beep-effect/actions/runs/<id>/jobs`
(2180 rows, 0 fetch errors). Duration is `completed_at − started_at`; pickup
is `started_at − created_at`. Percentiles are nearest-rank. Of the 566 runs,
28 returned no successful attempt-one shard job and are excluded.

| Shard | n | p50 | p95 | Max | Pickup p50 | Pickup p95 | Pickup max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| repo-cli-1 | 538 | 149 s | 748 s (12m28s) | 820 s | 92 s | 1650 s | 3184 s |
| repo-cli-2 | 538 | 148 s | 735 s (12m15s) | 1147 s | 84 s | 1680 s | 3391 s |
| unit-a | 538 | 131 s | 636 s (10m36s) | 734 s | 84 s | 1699 s | 3316 s |
| unit-b | 538 | 131 s | 627 s (10m27s) | 674 s | 86 s | 1677 s | 3563 s |

The p50 values are warm-cache runs. The p95 body times fall inside the
756–814 s cold projection in `repair-decision-2.md`, and the two halves are
balanced (13 s apart). The #1195 split did its job. Every shard's pickup p95
is about 28 minutes, which alone exceeds the 20-minute gate.

## Attempt-one failures and cancellations

| Required lane | Failures | Cancellations | Invalid spans | Incomplete shard sets |
| --- | ---: | ---: | ---: | ---: |
| Check | 20 | 309 | 0 | 0 |
| Codegen Drift | 0 | 131 | 0 | 0 |
| Commitlint | 11 | 116 | 0 | 0 |
| Docgen | 12 | 318 | 0 | 0 |
| Doctest | 0 | 290 | 0 | 0 |
| JSDoc Ratchet | 11 | 315 | 0 | 0 |
| Knip | 4 | 120 | 0 | 0 |
| Lint | 0 | 219 | 0 | 53 |
| Nix Shell | 0 | 130 | 0 | 0 |
| Professional Desktop IPC Stdio | 0 | 92 | 0 | 0 |
| Repo Sanity | 53 | 181 | 0 | 0 |
| SAST | 0 | 128 | 0 | 0 |
| Secret Scanning | 0 | 111 | 0 | 0 |
| Security | 21 | 98 | 0 | 0 |
| Test Integration | 3 | 300 | 0 | 0 |
| Test Unit | 16 | 292 | 0 | 53 |

## Later attempts

| Required lane | Success | Failure | Cancelled |
| --- | ---: | ---: | ---: |
| Check | 32 | 0 | 0 |
| Codegen Drift | 34 | 0 | 0 |
| Commitlint | 34 | 0 | 0 |
| Docgen | 30 | 1 | 1 |
| Doctest | 32 | 0 | 0 |
| JSDoc Ratchet | 34 | 0 | 0 |
| Knip | 34 | 0 | 0 |
| Lint | 34 | 0 | 0 |
| Nix Shell | 34 | 0 | 0 |
| Professional Desktop IPC Stdio | 34 | 0 | 0 |
| Repo Sanity | 34 | 0 | 0 |
| SAST | 34 | 0 | 0 |
| Secret Scanning | 34 | 0 | 0 |
| Security | 32 | 2 | 0 |
| Test Integration | 32 | 0 | 0 |
| Test Unit | 31 | 3 | 0 |

Queue tripwire: **Breach**. Shard pickup p95 is 23m58s, over the 5m00s limit
(n=5244).

## Attribution: queue saturation, by day

Each day is bucketed by `runCreatedAt` from the census TSV. Each row gives
the attempt-one successful p50/p95 and the shard-pickup p50/p95. Runs per
day come from the census TSV's unique run ids.

| UTC day | Runs | Test Unit p50 / p95 | Lint p50 / p95 | Pickup p50 / p95 (max) |
| --- | ---: | --- | --- | --- |
| 09-23 | 26 | 11m37s / 14m21s | 6m54s / 14m02s | 0m02s / 2m58s (5m36s) |
| 09-24 | 10 | 2m39s / 10m55s | 2m04s / 3m13s | 0m02s / 0m29s (1m08s) |
| 09-25 | 276 | 14m00s / **30m04s** | 6m48s / **24m06s** | 2m15s / **19m47s** (35m03s) |
| 09-26 | 77 | 6m21s / **37m56s** | 3m20s / **30m46s** | 0m31s / **34m29s** (45m04s) |
| 09-27 | 147 | 6m50s / **49m33s** | 9m17s / **35m48s** | 0m03s / **39m39s** (59m23s) |
| 09-28 | 174 | 12m08s / 16m29s | 3m26s / 15m10s | 0m03s / 4m29s (21m04s) |
| 09-29 | 112 | 13m22s / **35m32s** | 6m18s / **27m57s** | 1m12s / **23m05s** (35m37s) |

- On every breaching day the median stayed in band, and the tail tracked
  pickup minute for minute. This is the signature of a saturated runner
  pool, not a slower suite.
- Volume: `gh api .../actions/workflows/check.yml/runs` over the window lists
  927 run attempts (919 by the operator account). On 09-25 alone, 58
  distinct branches ran CI (347 attempts). The largest single source is the
  `codex/effect-vitest-*` canonicalization fan-out: 327 attempts across 44
  branches from 09-24 to 09-29, peaking at 140 on 09-27. Other concurrent
  lanes: `codex/qualification-*` (≈110), `refactor/schema-retire-*` (40),
  `codex/boolean-creep-*` (39), the Effect snapshot bump (36) and
  `feat/harness-evidence-*` (26).
- 09-28 nearly passes on its own (Test Unit 16m29s, Lint 15m10s, pickup
  4m29s) despite 174 runs, because pushes were spread across the day rather
  than bursty.
- Cancellations are high (309 on `Check`), consistent with
  `cancel-in-progress` replacing superseded pushes on busy branches. Those
  replacements add queue pressure without adding admitted samples.

## Consequences

- P3 stays `in progress`; `ops/manifest.json` stays `active`.
- Population `50918272 → 16` is ratified (PLAN note, `LaneTimings.ts`), so
  the next window needs no population work unless the ruleset changes again.
- `Lint Policy` left the required set, so it no longer gates admission. The
  C4 pull-forward trigger is unresolved (unmeasured), not cleared.
- Population caveat: the census applies the population in force at
  `--until` to the whole week, so the 2.6 days when `Lint Policy` was still
  required went unmeasured. The verdict does not depend on it, but a future
  window that straddles a ruleset change could pass without measuring a
  check that was required for part of it. A mid-window population warning in
  `beep ci lane-timings` is owed (ledger 2026-10-01).
- The remaining failure is hosted-runner concurrency under agent fan-out.
  Shard re-splits cannot fix it. The proposed (unsigned) next decision is
  `research/repair-decision-3-proposed.md`. No shard or fleet move is made
  without signing it.
