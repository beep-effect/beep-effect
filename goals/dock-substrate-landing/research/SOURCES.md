# SOURCES — Dock Substrate Landing

Grounding evidence for the 2026-07-14 grill decisions and the SPEC.

## Product canon and provenance

- `docs/product/workspace-substrate.md` — §1 names `@beep/dock` +
  `@beep/dock-react` as the intended packages; §7 sequencing: mature in
  scratchpad → land as packages → shell revamp puts the dock workspace at
  the root → surfaces migrate one at a time.
- `explorations/computable-workspace-geometry/` — stage `graduate`;
  MAP/DECISIONS routed dock-kernel residue to
  `scratchpad/dockview/WHAT-IS-LEFT.md`; pretext driver (`@beep/pretext`)
  was Goal 1 and is the graduation-ceremony precedent
  (`goals/pretext-driver`, completed-retained).
- Scratchpad state at packet open: kernel `scratchpad/dockview/poc`
  (~4.6k lines source, ~82 tests under bun test), adapter
  `scratchpad/dockview-react` (1367-line component, ~20 vitest jsdom
  tests), demo `scratchpad/dockview-demo` (vite, port 5199). Merged via
  PRs #391/#396/#397/#399/#403.

## Doctrine grounding

- `standards/ARCHITECTURE.md` — routing table row "Product-agnostic UI
  primitives … → `foundation/ui-system`"; ceiling table (ui-system →
  primitive, modeling, ui-system) — amended by this packet's DECISION to
  add the narrow drivers edge.
- `standards/architecture/07-non-slice-families.md` — "Why UI Primitives
  Stay In `foundation`"; platform-first routing.
- `standards/architecture/03-driver-boundaries.md` — drivers wrap external
  engines; repo-owned substrate belongs in foundation (the dock system has
  no external engine — not a driver).
- Naming: `@beep/workspace*` is taken by the product slice
  (`packages/workspace/*`); `@beep/dock` was verified free in root
  tsconfig/workspaces at packet open.
- Precedent for ui-system consuming external React libs directly:
  `@beep/ui` (lexical, base-ui, react-resizable-panels…), `@beep/editor`
  (@lexical/*). The pretext edge differs: pretext is a driver, hence the
  DECISION record.

## Integration target

- `apps/professional-desktop/src/App.tsx` — hash-routed single-surface
  switcher (`desktopSurfaceAtom`, `surfaceFromHash`, `DesktopShell`);
  surfaces unmount on switch; no incumbent dock system.
- Persistence precedent: `src/chat/ui/layout.atoms.ts` (`layoutRuntime` =
  `Atom.runtime(KeyValueStore.layerStorage(() => globalThis.localStorage))`,
  `Atom.kvs` `sidebarPercentAtom`).
- Kernel persistence surface: `DockSnapshotStore`, `DockEngineLive`,
  `makeDockAtomsWith`, `persistedSnapshotAtom`, `SaveDockSnapshot` /
  `RestoreDockSnapshot`, validated `restoreDockWorkspace`.
- App test fallout assessment (2026-07-14 design pass): `test/App.test.tsx`
  is the only suite rendering the shell; `sidebar-layout`, `chat-ui`,
  `table-layout`, sidecar/RPC/integration suites do not touch the switcher.

## Write-gate release

- Gate text: `explorations/computable-workspace-geometry/MAP.md` (Goal 2
  section) + README "Next Open Question"; `goals/pretext-driver/ops/manifest.json` note.
- Evidence for release (2026-07-14): beep-effect6 checkout rotated to
  `docs/graph-3d-view-packet` (HEAD Jul 14); campaign branch
  `feat/professional-desktop-improvements` dormant since Jul 13 17:20; no
  sibling checkout holds a desktop branch; owner (elpresidank) confirmed
  release in the grill.

## Known repo facts the lanes must respect

- Docgen compiles `@example` for every public export; `docgen.json`
  `exclude: ["src/internal/**/*.ts"]` removes internals from docgen AND the
  jsdoc ratchet (generator reads the exclude list).
- `vitest.shared.ts` sets `sequence.concurrent: true`; root
  `vitest.setup.ts` installs Equal-aware equality testers.
- main's committed `bun.lock` is missing `@beep/ontology` workspace dep
  entries (plain `bun install` re-adds them); M1's lockfile regen backfills.
- `beep architecture` codegen scaffolds slice roles only — foundation
  packages are hand-authored from the pretext template + `tsconfig-sync`.
