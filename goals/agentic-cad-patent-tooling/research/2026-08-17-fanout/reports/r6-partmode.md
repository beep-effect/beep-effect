# r6 — PartMode (BOMWiki/partmode) repo archaeology

**Target:** `~/YeeBois/research/CAD_STUFF/partmode`  
**Remote:** `github.com/BOMWiki/partmode` (`origin` on `main`)  
**On-disk HEAD:** `0144dad` *Prepare the public contributor launch* (2026-08-11), tag `source-snapshot-2026-08-11`. Parent commit `8db0b80` *PartMode* (2026-08-07) is the initial dump. Two commits total.  
**Product version:** `package.json` `8.0.0`; agent protocol still advertises studio `7.1.0`.  
**License:** AGPL-3.0-only. README copyright line: “Copyright © 2026 Sphinx.”  
**Checkout size:** ~31 MB, of which ~12 MB is vendored OCCT WASM + three.js + replicad.  
**Method:** read-only source inspection. No build, install, or run. No `node_modules`. Citations are `path:LINE` against this checkout.

---

## 1. WHAT IS IT

PartMode is a **self-hosted, browser-local parametric mechanical CAD application** with a **typed agent protocol** and an optional **hosted MCP + headless kernel**. It is not a mesh generator, not a text-to-CAD LLM, and not a BOM-Wiki product. The README’s “BOMWiki organization is the administrative home… PartMode does not depend on BOMWiki applications” is accurate (`README.md:119-121`).

**Who the user is**

- A **human mechanical designer** who wants SolidWorks-like parts / assemblies / drawings in a browser, no desktop CAD install (`README.md:10-15`, `src/page.html:5-7`).
- An **external coding agent** (Codex, Claude, etc.) that speaks MCP. The product never calls an LLM. The agent is the client; PartMode is the CAD server (`docs/help/agents.md:1-4`, `src/mcp.ts:43-187`).
- Optionally an **account owner** who issues revocable `pmak_v1_*` agent keys and may grant unattended server-headless storage (`src/account-store.ts:11`, `src/account-store.ts:23-72`).

**The job**

1. Author a **schema-5 JSON project**: parameters + feature history + multi-body parts + assemblies + mates + drawings (`src/static/studio-project-v5.js:54-88`, `src/static/studio.js:1-11`).
2. Evaluate that history through **OpenCascade WASM (replicad)** into **exact B-rep solids**, not just a display mesh (`src/static/studio-kernel.worker.js:1-6`, `src/static/studio-brep-evidence.js:1-10`).
3. Let a human **or** a permissioned agent mutate the same document via **preview then commit** against an explicit revision (`docs/architecture.md:1-6`, `src/static/studio-agent-service.js:3415-3928`).
4. Export **STEP / STL / AMF / 3MF / SVG / DXF / PDF**, produce **assembly BOM + balloons**, and optionally persist a **PDM graph** inside `project.extensions` (`src/mcp.ts:131-165`, `src/static/studio-assembly-drawing-plan.js:1-8`, `src/static/studio-pdm.js:3-4`).

The in-product title is “CLI-native agentic browser CAD” (`src/page.html:7`, `src/page.html:34`). The architecture doc is more precise: two authoring surfaces (human UI + typed operations), one document/geometry boundary (`docs/architecture.md:3-6`).

This is **real product source**, not a research demo. The public git history is a snapshot (`CHANGELOG.md:3-5`), but the snapshot is a complete CAD studio: ~96k lines of first-party JS/TS excluding vendor, a 13.5k-line OCCT worker, 119 smoke harnesses, and a 20,000-edit mutation oracle.

---

## 2. ARCHITECTURE

### Shape of the repo

| Path | Role | Size (approx.) |
| --- | --- | --- |
| `src/page.html` | Visible CAD shell | 1,470 lines |
| `src/static/studio.js` | Browser coordinator (document, worker, UI, recovery, agent) | 25,902 lines — ROADMAP names this as the extraction target (`ROADMAP.md:52`) |
| `src/static/studio-*.js` | Feature/assembly/drawing/topology/PDM modules | dozens of files; `studio-v5-runtime-document.js` 4,589; `studio-agent-service.js` 3,928; `studio-project-v5.js` 3,115 |
| `src/static/studio-kernel.worker.js` | Isolated OCCT rebuild / import / export / drawing / inspect | 13,527 lines |
| `src/static/vendor/` | replicad 0.23.1, `replicad_single.wasm` (~11 MB), three.js r178 | LGPL-2.1+exception / MIT |
| `src/server.ts` | Node 22 HTTP product: static app + accounts + MCP + relay + headless | 1,326 lines |
| `src/mcp.ts` | Hosted MCP JSON-RPC (protocol `2025-11-25`) | 608 lines |
| `src/relay-hub.ts` | Browser-tab relay for approved agent sessions | 906 lines |
| `src/headless-sessions.ts` + `src/headless/*` | Server-side CadCommandService + shared WASM kernel | 660 + 135 + 188 |
| `src/account-store.ts` | SQLite accounts, agent keys, durable headless projects | 1,116 lines |
| `src/help.ts` | Help resources also served as MCP `resources/*` | 318 lines |
| `scripts/` | 119 TypeScript smoke / regression / mutation harnesses | — |
| `tests/` | Hand-auditable `.partmode.json` corpus + fixtures | 16 files |
| `docs/` | Architecture, drawing, PDM, sheet-metal, agent help | — |

There is **no** `src/` TypeScript CAD kernel. The CAD kernel is **JavaScript modules loaded in a worker** (browser) or the same modules imported under Node (headless, `src/headless/agent-host.ts:1-9`). TypeScript is the **server, MCP, accounts, and smoke harnesses**. `package.json` has one runtime dependency: `openid-client` 6.8.4. Everything else is vendored static assets plus Node 22 built-ins (`node:sqlite`, `node:http`, `node:crypto`).

### Runtime topology

From `docs/architecture.md:8-20` and the code:

```
Human UI  (page.html + studio.js)
    \                              CadCommandService
     -->  schema-5 document  -->  (studio-agent-service.js)
MCP client --> server.ts/mcp.ts         |
                 |                      v
                 +--> RelayHub -------> studio-kernel.worker.js
                 |    (browser-approved)         |
                 +--> HeadlessSessionManager     v
                      (server WASM)       replicad + OCCT WASM
                                                 |
                                                 v
                                          exact B-rep + STEP/HLR
```

**Entry points**

- Browser product: `npm start` → `node dist/server.js` on `127.0.0.1:4401` (`README.md:61-68`, `package.json:20`). Default is local-first; no account required (`src/static/studio.js:1`).
- HTTP routes (`src/server.ts:1006-1028`): `/` studio, `/help` `/about` `/privacy` `/cookies` `/account`, `/mcp` MCP, `/auth/google/*` OIDC, `/api/v1/help`, `/api/v1/studios/{register,poll,respond,unregister}`, `/api/v1/{account,accounts,session,agent-keys,...}`.
- Hosted MCP: `https://partmode.com/mcp` with bearer `PARTMODE_AGENT_KEY` (`docs/help/agents.md:29-31`).
- Local pairing: in-app “Connect local agent” loopback (`docs/help/agents.md:109-113`).
- Headless: `partmode_headless_open` loads `studio-agent-service.js` in-process and talks to a shared WASM kernel (`src/headless/agent-host.ts:55-107`).
- Add-in: `globalThis.PartModeAddins`, trusted local `.mjs`/`.js` modules, `partmode.addin/v1` (`docs/addin-api.md:1-5`).

**What it is, taxonomically:** a **web app + HTTP server + MCP server + optional headless CAD runtime**. Not a library you import. Not a CLI CAD kernel. Not an LLM agent loop.

**Two authority paths, deliberately different** (`docs/help/agents.md:6-16`, `docs/architecture.md:60-62`):

| | Browser-approved | Server-headless |
| --- | --- | --- |
| Storage | IndexedDB on the device (`src/static/studio.js:10-11`) | SQLite under the account (`src/headless-sessions.ts:1-11`) |
| Consent | Visible tab approval every session | Per-key grant at key creation; cannot be added later |
| Preview | Visible browser preview | Typed kernel preview only; not human approval |
| Artifacts | `cad_artifact` (STEP, STL, SVG, PNG, …) | `partmode_headless_export_step` only |
| UI tools | `cad_ui`, `cad_events` | Refused (`VISIBLE_STUDIO_REQUIRED`) |

Headless caps (`src/headless-sessions.ts:17-26`, `docs/help/limits-and-safety.md:28-34`): 4 live sessions / account, 128 global, 32 durable project IDs / account, 20 commits / session, 1 hour max, 120 requests / account / minute.

---

## 3. CAD / PART DATA MODEL

**This product touches real geometry.** The document is parametric intent; the worker evaluates OpenCascade B-rep. A shaded mesh is explicitly *not* completion evidence (`docs/architecture.md:84-85`, `docs/help/limits-and-safety.md:7-18`).

### Canonical envelope: schema 5

Only schema 5 is accepted (`src/static/studio-project-v5.js:58`, `:2795`).

`prepareStudioV5Project` (`src/static/studio-project-v5.js:2789-2912`) requires this root:

```
{
  schemaVersion: 5,
  projectId,                  // /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/
  name,
  units: 'mm' | 'in',
  parameters: Parameter[],
  materials: Material[],
  partDefinitions: Part[],
  assemblyDefinitions: Assembly[],
  rootDocument: { kind: 'part', partId } | { kind: 'assembly', assemblyId },
  resources: Resource[],      // base64; STEP, DXF, SVG, CSV, text
  partConfigurationSets?: ConfigurationSet[],   // canonicalized after parts
  metadata: object,
  extensions?: object         // PDM, drawing book, standards, annotations, tables
}
```

Hard limits (`src/static/studio-project-v5.js:72-88`):

| Limit | Value |
| --- | --- |
| Canonical JSON (ex-resources) | 20 MiB |
| Encoded file | 160 MiB |
| Embedded resources | 100 MiB |
| Part / assembly definitions | 250 each |
| Explicit occurrences | 2,000 |
| Generated occurrences | 5,000 |
| Features per part | 2,000 |
| Sketch entities | 25,000 |
| Parameters | 5,000 |
| Materials / resources | 1,000 |
| JSON tree depth | 100 |

`createStudioV5PartProject` (`src/static/studio-project-v5.js:2975-3073`) is the factory used by templates. Empty project: one part, no features, `rootDocument.kind === 'part'` (`:3076-3109`).

A live fixture (`tests/cad-corpus/boolean-cut.partmode.json:1-80`) is the smallest readable example: four named parameters, two extrudes, one boolean subtract, two bodies.

### Parameter

`validateParameter` (`src/static/studio-project-v5.js:642-654`):

```
{ id, name: /^[A-Za-z_][A-Za-z0-9_]*$/, value: number | expression, description?, extensions? }
```

Values are expressions evaluated with cycle detection (`:656-697`). Occurrences may override by name (`:2216-2222`).

### Material

`validateMaterial` (`:700-712`): `{ id, name, densityKgM3?, appearanceId?, description?, source?, extensions? }`. Density, if present, must be a positive finite number. Bodies reference `materialId`.

### Part definition

`validatePart` (`:1573-1671`) requires:

```
{
  id, name,
  parameters: Parameter[],          // local, may reference project params
  referenceGeometry: Datum[],       // plane | axis | point | coordinate-system
  sketches: Sketch[],               // first-class; roles via extensions.studioRole
  sketchBlockDefinitions?: BlockDef[],
  bodies: Body[],
  bodyPatterns: BodyPattern[],      // linear | circular | curve | mirror | sketch | fill | variable
  features: Feature[],
  featureOrder: featureId[],        // permutation of features; rollback via metadata.rollbackFeatureId
  metadata?: { activeBodyId?, rollbackFeatureId?, partNumber?, description?, material?, ... },
  extensions?: { standardPartCatalog?, studioImportedStep?, ... }
}
```

Feature dependency cycles fail (`:1640-1666`). Feature order must list every feature once and must place a feature after its `inputRefs` feature dependencies.

### Body

`validateBody` (`:991-1018`):

```
{
  id, name,
  kind: 'solid' | 'surface',
  createdByFeatureId,               // must be featureIds[0]
  featureIds: featureId[],          // creating feature first, then modifiers
  visible, suppressed,
  materialId?, appearanceId?,
  extensions?
}
```

### Feature types and result policy

Closed vocabulary (`src/static/studio-v5-feature-types.js:14-34`):

```
boolean | boolean-split-side | chamfer | cut | direct-edit | draft | extrude
| fillet | imported-step | loft | revolve | sheet-metal-flange | shell | sweep
| thicken | thread | transform | weld-bead | weldment-treatment
```

Each type has an execution contract and allowed result-policy kinds (`:188-208`):

| Type | Execution | Result policy |
| --- | --- | --- |
| `extrude` / `loft` / `revolve` / `sweep` | `profile-solid` | `new-body` \| `add` \| `subtract` \| `intersect` |
| `cut` | `profile-solid` | `subtract` only |
| `boolean` | `body-boolean` | `add` \| `subtract` \| `intersect` |
| `boolean-split-side` | `linked-body` | `new-body` |
| `fillet` / `chamfer` / `shell` / `draft` / `thread` / `direct-edit` | `body-modifier` | `add` |
| `imported-step` | `imported-body` | `new-body` |
| `sheet-metal-flange` | `sheet-metal` | `new-body` \| `add` \| `subtract` |
| `thicken` / `weld-bead` | `linked-body` | `new-body` |
| `transform` | `body-transform` | `new-body` \| `add` |
| `weldment-treatment` | `weldment-treatment` | `add` \| `new-body` |

Common feature fields (`src/static/studio-project-v5.js:886-988`): `id`, `name`, `type`, `suppressed`, `inputRefs[]` (geometry references), `resultPolicy`, optional inline `sketch` or `sketchId`, type-specific dimensions (`h`, `r`, `t`, `angle`, …), `createdBodyId` when the policy makes a body, `extensions`.

**Hole Wizard is not a feature type.** It is `feature.extensions.holeWizard` allowed only on `cut` (`src/static/studio-v5-feature-types.js:307-314`). Schema `partmode.hole-wizard/v1`, kinds `clearance | tapped | counterbore | countersink`, ISO M3–M12 table with source metadata (`src/static/studio-hole-wizard.js:8-84`). Tapped holes keep a tap-drill bore plus a cosmetic thread callout; helical threads are not generated (`:86-90`).

**Inline sketches** (classic profile): `rect | circle | poly` with expression dimensions (`src/static/studio-agent-service.js:300-302`; corpus example `tests/cad-corpus/boolean-cut.partmode.json:46-50`). **First-class constrained sketches** live on `part.sketches` with `entities` (`point | line | circle | arc | spline`) and `constraints`, optional block instances and relations. Constrained sketches may currently drive `extrude`/`cut` only, and only via `extensions.exactSketchEntities === true` (`src/static/studio-project-v5.js:1732-1753`). ROADMAP still wants first-class constrained sketches on Revolve (`ROADMAP.md:31`).

**Geometry references** (`:602-618`):

```
{
  ownerKind: 'part' | 'body' | 'feature' | 'datum' | 'sketch' | 'occurrence',
  ownerId,
  signature: object,            // geometric / topological signature
  semanticPath?: object,        // role, e.g. pattern 'direction'
  occurrencePath?: occurrenceId[]
}
```

Cross-part references without an occurrence path fail (`:620-639`). ROADMAP: nested occurrence paths and associative cross-part ghost references are incomplete (`ROADMAP.md:20-27`).

### Persistent topology (geometry identity)

`studio-topo-naming.js:1-25` implements name-first identity, no proximity fallback:

- Faces: `F<featureId>:cap:start|end`, `F<featureId>:side:<entityId>`, `F<featureId>:blend:<edgeName>`, `body:<toolBodyId>/<name>`, `<name>#<k>`
- Edges: `E(<faceA>|<faceB>)[#<k>]` in lexicographic face order
- Vertices: derived from exact incident OCCT edges (`studio-topology-vertices.js`, referenced at `studio-topo-naming.js:1`)

Ambiguous suffix groups refuse rather than guess (`studio-topo-naming.js:41-60`). The named-checkpoint corpus case asserts specific face names survive fillet radius *and* upstream height edits (`tests/cad-corpus/manifest.json:189-192`).

Canonical B-rep evidence strips transient OCCT flags and derived triangulation, then serializes (`src/static/studio-brep-evidence.js:1-67`). That serialized B-rep is the acceptance oracle, not triangle counts.

### Assembly

`validateAssembly` (`src/static/studio-project-v5.js:2370-2445`):

```
{
  id, name, parameters,
  occurrences: Occurrence[],
  mates: Mate[],
  occurrencePatterns: OccurrencePattern[],   // linear | circular | curve
  explodedViews: { id, name, steps[], extensions? }[],
  sectionViews: { id, name, kind: 'plane'|'quarter'|'box', definition, extensions? }[],
  metadata?, extensions?                     // smartFasteners, assemblyFeatures, ...
}
```

**Occurrence** (`:2188-2224`):

```
{
  id, name,
  definition: { kind: 'part', partId } | { kind: 'assembly', assemblyId },
  parentOccurrenceId?,
  baseTransform: number[16],     // rigid right-handed, no scale/shear/reflection
  fixed, suppressed, visible,
  appearanceOverrideId?,
  parameterOverrides?: { [paramName]: expression },
  extensions?
}
```

Containment cycles fail (`:2476-2489`). Parent-occurrence cycles fail (`:2354-2368`).

**Mates** (`:104-117`, `:2226-2326`):

- Classic: `fixed | coincident | concentric | distance | angle | parallel | perpendicular | tangent | revolute | slider`
- Advanced (`partmode.advanced-mate/v1`): `width | symmetry | path | linear-coupler | limit-distance | limit-angle` (`src/static/studio-advanced-mates.js:9-16`)
- Mechanical (`partmode.mechanical-mate/v1`): `gear | hinge` (`src/static/studio-mechanical-mates.js:9`)

Solver: `solveStudioV5Assembly` in `studio-v5-assembly.js:1-5` over `solveAssemblyConstraintSystem`. Drawings refuse last-valid fallback, mate errors, and conflicting/over-constrained state (`src/static/studio-assembly-drawing-plan.js:103-107`).

### BOM — derived, not a stored document type

There is **no first-class BOM table in schema 5**. BOM is computed at drawing time.

`createAssemblyDrawingPlan` (`src/static/studio-assembly-drawing-plan.js:96-215`) walks solved leaf occurrences, groups by identity, and emits:

```
{
  schema: 'partmode.assembly-drawing-plan/v2',
  assemblyId, assemblyName, units, revisionKey, solverState,
  bom: [{
    key, partId, partNumber, revision, configurationKey, configuration,
    description, material, quantity, instanceIds, occurrencePaths, itemNumber
  }],
  instances: [{ instanceId, occurrencePath, definitionPartId, transform, visible, bomItemNumber, ... }],
  annotationRepresentatives: [{ itemNumber, instanceId }],
  projectionRequests: [{ view, exactAssemblyPass: { kind: 'occt-hlr-placed-compound' }, ... }]
}
```

Part number resolution (`:49-79`):

1. Standard-part catalog match on `part.extensions.standardPartCatalog.configurationData[*].dimensions` → `entry.partNumber` (fail closed if overrides match no row).
2. Else `part.metadata.partNumber` or `part.extensions.partNumber`.
3. Else `part.id`.

Revision / description / material come from part metadata/extensions. Quantity is instance count. Item numbers are assigned after a deterministic sort on partNumber / revision / configurationKey / partId (`:147-152`).

SVG and PDF drawing renderers consume `manifest.bom` for the table and balloons (`src/static/studio-drawing-svg.js:126-137`, `src/static/studio-drawing-pdf.js:1789-1806`). Cut lists are a *drawing table* kind (`cut-list | hole | revision | weld`), not the assembly BOM (`src/static/studio-drawing-tables.js:10`).

Jet-engine template authors `partNumber` into part metadata so the drawing plan has real numbers (`src/static/studio-jet-engine.js:149-152`, `:495-515`).

### Configurations

`project.partConfigurationSets[]` lives *outside* the part record so activating a row does not rewrite feature history (`src/static/studio-project-v5.js:2873-2876`). Normalized shape (`src/static/studio-part-configurations.js:544-550`):

```
{
  partId,
  activeConfigurationId,
  configurations: [{
    id, name,
    parameterOverrides: { [paramName]: value },
    featureSuppressionOverrides: { [featureId]: boolean }
  }],
  parameterColumns: string[],
  featureSuppressionColumns: string[]
}
```

Application clones the project and patches only those values (`:553-557`, header comment `:1-6`). CSV design-table import/export exists (`:864+`).

### Drawings (project extensions, not a document kind)

Drawing state hangs off `project.extensions`:

| Extension | Schema |
| --- | --- |
| `drawingBook` | `partmode.drawing-book/v1` (`src/static/studio-drawing-book.js:4`, stored at `:177-182`) |
| `drawingStandards` | `partmode.drawing-standards/v1` |
| `drawingAnnotations` | `partmode.drawing-annotations/v1` |
| `drawingTables` | `partmode.drawing-tables/v1` |

A book has 1–20 sheets (`:147-148`). Sheet templates: ISO A4/A3/A2, ANSI A/B, DIN A4/A3, first- or third-angle (`:7-16`). Annotation kinds include note, balloon, GD&T feature-control-frame, datum-symbol, hole-callout, weld-symbol, associative-dimension (`src/static/studio-agent-service.js:1239`). The product **refuses to claim certified GD&T/PMI** (`ROADMAP.md:60`, `docs/help/limits-and-safety.md:21-23`).

Kernel drawing path: request kind `drawing-v5` (`src/static/studio-kernel.worker.js:13500-13501`) runs OCCT HLR (`occt-hlr-placed-compound`) plus camera-frame B-rep support for BOM representatives (`src/static/studio-assembly-drawing-plan.js:199-213`).

### PDM (also an extension)

`partmode.pdm/v1` (`src/static/studio-pdm.js:3-4`). States: `work-in-progress | in-review | released | obsolete`. Graph of branches + versions; each version stores a **full canonical snapshot + SHA-256** with tamper check (`:57-64`). Agent operations: `pdm.initialize`, `pdm.version.create`, `pdm.branch.*`, `pdm.review.*`, `pdm.approval.record`, `pdm.version.release|obsolete` (`src/static/studio-agent-service.js:1301-1302`). This is **document-embedded lightweight PDM**, not a vault.

### Standard parts

Bounded ISO metric catalog (`src/static/studio-standard-parts.js:1-59`): ISO 4017 hex screws M5–M12 × selected lengths, ISO 4032 nuts, ISO 7089 washers. They are ordinary schema-5 documents with a catalog extension so BOM can resolve an orderable part number. Explicitly “not manufacturing certification.”

### Kernel request kinds (geometry actually runs here)

`studio-kernel.worker.js:13489-13512`:

`rebuild | validate-v5 | smart-fastener-plan-v5 | export-step | export-stl | export-amf | export-3mf | drawing-v5 | freeze-pattern-v5 | import-step-v5 | inspect-v5 | release | memory-stats`

Headless STEP export is `export-step` through the same worker (`src/headless/agent-host.ts:94-102`).

### What is *not* modeled

- No CAM, no native DWG (`ROADMAP.md:58`).
- No simulation (`ROADMAP.md:59`).
- STEP import does **not** reconstruct vendor feature history, mates, or PMI (`ROADMAP.md:61`, `docs/help/limits-and-safety.md:24`).
- Controlled twist on sweep is refused (`src/static/studio-project-v5.js:833-835`).
- Draft tangent propagation is refused until exact tangent-chain expansion exists (`src/static/studio-v5-feature-types.js:327`).

---

## 4. AGENT SURFACE

### There is no LLM in this repo

Grep of first-party sources finds no OpenAI / Anthropic / xAI / chat-completions client. “Agent” here means **an external MCP client driving typed CAD ops**. `DISABLED_OPERATION_REASONS` is an empty object — every listed operation is advertised available (`src/static/studio-agent-service.js:1313`).

### MCP server

- Protocol: `2025-11-25` (`src/mcp.ts:34`).
- Transport: HTTP JSON-RPC at `/mcp` (`src/server.ts:1006-1008`).
- `initialize` instructions (`src/mcp.ts:544-545`): read Help resources; pick browser-approved *or* headless; call `cad_capabilities` before `cad_*`; a key alone is not CAD authority.
- Help resources (`src/help.ts:41-77`): `partmode://help/{getting-started,configurations-and-drawings,agent-workflow,limits-and-safety}` — the same markdown humans see.

**Exactly 15 tools** (`src/mcp.ts:43-187`, `docs/help/agents.md:90-99`):

| Tool | Role |
| --- | --- |
| `partmode_list_studios` | List signed-in tabs. **No project metadata.** |
| `partmode_connect` | Request visible, project-scoped approval. Schema: `studioId`, `mode` `read-only\|preview-required`, `permissions[]` ≤20, `operationKinds[]` ≤100, `maxCommits` 0–20, `sessionSeconds` 60–3600, `uiProfile` `partmode.cad.agentic-ui/v1` \| `partmode.cad.visible-projection/v1` (`src/mcp.ts:51-71`) |
| `partmode_session_status` / `partmode_disconnect` | Inspect / close |
| `partmode_headless_open` | Durable project + ephemeral session. Requires headless grant (`:96-115`) |
| `partmode_headless_export_step` | ISO 10303-21 STEP, base64 + SHA-256 (`:117-129`) |
| `cad_capabilities` | Live capability manifest (authoritative) |
| `cad_inspect` / `cad_query` | Exact document / kernel reads |
| `cad_preview` / `cad_commit` | Transaction + revision-checked commit |
| `cad_history` | list / undo / redo |
| `cad_artifact` | Browser-only: `project\|step\|stl\|amf\|3mf\|drawing-svg\|drawing-dxf\|sketch-dxf\|flat-dxf\|png\|webvtt\|srt` (`:140-163`) |
| `cad_ui` / `cad_events` | Semantic UI + wait-for-settlement; browser only |

Generic `cad_*` input schemas are loose (`additionalProperties: true` besides `sessionId`, `:180-186`). The **real contracts live in `cad_capabilities`**, which the Help text says wins over static docs (`docs/help/agents.md:104-107`).

### Typed CAD protocol `partmode.cad.agent/v1`

`src/static/studio-agent-service.js:200-202`:

```
CAD_AGENT_PROTOCOL = 'partmode.cad.agent/v1'
CAD_AGENT_STUDIO_VERSION = '7.1.0'      // lags package 8.0.0
CAD_AGENT_KERNEL_VERSION = 'replicad-open-cascade/runtime-5A'
```

Envelope (`:3855-3928`, factory `:3918-3928`):

```
{
  protocol: 'partmode.cad.agent/v1',
  requestId, sessionId, projectId?,
  expectedRevision?,
  permissionContext: { granted: string[] },
  payload: { kind: 'capabilities'|'inspect'|'query'|'preview'|'commit'|'cancelPreview'|'history', ... }
}
```

Response: `{ protocol, requestId, sessionId, projectId, revision, status: 'ok'|'conflict'|'error', result?, diagnostics[], timing }`. Stale revision → `REVISION_CONFLICT`, not a silent apply (`:3442-3446`, `:3850`).

Transaction schema (`:241-251`):

```
{ transactionId, label, expectedRevision, operations: Operation[1..250], atomic: true }
```

Preview TTL 5 minutes (`:206`). Request body cap 1 MiB (`:205`). Idempotent request cache keyed `sessionId:requestId` (`:3864-3865`).

### Operation kinds (the actual agent language)

~130 kinds in `AVAILABLE_OPERATION_KINDS` (`:1247-1311`). Families:

- Project: `project.rename|setUnits|clear`
- Parameters / configs: `parameter.create|update|delete`, `configuration.activate`
- Classic solids: `feature.extrude|cut|revolve|fillet|chamfer|shell|thread|update|suppress|delete`
- Booleans / bodies: `boolean.union|subtract|intersect|split`, `body.*`
- Datums / sketches (including constrained, blocks, derived, DXF import, drag)
- Advanced solids: loft, sweep, draft, thicken, face/variable fillet, transform, reorder, rollback
- Sheet metal, structural members, weld beads/treatments
- Direct edit, body patterns
- Assembly: create, context enter/exit, drag, component CRUD/pattern, mates, smart fasteners, assembly features
- Inspection: section, exploded, measurement, display, materials, axial stage groups
- PDM (see above)
- Drawing book / views / derived views / standards / line fonts / layers / blocks / annotations / tables

Each available kind carries an input JSON Schema (`OPERATION_INPUT_SCHEMAS` starting `:823`). Example: `feature.extrude` is a classic profile op with `height`/`h`; `boolean.subtract` requires `targetBodyId` + `toolBodyId`; `drawing.annotation.create` enums the PMI-ish kinds.

Queries (`:1336-1351`): `project.summary|tree`, `entity.detail|dependencies|search`, `geometry.validity|bodies|topology|health`, `sketch.solve`, `assembly.clearance|interference`, `history.list|changesSince`. Topology/health/clearance/interference disable without an exact-kernel adapter (`:1381-1386`).

Permissions default **denied**; the key’s grant ceiling is frozen at creation (`src/account-store.ts:16-17`, `:29-72`). New product permissions never widen an existing key (`src/relay-hub.ts:16-17`).

### CadCommandService

One class, used by the browser *and* headless (`src/headless/agent-host.ts:1-9`, `:86-93`). Constructor seeds an empty schema-5 part if none given (`src/static/studio-agent-service.js:3415-3432`). `inspect({kind:'project.summary'})` returns counts + `documentHash` (`:3498-3523`). `inspect({kind:'project.tree'})` walks parameters, parts, datums, sketches, bodies, features, occurrences, mates, smart fasteners, assembly features (`:3525-3558`).

### Add-in API (same typed ops, in-process)

`partmode.addin/v1` (`docs/addin-api.md:12-21`): `document.snapshot|inspect|transact`, `commands.register`, `events.on('document.changed')`. Permissions `document.read|write`, `commands.register`. Trusted JS, not sandboxed (`:5`). Transactions are 1–100 ops against `expectedRevision` (`:50`).

### Agent loop?

There is **no** plan/critique/repair loop in this repo. The “loop” is: agent reads capabilities → inspect → preview → human (or headless kernel) → commit → inspect. Browser sessions can `cad_events` wait for settlement; a “flight recorder” shows redacted tool/rebuild/artifact events without raw args (`docs/help/agents.md:125-129`).

---

## 5. ROADMAP + CHANGELOG

### Changelog (`CHANGELOG.md`)

Honest about being a snapshot, not reconstructed history (`:3-5`).

| Date | Event |
| --- | --- |
| 2026-08-10 | Initial public source under AGPL-3.0-only. Claims browser-local parametric CAD, assemblies, exact B-rep, drawings, exchange, browser-approved agents, optional server-headless. |
| 2026-08-11 | Contributor architecture map, candidate roadmap, issue forms, PR template, 18s demo + social preview, first tagged prerelease `source-snapshot-2026-08-11`. Tag is “a source snapshot, not a stability or certification claim” (`:16-17`). |
| Unreleased | “No public-source changes recorded yet.” (`:9`) |

Git agrees: two commits, one tag, `main` only. Velocity **after** open-sourcing is zero in this checkout. Velocity **before** (private) is not visible; the code volume implies a long private build.

### Roadmap (`ROADMAP.md`)

Candidate contribution areas, **no dates**, no compatibility promise (`:3-6`).

| Area | Ask | Implication |
| --- | --- | --- |
| Browser ↔ headless portability | Import bundles into headless; config-table authoring on typed path; artifacts beyond STEP; per-project delete | Headless is a second-class authoring surface today |
| Assembly edit context | Nested occurrence paths; bounded associative cross-part refs | In-context edit is incomplete; fail-closed (`:26-27`) |
| Modeling parity | Constrained sketches → Revolve; tangent-chain fillet beyond constant radius; better mutation/topology fixtures | Named gaps, not vapor |
| Drawing parity | More topology-bound annotations on derived views; broader GD&T/PMI without certification claim | They know PMI is thin |
| Scale | Rebuild budgets; headless throughput vs isolation; extract coordinators from `studio.js` | `studio.js` at 26k lines is a known maintainability risk |
| Explicit non-goals | CAM, native DWG, simulation, certified GD&T, STEP feature-history reconstruction, uniform large-assembly interactive quality | Credible restraint |

The tone matches the code: fail-closed, evidence-first, no certification theater. **Credible as an engineering backlog. Not a ship schedule.** Public-source motion after 2026-08-11 is not evidenced in this clone.

---

## 6. TESTS

This is **not** a Jest/Vitest unit-test tree. The verification culture is **smoke + corpus + mutation oracles**, mostly Puppeteer against a real built server and a real WASM worker.

### Layers

| Layer | What | Gate |
| --- | --- | --- |
| `ci:gate` | typecheck + build + static integrity + HTTP/account/OIDC/MCP/cloud/entrypoint smokes | PR CI (`.github/workflows/ci.yml:16-26`), 20 min |
| `smoke:core` | Enormous AND of feature smokes (sketch, mates, sheet metal, drawings, topology, STEP, …) | `package.json:134` |
| `smoke:cad-regression` | 6 hand-audited schema-5 docs × parameter mutations × fresh worker, exact B-rep + named topology | `tests/cad-corpus/`, `scripts/cad-regression.ts` |
| `smoke:cad-mutation` `--focused` / `--exhaustive` | Generated families; incremental vs cold worker; 200×100 = 20,000 comparisons | `tests/cad-mutation-stress/README.md` |
| `smoke:assembly-runtime` etc. | Dedicated fixtures (`tests/assembly-runtime/two-part-constrained.partmode.json`) | per-script |
| `release:gate` | ci:gate + headless + agent-headless + headless-mcp + browser + regression + mutation | `package.json:146` |
| `professional-core:gate` / nightly | template matrix + professional-core + UI smokes + HLR performance | Monday 18:23 UTC (`.github/workflows/nightly.yml:5-6`), 90 min |

PR CI is the **focused** gate only. The CAD kernel suite is nightly / release, not every PR. That is documented (`README.md:75-79`, `docs/architecture.md:77-78`).

### Corpus quality (high)

`tests/cad-corpus/README.md:10-22` and `manifest.json`:

- Cases: `boolean-cut`, `fillet-shell`, `loft-sections`, `sweep-path`, `named-checkpoint`, `profile-pattern`.
- Gate 1: schema-5 parse, canonical round-trip idempotence, stable SHA-256.
- Gate 2: fresh browser worker; each variant must be one exact B-rep solid, no kernel errors, no last-valid fallback, positive volume, valid B-rep analysis, declared min mesh **and** topology counts, persistent names.
- Named-checkpoint requires specific face names after both a fillet-radius edit (reuse stock) and a stock-height edit (rebuild both) (`manifest.json:146-193`).
- Corpus is **parts only**; assemblies, drawings, STEP round-trips, invalid-input diagnostics live in other smokes (`tests/cad-corpus/README.md:30-35`).

### Mutation oracle quality (very high, if they actually run nightly)

`tests/cad-mutation-stress/README.md` is the strongest evidence this is real CAD software:

- Seven families covering every `STUDIO_V5_FEATURE_TYPES` entry except the weld/sheet-metal/thread/direct-edit extras listed as registered-context coverage (`:24-31`).
- Every edit compared on a **persistent worker vs a cold worker**.
- Acceptance: input-pure schema prep, byte-stable save/reopen, identical canonical OCCT BREP, unique names on every face/edge/vertex, name-to-topology map that cannot migrate across bodies/kinds/surface classes, dirty-feature traces, fail-closed `TOPOLOGY_REFERENCE_MISSING` probes (`:38-81`).
- Checkpoints fingerprint the entire `dist` so a rebuild mid-run fails closed (`:133-144`).

119 scripts under `scripts/` is a lot of surface, but they are **focused oracles**, not snapshot-of-DOM theater. Several UI smokes exist (`*-ui-smoke.ts`); the contributing rule is that screenshots and mesh counts are supporting evidence only (`CONTRIBUTING.md:14-16`).

### Gaps as a proxy

- No conventional unit-test directory for schema validators (the smokes *are* the tests).
- Assembly solving, drawings, and STEP are outside the six-case corpus.
- Nightly is weekly, not per-commit — a private 20k-edit suite can rot if the schedule is the only runner.
- Public changelog has no “we ran nightly and it passed” record.

**Verdict on test quality:** the *design* of the tests is professional-CAD-grade, not demo-grade. Whether nightly still passes on this snapshot was not executed (per lane contract).

---

## 7. LICENSE + THIRD-PARTY NOTICES

| Artifact | Terms |
| --- | --- |
| PartMode source | **AGPL-3.0-only** (`package.json:5`, `LICENSE` is the FSF AGPL v3 text). Copyleft includes network use. Embedding this product in a proprietary patent tool **without releasing the combination** is not a clean option. |
| Copyright | README: “Copyright © 2026 Sphinx.” (`README.md:130`). LICENSE file itself is the stock FSF header. |
| replicad 0.23.1 + replicad-opencascadejs 0.23.0 | MIT, QuaroTech / Steve Genoud (`THIRD_PARTY_NOTICES.md:5-6`) |
| Open CASCADE in `replicad_single.wasm` | **LGPL 2.1 + Open CASCADE exception**. Corresponding-source / relinking obligations apply to object-code distribution (`:7-9`, `:20-21`) |
| three.js r178 | MIT (`:10`) |
| openid-client 6.8.4 + oauth4webapi + jose | MIT (`:11-13`) |

Notices file defers to the vendored license texts under `src/static/vendor/` on conflict (`:16-18`). No proprietary-kernel smell.

**Posture for a patent-tooling product:** AGPL on the app + LGPL on the kernel is a **hard productization constraint**. The *ideas* (schema-5, preview/commit, drawing plan, topology names) are not licensed as a library. A clean reuse path is **reimplement the document/agent contracts**, or run PartMode as a separate AGPL service and keep the patent system on the other side of MCP. Fork-and-embed into a closed tool is legally radioactive.

Security: private GitHub vulnerability form only (`SECURITY.md:1-8`).

---

## 8. RELEVANCE VERDICT

**Yes — this is one of the most relevant items in the set**, and not because of marketing.

It is relevant as:

1. **The only freshly public, agent-native, exact-B-rep CAD product** in this fanout. External LLMs already speak a designed MCP surface (15 tools, preview/commit, revision, capabilities-as-source-of-truth). That is the interaction pattern an AI-CAD-for-patents system should steal, not the “dump Python into FreeCAD” pattern.
2. **A reusable document model.** Schema-5 is a complete, fail-closed parametric envelope: parts, multi-body feature history, assemblies, mates, configurations, resources, extensions. A patent tool that must round-trip an invention’s geometry (not just a screenshot) can treat this as the prior art for “what a typed CAD document looks like in 2026.”
3. **Drawings as first-class artifacts.** OCCT HLR views, SVG/PDF/DXF, balloons, BOM table, GD&T-shaped annotations, sheet book. Patent figures are drawings. This pipeline is closer to “generate an associative figure from a 3D model” than any mesh-to-PNG path. Limits are honest: not certified PMI, derived-view annotations still thin (`ROADMAP.md:39-44`).
4. **BOM identity** is computed from part numbers + revision + configuration + instance paths (`studio-assembly-drawing-plan.js:63-152`). That is the right grain for “claim 1 recites part A mated to part B” even though PartMode does not know what a claim is.
5. **Persistent topology names** (`Ffeature:cap:end`, `E(Fa|Fb)`) are the missing piece if an agent (or a patent figure generator) must point at “that edge” after a parameter change. Their fail-closed suffix rule is the correct default for anything that will later be cited.

It is **not** relevant as:

- A patent system. There are no claims, figures-as-legal-documents, prior-art graphs, or office-action loops.
- An LLM planner. There is no prompt, no spec-to-feature translator, no critic. Pair it with an agent; do not look for one inside.
- A drop-in library. AGPL-3.0-only + 26k-line `studio.js` + WASM worker. Consume via MCP/headless or port the schema — do not vendor the app.

**How to use it in an AI-CAD-for-patents design**

- **Protocol:** copy the capability-manifest + preview/commit + revision-conflict + permission-ceiling pattern. Quote `partmode.cad.agent/v1` as the existence proof that agents can drive exact CAD without pointer automation (`docs/help/agents.md:1-4`).
- **Document:** treat schema-5 (this report §3) as the candidate internal IR for “invention geometry,” including `extensions` as the hook for patent-specific metadata (figure sheets, claim-element IDs) without forking the solid model.
- **Figures:** the assembly drawing plan (`partmode.assembly-drawing-plan/v2`) plus `drawing-svg` / PDF is the shortest path from a 3D assembly to a ballooned sheet. Patent-figure automation should start here, not from rasterized three.js.
- **Legal constraint:** run PartMode as a **separate AGPL service** (hosted or self-hosted) and keep the patent workbench on the far side of MCP. Do not compile this tree into a proprietary binary.

**One-line summary:** PartMode is a real, exact, agent-addressable mechanical CAD product that launched as public source on 2026-08-11; for an AI-CAD-for-patents system it is the strongest living reference for the **document + tool surface + drawing/BOM pipeline**, and a poor candidate to fork.

---

## Key file index

| Concern | File |
| --- | --- |
| Schema + limits + factories | `src/static/studio-project-v5.js` |
| Feature vocabulary + contracts | `src/static/studio-v5-feature-types.js` |
| Runtime mutations | `src/static/studio-v5-runtime-document.js` |
| Agent ops / capabilities | `src/static/studio-agent-service.js` |
| Exact kernel | `src/static/studio-kernel.worker.js` |
| B-rep oracle | `src/static/studio-brep-evidence.js` |
| Topology names | `src/static/studio-topo-naming.js` |
| Assembly solve | `src/static/studio-v5-assembly.js` |
| BOM + drawing plan | `src/static/studio-assembly-drawing-plan.js` |
| Drawing book | `src/static/studio-drawing-book.js` |
| Configurations | `src/static/studio-part-configurations.js` |
| PDM | `src/static/studio-pdm.js` |
| MCP | `src/mcp.ts` |
| HTTP / product | `src/server.ts` |
| Headless | `src/headless/agent-host.ts`, `src/headless-sessions.ts` |
| Architecture | `docs/architecture.md` |
| Agent help (also an MCP resource) | `docs/help/agents.md` |
| Corpus | `tests/cad-corpus/` |
