---
title: "The census reports verdict wait per required context and measures Test Integration by its shards"
date: 2026-11-13
lane: "fix/ci-lane-census-verdict-wait"
reversal: "Drop the Test Integration lane spec and judge the P3 state on duration p95 alone; the wait columns may stay as information."
---

The bounded census (`beep ci lane-timings --window`) now records `verdictWaitSeconds` on every attempt-one successful row: the workflow run's `created_at` to the reporting job's `completed_at` (the aggregator for a sharded lane, the job itself otherwise). That is what an author or the merge gate waits for: run-level queueing (main's concurrency group), `needs` chains, runner pickup and the body. The duration table gains `Wait p50` and `Wait p95`. A lane's P3 state is `Breach` when either the duration p95 or the wait p95 is 20m00s or more, and the cell names the measure (`Breach (wait)`, `Breach (duration, wait)`). Like pickup, the wait exists only on attempt-one rows; it reads `created_at`, never the re-dispatch-rewritten `run_started_at`. The duration columns are unchanged, and the TSV adds the column last.

The shard pickup tripwire follows the operator decision of the same day (`2026-11-13-shards-overflow-to-the-self-hosted-pool-only-past-a-10-minute-hosted-wait.md`): it moves from 5m00s to 10m00s. The census chooses the limit by the window from a dated table, the way it chooses ratified populations: a window whose `--since` is before 2026-11-13T00:00:00Z is judged against 5m00s and a window starting at or after it against 10m00s. The Markdown tripwire line prints the limit that applied, so windows 1 to 4 and the earlier previews re-render as they were written.

`Test Integration` is now an effective lane like `Lint` and `Test Unit`: aggregator `Heavy / Test Integration`, planned by `Test Plan`, with the shard layouts of #3005 (sixteen `lps-int` shards and `int-rest`, merged 2026-11-09T17:15:26Z) and #3029 (nineteen and `int-rest`, merged 2026-11-10T00:52:58Z). A run created before #3005 merged is measured as heavy.yml's single job, so earlier windows read as they did. Its shards join the pickup population. Property Laws is not a required context and stays out.

**Evidence.** On main run 43370160740 every hosted job waited 10 to 16 minutes for a runner, and the run waited 7m47s between its `created_at` and its first job's `created_at`; none of that was in any duration p95. The 2026-11-13 preview measured `Test Integration` as its aggregate job alone (p50 0m03s). A two-hour preview (`2026-11-13T04:00Z` to `06:00Z`, before and after read concurrently at 06:15Z): before, only `Test Unit` breached (24m55s p95); after, `Test Integration` reads 11m53s p50 and 21m03s p95 by its shards, nine of fifteen contexts breach on wait p95 (`Lint` 37m00s, `Test Unit` 41m26s, `Test Integration` 35m36s), and shard pickup n rises from 681 to 902.

**Consequence.** Window 5 is judged on wait p95 as well as duration p95: a required context passes only when both are under 20m00s.
