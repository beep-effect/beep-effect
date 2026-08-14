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

Latest evidence (2026-08-13): all four items shipped their codeable halves as
scoped PRs — #686 (P3 closeout writer fix, merged), #692 (P1 dated re-defer +
P0/P2 design briefs + friction receipts, merged), #702 (P0 `beep runners bake`
tooling, merged), #708 (P2 per-job IMDS hook wiring, merged). Remaining:
operator-gated live bake/activation (P0) and Gate E + red-team re-run (P2);
P1 revert window opens 2026-08-18. Reflection:
[history/reflections/2026-08-13-claude.md](./history/reflections/2026-08-13-claude.md).
