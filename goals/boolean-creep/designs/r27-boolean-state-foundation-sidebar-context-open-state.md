# Instance

- ID: `r27-boolean-state-foundation-sidebar-context-open-state`
- Source: `8f266b878445ca8a7f751f9248da428a4dde39a1`
- Corpus: `origin/main@663904610cce2a38c06b0619a8c414646b69361c`
- Owner: `packages/foundation/ui-system/ui/src/components/sidebar.tsx:37`, `SidebarContextValue`
- Members: `open`, `state`; derived, internal, Tier 1C.
- P2 only; no implementation, independent review, or status advance.

# Current shape

`SidebarContextValue` at `sidebar.tsx:37–45` carries a required Boolean
`open` and required literal `state: "expanded" | "collapsed"`. The
provider resolves `open = openProp ?? sidebarState.open` at 134, derives
`state = open ? "expanded" : "collapsed"` at 189, and copies both into
the context at 191–199. Context readers already use `state`, not `open`:
Sidebar at 256, trigger/rail callbacks at 404/439, and menu tooltip at 788.

The underlying `SidebarState` at 49 stores independent `open` and
`openMobile` Booleans. `isMobile` is a separately observed media-query
atom at 133. Preserve these independent axes and their D1 records
`sidebar-open-surfaces` and `sidebar-context-open-flags`; this design
addresses only the duplicated desktop presentation state in the context.

# Cardinality gap

Boolean × two actual literal values represents four pairs. The only
producer supports `(true,expanded)` and `(false,collapsed)`, so 4/2.
No alternate context constructor or direct context injection was found.
Both variants exist through the supported public `open`/`defaultOpen`
Boolean props and storage hydration. `openMobile` and `isMobile` remain
independent and are not additional correlated members.

# Target schema

Define one private literal kit in `components/sidebar.tsx`, avoiding the
already occupied `SidebarState` name:

```ts
const $I = $UiId.create("components/sidebar")
const SidebarDisplayState = LiteralKit(["expanded", "collapsed"]).pipe(
  $I.annoteSchema("SidebarDisplayState", {
    description: "Resolved desktop sidebar presentation state.",
  })
)
type SidebarDisplayState = typeof SidebarDisplayState.Type
```

Change the context's `state` type to the kit-derived type and remove its
`open` member. Keep `setOpen`, `openMobile`, `setOpenMobile`, `isMobile`,
and `toggleSidebar` unchanged. The context is an operational interface
containing updater functions; do not invent a serialization class for
those capabilities. The pure finite state has the schema as its owner.

Continue deriving the literal once from the resolved local Boolean:
`open ? SidebarDisplayState.Enum.expanded : SidebarDisplayState.Enum.collapsed`.
Do not store a second desktop literal atom, replace the underlying
Boolean state, or reconstruct `open` as a cached context property/getter.
Use the kit's collapsed/expanded guards at existing presentation readers.
No new React hooks, context provider, or global state are introduced.

# Migration inventory

- `packages/foundation/ui-system/ui/src/components/sidebar.tsx:9–23`:
  import the existing package identity convention and LiteralKit; add the
  local display-state schema with annotations.
- `sidebar.tsx:37–45`: use `state: SidebarDisplayState`; remove `open`.
  Keep the existing Boolean updater signatures, including functional updates.
- `sidebar.tsx:47,90–93`: the context's inferred operational return shape
  changes; keep context access and the missing-provider error exact.
- `sidebar.tsx:49–74`: retain underlying desktop/mobile state, scoped
  initialization, hydration atom, and localStorage error handling.
- `sidebar.tsx:95–169`: preserve public default/controlled props,
  callback routing, functional updater behavior, storage writes, and the
  mobile-vs-desktop toggle. No new normalization is needed.
- `sidebar.tsx:171–187`: retain the mounted shortcut listener and its
  finalizer, exact key `b`, and Ctrl/Meta condition.
- `sidebar.tsx:189–199`: derive the kit value from `open` once, pass
  `state`, and delete the duplicate `open` property at 193.
- `sidebar.tsx:256,310–311,346–347,788,813`: consume the same state
  strings and schema guards for desktop attributes and tooltip visibility.
- `sidebar.tsx:270–299,404,439`: mobile sheet/backdrop and trigger/rail
  callbacks keep their existing behavior; no desktop-state remapping here.
- `sidebar.tsx:1034–1058` and `package.json:102,124`: retain all component
  and `useSidebar` exports. Its inferred decoded return loses `open`.

Exhaustive source/subpath searches found no `useSidebar` caller outside
this file, no external `SidebarContextValue` reference, and no direct
context construction. Existing
`packages/foundation/ui-system/ui/stories/components/sidebar.stories.tsx`
imports the public components at 1–25 and contains current provider
stories, including `IconCollapsible` at 276. They need no prop migration.
This finding does not claim absence of consumers outside the repository;
the published hook-return change must be described in the eventual PR.

When implementation lands, the parent should reconcile the current D1
context census to its surviving Boolean members `[openMobile, isMobile]`
and archive the old member projection. Do not update the canonical row
now or turn the underlying `SidebarState` D1 pair into a qualified case.

# Guard-deletion accounting

- Delete the duplicate context `open` member at 39 and producer property
  at 193. No reader should be allowed to choose between conflicting
  `open` and `state` values after this migration.
- Delete the hand-authored two-string context type at 38; the finite
  domain comes from the kit.
- Replace the repeated string comparisons at 311, 347, and 813 with
  schema guards; these presentation branches remain necessary.

There is no existing runtime impossible-pair guard to delete, and the
required upstream Boolean-to-literal conversion at 189 remains. The
nonempty accounting is removal of the redundant derived carrier field,
not a claimed reduction in independent mobile or controlled-state logic.

# Encoded-side impact

The qualified context pair is internal and derived; no context codec is
needed. **Preserve the adjacent public and persisted contract exactly:**

- `defaultOpen` remains optional with default true; `open` remains an
  optional controlled Boolean; `onOpenChange` receives a Boolean.
- `setOpen` routes according to callback presence, not controlled-prop
  presence. With a callback but no controlled prop, it calls the callback
  and writes storage without directly mutating the internal desktop bit.
  With a controlled prop but no callback, the current internal update
  behavior remains; do not repair these edge cases here.
- Keep localStorage key `sidebar_state` at 25 and `String(openState)`
  values at 152/160. On hydration, only exact string `"true"` becomes
  true at 68; every other present string becomes false, while a missing
  value preserves current state. Retain swallowed storage exceptions.
- Desktop DOM `data-state` remains `expanded`/`collapsed`; mobile remains
  `open`/`closed` at 283. Preserve data attributes, CSS classes, widths,
  shortcut behavior, backdrop behavior, tooltips, and transition timing.

# Test impact

Add focused provider/consumer coverage through public components and
`useSidebar`, using an isolated Atom registry and localStorage/media-query
doubles. Verify both derived states and absence of the context `open`
field. Cover defaultOpen true/false; controlled true/false; callback
present/absent; functional setters; all storage strings including missing,
`"true"`, `"false"`, and another present string; unavailable storage;
and separate desktop/mobile changes across the 768 px breakpoint.
Assert the existing callback-only and controlled-without-callback edge
behavior rather than silently making them conventional controlled inputs.

The existing IconCollapsible story at 281 uses only an `onOpenChange`
spy, without a controlled `open` update. Its current play test at
309–320 checks trigger visibility, not a collapsed panel. It does not
prove the new migration's collapse/expand behavior. Add or adapt explicit
controlled and uncontrolled Atom-backed fixtures and assert DOM state.

Recorded QA through portless Storybook must cover trigger and rail
clicks, Ctrl/Meta+B, expanded/collapsed desktop layouts, collapsed tooltip
visibility, mobile opening/backdrop closing, resize while both desktop and
mobile Booleans are true, reload hydration, and controlled callback
behavior. Record slow real input through the public UI, retain frame strips
of transitions, and assert storage/DOM/callback/console invariants.
Require capture-green and judge `requiredCount: 0`, focused tests, existing
sidebar stories, and `bun run beep quality package-verify @beep/ui`
before implementation handoff. No browser or package checks ran for P2.

# Risk

Tier 1C, small derived-context migration. The main risks are changing
controlled/uncontrolled routing, conflating desktop state with mobile
visibility, altering storage truth-string behavior, or keeping a hidden
`open` compatibility alias that preserves the original contradiction.
The new schema and context edits fit the existing module; no new role
file, service, dependency, or manifest is needed.
