# Goal: no required job waits 20 minutes

You are executing `goals/ci-lane-economics`. Read `SPEC.md` and `PLAN.md`
first; the ledger is `research/OPPORTUNITIES.md` (record friction at the
moment it happens).

Current phase: P3 evidence and repair decision. P0-P2 are complete: every
signed zero-expansion placement and lane-shape move is merged through PR #719.
The representative 2026-08-23 through 2026-08-29 UTC week proves Coverage
Regression at 16m26s p95 but fails the charter on Lint at 20m31s and Test Unit
at 22m48s; see `research/live-week-p95.md`. Do not improvise another placement
or shard from the exhausted P1 decision. Attribute the two tails and require a
new signed, costed repair decision before changing their execution shape.
Failed, cancelled, or rerun attempts feed flake attribution and admission or
rollback decisions, never the duration percentiles. The exit bar remains the
p95, not the median — the charter says no one waits.

Rules: placement changes ride `.github/workflows/**` PRs through Yeet; the
$100/mo projection and $200/mo ceiling from
`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md` govern
every fleet move; never weaken fork-PR, cache-write, IAM, egress, or
teardown rails. `main` is PR-only.
