# Goal: no required job waits 20 minutes

You are executing `goals/ci-lane-economics`. Read `SPEC.md` and `PLAN.md`
first; the ledger is `research/OPPORTUNITIES.md` (record friction at the
moment it happens).

Current phase: P3 repair path. Three admission windows are denied:

- Window 1 (`2026-09-04` → `09-11`, 18 contexts): `Check`, `Coverage
  Regression`, and pickup breached (`research/admission-week-p95.md`).
- Window 2 (`2026-09-13` → `09-20`, 17 contexts): `Test Unit`, `Lint
  Policy`, and pickup breached (`research/admission-week-2-p95.md`).
- Window 3, `2026-09-23T00:00:00Z` → `2026-09-30T00:00:00Z` (ratified 16
  contexts, ruleset `10240248` version `50918272`, `Lint Policy` removed
  2026-09-25T14:46:59Z), censused 2026-10-01: `Test Unit` 35m00s p95, `Lint`
  29m16s p95, shard pickup 23m58s p95. Shard bodies held (repo-cli-1/2 p95
  748 s/735 s); the breach is hosted-runner queue saturation under agent
  fan-out from 09-25. See `research/admission-week-3-p95.md`. The next move
  is proposed, unsigned, in `research/repair-decision-3-proposed.md`; window
  4 is the first complete half-open UTC week after a signed move merges.

The repair path is signed in `research/repair-decision-2.md`. Moves: #1195
(`Test Unit` shard split: `repo-cli` becomes `repo-cli-1`/`repo-cli-2` via
an optional `shard {index,total}` partition field; free hosted runners stay
the placement) merged 2026-09-22T12:49Z; #1194 (refs-check quiet listing)
merged 2026-09-22T16:34Z. `Lint Policy` left the required set on
2026-09-25 and window 3 did not measure it, so the C4 trigger is unresolved:
the debt stays with `goals/time-to-certainty` C4 at its own pace. Do not add a shard or a fleet
move without a new signed decision.

Window 3 is the first complete half-open UTC week that starts after the last
merge: `2026-09-23T00:00:00Z` → `2026-09-30T00:00:00Z`. Do not census it
before 2026-09-30T00:00Z; a run over a partial window is a preview and never
an admission. The command enforces that: `--window` refuses an `--until` in
the future or a span under seven days unless `--preview` is passed, and
preview output carries a banner that never admits. Census it with exactly:

```sh
bun run beep ci lane-timings --window --workflow check.yml --event all --since 2026-09-23T00:00:00Z --until 2026-09-30T00:00:00Z --markdown
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
the two `repo-cli` halves reported separately, and the pickup tripwire
(breach above 5m00s). Admit only when every required p95 is below 20m00s,
the pickup tripwire does not breach, and the context-set check passes.

Close in order: mark PLAN P3 complete, complete the manifest lifecycle, run
`/reflect ci-lane-economics`, then fire `ci-fleet-endgame` P6. Until a census
passes, P3 and the manifest stay active.

Rules: placement changes ride `.github/workflows/**` PRs through Yeet; the
$100/mo projection and $200/mo ceiling from
`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md` govern
every fleet move; never weaken fork-PR, cache-write, IAM, egress, or
teardown rails. `main` is PR-only.
