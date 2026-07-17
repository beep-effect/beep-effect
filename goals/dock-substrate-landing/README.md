# Dock Substrate Landing

Lifecycle: `active`

Graduate the scratchpad dock system — pure schema-first kernel
(`scratchpad/dockview/poc`) + hook-free React adapter
(`scratchpad/dockview-react`) — into real packages `@beep/dock` and
`@beep/dock-react` under `packages/foundation/ui-system/`, then land the dock
workspace as the root shell of `apps/professional-desktop`, QA'd to green.

Product canon: `docs/product/workspace-substrate.md` (§7 names exactly this
sequencing). Provenance: `explorations/computable-workspace-geometry`
(stage `graduate`); kernel/adapter matured in scratchpad across PRs
#391/#396/#397/#399/#403.

## Structure

- `SPEC.md` — normative contract (locked decisions, per-milestone
  requirements, acceptance).
- `PLAN.md` — execution phases and writer/QA lanes.
- `GOAL.md` — compact `/goal` launcher.
- `ops/manifest.json` — machine state.
- `research/SOURCES.md` — grounding evidence.

## Milestones

| Milestone | Branch | Writer | State |
|---|---|---|---|
| M1 `@beep/dock` kernel package | `feat/dock-package` | codex | merged (PR #416) |
| M2 `@beep/dock-react` + scratchpad retirement | `feat/dock-react-package` | codex | PR #421 (awaiting merge) |
| M3 desktop dock shell | `feat/desktop-dock-shell` | Fable | landed (this PR) |
| M4 QA-to-green + close | (fix lanes as needed) | codex QA | pending |

## Latest evidence

- 2026-07-17 — M3 landed on `feat/desktop-dock-shell`: the professional-desktop
  shell is a dock workspace. Hash routing retired; Home/Chat/Ontology/Vault
  sync are keep-alive panels (`renderMode: "always"`) in one group, chat
  active by default; nav and Home cards dispatch ActivatePanel/OpenPanel;
  layout persists via a `DockSnapshotStore` over localStorage
  (`desktop:dock-workspace:v1`) with debounced saves, boot restore, and
  poisoned-key fallback to the validated default. Two-registry design: app
  atoms stay in the root RegistryProvider, dock atoms in the graph registry
  (`useDockAtom` bridge; panels re-enter the app registry). Dock chrome
  restyled with app theme tokens. App suite 74/74 green (4 new dock-shell
  tests incl. keep-alive and snapshot round-trip); vite production build
  green. Interactive gesture smoke deferred to M4 codex browser QA.

- 2026-07-16 — M2 landed on `feat/dock-react-package`: `@beep/dock-react` at
  `packages/foundation/ui-system/dock-react` (public `DockReact.types.ts` +
  `DockviewReact.tsx` over seven internals incl. the reusable
  `ResizeObserverHarness`, curated barrel, `$DockReactId` identity, 20 jsdom
  vitest tests, 10 compiled `@example` blocks, capture-free Storybook story);
  demo + computable-layout rewired to package imports;
  `scratchpad/dockview` + `scratchpad/dockview-react` deleted with
  WHAT-IS-LEFT residuals migrated below; governance recorded (4 schema-first
  + 7 dual-arity exceptions, 2 native-runtime allowlist entries); full
  `lint policy` + `beep:preflight` gauntlet green.
- 2026-07-15 — M1 landed on `feat/dock-package`: `@beep/dock` at
  `packages/foundation/ui-system/dock` (19 public role files + internals,
  curated barrel, `$DockId` identity, 86 vitest tests incl. two
  schema-derived property suites, 188 compiled `@example` blocks), doctrine
  DECISION + ceiling row + glossary, gate-release notes, full
  `beep:preflight` green. Three-reviewer codex panel: zero
  semantic-divergence findings; doc/metadata findings fixed or refuted in
  the same PR.
- 2026-07-14 — packet opened; grill locked six decisions (two ui-system
  packages; narrow ui-system→drivers DECISION; beep-effect6 gate released;
  four-coarse-panel shell scope; one packet / milestone-per-PR;
  codex-executed QA loop).

## Residuals (from scratchpad WHAT-IS-LEFT v2)

- Adapter polish remains open: drop-indicator polish, a tab-overflow dropdown,
  header action slots, context menus, and dragging a floating pane back to a
  dock target.
- Feed consumers remain open for announcements, autosave, and undo. Recency
  and the MRU atom exist, but the host-side activation half still must read the
  feed-derived MRU order and dispatch the follow-up activation.
- Popout windows remain open, including blocked/open/close/re-dock lifecycle
  and iframe or webview state loss during DOM reparenting.
- Geometry still lacks maximum constraints, `LayoutPriority`, and
  snap-to-collapse. Minimum constraints and reactive title minima have landed.
- Edge groups and tab-group chips remain explicit non-goals.
- Dockview serialized-format compatibility and migrations beyond the v1
  envelope remain explicit non-goals.
- Accessibility live-region announcements, keyboard docking and spatial group
  navigation, touch/pointer dual drag backends, and performance profiling
  remain unanalyzed; keyboard docking is the leading next gesture compiler.
