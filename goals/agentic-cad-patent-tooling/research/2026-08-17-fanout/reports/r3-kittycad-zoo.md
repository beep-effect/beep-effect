# R3 — Zoo / KittyCAD archaeology

**Lane:** repo archaeology of `~/YeeBois/research/CAD_STUFF/KittyCAD`
**Checkouts:** `kittycad.ts` (`@kittycad/lib` 4.3.24) and `modeling-app` (Zoo Design Studio)
**Central question:** how much of Zoo can be used without their cloud, and what does the TS SDK actually expose to an agent?
**Method:** read-only file:line citations. No build/install/run. `node_modules` ignored. No `.codegraph/` index in either checkout.

**One-sentence answer:** the TypeScript SDK is a complete OpenAPI client for Zoo's cloud (text-to-CAD, file conversion, modeling websocket, billing); KCL parse/lint/format/LSP run locally in MIT Rust/WASM; **every real solid, import, export, and render goes to `api.zoo.dev` over WebSocket and comes back as a `<video>` stream.** There is no MCP server and no geometry kernel in these trees.

---

## 0. Checkout map

| Path | What | Identity |
|---|---|---|
| `kittycad.ts/` | OpenAPI-generated TS client `@kittycad/lib` | `4.3.24`, MIT, KittyCAD 2022 |
| `modeling-app/` | Zoo Design Studio (Electron + React + Rust/WASM KCL) | `zoo-modeling-app`, MIT, The Zoo Authors 2023 |

`modeling-app/README.md:22-24` states the product thesis:

> The 3D view in Design Studio is just a video stream from our hosted geometry engine. The app sends new modeling commands to the engine via WebSockets, which returns back video frames of the view within the engine.

`modeling-app/README.md:16-17` is equally explicit: the engine "parallelizes rendering and just sends video frames back to the app (seriously, inspect source, it's just a `<video>` element)".

---

## 1. `kittycad.ts` SDK

### 1.1 How it is generated

OpenAPI 3.0.3 spec, not hand-written.

- `kittycad.ts/spec.json:1-10` — `"openapi": "3.0.3"`, title `"Zoo API"`, contact `api@zoo.dev`.
- `kittycad.ts/AGENTS.md:1-22` — `spec.json` → `gen/modelsGen.ts` writes `src/models.ts` then calls `gen/apiGen.ts`; that writes `src/api/**`, `__tests__/gen/**`, and `src/index.ts`. Templates live in `gen/templates/*.hbs`. `src/api/**` / `src/models.ts` / `src/index.ts` are **do not hand-edit**.
- `kittycad.ts/gen/apiGen.ts:20-36` — reads `./spec.json` as `OpenAPIV3.Document`, wipes `src/api`, mkdir per OpenAPI tag, emits one file per `operationId`.
- `kittycad.ts/package.json:76` — `npm run gen` compiles the generators and runs `modelsGen.js`.
- `kittycad.ts/CONTRIBUTING.md:3-6` — spec is a pull-through from `modeling-api/modeling-cmds` via `api-deux`; a bot commits the new spec. Every main commit publishes to NPM.

Default host is hard-coded in every generated call:

```53:54:kittycad.ts/src/api/ml/create_text_to_cad.ts
  const urlBase = client?.baseUrl || 'https://api.zoo.dev'
  const fullUrl = urlBase + url
```

`Client` (`kittycad.ts/src/client.ts:39-74`) accepts `{ token, baseUrl, fetch }`. Token fallbacks: `KITTYCAD_TOKEN` / `KITTYCAD_API_TOKEN` / `ZOO_AI_TOKEN`. Host fallback: `ZOO_HOST`.

The package also depends on `"@kittycad/kcl-wasm-lib": "0.1.174"` (`package.json:84`) pinned exact (`CONTRIBUTING.md:14-16`). That is the KCL WASM runtime, used by the SDK's own WebRTC worker (`kittycad.ts/src/worker-webrtc.ts:4,54-66`) to parse KCL and open a modeling websocket — not a local kernel.

### 1.2 Full API surface by domain

Generated as one function (or WS class) per operation. Public namespaces from `kittycad.ts/src/index.ts`:

| Namespace | Ops (approx) | Role for an agent |
|---|---|---|
| `api_calls` | 7 + pagers | poll `/async/operations/{id}` |
| `api_tokens` | 4 | user tokens |
| `apps` | 3 | GitHub app |
| `executor` | 2 | remote "litterbox" code exec |
| `factory` | 3 | manufacturing jobs |
| `file` | 7 | **CAD convert + mass props** |
| `meta` | 7 | schema, ping, pricing |
| `ml` | 15 + pagers | **text-to-CAD, copilot WS, completions** |
| `modeling` | 1 class | **modeling websocket** |
| `oauth2` | 26 + pagers | OAuth + device flow |
| `orgs` | 36 | orgs, datasets, SAML, skills |
| `payments` | 41 | billing |
| `projects` | 18 | cloud project store + gallery |
| `service_accounts` | 4 | org service accounts |
| `store` | 1 | coupon |
| `unit` | 13 | unit conversion (pure REST, no CAD) |
| `users` | 29 | identity / forms / features |

Almost everything is a cloud HTTP/WS call. The only local compute the SDK can do is parse KCL via the optional WASM dep.

### 1.3 Text-to-CAD (REST, now deprecated)

JSDoc on the REST endpoints says **prefer `/ws/ml/copilot`**. They are tagged `ml, hidden`.

**`ml.create_text_to_cad`** — `kittycad.ts/src/api/ml/create_text_to_cad.ts:10-46`

```ts
async function create_text_to_cad({
  client?: Client
  output_format: FileExportFormat
  kcl?: boolean
  body: TextToCadCreateBody
}): Promise<TextToCad>
```

- `POST /ai/text-to-cad/{output_format}?kcl=`
- Async. Returns an `id` to poll via `/async/operations/{id}`.
- Source of truth is STEP; other formats come along (`create_text_to_cad.ts:24`).
- Body (`models.ts:10636-10659`): `{ prompt: string, kcl_version?, model_version?, project_name? }`.
- Result (`models.ts:10571-10634`): `{ id, prompt, code?, outputs?, status, conversation_id, model: 'cad' | 'kcl' | 'kcl_iteration', ... }`.

**`ml.create_text_to_cad_iteration`** — `create_text_to_cad_iteration.ts:6-38`

```ts
async function create_text_to_cad_iteration({
  client?: Client
  body: TextToCadIterationBody
}): Promise<TextToCadIteration>
```

- `POST /ml/text-to-cad/iteration`
- Explicitly: "This endpoint is deprecated in favor of `/ws/ml/copilot`" (`:24`).
- Body (`models.ts:10718-10744`): `{ original_source_code, prompt?, source_ranges, kcl_version?, project_name? }`. Always returns whole file.

**`ml.create_text_to_cad_multi_file_iteration`** — `create_text_to_cad_multi_file_iteration.ts:10-47`

```ts
async function create_text_to_cad_multi_file_iteration({
  client?: Client
  files: File[]
  body: TextToCadMultiFileIterationBody
}): Promise<TextToCadMultiFileIteration>
```

- `POST /ml/text-to-cad/multi-file/iteration` (multipart)
- Same deprecation note. Returns only changed KCL files; never mutates imported STL/GLTF/STEP (`:27`).

**`ml.create_text_to_cad_part_feedback`**, **`get_text_to_cad_part_for_user`**, **`list_text_to_cad_parts_for_user`** (+ `_pager`) — history / thumbs.

### 1.4 Recommended agent channel: ML copilot websocket

**`ml.ml_copilot_ws`** — class `MlCopilotWs` (`kittycad.ts/src/api/ml/ml_copilot_ws.ts:24-49`)

```ts
class MlCopilotWs {
  static urlConstructFrom(params: {
    client?: Client
    replay?: boolean
    conversation_id?: string
    pr?: number
  }): URL  // wss://api.zoo.dev/ws/ml/copilot?...
  static authenticate(params, ws: WebSocket): void  // sends {type:'headers', headers:{Authorization}}
  static toBSON(data: MlCopilotClientMessage): Uint8Array
  static parseMessage(ev: MessageEvent): MlCopilotServerMessage
}
```

**Client messages** (`models.ts:4348-4421`):

| `type` | Payload |
|---|---|
| `ping` | — |
| `list_modes` | — |
| `headers` | auth |
| `project_context` | `current_files?: { [path]: number[] }`, `project_name?` |
| `user` | `content`, `current_files?`, `additional_files?`, `forced_tools?: MlCopilotTool[]`, `mode?`, `model?`, `reasoning_effort?`, `source_ranges?`, `engine_api_call_id?`, `correlation_id?`, `project_name?` |
| `system` | `command: MlCopilotSystemCommand` |

**Tools the server may run** (`models.ts:4703-4707`):

```ts
type MlCopilotTool =
  | 'edit_kcl_code'
  | 'text_to_cad'
  | 'mechanical_knowledge_base'
  | 'web_search'
```

These tools are **server-side**. The SDK does not implement them; the client only sends `user` / `system` frames.

**System commands** (`models.ts:4695-4701`): `'new' | 'bye' | 'continue' | 'interrupt' | 'cancel' | 'answer_now'`.

**Modes** (`models.ts:4464-4469`): `'fast' | 'thoughtful' | 'auto' | 'zookeeper_pro' | 'zookeeper_ultra'`.

**Server messages** (`models.ts:4489-4550`): `pong`, `session_data`, `conversation_id`, `delta` (streamed text), `tool_output` (`MlToolResult` with `type: 'text_to_cad' | 'edit_kcl_code' | 'mechanical_knowledge_base'`), `error`, `info`, `modes_response`, `backend_shutdown`, `project_updated: { files }`, `reasoning`, `request_attachments`.

Companion: **`ml.ml_reasoning_ws`** → `/ws/ml/reasoning`.

Also on `ml`:

- `create_kcl_code_completions({ client?, body: KclCodeCompletionRequest })` → `POST /ml/kcl/completions` (`create_kcl_code_completions.ts:9-32`). Body is a Copilot-shaped `{ prompt?, suffix?, max_tokens?, n?, stream?, temperature?, top_p?, nwo?, extra? }` (`models.ts:4124-4173`).
- `create_proprietary_to_kcl({ client?, files, code_option? })` → `POST /ml/convert/proprietary-to-kcl` (`create_proprietary_to_kcl.ts:7-46`). **Not ML.** JSDoc: "This endpoint is deterministic, it preserves the original design intent by using the feature tree data. This endpoint does not use any machine learning or AI." Requires feature-tree natives (`.sldprt`, Creo `.prt`, CATIA `.catpart`, NX `.prt`, Fusion `.f3d`). STEP will not work (`:20-24`). Beta, gated.
- `create_custom_model` / `get_custom_model` / `update_custom_model` / `list_org_datasets_for_model` — org-dataset-backed custom models (`create_custom_model.ts:14-31`, `POST /ml/custom/models`).

### 1.5 File conversion (REST, always cloud)

**`file.create_file_conversion`** — `create_file_conversion.ts:10-46`

```ts
async function create_file_conversion({
  client?: Client
  src_format: FileImportFormat
  output_format: FileExportFormat
  body: string  // octet-stream
}): Promise<FileConversion>
```

- `POST /file/conversion/{src_format}/{output_format}`
- Sync if ≤25MB (base64 `output`); async otherwise, poll `/async/operations/{id}` (`:24-28`).

**`file.create_file_conversion_options`** — `create_file_conversion_options.ts:7-38`

```ts
async function create_file_conversion_options({
  client?: Client
  files: File[]
  body: ConversionParams
}): Promise<FileConversion>
```

- `POST /file/conversion` multipart.

**Formats** (`models.ts:3372-3394`):

```ts
type FileExportFormat = 'fbx' | 'glb' | 'gltf' | 'obj' | 'ply' | 'step' | 'stl'
type FileImportFormat =
  | 'acis' | 'catia' | 'creo' | 'fbx' | 'gltf' | 'inventor'
  | 'nx' | 'obj' | 'parasolid' | 'ply' | 'sldprt' | 'step' | 'stl'
```

Mass-props siblings, all `POST` to Zoo, same 25MB async rule:

| Function | Path | Extra args |
|---|---|---|
| `create_file_mass` | `/file/mass` | `src_format`, `material_density`, units (`create_file_mass.ts:11-17`) |
| `create_file_volume` | `/file/volume` | |
| `create_file_density` | `/file/density` | |
| `create_file_surface_area` | `/file/surface-area` | |
| `create_file_center_of_mass` | `/file/center-of-mass` | |

**`executor.create_file_execution`** — `create_file_execution.ts:6-34`: `POST /file/execute/{lang}` — remote "litterbox" exec, tagged `hidden`. Not a local interpreter.

### 1.6 Modeling websocket

**`modeling.modeling_commands_ws`** — class `ModelingCommandsWs` (`modeling_commands_ws.ts:11-80`)

```ts
class ModelingCommandsWs {
  static urlConstructFrom(params: {
    client?: Client
    video_res_width?: number
    video_res_height?: number
    fps?: number
    unlocked_framerate?: boolean
    post_effect?: PostEffectType
    webrtc?: boolean
    pool?: string
    show_grid?: boolean
    replay?: string
    api_call_id?: string
    order_independent_transparency?: boolean
    pr?: number
  }): URL  // wss://api.zoo.dev/ws/modeling/commands?...
  static authenticate(params, ws): void
  static toBSON(data: WebSocketRequest): Uint8Array
  static parseMessage(ev): WebSocketResponse
}
```

JSDoc (`:28-30`): "Pass those commands to the engine via websocket, and pass responses back to the client. Basically, this is a websocket proxy between the frontend/client and the engine."

**Client frames** (`models.ts:12215-12254`): `trickle_ice`, `sdp_offer`, `modeling_cmd_req { cmd: ModelingCmd, cmd_id }`, `modeling_cmd_batch_req`, `ping`, `metrics_response`, `debug`, `headers`.

**`ModelingCmd`** (`models.ts:4836-6725`) is a large tagged union (~150 commands). Geometry / IO that matter to an agent:

| `type` | Meaning |
|---|---|
| `start_path` / `move_path_pen` / `extend_path` / `close_path` | 2D path |
| `extrude` / `extrude_to_reference` / `twist_extrude` / `sweep` / `revolve` / `loft` | solids |
| `solid3d_fillet_edge` / `solid3d_shell_face` / `solid3d_join` / `chamfer…` | features |
| `boolean_union` / `boolean_intersection` / `boolean_subtract` / `boolean_imprint` | CSG |
| `import_files` (`:6241`) | **foreign CAD import on the engine** |
| `export` / `export2d` / `export3d` (`:5360-5383`) | **engine-side export** |
| `mass` / `volume` / `density` / `center_of_mass` / `surface_area` / `bounding_box` | engine mass props |
| `select_with_point` / `select_add` / `select_replace` / `select_clear` | selection |
| `take_snapshot` / `reconfigure_stream` | video / stills |
| `begin_execution` / `end_execution` | render gating |

Export formats on the engine path (`OutputFormat3d`, `models.ts:9114-9200`): `fbx`, `gltf`, `obj`, `ply`, `step`, `stl` — same mesh/BREP set as REST, with per-format `coords` / `units` / `storage`.

**There is no local execute function in the SDK.** An agent that wants solids must (1) open this WS with a Zoo token, (2) send `ModelingCmd`s (usually by running KCL, which emits them), (3) consume video or `export` results.

---

## 2. KCL — KittyCAD Language

### 2.1 Where the parser / interpreter live

Rust, with WASM and Python bindings. All MIT.

| Crate | Path | License | Role |
|---|---|---|---|
| `kcl-lib` 0.2.177 | `modeling-app/rust/kcl-lib` | MIT (`Cargo.toml:6`) | parser, evaluator, stdlib, LSP, docs gen |
| `kcl-syntax` 0.2.177 | `modeling-app/rust/kcl-syntax` | MIT | new lossless lexer (Logos); **parser not done yet** |
| `kcl-wasm-lib` 0.1.177 | `modeling-app/rust/kcl-wasm-lib` | MIT, `publish = false` | `cdylib` WASM bindings |
| `kcl-api` 0.2.177 | `modeling-app/rust/kcl-api` | MIT | shared types |
| `kcl-error` 0.2.177 | `modeling-app/rust/kcl-error` | MIT | errors |
| `kcl-python-bindings` (`zoo-kcl`) | `modeling-app/rust/kcl-python-bindings` | inherits MIT | PyO3 `execute` / `export` / snapshot |
| `kcl-language-server` | `modeling-app/rust/kcl-language-server` | workspace | native LSP binary |

`kcl-lib/src/lib.rs:1-4`: "KCL is written in Rust. This crate contains the compiler tooling (e.g. parser, lexer, code generation), the standard library implementation, a LSP implementation, generator for the docs, and more."

**Parser (production):** winnow combinator parser over a custom token stream.

- `kcl-lib/src/parsing/mod.rs:36-67` — `parse_str` → `token::lex` → `parser::run_parser`.
- `kcl-lib/src/parsing/parser.rs:7-27` — `winnow::combinator::{alt, delimited, ...}`.
- `kcl-lib/src/parsing/token/` — existing scanner ("ES").

**Lexer (next-gen, not yet the runtime parser):** `kcl-syntax/README.md:6-10` — "Lexer first. Keep it compatible with the existing scanner (ES) used by the winnow implementation." `kcl-lib` depends on `kcl-syntax` **only for compatibility tests** (`README.md:10`). Design goal is a lossless CST inspired by rust-analyzer / Roslyn (`README.md:23-25`).

**Highlight grammar (not executable):** Lezer grammar at `modeling-app/packages/codemirror-lang-kcl/src/kcl.grammar:16-71` (`@top Program`, `fn`/`import`/`sketch`/`|>`, etc.). Used by CodeMirror only.

**Interpreter:** `kcl-lib/src/execution/` — AST walk (`exec_ast.rs`), memory, artifact graph, then **emit `ModelingCmd` to an `EngineTransport`**. Stdlib in `kcl-lib/src/std/` (`extrude`, `fillet`, `csg`, `sketch`, `loft`, `revolve`, `sweep`, `helix`, `gdt`, …). ~201 markdown pages under `modeling-app/docs/kcl-std/functions/`.

**WASM surface** (`kcl-wasm-lib/src/wasm.rs:44-71`, `context.rs:128-217`):

- `parse_wasm(source) -> (Program, errs)`
- `recast_wasm(astJson) -> string` (formatter)
- `kcl_lint(...)`
- `Context.execute(astJson, path, settings)` — **real engine**
- `Context.executeMock(...)` — no engine commands
- plus sketch-edit / project APIs in `api.rs`

**Standalone CLI:** `kcl-lib/src/main.rs:15-60` — `cargo run -- foo.kcl` parses, then `ExecutorContext::new_with_client` (requires `ZOO_API_TOKEN`) and `ctx.run`.

**Python:** `zoo-kcl` (`kcl.pyi:69-80`) exposes `execute`, `execute_code`, `execute_and_export`, `execute_and_snapshot`, `execute_and_measure`, … . Implementation (`kcl-python-bindings/src/lib.rs:236-239`) calls `ExecutorContext::new_with_client` unless `mock=true`. Same token requirement.

### 2.2 Is it usable standalone?

| Capability | Offline? | Evidence |
|---|---|---|
| Lex / parse / format / lint | **Yes** | `parse_wasm`, `recast_wasm`, `kcl_lint`; no network |
| CodeMirror highlighting | **Yes** | `kcl.grammar` |
| KCL LSP (hover, diagnostics) | **Mostly yes** | `kcl-lib/src/lsp/kcl/` |
| Copilot ghost-text LSP | **No** | `lsp/copilot/mod.rs:213-217` calls `zoo_client.ml().create_kcl_code_completions` |
| 2D sketch constraint solve | **Yes (local crate)** | `ezpz` 0.2.29 (`Cargo.toml:27`), used in `execution/sketch_solve.rs:5,44` |
| Mock execute (AST / types, no solids) | **Yes** | `ExecutorContext::new_mock`, `no_engine_commands()` (`execution/mod.rs:1168-1171`) |
| Real execute / export / import / snapshot | **No** | `ExecutorContext::new` opens `client.modeling().commands_ws(...)` (`execution/mod.rs:1022-1047`) and **errors if no `ZOO_API_TOKEN`** (`engine/mod.rs:214-216`) |

`EngineTransport` (`engine/engine_manager/engine_transport.rs:14-17`) documents the two real implementations: "1. native code on x86/arm with network access  2. wasm in the browser sandbox, using wasm-bindgen to get a handle for sending and receiving data over the websocket." There is no third "local kernel" transport. `MockTransport` (`mock_transport.rs:22`) "Doesn't actually connect to the engine" and returns empty successes.

### 2.3 What the language looks like

Representative sample, `modeling-app/public/kcl-samples/bracket/main.kcl:5-119` (shelf bracket, units + constrained sketch + extrude + fillet):

```kcl
@settings(defaultLengthUnit = in, kclVersion = 1.0)

allowableStress = 35000
appliedLoad = 300
factorOfSafety = 1.2
bracketWidth = 5.0
shelfLegLength = 5.0
// ... derived thickness ...

bracketProfileSketch = sketch(on = XZ) {
  line1 = line(start = [var -0.29in, var 1.23in], end = [var -0.28in, var 3.34in])
  line2 = line(start = [var 0in, var 0in], end = [var 4.69in, var 3.79in])
  coincident([line1.end, line2.start])
  // ...
  horizontal(line2)
  vertical(line1)
  horizontalDistance([line2.start, line2.end]) == shelfLegLength
}

bracketProfileRegion = region(segments = [bracketProfileSketch.line1])
bracketBlank = extrude(
  bracketProfileRegion,
  length = bracketWidth,
  symmetric = true,
  tagEnd = $bracketEndFace,
  tagStart = $bracketStartFace,
)
bracketWithInsideFillet = fillet(bracketBlank, tags = getCommonEdge(...), radius = insideBendRadius)
```

Language shape (from `docs/kcl-lang/index.md` + grammar):

- Python-adjacent: `fn`, `import`, labeled args, `if/else` expressions, pipes `|>` and `%` (`parsing/mod.rs:15-16`).
- Units in literals (`5.0` vs `0.29in`).
- First-class `sketch(on = Plane) { ... }` blocks with geometric constraints (`coincident`, `horizontal`, `==` on distances).
- Tags (`$bracketEndFace`) to name topology for later features.
- Foreign import: `import "cube.step" as cube` (`docs/kcl-lang/foreign-imports.md:10-19`).

Docs: `modeling-app/docs/kcl-lang/` (language) + `docs/kcl-std/` (201 functions, 38 types, 24 consts). Samples: `public/kcl-samples/` (~122 `.kcl`).

### 2.4 Could an LLM target it?

**Yes, and Zoo already does.** Evidence:

1. Language is small, documented, and designed as the source of truth (`README.md:11-14`: "All artifacts… should be represented as human-readable code").
2. Official agent (Zookeeper) generates and edits KCL via `/ws/ml/copilot` (`zookeeperManagerMachine.ts:1294-1310`).
3. REST `create_text_to_cad(..., kcl=true)` returns KCL (`create_text_to_cad.ts:36`).
4. Copilot LSP already completes KCL from `prompt`/`suffix` (`lsp/copilot/mod.rs:190-223`).
5. Selection→prompt plumbing injects KCL idioms into hidden source-range prompts, e.g. `sketch(on = faceOf(someSweepVariable, face = END))` (`zookeeperPromptRequest.ts:160-167`).
6. Hundreds of samples + stdlib docs are a ready fine-tune / RAG corpus.

Caveats for an LLM:

- Sketch-block constraint dialect (`var`, `coincident`, `horizontalDistance(...) == x`) is newer and less like Python.
- Execution is not local: generated KCL is useless as geometry without Zoo's engine (or a reimplementation of `ModelingCmd`).
- Feature-tree import of proprietary CAD is a separate gated cloud endpoint, not something an LLM in-process can do.

### 2.5 Grammar / spec files

| Artifact | Kind |
|---|---|
| `packages/codemirror-lang-kcl/src/kcl.grammar` | Lezer highlight grammar (not executable spec) |
| `rust/kcl-lib/src/parsing/parser.rs` + `token/` | Production grammar (winnow) |
| `rust/kcl-syntax/src/lexer.rs` | Next lexer (Logos); parser TBD |
| `docs/kcl-lang/*.md` | Human language reference |
| `docs/kcl-std/**` | Generated stdlib docs (`just redo-kcl-stdlib-docs`) |
| `kcl-lib` `schemars` / `ts-rs` bindings | TS types under `rust/kcl-lib/bindings/` |

There is **no** PEG/ANTLR/tree-sitter grammar checked in. The Lezer file is the closest standalone grammar.

---

## 3. The engine split (the critical boundary)

### 3.1 What runs locally

```
┌─────────────────────────────────────────────────────────────────┐
│  modeling-app (Electron / browser)                              │
│  ┌──────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ CodeMirror   │  │ Feature tree│  │ Three.js ClientSideScene│ │
│  │ + KCL LSP    │  │ (ops list)  │  │ sketch overlays / gizmos│ │
│  └──────┬───────┘  └──────▲──────┘  └────────────▲────────────┘ │
│         │ parse            │ artifact graph       │ mouse       │
│  ┌──────▼──────────────────┴──────────────────────┴───────────┐ │
│  │ kcl-wasm-lib  (Rust → WASM)                                │ │
│  │   parse / recast / lint / execute (emits ModelingCmd)      │ │
│  │   ezpz 2D sketch solver                                    │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │ fireModelingCommandFromWasm       │
│  ┌──────────────────────────▼─────────────────────────────────┐ │
│  │ EngineCommandManager  (TS)                                 │ │
│  │   WebSocket + WebRTC  →  wss://api.{zoo}/ws/modeling/...   │ │
│  └────────────────────────────────────────────────────────────┘ │
│  <video id="video-stream">  ← MediaStream from engine           │
└─────────────────────────────────────────────────────────────────┘
```

Local:

- KCL compiler + stdlib dispatch + artifact graph (`kcl-lib`).
- 2D constraint solver (`ezpz`).
- Code editor, feature tree UI, project files, command bar.
- Sketch overlays in Three.js (`src/clientSideScene/`), gizmos (`src/components/gizmo/`).
- WASM LSP (`kcl-wasm-lib/src/lsp.rs`).
- Freeze-frame `<canvas id="freeze-frame">` when the stream drops (`ConnectionStream.tsx:587-594`).

### 3.2 What runs on Zoo's servers

Everything that touches BREP/mesh/pixels:

1. **Geometry kernel + GPU renderer.** Not in either checkout. No OCCT, no Parasolid, no kernel crate. Workspace depends on `kittycad-modeling-cmds` (the **command protocol**, `Cargo.toml:32-35`) and the `kittycad` HTTP/WS client — not an engine binary.
2. **Import of STEP/STL/GLTF/OBJ/SLDPRT/…** — KCL reads the file from disk locally, then sends `ModelingCmd::ImportFiles` (`execution/import.rs:38-131`). Conversion happens on the engine.
3. **Export** — `rustContext.export` → WASM `instance.export` → engine `export` / `export3d` (`rustContext/index.ts:201-213`; `modelingMachine.ts:4492-4597`). DXF is engine `export2d` (`exportDxf.ts:188-194`).
4. **Video frames** — WebRTC `MediaStream` attached to `<video id="video-stream">` (`ConnectionStream.tsx:577-586`). Connection setup is WS + ICE + WebRTC (`useNetworkStatus.tsx:62-64` groups: WebSocket / ICE / WebRTC).
5. **ML / Zookeeper / completions / proprietary-to-KCL.**

WASM transport is a **bridge**, not a kernel (`engine_manager/wasm_transport.rs:22-46`):

```22:46:modeling-app/rust/kcl-lib/src/engine/engine_manager/wasm_transport.rs
#[wasm_bindgen(module = "/../../src/lib/engineConnection/connectionManager.ts")]
extern "C" {
    pub type EngineCommandManager;
    fn fire_modeling_cmd_from_wasm(...);
    fn send_modeling_cmd_from_wasm(...);
    fn start_new_session(...);
}
```

Native execute (`execution/mod.rs:1022-1047`):

```rust
let (ws, _headers) = client.modeling().commands_ws(CommandsWsParams {
    webrtc: Some(false),  // headless: commands only, no video
    ...
}).await?;
let engine_conn = EngineManager::new_websocket_transport(ws, settings.heartbeats).await;
```

Token required (`engine/mod.rs:214-216`): `"No API token found in environment variables. Use ZOO_API_TOKEN"`. Host overridable via `ZOO_HOST` / `KITTYCAD_HOST` / `engine_addr` (`:221-238`) — so you *could* point at a self-hosted API **if you had one**. These repos do not ship that server.

### 3.3 Can `modeling-app` run fully offline?

**No.** Auth + engine + ML all require the network.

- `useAuthNavigation.tsx:38-47` — `loggedOut` (no token) **always navigates to `PATHS.SIGN_IN`**. The workbench is not reachable without a Zoo session.
- Sign-in talks to `api.{domain}` (`SignIn.tsx` + `generateSignInUrl`).
- Engine URL is derived from the signed-in environment: `wss://api.${baseDomain}/ws/modeling/commands` (`env.ts:7-10`). Desktop can override per-environment (`env.ts:90-107`, `authMachine.ts:302-318`) — still a remote WS.
- Offline exits sketch mode (`useOnOfflineToExitSketchMode`); `NetworkHealthState.Disconnected` when `!internetConnected` (`useNetworkStatus.tsx:102-103`).
- CONTRIBUTING (`CONTRIBUTING.md:72-76`): a local desktop build still "point[s] to our production zoo.dev infrastructure".

**Operations that require the network (exhaustive from these trees):**

| Operation | Why |
|---|---|
| Sign in / stay signed in | `authMachine` `getUser` hits Zoo |
| Open a project and see 3D | WebRTC video from engine |
| Execute KCL (non-mock) | every stdlib solid/sketch-on-face/import emits `ModelingCmd` |
| Import STEP/STL/GLTF/OBJ/SLDPRT/FBX/PLY | `ImportFiles` on engine |
| Export glTF/OBJ/STL/STEP/PLY/DXF | engine `export` / `export2d` / `export3d` |
| Mass / volume / CoM | engine cmds or REST `/file/*` |
| Zookeeper / text-to-CAD / completions | `/ws/ml/copilot`, `/ml/*` |
| Copilot ghost text | LSP → `/ml/kcl/completions` |
| Proprietary-to-KCL | `/ml/convert/proprietary-to-kcl` |
| Cloud projects / billing / datasets | REST |

**Operations that work offline (once the WASM blob is on disk):**

| Operation | Why |
|---|---|
| Edit `.kcl` text | CodeMirror + local files |
| Parse / format / lint | WASM |
| 2D constraint solve in sketch (numeric) | `ezpz` |
| Mock-execute (no solids) | `executeMock` |
| Feature-tree / editor layout chrome | React, no engine |
| Highlight / recast | local |

You can stare at KCL and get diagnostics. You cannot produce or view a solid.

---

## 4. Agent surfaces

**No MCP server** in either checkout (`rg mcp|MCP` over `*.{ts,tsx,md,rs,json,toml}` → zero hits).

### 4.1 Zookeeper (rebrand of ML-ephant)

This is the in-app agent. Legacy env name still accepted: `VITE_MLEPHANT_WEBSOCKET_URL` (`env.ts:21-22, 219-221`). Test IDs still say `ml-ephant-conversation-input` (`e2e/.../copilotFixture.ts`).

- UI pane: `src/lib/zookeeper/components/ZookeeperConversationPane.tsx`
- Layout id: `DefaultLayoutPaneID.Zookeeper = 'ttc'` (`layout/configs/default.ts:24`)
- Onboarding routes: `/desktop/text-to-cad`, `/desktop/text-to-cad-prompt` (`onboardingPaths.ts:14-15,52-53`)
- Machine: `zookeeperManagerMachine.ts` — opens `wss://api.{domain}/ws/ml/copilot`, sends JSON `MlCopilotClientMessage`

**What the app actually sends** (`zookeeperManagerMachine.ts:1294-1310`):

```ts
const request: MlCopilotUserRequest = {
  type: 'user',
  ...createZookeeperCorrelation(event.engineCommandManager.apiCallId),
  content: requestData.body.prompt ?? '',
  project_name: requestData.body.project_name,
  source_ranges: requestData.body.source_ranges,
  current_files: filesAsByteArrays,  // entire project, uint8[]
  active_file: requestData.activeFile,
  mode: event.mode,
  additional_files: additionalFiles,  // images / PDFs
}
context.ws.send(JSON.stringify(request))
```

**Hidden selection prompts** (not shown to the user — `zookeeperPromptRequest.ts:53-55`):

```
"This is the source range for the user's selected ${artifact.type} artifact."
"The user's main selection is the end cap of a general sweep...
  use ... sketch(on = faceOf(someSweepVariable, face = END)) { ... }"
"The user's main selection is the wall of a general sweep...
  add a tag ... sketch(on = faceOf(..., face = someRegion.tags.segmentTag))"
```

(`zookeeperPromptRequest.ts:146-202`)

**No client-side system prompt** for the model. The prompt lives on Zoo's copilot backend. The client only sends user text + files + source ranges + optional `forced_tools`.

Local override documented in the command bar (`applicationCommandConfig.ts:523-524`):

```
Locally-running Zookeeper: **ws://localhost:8080/ws/ml/copilot**
Pull Requests: **wss://api.dev.zoo.dev/ws/ml/copilot?pr=NUMBER**
```

That implies Zoo has an internal copilot service you can run locally **if you have their backend**. It is not in these two repos.

### 4.2 Copilot LSP (ghost text)

`kcl-lib/src/lsp/copilot/mod.rs` + WASM `lsp_run_copilot` (`kcl-wasm-lib/src/lsp.rs:91-121`). Custom LSP methods: `copilot/setEditorInfo`, `copilot/getCompletions`, `copilot/notifyAccepted`, `copilot/notifyRejected`. Completions are **Zoo REST**, not local (`create_kcl_code_completions`, max_tokens 500, temperature 1.0 — `copilot/mod.rs:190-223`).

### 4.3 What an external agent should call

If using Zoo cloud, the agent surface **is** `@kittycad/lib`:

1. Preferred: `ml.ml_copilot_ws` with `type: 'user'` + `current_files` + `forced_tools`.
2. Legacy: `ml.create_text_to_cad` / `_iteration` / `_multi_file_iteration`.
3. Geometry: `modeling.modeling_commands_ws` or (better) run KCL via `kcl-lib` / `zoo-kcl`, which opens that WS for you.
4. Files: `file.create_file_conversion` or engine `export`.

There is no tool-schema JSON for MCP. The closest "tool schema" is `MlCopilotTool` + `MlCopilotClientMessage` in `models.ts`.

---

## 5. File format I/O

Two clouds paths, zero local kernels.

### 5.1 REST conversion (no live session)

`file.create_file_conversion` / `_options` — any `FileImportFormat` → any `FileExportFormat`. Includes **ACIS, CATIA, Creo, Inventor, NX, Parasolid** on the import side (`models.ts:3381-3394`). Those extra CAD natives are **REST-only**; KCL's local `import` matcher does not accept them.

### 5.2 Engine import (KCL `import "file.ext"`)

Local: read bytes from the project FS (`import.rs:71-76`).
Remote: `ImportFiles { files, format }` (`import.rs:125-130`).

Extensions handled locally (`import.rs:330-388`): `step`/`stp`, `stl`, `obj`, `gltf`/`glb`, `ply`, `fbx`, `sldprt`. Default units mm, Zoo coords (−Y forward, +Z up). GLTF also pulls sibling `.bin` (`import.rs:94-119`).

Docs (`foreign-imports.md:33-34`): "Imports currently only work when using the native Design Studio, not in the browser." (desktop FS, not a local kernel.)

### 5.3 Engine export (current scene)

Command palette `Export` (`modelingCommandConfig.ts:420-435`) offers glTF / OBJ / STL / STEP / PLY. Implementation: `rustContext.export` → engine (`modelingMachine.ts:4590-4597`). DXF sketches: `export2d` (`exportDxf.ts:188-194`).

### 5.4 Proprietary feature-tree → KCL

`ml.create_proprietary_to_kcl` — SolidWorks / Creo / CATIA / NX / Fusion with feature trees. Cloud, gated, deterministic. Not in the engine session; not local.

### 5.5 What is *not* implemented locally

No local STEP reader, no local STL tessellator beyond passing bytes through, no OCCT, no glTF writer that doesn't ask the engine. The app can zip a project (`downloadProject`) and save whatever the engine returned (`browserSaveFile`). That is transport, not conversion.

---

## 6. Licenses

| Artifact | License | File |
|---|---|---|
| `kittycad.ts` / `@kittycad/lib` | **MIT**, Copyright (c) 2022 KittyCAD | `kittycad.ts/LICENSE:1-21`, `package.json:82` |
| `modeling-app` / Zoo Design Studio | **MIT**, Copyright (c) 2023 The Zoo Authors | `modeling-app/LICENSE:1-21`, `package.json:13` |
| `kcl-lib`, `kcl-api`, `kcl-error`, `kcl-syntax`, `kcl-wasm-lib` | **MIT** | each `Cargo.toml` `license = "MIT"` |
| `zoo-kcl` (Python) | no SPDX in `pyproject.toml`; crate path is MIT | `kcl-python-bindings/pyproject.toml` |

**Not AGPL.** No COPYING / GPL file in either tree (depth-3 search).

### Contamination risk for a proprietary desktop app

**Source license is clean.** MIT lets you vendor the TS SDK, the KCL compiler, the editor, the layout system, into a closed-source desktop app if you keep copyright notices.

**That is not permission to run Zoo's engine or ML.** The kernel, the copilot backend, and the conversion farm are not in these trees. Using them is API ToS + billing (`payments/` is 41 endpoints). Pointing `ZOO_HOST` at a self-hosted clone only works if you independently possess Zoo's server.

**Practical contamination, not legal:**

- Shipping `kcl-lib` + UI is fine.
- Shipping generated `@kittycad/lib` and calling `api.zoo.dev` from a patent-figure tool **sends geometry and prompts to Zoo**. That is a confidentiality problem, not an MIT problem.
- `kcl-wasm-lib` is `publish = false` but still MIT in-tree.
- `kittycad-modeling-cmds` and `ezpz` are separate published crates (also Zoo); check those crates' licenses before vendoring. They are **not** the kernel.

No OCCT (or any other kernel) appears anywhere in these checkouts (`rg OCCT|OpenCASCADE` → empty). You cannot accidentally AGPL-contaminate via OCCT from this tree.

---

## 7. UI/UX patterns worth stealing

Zoo's workbench is a **code-first CAD IDE**: video viewport in the center, dockable panes, command palette, dual selection (code range ↔ engine entity). Glossary: `modeling-app/GLOSSARY.md`.

### Layout

| Piece | File |
|---|---|
| Default layout (left pane stack: Feature Tree + Bodies, Code, Files, Variables, Logs, Debug; Zookeeper on mobile) | `src/lib/layout/configs/default.ts:19-120` |
| Area registry (maps pane ids → React) | `src/lib/layout/defaultAreaLibrary.tsx:1-26` |
| Workspace shell (header + layout + status bar) | `src/components/OpenedProject.tsx` |
| Dockable pane chrome | `src/components/layout/Panel/index.tsx` |
| Viewport = `<video>` + freeze canvas + Three overlay | `src/components/ConnectionStream.tsx:564-599` |
| Client-side sketch overlay / constraint chips | `src/clientSideScene/ClientSideSceneComp.tsx` |
| Gizmo (axis + cube) | `src/components/gizmo/{Gizmo,AxisGizmo,CubeGizmo}.tsx` |
| Toolbar (state-dependent sketch vs model) | `src/Toolbar.tsx`, `src/lib/toolbar` |
| Status bar (global network / local selection) | `src/components/StatusBar/` |
| Network health (WS / ICE / WebRTC steps) | `src/components/NetworkHealthIndicator.tsx`, `hooks/useNetworkStatus.tsx` |

`DefaultLayoutPaneID` (`default.ts:19-27`): `debug | code | feature-tree | files | ttc | variables | logs`. Feature tree is a split: operations list 70% + bodies 30% (`default.ts:44-65`).

### Command palette

- Hotkey `mod+k` (`CommandBar.tsx:17`).
- XState machine + Headless UI `Popover` (deliberately **not** light-dismiss — `CommandBar.tsx:37-46`).
- Commands are typed configs: `src/lib/commandBarConfigs/modelingCommandConfig.ts` (Export, sketch tools, stdlib ops), `applicationCommandConfig.ts`, `modelingCommandStdLib.ts`.
- Argument widgets: options, KCL expression input (`CommandBarKclInput.tsx`), selection picker (`CommandBarSelectionInput.tsx`), vectors, path, review / codemod diff (`CommandBarReview.tsx`, `CodemodReviewDiff.tsx`).
- Modeling actions are **codemods on the KCL AST**, not silent kernel ops (`modelingMachine.ts` `*AstMod` actors). Point-and-click writes code. That is the pattern to steal.

### Selection model

Dual graph (`machines/modelingSharedTypes.ts:60-70`):

```ts
type Selection = {
  artifact?: Artifact          // engine / artifact-graph node
  codeRef: CodeRef             // source range in KCL
  engineEntityId?: ArtifactId
  patternIndex?: number
}
type Selections = {
  graphSelections: Selection[]           // code-backed
  otherSelections: NonCodeSelection[]    // axes, default planes, engine primitives/regions
}
```

- Click in viewport → `select_with_point` on the engine → map to artifact → `codeRef` (`src/lib/selections.ts:2034+`).
- Click in feature tree → `sendSelectionEvent` → `Set selection` / `singleCodeCursor` + `scrollIntoView` (`featureTree.ts:164-193`).
- Click in editor → CodeMirror ranges → same `Selections`.
- Zookeeper reads `Selections` and turns them into `source_ranges` prompts (`zookeeperPromptRequest.ts`).

### Feature tree

- Built from KCL **operations** (not a proprietary history file): `src/lib/featureTreeOperationTree.ts`, pane `FeatureTreePane.tsx`.
- Visibility toggle, edit-in-place (re-opens the command that created the op), delete via AST (`featureTree.ts` `prepareEditCommand` / `sendDeleteCommand`).
- Bodies list is a sibling pane (`BodiesPane.tsx`).

### Editor

- CodeMirror 6 + custom KCL lang (`packages/codemirror-lang-kcl`) + WASM LSP (`packages/codemirror-lsp-client`, `src/editor/`).
- Format `alt+shift+f`, convert-to-variable `ctrl+shift+c` (`KclEditorPane.tsx:50-57`).
- Project explorer is a real filesystem tree (`Explorer/ProjectExplorer.tsx`) — desktop-native, not a fake buffer list.

### State

XState everywhere: `modelingMachine.ts` (huge), `commandBarMachine`, `authMachine`, `systemIOMachine`, `zookeeperManagerMachine`. Registry/plugin layer under `src/registry/` for commands, keymap, status bar, engine scene extensions.

**Steal for a CAD panel inside another desktop app:** the pane layout + command palette + AST-backed feature tree + dual selection. Do **not** steal the `<video>` viewport unless you also take Zoo's engine; replace it with a local renderer (Three / VTK / OCCT mesh).

---

## 8. Verdict

### Decisive fact

**These two checkouts contain a language, an IDE, and a typed cloud client. They do not contain a geometry kernel.** Every solid, import, export, screenshot, and pixel of the 3D view is produced by Zoo's hosted engine behind `wss://api.zoo.dev/ws/modeling/commands`. WASM `execute` only serializes `ModelingCmd`s and waits. `MockTransport` returns empty successes. `rg OCCT` is empty.

### Ranked options

#### 1. (a) Use Zoo's cloud API — **best if you accept cloud + ToS**

**Use when:** you want text-to-CAD / KCL-edit / STEP↔STL↔glTF **this quarter**, and sending part geometry + prompts off-box is acceptable.

**Evidence it works for an agent:**

- `@kittycad/lib` is MIT, generated, complete: `ml.ml_copilot_ws`, `ml.create_text_to_cad*`, `file.create_file_conversion`, `modeling.modeling_commands_ws`.
- `zoo-kcl` / `kcl-lib` will execute KCL for you if `ZOO_API_TOKEN` is set (`execution/mod.rs:1022-1047`, `engine/mod.rs:214-216`).
- Formats you asked about (STEP / STL / GLTF / OBJ) are first-class on both REST and engine export (`models.ts:3372-3379`, `9114-9200`).
- Agent protocol is already typed (`MlCopilotClientMessage`, `forced_tools`, `project_updated`).

**Cost:** token, billing (`payments/` × 41), **every model and prompt leaves the machine**, no offline workbench (`useAuthNavigation.tsx:38-47`), video-stream UX if you embed Design Studio. For patent-figure / unpublished work this is a confidentiality fail, independent of MIT.

#### 2. (c) Ignore Zoo's engine; use an OCCT-based stack — **best if you need offline + ownership**

**Use when:** the product is a proprietary desktop app that must not ship unpublished geometry to a third party, must run offline, and must own STEP/STL I/O.

**Evidence Zoo cannot replace OCCT here:**

- No kernel in tree. Engine is a hosted GPU service (`README.md:16-24`).
- Local import is "read bytes, `ImportFiles` to cloud" (`import.rs:71-131`).
- Local export is "ask engine, save bytes" (`modelingMachine.ts:4590-4604`).
- Mock execute cannot produce meshes.

**What to take from Zoo anyway:** KCL as a *language design* (plain-text CAD, pipes, units, sketch constraints, tags) and the IDE patterns in §7. An LLM can emit KCL-like or OCCT-Python/C++ instead. Do not execute Zoo KCL against OCCT without a new backend — the stdlib is `ModelingCmd`-shaped, not OCCT-shaped.

#### 3. (b) Vendor / self-host *parts* of Zoo — **useful for language + UI, not for solids**

**Legally vendable (MIT):**

- `kcl-lib` parser / formatter / linter / LSP / stdlib *dispatch*
- `kcl-syntax` lexer
- `kcl-wasm-lib` (in-tree)
- CodeMirror KCL + layout + command bar + feature tree
- `@kittycad/lib` as an optional cloud adapter
- `ezpz` sketch solver (separate crate; verify its license)

**Not vendable from these checkouts because they are not here:**

- The geometry engine
- The copilot / text-to-CAD backend (only a `localhost:8080` URL hint)
- REST conversion farm (ACIS/CATIA/NX/Parasolid)

**Self-host story:** `ZOO_HOST` / `KITTYCAD_HOST` / desktop env overrides exist (`engine/mod.rs:221-238`, `env.ts:90-107`). That is a hook for Zoo employees with `api-deux`. It is not a shippable engine. Reimplementing `ModelingCmd` (~150 ops including BREP fillet/loft/boolean/STEP) is a multi-year kernel project.

### Recommendation for this study (agentic CAD / patent tooling)

- **Kernel + file I/O:** (c) OCCT (or similar) on-device. Zoo does not give you an offline STEP/STL path.
- **Agent loop:** do **not** depend on Zookeeper for unpublished work. If you want to *evaluate* Zoo's text-to-CAD quality, use (a) `ml.ml_copilot_ws` / `create_text_to_cad` against public/non-confidential prompts only.
- **UI:** vendor ideas, not the `<video>` stream. Steal command palette + AST feature tree + dual selection.
- **Language:** KCL is a strong LLM target and MIT; executing it without Zoo means writing a new backend. Cheaper to have the LLM emit the kernel API you actually own.

**Do not plan on "running Zoo offline."** The code is unambiguous: Design Studio without `api.zoo.dev` (or a Zoo-internal clone of that API) is a KCL text editor with a dead viewport.
