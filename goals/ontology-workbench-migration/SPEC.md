# SPEC — Ontology Workbench Migration

Normative contract for the first step-4 surface migration of the workspace
substrate: the Ontology workbench monolith
(`packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx`, ~1160
lines, self-described "workbench decomposition debt") becomes nine
fine-grained dock panels, and the dock gains the four capability residuals
folded into this packet. Decisions below were locked in the 2026-07-17 grill
(owner: elpresidank) and are not to be reopened during execution.

Governing standards: `standards/ARCHITECTURE.md`, `standards/effect-laws-v1.md`,
`docs/product/workspace-substrate.md` (product canon; §6 binding guardrails
apply to every panel, §7 step 4 is the mandate),
`goals/dock-substrate-landing/` (predecessor packet; its residuals list is the
authority for what this packet absorbs vs leaves).

## Locked decisions

1. **Lead lane**: workspace-substrate step 4 ("existing surfaces migrate one
   at a time, behind the tests they already have"); **Ontology first**.
2. **Granularity — 9 panels**: Explorer (tree + search), Graph (canvas, with
   the 2D/3D renderer toggle moved into its own chrome), Inspector (inspector
   + gesture actions + Add Triple), Source (read-only Turtle), SPARQL,
   Validation, Change Log, Worker Metrics, Document (file path,
   Open/Save/Preview, Undo/Redo, dirty badge, view-mode/fold/Inferred
   controls).
3. **Launcher**: the nav rail evolves into a panel menu — each surface entry
   expands to its panel list; click focuses an open panel or dispatches
   `OpenPanelCommand` at a sensible placement for a closed one. App-local
   work only; no adapter changes for the launcher.
4. **Default layout** (fresh boot / reset): left group Explorer|Document
   (tabs), center group Graph|Source (Graph active), right group
   Inspector|ChangeLog (tabs), bottom group Chat|Home|Sync (Chat active,
   keep-alive semantics preserved). SPARQL, Validation, and Worker Metrics
   start **closed** and open via the rail menu.
5. **Snapshots**: storage key bumps to `desktop:dock-workspace:v2`; boot
   deletes the stale v1 key. No snapshot migration machinery — that stays a
   recorded non-goal. Rationale: a v1 snapshot decodes fine but references
   the retired `ontology` renderer key, so it would restore a dead panel
   without tripping the poisoned-key clear; the key bump is the honest
   invalidation.
6. **Ride-along residuals (all four)**: per-panel min/max size constraints
   (kernel), tab-overflow dropdown (adapter), drop-indicator split quadrants
   (adapter), StrictMode-safe tree host (fixes the MUI X `useDisposable`
   invariant at the Explorer extraction moment and removes ontology's
   dependence on `SurfaceRetry`). Everything else in the predecessor
   residuals list (popout windows, feed consumers, keyboard docking, context
   menus, `LayoutPriority`, snap-to-collapse) stays out of scope.
7. **Milestones**: four, capability-first, one branch/PR each off fresh
   `origin/main` through yeet.
8. **Execution**: codex (gpt-5.6-sol) drafts M1 capability code and M2's
   mechanical extraction; Fable plans, reviews everything, and hand-builds
   M3's user-facing UI; M4 reruns the browser QA loop (codex vision +
   hands-on Chrome) with Fable fixing, and graduates the loop into a repo
   skill.
9. **Zero-behavior law for M2**: extraction only — region components must
   render the same DOM and read the same atoms; any semantic change stops
   and reports. `OntologyWorkbench` survives as a thin composition of the
   extracted regions.
10. **Live-browser law** (reflection-derived): any milestone that adds or
    changes a pointer gesture surface requires a live-browser pass before
    review sign-off. jsdom green is not click-works green; new pointer wiring
    must respect the `pressStartsOnButton` guard pattern
    (`@beep/dock-react/internal/DropCompiler.ts`).

## M1 — dock capabilities (branch `feat/dock-capabilities-m1`)

Kernel (`@beep/dock`):

- Per-panel minimum/maximum size constraints: optional `minWidth`/`minHeight`/
  `maxWidth`/`maxHeight` facets on `Panel` (`Dock.models-tree.ts`), flowing
  through `PanelPatch`, honored by the geometry solver (`Dock.geometry.ts`)
  when computing group boxes (a group's effective minimum is the max over its
  panels' minima merged with `minGroupExtent` and title minima; maxima clamp
  split growth). Additive schema fields only — the `DockSnapshot` v1 envelope
  tag does not change, and absent fields decode as unconstrained (existing
  snapshots stay valid).

Adapter (`@beep/dock-react`):

- Tab-overflow dropdown: when a group's tab strip exceeds its width, overflow
  tabs collapse into a dropdown at the strip's end; the active tab is always
  visible; dropdown selection activates the panel.
- Drop-indicator split quadrants: `DropOverlay` gains directional zones —
  hovering a group's left/right/top/bottom quarter previews the split that
  edge-drop would produce; center previews tab-merge. `DropCompiler` compiles
  the quadrant under the pointer to the corresponding placement (today's
  whole-group highlight becomes the center zone).

Evidence plan (per claim):

- Per-panel constraints honored → kernel geometry vitest cases (group minimum
  = max of panel minima; maximum clamps `ResizeSplitCommand`) + a Storybook
  story with a constrained panel that a sash drag cannot violate.
- Old snapshots still decode → kernel vitest decoding a pre-M1 snapshot
  fixture without the new fields.
- Tab overflow → Storybook interaction test that narrows a group and asserts
  the dropdown appears and activates an overflowed tab.
- Quadrant drops → Storybook interaction test per quadrant asserting the
  compiled placement; live-browser pass for real pointer capture (law 10).
- Zero regression → `@beep/dock` + `@beep/dock-react` suites green; dock
  stories pass; docgen clean for new exports.

## M2 — workbench decomposition (branch `feat/ontology-workbench-split`)

`@beep/ontology-ui`: split `Session.workbench.tsx` into one region component
per panel-to-be — `Session.explorer.tsx`, `Session.document.tsx`,
`Session.graph.tsx`, `Session.source.tsx`, `Session.inspector.tsx`,
`Session.sparql.tsx`, `Session.validation.tsx`, `Session.changelog.tsx`,
`Session.metrics.tsx` — each reading the existing `@beep/ontology-client`
atoms. `OntologyWorkbench` remains as a thin grid composition of the regions
(existing consumers and tests keep passing). Relocate the UI-file-local
Add-Triple form atoms (`Session.workbench.tsx:97-101`) into
`Session.atoms.ts`. StrictMode-safe tree host lands here if the fix is
component-shaped (a wrapper around the `RichTreeView` mount), else in M3.

Evidence plan:

- Zero behavior → `@beep/ontology-ui` + `@beep/ontology-client` suites pass
  unchanged (no test edits except imports); `graph-renderer-toggle` browser
  test + screenshot baseline unchanged.
- Region components are real seams → each new file exports exactly one
  region; `OntologyWorkbench` body is composition only (no residual logic).
- Docgen clean for new exports (`bun run docgen:local`).

## M3 — shell integration (branch `feat/ontology-dock-panels`)

`apps/professional-desktop`:

- Register the nine panel renderers in `makeSurfaceRenderers`; retire the
  coarse `ontology` renderer key.
- Document panel from `Session.document.tsx`; 3D switch lives in Graph panel
  chrome (still bound to `ontologyGraphRendererAtom`).
- Nav-rail panel menu (locked decision 3) with focus-or-open semantics via
  `useFocusedDockGroup` + `OpenPanelCommand`.
- New `defaultDesktopWorkspace` per locked decision 4; `DOCK_SNAPSHOT_KEY` →
  `desktop:dock-workspace:v2` + v1 key cleanup in `makeDesktopDockGraph`.
- `SurfaceRetry` disposition per the StrictMode-host outcome (remove for
  ontology if the invariant is gone; keep the generic boundary machinery).

Evidence plan:

- Rail menu opens/focuses every panel → app vitest on the menu's dispatch
  logic + M4 browser scenarios.
- Default layout matches decision 4 → app vitest asserting the built default
  workspace topology (groups, tabs, active panels, closed set).
- v2 boot → app vitest: stale v1 key present ⇒ default workspace restored,
  v1 key removed, v2 key written on first save.
- Keep-alive preserved → existing chat keep-alive identity test still green.
- Lane parity → app suite run with the exact CI command (`bunx --bun
  vitest`).

## M4 — QA-to-green + close (branch `chore/ontology-migration-qa`)

- Browser QA loop (playwright capture harness → codex gpt-5.6-sol high-effort
  vision inventory → Fable fix rounds → hands-on Chrome verification).
  Required scenario coverage: rail-menu open/focus for all nine panels;
  closed-by-default tools; tab overflow in a narrowed group; all four drop
  quadrants; per-panel constraint enforcement under sash drag; v2 boot from
  a stale v1 key; Explorer under StrictMode with no `useDisposable`
  invariant; Chat keep-alive across ontology re-layout; theme toggle.
- Graduate the QA loop into a repo skill under `.claude/skills/` (capture
  manifest format from `.beep/qa/round-*/`), closing the reflection TODO.
- Closeout: reflection artifact, manifest/lifecycle flips to
  `completed-retained`, goals INDEX regen, `docs/product/workspace-substrate.md`
  §7 note (first step-4 surface landed), exploration Trail entry — same-PR
  packet-state flip.

## Stop conditions

- A required semantic change surfaces during M2 extraction (report, don't
  make it).
- Per-panel maxima prove unsatisfiable against the solver's invariants
  (report with the failing fixture; minima alone may land).
- The StrictMode fix requires weakening StrictMode (forbidden; keep
  `SurfaceRetry` for ontology and record the residual instead).
- Any milestone's live-browser pass finds a gesture regression that jsdom
  missed — fix before review, never ship on jsdom green alone.
