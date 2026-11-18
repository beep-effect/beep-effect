# Interim heavy-lane readings, 2026-11-13

Interim only. These are read from GitHub job records, not from the certainty scorecard, so none of them is an
acceptance number (SPEC "Acceptance Criteria"; PLAN execution note "Not blocked"). They close P0's exit
criterion and show the direction of the levers that have landed.

## Method

- Source: `GET /repos/{owner}/{repo}/actions/runs/{id}/jobs?filter=all` for `check.yml` `pull_request` runs,
  every attempt.
- Before window: runs created 2026-11-08T21:00Z to 2026-11-09T21:00Z, the 24 hours before #3019 (LINT-01 and
  LINT-04, merged 2026-11-09T21:03Z), the first diet lever. Run list: the runs whose `Heavy / Check` succeeded in
  `bun run beep ci lane-timings --window --preview --workflow check.yml --event pull_request` for that window
  (48 runs).
- After window: runs created 2026-11-13T01:10Z to 2026-11-13T21:00Z, after #3135 (LINT-05, merged
  2026-11-13T01:02Z); completed runs that concluded success or failure (193 listed, 191 read).
- Unread: three before-window runs (42642253640, 42646019844, 42669948388) and one after-window run
  (43446615435) returned HTTP 502 on a jobs page on every retry; the before-window rows keep whatever their
  first page returned, the after-window run is left out. One other after-window run had no matching job.
- Wall is `completed_at - started_at` of jobs that concluded success or failure. It leaves out VM boot and
  queue time, so it is not the scorecard's slot-minute figure. Pickup is `started_at - created_at`.
- "Five-lane wall" sums Lint Policy, Check, Docgen, Doctest and Build on `beep-ec2-heavy` for run attempts where
  all five concluded.
- The after window straddles both baseline breaks of 2026-11-13 (d8326d55935 and 3e822c71c5), so its Check and
  Build walls mix the two build layouts.
- The lane-timing census has no Lint Policy or Build row, which is why the job records were read directly.

## Readings (minutes)

| Job | Before n | Before wall p50 | Before wall p95 | After n | After wall p50 | After wall p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Heavy / Lint Policy | 43 | 12.1 | 15.8 | 98 | 4.9 | 8.2 |
| Heavy / Check | 56 | 1.3 | 2.5 | 98 | 1.2 | 1.9 |
| Heavy / Docgen | 57 | 2.4 | 6.2 | 98 | 2.5 | 9.2 |
| Heavy / Doctest | 55 | 1.8 | 3.0 | 98 | 1.8 | 2.6 |
| Heavy / Build | 55 | 1.2 | 2.1 | 98 | 1.1 | 1.5 |
| JSDoc Ratchet (hosted) | 53 | 5.8 | 6.3 | 162 | 2.3 | 2.6 |
| Heavy Admission (hosted) | 58 | 1.2 | 1.4 | 187 | 1.2 | 1.5 |

| Per run attempt | Before | After |
| --- | --- | --- |
| Five-lane wall, n | 43 | 98 |
| Five-lane wall, mean / p50 / p95 | 20.3 / 19.3 / 27.9 | 13.1 / 12.5 / 21.3 |
| Lint Policy share of the five-lane wall, mean | 41% | 43% |
| Heavy Admission start to first heavy-pool lane start, n | 57 | 98 |
| Heavy Admission start to first heavy-pool lane start, p50 / p95 | 1.9 / 87.2 | 1.5 / 33.6 |
| Lint Policy pickup, p50 / p95 | 0.8 / 115.4 | 0.9 / 32.5 |

## What it says

- Lint Policy wall p50 fell from 12.1 to 4.9 minutes and p95 from 15.8 to 8.2. The before p50 matches the 12.1
  minutes the SPEC quotes. The acceptance bar is a scorecard p95 of at most 9 minutes over seven days; this
  one-day reading is under it but does not replace it.
- The five-lane job wall per run attempt fell about 35% at p50 (19.3 to 12.5). The acceptance bar is 20% on
  slot-minutes with VM boot included, which only the scorecard reads.
- Heavy Admission's own wall is unchanged at 1.2 minutes: the workspace install is still there until slices 9
  to 11 move admission onto the pinned binary.
- Queue pickup p95 fell from about 115 to about 33 minutes, but the two windows carried different traffic and
  Test Integration left the pool on 2026-11-09 (#3005), so this is not attributable to the diet alone.
- JSDoc Ratchet's hosted wall fell from 5.8 to 2.3 minutes p50 (LINT-01).
