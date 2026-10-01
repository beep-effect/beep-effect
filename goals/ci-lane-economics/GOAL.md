# Goal: no required job waits 20 minutes

You are executing `goals/ci-lane-economics`. Read `SPEC.md` and `PLAN.md`
first; the ledger is `research/OPPORTUNITIES.md` (record friction at the
moment it happens).

Current phase: P3 repair path. Three admission windows are denied
(`research/admission-week-p95.md`, `admission-week-2-p95.md`,
`admission-week-3-p95.md`). Window 3 (`2026-09-23` → `09-30`, ratified 16
contexts, ruleset `10240248` version `50918272`) breached `Test Unit` 35m00s,
`Lint` 29m16s, and pickup 23m58s. Shard bodies held; the breach is
hosted-runner queue saturation under agent fan-out from 09-25.

The repair is signed in `research/repair-decision-3.md`: the charter covers
load the orchestration doctrine admits, and the doctrine admits at most six
CI-active branches (a queued or in-progress `check.yml` run; `main` counts).
Build the governor as its own code PR, schema first: one
`beep ci slots acquire` called from a lefthook `pre-push` hook and from PR
creation, reading live `gh api` counts, acting only on `main` or a ref with
an open PR, waiting with backoff up to ~30 minutes, then a typed "held: CI
slots full" exit. Add a per-UTC-day peak CI-active branches column to
`beep ci lane-timings --window`. Option C is deferred, B is reserve, D is
rejected. Do not add a shard or a fleet move without a new signed decision.

Window 4 is the first complete half-open UTC week that starts after the
governor PR merges. Never census it before its end; a partial window is a
preview and never admits (`--window` refuses a future `--until` or a span
under seven days unless `--preview`, and since #1369 refuses a window that a
ruleset change straddles). Census it with exactly:

```sh
bun run beep ci lane-timings --window --workflow check.yml --event all --since <start> --until <start+7d> --markdown
```

The command fails closed unless the ruleset version effective before
`--until` is in the ratified population table with exactly that many
normalized contexts; ratify a new version in the table and PLAN first. Only
attempt-one successful non-negative spans enter nearest-rank p50/p95; Lint
and Test Unit spans run from the earliest successful shard start through the
aggregator's completion; pickup is separate.

Write `research/admission-week-4-p95.md` with the verdict for every required
lane, the Lint and Test Unit effective p95, the `repo-cli` halves, the pickup
tripwire (breach above 5m00s), and the per-day peak branches. Admit only when
every required p95 is below 20m00s, pickup does not breach, the context-set
check passes, and at least one day peaks at five or more branches; a quieter
week is "pass, unexercised" and the census moves to the next week. A breach
on a day peaking at six or fewer branches calls for a costed option B; a
breach only above six is a governor leak to fix.

Close in order: mark PLAN P3 complete, complete the manifest lifecycle, run
`/reflect ci-lane-economics`, then fire `ci-fleet-endgame` P6.

Rules: placement changes ride `.github/workflows/**` PRs through Yeet; the
$100/mo projection and $200/mo ceiling from
`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md` govern
every fleet move; never weaken fork-PR, cache-write, IAM, egress, or
teardown rails. `main` is PR-only.
