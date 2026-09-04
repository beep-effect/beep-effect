# Instance

- id: `r2-apps-dock-panel-open-active`
- file:line: `apps/professional-desktop/src/workspace/dock.atoms.ts:643`
- symbol: `isPanelActive`
- members: `isPanelActive`, `isPanelOpen`
- evidence: E4 at `dock.atoms.ts:643-672` — both helpers project the same
  `findTabsForPanel` lookup, and the active branch can only succeed when that
  lookup is present. `active && !open` is therefore impossible.

# Current shape

Two exported dual combinators independently traverse one `DockWorkspace` and
return correlated booleans. `App.tsx` consumes the pair to determine ontology
menu state, and `isPanelActive` also supplies the no-focused-group fallback for
shell navigation. `dock-shell.test.tsx` asserts each boolean separately.

This is distinct from, but must land atomically with,
`desktop-panel-menu-item-state`: this record owns the workspace query, while
that record owns the focused/current presentation state.

# Cardinality gap

Four boolean pairs are representable and three are legal: `closed`, `open`,
and `active`. A panel cannot be active without being open.

# Target schema

Define an annotated exported `DesktopPanelPresence` LiteralKit with `closed`,
`open`, and `active`, plus an exported dual `desktopPanelPresence` combinator.
Perform `DockWorkspace.findTabsForPanel` once and return `closed` for `None`,
`active` when the located tabs' active id is the requested panel, and `open`
otherwise. Do not retain boolean aliases or compatibility wrappers for the two
never-shipped app-internal helpers. Add `LiteralKit` through the current narrow
`@beep/schema/LiteralKit` subpath and annotate it with the file's Professional
Desktop identity composer.

`OntologyMenuList` maps `active` and `open` to the existing menu design's
`open` state unless `isPanelCurrent` selects `current`; an active tab in an
unfocused group is open but not current. The no-focused-group branch of
`isPanelCurrent` tests the `active` literal directly.

# Migration inventory

- `workspace/dock.atoms.ts:635-672` — replace `isPanelActive` and
  `isPanelOpen` with the named literal owner and one dual query.
- `App.tsx:65-75` — migrate imports to `DesktopPanelPresence` and
  `desktopPanelPresence`.
- `App.tsx:701-708` — combine this query with the ordered `current` projection
  from `desktop-panel-menu-item-state`; preserve focused-group semantics.
- `App.tsx:779-786` — use `active` only in the no-focused-group fallback.
- `test/dock-shell.test.tsx:14-100` — replace boolean helper assertions with
  exact `closed | open | active` table assertions and cover data-first and
  data-last invocation.
- No package barrel exports these app-local helpers; whole-repo search found
  only `App.tsx`, their JSDoc examples, and `dock-shell.test.tsx`.

# Guard-deletion accounting

Delete both boolean-returning exports, their two independent workspace
lookups, the boolean assertions in `dock-shell.test.tsx`, and the call-boundary
pair that could represent `active && !open`. All consumers branch on one
presence literal.

# Encoded-side impact

None. The state is derived from the in-memory `DockWorkspace` on demand. Dock
snapshot encoding, local-storage persistence, panel ids, focused-group rules,
and commands remain unchanged.

# Test impact

Cover a closed panel, an inactive open tab, and an active open tab; both dual
call forms; an active tab in a non-focused group mapping to menu `open`; and
the no-focus fallback mapping active to current. Keep the existing dock shell
and snapshot tests. Because the affected shell is gesture-bearing, record the
required portless dock/menu browser QA alongside the atomic Professional
Desktop batch.

# Risk and sequencing

Land in Tier 1D with `desktop-panel-menu-item-state` and the other Professional
Desktop shell designs. The semantic trap is conflating group activity with
shell currentness: focused-group current wins, while an active panel in another
group remains merely open in the menu.
