# Goal: no required job waits 20 minutes

You are executing `goals/ci-lane-economics`. Read `SPEC.md` and `PLAN.md`
first; the ledger is `research/OPPORTUNITIES.md` (record friction at the
moment it happens).

Current phase: P3, second admission window. The first window
(`2026-09-04T00:00:00Z` → `2026-09-11T00:00:00Z`, 18 contexts) was censused
2026-09-21 and denied: `Check` 20m19s p95, `Coverage Regression` 30m58s p95,
shard pickup 8m22s p95; see `research/admission-week-p95.md`. Lint and Test
Unit cleared at 14m38s and 16m31s.

The packet ratified ruleset `10240248` version `49479116` (effective
2026-09-12T01:46:53.354Z, `Heavy / Coverage Regression` removed) at exactly
17 contexts on 2026-09-22. The first complete half-open UTC week under it is:

`2026-09-13T00:00:00Z` → `2026-09-20T00:00:00Z`.

Census it with exactly:

```sh
bun run beep ci lane-timings --window --workflow check.yml --event all --since 2026-09-13T00:00:00Z --until 2026-09-20T00:00:00Z --markdown
```

The command resolves the ruleset history version effective strictly before
`--until`, fails closed unless that version is in the ratified population
table (48600030 at 18, 49479116 at 17) and exposes exactly that many
normalized contexts, paginates every Check run and job, and retains
run/event/head/time/attempt provenance. Only attempt-one successful
non-negative spans enter nearest-rank p50/p95. For Lint and Test Unit the span
runs from the earliest successful shard start through the successful literal
aggregator completion; pickup is separate. Failures, cancellations, reruns,
invalid spans, and incomplete shard sets remain attribution only.

Every required lane, `Check` included, enters the same 20m00s measurement. A
ruleset version the packet has not ratified rejects the census until a new
population is ratified in the table and in PLAN.

Write `research/admission-week-2-p95.md` from the emitted successful-duration
and attribution tables. Include the verdict for every required lane, the Lint
and Test Unit effective p95 values, and the shard-pickup queue tripwire (breach
when p95 is greater than 5m00s). Admit only when every required p95 is below
20m00s and the context-set check passes.

Close in order: mark PLAN P3 complete, complete the manifest lifecycle, run
`/reflect ci-lane-economics`, then fire `ci-fleet-endgame` P6. Until the census
passes, P3 and the manifest stay active.

Rules: placement changes ride `.github/workflows/**` PRs through Yeet; the
$100/mo projection and $200/mo ceiling from
`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md` govern
every fleet move; never weaken fork-PR, cache-write, IAM, egress, or
teardown rails. `main` is PR-only.
