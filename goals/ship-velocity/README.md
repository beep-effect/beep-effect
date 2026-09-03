# ship-velocity

Lifecycle: `completed-retained`

Created 2026-08-13 · Anchor: [SPEC.md](SPEC.md) · Order: [PLAN.md](PLAN.md)

Agents ship correct code faster: near-zero backpressure latency (failures reach an active
session's next tool boundary and unacknowledged P0 work blocks Stop), local verify that
near-guarantees the 17 required remote checks, a readable+warm Turbo remote cache in every
checkout, memory-aware concurrent verify/publish across sibling checkouts, and an end to the
derived-file merge treadmill.

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
~~P3 full parity~~ · ~~P4 concurrency+cache~~ · ~~P5 observation closeout~~.

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

The remaining P2-P5 engineering backlog was completed in the 2026-08-27 closeout branch. It adds
hook-driven inbox enforcement, full local/hosted parity planning and proof reuse, weighted
admission with RSS telemetry, cache warming and first-touch evidence, local-only portfolio
projections, contention families, goals-only required-check skips, and the live E7/E8 evaluations.
On 2026-08-30 the operator accepted a concentrated 24-hour production sample in place of the
original seven-day duration proxy. Operator PR #921 subsequently retired the published-PR
ownership lease and automatic takeover path; the packet records that explicit supersession and
does not claim takeover success. Two independent same-origin full proofs overlapped for 48 minutes
49.201 seconds and both completed every lane at exit 0.

The 2026-09-02 final cache repair proved that the checkouts held a stale February reference while
the infra-vault item still matched SSM. An explicit replacement mode repaired 27 ignored cache
quads. The six-root frozen sample recorded five remote-hit roots, one authenticated-cold root, and
zero cache authentication failures. One remote-hit root used a separately labelled cache-only
canary because an unrelated reference failed its exact all-file wrapper. This packet is
`completed-retained` pending merge of the successor final-evidence PR on branch
goals/ship-velocity-cache-auth-evidence, which carries the evidence, status flip, and reflection
and must still reach Yeet `merge-ready: yes`. PR #937 remains an incomplete historical follow-up;
see [research/metrics-closeout.md](research/metrics-closeout.md) and
[research/cache-proof.md](research/cache-proof.md).
