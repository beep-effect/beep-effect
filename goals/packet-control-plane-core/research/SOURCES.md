# SOURCES — Packet Control-Plane Core

Provenance ledger. This goal inherits its research whole from the parent
exploration — back-links, not copies.

## Inherited (graduation, 2026-08-17)

- [`explorations/packet-system-redesign/BRIEF.md`](../../../explorations/packet-system-redesign/BRIEF.md)
  — operator-ratified 2026-08-13: problem, appetite, nine-point solution
  sketch, rabbit holes, no-gos.
- [`explorations/packet-system-redesign/MAP.md`](../../../explorations/packet-system-redesign/MAP.md)
  — ratified 2026-08-17 with amendments; candidate 1's mission, D5 change-tree
  envelope and significant-symbol ledger, dependency edges, and the chosen
  first vertical slice are this goal's normative seed.
- [`explorations/packet-system-redesign/DECISIONS.md`](../../../explorations/packet-system-redesign/DECISIONS.md)
  — D-numbered decisions; D8 (single colocated core), D9 (self-host first),
  D12 (KSA owns static v1) bind this goal.

## Live capability citations

- Goals CLI surfaces this goal extends:
  `packages/tooling/tool/cli/src/commands/Goals/` (`Goals.schemas.ts`,
  `Inventory.ts`, `Doctor.ts`, `SetStatus.ts`, `Goals.command.ts`,
  `PortfolioIndex.ts`).
- Guarded-writer / derived-projection precedent (MAP Amendment A): Yeet's
  publish-time portfolio index guard — `PortfolioIndexGuard.ts`,
  `PublishScope.ts` under the Yeet command tree (PR #736).
- Proof-manifest verification/memoization pattern: the Docgen command tree's
  targets machinery (cited by the parent MAP for later candidates; relevant
  here only as prior art for deterministic proofs).
