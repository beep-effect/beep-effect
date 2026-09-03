# Goal: no required job waits 20 minutes

You are executing `goals/ci-lane-economics`. Read `SPEC.md` and `PLAN.md`
first; the ledger is `research/OPPORTUNITIES.md` (record friction at the
moment it happens).

Current phase: P3 live validation. P0-P2 are complete: every
signed zero-expansion placement and lane-shape move is merged through PR #719.
The representative 2026-08-23 through 2026-08-29 UTC week proves Coverage
Regression at 16m26s p95 but fails the charter on Lint at 20m31s and Test Unit
at 22m48s; see `research/live-week-p95.md`. The first complete week under the
current 17-context ruleset still fails at Lint 21m00s and Test Unit 24m50s;
see `research/current-ruleset-week-p95.md`. Tail evidence is in
`research/tail-attribution.md`.

The signed $0 repair in `research/repair-decision.md` landed in PR #982:
`.github/workflows/check.yml` now runs two deterministic Lint package shards,
three Test Unit shards with `@beep/repo-cli#test` isolated, literal-name
aggregators, and a guarded cleanup skip; `beep ci lane --partition` proves and
executes each shard. It keeps free hosted runners and concurrency two, adds no
fleet job or spend, and leaves ruleset `10240248`'s exact 17 required contexts
unchanged.

Only live validation remains after PR #982 merges. Collect a fresh
representative half-open UTC week using attempt-one successful runs, measure
each effective shard critical path from the earliest shard start through its
aggregator completion, and verify that the required set is exactly 17. Admit
the repair only if both Lint and Test Unit effective p95 are below 20m00s.
P3 remains in progress until that gate passes.

Failed, cancelled, or rerun attempts feed flake attribution and admission or
rollback decisions, never the duration percentiles. The exit bar remains p95,
not the median or the short aggregator span — the charter says no one waits.

Rules: placement changes ride `.github/workflows/**` PRs through Yeet; the
$100/mo projection and $200/mo ceiling from
`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md` govern
every fleet move; never weaken fork-PR, cache-write, IAM, egress, or
teardown rails. `main` is PR-only.
