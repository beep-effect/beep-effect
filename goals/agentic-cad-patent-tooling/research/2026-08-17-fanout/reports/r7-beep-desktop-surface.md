# r7 — beep desktop surface: CAD viewer / figure-rendering insertion point

**Question:** Where exactly would a CAD viewer / figure-rendering surface plug in, and what contract must it satisfy?

**Target:** throwaway worktree snapshot of beep-effect2 at HEAD
`<repo-worktree-snapshot>`

**Method:** read-only source inspection. No build, install, or run. No modifications outside this report. Citations are `path:LINE` against this checkout.

**Status:** COMPLETE

**Short answer:** A CAD / figure surface is a new keep-alive dock panel registered in `apps/professional-desktop/src/workspace/dock.atoms.ts` and rendered from `apps/professional-desktop/src/App.tsx` through `@beep/dock` + `@beep/dock-react`. The closest living analog is the ontology Graph region (`OntologyGraphRegion`) plus the `@beep/graph-3d` three.js driver and the ontology visualizer worker. There is **no** existing CAD/STEP/mesh/OCCT path, **no** binary read-back RPC, and **no** content-addressed blob store. Files today travel one way: browser `File` → Base64 RPC → SHA-256 digest → atomic write under a local vault root, capped at 25 MiB.

---

## 1. APP TOPOLOGY

### What it is

`@beep/professional-desktop` is a **Tauri 2 + Vite + React 19** desktop shell, not Electron, not a Next.js app. The package description says so outright:

```2:3:apps/professional-desktop/package.json
  "description": "Minimal Tauri and React shell for the Agentic Professional Runtime desktop app.",
```

Proof it is Tauri, not Electron:

| Evidence | Location |
| --- | --- |
| Tauri crate + config | `apps/professional-desktop/src-tauri/tauri.conf.json:1` (`$schema` tauri.app/config/2), identifier `cloud.beep.professional-desktop` |
| Rust backend | `apps/professional-desktop/src-tauri/src/lib.rs` (`#[tauri::command]`, sidecar spawn) |
| JS bindings | `@tauri-apps/api` / `@tauri-apps/cli` in `apps/professional-desktop/package.json:92,103` |
| Runtime probe | `apps/professional-desktop/src/main.tsx:31` and `src/App.tsx:113` check `"__TAURI_INTERNALS__" in globalThis` |
| No Electron | no `electron` dependency, no `BrowserWindow` |
| No client router | no `react-router` under `apps/professional-desktop` — "routing" is the dock workspace |

It is **also** a plain browser app against a Bun sidecar. Vite `dev` is portless-wrapped (`professional-desktop.beep.localhost:1355`); Tauri's `devUrl` is that same named host (`src-tauri/tauri.conf.json:9`). In a browser without Tauri internals, transport falls back to HTTP (`src/App.tsx:147-150`). Write-capable surfaces (vault, ontology, triage) require either IPC or a per-launch `BEEP_DESKTOP_RPC_SESSION_TOKEN` (`src/App.tsx:156-172`).

### Process split

Three processes, not one:

1. **Renderer / webview** — Vite React tree. Entry `index.html:10` → `src/main.tsx:8` → `createRoot` → `ProfessionalAtomProvider` → `WorkbenchThemeProvider` → `App` (`src/main.tsx:62-70`).
2. **Tauri Rust shell** — window, sidecar lifecycle, `sidecar_transport` / `renderer_observability_config` commands (`src-tauri/src/lib.rs:61-70`, `src/main.tsx:33`).
3. **Bun sidecar** — Effect RPC server on loopback `:3939` (HTTP ndjson) or stdin/stdout (IPC). Entry `apps/professional-desktop/server/main.ts:1-64`. Serves `DesktopRpcs` (full group) or `ChatRpcs` (chat-only HTTP without session token).

There is **no URL router**. `App` (`src/App.tsx:962-989`) is a single workbench. Dev-only query flags (`?cosmos-spike`, `?graph3d-spike`, `?ipc`) short-circuit the dock and mount spikes instead (`src/App.tsx:263-274,967-981`). Those flags are the existing "prove WebGL in the Tauri webview before docking" path.

### How React gets an Effect runtime

The renderer does **not** run `RuntimeLive`. That Layer is sidecar-only (`src/runtime/Layer.ts:294-313`, provided in `server/main.ts:63`).

The webview's Effect surface is **Atom**:

1. `ProfessionalAtomProvider` wraps the tree in `@effect/atom-react` `RegistryProvider` and mounts `professionalBrowserRuntime` (`src/runtime/ProfessionalAtomProvider.tsx:17-44`).
2. `professionalBrowserRuntime` is `Atom.context({ memoMap })` plus `ClientObservabilityLive` (`src/runtime/ProfessionalAtomRuntime.ts:15-34`). Storage atoms use a second factory over `KeyValueStore.layerStorage(() => localStorage)` (`src/runtime/ProfessionalAtomRuntime.ts:52-68`).
3. `professionalAtomRegistryAtom` exposes the live `AtomRegistry` so dock portals can re-enter the **app** registry (`src/runtime/ProfessionalAtomRuntime.ts:90`).
4. Sidecar transport is itself an atom (`sidecarTransportAtom`, `src/App.tsx:154`). On success, `protocolLayerBindingAtom` writes `chatProtocolLayerAtom` / `ontologyProtocolLayerAtom` / `epistemicProtocolLayerAtom` to IPC or HTTP (`src/App.tsx:244-261`).
5. The dock kernel owns a **private** registry. `DockviewReact` provides that registry to chrome (`packages/foundation/ui-system/dock-react/src/DockviewReact.tsx:247-249`). Every product surface is wrapped back in the app registry (`src/App.tsx:555-559`) so chat/ontology/sync atoms are not cloned into the dock graph.

Sidecar Layer composition (for any CAD RPC that later exists) is `src/runtime/Layer.ts`: `DesktopHandlersLive` = chat + vault + intake + vault-picker + vault-sync + ontology + epistemic (`src/runtime/Layer.ts:96-113`), provided with TurnKernel, ThreadStore, WorkspaceVaultStore, SourceTextResolver, DocumentsFiling, DocumentsSync, OntologyServer, PGlite, BunServices, Observability (`src/runtime/Layer.ts:294-313`).

Workspace identity is a constant: `DEFAULT_PROFESSIONAL_WORKSPACE_ID = WorkspaceId.make(1)` (`src/workspace/ProfessionalWorkspace.ts:29`). No workspace picker.

CSP that a CAD/WASM panel must live inside (`src-tauri/tauri.conf.json:25-26`):

- `default-src 'self'`
- `worker-src 'self'` (same-origin workers only — no `data:` workers)
- `img-src 'self' blob:` (revocable in-memory thumbnails only)
- `connect-src` includes `ipc:`, `http://ipc.localhost`, sidecar `:3939`, OTLP `:4318`
- no `unsafe-eval`; no remote WASM hosts

---

## 2. THE DOCK / PANEL SUBSTRATE

This is the insertion contract.

### Kernel vs adapter vs app registry

| Layer | Package | Role |
| --- | --- | --- |
| Headless kernel | `@beep/dock` (`packages/foundation/ui-system/dock`) | Schema-first workspace tree, commands, reducer, geometry, persistence. Framework- and DOM-free (`packages/foundation/ui-system/dock/README.md:8-11`). |
| React adapter | `@beep/dock-react` | `DockviewReact`, portal keep-alive, pointer gestures. One-way dependency on the kernel (`packages/foundation/ui-system/dock-react/README.md:8-14`). |
| App registration | `apps/professional-desktop/src/workspace/dock.atoms.ts` + `src/App.tsx` | Panel catalog, default layout, snapshot key, renderer map, nav rail. |

A panel is a persistable schema class (`packages/foundation/ui-system/dock/src/Dock.models-tree.ts:286-298`):

- `id: PanelId`
- `title: NonEmptyString`
- `view: PanelView` — either `ComponentPanelView { renderer: RendererKey, input: PanelParameters }` (`Dock.models-tree.ts:157-166`) or `TextPanelView`
- `renderMode: "onlyWhenVisible" | "always"` (`Dock.models-tree.ts:46`)
- optional `constraints: PanelConstraints` (min/max px)
- optional `tabComponent: RendererKey`

`RendererKey` is a branded non-empty string resolved **outside** the kernel (`packages/foundation/ui-system/dock/src/Dock.ids.ts:197-206`). The adapter looks it up in the `components` record and portals the React function (`packages/foundation/ui-system/dock-react/src/internal/PanelHost.tsx:29-35`). Missing key → `<div role="alert">Missing renderer: {renderer}</div>`.

Renderer contract (`packages/foundation/ui-system/dock-react/src/DockReact.types.ts:76-114`):

```ts
type DockPanelProps = {
  readonly params: PanelParameters;
  readonly api: DockPanelApi;           // { id: PanelId }
  readonly containerApi: DockviewAdapterApi; // submit, awaitIdle, atoms
};
type DockRenderer = React.FunctionComponent<DockPanelProps>;
```

Desktop today ignores `params`/`api`/`containerApi` — every renderer is a thunk `() => wrap(...)` (`src/App.tsx:581-595`). A CAD panel **may** start the same way. If it later needs per-instance input (which STEP file), put it in `ComponentPanelView.input` (`Dock.models-tree.ts:161`) and read `props.params`.

Keep-alive: every desktop panel is `renderMode: "always"` so inactive tabs stay mounted (`src/workspace/dock.atoms.ts:237-247`). `ContentHost` appends the portal target whenever the panel is active **or** `renderMode === "always"` (`PanelHost.tsx:79`). A WebGL/WASM CAD viewer **must** stay `always` or it will unmount/remount on tab switch and lose GPU context.

Minima: all desktop panels share `CONTENT_MIN = { minWidth: 220, minHeight: 220 }` (`dock.atoms.ts:235`). A CAD viewport should raise this (ontology graph already suffered a "no size → WebGL cannot mount" failure; see `src/styles/globals.css:17-19`).

### How the thirteen panels are registered today

Single catalog: `DESKTOP_PANELS` (`src/workspace/dock.atoms.ts:75-161`). Thirteen entries. Each has `key`, `label`, `title`, `description`, `cluster`.

Clusters drive reopen placement, not just nav:

- `"shell"` — Home, Chat, Vault sync, Beliefs (`contradiction-triage`)
- `"ontology-left"` — Explorer, Document
- `"ontology-center"` — Graph, Source
- `"ontology-right"` — Inspector, SPARQL, Validation, Change Log, Worker Metrics

`desktopPanel(key)` builds `Panel.id = surface-${key}` and `view.renderer = RendererKey.make(key)` (`dock.atoms.ts:230-247`).

Default layout `defaultDesktopWorkspace` (`dock.atoms.ts:272-315`): vertical split (62/38) of an ontology three-column cluster over a shell tab row. SPARQL / Validation / Worker Metrics / Beliefs start **closed**.

Nav:

- `SHELL_NAV_PANELS = DESKTOP_PANELS` filtered to `cluster === "shell"` (`src/App.tsx:767`)
- `ONTOLOGY_PANELS = DESKTOP_PANELS` filtered to `cluster !== "shell"` (`dock.atoms.ts:194`)
- **Trap:** a new cluster such as `"cad"` would currently appear under the Ontology disclosure, not as its own rail entry. CAD must either be `cluster: "shell"` or the `ONTOLOGY_PANELS` filter must be rewritten.

Renderer map: `makePanelRenderers` in `src/App.tsx:555-596`. Keys **must** equal `DesktopPanelKey`. Wrappers:

- `wrap` — app `RegistryContext` + `SurfaceBoundary` (crash recovery, 2 retries)
- `wrapDesktop` — plus `DesktopSessionGate` (needs IPC or session token)
- `wrapDesktopLazy` — plus `Suspense` around a `lazy()` import

Persistence: localStorage key `desktop:dock-workspace:v2` (`dock.atoms.ts:335`). Restore allowlists `RendererKey`s from `DESKTOP_PANELS` (`dock.atoms.ts:420`). Adding a renderer key is safe; **removing or renaming** one requires bumping the snapshot key (the v1→v2 comment at `dock.atoms.ts:318-321`).

### Numbered recipe: add a NEW panel type

Follow the Beliefs / contradiction-triage increment (13th panel) plus the Graph region's canvas pattern. Do **not** invent a second dock.

**0. Decide the package home (architecture, before files).**

- Product language (figure, STEP artifact, view orientation) → a **slice** (`packages/<slice>/{domain,use-cases,client,ui,server}`), created with `bun run beep create-package` (`AGENTS.md:64`). Do not `mkdir`.
- OCCT.wasm / three-mesh / STEP parse → `packages/drivers/<name>` with a `@beep/<name>/browser` export (`standards/ARCHITECTURE.md:53,1230-1248`).
- Buttons, tokens, theme → `@beep/ui` only. Do not put CAD domain in `foundation/ui-system`.
- App wiring stays app-local via `@/*` (`standards/ARCHITECTURE.md:61-63`).

**1. Catalog the panel — `apps/professional-desktop/src/workspace/dock.atoms.ts`**

- Append one object to `DESKTOP_PANELS` (`dock.atoms.ts:75`). Suggested:

  ```ts
  {
    cluster: "shell", // NOT a new cluster unless you also rewrite ONTOLOGY_PANELS
    description: "Inspect a 3D part and produce figure views.",
    key: "cad-viewer",
    label: "Figures",
    title: "CAD / Figures",
  }
  ```

- `DesktopPanelKey` is derived from the array (`dock.atoms.ts:178`) — no second union to edit.
- Optionally place it in `defaultDesktopWorkspace` (`dock.atoms.ts:272`) if it should open on first launch. Prefer **start closed** (SPARQL pattern, `dock.atoms.ts:258-259`) so boot does not load WASM.
- Optionally give it tighter `PanelConstraints` than `CONTENT_MIN` (raise minWidth/minHeight for a viewport).
- Keep `renderMode: "always"` (`dock.atoms.ts:245`).
- Do **not** bump `DOCK_SNAPSHOT_KEY` for an additive key. Do bump it if you rename/retire a renderer.

**2. Register the React renderer — `apps/professional-desktop/src/App.tsx`**

- `lazy()` the region (Graph3D / Beliefs pattern, `src/App.tsx:96-109`).
- Add one entry to `makePanelRenderers` (`src/App.tsx:581-595`). If it talks to the sidecar, use `wrapDesktop` / `wrapDesktopLazy`. If it is local-only WASM over an already-intaken file handle, `wrap` is enough — but today there is no local file handle API, so plan on `wrapDesktop`.
- Optionally add a Home tile in `HOME_TILES` (`src/App.tsx:303-319`).
- Do **not** add a second `DockviewReact`.

**3. Implement the region (slice `ui`, not the app).**

Copy the Graph region's shape (`packages/ontology/ui/src/aggregates/Session/Session.graph.tsx:41-116`):

- Header chrome with `@beep/ui` `Badge` / `Switch` / `Button`
- A sized `div` (`min-h-0 flex-1 h-full w-full`) whose ref is written to an atom
- `useAtomMount` of a container-binding atom that waits for non-zero clientWidth/clientHeight before publishing (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1347-1372`)
- A render-bridge atom that mounts/destroys the driver (`Session.atoms.ts:2498-2536`)
- No `useState` / `useEffect` for product state (desktop source has zero of either except comments saying they were removed; `src/App.tsx:153,604`)

**4. Client atoms (slice `client`).**

Canonical pattern is `AtomRpc.Service` + `query(..., { reactivityKeys })` + `professionalBrowserRuntime.fn` / slice `*BrowserRuntime`. See §4.

**5. Sidecar contract (only if the panel needs server bytes or OCCT-off-main-thread on Bun).**

- Schema the RPC payload/success/error in `packages/<slice>/use-cases`
- Merge into `apps/professional-desktop/server/DesktopRpcs.ts:32-39`
- Implement handlers and `Layer.provide` them in `src/runtime/Layer.ts:96-113,294-313`
- `server/main.ts` already serves `DesktopRpcs` — no extra HTTP route

**6. Stylesheet scan — `apps/professional-desktop/src/styles/globals.css`**

If the region lives in a new package, add `@source "../../../../packages/<slice>/ui/src";` (`src/styles/globals.css:10-24`). Missing this is how the ontology graph canvas got zero size.

**7. Vite / CSP / deps**

- Add the workspace package to `apps/professional-desktop/package.json`
- If the driver imports three / a WASM module, extend `vite.config.ts` `optimizeDeps.include` / `exclude` the way `three` and `oxigraph` already are (`vite.config.ts:96-103`)
- Workers **must** be `new Worker(new URL("./X.worker.ts", import.meta.url), { type: "module" })` — Vite-recognized shape; anything else becomes a `data:` URL and packaged CSP rejects it (`Session.atoms.ts:1777-1781`, `README.md:48-50`)
- `worker-src 'self'` already allows same-origin workers (`tauri.conf.json:25`)
- Do not add `unsafe-eval`. If OCCT needs it, that is a CSP design change, not a one-line patch

**8. Tests that will fail if you forget them**

- `apps/professional-desktop/test/dock-shell.test.tsx:56` asserts `DESKTOP_PANELS` length **13** and the Beliefs row. Update the length and add a row assertion.
- Same file locks the default-layout actives (`dock-shell.test.tsx:35-49`).
- Add a surface-boundary test if the region can throw.
- Gesture-bearing viewport work later requires `browser-qa-loop` (`AGENTS.md:69,81-83`).

**9. Optional spike-first gate (recommended).**

Before docking, prove WASM/WebGL in the Tauri webview the way Graph3D already did:

- `src/spikes/CadSpike.tsx` + `?cad-spike` / `VITE_CAD_SPIKE=1` next to `hasGraph3dSpikeFlag` (`src/App.tsx:271-274,975-980`)
- Keep it out of `DESKTOP_PANELS` until the driver handle can mount, resize, and destroy cleanly

**Files a developer must touch for a docked MVP (minimum set):**

1. `apps/professional-desktop/src/workspace/dock.atoms.ts` — catalog (+ optional default layout / constraints)
2. `apps/professional-desktop/src/App.tsx` — lazy import + `makePanelRenderers` entry (+ optional Home tile)
3. `apps/professional-desktop/test/dock-shell.test.tsx` — panel count / catalog assertion
4. New slice `ui` region file (created via `create-package`, not invented under `src/`)
5. New slice `client` atoms file
6. `apps/professional-desktop/package.json` — workspace dep
7. `apps/professional-desktop/src/styles/globals.css` — `@source` the new `ui` package

**Additional files once bytes or OCCT enter the sidecar:**

8. `packages/<slice>/domain` schemas
9. `packages/<slice>/use-cases` RPC group
10. `apps/professional-desktop/server/DesktopRpcs.ts`
11. `apps/professional-desktop/src/runtime/Layer.ts`
12. `packages/drivers/<occt-or-mesh>` (`create-package`, `family: drivers`, `/browser` export)
13. `apps/professional-desktop/vite.config.ts` — WASM/three optimizeDeps
14. Possibly `src-tauri/tauri.conf.json` CSP if OCCT needs more than `worker-src 'self'`

**Do not touch** `@beep/dock` or `@beep/dock-react` to add a panel. The kernel is already generic.

---

## 3. EXISTING VIEWERS

There is **no PDF page viewer, no image canvas viewer, and no CAD/mesh viewer** in the product desktop. What exists:

### Chat / editor (2D, text-ish)

| Surface | What it renders | Where |
| --- | --- | --- |
| Persisted transcript | `@beep/md` projected through `@beep/editor` `EditorViewer` | `apps/professional-desktop/test/viewer-encoding.test.tsx:1` — "viewer" here means Lexical, not documents |
| Streaming assistant | paragraphs, lists, tables, YouTube, mermaid, code | `src/chat/ui/StreamingBlocks.tsx:300-311` |
| Mermaid | SVG via `mermaid` + DOMPurify, 20k char cap, `securityLevel: "strict"` | `packages/foundation/ui-system/editor/src/mermaid-view.tsx:65-80,780` |
| YouTube | `youtube-nocookie.com` iframe only | `README.md:33-35`, CSP `frame-src` |
| Source-text highlight | UTF-16 anchored excerpt, no pagination of PDFs | `@beep/ui/components/verified-source-text-viewer.tsx:56-58` |
| Attachment chrome | visual shell only, not a file renderer | `@beep/ui/components/attachment.tsx:1-5` |
| Ontology "Document" | Turtle path open/save/preview toolbar, **not** a PDF | `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:102` |

PDFs are **filing inputs**, not viewed pages. Intake extracts a text excerpt via `@beep/file-processing` + `@beep/doc-text` (`unpdf` text layer + mammoth DOCX) for the LLM filing decision (`src/runtime/Layer.ts:196-217`, `packages/documents/server/src/aggregates/Document/FilingTextExtraction.ts:42-50`). `FileFormatFamily` knows `pdf-text-layer`, office, images-as-metadata, not pages (`packages/foundation/capability/file-processing/src/Strategy/Strategy.schema.ts:104-118`).

### 3D / WebGL (the real precedent)

| Surface | Backend | Where |
| --- | --- | --- |
| Ontology Graph region (docked) | cosmos.gl if WebGL2, else sigma.js; optional instanced three.js via a 3D toggle | `packages/ontology/ui/src/aggregates/Session/Session.graph.tsx:41-116` |
| `@beep/graph-3d` driver | lazy `three` + `WebGLRenderer`, WebGL2 required, no fallback | `packages/drivers/graph-3d/src/Graph3D.renderer.ts:914-976` |
| Graph3D spike | same driver, synthetic data, `?graph3d-spike` | `apps/professional-desktop/src/spikes/Graph3DSpike.tsx:1-20` |
| Cosmos spike | cosmos.gl + worker, `?cosmos-spike` | `src/spikes/CosmosSpike.tsx` |
| Cosmos capability probe | `getContext("webgl2")` | `packages/drivers/cosmos/src/Cosmos.backend.ts:178-218` |
| `@beep/ui` Orb | `@react-three/fiber` decorative sphere | `packages/foundation/ui-system/ui/src/components/orb.tsx:10-16` |
| scratchpad bench | raw three.js (not product) | `scratchpad/graph-3d-bench/main.ts:18,289` |

Vite already special-cases `three` so the first 3D toggle does not 404 a stale chunk (`apps/professional-desktop/vite.config.ts:99-103,106-110`). Chunk warning limit is 750 kB specifically because `three.module` is ~724 kB and dynamic-only.

### Binary / blob handling in-product

- Intake encodes bytes as `S.Uint8ArrayFromBase64` over RPC (`packages/documents/use-cases/src/aggregates/Document/DocumentIntake.ts:47-48`).
- Server hashes SHA-256 and writes the original bytes under the vault (`packages/documents/server/src/aggregates/Document/DocumentIntake.service.ts:45-46,143`).
- CSP allows `blob:` **only** for images (`tauri.conf.json:25`, `README.md:50-51`).
- `ImageBlobStore` exists under `scratchpad/effect-ontology/` — **not** a product package. Do not treat it as available.

Repo-wide search for STEP / OCCT / glTF / mesh CAD APIs in product `packages/` and `apps/` returned **nothing**. That gap is real.

---

## 4. ATOM / STATE LAYER

Canonical stack: `@effect/atom-react` hooks + `effect/unstable/reactivity` `Atom` / `AtomRpc` / `AsyncResult` + an app or slice `Atom.context` runtime.

### Hooks a panel is allowed to use

From live desktop/ontology UI:

- `useAtomValue`, `useAtomSet`, `useAtomMount` (`@effect/atom-react`)
- `AsyncResult.match` / `AsyncResult.isWaiting` / `AsyncResult.getOrThrow` for loading/error
- `ref={setX}` where `setX` is `useAtomSet` of a `fn<HTMLElement | null>()` atom — **not** `useRef` + `useEffect`

Desktop `src/` has **no** `useState` / `useEffect` call sites; comments explicitly replaced them (`src/App.tsx:153,242,604`).

### Canonical RPC client (copy this)

`ChatClient` (`packages/agents/client/src/Chat.atoms.ts:122-125`):

```ts
export class ChatClient extends AtomRpc.Service<ChatClient>()("ChatClient", {
  group: ChatRpcs,
  protocol: (get) => get(chatProtocolLayerAtom),
}) {}
```

Queries carry `reactivityKeys` so mutations invalidate (`Chat.atoms.ts:164-171`):

```ts
export const threadsAtoms = Atom.family((workspaceId) =>
  ChatClient.query("ListThreads", { workspaceId }, {
    reactivityKeys: [THREADS_KEY, workspaceThreadsKey(workspaceId)],
  })
);
```

Desktop intake copies the same shape but pins the desktop runtime (`src/intake/Intake.atoms.ts:51-55,454-456`):

```ts
export class DesktopIntakeClient extends AtomRpc.Service<DesktopIntakeClient>()("DesktopIntakeClient", {
  group: DesktopIntakeRpcs,
  protocol: (get) => get(chatProtocolLayerAtom),
  runtime: professionalBrowserRuntime.factory,
}) {}

export const workspaceVaultConfigAtom = Atom.family((workspaceId) =>
  DesktopIntakeClient.query("GetWorkspaceVault", { workspaceId }, {
    reactivityKeys: [workspaceVaultKey(workspaceId)],
  })
);
```

Mutations go through `Reactivity.mutation(client("IntakeDroppedFile", payload), [workspaceVaultKey(workspaceId)])` (`Intake.atoms.ts:859-872`).

Writes that are not RPC use `professionalBrowserRuntime.fn<Input>()(Effect.fn(...)(function* (input, ctx) { ctx.set(...) }))` — see `navigateDesktopPanelAtom` (`src/App.tsx:323-333`) and `toggleWorkbenchThemeAtom` (`src/theme/Theme.atoms.ts:113-119`).

Persisted client prefs use `Atom.kvs({ runtime: professionalStorageRuntime, key, schema, defaultValue })` (`src/theme/Theme.atoms.ts:34-39`).

### Canonical canvas panel (copy this)

`OntologyGraphRegion` (`packages/ontology/ui/src/aggregates/Session/Session.graph.tsx:41-52`):

1. `useAtomValue` for projection/error/backend/renderer
2. `useAtomSet(setOntologyGraphContainerElementAtom)` on the canvas host `div`
3. `useAtomMount(ontologyGraphContainerBindingAtom)` — ResizeObserver until the box is measurable (`Session.atoms.ts:1347-1372`)
4. `useAtomValue(ontologyGraphWorkerBridgeAtom)` and `useAtomValue(ontologyGraphRenderBridgeAtom)` to keep worker + GPU handle alive

`ontologyGraphRenderBridgeAtom` (`Session.atoms.ts:2498-2536`) mounts handle atoms, subscribes to render requests, and finalizes with destroy. That is the contract a CAD viewport must satisfy: **atom-owned mount/update/destroy**, not a React `useEffect`.

### Registry rule a CAD panel will hit

Dock chrome reads the **graph** registry. Panel content must re-provide the **app** registry (`src/App.tsx:397-401,555-559`). If a CAD region forgets `RegistryContext.Provider value={appRegistry}`, its atoms silently fork and never see protocol bindings.

### Reactivity keys

String keys, often namespaced (`workspace-vault:${id}`, `threads:${id}`). A CAD query should key on workspace + content digest (or artifact id), and every write that changes the artifact must `Reactivity.mutation(..., [thatKey])`.

---

## 5. STYLING / UI KIT

| Concern | Package | Convention |
| --- | --- | --- |
| Primitives | `@beep/ui` (`packages/foundation/ui-system/ui`) | shadcn **Base UI** (`base-nova`), Phosphor icons, Tailwind v4 (`packages/foundation/ui-system/ui/README.md:3-40`) |
| Import path | `@beep/ui/components/<name>` | `Button`, `Badge`, `Switch`, `Input`, `Tooltip`, `ScrollArea`, `Toaster`/`sonner` |
| `cn` | `@beep/ui/lib/utils` | |
| Theme tokens | `@beep/ui/themes` + app override | `WorkbenchThemeProvider` (`src/theme/WorkbenchThemeProvider.tsx:19-62,102-109`) — TrustGraph dark green / parchment light |
| Tailwind tokens | `src/styles/globals.css:26+` | `--background`, `--primary`, etc. as oklch |
| Dock chrome | `src/styles/dock.css` | colors from CSS variables only; adapter emits geometry inline (`dock.css:1-4`) |
| Editor | `@beep/editor` | Lexical; not the CAD host |
| MUI | via `AppThemeProvider` | color-scheme only; Atom owns the mode (`WorkbenchThemeProvider.tsx:68-84`) |

A new panel must:

- Fill the portal: `h-full min-h-0` flex column. The shell is `h-dvh overflow-hidden`; only inner panes scroll (`src/App.tsx:800-806`).
- Use theme tokens (`bg-background`, `text-muted-foreground`, `border`, `bg-card`), not hex.
- Put any package-only Tailwind classes under an `@source` in `globals.css` (see §2 step 6).
- Use `@beep/ui` primitives for chrome. Do not add a second component library.
- Follow JSDoc law on exported symbols (`AGENTS.md:68`, `.patterns/jsdoc-documentation.md`).
- Storybook stories live in the package `stories/`, not `src/` (`@beep/ui` README).

Gesture-bearing viewport work (orbit, pan, section) is a `browser-qa-loop` milestone, not a "looks fine in Storybook" milestone (`AGENTS.md:81-83`).

---

## 6. ASSET / FILE PIPELINE

### What exists today (write path only)

```
browser File
  → intakeRefusal (empty / > 25 MiB)          Intake.atoms.ts:73,129-136
  → file.arrayBuffer() → Uint8Array           Intake.atoms.ts:853-857
  → IntakeDroppedFile RPC (bytes as Base64)   DocumentIntake.ts:47-48
  → SHA-256 hex digest                        DocumentIntake.service.ts:45-46
  → filing decision (text excerpt / heuristic)
  → project vault-relative path (digest in filename)
  → writeFileWithinRootAtomically             PathSafety.service.ts:362-373
  → return Document { contentDigest, filing, originalFileName, vaultPath }
```

Limits and properties:

- **25 MiB renderer pre-read cap** (`MAX_INTAKE_FILE_BYTES`, `Intake.atoms.ts:73`). Many STEP assemblies exceed this. Named gap.
- **32 MiB** source-text resolver cap on the sidecar (`WorkspaceSourceTextResolver.ts:38`) — still too small for large CAD, and that path returns **text**, not mesh.
- Bytes ride **RPC as Base64** (`S.Uint8ArrayFromBase64`). A 25 MiB file is ~33 MiB on the wire. Fine for PDFs; bad for CAD.
- Vault is a **local directory** the user picks (Tauri dialog or manual path). `WorkspaceVaultRpcs` is only `GetWorkspaceVault` / `SetWorkspaceVault` (`packages/workspace/use-cases/src/aggregates/Workspace/WorkspaceVault.rpc.ts:28-69`). There is no `ReadVaultFile`, `StatVaultFile`, or `ListVault`.
- `DocumentsRpcs` is **only** `IntakeDroppedFile` (`packages/documents/use-cases/src/aggregates/Document/Document.rpc.ts:29-49`). Intake is write-only from the renderer's point of view.
- Digest is branded `DocumentContentDigest` (hex string, not even `sha256:` prefixed on the Document aggregate) (`packages/documents/domain/src/aggregates/Document/Document.model.ts:134-207`). Placement is `complaint--abc123.pdf` under a legal-taxonomy folder. That is content-addressed **naming**, not a CAS object store.
- Path escape is blocked by `resolvePathWithinCanonicalRoot` / `writeFileWithinRootAtomically` (`PathSafety.service.ts:31-49,362-373`).
- Box DMS mirror is optional and disconnected-by-default (`src/runtime/Layer.ts:247-276`). Not a blob store.

### What does **not** exist (name these gaps)

1. **No GetDocumentBytes / ReadVaultFile RPC.** A panel cannot fetch a STEP file it did not just drop. The renderer never keeps the `Uint8Array` after intake succeeds.
2. **No content-addressed blob store.** No `cas://` API, no dedup table of raw objects, no range-read. Vault files are ordinary filesystem paths.
3. **No CAD format family.** `FileFormatFamily` has no `step` / `stp` / `iges` / `stl` / `gltf` (`Strategy.schema.ts:104-118`). Unknown extensions classify as `"unknown"`.
4. **No streaming upload.** Whole file is materialized in the renderer, then Base64-encoded, then written.
5. **No product ImageBlobStore / mesh store.** Scratchpad-only.
6. **25 MiB hard refuse** before bytes are read — a CAD MVP that reuses intake as-is will reject typical parts.

### What a CAD panel can reuse

- Drop target + file input atoms (`intakeDomEventAtoms`, `intakeFilesAtoms`) if the first milestone is "drop a STEP onto the desktop"
- Vault root + path-safety writes if the sidecar persists the file
- `Document.contentDigest` as the cache key **if** you extend Documents rather than invent a second identity
- `WorkspaceSourceTextResolver` only if you need extracted text (not geometry)

Honest MVP for bytes: **new RPC** `GetVaultBytes { workspaceId, relativePath | contentDigest }` (or a streaming variant) on the documents or a new CAD slice, plus a higher size policy. Do not pretend intake-alone is a viewer pipeline.

---

## 7. WORKER / WASM PRECEDENT

OCCT.wasm is not a green field. The repo already loads WASM and module workers.

### WASM already in production paths

| Use | How it loads | Where |
| --- | --- | --- |
| PGlite (sidecar DB) | `import x.wasm with { type: "file" }` → `WebAssembly.compile` | `apps/professional-desktop/src/runtime/Pglite.ts:44-46,285-298` |
| Vite/TS module decl | `declare module "*.wasm"` | `apps/professional-desktop/src/assets.d.ts:6-8` |
| Oxigraph SPARQL | lazy import so the Layer can load in browser/worker **without** initializing WASM at module scope | `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:267-274` |
| Vite optimizer | `exclude: ["oxigraph"]` so the webview does not prebundle WASM | `vite.config.ts:96-98` |
| practice-kg-mcp | same PGlite wasm file-import pattern | `apps/practice-kg-mcp/src/bin.ts:16-18` |

### Workers already in production / spike paths

| Worker | Shape | Where |
| --- | --- | --- |
| Ontology visualizer | `new Worker(new URL("./Session.visualizer.worker.ts", import.meta.url), { type: "module" })` | `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1781` |
| Worker protocol | encoded `WorkerCommand` / `WorkerResult` over structured clone; decode on both sides | `Session.visualizer.worker.ts:20-25` |
| Cosmos spike | same Vite `new URL` worker constructor | `src/spikes/CosmosSpike.tsx:250` |
| Cosmos spike RPC | Effect `BrowserWorkerRunner` + `RpcServer` inside the worker | `src/spikes/CosmosSpike.worker.ts:12-17` |

**Hard rule:** keep the `new Worker(new URL("./file.ts", import.meta.url), { type: "module" })` literal. Capturing `Worker` and constructing indirectly emits a `data:` script; packaged CSP `worker-src 'self'` rejects it (`Session.atoms.ts:1777-1781`, `README.md:48-50`).

### Implication for OCCT.wasm

- **Feasible.** PGlite already compiles multi-megabyte WASM on the sidecar; Oxigraph already lazy-loads WASM in browser/worker; Vite already has `assetsInclude` for `*.wasm` in integration config (`vitest.integration.config.ts:8`).
- **Put OCCT in `packages/drivers/occt` (or similar)** with `@beep/occt/browser`. Do not import the package root from client/UI (`standards/ARCHITECTURE.md:1247-1248,1275-1277`).
- **Run tessellation in a module worker**, protocol-encoded like the ontology worker (or Effect RPC-in-worker like CosmosSpike). Main thread only mounts the mesh.
- **Sidecar alternative:** run OCCT in the Bun sidecar (WASM or native sidecar binary) and RPC tessellated buffers to the webview. Heavier, but avoids WebKit WASM limits. The sidecar already bundles `externalBin: ["binaries/sidecar"]` (`tauri.conf.json:43`).
- **CSP:** `worker-src 'self'` is enough if the `.wasm` is a same-origin Vite asset. Remote WASM CDNs are forbidden. If Emscripten needs `unsafe-eval` / `wasm-unsafe-eval`, that is an explicit Tauri CSP change and a security review — not implied by current policy.

---

## 8. CONSTRAINTS

Binding laws that govern this work, with where they bind:

| Law | Binds | Citation |
| --- | --- | --- |
| Schema-first domain models; tagged unions; `LiteralKit`; named schemas + `S.is` | any new CAD/figure/artifact model | `AGENTS.md` Code Laws; `standards/ARCHITECTURE.md:108-125`; `standards/effect-first-development.md:1365-1372` |
| Design order schema → `Context.Service` → implementation | new file/OCCT services | user Effect standards; `standards/effect-first-development.md` Operating Model |
| Effect v4; validate against `.repos/effect`, not training data | all new Effect | `AGENTS.md` Tool Routing; `standards/effect-first-development.md:14-17` |
| `Effect.fn` / `Effect.fnUntraced` for generator services | RPC handlers, intake-like flows | already used throughout `Intake.atoms.ts`, `Layer.ts` |
| `HashMap` / `HashSet` / `MutableHashMap` / `MutableHashSet` only — no native `Map`/`Set` | all domain/client code | `standards/effect-first-development.md:150-151`; user rule |
| Prefer Effect helper modules (`A`, `O`, `Str`, …) | all TS | `AGENTS.md` Code Laws; `effect-first-development.md:140-147` |
| Atom-first UI; no raw `useState`/`useEffect` for product state | desktop panels | live `src/App.tsx` + ontology-ui; comments at `App.tsx:153,604` |
| Slice first; drivers own engines; UI consumes client atoms | package placement | `standards/ARCHITECTURE.md:47-59,76-80,1230-1292` |
| New package via `bun run beep create-package` | any new `@beep/cad-*` or `@beep/occt` | `AGENTS.md:64` |
| New slice / role file via `bun run beep architecture` | new panel region files | `AGENTS.md:65` |
| Apps are not public packages; keep runtime `@/*` | do not export a CAD API from the app | `standards/ARCHITECTURE.md:61-63` |
| Portless dev servers only | `dev` script already correct | `AGENTS.md:74-77`; `package.json:18`; `vite.config.ts:134-137` |
| JSDoc titled `**Example**` / `**Details**`, never `@example`/`@remarks` | exported symbols | `AGENTS.md` Code Laws |
| Tests import `@beep/*`, not relatives into `src/` | `packages/**/test` | `AGENTS.md` Code Laws |
| Gesture-bearing UI → `browser-qa-loop` | orbit/pan/zoom viewport | `AGENTS.md:69,81-83` |
| Pre-publication patent text never to cloud AI | any real client STEP/figure | user Oppold rule; this repo is public (`AGENTS.md:89`) |

UI-specific: a CAD canvas is a **driver** (`@beep/graph-3d` is the template: `package.json` `"beep": { "family": "drivers" }`, exports `.` / `./browser` / `./react`). The docked React region is slice **ui**. Atoms are slice **client**. The app only registers the panel.

---

## 9. VERDICT — MVP insertion point

### Minimal viable CAD / figure panel

Do **not** start with a new window, a new app, or a change to `@beep/dock`. Insert a fourteenth keep-alive dock panel, spike-first, Graph-shaped.

**Phase 0 — prove the webview (no dock).**

| File | Action |
| --- | --- |
| `apps/professional-desktop/src/spikes/CadSpike.tsx` | Mount a driver handle into a full-window div; synthetic box or fixture STEP |
| `apps/professional-desktop/src/spikes/CadSpike.worker.ts` | Module worker; encoded protocol (copy `Session.visualizer.worker.ts` or CosmosSpike RPC-in-worker) |
| `apps/professional-desktop/src/App.tsx` | `hasCadSpikeFlag` next to `hasGraph3dSpikeFlag` (`App.tsx:271-274,975-980`) |
| `packages/drivers/occt` (via `create-package`) | WASM load + tessellate + `destroy()` handle, `@beep/occt/browser` |
| `apps/professional-desktop/vite.config.ts` | `optimizeDeps` / assets for the WASM module |
| `apps/professional-desktop/package.json` | workspace dep |

Exit: `?cad-spike` in the Tauri webview shows a mesh, resizes, tears down without leaking the GL context. Same evidence bar as Graph3DSpike (`Graph3DSpike.tsx:1-8`).

**Phase 1 — dock a local viewer (still no durable CAD domain).**

| File | Action |
| --- | --- |
| `apps/professional-desktop/src/workspace/dock.atoms.ts` | `DESKTOP_PANELS` entry `key: "cad-viewer"`, `cluster: "shell"`, start **closed**, larger `PanelConstraints` |
| `apps/professional-desktop/src/App.tsx` | `lazy` + `makePanelRenderers["cad-viewer"]` via `wrapDesktopLazy` |
| `apps/professional-desktop/test/dock-shell.test.tsx` | length 14 + catalog row |
| `packages/<slice>-ui/.../CadViewerRegion.tsx` | Graph-region clone: header + measured container + render bridge |
| `packages/<slice>-client/.../Cad.atoms.ts` | container element atom, binding atom, render-bridge atom |
| `apps/professional-desktop/src/styles/globals.css` | `@source` the new ui package |

Exit: rail button "Figures" opens a keep-alive panel; layout persists in `desktop:dock-workspace:v2`; inactive tab does not destroy the GL context.

**Phase 2 — bytes (the real gap).**

Intake as-is cannot feed a CAD panel. Add, schema-first:

| File | Action |
| --- | --- |
| `packages/documents-domain` **or** new CAD slice domain | `CadArtifact` / figure-view schema (do not stuff a mesh into `Document` without a grill) |
| `packages/documents-use-cases` or CAD use-cases | `GetVaultBytes` / `OpenCadArtifact` RPC; raise or bypass the 25 MiB renderer cap; **do not Base64 a 200 MiB STEP** — stream or sidecar-side tessellate |
| `apps/professional-desktop/server/DesktopRpcs.ts` | merge the new RpcGroup |
| `apps/professional-desktop/src/runtime/Layer.ts` | provide the handler |
| `src/intake/Intake.atoms.ts` **or** CAD atoms | drop path that keeps a digest + path the panel can query |

Two honest architectures (pick one; do not mix):

- **A. Tessellate in a webview worker.** Sidecar only stores/returns bytes (or a tessellation cache). Hits WebKit WASM limits; matches ontology-worker precedent.
- **B. Tessellate in the Bun sidecar.** RPC returns positions/normals/indices (schema-typed buffers). Webview is a dumb `@beep/graph-3d`-style instanced renderer. Better for large STEP; closer to "patent files never leave the machine" if the sidecar never uploads.

**Phase 3 — figure product (out of MVP, but the contract is already visible).**

- Figure camera / standard views as schema in the CAD slice domain
- Inspector-style sibling panel (`cluster` must **not** silently join Ontology — rewrite `ONTOLOGY_PANELS` if you add a `cad-*` cluster)
- Export SVG/PDF figure into the **existing** vault write path (`writeFileWithinRootAtomically`), not a new store

### Contract a CAD panel must satisfy (checklist)

1. `DesktopPanelKey` registered in `DESKTOP_PANELS`; `RendererKey` equals that key.
2. `DockRenderer` wrapped in app `RegistryContext` + `SurfaceBoundary` (+ `DesktopSessionGate` if it RPCs).
3. `renderMode: "always"`; container not published until `clientWidth/clientHeight > 0`.
4. Driver handle acquired/released by an atom finalizer, not `useEffect`.
5. Workers are Vite `new URL(..., import.meta.url)` module workers; posted data is encoded then decoded.
6. No native `Map`/`Set`; schemas for artifact identity, view state, and errors; `LiteralKit` for view kinds.
7. Tailwind classes from a `@source`d package; chrome from `@beep/ui`; theme tokens only.
8. No assumption that `IntakeDroppedFile` can later read the file back — that RPC does not exist.
9. No assumption that 25 MiB / Base64 is a CAD transport.
10. Portless `dev` only; packaged CSP remains `'self'` for scripts/workers.

### Closest living analog (steal this, don't reinvent)

`ontology-graph` panel → `OntologyGraphRegion` → `ontologyGraphContainerBindingAtom` + `ontologyGraphRenderBridgeAtom` → `@beep/graph-3d/browser` `renderGraph3D(container, projection)` → optional `Session.visualizer.worker.ts`.

That is the insertion point. A CAD viewer is that shape with a different projection (mesh instead of knowledge-graph points) and a missing byte-read service that must be designed before the panel can show a real STEP file.
