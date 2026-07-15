# SPEC — Dock Substrate Landing

Normative contract for graduating the scratchpad dock system into
`@beep/dock` + `@beep/dock-react` and landing the dock workspace as the root
shell of `apps/professional-desktop`. Decisions below were locked in the
2026-07-14 grill (owner: elpresidank) and are not to be reopened during
execution.

Governing standards: `standards/ARCHITECTURE.md`,
`standards/architecture/07-non-slice-families.md`,
`standards/architecture/03-driver-boundaries.md`, `standards/effect-laws-v1.md`,
`standards/schema-first.inventory.jsonc`, `docs/product/workspace-substrate.md`
(product canon).

## Locked decisions

1. Two packages under `packages/foundation/ui-system/`: `@beep/dock` (pure
   kernel — **react must never appear in its dependency tree or imports**)
   and `@beep/dock-react` (React adapter). The purity boundary is a package
   boundary.
2. Doctrine: `standards/architecture/DECISIONS.md` gains a ratified entry
   authorizing ui-system → drivers imports narrowly (pure driver roots +
   browser-safe `/browser` layers as overridable defaults; never
   server/secret-bearing driver layers). The ceiling table in
   `standards/ARCHITECTURE.md` and the mirror prose in
   `07-non-slice-families.md` are amended to match. GLOSSARY gains a
   "Headless UI Kernel" term anchoring pure geometry/state kernels in
   ui-system. These edits ride in the M1 PR.
3. beep-effect6 write-gate on `apps/professional-desktop`: released
   2026-07-14 (owner confirmation; lane rotated off). Recorded in
   `explorations/computable-workspace-geometry` README/MAP/manifest.
4. Shell scope (M3): dock replaces the hash-routed switcher at the root of
   the app; the four surfaces (Home, Chat, Ontology, Sync) become one coarse
   panel each; chat keeps its internal split; snapshot persists to
   localStorage with validated restore that falls back to the default
   workspace and clears the poisoned key on any failure; hash routing
   retires; panels are keep-alive.
5. One packet (this one), four milestones, each its own branch/PR off fresh
   `origin/main` through yeet.
6. Zero-behavior-change law for M1/M2: graduation is moves + decomposition +
   identity swap + documentation. Any semantic change to kernel or adapter
   behavior is out of scope and must be reported, not made.

## M1 — `@beep/dock` (branch `feat/dock-package`)

Package `packages/foundation/ui-system/dock`, name `@beep/dock`,
`"beep": {"family": "foundation", "kind": "ui-system"}`. Dependencies:
`@beep/identity`, `@beep/schema`, `@beep/utils`, `@beep/pretext` (pure root
only — never `@beep/pretext/browser`), `effect` (catalog). Template:
`packages/drivers/pretext` (package.json shape, tsconfig pair, vitest config,
docgen.json, AGENTS.md + CLAUDE.md symlink, LICENSE, README, dtslint/).

### Source decomposition (from `scratchpad/dockview/poc/`)

Public role files (every export documented: compiling `@example`,
`@category`, `@since 0.0.0`):

| Target file | Source | Contents |
|---|---|---|
| `src/Dock.ids.ts` | Domain.ts | PanelId, GroupId, SplitId, CommandId, RendererKey, SplitRatio |
| `src/Dock.models.ts` | Domain.ts | PanelRenderMode, PanelParameterValue/Parameters, ComponentPanelView, TextPanelView, PanelView, Panel, PanelPatch, GroupLockedMode, GroupHeaderPosition, GroupMetadata, GroupPatch |
| `src/Dock.tree.ts` | Domain.ts | TabsNode, HorizontalSplitLayout, VerticalSplitLayout, SplitLayout, SplitNode, DockNode (+namespace), FloatingMember, EmptyWorkspace, PopulatedWorkspace, DockWorkspace, DockSnapshot |
| `src/Dock.placement.ts` | Domain.ts | RootPlacement, TabPlacement, DockSide, SplitPlacement, RootSplitPlacement, GroupSplitPlacement, GroupRootSplitPlacement, DockPlacement, DockMoveTarget, DockGroupMoveTarget |
| `src/Dock.commands.ts` | Domain.ts | CommandOrigin variants, the 14 command classes, DockCommand, DockCommandEnvelope, RestoreSnapshotRequest |
| `src/Dock.events.ts` | Domain.ts | the 19 event classes + DockEvent |
| `src/Dock.outcomes.ts` | Domain.ts | DockUnchangedReason, DockChanged, DockUnchanged, DockMutationResult, DockMutationOutcome |
| `src/Dock.errors.ts` | Domain.ts | DockRejectionReason, DockCommandRejected, DockInvariantReason, DockInvariantViolation, DockInputBoundary, DockInputError, DockPersistenceOperation, DockPersistenceError, DockSnapshotMissing, DockTransitionError |
| `src/AnchoredBox.ts` | AnchoredBox.ts | as-is |
| `src/Dock.geometry.ts` | Geometry.ts | DockBox, GroupGeometry, SashGeometry, FloatingGeometry, DockGeometry, GeometryOptions, GroupMinimumLookup, GroupMinimaRecord, resolveAnchoredBox, project, projectWorkspace, makeDockGeometryAtoms |
| `src/Dock.reducer.ts` | Reducer.ts | public re-exports only: reduceDockCommand, validateWorkspace, restoreDockWorkspace |
| `src/DockEngine.service.ts` | DockEngine.ts | DockEngine, DockEngineShape, DockEngineLive, DockSnapshotStore, DockSnapshotStoreShape, makeDockSnapshotStoreMemory, requireSnapshot |
| `src/DockPolicy.ts` | DockPolicy.ts | DockCommandPolicy, lockedGroupsPolicy, makePolicyDockEngineLayer |
| `src/Dock.protocol.ts` | DockAtomProtocol.ts | operation/outcome/feed schemas |
| `src/Dock.atoms.ts` | DockAtoms.ts | makeDockAtoms, makeDockAtomsWith, DockAtomObservabilityLive |
| `src/Minima.ts` | Minima.ts | TabChrome, titleWords, titleMinima, makeTitleMinimaAtom |
| `src/Recency.ts` | Recency.ts | touchedGroupsInEvents, touchedGroups, makeMruGroupsAtom |
| `src/index.ts` | index.ts | curated barrel — enumerate exports; **no `export *`** |

`src/internal/` (excluded from docgen + jsdoc ratchet via docgen.json
`"exclude": ["src/internal/**/*.ts"]`; the source `exports` map exposes
`./internal/*` for in-repo test/tsconfig resolution only — chalk precedent —
while `publishConfig.exports` maps `./internal/*` to `null` so published
consumers cannot couple to internals):

- `src/internal/Reducer.ts` — the full reducer body (only the three public
  functions re-exported from `src/Dock.reducer.ts`).
- `src/internal/DockAtoms.session.ts` — makeDockAtomSessionLayer,
  DockAtomSession, feed plumbing.
- `src/internal/Geometry.projection.ts` — projection internals plus `rows`,
  `DockRow`, `DockRowEntry` (test-only today; demoted from public).

Splitting a listed public file further is allowed if a cycle or size forces
it; collapsing public symbols into `internal/` beyond the list above is not
(the command/event/model algebra is product surface).

### Identity

Add `"dock"` and `"dock-react"` to the `$I.compose(...)` list in
`packages/foundation/modeling/identity/src/packages.ts` and export `$DockId`
/ `$DockReactId` following the `$PretextId` pattern. All kernel files switch
`$ScratchpadId.create("dockview/poc/<X>")` → `$DockId.create("<RoleFile>")`.
Wire-compatible: snapshots carry only `_tag` literals; no migration.

### Tests

Move `scratchpad/dockview/poc/test/*` and
`scratchpad/test/dockview-anchored-box.test.ts` →
`packages/foundation/ui-system/dock/test/` (~84 tests). Imports go through
`@beep/dock` (test-law; relative only for local fixtures). `Minima.test.ts`
swaps `bun:test` → `@effect/vitest` (`test(` → `it(`). Package
`vitest.config.ts` merges `vitest.shared.ts` (pretext pattern); if
feed-ordering suites flake under the shared `sequence.concurrent: true`, set
`sequence.concurrent: false` for the package and record it. Scratchpad kernel
sources stay in place during M1 (deleted in M2); only tests move now (the
bun-test lane for them retires with M1).

### Registration (inside the M1 PR)

`bun install` → `bun run beep tsconfig-sync` → `bun run fallow:boundaries:write`
→ `bun run beep:preflight` green. Changeset for `@beep/dock` (patch). Note:
main's committed bun.lock is missing `@beep/ontology` workspace dep entries;
this PR's regenerated lockfile backfills them (call out in PR body).

### M1 acceptance

- Package `beep:check`, `beep:lint`, `beep:test` green; in-package
  `bun run docgen` green (every public export has compiling `@example` +
  `@category` + `@since`).
- `bun run beep:preflight` green at repo root.
- Kernel package.json and sources contain no react/react-dom/@effect/atom-react
  and no `@beep/pretext/browser` import.
- Doctrine edits landed (DECISION entry, ceiling row, 07 mirror, GLOSSARY).
- Packet + goals INDEX regenerated; exploration Trail/MAP/manifest updated
  (gate release + graduation entry).
- Zero behavior change: moved tests pass unmodified except runner/import
  mechanics.

## M2 — `@beep/dock-react` (branch `feat/dock-react-package`)

Package `packages/foundation/ui-system/dock-react`. Dependencies:
`@beep/dock`, `@beep/identity`, `@beep/schema`, `@beep/utils`,
`@beep/pretext` (+ `/browser` for the PretextCaptureLive default — the
narrowly authorized edge), `@effect/atom-react`, `effect`, `react`,
`react-dom` (catalog). Adapter stays hook-free (React 19 ref-callback
cleanups; no useState/useEffect/useCallback/useMemo).

- Decompose `scratchpad/dockview-react/src/DockviewReact.tsx` into:
  public `src/DockReact.types.ts` (DockAtomGraph, DockPanelApi,
  DockPanelProps, DockTabProps, DockRenderer, DockTabRenderer,
  DockviewAdapterApi, DockTitleMinimaOptions, DockviewReactProps) and
  `src/DockviewReact.tsx` (component); internals under `src/internal/`:
  `Gesture.models.ts`, `AdapterState.ts`, `DropCompiler.ts`, `PanelHost.tsx`,
  `GroupPane.tsx`, `FloatingPane.tsx`, `Sash.tsx`.
- Rewrite the 9 existing `@example` blocks to import from `@beep/dock-react`
  / `@beep/dock`.
- Move the 4 jsdom vitest suites + `test/setup.dom.ts`; keep
  ControllableResizeObserver + `resize()` importable for M3 reuse.
- Rewire `scratchpad/dockview-demo` to package imports; add `@beep/dock` +
  `@beep/dock-react` `workspace:^` deps to `scratchpad/package.json`.
- Storybook: `stories/dock.stories.tsx` + `tsconfig.stories.json` (editor
  pattern); capture-free story (no titleMinima); add `@beep/dock-react` to
  `apps/storybook/package.json`.
- Delete `scratchpad/dockview/` and `scratchpad/dockview-react/`; migrate the
  WHAT-IS-LEFT residue list into this packet's README "Residue" section;
  exploration Trail entry.

### M2 acceptance

- Adapter suites green under package vitest; storybook lane builds; demo
  serves on :5199 against package imports (manual smoke ok).
- `@beep/dock-react` → `@beep/dock` is the only kernel edge (no relative
  reach-ins); knip/fallow/preflight green; changeset present.

## M3 — desktop shell (branch `feat/desktop-dock-shell`)

- `apps/professional-desktop/src/App.tsx`: DesktopShell renders
  `<DockviewReact>` over `defaultDesktopWorkspace` (one group, four panels:
  `surface-chat` active default, `surface-home`, `surface-ontology`,
  `surface-sync`; `renderMode: "always"`). Delete `desktopSurfaceAtom`,
  `hashRoutingBindingAtom`, `surfaceFromHash`; nav buttons dispatch
  activate/open commands; HomeSurface cards dispatch activation.
  DocumentIntakeTarget, toasts, transport probe, chat internals untouched.
- New `src/workspace/dock.atoms.ts`: DockSnapshotStoreLocalStorage layer
  (key `"desktop:dock-workspace:v1"`), dockGraphAtom via `makeDockAtomsWith`,
  restore binding (feed failure ⇒ default workspace + clear key), debounced
  save binding. Precedent: `src/chat/ui/layout.atoms.ts`.
- CSS: port demo.css dock selectors into app styles with theme tokens.
- `titleMinima` wired with app font + TabChrome (adapter's live default).
- Tests: keep existing suites green (App.test.tsx rework budgeted); add
  default-workspace validateWorkspace proof, snapshot save/restore
  round-trip, keep-alive proof (chat stays mounted while ontology active).

## M4 — QA-to-green + close

- Quality-review-fix-loop (codex-executed shape) to zero required blockers.
- Browser QA scenario list (all must pass on the running shell): tab drag
  between groups; edge-drop split; sash resize honoring title minima;
  float/dock/maximize; Escape-cancel; reload restores layout; chat
  keep-alive across activations; intake file-drag vs dock tab-drag pointer
  non-interference; theme toggle; browser-mode smoke.
- Closeout: reflection (lint green), phases → complete, same-PR packet flip,
  INDEX regen, exploration Trail final entry,
  `docs/product/workspace-substrate.md` §7 sequencing checked off.

## Execution pins (all writer lanes)

- Verify every Effect API against `.repos/effect-v4` before writing; training
  data is v3. No `as` casts (except `as const`). Effect helper modules over
  natives. Match helpers over conditional chains. `Effect.fn`/`fnUntraced`
  per the effect-fn law. `npx vitest run --config <pkg>/vitest.config.ts`
  for package tests — never `bun test` inside `packages/**`.
- Generated files are regenerated, never hand-edited (root tsconfigs, fallow
  boundaries, inventories, goals INDEX).
- Zero-behavior-change law (M1/M2): if a test needs a semantic change to
  pass, stop and report.
