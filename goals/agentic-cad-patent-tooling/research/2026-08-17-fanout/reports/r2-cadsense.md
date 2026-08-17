# CadSense Repo Archaeology — r2

**Target:** `~/YeeBois/research/CAD_STUFF/cadsense`  
**Origin:** `git@github.com:AadiJo/cadsense.git` (HEAD `e655169` 2026-08-09, "fix: preserve secrets when settings updates fail (#18)")  
**Also referenced as:** `github.com/pingdotgg/cadsense` in `apps/server/package.json:7-8`  
**Date:** 2026-08-17  
**Method:** read-only source inspection. No build, no install, no app run. `node_modules/` ignored. Claims cite `path:LINE`.  
**No `.codegraph/` index.**

---

## 1. WHAT IS IT

CadSense is a local-first **coding-agent workbench**: a Node/Bun WebSocket server plus Vite/Electron shells that host Codex, Claude Code, Cursor ACP, and OpenCode sessions against a project checkout, persist threads in SQLite, and stream provider activity into a chat/diff/terminal UI (`apps/server/src/bin.ts:17-21`, `apps/server/src/provider/builtInDrivers.ts:45-50`, `apps/server/src/server.ts:140-149`).

CAD is **not a kernel**. Geometry is imported from Onshape as mesh/B-rep files into `onshape-sync/`, rendered in the browser (online-3d-viewer or a Three.js 3MF fast path), and inspected by agents through MCP camera/screenshot/hierarchy tools plus a multi-persona FRC CAD-review orchestrator (`packages/shared/src/cad.ts:40-47`, `apps/web/src/cadViewerFrame.ts:1312-1316`, `apps/server/src/cad/CadViewMcp.ts:23-31`, `apps/server/src/orchestration/Layers/CadReviewService.ts:2394-2665`).

Marketing copy ("Catch small CAD mistakes before they ship", `apps/marketing/src/pages/index.astro:27-33`) oversells CAD as the product; the repo's mass is provider adapters, orchestration, git/VCS, and desktop packaging. CAD is a real, deep **review sidecar** aimed at FRC robotics, not a generative CAD system.

---

## 2. MONOREPO TOPOLOGY

### Workspace inventory

Root workspace: `apps/*`, `oxlint-plugin-cadsense`, `packages/*`, `scripts` (`package.json:4-9`). Package manager `bun@1.3.11`, engines Bun `^1.3.11` + Node `^24.13.1` (`package.json:83-87`). Catalog pins Effect `4.0.0-beta.59` and matching `@effect/*` (`package.json:11-26`).

| Path | Name | Role |
| --- | --- | --- |
| `apps/server` | `cadsense` | Node/Bun CLI + HTTP/WS server. Publishes `cadsense` bin (`apps/server/package.json:10-12`). 433 `.ts` files. |
| `apps/web` | `@cadsense/web` | React 19 / Vite 8 client. Chat, CAD panel, settings. Server depends on it as a workspace package so the server can serve the built SPA (`apps/server/package.json:43`). |
| `apps/desktop` | `@cadsense/desktop` | Electron 41 shell. Spawns the server binary, IPC, updates (`apps/desktop/package.json:1-23`, `apps/desktop/src/main.ts:22-38`). |
| `apps/marketing` | `@cadsense/marketing` | Astro 6 public site. Isolated; no workspace deps (`apps/marketing/package.json:1-18`). |
| `packages/contracts` | `@cadsense/contracts` | Schema-only wire contracts. Effect-only dependency (`packages/contracts/package.json:23-25`). |
| `packages/shared` | `@cadsense/shared` | Runtime helpers via **explicit subpath exports, no barrel** (`packages/shared/package.json:5-101`). |
| `packages/client-runtime` | `@cadsense/client-runtime` | Browser/desktop shared client helpers (endpoint, environment, source-control discovery) (`packages/client-runtime/package.json:1-18`). |
| `packages/effect-acp` | `effect-acp` | Generated Agent Client Protocol client (Cursor ACP) (`packages/effect-acp/package.json:1-38`). |
| `packages/effect-codex-app-server` | `effect-codex-app-server` | Generated Codex app-server protocol client (`packages/effect-codex-app-server/package.json:1-31`). |
| `oxlint-plugin-cadsense` | `@cadsense/oxlint-plugin-cadsense` | One custom oxlint rule (`oxlint-plugin-cadsense/package.json:1-7`). |
| `scripts` | `@cadsense/scripts` | Release, desktop packaging, brand assets, Discord notify (`scripts/package.json:1-14`). |

**README is stale.** It lists `packages/ssh` and `packages/tailscale` (`README.md:49-50`); this checkout's `packages/` is only `client-runtime`, `contracts`, `effect-acp`, `effect-codex-app-server`, `shared`. Marketing also claims Claude/Cursor are "on the roadmap" (`apps/marketing/src/pages/index.astro:66-68`) while `BUILT_IN_DRIVERS` already ships both (`apps/server/src/provider/builtInDrivers.ts:45-50`).

### Dependency graph

```
contracts  (effect only)
    ↑
    ├── shared  (contracts + effect)
    │       ↑
    │       ├── client-runtime  (contracts + shared + effect)
    │       │       ↑
    │       │       └── web  (client-runtime, contracts, shared, react, three, …)
    │       │               ↑
    │       └── server  (contracts, shared, web, effect-acp, effect-codex-app-server)
    │               ↑
    └── desktop (contracts, shared)  ──turbo──►  server#build + web#build
```

- Desktop `dev` depends on `cadsense#build`; `start` / `smoke-test` depend on `build` + `@cadsense/web#build` + `cadsense#build` (`apps/desktop/turbo.jsonc:9-21`).
- Server `start` depends on its own `build` (`apps/server/turbo.jsonc:5-8`).
- Root `dev` depends on `@cadsense/contracts#build` (`turbo.json:37-40`) even though contracts currently expose raw `src/` (`packages/contracts/package.json:9-16`) — the task still exists as a pipeline gate.

### Turbo pipeline

Root (`turbo.json:32-51`):

| Task | dependsOn | notes |
| --- | --- | --- |
| `build` | `^build` | outputs `dist/**`, `dist-electron/**` |
| `dev` | `@cadsense/contracts#build` | `cache: false`, `persistent: true` |
| `typecheck` | `^typecheck` | `cache: false` |
| `test` | `^build` | `cache: false` |

`globalEnv` is a long list of `CADSENSE_*`, `VITE_*`, OTLP, and desktop update vars (`turbo.json:3-29`).

Root scripts route through `scripts/dev-runner.ts` rather than raw turbo for `dev`/`dev:server`/`dev:web`/`dev:desktop` (`package.json:32-36`). Lint is a single `bunx oxlint` invocation over `apps/*/src`, `packages`, `scripts`, `oxlint-plugin-cadsense` (`package.json:45`).

---

## 3. CAD SURFACE

**There is no CAD kernel, no BREP modeller, no feature tree, no sketch solver.** CadSense never authors geometry. It **imports** Onshape documents and **views/reviews** the resulting mesh.

### Where geometry comes from

1. User stores Onshape API keys via `onshape.setupConnection` (`packages/contracts/src/rpc.ts:176-183`, `packages/contracts/src/onshape.ts:161-166`).
2. `OnshapeWorkspace` (Context.Service contract at `apps/server/src/onshape/Services/OnshapeWorkspace.ts:32-59`) lists/indexes documents and `syncProject`s them.
3. Live layer talks to Onshape REST v10 via `effect/unstable/http` (`apps/server/src/onshape/Layers/OnshapeWorkspace.ts:19-20`).
4. Preferred export is **color-preserving 3MF** to `onshape-sync/current.3mf` (`packages/shared/src/cad.ts:40-47`, `apps/server/src/onshape/Layers/OnshapeWorkspace.ts:56-59`, `327-347`).
5. Fallback chain, documented in comments: STL (geometry-only), OBJ+MTL (materials, async ZIP bundle), STEP (CAD-accurate, slower) (`packages/shared/src/cad.ts:45-47`, `OnshapeWorkspace.ts:284-302`, `416-417`).
6. Assembly 3MF: `POST /api/v10/assemblies/d/{doc}/{wvm}/{id}/e/{el}/translations` (`OnshapeWorkspace.ts:386-395`). Part studio 3MF: `/api/v10/partstudios/.../translations` (`OnshapeWorkspace.ts:397-405`). OBJ: `/export/obj` (`OnshapeWorkspace.ts:419-438`).
7. Translation is async, polled up to 36 times with exponential backoff capped at 10s (`OnshapeWorkspace.ts:62-64`, `272-278`).
8. Synced files are served at `GET /api/onshape/cad-model/*` so the viewer can infer format from the URL leaf (`apps/server/src/cad/cadModelHttpPath.ts:1-24`, `apps/server/src/http.ts:480-485`).

`listSyncedCadFiles` walks `onshape-sync/`, prefers `current.3mf`, and for OBJ expands `mtllib` + MTL texture maps (`apps/server/src/onshape/listSyncedCadFiles.ts:253-321`, `packages/shared/src/cad.ts:90-147`).

Onshape-backed projects are forced into **read-only runtime mode** so the coding agent cannot mutate the CAD repo (`apps/server/src/orchestration/decider.ts:27-49`).

### Viewer / renderer / formats

| Layer | What |
| --- | --- |
| Format allow-list | 3dm, 3ds, 3mf, amf, bim, brep, dae, fbx, fcstd, gltf, glb, ifc, iges, igs, step/stp, stl, obj, off, ply, wrl + texture/MTL companions (`packages/shared/src/cad.ts:1-36`) |
| Default preview | 3MF (`cad.ts:43-44`) |
| Primary renderer | `online-3d-viewer` 0.18.0 (`apps/web/package.json:38`, `apps/web/src/cadViewerFrame.ts:38-39`) |
| Fast path | Worker-parsed 3MF → tiny Three.js scene, bypassing o3dv's "millions of individual JS objects" conversion (`cadViewerFrame.ts:1312-1316`, `apps/web/src/lib/cadThreeMfFastParser.ts`) |
| Three | `three@0.176.0` (`apps/web/package.json:44`) |
| Limits | 256 MiB download, 4096 3MF entries, 512 MiB expanded (`apps/web/src/lib/cadThreeMfResourceLimits.ts:3-6`) |
| Axes | Right-handed, **+Z up** (`packages/shared/src/cadViewOrientationGuide.ts:7-16`, `apps/web/src/lib/cadView.ts:24-40`) |
| `f3d` | Declared `^3.5.0` in web `package.json:34` — **zero source imports**. Dead dependency. |

Camera presets: `top|bottom|front|back|left|right|isometric` plus `-close-up` (`packages/contracts/src/onshape.ts:248-263`). Vectors: front `[0,-1,0]`, iso `[1,-1,1]`, up `[0,0,1]` (`apps/web/src/lib/cadView.ts:24-40`).

### Agent-facing CAD control (not a modeller)

MCP tools do **not** edit geometry. They drive the live WebGL panel:

- `set_cad_view`, `set_cad_camera`, `export_cad_screenshot`, `get_cad_hierarchy`, `set_cad_component_visibility`, `set_cad_exploded`, `zoom_cad_to_fit`, `frc_mechanical_calculator` (`apps/server/src/cad/CadViewMcp.ts:23-31`, `667-823`).

The loop is: MCP child → HTTP POST `/api/cad/{view-command,control-command,hierarchy,screenshot-capture}` → WS subscription to the browser → browser applies camera / reads hierarchy / captures PNG → claim/lease upload back (`CadViewMcp.ts:1025-1072`, `packages/contracts/src/rpc.ts:187-199`, `apps/server/src/cad/CadRequestLease.ts:8-41`).

`CadViewScheduler` serializes per-thread CAD operations so concurrent reviewers don't fight the single viewer (`apps/server/src/cad/CadViewScheduler.ts:6-51`). Implementation is a `Map` of Promise tails plus `Effect.runPromise` inside `Effect.promise` (`CadViewScheduler.ts:20-48`) — pragmatic, not Effect-native.

### Mechbase (precedent images, not CAD)

Separate FRC mechanism-binder search: `search_mechbase` + `fetch_mechbase_artifact` (`apps/server/src/mechbase/MechbaseMcp.ts:17-19`, `238-299`). Images are converted with `sharp` + `jpeg2000` so JPX/JP2/TIFF become PNG (`apps/server/package.json:37-38`, `apps/server/src/mechbase/MechbaseApi.ts:1-2`).

---

## 4. AGENT / AI DESIGN

CadSense does **not** implement its own LLM loop or tool-calling runtime. It **hosts** existing agent CLIs and injects CadSense MCP servers + developer instructions.

### Provider adapters (the real agent surface)

Built-in drivers (`apps/server/src/provider/builtInDrivers.ts:45-50`):

| Driver | Kind slug | Protocol |
| --- | --- | --- |
| Codex | `codex` | Codex app-server via `effect-codex-app-server` |
| Claude Code | `claudeAgent` | `@anthropic-ai/claude-agent-sdk` |
| Cursor | `cursor` | Agent Client Protocol via `effect-acp` |
| OpenCode | `opencode` | `@opencode-ai/sdk` |

`ProviderDriver` is a **plain record**, not a `Context.Service`, because many instances of the same driver must coexist (`apps/server/src/provider/ProviderDriver.ts:1-12`). `ProviderDriverKind` is an **open branded slug**, not a closed union, so unknown fork drivers parse and become `"unavailable"` instead of crashing (`packages/contracts/src/providerInstance.ts:17-28`, `59-71`).

`ProviderAdapterShape` is the session SPI: `startSession`, `sendTurn`, `interruptTurn`, approvals, user-input, rollback, `streamEvents` (`apps/server/src/provider/Services/ProviderAdapter.ts:45-126`).

Default models (`packages/contracts/src/model.ts:130-143`): Codex `gpt-5.4`, Claude `claude-sonnet-4-6`, Cursor `auto`, OpenCode `openai/gpt-5`.

### MCP servers CadSense itself hosts

CLI: `cadsense mcp cad-view` and `cadsense mcp mechbase` (`apps/server/src/cli/mcp.ts:7-18`, wired in `apps/server/src/bin.ts:17-21`).

**`cadsense-cad-view`** (`CadViewMcp.ts:23-35`):

- HTTP at `/api/mcp/cad` with HMAC-signed capability token in `x-cadsense-cad-view-token` (`CadViewMcp.ts:32-34`, `207-219`; route `apps/server/src/http.ts:661-710`).
- Also stdio (`makeCadViewMcpStdioServer`, `CadViewMcp.ts:288-305`) because Electron children need `ELECTRON_RUN_AS_NODE=1` re-asserted (`CadViewMcp.ts:268-285`).
- Protocol versions: legacy `2024-11-05` (`CadViewMcp.ts:660-663`) and `2026-07-28` (`CadViewMcp.ts:35`, `973-978`).
- Injected into Codex as `mcp_servers[cadsense-cad-view].url` (`CadViewMcp.ts:307-320`, `CodexAdapter.ts:1581-1587`), into Claude as `mcpServers` HTTP (`ClaudeAdapter.ts:2859-2866`).

Tool schemas (quoted from `tools/list`, `CadViewMcp.ts:667-823`):

```
set_cad_view          { view: enum[14 presets], fit?: boolean }
set_cad_camera        { direction: [x,y,z], up?: [x,y,z], fit?, distance?, closeUp? }
export_cad_screenshot { view?, fit?, suggestedBaseName? }
get_cad_hierarchy     {}
set_cad_component_visibility { componentId, visible }
set_cad_exploded      { exploded }
zoom_cad_to_fit       {}
frc_mechanical_calculator {
  calculationType: roller_surface_speed | gear_reduction
                 | shaft_deflection_center_load | compression,
  rpm?, diameterIn?, drivingTeeth?, drivenTeeth?, inputRpm?,
  spanIn?, loadLbf?, modulusPsi?, gamePieceDiameterIn?, gapIn?
}
```

Calculator is first-pass FRC math, not FEA (`CadViewMcp.ts:95-103`, `122-193`). Visibility toggles are **verified** by re-reading hierarchy with backoff (`CadViewMcp.ts:579-645`).

**`cadsense-mechbase`** (`MechbaseMcp.ts:17-19`, `238-299`):

```
search_mechbase { query, top_k?, team?, year?, source?, modality?, debug? }
fetch_mechbase_artifact { artifactUrl }
```

### Developer / system prompts (quoted)

Injected into every provider (`apps/server/src/provider/CodexDeveloperInstructions.ts:25-29`, Claude `systemPrompt.append` at `ClaudeAdapter.ts:2836-2840`):

> CadSense regular assistant messages render Markdown image embeds… For Mechbase results, do not embed an image directly from search results. First call `fetch_mechbase_artifact`… (`CodexDeveloperInstructions.ts:1-9`)

> When the `cadsense-mechbase` MCP server is available, strongly prefer using `search_mechbase` before answering FRC mechanism design questions… (`CodexDeveloperInstructions.ts:11-15`)

> Keep CAD review answers evidence-grounded and student-actionable. … If a CAD tool call fails… instead of repeating the same call more than twice. (`CodexDeveloperInstructions.ts:17-23`)

Codex also gets a large **Plan Mode** collaboration prompt (`CodexDeveloperInstructions.ts:31-153`) that forbids mutating the repo until a `<proposed_plan>` block is emitted, and a Default-mode counterpart (`:155-168`).

### CAD review orchestrator (the only first-party multi-agent loop)

Triggered by orchestration event `thread.review-requested` (`packages/contracts/src/orchestration.ts:1042`, `1375`; service `apps/server/src/orchestration/Services/CadReviewService.ts:6-18`).

Pipeline in `generateReview` (`CadReviewService.ts:2394-2665` and following):

1. **planning** — hidden child thread, `interactionMode: "plan"`, `buildMechanismPlanningPrompt` (`:2509-2520`).
2. **capturing-baseline** — server-side screenshots of iso/front/right/top + close-ups (`:79-91`, `:2577-2588`) unless planner sets `baselineRequired: false` (`orchestration.ts:349-350`, `CadReviewService.ts:2644-2660`).
3. **reviewing** — up to 3 specialist personas concurrently (`CAD_REVIEW_REVIEWER_CONCURRENCY = 3`, `:75`; personas `CadReviewPrompts.ts:20-24`).
4. **deep-diving** — highest-risk findings (`CadReviewPrompts.ts:196-239`).
5. **synthesizing** — merge into action items (`CadReviewPrompts.ts:242-305`).

Each child is a **real provider turn**: `createChildThread` + `orchestrationEngine.dispatch({ type: "thread.turn.start", message: { text: prompt } })` (`CadReviewService.ts:2280-2295`). 20-minute timeout (`:61`). Status machine: `requested | planning | capturing-baseline | reviewing | deep-diving | synthesizing | completed | partial | failed` (`orchestration.ts:267-277`).

Persona prompt excerpt (`CadReviewPrompts.ts:38-40`):

> You are an elite FRC systems integration reviewer. Evaluate whether this CAD can realistically become part of a functioning competition robot, not whether the mechanism works in isolation.

Reviewer output is **JSON only** with typed keys (`CadReviewPrompts.ts:138-143`). Structured into `CadReviewReport` / `CadReviewFinding` / `CadReviewActionItem` schemas (`orchestration.ts:283-441`). Prompts explicitly ban `request_user_input` / `ask_question` (`CadReviewPrompts.ts:100`, `172`, `268`) so hidden review children cannot stall on the user.

### Orchestration (event-sourced command bus)

`OrchestrationEngineService` is a `Context.Service` that validates/dispatches commands and publishes persisted events (`apps/server/src/orchestration/Services/OrchestrationEngine.ts:26-85`). Reactors consume the bus: provider command, provider runtime ingestion, checkpoint, CAD review, thread deletion (`apps/server/src/server.ts:140-149`). Wire methods live in `WS_METHODS` + `Rpc.make` grouped into `WsRpcGroup` (`packages/contracts/src/rpc.ts:127-200`, `600-655`).

### Generated protocol packages

- `effect-acp`: OpenAPI-generator from ACP schema release `v0.11.3` (`packages/effect-acp/scripts/generate.ts:16`).
- `effect-codex-app-server`: same pattern (`packages/effect-codex-app-server/package.json:30`).
- Both export `client` / `schema` / `rpc` / `protocol` / `errors` subpaths.

These are **not** CadSense MCP. They are typed clients for the *hosted* agents' native protocols.

---

## 5. STACK DETAIL

| Layer | Choice | Evidence |
| --- | --- | --- |
| Runtime | Bun preferred, Node fallback | `package.json:83-87`; HTTP chooses `BunHttpServer` if `typeof Bun !== "undefined"` else `NodeHttpServer` + `node:http.createServer` (`apps/server/src/server.ts:104-125`). Same for platform services (`:128-137`) and SQLite (`apps/server/src/persistence/Layers/Sqlite.ts:18-30`). |
| Tooling | bun workspaces + catalog, turbo 2, oxlint, oxfmt, mise (`node 24.13.1`, `bun 1.3.9` — slightly behind packageManager) | `package.json`, `.mise.toml:1-3` |
| TS | ESNext / NodeNext, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` | `tsconfig.base.json:3-14` |
| Effect | **v4 beta 59, catalog-wide** | `package.json:11-19`. `Context.Service`, `Layer`, `Effect.fn` / `Effect.fnUntraced`, `effect/unstable/{http,rpc,cli,sql,process}`. |
| HTTP | `effect/unstable/http` (`HttpRouter`, `HttpServer`) | `apps/server/src/server.ts:3`, `apps/server/src/http.ts` |
| RPC | `effect/unstable/rpc` `Rpc.make` + `RpcGroup` | `packages/contracts/src/rpc.ts:1-3` |
| CLI | `effect/unstable/cli` `Command.make` | `apps/server/src/bin.ts:5-21` |
| Persistence | SQLite WAL via `@effect/sql-sqlite-bun` or a Node client | `Sqlite.ts:18-39` |
| Web | React 19, Vite 8, TanStack Router + Query, Tailwind 4, React Compiler, Base UI | `apps/web/package.json:15-46`, `apps/web/vite.config.ts:1-5` |
| State | **Zustand** for chat/thread bookkeeping (`apps/web/src/store.ts:27`); **`@effect/atom-react`** for RPC/server/diagnostics atoms (`apps/web/src/rpc/atomRegistry.ts:1-8`, `wsConnectionState.ts:1`) | Split brain, documented in store comments (`store.ts:50-76`) |
| Desktop | Electron 41 + electron-updater, Effect layers wrapping Electron APIs | `apps/desktop/package.json:22-23`, `apps/desktop/src/main.ts:55-66` |
| Test | Vitest 4 + `@effect/vitest`; browser tests via Playwright (`apps/web/package.json:11-13`) | Root `vitest.config.ts` aliases `@cadsense/contracts` to source |
| Observability | Local file tracer + optional OTLP (`packages/shared/src/observability.ts`, turbo `CADSENSE_OTLP_*`) | |
| Images | `sharp` + `jpeg2000` for Mechbase preview conversion | `apps/server/package.json:37-38` |

### Effect-adjacent patterns (important for beep-effect2)

**They are a real Effect v4 monorepo**, closer to beep than any other CAD repo in this study.

What they do well:

- Schema-first contracts package, schema-only by design (`packages/contracts/package.json:23-25`, `README.md:45`).
- Service **contract file** (`Context.Service<Tag, Shape>()`) then **Live Layer** in `Layers/` — see `OnshapeWorkspace.ts` service vs layer, `CadReviewService.ts` service vs layer, `OrchestrationEngineService.ts:82-85`.
- `Effect.fn("name")` / `Effect.fnUntraced` on generators (`packages/effect-acp/src/protocol.ts:78`, `Sqlite.ts:23`, `schemaJson.ts` hoists compilers).
- `@effect/language-service` with most diagnostics at **error**: `importFromBarrel`, `preferSchemaOverJson`, `schemaSyncInEffect`, `nodeBuiltinImport`, `missingEffectServiceDependency`, `leakingRequirements`, `globalConsole`, `cryptoRandomUUID`, etc. (`tsconfig.base.json:21-51`). `prepare` runs `effect-language-service patch` (`package.json:31`).
- Hoisted `Schema.is` / `Schema.decodeUnknownSync` at module scope (the oxlint rule's reason) — e.g. `CadViewMcp.ts:58-64`, `http.ts:84-88`.
- Dual Bun/Node platform layers instead of pretending one runtime exists (`server.ts:104-137`).

What they do **not** do (and beep should not copy):

- **Zero** `effect/HashMap` / `HashSet` / `MutableHashMap` / `MutableHashSet` in source (repo-wide grep is empty). They use `new Set` / `new Map` everywhere (`cad.ts:38`, `CadViewScheduler.ts:20`, `CadReviewService.ts:57`).
- Contracts use `Schema.Struct` + `export type X = typeof X.Type` (`onshape.ts:47-58`, `orchestration.ts:283-294`), **not** `S.Class` / `LiteralKit`. Literals via `Schema.Literals([...])` (`onshape.ts:25-31`, `248-263`).
- MCP servers are hand-rolled JSON-RPC over `node:readline` (`CadViewMcp.ts` / `MechbaseMcp.ts:335-362`), not Effect HTTP/RPC.
- `node:http.createServer` is passed into `NodeHttpServer.layer` with a diagnostic suppression (`apps/server/src/server.ts:116-123`; same pattern in `scripts/mock-update-server.ts:1-2`).
- `CadReviewService.ts` is a ~3300-line mutable `Object.assign(review, …)` state machine (`:2547`, `:2579`) inside one `Effect.gen`.
- `CadViewScheduler` drops out of Effect into Promise chains (`CadViewScheduler.ts:22-48`).

---

## 6. `oxlint-plugin-cadsense`

One plugin, one rule (`oxlint-plugin-cadsense/index.ts:5-11`):

### `cadsense/no-inline-schema-compile` (warn)

**Invariant:** Effect Schema decoder/encoder compiler APIs allocate compiled functions. Calling them inside a function body rebuilds the compiler on every call. Hoist to module scope (`oxlint-plugin-cadsense/rules/no-inline-schema-compile.ts:7-8`, `95-99`).

Banned callee methods (`:9-33`):

`Schema.is`, `asserts`, and every `decode*` / `encode*` / `decodeUnknown*` / `encodeUnknown*` variant (`Effect`, `Exit`, `Option`, `Promise`, `Sync`).

Triggers only when:

- call is inside a function (`functionDepth > 0`, `:132-133`);
- it is immediately invoked (`:80-93`, `:137`);
- first arg is a static schema identifier (`PascalCase`) or a nested `Schema.*` construction (`:49-78`, `:139-141`).

Severity:

- **High** if the schema itself is constructed inline (`Schema.decodeUnknownEffect(Schema.Struct({…}))(input)`) — "both the inline schema literal and the compiled function are rebuilt" (`:95-96`, test `:71-79`).
- **Medium** if a hoisted schema is recompiled per call (`Schema.decodeUnknownEffect(User)(input)`) (`:98-99`, test `:57-68`).

Allowed: compilers hoisted to module const; factory helpers that compile once and return the function; `Schema.fromJsonString(schema).pipe(Schema.encode(…))` construction; dynamic schema type parameters (`no-inline-schema-compile.test.ts:8-55`).

Wired as a jsPlugin in `.oxlintrc.json:12` and `"cadsense/no-inline-schema-compile": "warn"` (`:23`). This is the team's only custom lint invariant — and it is specifically an Effect-v4 hot-path lesson.

---

## 7. `patches/`

Single patch: `patches/effect@4.0.0-beta.59.patch` (277 lines), registered in `package.json:93-95`.

It **backports RPC client observability hooks** that this beta of Effect does not ship:

1. **`RpcClient.RequestHooks`** `Context.Service` with:
   - `onRequestStart({ id, tag, stream })`
   - `onRequestChunk({ id, tag, chunkCount })`
   - `onRequestExit({ id, tag, stream, exit })`
   - `onRequestInterrupt({ id, tag? })`  
   (`patches/effect@4.0.0-beta.59.patch:15-44`, JS class at `:274`).

2. **`ConnectionHooks`** extended with optional `onPing`, `onPong`, `onPingTimeout` (`:45-51`).

3. `makeNoSerialization` reads `Effect.serviceOption(RequestHooks)` and fires those hooks around send / chunk / exit / interrupt (`:62-203`).

4. Socket pinger invokes `onPing` before write, `onPong` on pong, `onPingTimeout` before failing the socket (`:209-267`).

**Why it exists:** CadSense needs per-RPC request tracing (they have a large `CADSENSE_TRACE_*` / OTLP surface in `turbo.json:16-26` and RPC aggregates like `{ "rpc.aggregate": "onshape" }` in `apps/server/src/ws.ts:1055`). Effect 4.0.0-beta.59's `RpcClient` only had connect/disconnect hooks. They patched the **published `dist/`** of the catalog pin rather than waiting for upstream.

This will bitrot the moment they bump Effect. Treat it as a signal that Effect RPC client lifecycle hooks are load-bearing for an agent workbench, not as a patch to copy.

---

## 8. LICENSE AND REUSE POSTURE

- **MIT**, Copyright (c) 2026 **CadSense Tools Inc.** (`LICENSE:1-3`).
- README restates MIT (`README.md:68-70`).
- Apps declare `"license": "MIT"` (`apps/server/package.json:4`).
- No CLA, no Commons Clause, no source-available trap. Reuse of architecture and code is legally clean.
- Product is **alpha** (`README.md:11-13`). Expect moving APIs.
- Dual GitHub identity: origin `AadiJo/cadsense`, server `repository.url` `pingdotgg/cadsense` (`apps/server/package.json:5-8`). Ping (pingdotgg) involvement is visible; corporate copyright is CadSense Tools Inc.

---

## 9. PORTABILITY VERDICT

Ranked for a TypeScript / Effect v4 monorepo (beep-effect2 / agentic CAD-patent tooling). "Steal" means copy the *idea and file shape*, not necessarily the code.

### Steal (high value)

1. **Schema-only `packages/contracts` + `Rpc.make` / `RpcGroup` as the product API.** `packages/contracts/src/rpc.ts`, `index.ts`, `onshape.ts`, `orchestration.ts`. This is the closest sibling to beep's schema → service → impl doctrine. CAD methods (`onshape.*`, `cad.*`, `subscribeCadViewCommands`) sit in the same Rpc group as git and auth — CAD is just more RPCs.

2. **`Context.Service<Tag, Shape>()` contract file, `Layers/` live implementation.** `apps/server/src/onshape/Services/OnshapeWorkspace.ts` + `Layers/OnshapeWorkspace.ts`; `orchestration/Services/*` + `Layers/*`. Matches beep's "schema then Effect Context service then implementation."

3. **`oxlint-plugin-cadsense` `no-inline-schema-compile`.** `oxlint-plugin-cadsense/rules/no-inline-schema-compile.ts`. Port this rule almost verbatim. It encodes a real Effect v4 performance footgun.

4. **`@effect/language-service` diagnostic severity map as errors.** `tsconfig.base.json:21-51`. Especially `preferSchemaOverJson`, `schemaSyncInEffect`, `importFromBarrel`, `nodeBuiltinImport`, `missingEffectServiceDependency`, `leakingRequirements`. `prepare: effect-language-service patch`.

5. **Open branded `ProviderDriverKind` + instance-id routing.** `packages/contracts/src/providerInstance.ts:17-83`. Drivers as plain records (`ProviderDriver.ts:1-21`), registry as the only service. Lets you add a "patent-figure" or "KittyCAD" driver without a closed union breaking persisted state.

6. **Browser-as-renderer, server-as-lease, agent-as-MCP-client.** Do not put a CAD kernel in the agent. CadSense's screenshot/hierarchy claim-lease (`CadRequestLease.ts:8-41`, `onshape.ts:329-347`) plus HMAC MCP capability (`CadViewMcp.ts:207-219`) is the right split for any web CAD review tool.

7. **Structured multi-persona review DAG with JSON-only outputs.** `CadReviewPrompts.ts` + `CadReviewService.ts:2394+` + schemas in `orchestration.ts:248-441`. For patent-figure QA, steal the *shape* (planner → evidence capture → specialist passes → synthesis → typed report), not the FRC text.

8. **Shared CAD view vocabulary as a schema + human guide.** `CadView` literals (`onshape.ts:248-263`) + `CAD_VIEW_ORIENTATION_GUIDE` (`cadViewOrientationGuide.ts:7-16`) + MCP tool descriptions that *repeat* those vectors (`CadViewMcp.ts:66-83`). Agents need the same coordinate frame the renderer uses.

9. **Workspace catalog + `patchedDependencies` + turbo `globalEnv`.** `package.json:11-26`, `93-95`, `turbo.json:3-51`. This is how they keep Effect v4 beta coherent across apps.

10. **`packages/shared` subpath exports, no barrel.** `packages/shared/package.json:5-101`. Language-service `importFromBarrel: error` enforces it.

11. **Generated Effect clients for foreign agent protocols.** `packages/effect-acp/scripts/generate.ts`, `packages/effect-codex-app-server`. If you host Codex/Claude/Cursor rather than replacing them, this is the integration pattern.

12. **Onshape-project → force `read-only` runtime.** `decider.ts:27-49`. Patent / pre-publication CAD should get the same invariant: agents inspect, they do not write the corpus.

13. **3MF worker fast path + resource limits.** `cadViewerFrame.ts:1312-1316`, `cadThreeMfResourceLimits.ts:3-6`. If patent figures land as 3MF/STEP meshes, you will hit the same o3dv cost cliff.

### Steal with caution (adapt)

14. **Custom MCP over stdio/HTTP.** The *tools* are the asset; the *transport* is a pile of `node:readline` + header checks (`http.ts:661-701`). Prefer Effect HTTP + a real MCP schema if beep hosts tools.

15. **Zustand + atom-react split.** Works, but they had to write a long comment about which stream owns which map (`store.ts:50-76`). Beep should pick one.

16. **Bun/Node dual HTTP + SQLite loaders.** `server.ts:104-137`, `Sqlite.ts:18-30`. Good if you ship both; skip if you commit to Bun.

17. **Electron `ELECTRON_RUN_AS_NODE` MCP child dance.** `CadViewMcp.ts:268-285`. Only relevant if beep-desktop spawns MCP children from the Electron binary.

### Avoid

1. **Treating this as a CAD kernel.** There is no modeller. Patent-figure generation will not come from this repo.

2. **The 3300-line `CadReviewService` mutable Object.assign loop.** Extract phases as services; keep JSON parse/repair (`CadReviewService.ts:201-250`) out of the orchestrator.

3. **`CadViewScheduler`'s Promise-tail + `Effect.runPromise`.** `CadViewScheduler.ts:20-48`. Reimplement with Effect queue/fiber per thread.

4. **FRC-specific prompt and calculator surface as-is.** `CadReviewPrompts.ts`, `frc_mechanical_calculator`. Domain-locked to student robotics. The *evidence-grounded, no invented dimensions* discipline (`CodexDeveloperInstructions.ts:17-21`) is portable; the roller-compression language is not.

5. **Dead `f3d` dependency** (`apps/web/package.json:34`) and stale README package map.

6. **Patching Effect `dist/` for RPC hooks.** Track upstream `RequestHooks`; don't accumulate catalog patches.

7. **Regular `Set`/`Map` in Effect services.** They do this everywhere. Beep's standing rule forbids it.

8. **`Schema.Struct` + separate `export type` instead of `S.Class` / `LiteralKit`.** Fine for them; do not regress beep's schema style to match.

9. **Hand-rolled JSON-RPC MCP + `node:crypto` HMAC** if beep already has Effect HTTP auth. The capability token idea is good; the implementation is pre-Effect.

10. **Marketing/code drift as a source of truth.** Marketing says Claude/Cursor are roadmap; code ships both. Always read `builtInDrivers.ts`.

### Bottom line

CadSense is the **closest architectural sibling** to beep-effect2 in this fanout: Bun + Turborepo + Effect v4 beta + schema contracts + Context.Service layers + oxlint + Vitest. Its CAD contribution is a **review loop over imported Onshape meshes**, not generation. Steal the contracts/RPC/service layout, the schema-compiler lint rule, the MCP-drives-the-viewer split, and the multi-persona structured review DAG. Do not steal the kernel you hoped was here — it isn't.

---

## File index (highest-signal)

| Concern | Path |
| --- | --- |
| Product entry | `apps/server/src/bin.ts`, `apps/server/src/server.ts` |
| CAD formats | `packages/shared/src/cad.ts` |
| Onshape import | `apps/server/src/onshape/Layers/OnshapeWorkspace.ts` |
| Viewer | `apps/web/src/cadViewerFrame.ts`, `apps/web/src/components/CadPanel.tsx` |
| MCP tools | `apps/server/src/cad/CadViewMcp.ts`, `apps/server/src/mechbase/MechbaseMcp.ts` |
| Review DAG | `apps/server/src/orchestration/Layers/CadReviewService.ts`, `CadReviewPrompts.ts` |
| Wire schemas | `packages/contracts/src/{rpc,onshape,orchestration,providerInstance}.ts` |
| Hosted agents | `apps/server/src/provider/{builtInDrivers,Services/ProviderAdapter,Layers/*}` |
| Prompts | `apps/server/src/provider/CodexDeveloperInstructions.ts` |
| Lint invariant | `oxlint-plugin-cadsense/rules/no-inline-schema-compile.ts` |
| Effect patch | `patches/effect@4.0.0-beta.59.patch` |
| License | `LICENSE` |
