# Dockview React adapter grounding

## 1. dockview-react public surface — component/props contract

The upstream adapter exposes `DockviewReact`, a `forwardRef<HTMLDivElement>` component, and
`IDockviewReactProps extends DockviewOptions`. Its minimum framework-facing contract is:

- `components: Record<string, React.FunctionComponent<IDockviewPanelProps>>` is required and is
  resolved by the core component name; `tabComponents` is the analogous optional header renderer
  record. `watermarkComponent` and `defaultTabComponent` are optional, while `onReady` is required
  and receives `{ api: DockviewApi }`. The complete current prop surface also includes header
  action components, tab/group context-menu factories, tab-group chip and drag-ghost components,
  plus `onDidDrop`/`onWillDrop` callbacks
  (`/home/elpresidank/YeeBois/dev/dockview/packages/dockview-react/src/dockview/dockview.tsx:57-96`).
- During initialization it translates those React records into `DockviewFrameworkOptions` factory
  functions, calls `createDockview`, performs the initial `api.layout(clientWidth, clientHeight)`,
  then hands the API to `onReady({ api })`
  (`.../dockview-react/src/dockview/dockview.tsx:148-210`,
  `.../dockview-react/src/dockview/dockview.tsx:232-249`). Subsequent prop changes are forwarded to
  `api.updateOptions` (`.../dockview-react/src/dockview/dockview.tsx:119-141`,
  `.../dockview-react/src/dockview/dockview.tsx:326-426`).
- A content renderer receives exactly `{ params, api, containerApi }`; a tab renderer receives the
  same fields plus `tabLocation`
  (`.../dockview-react/src/dockview/reactContentPart.ts:41-55`,
  `.../dockview-react/src/dockview/reactHeaderPart.ts:33-48`). In core types,
  `IDockviewPanelProps<T>` is `PanelParameters<T> & { api: DockviewPanelApi; containerApi:
  DockviewApi }`, and `IDockviewPanelHeaderProps<T>` adds `tabLocation`
  (`.../dockview-core/src/dockview/framework.ts:11-25`). The requested adapter should mirror the
  content contract as `{ params, api, containerApi }`, but its API types must be adapter-owned;
  the headless kernel does not provide upstream `DockviewPanelApi`/`DockviewApi` objects.

The portal/render-root mechanism is one React tree with many core-owned DOM targets. Each core
renderer owns an `HTMLElement`; `ReactPart` creates a keyed `ReactDOM.createPortal(node, parent,
key)` and registers that portal with a root-level store. `DockviewReact` renders the portal array
inside its root `<div>` (`.../dockview-react/src/react.ts:63-71`,
`.../dockview-react/src/react.ts:75-95`, `.../dockview-react/src/react.ts:126-165`,
`.../dockview-react/src/dockview/dockview.tsx:428-432`). Updates are pushed through an imperative
bridge which merges component props and forces a render (`.../dockview-react/src/react.ts:23-60`,
`.../dockview-react/src/react.ts:97-107`). The future adapter should preserve the important
property—user components stay descendants of the adapter's React/provider tree—even though its
atom-backed updates need no imperative React bridge.

Strict mode is handled as disposable, repeatable lifecycle rather than single-mount behavior:
upstream initialization returns `api.dispose()` from its empty-dependency effect
(`.../dockview-react/src/dockview/dockview.tsx:143-250`), and core explicitly cancels delayed
popout restoration if the first StrictMode instance was disposed before its timer fires
(`.../dockview-core/src/dockview/popoutWindowService.ts:196-223`). For this adapter, graph ownership
must likewise be explicit and disposal idempotent. **OPEN QUESTION:** whether the public component
receives a prebuilt graph or constructs one asynchronously. Recommendation: require a prebuilt
graph in the first adapter; `makeDockAtoms()` returns an `Effect`, so constructing it during React
render would violate both React purity and the repo ban on `Effect.run*` in components.

## 2. Kernel-to-adapter mapping

One `makeDockAtoms()` call owns one factory, registry, runtime, operation lane, and lifetime
(`scratchpad/dockview/README.md:31-36`). The returned graph is assembled at
`scratchpad/dockview/poc/DockAtoms.ts:244-295` and maps to the adapter as follows:

| Kernel member | Adapter responsibility |
| --- | --- |
| `workspaceAtom` | Read-only topology source for the layout projection and empty-watermark decision. |
| `panelsAtom` | Stable inventory for allocating one keyed content render-root per panel ID. |
| `tabsAtom(groupId)` | Render the ordered zipper (`before`, `active`, `after`) for a group's tab strip. |
| `activePanelAtom(groupId)` | Select visibility and activation styling/content for one group. |
| `operationAtom` | The sole write surface: compile click, close, drop, and sash-end intent into `DockAtomOperation`; its read side is the latest `AsyncResult`. |
| `persistedSnapshotAtom` | Render persistence status/diagnostics only; successful save invalidates its reactivity key. |
| `awaitIdle` | Completion barrier for tests and imperative adapter API calls that need settled state. |
| `dispose` | Release the mounted operation/runtime/persistence atoms and registry exactly once when the owner closes. |

The projection definitions are source-verified at `scratchpad/dockview/poc/DockAtoms.ts:190-217`;
the operation write submits synchronously into the serialized Effect session at
`scratchpad/dockview/poc/DockAtoms.ts:255-284`. Results are latest-submission-wins, although every
operation still runs in FIFO order (`scratchpad/dockview/poc/DockAtoms.ts:126-169`). Thus visual
state should derive from `workspaceAtom`, not infer success from `operationAtom`.

The exact graph registry must sit above every adapter component and every portal:

```tsx
<RegistryContext.Provider value={graph.registry}>
  <DockviewRoot graph={graph} components={components} />
</RegistryContext.Provider>
```

Do **not** wrap this graph in `RegistryProvider`: that component constructs a new registry once
(`node_modules/@effect/atom-react/src/RegistryContext.ts:75-107`). Directly providing the existing
registry is the supported path described by `RegistryContext`
(`node_modules/@effect/atom-react/src/RegistryContext.ts:28-47`). Portals created below this
provider retain React context even when their target DOM nodes live elsewhere.

`RendererKey` is a branded non-empty host registry key
(`scratchpad/dockview/poc/Domain.ts:83-94`). A `ComponentPanelView` stores that key plus schema-owned
serializable `input`; a text view is the other exhaustive case
(`scratchpad/dockview/poc/Domain.ts:115-164`). Therefore `components` should be keyed by
`RendererKey`, and component panels receive `view.input` as `params`. Missing keys need an explicit
typed/rendered adapter failure; silently rendering nothing would make persisted state
non-diagnostic. Text panels can use an internal renderer and need not occupy the public record.

The kernel is intentionally missing three adapter prerequisites:

- **Geometry projection:** add a pure `(DockNode, containerBox, gap) -> group boxes` projection,
  exposed as an atom family over `workspaceAtom` plus a host container-size atom. The planned
  constraint considerations are recorded at `scratchpad/dockview/WHAT-IS-LEFT.md:93-102`.
- **Global focus:** selection is per group; focused group is host state and focus persistence must
  ride beside the kernel snapshot (`scratchpad/dockview/README.md:106-109`,
  `scratchpad/dockview/WHAT-IS-LEFT.md:142-149`). Use an adapter-owned `Atom.make(Option<GroupId>)`;
  do not distort the topology zipper.
- **Tab reorder/index commands:** same-group move is rejected, `TabPlacement` has no index, and
  append always activates. The plan is an insertion index plus permitted same-group moves (or a
  dedicated reorder command), together with open-inactive/index support
  (`scratchpad/dockview/WHAT-IS-LEFT.md:37-56`; rejection is implemented at
  `scratchpad/dockview/poc/Reducer.ts:288`). Until Tier 1 lands, tab dragging must visibly report an
  unsupported operation rather than pretending to reorder.

## 3. @effect/atom-react exact API

Verified against installed `@effect/atom-react@4.0.0-beta.97`; its index re-exports `Hooks`,
`RegistryContext`, `ReactHydration`, and `ScopedAtom`
(`node_modules/@effect/atom-react/src/index.ts:5-23`). The exact relevant exports are:

- `useAtomValue<A>(atom: Atom<A>): A` and
  `useAtomValue<A, B>(atom: Atom<A>, f: (value: A) => B): B`
  (`node_modules/@effect/atom-react/src/Hooks.ts:113-163`).
- `useAtom<R, W, Mode>(atom: Writable<R, W>, options?): readonly [R, setter]`; value mode accepts
  `W | ((current: R) => W)`, while `promise` and `promiseExit` are available for `AsyncResult`
  writables (`node_modules/@effect/atom-react/src/Hooks.ts:313-333`).
- `useAtomSet<R, W, Mode>(atom, options?)` is write-only but mounts the atom; it has the same setter
  modes (`node_modules/@effect/atom-react/src/Hooks.ts:249-269`).
- `useAtomMount<A>(atom): void` and `useAtomRefresh<A>(atom): () => void`
  (`node_modules/@effect/atom-react/src/Hooks.ts:225-228`,
  `node_modules/@effect/atom-react/src/Hooks.ts:290-296`).
- `useAtomSuspense<A, E, IncludeFailure>(atom, { suspendOnWaiting?, includeFailure? })` returns a
  `Success`, optionally a `Failure`; otherwise failure is thrown to an error boundary
  (`node_modules/@effect/atom-react/src/Hooks.ts:376-413`).
- `useAtomSubscribe<A>(atom, f, { immediate? }): void` installs and cleans up a registry
  subscription (`node_modules/@effect/atom-react/src/Hooks.ts:415-445`).
- `useAtomInitialValues(Iterable<[Atom, value]>): void` initializes each atom at most once per
  registry (`node_modules/@effect/atom-react/src/Hooks.ts:60-91`).
- `useAtomRef<A>(ReadonlyRef<A>): A`, `useAtomRefProp(ref, key): AtomRef<A[K]>`, and
  `useAtomRefPropValue(ref, key): A[K]`
  (`node_modules/@effect/atom-react/src/Hooks.ts:447-516`). These are exported, but the dock graph
  uses ordinary atoms, so they are not needed for v1.

All ordinary atom reads use `React.useSyncExternalStore` over `registry.subscribe/get`, including a
server snapshot from `Atom.getServerValue` (`node_modules/@effect/atom-react/src/Hooks.ts:21-58`).
Some sanctioned hooks internally use banned React hooks; application code may use the sanctioned
exports because the binding skill explicitly designates them as the bridge.

Registry exports are `scheduleTask(f): () => void`, `RegistryContext`, and
`RegistryProvider({ children?, initialValues?, scheduleTask?, timeoutResolution?,
defaultIdleTTL? })` (`node_modules/@effect/atom-react/src/RegistryContext.ts:16-25`,
`node_modules/@effect/atom-react/src/RegistryContext.ts:44-47`,
`node_modules/@effect/atom-react/src/RegistryContext.ts:75-107`). The provider has no `registry`
prop. The underlying `AtomRegistry` supports `get`, `mount`, `refresh`, `set`, `modify`, `update`,
`subscribe`, `reset`, and `dispose` (`node_modules/effect/src/unstable/reactivity/AtomRegistry.ts:64-83`).

`ScopedAtom.make<A, Input>(factory)` returns `{ Provider, Context, use }`; each provider creates
one atom, optional input changes do not recreate it, and `use()` must be under that provider
(`node_modules/@effect/atom-react/src/ScopedAtom.ts:66-72`,
`node_modules/@effect/atom-react/src/ScopedAtom.ts:74-150`). It is suitable for adapter-local atoms
only when their creation is synchronous; it is not a replacement for the prebuilt dock graph.

Hydration exports `HydrationBoundary({ state?, children? })`. It hydrates new serializable atom
values before descendants render and defers replacements for existing nodes until commit
(`node_modules/@effect/atom-react/src/ReactHydration.ts:15-25`,
`node_modules/@effect/atom-react/src/ReactHydration.ts:48-108`). Lower-level
`Hydration.dehydrate(registry, { encodeInitialAs? })` and `hydrate(registry, state)` operate only on
atoms marked serializable (`node_modules/effect/src/unstable/reactivity/Hydration.ts:46-101`,
`node_modules/effect/src/unstable/reactivity/Hydration.ts:111-154`). The current dock snapshot is a
service-backed string, not React SSR atom hydration, so v1 should not conflate these mechanisms.

## 4. Hook-free component design

Repo law bans `useState`, `useEffect`, `useCallback`, `useMemo`, mutable-state `useRef`, and direct
`useContext`; DOM-only `React.useRef` is the exception
(`.claude/skills/atom-reactivity-specialist/SKILL.md:20-39`). The sanctioned bridge is the installed
atom hook surface above.

- **Tab strips:** `GroupView({ groupId })` calls `useAtomValue(graph.tabsAtom(groupId))` and renders
  `TabsNode.panels` in zipper order, keyed by `panel.id`. Event handlers can be ordinary inline or
  module-level functions which write typed operations through `useAtomSet(graph.operationAtom)`.
  Active styling derives from the zipper/`activePanelAtom`, never local React state. Reorder UI is
  gated until the indexed command exists.
- **Panel keep-alive across group moves:** allocate exactly one React element per `panel.id` under a
  stable root-level keyed list, and portal that element into the current group content host. Choose
  **`createPortal` with a stable key and a stable target element per panel**, not a keyed element
  directly nested under each group: changing a normal element's parent changes its React ancestry
  and remounts it. Upstream also portals user components from one root tree
  (`.../dockview-react/src/react.ts:151-160`). For render mode `always`, upstream keeps one content
  element in an overlay and reparents the DOM element without recreating it
  (`.../dockview-core/src/overlay/overlayRenderContainer.ts:127-164`); the kernel does not yet model
  render mode (`scratchpad/dockview/WHAT-IS-LEFT.md:71-77`). **OPEN QUESTION:** React portal identity
  when the target container itself changes can still remount. Recommendation: keep the portal
  target stable per panel and move that target DOM node with `appendChild`, matching upstream's
  DOM-preserving strategy; do not retarget the portal on group moves. This is especially important
  for iframe/webview state (`scratchpad/dockview/WHAT-IS-LEFT.md:116-124`).
- **Pointer tab drag and sash drag:** attach native listeners from stable ref callbacks. A callback
  receives the new node, detaches listeners from the previously recorded DOM node, attaches to the
  new node, and returns/uses an idempotent cleanup. Store gesture coordinates in adapter-owned
  writable atoms, not refs; compile only drag-end into the current command lane because the kernel
  intentionally does not coalesce high-frequency resize commands
  (`scratchpad/dockview/README.md:211-215`). Pointer capture belongs in the callback-attached native
  listener. **OPEN QUESTION:** React 19 callback-ref cleanup is available, but the repo has no local
  precedent verified in this exploration; test detach/remount/StrictMode behavior explicitly.
- **Container observation:** a DOM-ref callback creates a `ResizeObserver`, observes the node, and
  writes validated `{ width, height }` into a writable container-size atom; its cleanup disconnects
  the observer. Ignore detached, hidden, zero-size, and duplicate observations as the adapter plan
  requires (`scratchpad/dockview/WHAT-IS-LEFT.md:108-115`). Geometry atoms then combine this atom
  with `workspaceAtom`; no `useEffect` or component-local size state is required.

Graph disposal should be owned outside the leaf component tree (the code that executed
`makeDockAtoms`) or by an explicit idempotent ref-lifecycle owner. A component must not call
`Effect.runPromise` to create the graph; Effect-first law restricts `Effect.run*` to runtime
boundaries (`.claude/skills/effect-first-development/SKILL.md:70-73`).

## 5. Test environment

The root catalog pins React 19.2.7, React DOM 19.2.7, Testing Library React 16.3.2, jsdom 29.1.1,
Vitest 4.1.10, and `@effect/vitest` 4.0.0-beta.97 (`package.json:124-145`,
`package.json:168-188`, `package.json:216-219`, `package.json:250-254`). Root dev dependencies expose
`@effect/vitest` and Vitest (`package.json:261-303`). `happy-dom` is installed transitively and
locked, but is not a root catalog dependency (`bun.lock:5831`); do not make a new test lane depend
on that accident.

The two application DOM test configs both merge `vitest.shared.ts`, select `environment: "jsdom"`,
include `test/**/*.test.{ts,tsx}`, and load a DOM setup file
(`apps/oip-web/vitest.config.ts:1-17`, `apps/professional-desktop/vitest.config.ts:1-27`). The OIP
setup includes a `ResizeObserver` stub (`apps/oip-web/test/setup.dom.ts:68-87`). Shared config already
provides aliases, setup, timeouts, and the same test include pattern (`vitest.shared.ts:97-165`).

The existing dock kernel is different: its README prescribes
`bun test scratchpad/dockview/poc/test ...` (`scratchpad/dockview/README.md:217-237`), and its tests
use `@effect/vitest` while executing under Bun. `WHAT-IS-LEFT` explicitly records the unresolved
conflict between this and the repo's Vitest law (`scratchpad/dockview/WHAT-IS-LEFT.md:162-175`).

**One recommended setup:** add a scratchpad-local Vitest config during implementation that merges
`../../vitest.shared.ts`, sets `environment: "jsdom"`, includes
`scratchpad/dockview-react/test/**/*.test.tsx`, and loads a small setup containing a controllable
`ResizeObserver` fake. Use `@testing-library/react` for StrictMode render/unmount, portal continuity,
pointer dispatch, and atom updates; keep pure kernel tests in their existing Bun lane until the
documented policy conflict is resolved. This uses the repo's proven application DOM lane and avoids
relying on transitive happy-dom.

Evidence that the dependency combination works: this exploration ran an in-memory Bun script
using jsdom, React `createRoot`/`act`, `RegistryContext.Provider`, a real `AtomRegistry`, and
`useAtomValue`; it rendered `grounded`, unmounted, and disposed successfully
(`react-atom-jsdom-smoke: grounded`). No file was created for the smoke.

## 6. Risks & decisions

1. **Graph ownership and StrictMode.** Recommend a required prebuilt graph prop and idempotent
   external disposal for v1. Evidence: graph creation is effectful (`DockAtoms.ts:244-295`), while
   upstream React initialization is repeatably disposable and StrictMode can mount/dispose/remount
   (`.../dockview-react/src/dockview/dockview.tsx:143-250`).
2. **Registry identity.** Recommend direct `RegistryContext.Provider value={graph.registry}` around
   the entire adapter/portal tree. `RegistryProvider` creates a second registry and cannot accept
   the kernel's (`node_modules/@effect/atom-react/src/RegistryContext.ts:75-107`).
3. **Geometry before interaction.** Implement the pure geometry projection and size atom before
   drag/drop or sashes; otherwise hit testing and resize semantics have no authoritative pixels
   (`scratchpad/dockview/WHAT-IS-LEFT.md:93-102`).
4. **Panel instance continuity.** Recommend one stable portal target DOM node per panel, reparented
   between group hosts, with one stable React key. This best matches upstream's persistent
   content-element approach (`.../dockview-core/src/overlay/overlayRenderContainer.ts:127-164`).
   Prove continuity with a stateful test component before accepting the design.
5. **Missing renderer behavior.** Recommend a visible typed adapter error panel containing the
   missing `RendererKey`; never a silent no-op. Renderer lookup is a host responsibility by schema
   design (`scratchpad/dockview/poc/Domain.ts:83-94`,
   `scratchpad/dockview/poc/Domain.ts:133-164`).
6. **Adapter API shape.** Mirror upstream's `onReady({ api })`, but define a minimal headless API
   around typed operation submission, atom access, `awaitIdle`, and focus—not a false
   `DockviewApi` compatibility layer. **OPEN QUESTION:** exact methods await the first consumer.
7. **Indexed tab operations.** Do not ship reorder affordances until insertion-index and same-group
   commands exist; current reducer rejection is deliberate (`scratchpad/dockview/poc/Reducer.ts:288`;
   plan at `scratchpad/dockview/WHAT-IS-LEFT.md:37-56`).
8. **Global focus persistence.** Keep focused group in an adapter atom and persist it beside a
   future versioned snapshot envelope. It is explicitly host/session state, not topology
   (`scratchpad/dockview/WHAT-IS-LEFT.md:142-149`).
9. **Lossless events.** Do not build autosave, announcements, or undo from the latest
   `operationAtom` result; rapid intermediate events can be missed. Wait for the planned bounded
   Queue/Stream or append-only event atom (`scratchpad/dockview/WHAT-IS-LEFT.md:64-70`).
10. **Panel props and updates.** Start with `{ params, api, containerApi }`, but treat parameter,
    title, renderer, tab component, render mode, and constraints as an explicit kernel gap. The
    planned `UpdatePanelCommand` must land before promising upstream-style dynamic updates
    (`scratchpad/dockview/WHAT-IS-LEFT.md:71-77`).
11. **Listener/resource cleanup.** Every ref callback, observer, pointer capture, portal target, and
    graph owner needs idempotent teardown tested under StrictMode. Upstream's own delayed work needs
    disposal guards (`.../dockview-core/src/dockview/popoutWindowService.ts:196-223`).
12. **Test runner choice.** Recommend jsdom Vitest for the React adapter and retain Bun for the
    current kernel pending the repo-policy decision. jsdom is a declared root dependency; happy-dom
    is only transitive (`package.json:188`, `bun.lock:5831`).
