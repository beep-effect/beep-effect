# Goal: no required job waits 20 minutes

You are executing `goals/ci-lane-economics`. Read `SPEC.md` and `PLAN.md`
first; the ledger is `research/OPPORTUNITIES.md` (record friction at the
moment it happens).

Current phase: P0 cache-warm census. The remote Turbo cache went live
2026-08-13 (#673/#674), so every earlier lane measurement is stale. Collect
p50/p95 wall time and cache hit rate for every required lane across recent
PR and push waves (GitHub Actions API; `run_attempt == 1` only — reruns
rewrite run_started_at). Produce a lane-time table in
`research/` and only then open P1 placement decisions.

Rules: placement changes ride `.github/workflows/**` PRs through Yeet; the
$100/mo projection and $200/mo ceiling from
`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md` govern
every fleet move; never weaken fork-PR, cache-write, IAM, egress, or
teardown rails. `main` is PR-only.
