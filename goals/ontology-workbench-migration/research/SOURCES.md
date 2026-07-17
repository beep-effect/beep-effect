# Research Sources — Ontology Workbench Migration

Ground truth captured 2026-07-17 during the packet-opening grill (three
read-only exploration passes over the repo at `7e0410a1bb`). Line numbers
drift; symbol names are the stable anchors.

## 1. Roadmap position

- `docs/product/workspace-substrate.md` §7 sequencing: steps 1–3 (kernel
  matures → `@beep/dock`/`@beep/dock-react` land → shell revamp) closed with
  `goals/dock-substrate-landing` (PRs #416/#421/#426/#427). Step 4 —
  "existing surfaces migrate one at a time, behind the tests they already
  have" — is the remainder this packet begins. §6 binding guardrails apply
  to every panel.
- `explorations/computable-workspace-geometry/MAP.md`: Goal 1 pretext-driver
  (closed), Goal 2 thread-virtualization (coordination-gated, editor-stack
  ownership must be re-confirmed — NOT this packet), Goal 3
  dock-substrate-landing (closed).
- Predecessor residuals authority:
  `goals/dock-substrate-landing/README.md` "Residuals" — this packet absorbs
  four (per-panel constraints, tab overflow, drop quadrants, StrictMode-safe
  tree host) and leaves the rest recorded there.

## 2. Ontology workbench composition (`@beep/ontology-ui`)

- Monolith: `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx`
  (~1160 lines, one `OntologyWorkbench` function; decomposition-debt comment
  near line 416). Regions inline: top toolbar (~705–802), document error bar
  (~806–813), left tree `<aside>` (~820–840, MUI X `RichTreeView` mount
  ~834–838), center graph + Turtle source `<main>` (~842–872), right stack
  `<aside>` (~874–1157: Inspector, Add Triple + gestures, SPARQL, Validation,
  Change Log, Worker Metrics).
- Tree view-model: `ontologyTreeItemsFor` in `Session.tree.ts`.
- UI-file-local atoms to relocate (lines ~97–101): `openPathInputAtom`,
  `subjectInputAtom`, `predicateInputAtom`, `objectInputAtom`,
  `objectKindAtom`.

## 3. Shared state (`@beep/ontology-client`, `Session.atoms.ts`)

- Nearly all cross-region state is already atom-shaped in the app root
  registry; dock panel renderers re-provide that registry
  (`makeSurfaceRenderers`, `apps/professional-desktop/src/App.tsx`), so
  panels share state without a rewrite.
- Selection spine: `selectedOntologyResourceIriAtom` (tree ↔ graph ↔
  inspector ↔ validation ↔ projection; bidirectional with the 3D renderer via
  subscription).
- Keep-alive (`workbenchState`/`Atom.keepAlive`): `ontologySessionAtom`,
  path/source/dirty tracking, `ontologyViewModeAtom`, `ontologyFoldLevelAtom`,
  `ontologyInferredViewAtom`, inference/SPARQL/validation results.
- Renderer toggle: `ontologyGraphRendererAtom` (`"cosmos" | "graph3d"`) feeds
  `renderRequestAtom` → `ontologyGraphRenderBridgeAtom`, mounting
  `@beep/cosmos` or `@beep/graph-3d/browser` into
  `ontologyGraphContainerAtom` (single shared container — Graph panel owns
  it after the split; the 3D switch moves into Graph panel chrome).
- Mutations serialized by `sessionMutationSemaphore`; graph projection runs
  in a web Worker via `ontologyGraphWorkerBridgeAtom`.
- `Graph3DSpike` (`apps/professional-desktop/src/spikes/`) is a separate
  full-screen dev benchmark, unrelated to the workbench toggle.

## 4. Dock capability audit (`@beep/dock`, `@beep/dock-react`)

- 14-command kernel union in `Dock.commands.ts`; `UpdatePanelCommand` +
  `PanelPatch` exist (panel facet updates), `GroupPatch` covers
  locked/header-position.
- MISSING (this packet's M1): per-panel min/max constraints (`Panel` has no
  size fields; only global `minGroupExtent`, title minima, `SplitRatio`
  clamp 1000–9000, floating min consts 240×160); tab-overflow handling;
  directional drop quadrants (`DropOverlay` in `DockviewReact.tsx` is a
  single whole-group highlight); drag ghost (NOT in scope).
- MISSING (out of scope, recorded): popout windows, keyboard move/resize,
  Arrow/Home/End tab roving, theming API (styling is inline + `data-*` CSS
  seams, themed via `apps/professional-desktop/src/styles/dock.css`),
  snapshot migration.
- Persistence: `DOCK_SNAPSHOT_KEY = "desktop:dock-workspace:v1"`
  (`src/workspace/dock.atoms.ts`); poisoned-key clear confirmed on decode
  failure — but a stale snapshot referencing a retired renderer key decodes
  FINE and restores a dead panel, hence the locked v2 key bump.
- Storybook harness exists: `dock-react/stories/dock.stories.tsx` +
  `apps/storybook` composition root (interaction tests via `storybook/test`).

## 5. Test inventory guarding the zero-behavior law (M2)

- `packages/ontology/ui/test/Session.workbench.test.ts` (hierarchy + IRI
  validation).
- `packages/ontology/client/test/`: `browser/graph-renderer-toggle.test.ts`
  (+ screenshot baseline), `Session.atoms.test.ts`,
  `workbench-state-lifetime.test.ts`, `stale-read.test.ts`,
  `failure-messages.test.ts`, `worker-wire.test.ts`, `graph-labels.test.ts`.
- App: `dock-shell.test.tsx`, `surface-boundary.test.tsx`, `App.test.tsx`,
  `ontology-workspace-seed.test.ts`, sidecar/integration suites.
- Known upstream: MUI X `useDisposable` StrictMode invariant at the
  `RichTreeView` mount (dev-only, currently absorbed by `SurfaceRetry` in
  `App.tsx`); M2/M3 attempt the proper StrictMode-safe host.
