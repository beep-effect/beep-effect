# Goal: no required job waits 20 minutes

You are executing `goals/ci-lane-economics`. Read `SPEC.md` and `PLAN.md`
first; the ledger is `research/OPPORTUNITIES.md` (record friction at the
moment it happens).

Current phase: P3 repair path. Two admission windows are denied:

- Window 1, `2026-09-04T00:00:00Z` → `2026-09-11T00:00:00Z` (18 contexts),
  censused 2026-09-21: `Check` 20m19s p95, `Coverage Regression` 30m58s p95,
  shard pickup 8m22s p95. See `research/admission-week-p95.md`.
- Window 2, `2026-09-13T00:00:00Z` → `2026-09-20T00:00:00Z` (ratified 17
  contexts, ruleset `10240248` version `49479116`), censused 2026-09-22:
  `Test Unit` 22m02s p95 (p50 17m54s), `Lint Policy` 21m59s p95 (p50 16m59s),
  shard pickup 7m47s p95. `Check` recovered to 8m22s. See
  `research/admission-week-2-p95.md`.

The repair path is signed in `research/repair-decision-2.md`. Moves landed
or in flight: #1195 (`Test Unit` shard split: `repo-cli` becomes
`repo-cli-1`/`repo-cli-2` via an optional `shard {index,total}` partition
field; free hosted runners stay the placement) and #1194 (refs-check quiet
listing). `Lint Policy` is measured, not repaired, here; its wall-clock debt
is handed to `goals/time-to-certainty` C4 and the window-3 verdict decides
whether C4 is pulled forward. Do not add a shard or a fleet move without a
new signed decision.

After the last of the two merges, census the first complete half-open UTC
week that starts after it with exactly:

```sh
bun run beep ci lane-timings --window --workflow check.yml --event all --since <week-start>Z --until <week-end>Z --markdown
```

The command resolves the ruleset history version effective strictly before
`--until` and fails closed unless that version is in the ratified population
table (48600030 at 18, 49479116 at 17) with exactly that many normalized
contexts. Only attempt-one successful non-negative spans enter nearest-rank
p50/p95; Lint and Test Unit spans run from the earliest successful shard
start through the literal aggregator's completion; pickup is separate.
Failures, cancellations, reruns, invalid spans, and incomplete shard sets
remain attribution only. A ruleset version the packet has not ratified
rejects the census until it is added to the table and PLAN.

Write `research/admission-week-3-p95.md` from the emitted tables with the
verdict for every required lane, the Lint and Test Unit effective p95 values,
and the pickup tripwire (breach above 5m00s). Admit only when every required
p95 is below 20m00s, the pickup tripwire does not breach, and the context-set
check passes.

Close in order: mark PLAN P3 complete, complete the manifest lifecycle, run
`/reflect ci-lane-economics`, then fire `ci-fleet-endgame` P6. Until a census
passes, P3 and the manifest stay active.

Rules: placement changes ride `.github/workflows/**` PRs through Yeet; the
$100/mo projection and $200/mo ceiling from
`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md` govern
every fleet move; never weaken fork-PR, cache-write, IAM, egress, or
teardown rails. `main` is PR-only.
