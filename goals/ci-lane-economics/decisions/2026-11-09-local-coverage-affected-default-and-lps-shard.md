---
title: "Bare local coverage defaults to the affected plan; law-practice-server gets its own shard"
date: 2026-11-09
lane: "claude/fervent-darwin-040f12"
reversal: "Delete resolveCoverageScopeMode's affected branch in Tasks.ts so a bare run resolves through resolveCoverageTaskOptions again (and drop the --full flag), and restore the #707/#684 weight tables in CoverageScope.ts; no baseline rows or hosted workflows changed."
---

Tier 1 of the 2026-11-09 test/coverage efficiency plan (41-agent workflow, HEAD 33b9f1cb31).

**P9.** A bare local `bun run coverage` is no longer the full proof. Outside CI, with none of `--filter`, `--since`, `--affected`, `--write-baseline`, `--replace-all`, `--add-missing-files-only` or the new `--full`, the root task plans `--affected` against `TURBO_SCM_BASE` or the origin/main merge base, the same plan `yeet final-check` runs, and prints the base and the owners (or the full-fallback reason) on `[beep-cli]` lines. `--full` is the sharded whole-workspace proof; CI keeps it as the default. Hosted Test Unit remains the proof of record; nothing under `.github/workflows` changes and `coverage:baseline:write` is untouched. EF-20 names only `bun run test`, so no done-gate amendment is needed.

**P5a.** The shard weight tables from #684 (run 31727475076) and #707 (run 31766791221) weighed `@beep/law-practice-server` at 51.7 and 103.9 s; the 2026-11-09 baseline showed shard-4 (law-practice-server plus 24 packages at one Vitest worker) still running at 1778 s while repo-cli's shard finished at 1205 s. No hosted run exposes per-task coverage durations any more (hosted coverage is produced inside the Test Unit partitions; the Heavy / Coverage Regression job is the comparator), so one measured local table replaces both: 190 packages from the baseline run's Turbo summaries and law-practice-server from one solo run at the shard topology (2679.9 s wall, 4692.7 s user + 543.9 s system, load average 28 rising to 61). With those weights the unchanged least-loaded planner gives law-practice-server and repo-cli their own shards and spreads the other 189 owners over eight mixed shards of about 252 s each. Shard count (10) and the Vitest worker cap (11) are unchanged; a second worker for law-practice-server stays tier 3 because it breaks writer/judge topology parity.

Measured on the 64-thread workstation under contention; the values are upper bounds and influence placement only.
