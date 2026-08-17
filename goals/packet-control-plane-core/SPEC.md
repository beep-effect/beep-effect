# SPEC — Packet Control-Plane Core

Normative contract. Packet anchor document. Repo standards outrank this file
when they conflict. Seeded 2026-08-17 from the ratified
[`explorations/packet-system-redesign`](../../explorations/packet-system-redesign/MAP.md)
MAP (candidate 1) — back-links, not copies.

## Mission

Build the D8 single internal packet-core inside the existing Goals CLI area:
versioned per-event CAS records, fork detection, deterministic fold, derived
`furthestStage`/`resumeStage`, risk-tier floor/override, and trace
projection — exposed first through guarded `beep goals` writers and a minimal
read-only `beep explore --check`/doctor surface.

## Scope

**In**

- Extend `packages/tooling/tool/cli/src/commands/Goals/` (`Goals.schemas.ts`,
  `Inventory.ts`, `Doctor.ts`, `SetStatus.ts`, `Goals.command.ts`,
  `index.ts`).
- A colocated PacketCore internal module inside the Goals command tree and a
  minimal read-only Explore command family in the repo CLI commands tree
  (both described, not yet created — create files inside the existing
  package; no new workspace package).
- Focused CLI tests only.

**Out (gated re-entry candidates of the parent MAP — do not build here)**

- Design/approval gate machinery (candidate 2).
- Fleet projection migration, generated ATLAS/README regions (candidate 3).
- Evidence receipts, landed/closed derivation, flow metrics (candidate 4).
- Any UI (candidate 5). No `beep packets` vocabulary. No new package.

## Significant-symbol ledger (D5, ratified)

`PacketEvent`, `PacketEventId`, `PacketTip`, `PacketRevision`,
`PacketEventStore`, `PacketFold`, `PacketDerivedState`, `PacketRiskTier`,
`PacketTraceProjection`, guarded transition plan/write, exploration check
result, fork verdict/repair plan. Every-symbol inventories are forbidden;
this ledger constrains the design surface and may be amended only through the
parent MAP's amendment path.

## Constraints (binding, inherited)

- **D8:** one packet-core, colocated behind existing command groups.
- **D9:** self-host on this campaign in advisory mode before any ratchet.
- Git Markdown packets and the event chain are the sole system of record;
  every projection is read-only and derived.
- Event evolution requires versioned events, upcasters, golden replay, and
  explicit fork repair. No merge-driver-dependent JSONL; no whole-packet
  prose event sourcing.
- Generated surfaces never swallow authored Trail / Next Open Question prose.
- Risk-tier overrides are operator-only, recorded, challengeable.
- No stored readiness/status as canonical truth.
- Reuse the live guarded-writer precedent: Yeet's publish-time portfolio
  index guard (`PortfolioIndexGuard.ts`, `PublishScope.ts`; Amendment A).
- Repo laws: schema-first; Effect v4 validated against `.repos/effect`;
  `LiteralKit` for literal families; `Effect.fn`/`Effect.fnUntraced`.

## Acceptance (the ratified first vertical slice)

- [ ] Packet-core writes and folds one versioned CAS event stream for one
      packet (this goal's own stream — D9 self-hosting, advisory mode).
- [ ] Guarded `beep goals` transition preview/write path over that fold.
- [ ] Minimal read-only `beep explore --check`/doctor result.
- [ ] A projection reports `furthestStage`, `resumeStage`, current tip, a
      visible fork (two children of one parent), and a stale `sourceTip`.
- [ ] Proof: golden linear stream, deliberate fork, stale projection.
- [ ] Explicitly absent: fleet migration, wholesale ATLAS generation,
      closure receipts, UI.
- [ ] Shipped as a PR driven to mergeable via `/yeet`.

## Stop conditions

- The fold contract cannot express an existing packet's real history without
  loss — stop and re-open the parent exploration at decompose.
- The slice starts pulling candidate-2/3/4 machinery in to pass its own
  proof — scope fence broken; stop and report.
- Verification requires unnamed credentials, cost, or destructive effects.
- The same blocker repeats after reasonable investigation.
