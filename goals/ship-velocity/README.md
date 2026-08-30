# ship-velocity

Lifecycle: `active`

Created 2026-08-13 · Anchor: [SPEC.md](SPEC.md) · Order: [PLAN.md](PLAN.md)

Agents ship correct code faster: near-zero backpressure latency (failures reach the owning
agent's next tool boundary, not the operator's patience), local verify that near-guarantees the
17 required remote checks, a readable+warm Turbo remote cache in every checkout, memory-aware
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

Phases: ~~P0 ratify+baseline~~ · ~~P1 instant wins~~ · ~~P2 backpressure engine~~ ·
~~P3 full parity~~ · ~~P4 concurrency+cache~~ · **P5 observation closeout (current)**.

P0 and P1 complete 2026-08-17. P1 shipped as #737 (B1 same-argv lanes), #736 (E1 publish
regenerates the derived goals INDEX), #738 (A7 monitor hardening), #743 (C1 remote-read cache
posture); see [the P1 closeout reflection](history/reflections/2026-08-17-claude.md).

B9 (P3 prerequisite) landed 2026-08-24: the coverage runtime pins the pull-request Turbo
posture so local, PR, and main-push runs measure identical per-file rows; the 150-run sweep
that motivated it is the 2026-08-24 receipt in [research/OPPORTUNITIES.md](research/OPPORTUNITIES.md).
B10 followed the same day: the pull-request coverage planner now measures workspace dependents
of a changed owner, so a dependent's ratchet drop fails the PR instead of `main` after the merge.
B11 (2026-08-25) closed the regeneration treadmill: the ratchet prints the exact scoped
`--filter … --write-baseline` command for the regressed packages, and a baseline edit that only
touches package rows measures those packages (24 s) instead of the full workspace (9–15 min).

The remaining P2-P5 engineering backlog was completed in the 2026-08-27 closeout branch. It
adds hook-driven inbox enforcement and takeover, full local/hosted parity planning and proof
reuse, weighted admission with RSS telemetry, cache warming and first-touch evidence, local-only
portfolio projections, contention families, goals-only required-check skips, and the live E7/E8
evaluations. The initiative intentionally remains active until the final PR is merge-ready and a
representative post-merge week satisfies the completion gate; see
[research/metrics-closeout.md](research/metrics-closeout.md).
