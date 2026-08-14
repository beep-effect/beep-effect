# Goal: no required job waits 20 minutes

You are executing `goals/ci-lane-economics`. Read `SPEC.md` and `PLAN.md`
first; the ledger is `research/OPPORTUNITIES.md` (record friction at the
moment it happens).

Current phase: P2 execute moves. P0 and P1 are complete; the signed placement
decision and cache-warm census live in `research/`. Admit the safe Coverage
Regression scope/sharding redesign on live pull-request and push waves, then
open P3 only after every accepted move is merged. Failed, cancelled, or rerun
attempts feed flake attribution and admission/rollback decisions, never the
duration percentiles. The exit bar remains the p95, not the median — the
charter says no one waits.

Rules: placement changes ride `.github/workflows/**` PRs through Yeet; the
$100/mo projection and $200/mo ceiling from
`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md` govern
every fleet move; never weaken fork-PR, cache-write, IAM, egress, or
teardown rails. `main` is PR-only.
