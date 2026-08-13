# Thread Virtualization

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

Editor-stack ownership was confirmed clear by the operator on 2026-08-13. The
2026-07-14 beep-effect6 gate release covered only the desktop shell; this
confirmation covers the thread renderer surface.

## Mission

Deliver exact-height virtualization for the thread renderer in the editor
stack, consuming the `@beep/pretext` root surface plus a capture pass in the
client.

## Launch

```text
/goal follow the instructions in goals/thread-virtualization/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact launcher.
2. [`SPEC.md`](./SPEC.md) - normative contract.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - source packet and residue routing.

## Current Phase

P0 Research: locate the live thread renderer and define the exact-height
measurement/capture boundary before implementation.

## Latest Evidence

2026-08-13 operator ownership confirmation and the Goal 2 row in
[`computable-workspace-geometry/MAP.md`](../../explorations/computable-workspace-geometry/MAP.md).

## Notes

The 2026-07-14 review routed dock-kernel residue to the then-live
`scratchpad/dockview/WHAT-IS-LEFT.md`. The scratchpad was retired 2026-07-16
and its residue migrated to
[`goals/dock-substrate-landing/README.md`](../dock-substrate-landing/README.md#residuals-from-scratchpad-what-is-left-v2).
That residue is context, not scope for this goal.
