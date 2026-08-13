# Thread Virtualization Spec

## Objective

The editor-stack thread renderer virtualizes its content with exact item
heights derived from the `@beep/pretext` root surface and a client capture
pass, preserving correct rendering and navigation as the thread grows.

## Non-Goals

- Dock-kernel max constraints, `LayoutPriority`, or snap-to-collapse work.
- A replacement text-layout engine or a second pretext abstraction.
- Unrelated editor, desktop-shell, or product-surface redesign.

## Source Hierarchy

1. Operator decision dated 2026-08-13.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. [`explorations/computable-workspace-geometry/MAP.md`](../../explorations/computable-workspace-geometry/MAP.md), Goal 2.
4. This `SPEC.md`.
5. `PLAN.md`, then `GOAL.md`.

## Target Surfaces

- The live editor-stack thread renderer and its client-side capture boundary.
- The public root surface of `@beep/pretext` as a consumed dependency.

## Constraints

- Heights must be exact and derived from the shipped pretext surface plus a
  capture pass in the client.
- Editor-stack ownership is confirmed clear as of 2026-08-13; stop if that
  ownership boundary changes.
- The 2026-07-14 review routed kernel residue to
  `scratchpad/dockview/WHAT-IS-LEFT.md`; after scratchpad retirement, its
  retained current home is
  [`goals/dock-substrate-landing/README.md`](../dock-substrate-landing/README.md#residuals-from-scratchpad-what-is-left-v2).
  It must not be absorbed.

## Acceptance Criteria

- [ ] The thread renderer virtualizes a growing thread using exact heights.
- [ ] Client capture and pure `@beep/pretext` consumption have an explicit,
      testable boundary.
- [ ] Relevant renderer behavior is proven for initial render, measurement
      refresh, and navigation/scroll stability.
- [ ] No dock-kernel residue or unrelated editor work is absorbed.

## Verification Matrix

| Check | Evidence | Required result |
| --- | --- | --- |
| Exact-height behavior | Focused renderer tests and browser QA evidence | Heights and scroll/navigation remain correct |
| Dependency boundary | Source review | Root `@beep/pretext` plus client capture pass only |
| Manifest JSON | `jq . goals/thread-virtualization/ops/manifest.json` | Passes |

## Stop Conditions

- The live thread-renderer owner conflicts with this packet.
- Exact heights require widening or replacing `@beep/pretext` beyond this goal.
- The work expands into routed kernel residue or unrelated editor surfaces.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
