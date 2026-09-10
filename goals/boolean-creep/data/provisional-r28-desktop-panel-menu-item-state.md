# Provisional R28 ontology menu item correction

P2 correction for existing `desktop-panel-menu-item-state`, bound to source
HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7` and main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. The owner remains the actual
`OntologyMenuItem` React props in `apps/professional-desktop/src/App.tsx`:
`current`/`open`, 4/3, derived/internal/LiteralKit/Tier 1. The cardinality and
qualification do not change. This draft removes the current design's
dependency on the out-of-net callable query refactor; it is not canonical or
independent P3 acceptance. See `data/design-refresh-2026-09-09-r28-apps-carriers.md`.

## Current shape

`OntologyMenuItem` at `App.tsx:654-680` receives actual Boolean props
`current` (`660`) and `open` (`662`), plus a callback and full panel descriptor.
It projects currentness into `aria-current` at668 and openness into filled
versus outlined dot styling at675. The only JSX writer is
`OntologyMenuList:702-708`, which computes both values from the same workspace
and currentness closure.

`DesktopShell.isPanelCurrent` at `779-786` chooses the active panel of the
focused group, or falls back to `isPanelActive` when no group is focused.
The actual source query helpers in `workspace/dock.atoms.ts:643-672` are
callables; their pair is not an eligible stored/derived Boolean carrier and
its canonical design is proposed for archival withdrawal. That withdrawal
does not remove or invalidate the actual menu props owner.

## Cardinality gap

The props permit four Boolean tuples; the actual writer supports three:

| Menu state | `current` | `open` |
| --- | --- | --- |
| `closed` | false | false |
| `open` | false | true |
| `current` | true | true |

Current implies open in both source currentness branches. A focused-group
match finds that group's active panel; the no-focus branch finds an active
panel in a containing group. `Dock.models-tree.ts:597-598` includes the
active panel in its panels list, and searches at `586-592,1350-1356` therefore
find it. A stale focused group yields false. An active tab in an unfocused
group can be open but not current; preserve that legal distinction.

The sibling query callables do not create an additional four-state census
owner. Required panel descriptors, workspace trees, floating members and
callbacks are payloads and context, not new Boolean axes.

## Target schema

Reuse the current design's one local annotated literal kit in `App.tsx`,
which already imports LiteralKit and owns the identity composer:

```ts
const OntologyMenuItemState = LiteralKit(["closed", "open", "current"]).pipe(
  $I.annoteSchema("OntologyMenuItemState", {
    description: "Visibility and focus state of an ontology panel menu entry.",
  }),
);
type OntologyMenuItemState = typeof OntologyMenuItemState.Type;
```

Replace the two Boolean props with `state: OntologyMenuItemState`. Keep the
callback and exact `(typeof DESKTOP_PANELS)[number]` panel payload. Use the
derived `is.current` guard for `aria-current="page"`; use `is.closed` to
choose the outlined dot, with both remaining cases using the filled dot.

At the actual JSX boundary, select current first when `isCurrent(panel.key)`
is true; otherwise select open or closed from the existing
`isPanelOpen(workspace, panel.key)` query. Express the selection with the
existing match/helper conventions. Do not first store two new parallel
Boolean locals or pass a reverse `{ current, open }` compatibility object.
The existing dock predicates remain available and retain their public app
call signatures; no new `DesktopPanelPresence` schema/query is required.

This is a pure derived rendering state. Do not add storage, a reducer, a
codec, a new service, a cross-package helper, or a new public export.

## Migration inventory

| Source site | Atomic implementation change |
| --- | --- |
| `App.tsx` local schema declarations | Add the local annotated three-case kit/type using existing imports/composer. |
| `App.tsx:653-664` | Update the comment; replace current/open destructuring and props declarations with state. Preserve onSelect and the full panel payload. |
| `App.tsx:668` | Derive the same ARIA value from the current case. |
| `App.tsx:672-677` | Preserve both exact dot class strings and the aria-hidden span; derive style from closed versus open/current. |
| `App.tsx:702-708` | Replace the pair of writes with the ordered three-case projection. Preserve key, onNavigate callback and panel descriptor. |
| `App.tsx:779-786` | Keep both existing focused/no-focus currentness branches exactly; the query APIs remain unchanged. |
| `workspace/dock.atoms.ts:643-672` | No implementation change. Retain both dual callable APIs, their supported consumers and documentation examples. They are proof dependencies, not additional qualified owners. |
| `test/dock-shell.test.tsx` | Preserve validated workspace, query and snapshot tests; add focused menu-entry state/render assertions. |

No other source or fixture directly constructs `OntologyMenuItem`; its sole
writer is the map callback above. No app/package barrel exports the private
component or new literal. Other shell navigation, query consumers, dock
persistence and panel activation commands continue to use current source.
The revised implementation does not depend on the withdrawn
`r2-apps-dock-panel-open-active` design landing first or atomically.

## Guard-deletion accounting

Delete the two independent Boolean props and paired JSX writes, replacing
them with a single state. Delete independent current/open reads at668/675;
both render choices consume one schema-owned value. The caller can no longer
pass current without open to this private component.

There is no runtime mutual-exclusion throw or legacy normalizer to remove.
The currentness/presence queries still perform necessary derivation. Do not
claim their functions or lookups as deleted guards, and do not remove tests
of those supported callable APIs merely because their census row is withdrawn.

## Encoded-side impact

The new state exists only in private React props. Keep the button's
`data-panel-menu-item`, label, click behavior, ARIA current value, dot styles
and DOM structure identical. Preserve focused-group semantics and stale-focus
behavior. Dock model/snapshot encodings, local storage, panel ids, workspaces,
floating groups, sidecar access and command payloads are unchanged.

No persisted/wire migration or compatibility alias is needed. The source
predicate APIs remain callable in both data-first and data-last forms; this
corrected design no longer proposes their removal.

## Test impact

No tests or product commands run for this draft. At implementation, extend
`test/dock-shell.test.tsx` with three observable menu-entry cases: closed
outlined dot, open-not-current filled dot without page ARIA, and current
filled dot with `aria-current="page"`. Cover an active tab in another group,
the no-focus fallback, a stale focus id, and clicking a closed entry to open
and navigate. Preserve existing tests of validated default workspaces,
snapshots and the two callable queries.

The existing shell is gesture-bearing, so eventual implementation uses the
repo's recorded portless browser-QA workflow for the actual menu interaction
and required app/package handoff checks. This source/design audit starts no
browser or service and runs no package verification.

## Risk

The prior design's material defect is its mandatory dependency on an
ineligible callable-pair refactor. This revision removes that dependency
without weakening the actual menu's current-implies-open invariant. Keep
currentness narrower than arbitrary group activity, especially with multiple
open groups or stale focus.

The parent must archive the withdrawn callable row/current design together,
retain the actual menu row, and independently review this replacement before
promoting it. No new row or cardinality is proposed for the menu. Source hashes
and complete evidence are in the apps audit; this draft does not claim that
the implementation or browser parity has already been verified.
