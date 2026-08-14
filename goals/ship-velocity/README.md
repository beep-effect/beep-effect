# ship-velocity

Lifecycle: `active`

Created 2026-08-13 · Anchor: [SPEC.md](SPEC.md) · Order: [PLAN.md](PLAN.md)

Agents ship correct code faster: near-zero backpressure latency (failures reach the owning
agent's next tool boundary, not the operator's patience), local verify that near-guarantees the
16 required remote checks, a readable+warm Turbo remote cache in every checkout, memory-aware
concurrent verify/publish across sibling checkouts, and an end to the derived-file merge
treadmill.

Born from a 9-lane fan-out (7 codex Sol analysis lanes over the live repo + 2 grok research/
design lanes) plus a 5-frame ADHD divergence pass on backpressure; all evidence and idea pools
are under [research/](research/). Headline numbers: 79 failed required-job attempts across 35
PRs in 4 days (63% in three locally-catchable lanes); 134 merge-main-into-branch commits in 22
days; monitor withholds a red until the whole suite ends (p95 tails 20-30 min).

Supersedes/continues threads from: speed-loop (retained), repo-quality-throughput (retained),
ci-lane-economics (coverage placement lands via #698), coding-agent-effectiveness-evidence-loop
(proof reuse, failure capsules), fleet-coordination exploration (routing/lease laws), and the
fleet-mirror contested-path index.

Phases: P0 ratify+baseline · P1 instant wins · P2 backpressure engine · P3 full parity ·
P4 concurrency+cache · P5 hot-file endgame + close.
