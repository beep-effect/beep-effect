---
title: "Check-run measurements: the 60-job peak, 70 jobs per full run and main pre-job waits are settled; the cancel actor and 7-day p95s are not"
date: 2026-11-13
lane: "claude/amazing-swirles-67011b"
reversal: "If the scorecard's 7-day reads contradict these two days, cite the scorecard and restate this decision; the research note stays as evidence."
---

Another session measured Check runs on 2026-11-10 (day A, first day on the final shard layout) and 2026-11-12 (day B, after the cancel ban) against a 2026-11-09 baseline and handed the results to the certainty packets on the operator's instruction. They are filed as `research/2026-11-13-check-run-queue-day-measure.md`. Its clock runs from a run's first job start to the `Test Unit` and `Heavy / Test Integration` aggregate verdicts: it is not the scorecard's push-to-green clock and excludes the wait before the first job. Limits: three runs missing on HTTP 502 and re-run attempts mixed by `filter=latest`.

What it settles for this goal:

- The hosted concurrency cap: a peak of exactly 60 concurrent hosted jobs on all three days, with 78 to 257 minutes per day at 55 or more. That bounds the documented ~60 ceiling from below without an admin read; the replay (slice 2) runs at 60 as the SPEC says, and a higher ceiling is not supported by any reading.
- Jobs per run: every main push run that started a job had 44 test shards (24 Test Unit + 20 Test Integration) and 69 to 71 hosted jobs; the median full run on day B had 70 hosted jobs and 44 test shards. This replaces #3046's commit-message estimate of about 75 as the replay's per-run input, pending a scorecard row.
- Wait before the first job on main pushes: median 5.6 and p90 16.3 min on day A, median 4.2 and p90 13.8 min on day B (baseline median 7.0, p90 36.0). This is the queue a throughput layout and re-dispatch compete in.
- Main push cancels: 14 of 20 runs cancelled on day A, 11 of 20 on day B. Derived from the sender's per-run table: 13 of 14 and 11 of 11 were cancelled before any job started (one day A run had 69 jobs). Runs cancelled before their first job match GitHub's replacement of the one pending run per group (decision `rerun-api-cancelled-push-runs`), the pattern `goals/ci-lane-economics` found (82 of 100) and the reason D7's 55 to 65% estimate is at risk.

What it does not settle:

- The cancel actor. Day B is after the ban (#3111, guard #3140), but the measurement does not separate concurrency supersession from an agent cancel, so day B's 11 cancels are not evidence of a ban violation, and the zero-agent-cancel acceptance stays unread. The actor is still the missing field (decision `scorecard-field-census`).
- PR first-wave pickup p95 and heavy-wait p95 over 7 days. Two single days in five-hour bursts, on a first-job clock, are not the scorecard's populations, so slice 2 stays held under SPEC "Stop Conditions" and none of these numbers is an acceptance read.
- The main verdict rate: verdicts per run, not per non-docs first-parent SHA; the history note `2026-11-13-pre-ban-main-verdict-rate` is the scorecard read.

Statements in other packets the measurements bear on (not edited here; their next PRs can cite the research note):

- `goals/hosted-setup-tax/SPEC.md`: the decision that job removals precede `merge-group-parity` calls the ~60 concurrent hosted job ceiling unverified, and its reversal waits on "the scorecard measures the hosted concurrent-job ceiling"; a 60 peak was observed on three days. Its "ROUT-01 and HOST-07 are one lever" constraint says the Test Plan job's own setup "the exploration did not measure" is netted in the scorecard: the Test Plan ran a median 1.2 min on pull requests on both days.
- `goals/heavy-pool-diet/SPEC.md`: the job-ceiling constraint (HOST-08 lands "inside the unverified ~60 concurrent hosted job ceiling") and the HOST-08 steady-state rule: slowest shard per full run median 8.7 / 8.4 min, p90 9.9 / 9.7 min; shards of 10 min or longer in 2 and 3 runs, the worst a `law-practice-6` leg of 16.9 min on a main push that ran 5 to 7 min in 26 other runs; runner waits cost a median 2.4 / 2.2 min and p90 8.9 / 9.6 min per full run, and no full run whose shards waited 1 min or more met 10 min.
- `goals/heavy-pool-diet` and `goals/certainty-scorecard`, the admission-to-Heavy and heavy-wait rows: the hosted `Heavy / Test Integration` aggregate waited for a hosted runner after its last shard finished, p90 5.0 min (day A) and 8.7 min (day B), maximum 10.6. That is hosted-pool wait inside a `Heavy / ` context, which the pre-#3144 `admissionToHeavy` row timed; #3144 moves the row to heavy-pool pickup.
- `goals/certainty-scorecard/SPEC.md`: "Inherited risks" says the ~60 ceiling "is documented, not measured, and the scorecard does not claim it", and `CI_CERTAINTY_NOT_COVERED` lists "the hosted concurrent-job ceiling (no admin read)": the observed peak is now a lower bound it can cite. The "Numbers the scorecard reports" row for hosted jobs per run (replay input) has two days of measured values to calibrate against. Its "Test Integration partition setup versus body" not-covered entry is unchanged: the note reports per-shard run time, not setup.
Source: research note `research/2026-11-13-check-run-queue-day-measure.md`; the sender's report, day summaries, baseline summary and per-run tables (outside the repository).
