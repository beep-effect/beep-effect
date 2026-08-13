# Goal: no required job waits 20 minutes

You are executing `goals/ci-lane-economics`. Read `SPEC.md` and `PLAN.md`
first; the ledger is `research/OPPORTUNITIES.md` (record friction at the
moment it happens).

Current phase: P0 cache-warm census. The remote Turbo cache went live
2026-08-13 (#673/#674), so every earlier lane measurement is stale. Collect
p50/p95 wall time for every required lane across recent PR and push waves
(GitHub Actions API; `run_attempt == 1` AND successful conclusions only —
reruns rewrite run_started_at, and failed or cancelled attempts must feed
flake attribution, never the duration percentiles). Record turbo cache hit
rates only for lanes that run turbo (`uses_turbo: "false"` lanes get n/a).
The exit bar is the p95, not the median — the charter says no one waits.
Produce a lane-time table in `research/` and only then open P1 placement
decisions.

Rules: placement changes ride `.github/workflows/**` PRs through Yeet; the
$100/mo projection and $200/mo ceiling from
`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md` govern
every fleet move; never weaken fork-PR, cache-write, IAM, egress, or
teardown rails. `main` is PR-only.
