# Packet Archive Mechanics

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship `beep goals harvest` and `beep goals archive` (Goals family, `--kind goals|explorations`), the manifest `archive` block and `retentionReason`, doctor and INDEX support, the public archive repo, then sweep every terminal packet off `main` in sequential hash-verified batches of about 50; the harvest ledger is committed before batch 1.

Graduated from [`explorations/packet-archive-and-alpha-harvest`](../../explorations/packet-archive-and-alpha-harvest/README.md); its `DECISIONS.md` holds the 19 operator decisions this packet executes.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/packet-archive-mechanics/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

Closed: `completed-retained`, final #2998 (archive sweep batch 6, merged
2026-11-09). P0 Tooling, P1 Archive repo and P2 Sweep are complete. #2998
verifies from hosted facts: all 15 required checks green and no review threads.
The [batch migration](../goal-closeout-hosted-verification/history/migration-2026-11-13.md)
adopted the legacy proposal.

## Latest Evidence

Slice reports under [`history/`](./history/): harvest, archive plan, archive write.

## Notes

- Archive repo: `beep-effect/beep-effect-goals-archive`, public, mirrored paths, created at P1 by the agent (org admin login), never during P0.
- Doctrine owner for the archive operation is `goals/README.md` (and `explorations/README.md`); no architecture-wide DECISIONS entry is needed.
- The 2026-08 lesson from `packet-convention-migration`: exercise both commands through the public CLI runtime on one packet before any batch.
