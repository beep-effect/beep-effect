# CI Fleet Residue

Lifecycle: `active`

Successor packet to `ci-fleet-endgame` P4 plus the arc's accepted-risk
residue, split out 2026-08-13. Each item is independent, bounded, and was
deliberately deferred rather than dropped; this packet is their durable home
so nothing lives only in chat scrollback or memory.

- Anchor: [SPEC.md](./SPEC.md)
- Plan: [PLAN.md](./PLAN.md) — one phase per residue item
- Ledger: [research/OPPORTUNITIES.md](./research/OPPORTUNITIES.md)

Status: `active` (see `ops/manifest.json`).

Latest evidence (2026-08-16): P0 and P2 are done. The per-job IMDS hook
deployed 2026-08-14 and passed Gate E plus the full guest-isolation
red-team suite live (research/p2-acceptance-evidence.md); the baked AMI
activated 2026-08-16 with the fast path probed on a live worker and the
rollback recipe proven (research/p0-activation-evidence.md). Remaining:
P1 revert window opens 2026-08-18, then P4 close. Reflection:
[history/reflections/2026-08-13-claude.md](./history/reflections/2026-08-13-claude.md).
