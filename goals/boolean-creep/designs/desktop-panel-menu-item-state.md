## 1. Instance

- id: `desktop-panel-menu-item-state`
- file:line: `apps/professional-desktop/src/App.tsx:652`
- symbol: `OntologyMenuItem`
- members: `current`, `open`
- evidence classes:
  - E4 at `apps/professional-desktop/src/App.tsx:696` — current implies open by construction at every call site — a panel can only be current while open.

## 2. Current shape

Live declaration at `apps/professional-desktop/src/App.tsx:646`:

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

The two reads are at `apps/professional-desktop/src/App.tsx:660` and `:667`:

```tsx
aria-current={current ? "page" : undefined}
```

```tsx
open ? "h-1.5 w-1.5 rounded-full bg-primary" : "h-1.5 w-1.5 rounded-full border border-muted-foreground/50"
```

The sole call site at `apps/professional-desktop/src/App.tsx:693` writes both props:

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

`current && !open` is illegal.

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

Project the literal once at the call boundary:

```tsx
state={
  isCurrent(panel.key)
    ? OntologyMenuItemState.Enum.current
    : isPanelOpen(workspace, panel.key)
      ? OntologyMenuItemState.Enum.open
      : OntologyMenuItemState.Enum.closed
}
```

## 5. Migration inventory

- `apps/professional-desktop/src/App.tsx:645` — update the row comment to describe the single item state rather than an open-state flag.
- `apps/professional-desktop/src/App.tsx:647` — remove `current` and `open` from the destructuring and add `state`.
- `apps/professional-desktop/src/App.tsx:652` — replace the two boolean prop members with `state: OntologyMenuItemState`.
- `apps/professional-desktop/src/App.tsx:660` — derive `aria-current` from the `current` literal guard.
- `apps/professional-desktop/src/App.tsx:667` — choose the filled/open dot for both `open` and `current` by checking only the `closed` case.
- `apps/professional-desktop/src/App.tsx:696` — replace the `current`/`open` prop pair with one ordered state projection from `isCurrent` and `isPanelOpen`.

No other source or test constructs `OntologyMenuItem`.

## 6. Guard-deletion accounting

- `apps/professional-desktop/src/App.tsx:652` — delete the prop-level comment-only invariant that `current` implies `open`; the literal cannot represent the illegal combination.
- `apps/professional-desktop/src/App.tsx:660` and `:667` — delete independent boolean reads over `current` and `open`; both presentation choices consume one state.
- `apps/professional-desktop/src/App.tsx:696` — delete the call-site pair whose coherence depended on two separate helper calls and replace it with one ordered projection.

There is no legacy normalizer or runtime mutual-exclusion error.

## 7. Encoded-side impact

none (internal)

The literal exists only in local React props and is derived from the dock workspace on every render.

## 8. Test impact

- `apps/professional-desktop/test/dock-shell.test.tsx:170` — the existing closed-panel navigation test continues to cover the `closed` transition into an opened panel.
- `apps/professional-desktop/test/dock-shell.test.tsx:158` — current-page ARIA assertions cover the same semantic contract elsewhere in the shell, but no test currently inspects an ontology menu item's `aria-current` or dot style. Extend this file with closed, open-not-current, and current menu-entry assertions.

## 9. Risk & sequencing

The change is confined to `App.tsx`, which is shared with other shell designs and therefore has merge-conflict risk. Keep the kit adjacent to `OntologyMenuItem`; no dock package API changes. Preserve the ordering `current` before `open`, because current is the narrower state.
