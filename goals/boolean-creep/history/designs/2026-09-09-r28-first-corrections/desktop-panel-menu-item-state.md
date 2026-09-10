## 1. Instance

- id: `desktop-panel-menu-item-state`
- file:line: `apps/professional-desktop/src/App.tsx:660`
- symbol: `OntologyMenuItem`
- members: `current`, `open`
- evidence classes:
  - E4 at `apps/professional-desktop/src/App.tsx:704-705` — current implies open by construction at every call site — a panel can only be current while open.

Current source rechecked at `7440cb8c4302ce64b87860069a464bafbf65f576`, with an identical
packages/apps corpus to main `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.
This refresh is design preparation; replacement independent P3 review is pending.

## 2. Current shape

Live declaration at `apps/professional-desktop/src/App.tsx:654`:

```tsx
const OntologyMenuItem = ({
  current,
  onSelect,
  open,
  panel,
}: {
  readonly current: boolean;
  readonly onSelect: () => void;
  readonly open: boolean;
  readonly panel: (typeof DESKTOP_PANELS)[number];
}): JSX.Element => (
```

The two reads are at `apps/professional-desktop/src/App.tsx:668` and `:675`:

```tsx
aria-current={current ? "page" : undefined}
```

```tsx
open ? "h-1.5 w-1.5 rounded-full bg-primary" : "h-1.5 w-1.5 rounded-full border border-muted-foreground/50"
```

The sole call site at `apps/professional-desktop/src/App.tsx:701` writes both props:

```tsx
<OntologyMenuItem
  key={panel.key}
  current={isCurrent(panel.key)}
  open={isPanelOpen(workspace, panel.key)}
  onSelect={() => onNavigate(panel.key)}
  panel={panel}
/>
```

## 3. Cardinality gap

Two booleans represent four combinations, but only three are legal:

- `closed`: the panel is not open and cannot be current.
- `open`: the panel is open but not current in the focused group.
- `current`: the panel is open and current.

`current && !open` is illegal. The proof includes both currentness branches:
`App.tsx:779-786` uses either the active-panel lookup or a focused group
lookup whose `tabs.active` id equals the requested panel.
`Dock.models-tree.ts:597-598` always includes that active panel in
`TabsNode.panels`; `findForPanel:586-592` and workspace
`findTabsForPanel:1350-1356` therefore find it. A stale focused group id
returns false, never current-without-open.

## 4. Target schema

`App.tsx` already imports `LiteralKit` and owns the `$I` composer. Add one named local kit and derived type:

```ts
const OntologyMenuItemState = LiteralKit(["closed", "open", "current"]).pipe(
  $I.annoteSchema("OntologyMenuItemState", {
    description: "Exclusive visibility and focus state of an ontology panel menu entry.",
  })
);

type OntologyMenuItemState = typeof OntologyMenuItemState.Type;
```

Replace the props and reads:

```tsx
const OntologyMenuItem = ({
  onSelect,
  panel,
  state,
}: {
  readonly onSelect: () => void;
  readonly panel: (typeof DESKTOP_PANELS)[number];
  readonly state: OntologyMenuItemState;
}): JSX.Element => (
  <button
    type="button"
    data-panel-menu-item={panel.key}
    aria-current={OntologyMenuItemState.is.current(state) ? "page" : undefined}
    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
    onClick={onSelect}
  >
    <span
      aria-hidden
      className={
        OntologyMenuItemState.is.closed(state)
          ? "h-1.5 w-1.5 rounded-full border border-muted-foreground/50"
          : "h-1.5 w-1.5 rounded-full bg-primary"
      }
    />
    {panel.label}
  </button>
);
```

Project the literal once at the call boundary from the sibling migration's
single workspace query. This design lands atomically with
`r2-apps-dock-panel-open-active`; the old `isPanelOpen` and `isPanelActive`
helpers no longer exist in the resulting source:

```tsx
const presence = desktopPanelPresence(workspace, panel.key)

state={
  isCurrent(panel.key)
    ? OntologyMenuItemState.Enum.current
    : DesktopPanelPresence.is.closed(presence)
      ? OntologyMenuItemState.Enum.closed
      : OntologyMenuItemState.Enum.open
}
```

## 5. Migration inventory

- `apps/professional-desktop/src/App.tsx:653` — update the row comment to describe the single item state rather than an open-state flag.
- `apps/professional-desktop/src/App.tsx:654-662` — remove `current` and `open` from the destructuring/props and add `state: OntologyMenuItemState`.
- `apps/professional-desktop/src/App.tsx:668` — derive `aria-current` from the `current` literal guard.
- `apps/professional-desktop/src/App.tsx:675` — choose the filled/open dot for both `open` and `current` by checking only the `closed` case.
- `apps/professional-desktop/src/App.tsx:704-705` — replace the `current`/`open` prop pair with one ordered state projection from `isCurrent` and the sibling design's one `desktopPanelPresence(workspace, panel.key)` result. Map both `active` and `open` presence to menu `open` unless focused-group currentness selects `current`.

No other source or test constructs `OntologyMenuItem`.

## 6. Guard-deletion accounting

- `apps/professional-desktop/src/App.tsx:660-662` — delete the prop-level comment-only invariant that `current` implies `open`; the literal cannot represent the illegal combination.
- `apps/professional-desktop/src/App.tsx:668` and `:675` — delete independent boolean reads over `current` and `open`; both presentation choices consume one state.
- `apps/professional-desktop/src/App.tsx:704-705` — delete the call-site pair whose coherence depended on two separate helper calls and replace it with one ordered projection.

There is no legacy normalizer or runtime mutual-exclusion error.

## 7. Encoded-side impact

none (internal)

The literal exists only in local React props and is derived from the dock workspace on every render.

## 8. Test impact

- `apps/professional-desktop/test/dock-shell.test.tsx:172` — the existing closed-panel navigation test continues to cover the `closed` transition into an opened panel.
- `apps/professional-desktop/test/dock-shell.test.tsx:166` — current-page ARIA assertions cover the same semantic contract elsewhere in the shell, but no test currently inspects an ontology menu item's `aria-current` or dot style. Extend this file with closed, open-not-current, and current menu-entry assertions.
- Record the affected clickable ontology rail through the portless Professional Desktop script and complete the `browser-qa-loop` record -> extract -> judge sequence with `requiredCount: 0`. The evidence must exercise closed, open-not-current, and current entries, click navigation, `aria-current`, and the outlined/filled dot transitions.

## 9. Risk & sequencing

Land atomically with `r2-apps-dock-panel-open-active`, which deletes the two
boolean dock helpers and introduces `DesktopPanelPresence` plus
`desktopPanelPresence`; this design must consume that replacement rather than
name either deleted helper. The source change spans `App.tsx`, dock workspace
state, tests, and recorded browser evidence. Keep the menu kit adjacent to
`OntologyMenuItem`; no supported package API changes. Preserve focused-group
currentness ahead of presence, because `current` is narrower than an active tab
in another group.
