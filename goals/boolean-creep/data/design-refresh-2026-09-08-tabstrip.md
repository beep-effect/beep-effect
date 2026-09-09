# Tab-strip overflow design refresh — 2026-09-08

Source reviewed: packet HEAD `7440cb8c4302ce64b87860069a464bafbf65f576`; inspected corpus matches `origin/main` at `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

## Design

`designs/tabstrip-overflow-disposition.md` replaces the local `unmeasured`/ `allFit` implication with private `unmeasured | fits | overflow` LiteralKit states. Only overflow runs allocation. The design retains initial all-visible rendering, keep-alive atom freshness gating, first-measurement publication, width/rect caches, the exact action-width and 32px reservation math, active-tab inclusion, stable ResizeObserver lifetime, menu gestures, and cleanup.

The separate `dock-tab-drag-phase` design was read for touch coordination. Its pointer-gesture lifecycle remains a different domain.

## Source and test proof

The audit covered `GroupPane.tsx:303-412,432-501`, overflow atoms and caches in `AdapterState.ts`, component overflow/StrictMode tests in `DockviewReact.test.tsx`, geometry coverage in `Gestures.test.tsx`, and the package barrel. No reusable overflow phase exists.

## Verification

The design is present and non-empty. Scoped `git diff --check` passes. `bun goals/boolean-creep/ops/validate-designs.ts` passes with `design coverage OK: 103 qualified ids` after all assigned designs were written.

No source, tests, inventory/status, dependency, generated file, or Git reference was changed.
