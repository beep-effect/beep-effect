# Check run queue: two measured days after the final shard layout

Filed 2026-11-13 by `main-verdict-every-commit`. The measurements were taken by the session that ran the
test-speed lanes (a scheduled day-measure script over the GitHub Actions REST API, run by hand on 2026-11-13
after its scheduled run hit a model usage limit) and handed to the certainty packets on the operator's
instruction. This note restates its figures; the per-run tables and cached job lists stay outside the
repository. The decision `check-run-queue-measurements` says what the figures settle for this goal.

Every figure is **VERIFIED** (read from job `created_at`, `started_at` and `completed_at` timestamps) unless
marked **INFERRED**. The derived counts marked "derived here" were computed by this packet from the sender's
per-run table (hosted job count, shard count and conclusion per run), not from new API reads.

## Windows

| Window | UTC span | Layout |
| --- | --- | --- |
| baseline | 2026-11-09T02:00Z to 2026-11-10T02:00Z | mostly older shard layouts; #3043, #3048 and #3046 merged 02:18Z to 02:22Z on 2026-11-10, just after it |
| day A | 2026-11-10T04:00Z to 2026-11-11T04:00Z | first day on the final layout (after #3056) |
| day B | 2026-11-12T00:00Z to 2026-11-13T00:00Z | same layout; after the main cancel ban (#3111, 2026-11-10) |

## Clock

The verdict clock runs from the **first job start of the run** to the completion of the `Test Unit` aggregate
and, separately, the `Heavy / Test Integration` aggregate. It is not the certainty scorecard's
push-to-every-required-context-green clock (`beep ci certainty`), and it excludes the wait between run creation
and the first job. Main push runs report that pre-first-job wait separately (below). A "full run" has 50 or
more hosted jobs; a "narrow run" fewer.

## Verdicts within 10.0 minutes of the first job start (VERIFIED)

| | baseline | day A | day B |
| --- | --- | --- | --- |
| Test Unit, full runs | 5 of 58 (9%) | 5 of 30 (17%) | 7 of 24 (29%) |
| Test Unit, narrow runs | 38 of 79 (48%) | 17 of 18 (94%) | 8 of 18 (44%) |
| Heavy / Test Integration, full runs | 14 of 54 (26%) | 19 of 32 (59%) | 8 of 26 (31%) |
| Heavy / Test Integration, narrow runs | 26 of 43 (60%) | 17 of 18 (94%) | 17 of 21 (81%) |
| Test Unit, push to main | 1 of 18 (6%) | 1 of 6 (17%) | 4 of 9 (44%) |
| Heavy / Test Integration, push to main | 0 of 16 (0%) | 2 of 6 (33%) | 5 of 9 (56%) |

Day B's seven narrow-run Test Unit misses (first attempts) were all `repo-cli`-only runs with a floor of 9.4
to 9.9 minutes.

## Where the time goes, full runs, first attempts only (VERIFIED)

"Floor" is Test Plan run time plus the slowest shard plus the aggregate job: the verdict time with no runner
wait.

| | day A | day B |
| --- | --- | --- |
| Test Unit floor, median / p90 (min) | 10.0 / 11.1 | 9.6 / 11.2 |
| Test Unit runs whose floor is within 10 min | 15 of 30 | 19 of 24 |
| Heavy / Test Integration floor, median / p90 (min) | 4.6 / 9.7 | 9.0 / 10.1 |
| Minutes lost to runner waits, median / p90 | 2.4 / 8.9 | 2.2 / 9.6 |
| Slowest shard per run, median / p90 (min) | 8.7 / 9.9 | 8.4 / 9.7 |
| Test Plan run time on pull requests, median (min) | 1.2 | 1.2 |
| Max shard queue wait per run, median / p90 / max (min) | 2.6 / 8.5 / 11.0 | 1.7 / 9.3 / 15.5 |

- No full run whose shards waited 1 minute or more met the 10-minute mark: 0 of 19 (day A), 0 of 14 (day B).
- The `Heavy / Test Integration` aggregate job waited for a hosted runner after its last shard had finished:
  p90 5.0 minutes (day A), 8.7 minutes (day B), maximum 10.6.
- Shards of 10 minutes or longer: 2 runs on day A (maximum 11.1), 3 on day B (maximum 16.9, one
  `law-practice-6` run on a main push at 22:03Z; the same shard ran 5 to 7 minutes in 26 other runs). The
  baseline had 80 such runs (slowest shard median 10.7, p90 30.8, maximum 39.2) on the older layouts.

## Hosted pool (VERIFIED)

| | baseline | day A | day B |
| --- | --- | --- | --- |
| Check runs created | 199 | 67 | 64 |
| Hosted job-minutes as share of 60 slots, whole day | 38% | 10% | 11% |
| Hours above 70% | 1 | 2 (05:00, 07:00) | 2 (22:00, 23:00) |
| Minutes with 55 or more hosted jobs | 257 | 87 | 78 |
| Peak concurrent hosted jobs | 60 | 60 | 60 |

Day A's activity fell in one burst from 04:00 to 08:00Z, day B's from 19:00 to 24:00Z. Inside those five hours
the pool averaged 49% and 47% occupied and sat at 55 or more jobs for 29% and 26% of the minutes. Busiest
hour: 07:00Z with 24 runs (day A), 23:00Z with 25 runs (day B).

## Jobs per run (derived here from the per-run table)

| | day A | day B |
| --- | --- | --- |
| Full runs | 33 | 27 |
| Hosted jobs per full run, median (range) | 53 (50 to 72) | 70 (50 to 71) |
| Test shards per full run, median (values seen) | 25 (25, 37, 44) | 44 (25, 44) |

A run that allocates every Test Unit and Test Integration partition (24 + 20) shows 44 shards. Every main push
run that started a job had 44 shards and 69 to 71 hosted jobs (7 runs on day A, 9 on day B); pull-request runs
reached 44 shards in 6 runs on day A and 11 on day B.

## Main push runs (VERIFIED)

| | baseline | day A | day B |
| --- | --- | --- | --- |
| Runs | 51 | 20 | 20 |
| Cancelled / failed / green | 37 / 7 / 7 | 14 / 5 / 1 | 11 / 5 / 4 |
| Runs that produced both verdicts | 15 | 6 | 9 |
| Both verdicts within 10 min of first job | n/a | 1 | 4 |
| Creation to first job, median / p90 / max (min) | 7.0 / 36.0 / 71.1 (n=25) | 5.6 / 16.3 / 19.2 (n=7) | 4.2 / 13.8 / 14.8 (n=9) |

Derived here: of the cancelled main push runs, 13 of 14 on day A and 11 of 11 on day B list no job in the
attempt read, so they were cancelled before any job started; one day A run had 69 jobs when it was cancelled.
**INFERRED:** a run cancelled before its first job is consistent with GitHub's concurrency supersession of a
pending run (one pending run per group, `queue: single`), but the measurement does not record who or what
cancelled a run, so it cannot separate supersession from an agent cancel.

## Admission control (INFERRED, the sender's reading)

Saturation is not the normal state over a day, but it is the normal state in the hours when work happens. A
limit on runs in flight would not reach the 10-minute target: it cannot help runs whose floor is already over
10 minutes, and because this clock starts at a run's first job, it moves the wait before the clock without
shortening the time from push to verdict.

## Limits

- Runs skipped after repeated HTTP 502 on their job lists: 42771798035 (day A); 43289409901 and 43330358554
  (day B). The baseline missed four runs the same way (42669948388, 42690710476, 42699445858, 42710453722).
- The script reads each job's latest attempt (`filter=latest`), so 1 re-run on day A and 6 on day B mix
  attempts. The headline tables include them; the floor table excludes them.
- Neither day had activity outside one five-hour burst, so there is no measurement of a day-long steady load.
- Two single days, not a 7-day window: none of these figures is a p95 of the scorecard's populations, and
  none replaces a scorecard read.
