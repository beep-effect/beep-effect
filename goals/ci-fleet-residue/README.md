# CI Fleet Residue

Lifecycle: `completed-retained`

Successor packet to `ci-fleet-endgame` P4 plus the arc's accepted-risk
residue, split out 2026-08-13. Each item is independent, bounded, and was
deliberately deferred rather than dropped; this packet is their durable home
so nothing lives only in chat scrollback or memory.

- Anchor: [SPEC.md](./SPEC.md)
- Plan: [PLAN.md](./PLAN.md) — one phase per residue item
- Ledger: [research/OPPORTUNITIES.md](./research/OPPORTUNITIES.md)

Status: `completed-retained` (see `ops/manifest.json`).

Latest evidence (2026-08-24): all four items are done and the packet is
closed. The per-job IMDS hook deployed 2026-08-14 and passed Gate E plus
the full guest-isolation red-team suite live
(research/p2-acceptance-evidence.md); the baked AMI activated 2026-08-16
with the fast path probed on a live worker and the rollback recipe proven
(research/p0-activation-evidence.md); the spot revert deployed 2026-08-16
(#730) and its tripwire week closed calm 2026-08-24 with zero
interruption-attributed re-runs
(research/p1-tripwire-week-evidence.md) — the >2/week tripwire stands as
an ongoing operational rule. Reflections:
[2026-08-13](./history/reflections/2026-08-13-claude.md),
[2026-08-24 closeout](./history/reflections/2026-08-24-claude.md).
