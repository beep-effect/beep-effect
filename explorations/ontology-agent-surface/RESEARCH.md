# Research

## 2026-07-10 — External landscape (claude, web)

### MCP servers over knowledge graphs (query-side prior art)

The query side is well-trodden; the differentiators for this packet are the
typed change-op edit model, verified repairs, and PROV attribution — none of
the surveyed servers have them.

- **mcp-graphdb** — read-only SPARQL over Ontotext GraphDB repositories;
  graph listing + stats. <https://github.com/keonchennl/mcp-graphdb>
- **mcp-rdf-explorer** — conversational RDF/Turtle exploration, local-file
  mode or SPARQL-endpoint mode (closest to our files-as-truth stance, but
  read-oriented). <https://github.com/emekaokoye/mcp-rdf-explorer>
- **mcp-proto-okn** — natural-language access to scientific knowledge graphs:
  graph routing, schema inspection, SPARQL execution, ontology expansion,
  multi-graph querying. <https://arxiv.org/abs/2605.30283>
- GraphDB itself ships an MCP server (SSE streaming) for NL-to-SPARQL.
  <https://graphwise.ai/blog/the-power-of-model-context-protocol-using-natural-language-to-query-graphdb/>
- Directory sweeps: Glama/PulseMCP list several SPARQL servers
  (<https://glama.ai/mcp/servers?query=sparql>,
  <https://www.pulsemcp.com/servers/kludgeworks-sparql>).

### MCP servers for ontology authoring (write-side prior art)

Two projects overlap with this packet's write-side ambitions — both are
build-vs-integrate comparators for align:

- **open-ontologies** (fabio-rovai) — Rust MCP server + desktop Studio,
  70+ tools over an in-memory Oxigraph store: build/validate/query/diff/lint/
  version/reason (native OWL2-DL tableaux), SHACL, SPARQL. Single binary, no
  JVM. Implements the generate → validate → iterate loop.
  <https://github.com/fabio-rovai/open-ontologies> (HN discussion:
  <https://news.ycombinator.com/item?id=47356390>)
- **owl-mcp** (ai4curation) — MCP server exposing find/add/remove OWL axiom
  tools in OWL functional syntax.
  <https://github.com/ai4curation/owl-mcp>
- Research direction: compiling an ontology T-Box into an ontology-specific
  MCP server with machine-checkable tool schemas.
  <https://arxiv.org/pdf/2602.03439>

Assessment vs. this repo: open-ontologies validates the product thesis
(agentic ontology engineering over Oxigraph + SHACL) but is a standalone
store-centric engine. Our differentiators: files-as-truth Turtle on disk, the
typed undoable change-op model shared with the human workbench UI, verified
repair proposals, PROV-O journaling of every edit, and Effect-schema-typed
tool contracts reusing the existing RPC surface. Integration (wrapping their
binary) would abandon the shared session/change-log semantics — the thin
adapter over OntologyRpcs remains the natural fit; treat open-ontologies as a
tool-vocabulary reference (what 70+ tools agents find useful) rather than a
dependency.

### MCP transport options for a desktop-hosted server

From the MCP spec (2025-06-18 transports,
<https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>):

- **stdio** — client launches the server as a subprocess; newline-delimited
  JSON-RPC on stdin/stdout; "clients SHOULD support stdio whenever possible."
  Fits a CLI-spawned or sidecar-binary-spawned server; simplest for local
  agent clients.
- **Streamable HTTP** — one MCP endpoint handling POST (+ optional SSE
  streams), `Mcp-Session-Id` session management, resumable streams. Security
  notes for local servers: MUST validate `Origin` (DNS-rebinding), SHOULD bind
  127.0.0.1 only, SHOULD authenticate. Fits the already-running sidecar
  (which already serves HTTP RPC on a loopback port) — an `/mcp` endpoint
  beside `/rpc/` is the minimal-delta option, and sidesteps the in-repo
  finding that sidecar stdio is already occupied by Effect RPC framing.
- Custom transports are permitted if JSON-RPC framing + lifecycle hold.

Placement implication: both options are viable against the existing sidecar —
stdio via a thin launcher that boots the sidecar runtime headless (no Tauri),
or streamable HTTP mounted on the existing loopback server. The in-repo
inventory below (m365-mcp stdio pattern vs. occupied sidecar stdio; unsaved
UI state invisible to separate processes) frames the align-stage decision.

## 2026-07-10 — In-repo capability inventory (codex)

This inventory was read from the live `feat/explore-ontology-agent-surface`
checkout. It covers only capabilities present in this repository. A capability
that the capture expects but that targeted source, barrel, and test searches did
not locate is marked **NOT FOUND**.

### Executive read

- The ontology workbench has **9 wire-ready Effect RPCs**. The capture is wrong
  that undo, redo, and search are already in `OntologyRpcs`: those three are
  client-local. `PreviewOntologyTurtle` is the additional RPC omitted from the
  capture shorthand. (`@beep/ontology-use-cases` —
  `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`;
  `@beep/ontology-client` —
  `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`)
- The best single MCP-driver template is `@beep/m365-mcp`: it has the cleanest
  schema tool -> thin handler -> sanitized stdio server split and the only
  end-to-end stdio `initialize` / `tools/list` / `tools/call` test among the
  three drivers. Ontology writes must additionally use `@beep/mcp-kit`'s
  destructive hints and TierGate; no production driver wires that gate today.
  (`@beep/m365-mcp` — `packages/drivers/m365-mcp/src/M365Tools.ts`,
  `packages/drivers/m365-mcp/src/M365Handlers.ts`,
  `packages/drivers/m365-mcp/src/Server.ts`,
  `packages/drivers/m365-mcp/test/Server.test.ts`; `@beep/mcp-kit` —
  `packages/foundation/capability/mcp-kit/src/TierGate.ts`)
- The existing RPC adapter is thin in implementation but not in state shape:
  most calls send a complete `Session`, and the browser atom registry owns the
  current session. There is no sidecar session repository, revision, or
  two-writer contract. (`@beep/ontology-domain` —
  `packages/ontology/domain/src/aggregates/Session/Session.model.ts`;
  `@beep/ontology-client` —
  `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`;
  `@beep/ontology-use-cases` —
  `packages/ontology/use-cases/src/aggregates/Session/Session.service.ts`)

### 1. MCP infrastructure

#### `@beep/mcp-kit`

`@beep/mcp-kit` is at `packages/foundation/capability/mcp-kit`. It supplements
Effect's `Tool`, `Toolkit`, and `McpServer`; it does not replace or re-export
those authoring primitives and does not own a transport constructor.
(`@beep/mcp-kit` — `packages/foundation/capability/mcp-kit/package.json`,
`packages/foundation/capability/mcp-kit/src/index.ts`)

| Public module | Server/tool-authoring surface | Packet relevance |
| --- | --- | --- |
| `ApiKeyRequired.ts` | `ApiKeyRequiredFailure`, `apiKeyRequiredFailure` | Typed returned failure for a missing soft-gated credential. Ontology itself is local, but the failure-as-value pattern is reusable. (`@beep/mcp-kit` — `packages/foundation/capability/mcp-kit/src/ApiKeyRequired.ts`) |
| `FieldTier.ts` | `FieldTierName`, `defineFieldTiers`, `projectFieldTier`, `projectWithinBudget`, `ColumnarEnvelope`, `FetchableHandle`, and size/projection helpers | Useful for bounding snapshots, SPARQL rows, validation reports, and provenance output. **NOT FOUND:** a real store/retrieval implementation behind `FetchableHandle`. (`@beep/mcp-kit` — `packages/foundation/capability/mcp-kit/src/FieldTier.ts`) |
| `SanitizedSpan.ts` | `sanitizeTracerAttributes`, `withSanitizedToolSpan`, `sanitizedToolkit` | Registers a toolkit while excluding raw `parameters` from spans; all three MCP drivers use `sanitizedToolkit`. (`@beep/mcp-kit` — `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts`) |
| `SourceAuth.ts` | `SourceAuthRegistration`, credential resolution, and none/soft/hard mount decisions | Reusable if remote ontology sources arrive later; not required for local files. (`@beep/mcp-kit` — `packages/foundation/capability/mcp-kit/src/SourceAuth.ts`) |
| `TierGate.ts` | `TierGatePolicy`, fail-closed `dispatchWithTierGate`, list filtering, typed verdicts, and `TierGateAuditRecord` | The natural approval seam for mutating ontology tools. **NOT FOUND:** a production MCP consumer or persistent audit sink. (`@beep/mcp-kit` — `packages/foundation/capability/mcp-kit/src/TierGate.ts`, `packages/foundation/capability/mcp-kit/test/TierGate.test.ts`) |
| `ToolAnnotations.ts` | Four MCP behavior hints plus `readOnlyToolHints` and `destructiveWriteToolHints` | Read tools can be explicit; apply/save/repair tools can be classified as writes. **NOT FOUND:** production use of `destructiveWriteToolHints`. (`@beep/mcp-kit` — `packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts`) |
| `ToolkitComposition.ts` | `gatedLayer`, `composeGatedLayers` | Folds multiple toolkits into one MCP host and omits unavailable hard-gated sources. (`@beep/mcp-kit` — `packages/foundation/capability/mcp-kit/src/ToolkitComposition.ts`) |

The kit's tests prove credential envelopes, gated composition, field tiers,
columnar projection, sanitized spans/toolkit dispatch, and fail-closed TierGate
decisions. (`@beep/mcp-kit` —
`packages/foundation/capability/mcp-kit/test/ApiKeyRequired.test.ts`,
`packages/foundation/capability/mcp-kit/test/FieldTier.test.ts`,
`packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts`,
`packages/foundation/capability/mcp-kit/test/ToolkitComposition.test.ts`)

**NOT FOUND:** MCP resource or prompt authoring, an RPC-group-to-toolkit adapter,
an HTTP/socket transport, persistent TierGate audit storage, rate limiting, or
batch-budget middleware in `@beep/mcp-kit`. Existing drivers manually declare
each `Tool.make(...)`, combine tools with `Toolkit.make(...)`, implement them
with `Toolkit.toLayer(...)`, and serve them with Effect's
`McpServer.layerStdio(...)`. (`@beep/mcp-kit` —
`packages/foundation/capability/mcp-kit/src/index.ts`; MCP drivers —
`packages/drivers/nlp-mcp/src/Server.ts`,
`packages/drivers/m365-mcp/src/Server.ts`,
`packages/drivers/uspto-mcp/src/Server.ts`)

#### Existing MCP drivers

| Driver | Tool and handler shape | Transport and wiring | Tests and ontology fit |
| --- | --- | --- | --- |
| `@beep/nlp-mcp` | Merges the canonical 25-tool `NlpToolkit` with a driver-local 17-tool `StreamingToolkit` (42 total). Streaming tools use schema parameters/results, returned failures, and read-only hints; handlers are toolkit Layers. (`@beep/nlp-mcp` — `packages/drivers/nlp-mcp/src/StreamingTools.ts`, `packages/drivers/nlp-mcp/src/StreamingHandlers.ts`; `@beep/nlp-processing` — `packages/foundation/capability/nlp-processing/src/Tools/NlpToolkit.ts`) | `Layer.mergeAll(sanitizedToolkit(...))` over one `McpServer.layerStdio`; the executable provides Node stdio, filesystem/path, and outbound HTTP. The outbound HTTP client is not an inbound MCP transport. (`@beep/nlp-mcp` — `packages/drivers/nlp-mcp/src/Server.ts`, `packages/drivers/nlp-mcp/src/bin.ts`) | Tests pin 25/17/42 tool counts and real Wink/streaming behavior, but **NOT FOUND:** a full stdio protocol conversation test. Its multi-toolkit composition is useful for splitting read, mutation, and administration tools. (`@beep/nlp-mcp` — `packages/drivers/nlp-mcp/test/Server.test.ts`, `packages/drivers/nlp-mcp/test/integration/Streaming.test.ts`) |
| `@beep/m365-mcp` | Eleven local `Tool.make(...)` declarations reuse `@beep/m365` schemas, use a typed returned `M365ToolError`, explicit read-only hints, one `M365Toolkit`, and thin service-delegating handlers. (`@beep/m365-mcp` — `packages/drivers/m365-mcp/src/M365Tools.ts`, `packages/drivers/m365-mcp/src/M365Handlers.ts`) | `sanitizedToolkit(M365Toolkit)` + handler Layer + `McpServer.layerStdio`; the executable supplies `NodeStdio` and `M365.layer`. Microsoft Graph HTTP is an outbound driver concern; inbound MCP remains stdio. (`@beep/m365-mcp` — `packages/drivers/m365-mcp/src/Server.ts`, `packages/drivers/m365-mcp/src/bin.ts`) | Strongest template: exact tool inventory, schema parity, handler delegation, span hygiene, and an actual NDJSON stdio initialize/list/call exchange via `Stdio.layerTest`. It lacks write approval/session examples because it is intentionally read-only. (`@beep/m365-mcp` — `packages/drivers/m365-mcp/test/Server.test.ts`, `packages/drivers/m365-mcp/test/SanitizedSpan.test.ts`) |
| `@beep/uspto-mcp` | Two read-only tools with a typed `ApiKeyRequiredFailure | UsptoToolError`, per-call credential resolution, source-auth registration, field tiers, columnar reshaping, and result budgets. (`@beep/uspto-mcp` — `packages/drivers/uspto-mcp/src/UsptoTools.ts`, `packages/drivers/uspto-mcp/src/UsptoHandlers.ts`, `packages/drivers/uspto-mcp/src/UsptoSourceAuth.ts`, `packages/drivers/uspto-mcp/src/UsptoDocumentTiers.ts`) | Gated/sanitized toolkit composition over `McpServer.layerStdio`. Its executable is safest to import because launch is behind `if (import.meta.main)`. (`@beep/uspto-mcp` — `packages/drivers/uspto-mcp/src/Server.ts`, `packages/drivers/uspto-mcp/src/bin.ts`) | Tests prove credential degradation, real driver decoding with mocked HTTP, schema parity, field-tier budgeting, and safe bin import; **NOT FOUND:** a real stdio conversation test. Borrow its guarded entrypoint and output budgeting. (`@beep/uspto-mcp` — `packages/drivers/uspto-mcp/test/Server.test.ts`) |

**Best primary template: `@beep/m365-mcp`.** It most closely matches a thin
ontology adapter: schema-owned tools, one service boundary, a small handler
Layer, sanitized stdio hosting, and transport-level proof. Borrow multi-toolkit
composition from `@beep/nlp-mcp`, the guarded entrypoint and result budgets from
`@beep/uspto-mcp`, and destructive hints plus TierGate from `@beep/mcp-kit`.
(`@beep/m365-mcp` — `packages/drivers/m365-mcp/src`,
`packages/drivers/m365-mcp/test/Server.test.ts`; `@beep/mcp-kit` —
`packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts`,
`packages/foundation/capability/mcp-kit/src/TierGate.ts`)

All three inbound MCP transports are stdio. **NOT FOUND:** an in-repo MCP
server over HTTP, SSE, Unix/TCP socket, or WebSocket in these drivers or
`@beep/mcp-kit`. (`@beep/nlp-mcp`, `@beep/m365-mcp`, `@beep/uspto-mcp` — each
driver's `src/Server.ts` and `src/bin.ts`)

### 2. Full `OntologyRpcs` candidate tool inventory

`OntologyRpcs` is declared in `@beep/ontology-use-cases`; every member uses the
same wire error, `OntologyActionError`. The exact count is **9**.
(`@beep/ontology-use-cases` —
`packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`)

| # | RPC tag | Request schema | Response schema | Capture fit / gap |
| ---: | --- | --- | --- | --- |
| 1 | `OpenOntologyDocument` | `OpenOntologyDocumentPayload` (private: `sessionId`, `path`, optional `baseIri`) | `OpenOntologyDocumentResult` (`session`, `path`, source text, snapshot) | Exists and opens Turtle through sidecar IO. The client has public `OpenOntologyDocumentInput`, but the wire payload class itself is private. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`; `@beep/ontology-client` — `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`) |
| 2 | `SaveOntologyDocument` | `SaveOntologyDocumentPayload` (private: `path`, full `Session`) | `SaveOntologyDocumentResult` (`path`, source text) | Exists. The client-facing input only asks for a path because its atom injects local session state. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`; `@beep/ontology-client` — `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`) |
| 3 | `PreviewOntologyTurtle` | `PreviewOntologyTurtlePayload` (private: full `Session`) | `PreviewOntologyTurtleResult` (source text) | Exists; this is the extra RPC omitted by the capture shorthand. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`) |
| 4 | `ApplyOntologyBatch` | `ApplyOntologyBatchCommand` (full `Session`, `ChangeOperation[]`) | `ApplyOntologyBatchResult` (updated session, real `SessionChangeDelta`, applied operations) | Exists and returns real added/removed quad deltas. **NOT FOUND:** an operation-count or payload-size cap. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`; `@beep/ontology-domain` — `packages/ontology/domain/src/aggregates/Session/Session.model.ts`) |
| 5 | `GetOntologySnapshot` | `GetOntologySnapshotPayload` (private: full `Session`) | `OntologySnapshot` | Exists on the wire. The current client does not call it; `ontologySnapshotAtom` derives the same projection locally. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`, `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts`; `@beep/ontology-client` — `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`) |
| 6 | `RunOntologyInference` | `InferOntologySessionInput` (session, optional previous result, caller-provided `driftCap`, default 64) | `OntologyInferenceResult` | Exists for bounded structural inference and reports changed signatures, per-module modes, drift, and inferred quads. It is not full OWL DL reasoning. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts`, `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`) |
| 7 | `RunOntologySparql` | `RunOntologySparqlInput` (session, select/construct profile, query, inference toggle/result, safeguard envelope) | `RunOntologySparqlResult` | Exists and reports normalized query, effective limit, injection/truncation flags, counts, and typed result. Safeguard values are caller-provided, not server ceilings. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts`, `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`) |
| 8 | `RunOntologyValidation` | `RunOntologyValidationInput` (session, optional inference, caller-provided `maxResults`, default 100) | `RunOntologyValidationResult` | Exists; returns SHACL results, verified repair proposals, and shape/data/inferred counts. Repairs are currently only the `sh:hasValue` add-quad case. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`, `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`) |
| 9 | `ExportOntologyProvenance` | `ExportOntologyProvenanceCommand` (session, PROV path, dataset-description path) | `ExportOntologyProvenanceResult` (both paths and Turtle sources) | Exists and writes separate PROV-O and VoID/DCAT sidecars. Actor identity is fixed to the workbench. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`, `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`) |

Exhaustive `Rpc.make` search found no additional ontology RPCs in the client or
use-case packages. (`@beep/ontology-use-cases`, `@beep/ontology-client` —
`packages/ontology/use-cases/src`, `packages/ontology/client/src`)

The capture-listed non-RPC capabilities are:

- **Undo — NOT FOUND as an RPC.** `undoOntologyChangeAtom` drops the final
  change-log entry from the client-owned session and pushes it onto a local redo
  stack. (`@beep/ontology-client` —
  `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`)
- **Redo — NOT FOUND as an RPC.** `redoOntologyChangeAtom` appends from that
  client-local stack. (`@beep/ontology-client` —
  `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`)
- **Search — NOT FOUND as an RPC or Effect Schema request.**
  `ontologySearchResultsAtom` calls pure `searchOntologyResources` over a local
  snapshot; `SearchOntologyResourcesOptions` is a private TypeScript type.
  (`@beep/ontology-client` —
  `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`;
  `@beep/ontology-use-cases` —
  `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts`)

Thus the direct RPC-to-tool candidate inventory is **9**, while the broader
conceptual surface is 12 only after new tool contracts are designed for
undo/redo/search.

### 3. Sidecar hosting mechanics

`OntologyOrchestrator` adapts the nine tags to four service boundaries:
`SessionUseCases`, `OntologyReasoner`, `OntologySparqlRunner`, and
`OntologyValidationRunner`. Batch application and snapshot projection are pure
operations over the session carried in the request. `OntologyHandlersLive` is
an `OntologyRpcs.toLayer(...)` handler Layer. (`@beep/professional-desktop` —
`apps/professional-desktop/src/ontology/OntologyOrchestrator.ts`)

`RuntimeLive` merges ontology handlers with Chat, workspace-vault, and document
handlers, then provides `OntologyServerLive`; that server composes filesystem,
N3 Turtle, structural reasoner, Oxigraph SPARQL, and SHACL Layers.
(`@beep/professional-desktop` —
`apps/professional-desktop/src/runtime/Layer.ts`; `@beep/ontology-server` —
`packages/ontology/server/src/aggregates/Session/Session.layer.ts`)

`server/main.ts` merges `ChatRpcs`, `WorkspaceVaultRpcs`, `DocumentsRpcs`, and
`OntologyRpcs` into `DesktopRpcs` and exposes them in two modes:

- HTTP is NDJSON POST `/rpc` on loopback port `3939` by default, configurable
  with `CHAT_SIDECAR_PORT`. The full write-capable group is exposed only when a
  `BEEP_DESKTOP_RPC_SESSION_TOKEN` is configured; otherwise HTTP deliberately
  serves Chat only. (`@beep/professional-desktop` —
  `apps/professional-desktop/server/main.ts`,
  `apps/professional-desktop/server/RpcSessionAuth.ts`)
- IPC serves the full group as Effect RPC NDJSON on stdin/stdout. Tauri owns the
  sidecar process and bridge; `sidecar_send` rejects webview-to-sidecar frames
  above 8 MiB, and the stdout bridge guards an unterminated buffer at the same
  size. This is an indirect framing bound, not an ontology operation cap or a
  symmetric completed-response ceiling. (`@beep/professional-desktop`
  — `apps/professional-desktop/server/main.ts`,
  `apps/professional-desktop/server/IpcStdoutGuard.prelude.ts`,
  `apps/professional-desktop/src-tauri/src/lib.rs`)

The agents slice is the direct precedent: five `ChatRpcs` declarations,
`ChatRpcs.of(...)` / `toLayer(...)` handlers in the app, and an
`AtomRpc.Service` client with a writable HTTP-or-IPC protocol Layer. Ontology's
client deliberately shares the same protocol selector. (`@beep/agents-use-cases`
— `packages/agents/use-cases/src/processes/Chat/Chat.rpc.ts`;
`@beep/agents-client` — `packages/agents/client/src/Chat.atoms.ts`;
`@beep/professional-desktop` —
`apps/professional-desktop/src/chat/ChatOrchestrator.ts`,
`apps/professional-desktop/src/App.tsx`; `@beep/ontology-client` —
`packages/ontology/client/src/aggregates/Session/Session.atoms.ts`)

MCP mounting consequences:

| Placement | What it takes | Current gap |
| --- | --- | --- |
| Same process, HTTP | Mount an authenticated MCP HTTP route beside `/rpc`, or launch another configurable loopback port, and provide the same ontology Layers. | **NOT FOUND:** any in-repo inbound HTTP MCP server Layer/route. The existing HTTP stack is Effect RPC, not MCP. (`@beep/professional-desktop` — `apps/professional-desktop/server/main.ts`; MCP drivers — each `src/Server.ts`) |
| Same process, stdio | A transport multiplexer or a mutually exclusive MCP mode. | Current IPC already owns stdin/stdout and guards stdout against non-RPC frames, so an MCP stdio server cannot share those descriptors safely. **NOT FOUND:** a multiplexer. (`@beep/professional-desktop` — `apps/professional-desktop/server/main.ts`, `apps/professional-desktop/server/IpcStdoutGuard.prelude.ts`) |
| Separate stdio process | Follow `@beep/m365-mcp`, compose `OntologyServerLive`, and register ontology Toolkits directly. | Straightest transport proof, but it cannot observe the desktop UI's unsaved session because that session is client-owned. (`@beep/m365-mcp` — `packages/drivers/m365-mcp/src/Server.ts`; `@beep/ontology-server` — `packages/ontology/server/src/Layer.ts`; `@beep/ontology-client` — `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`) |
| Separate MCP proxy to sidecar RPC | Connect to the existing `/rpc` endpoint and adapt Effect RPC results to MCP. | Requires the shell-issued bearer token for ontology writes, lifecycle/port discovery, and a way to share it safely. It still inherits full-session payloads. (`@beep/professional-desktop` — `apps/professional-desktop/server/main.ts`, `apps/professional-desktop/server/RpcSessionAuth.ts`) |

`makeOntologyOperations` is currently private to the app orchestrator. Extracting
that operation record behind a shared service would prevent an MCP adapter and
Effect RPC handlers from duplicating orchestration. (`@beep/professional-desktop`
— `apps/professional-desktop/src/ontology/OntologyOrchestrator.ts`)

### 4. Session ownership and concurrency

The sidecar is session-stateless. A domain `Session` contains only `id`,
`baseDataset`, `prefixes`, and ordered `changeLog`; the current value resides in
the browser atom registry and is sent in full to most RPCs. `SessionUseCases`
owns file read/parse/serialize/write operations, not a `Ref`, map, database
table, or session repository. (`@beep/ontology-domain` —
`packages/ontology/domain/src/aggregates/Session/Session.model.ts`;
`@beep/ontology-client` —
`packages/ontology/client/src/aggregates/Session/Session.atoms.ts`;
`@beep/ontology-use-cases` —
`packages/ontology/use-cases/src/aggregates/Session/Session.service.ts`)

`ApplyOntologyBatch` is a pure function from the supplied session plus operations
to an updated session plus delta. The five graph partitions are rebuilt from
`baseDataset + changeLog`; they are derived indexes, not shared mutable state.
The governing workbench spec calls partitions Constraint 13 and real deltas /
query safeguards Constraint 16. Neither constraint defines concurrency.
(`@beep/ontology-domain` —
`packages/ontology/domain/src/aggregates/Session/Session.model.ts`;
`@beep/professional-desktop` —
`apps/professional-desktop/src/ontology/OntologyOrchestrator.ts`; packet contract
— `goals/ontology-workbench/SPEC.md`)

Two writers therefore operate on independent session snapshots. There is no
serialization or merge. File writes use temp-file plus rename, so one write is
atomic, but there is no compare-and-swap against the version that was opened;
concurrent stale saves are effectively last-rename-wins. (`@beep/ontology-server`
— `packages/ontology/server/src/aggregates/Session/Session.file-store.ts`)

Concurrency contract gaps:

- **NOT FOUND:** a server-side session registry/store, shared in-memory owner,
  or external-process route to the UI's unsaved session.
- **NOT FOUND:** session revision/ETag, optimistic concurrency, lock, lease,
  compare-and-swap, conflict result, or merge/rebase operation.
- **NOT FOUND:** ordering or serialization for simultaneous human and agent
  batches, or a two-writer test.
- **NOT FOUND:** shared undo/redo semantics. Current undo/redo rewrites one
  client's local change log and redo stack.
- **NOT FOUND:** a concurrency contract for the derived partition indexes. The
  `revision` in `Session.visualizer.ts` is a render-projection revision, not a
  session concurrency token.

Evidence: `@beep/ontology-domain` —
`packages/ontology/domain/src/aggregates/Session/Session.model.ts`;
`@beep/ontology-client` —
`packages/ontology/client/src/aggregates/Session/Session.atoms.ts`;
`@beep/ontology-use-cases` —
`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts`.

### 5. PROV-O journal actor modeling

`provenanceDataset` emits one `prov:Agent` at the fixed session-local IRI
`agent:workbench`. Every change activity is linked to that same agent with
`prov:wasAssociatedWith`; activities record only ordinal, operation kind, and
serialized quad. (`@beep/ontology-use-cases` —
`packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`)

Actor identity cannot be threaded from an RPC boundary today:

- `ChangeOperation` carries only `kind`, `partition`, and `quad`.
- `Session` carries no actor/owner metadata.
- `ApplyOntologyBatchCommand` carries session plus operations only.
- `ExportOntologyProvenanceCommand` carries session and output paths only.

Evidence: `@beep/ontology-domain` —
`packages/ontology/domain/src/aggregates/Session/Session.model.ts`;
`@beep/ontology-use-cases` —
`packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`,
`packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`.

**NOT FOUND:** an `ActorId`/actor schema, per-change journal envelope, RPC actor
field, authenticated-principal mapping, or per-actor PROV export test. Adding an
actor only to export would misattribute a mixed human/agent history; durable
per-change attribution requires the journal model itself to retain actor
identity.

### 6. Safeguards for agent-driven operations

| Existing safeguard | Actual behavior | Agent-surface assessment |
| --- | --- | --- |
| Typed change operations | Effect Schema restricts operations to add/remove quad and checks declared partition against the quad's graph. (`@beep/ontology-domain` — `packages/ontology/domain/src/aggregates/Session/Session.model.ts`) | Good mutation primitive and wire validation; not a budget or authorization boundary. |
| File boundary | Paths are resolved inside `ONTOLOGY_WORKSPACE_ROOT`; writes create a temp file and rename atomically. Saving rejects change-log entries outside the asserted partition. (`@beep/ontology-server` — `packages/ontology/server/src/aggregates/Session/Session.file-store.ts`; `@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.service.ts`) | Useful filesystem containment. It does not detect stale writers or authorize a path per actor. |
| SPARQL defaults | `OntologySparqlSafeguards` defaults `defaultLimit=100`, `maxResultCount=200`; a regex detects `LIMIT`, missing `LIMIT` is appended, then SELECT rows or CONSTRUCT quads are truncated with raw/displayed counts. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts`) | Satisfies bounded display results for cooperative callers. Both values are caller-controlled; an explicit large `LIMIT` is accepted, regex matches can occur in comments/literals, `effectiveLimit` still reports the default for explicit limits, and truncation happens after engine execution. `SparqlQueryRequest.timeoutMs` exists but this path neither exposes nor uses it; Oxigraph loads the dataset and queries synchronously. (`@beep/semantic-web` — `packages/foundation/capability/semantic-web/src/services/sparql-query.ts`; `@beep/oxigraph` — `packages/drivers/oxigraph/src/Oxigraph.sparql.ts`) |
| Validation result bound | `RunOntologyValidationInput.maxResults` defaults to 100 and the result exposes the driver's truncation flag. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`; `@beep/semantic-web` — `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`) | Useful default, but caller-controlled and not a server maximum. |
| Inference drift discipline | Default `driftCap` is 64. A rewound history or changed-operation window above the cap sets `drifted=true`, disables module reuse, and runs a full recompute. The result reports `drifted` and `fullRecompute`. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts`) | This is fail-closed with respect to incremental-cache correctness, not fail-as-error: the expensive full pass proceeds. The cap is caller-provided and has no server ceiling, and the orchestrator maps no special tool error. |
| Sidecar boundary | HTTP ontology writes require the per-launch bearer token; Tauri caps webview-to-sidecar IPC sends at 8 MiB and guards an unterminated stdout buffer. (`@beep/professional-desktop` — `apps/professional-desktop/server/main.ts`, `apps/professional-desktop/server/RpcSessionAuth.ts`, `apps/professional-desktop/src-tauri/src/lib.rs`) | Protects sidecar reachability and one framing direction, not semantic batch size or completed inbound responses. A separate MCP process would need its own equivalent boundary. |
| MCP safety kit | Sanitized spans, explicit destructive hints, fail-closed TierGate verdicts/audit records, and output budgeting already exist. (`@beep/mcp-kit` — `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts`, `packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts`, `packages/foundation/capability/mcp-kit/src/TierGate.ts`, `packages/foundation/capability/mcp-kit/src/FieldTier.ts`) | Reusable bricks, but **NOT FOUND** in any production write-tool dispatch or ontology path. |

Missing safeguards for agent-driven bulk edits:

- **NOT FOUND:** a maximum operations-per-batch, quad-count/byte budget,
  request rate, execution timeout, per-session budget, or bounded delta/session
  response. `S.Array(ChangeOperation)` is unbounded in RPC, client, and domain
  schemas. (`@beep/ontology-use-cases` —
  `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`;
  `@beep/ontology-client` —
  `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`;
  `@beep/ontology-domain` —
  `packages/ontology/domain/src/aggregates/Session/Session.model.ts`)
- **NOT FOUND:** idempotency keys, expected revision, conflict rejection,
  per-call actor, approval receipt, or persisted MCP gate audit.
- **NOT FOUND:** a hard server SPARQL ceiling independent of caller input or a
  pre-execution cost/timeout budget.
- **NOT FOUND:** a typed drift-cap refusal/tool error. The current safe fallback
  is a full recompute, which may itself be the workload an agent can amplify.
- **NOT FOUND:** an agent partition allowlist. `GraphPartition` permits typed
  operations against asserted, ontologies, inferred, shapes, and provenance
  partitions. No-op add/remove operations produce an empty delta but are still
  appended to the unbounded change log. (`@beep/ontology-domain` —
  `packages/ontology/domain/src/aggregates/Session/Session.values.ts`,
  `packages/ontology/domain/src/aggregates/Session/Session.model.ts`)

### 7. Repair-pipeline extension points

The reusable part is strong: validation builds asserted + ontology + optional
inferred data, calls the SHACL service, applies each candidate through the normal
typed batch pipeline, revalidates, and offers only a proposal that removes the
matching violation. That verify-then-offer loop can remain unchanged behind a
strategy registry. (`@beep/ontology-use-cases` —
`packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`)

The current proposal generator is hard-coded:

1. `matchingRepairTarget` only accepts a property shape with matching path and
   `hasValue`.
2. `repairOperation` always creates one asserted `addQuad` using that value.
3. `repairProposal` verifies that one operation and emits one proposal.

(`@beep/ontology-use-cases` —
`packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`)

A local map from component IRI to strategy would be mechanically easy, but the
needed discriminant is absent. `ShaclValidationViolation` has focus node, path,
message, severity, and source shape only; the `@beep/shacl` adapter discards
`sourceConstraintComponent`. `ShaclPropertyShape` models min/max count,
datatype, and has-value, but not `sh:class`. (`@beep/semantic-web` —
`packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`;
`@beep/shacl` — `packages/drivers/shacl/src/Shacl.validation.ts`)

Therefore a real per-constraint strategy registry is a **medium-to-high,
cross-package extension**, not a one-file refactor:

- extend the shared violation contract with constraint component and enough
  source/value detail;
- preserve those fields in the real SHACL driver;
- extend shape extraction/contracts for `sh:class` (and define what capture's
  “class/range” means);
- implement strategy-specific proposal generation and safety classification;
- retain the existing revalidation gate and add driver/use-case tests.

Evidence: `@beep/semantic-web` —
`packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`;
`@beep/shacl` — `packages/drivers/shacl/src/Shacl.validation.ts`;
`@beep/ontology-use-cases` —
`packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`,
`packages/ontology/use-cases/test/Session.validation.test.ts`.

Some strategies also need policy, not only code: a missing `minCount` value
needs a trustworthy value source; datatype repair may replace data; `maxCount`
repair is destructive. Current verification only proves that the same violation
tuple disappeared, not that global conformance improved or that no new
violation appeared. Those strategies should not silently reuse the read-only
repair posture. (`@beep/ontology-use-cases` —
`packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`)

### 8. `ontology-*` skill assumptions and native replacements

**NOT FOUND in repo:** there are no `ontology-*` directories or `SKILL.md`
files under this checkout's `.claude/skills/`. The capture's path claim is stale
for this branch. (repository path audited: `.claude/skills/`)

Similarly named user-level skills are available outside the repository under
`~/.agents/skills/ontology-*/SKILL.md`. They are context evidence only, not
in-repo bricks and are intentionally excluded from `research/SOURCES.md`'s
in-repo table. Their CLI assumptions and the closest current native surface are:

| User-level skill | Assumed external CLI/tooling | Closest native replacement | Still missing natively |
| --- | --- | --- | --- |
| `ontology-requirements` | `rdflib` SPARQL parser for CQ syntax checks | `RunOntologySparql` executes schema-typed SELECT/CONSTRUCT queries. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts`) | **NOT FOUND:** syntax-only validation, CQ manifest/test-suite orchestration, or traceability tools. |
| `ontology-scout` | `runoak`/oaklib registry search and term inspection; ROBOT validate/reason/report/extract/verify | Open, snapshot/search, SPARQL, structural infer, and SHACL validate cover local inspection. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/{Session.rpc,Session.projections,Session.sparql,Session.reasoner,Session.validation}.ts`) | **NOT FOUND:** OLS/BioPortal/OBO registry adapters, module extraction/MIREOT, license scoring, or full reasoner/report parity. |
| `ontology-conceptualizer` | `runoak` search/info/tree | Snapshot hierarchy plus local resource search can replace local taxonomy browsing. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts`) | **NOT FOUND:** external term search, BFO alignment workflow, or schema-typed conceptual-model artifacts. |
| `ontology-architect` | ROBOT template/merge/convert/annotate/reason/report; oaklib/KGCL; OWLAPY, rdflib, owlready2; LinkML generators; pySHACL | Typed add/remove-quad batches, preview/save, structural infer, SHACL validation/verified repair, and PROV export cover a bounded authoring loop. (`@beep/ontology-domain` — `packages/ontology/domain/src/aggregates/Session/Session.model.ts`; `@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/{Session.rpc,Session.reasoner,Session.validation}.ts`) | **NOT FOUND:** semantic KGCL commands, ROBOT bulk templates/imports/conversion/reports, complex axiom builders, LinkML generation, or complete OWL DL reasoning. |
| `ontology-curator` | oaklib/KGCL maintenance; ROBOT diff/reason/report/annotate/convert/extract/release | Ordered change log, real batch delta, undoable operations, atomic save, and PROV sidecars replace the basic audited edit path. (`@beep/ontology-domain` — `packages/ontology/domain/src/aggregates/Session/Session.model.ts`; `@beep/ontology-server` — `packages/ontology/server/src/aggregates/Session/Session.file-store.ts`; `@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`) | **NOT FOUND:** term deprecation/version/release semantics, ontology diff reports, import refresh, or multi-format release generation. |
| `ontology-mapper` | oaklib `lexmatch`; SSSOM validate/merge/dedupe/convert; ROBOT query | Native SPARQL can inspect a loaded mapping graph. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts`) | **NOT FOUND:** an SSSOM domain model, lexical matcher, mapping validation/conversion, confidence triage, or clique analysis tool. |
| `ontology-validator` | ROBOT ELK/HermiT reason/report/verify/query/diff; pySHACL; SSSOM validator | Structural inference, SHACL validation, safeguarded SPARQL, and real-driver competency tests cover a bounded subset. (`@beep/ontology-use-cases` — `packages/ontology/use-cases/src/aggregates/Session/{Session.reasoner,Session.validation,Session.sparql}.ts`; `@beep/ontology-server` — `packages/ontology/server/test/OntoauthorMatCompetency.test.ts`) | **NOT FOUND:** complete DL reasoning, ROBOT quality reports, CQ-suite runner, ontology diff, anti-pattern bundle, metrics report, or SSSOM validation. |

The native surface can replace the skills' common local loop—open, inspect,
query, apply typed changes, infer within the bounded structural profile,
validate, save, and export provenance—but not their registry, extraction,
mapping, rich OWL authoring, full-DL, or release-pipeline responsibilities.

### Constraints and largest in-repo gaps

1. **Session identity is not session ownership.** The present RPCs move complete
   client-owned session snapshots; a handle-based MCP surface, live human/agent
   collaboration, and coherent shared undo all require a new server-side
   session/revision contract. (`@beep/ontology-domain`,
   `@beep/ontology-client`, `@beep/ontology-use-cases` — Session model, atoms,
   and service paths cited above)
2. **Mutation safety is library-only.** Batch/schema/path safeguards exist, and
   `@beep/mcp-kit` has destructive hints plus TierGate, but there are no hard
   batch/result budgets, production gate wiring, persisted audit receipts,
   idempotency/revision checks, or actor attribution. (`@beep/mcp-kit` —
   `packages/foundation/capability/mcp-kit/src`; ontology Session paths cited
   above)
3. **Transport and live-session reachability are unresolved.** All reusable MCP
   drivers are stdio-only; the desktop's stdio is already Effect RPC, while a
   separate MCP process cannot see unsaved UI state. **NOT FOUND:** HTTP/socket
   MCP hosting or a transport multiplexer. (MCP driver `src/Server.ts` files;
   `@beep/professional-desktop` — `apps/professional-desktop/server/main.ts`)
4. The repair registry needs shared SHACL result/schema enrichment before a
   component strategy table can be reliable. (`@beep/semantic-web`,
   `@beep/shacl`, `@beep/ontology-use-cases` — validation paths cited above)
5. The bounded structural reasoner and SHACL subset do not replace ROBOT /
   HermiT / oaklib / SSSOM workflows. (`@beep/ontology-use-cases` —
   `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts`;
   `@beep/semantic-web` —
   `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`)
