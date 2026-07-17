# Ontology Workbench Migration

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Migrate the Ontology workbench monolith into nine fine-grained dock panels —
the first workspace-substrate step-4 surface migration — and land the four
dock capability residuals folded in by the 2026-07-17 grill: per-panel
min/max constraints, tab-overflow dropdown, drop-indicator split quadrants,
and a StrictMode-safe tree host.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/ontology-workbench-migration/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (grill-locked decisions).
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - exploration ground truth
   (workbench composition map, dock capability audit, roadmap survey).
6. [`history/`](./history/) - evidence and closeouts, as they land.

## Milestones

| Milestone | Branch | Scope | Status |
| --- | --- | --- | --- |
| M1 | `feat/dock-capabilities-m1` | Kernel per-panel constraints; adapter tab overflow + drop quadrants; Storybook proofs | merged (PR #429) |
| M2 | `feat/ontology-workbench-split` | Zero-behavior region extraction in `@beep/ontology-ui`; Add-Triple atoms relocate; StrictMode investigated | landed (this PR) |
| M3 | `feat/ontology-dock-panels` | Nine panel renderers; Document panel; nav-rail panel menu; core-cluster default layout; snapshot key v2 | pending |
| M4 | `chore/ontology-migration-qa` | Browser QA loop to green; QA-loop skill graduation; packet closeout | pending |

## Current Phase

P3 (M3 shell integration) — next up: nine panel renderers, Document panel,
nav-rail panel menu, core-cluster default layout, snapshot key v2, in
`apps/professional-desktop`.

## Latest Evidence

M1 merged 2026-07-17 (PR #429: PanelConstraints + solver, tab-overflow
dropdown, drop quadrants; Greptile 5/5, 25 checks green). M2 lands in this
PR: nine region components extracted zero-behavior (both ontology suites +
the chromium renderer-toggle screenshot test pass with zero test edits);
Add-Triple atoms relocated to `@beep/ontology-client`. StrictMode finding:
MUI X `useDisposable` detects StrictMode via the fiber's StrictEffects bit —
no component-shaped wrapper can change that path, so no workaround was
applied; the residual stands for M3's `SurfaceRetry` disposition.

## Notes

- Predecessor residuals NOT absorbed here (stay recorded in
  `goals/dock-substrate-landing/README.md`): popout windows, feed consumers
  (announcements/autosave/undo), keyboard docking + spatial navigation,
  context menus, `LayoutPriority`, snap-to-collapse, edge groups.
- The v1→v2 snapshot key bump intentionally resets saved layouts once; no
  migration machinery (recorded non-goal).
- Known upstream: MUI X `useDisposable` StrictMode invariant — this packet
  attempts the proper fix (StrictMode-safe tree host); if it would require
  weakening StrictMode, stop and record instead.
