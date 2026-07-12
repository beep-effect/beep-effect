# Dockview POC — what is left (v2)

Reconciled 2026-07-11 after the Codex-driven build-out (GPT-5.6-sol writing,
Fable orchestrating/reviewing; nine sequential kernel/adapter lanes plus a
crispen-ultra pass). The original v1 gap analysis lives in git history of this
file; everything it ordered has landed except the items in "Still open" below.

## Current state

Proof status (all green, run from repo root):

```sh
bunx tsgo -p scratchpad/dockview/tsconfig.json --pretty false          # exit 0
(cd scratchpad/dockview && bunx biome check --config-path biome.json .) # exit 0
bun test scratchpad/dockview/poc/test scratchpad/test/dockview-anchored-box.test.ts  # 63 pass
bunx tsgo -p scratchpad/dockview-react/tsconfig.json --pretty false     # exit 0
(cd scratchpad/dockview-react && bunx biome check --config-path biome.json .)        # exit 0
npx vitest run --config scratchpad/dockview-react/vitest.config.ts      # 10 pass
```

## Landed since v1 (2026-07-11)

- **Housekeeping** — biome debt fixed, dead pre-POC sketches deleted, the
  AnchoredBox sketch first quarantined then *promoted into the kernel proper*
  (poc/AnchoredBox.ts) when floating groups needed it; tsconfig/biome cover the
  whole module; README gained "Divergences and their costs", the bun-test
  exemption note, and edge-groups/tab-chips non-goal triage.
- **Snapshot version envelope** — `DockSnapshot { version: S.tag(1), workspace }`
  via `S.fromJsonString`; legacy-unversioned and wrong-version inputs fail as
  typed `DockInputError`.
- **Tier 1 command algebra** — `TabPlacement { groupId, index: Option, activate }`
  powers open-at-index / open-inactive / move-to-index / same-group reorder
  (`panel-position-unchanged` no-op reason, `PanelReorderedEvent`);
  `RootSplitPlacement` docks new groups against the workspace edge;
  `MoveGroupCommand` merges (index- and activation-aware) or relocates whole
  groups via honest `GroupSplitPlacement` / `GroupRootSplitPlacement` variants
  (no dangling `newGroupId`); cross-group `movePanel` honors index+activate
  (bug found by the adapter's gesture tests, fixed at the destination-insert
  site).
- **Lossless outcome feed** — every completed operation (success AND typed
  failure) appends to a read-only, in-order feed atom with monotone submission
  ordinals, alongside the latest-wins result atom; the unbounded-log tradeoff
  is documented in the README.
- **Panel/group updates** — `UpdatePanelCommand` with Option-replace `PanelPatch`
  (title/view/renderMode/tabComponent — tabComponent is a nested Option:
  patch-or-not × set-or-clear) emitting per-facet events; `Panel.renderMode`
  ("onlyWhenVisible" | "always") and `tabComponent` persisted;
  `GroupMetadata { locked, hideHeader, headerPosition, visible }` on `TabsNode`
  preserved across every zipper/tree reconstruction; `UpdateGroupCommand`.
- **Policy layer** — `makePolicyDockEngineLayer` wraps only the live engine's
  `transition`; `lockedGroupsPolicy` vetoes drops into locked /
  `no-drop-target` groups with `group-locked`, proven with-and-without at the
  session level. The replaceable-engine claim is no longer a claim.
- **Geometry projection** — pure `(DockNode, containerBox, gap) → DockGeometry`
  (group boxes + sash hit-rects) with exact-partition rounding (leading child
  rounds once, trailing is the remainder — no drift); `rows()` normalizing view
  over nested same-axis splits; `makeDockGeometryAtoms` derived-atom factory;
  visibility, maximize, and floating members all compose in projection.
- **Hidden + maximize** — `GroupMetadata.visible` (no cached-size machinery:
  proportional ratios are simply retained while hidden — crisper than
  dockview's `cachedVisibleSize`); `PopulatedWorkspace.maximized: Option<GroupId>`
  with a schema-enforced exists+visible invariant and all eleven dockview-parity
  auto-exit rules implemented and tested.
- **Floating groups (topology)** — both workspace variants carry
  `floating: ReadonlyArray<FloatingMember { anchoredBox, root }>` (array order =
  z-order); identity invariants span the whole forest; forest-aware
  `DockWorkspace` statics let every existing command work inside floating
  trees; `FloatGroupCommand` / `DockFloatingGroupCommand` /
  `MoveFloatingGroupCommand` with typed reasons; geometry resolves anchored
  boxes and projects floating subtrees in z-order.
- **React adapter — `scratchpad/dockview-react`** — hook-free (zero React hooks;
  React-19 ref-callback cleanups + @effect/atom-react bridge), kernel-owned
  registry via `RegistryContext.Provider`, one stable portal target per panel
  reparented by `appendChild` (DOM keep-alive proven by a node-identity test),
  renderMode/hideHeader/headerPosition honored, missing-renderer alert panel,
  watermark, minimal `onReady` api; full gesture compiler (tab click/close,
  drag-to-reorder, drag-to-group-at-index, edge-drop splits, container-edge
  root splits, Escape cancel, sash drag with transient override then ONE
  clamped `resizeSplit` on release); jsdom Vitest lane (repo law) with 10
  tests.
- **Crispen ultra pass** — schema-derived guards/equality/match adoption in both
  modules, 4 duplicated helpers deleted, feed exposed read-only, deliberate
  leaves marked with `crispen:` comments; behavior parity, −6 net lines.

## Still open

Adapter-side (the kernel models these; `DockviewReact` does not render them yet):

- **Floating windows in the adapter** — `geometry.floating` is ignored; no
  floating panes, no float/dock gestures, no z-order interaction. The kernel
  topology and commands are ready.
- **Maximize affordance** — geometry renders a maximized group correctly, but
  no UI gesture (double-click tab, button) compiles Maximize/Restore commands.
- **Drop-indicator polish, tab overflow (dropdown), header action slots,
  context menus** — none attempted.
- **Announcer/autosave/undo consumers** — the lossless feed exists; nothing
  consumes it yet.

Kernel-side (unchanged non-goals or newly explicit):

- **Popout windows** — lifecycle (open/blocked/close, re-dock) and the truly
  hard part, iframe/webview state loss on DOM reparenting
  (`overlayRenderContainer` upstream). Floating topology is the prerequisite
  and now exists.
- **Per-child min/max constraints, LayoutPriority, snap-to-collapse** — the
  geometry layer encodes only clamp + exact partition; the deeper splitview
  constraint system remains out.
- **MRU activation** — zipper promotion stands (documented divergence); MRU
  would be host/session state.
- **Undo/redo** — host-side by design; outcomes carry previousRevision + origin
  and the feed makes recording lossless.
- **Edge groups, tab-group chips** — triaged non-goals (README).
- **dockview serialized-format compatibility, migrations beyond the v1
  envelope** — non-goals.
- **a11y (live-region announcements, keyboard-docking flow), spatial group
  navigation, touch/pointer dual DnD backends, performance profiling** — the
  un-analyzed dimensions from v1 remain un-analyzed; keyboard docking is the
  most valuable next gesture compiler if pursued.

Process notes:

- Kernel tests run under `bun test` (documented scratchpad exemption); the
  adapter runs under the repo's Vitest law. Biome emits one informational
  config-deprecation notice in each module (schema version pin) — harmless,
  fix by bumping the biome config schema when convenient.
- Everything is uncommitted working-tree state on `dockview-experiment` —
  publish via yeet from a feature branch when ready.
