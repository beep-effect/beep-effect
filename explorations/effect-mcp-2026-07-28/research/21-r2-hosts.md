# Lane 21-r2-hosts — In-repo MCP hosts, launchers, clients, and harnesses

Research lane for exploration packet `effect-mcp-2026-07-28`. Evidence collected
2026-09-16 against the beep-effect lane checkout and the Effect clone at
`a7a71921de` (diff base `effect@4.0.0-rc.115`). Absolute home paths are written
as `$HOME/...`.

Working assumptions challenged here: **G4** (`McpProtocol.v2026_07_28` only on
every in-repo server) and **G6** (in-repo launchers, harnesses, and
`RpcClient` code are in scope). External agent binaries remain out of G6;
repo-owned first messages that those launchers would send are in.

---

## Shared Effect facts this lane depends on (11-u2 area)

Cited here because they decide whether G4 is implementable for the hosts and
clients this lane owns. Runtime detail remains 11-u2's.

1. **Stateful selection ignores a stateless-only list.**
   `selectStatefulProtocol` keeps only adapters whose `runtime._tag === "Stateful"`
   (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:182-187`).
2. **A `v2026_07_28`-only server rejects `initialize` on the prepare path**
   with `ProtocolError` code `UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE` (`-32022`)
   and message
   `"initialize is not supported by the configured MCP protocols (requested '<offeredVersion>')"`
   (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:33`,
   `effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:319-326`).
3. **Stdio takes the same `initialize` path.** The stdio codec calls
   `selectStatefulProtocol` when the frame is `initialize`
   (`effect:packages/effect/src/unstable/ai/McpServer.ts:1484-1486`).
4. **HTTP is stricter before that error is reached.** Header names are
   lower-cased `mcp-session-id`, `mcp-protocol-version`, `mcp-method`,
   `mcp-name` (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:27-30`).
   On a stateless-only server, an `initialize` JSON-RPC request with an `id`
   is classified as a stateless request
   (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:218-226`).
   Missing `MCP-Protocol-Version` then returns HTTP 400
   `"MCP-Protocol-Version header is required"` with
   `HEADER_MISMATCH_ERROR_CODE` `-32020`
   (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:228-230`,
   `effect:packages/effect/src/unstable/ai/McpSchema.ts:595`).
   Stateless HTTP also requires `_meta["io.modelcontextprotocol/protocolVersion"]`,
   `_meta["io.modelcontextprotocol/clientCapabilities"]`, `Mcp-Method` matching
   the JSON-RPC method, and `Mcp-Name` for `tools/call` / `prompts/get`
   (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:31-32`,
   `effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:231-278`).
5. **Mixed lists are an upstream feature, not a beep invention.** Effect
   allows at most one stateless adapter in the list
   (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:193-209`).
   **This contradicts G4 as the only viable pin.** Labelled
   `decision-challenge` below.
6. **Public `McpSchema.ClientRpcs` is still the stateful group.** It includes
   `Initialize` and does not include `server/discover`
   (`effect:packages/effect/src/unstable/ai/McpSchema.ts:2982-2995`,
   `effect:packages/effect/src/unstable/ai/McpSchema.ts:3034`).
   The 2026 adapter's client group is `Discover`, `Complete`, prompts,
   resources, `SubscriptionsListen`, `CallTool`, `ListTools` — no
   `initialize` (`effect:packages/effect/src/unstable/ai/internal/mcpSchema/v2026_07_28.ts:378-382`,
   `effect:packages/effect/src/unstable/ai/internal/mcpSchema/v2026_07_28.ts:614-625`).
   That 2026 group is `@internal`. Reverse-client methods on 2026 fail
   (`roots/list`, `sampling/createMessage`, `elicitation/create`)
   (`effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts:683-687`).
7. **Effect's generic `RpcClient` HTTP protocol does not set the 2026 routing
   headers.** A repo-wide search of `packages/effect/src/unstable/{rpc,ai}`
   finds `mcp-method` / `MCP-Protocol-Version` / `Mcp-Name` only in
   `mcpRuntime.ts` (server-side). In-repo HTTP clients that use
   `RpcClient.layerProtocolHttp` therefore cannot satisfy the 2026 header
   contract unless they inject those headers themselves.

Effect test names that pin the initialize-rejection string were **NOT FOUND**
under `packages/effect/test/` (search for `initialize is not supported` and
`not supported by the configured MCP`). The rejection is implemented; a named
conformance test for the exact message is UNVERIFIED in this lane.

---

## 1. Host inventory

Every in-repo MCP host that constructs an Effect `McpServer` pins **only**
`McpProtocol.v2025_06_18`. None pin `v2026_07_28`. `@beep/mcp-kit` does not
construct a server; it is the shared registration brick (G9).

Cross-host constants (every host unless a row says otherwise):

- **Prompts / resources:** none registered. Searches for `registerPrompt` /
  `registerResource` / `elicitation` / `sampling` on host sources returned no
  MCP registrations (nlp-mcp "sampling" hits are file-sampling tools).
- **Reverse-client use:** none. Hosts never call `listRoots` / `createMessage`
  / `elicit`. Tests that supply `McpServerClient` stub `getClient` as
  `Effect.die("the fixture client is never dereferenced")`.
- **`failureMode`:** every host tool that declares it uses `"return"`. No
  `"error"` / omit-to-defect tools found on these surfaces.
- **CORS:** stdio hosts have none. HTTP only on the ontology sidecar.

### 1.1 Summary table

| Host | Transport | Protocol pin | Name / version | Toolkits (count) | Non-object success | `failureMode` | Prompts / resources | Reverse-client | Auth | CORS allow / expose | Bin / entrypoint | Wire tests | JSDoc / docs naming protocol |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@beep/nlp-mcp` | `McpServer.layerStdio` | `repo:packages/drivers/nlp-mcp/src/Server.ts:115` `[v2025_06_18]` | `beep-nlp` / `0.0.0` (`repo:packages/drivers/nlp-mcp/src/bin.ts:35`) | `NlpToolkit` 25 + `StreamingToolkit` 17 = **42** | none found (all `S.Class` / `S.toEncoded(Class)`) | `"return"` on all 25+17 tools | none | none | none at MCP layer | n/a | `src/bin.ts` (no `package.json` `bin`; launched by `.mcp.json`) | no JSON-RPC wire test; `test/Server.test.ts` counts tools; `test/SanitizedSpan.test.ts` in-process `callTool`; `test/integration/Streaming.test.ts` toolkit.handle | JSDoc: "stdio initialization", "NDJSON-RPC framing" (`Server.ts:56,76`). Version string `2025-06-18` only in tests. |
| `@beep/m365-mcp` | `McpServer.layerStdio` | `repo:packages/drivers/m365-mcp/src/Server.ts:72-76` `[v2025_06_18]` | `beep-m365` / `0.1.0` (`bin.ts:13-16`, `src/index.ts:65`) | `M365Toolkit` **11** | none (collection classes) | `"return"` on all 11 | none | none | M365 driver credentials, not MCP-layer | n/a | `src/bin.ts` (no `package.json` `bin`) | **yes:** `test/Server.test.ts` stdio NDJSON `initialize` → `notifications/initialized` → `tools/list` → `tools/call` | config JSDoc "advertised during stdio initialization" (`Server.ts:40`). Version string in the wire test. |
| `@beep/uspto-mcp` | `McpServer.layerStdio` | `repo:packages/drivers/uspto-mcp/src/Server.ts:96` `[v2025_06_18]` | `beep-uspto` / `0.0.0` (`src/bin.ts:32`) | `UsptoToolkit` **2** | **`uspto_search_applications`** `success: S.Array(UsptoApplicationMetadata)` (`UsptoTools.ts:219`) | `"return"` on both | none | none | kit `SourceAuth` **soft** `USPTO_API_KEY` (`UsptoSourceAuth.ts:35-39`); `composeGatedLayers` always mounts | n/a | `src/bin.ts` `runUsptoMcpServer` + `import.meta.main` (no `package.json` `bin`) | no wire test; `test/Server.test.ts` in-process `callTool` with stub client `protocolVersion: "2025-06-18"` | config JSDoc "stdio initialization" (`Server.ts:48`). |
| `@beep/gov-legal-mcp` | `McpServer.layerStdio` | `repo:packages/drivers/gov-legal-mcp/src/Server.ts:95` `[v2025_06_18]` | `beep-gov-legal` / `VERSION` `"0.0.0"` (`src/bin.ts:29`, `src/_generated/version.ts:23`) | `EcfrToolkit` 3 + `GovinfoToolkit` 1 = **4** (GovInfo vanishes when `GOVINFO_API_KEY` absent) | none (`Search.Success` is a Class) | `"return"` on all 4 | none | none | eCFR `none` (always mounted); GovInfo **hard** `GOVINFO_API_KEY` (`SourceAuth.ts:31-55`) | n/a | `src/bin.ts` `runGovLegalMcpServer` + `import.meta.main` (no `package.json` `bin`) | no wire test; `test/Server.test.ts` in-process `callTool` + stub `2025-06-18` | config JSDoc "stdio initialization" (`Server.ts:48`). |
| `@beep/law-practice-server` + `apps/practice-kg-mcp` | `McpServer.layerStdio` | `repo:packages/law-practice/server/src/Tools.ts:133` `[v2025_06_18]` | `beep-practice-kg` / `0.0.0` (`apps/practice-kg-mcp/src/runtime/Host.ts:108-111`) | `PracticeKgToolkit` **9** | none (`PracticeKgToolResult` Class) | `"return"` via `readTool` (`PracticeKg.tools.ts:646`) | none | none | kit `SourceAuth` **none** `PRACTICE_KG_BUNDLE_DIR` (`Tools.ts:57-61`); bundle dir required at the app CLI | n/a | `apps/practice-kg-mcp` `package.json` `bin.practice-kg-mcp` → `src/bin.ts` | **yes:** `apps/practice-kg-mcp/src/smoke.ts` pipes NDJSON `initialize` `2025-06-18`. Host unit tests do not speak the wire. `packages/law-practice/server/test/PracticeKg.projections.test.ts` in-process `callTool` + stub `2025-06-18` | JSDoc example name/version (`Tools.ts:71`). Smoke schemas named "MCP initialization" (`smoke.ts:44,49`). |
| professional-desktop ontology sidecar | `McpServer.layerHttp` path `/mcp` | `repo:apps/professional-desktop/server/OntologyMcpTransport.ts:176-185` `[v2025_06_18]` | `beep-ontology` / `0.0.0` (literals on the `layerHttp` call) | `OntologyReadOnlyToolkit` 6 always; + `OntologyMutationToolkit` 3 when `ONTOLOGY_MCP_MUTATIONS_ENABLED`; + `OntologyPublishToolkit` 1 when destination allowlist non-empty. Full union **10** | none (all `makeTool` Class responses) | `"return"` in `makeTool` (`OntologyToolkit.ts:717`) | none | none | Origin allowlist + RPC session token (`requireRpcSessionToken`) + `layerHttp.allowedOrigins` (must mirror the allowlist or browser Origin is 403) | **allow:** `authorization`, `content-type`, `mcp-protocol-version`, `mcp-session-id`. **expose:** `mcp-protocol-version`, `mcp-session-id`. Methods `POST`, `OPTIONS`. **Missing for 2026:** `mcp-method`, `mcp-name` (`OntologyMcpTransport.ts:100-105`) | no bin; mounted by the desktop server | **yes:** `test/integration/support/ontology-mcp-harness.ts`, `ontology-mcp-http.test.ts`, `execution-authority.pglite.test.ts` (all `initialize` `2025-06-18`) | transport JSDoc describes `/mcp` and Origin; does not name `2025-06-18`. `OntologyMcpConfig` has `mutationsEnabled` only (`packages/ontology/config/src/McpConfig.ts:66-76`). |
| `@beep/mcp-kit` (not a host) | n/a | none | n/a | registration helpers | n/a | documents `"return"` for `ApiKeyRequired` | n/a | n/a | `SourceAuth` / `TierGate` consumed by hosts | n/a | n/a | in-process only; stub client `2025-06-18` (`test/fixtures/McpClient.ts:21-32`) | **README pins MCP protocol `2025-06-18`** (`packages/foundation/capability/mcp-kit/README.md:7`). `SanitizedSpan.ts:199-202` assumes session id minted at `initialize`. |

### 1.2 Per-host toolkit and tool names

**nlp-mcp.** `NlpTools` is a 25-element list (`NlpToolkit.ts:92-118,146`);
JSDoc example count is 25 (`NlpToolkit.ts:86`). Names: `Analyze`,
`BagOfWords`, `BowCosineSimilarity`, `ChunkBySentences`, `CorpusStats`,
`CreateCorpus`, `DeleteCorpus`, `DocumentStats`, `ExtractEntities`,
`ExtractKeywords`, `LearnCorpus`, `LearnCustomEntities`, `NGrams`,
`Paragraphize`, `PhoneticMatch`, `QueryCorpus`, `RankByRelevance`,
`RemoveStopWords`, `Sentences`, `Stem`, `TextSimilarity`, `Tokenize`,
`TransformText`, `TverskySimilarity`, `WordCount`. Each uses
`failureMode: "return"` and `success: S.toEncoded(<Class>)`.
`StreamingToolkit` is 17 tools (`StreamingTools.ts:1938-1956`; handlers
comment "17" at `StreamingHandlers.ts:4`): `stream_read_lines`,
`stream_file_info`, `stream_text_stats`, `stream_sample_lines`,
`stream_read_jsonl`, `stream_jsonl_stats`, `stream_validate_jsonl`,
`stream_sample_jsonl`, `stream_load_text`, `stream_load_lines`,
`stream_load_jsonl`, `stream_load_json`, `stream_process_file`,
`stream_filter_lines`, `stream_extract_matches`, `stream_count_lines`,
`stream_count_jsonl`. Success schemas are object Classes (`LinesOutput`,
`FileInfoOutput`, `CountOutput`, …). Combined-surface test: 42 unique names
(`nlp-mcp/test/Server.test.ts:17-28`).

**m365-mcp.** Tools (`M365Tools.ts:394-406` and the name assertion at
`test/Server.test.ts:237-249`): `m365_list_drives`, `m365_list_sites`,
`m365_get_site`, `m365_delta_drive_items`, `m365_download_drive_item_content`,
`m365_get_list_item`, `m365_list_drive_item_versions`, `m365_list_messages`,
`m365_get_message`, `m365_list_events`, `m365_get_event`.

**uspto-mcp.** `UsptoToolkit.make(UsptoSearchApplicationsTool, UsptoGetDocumentsTool)`
(`UsptoTools.ts:306`). `uspto_search_applications` success is **not an
object**: `S.Array(UsptoApplicationMetadata)` (`UsptoTools.ts:213-219`).
`uspto_get_documents` success is a tagged-union object
(`DocumentsProjectionOutput`, `_tag: "Inline" | "Fetchable"`,
`UsptoDocumentTiers.ts:101-132`). 11-u2 owns how 2026 projects non-object
`structuredContent`; this host is the in-repo caller of that path.

**gov-legal-mcp.** `govinfo_search`, `ecfr_list_titles`, `ecfr_search_results`,
`ecfr_get_structure` (`Tools.ts:42-47,221,256`). `Search.Success` extends
`SearchResponse` Class (`govinfo` `Search.contract.ts:87-93`).

**practice KG.** Nine tools (`law-practice/use-cases/src/Tools.ts:35-45`):
`kg_clients`, `kg_docket_family`, `kg_application_lookup`, `kg_find`,
`corpus_search_text`, `corpus_get_document`, `email_search`,
`kg_candidate_claims`, `kg_provenance`. Closed-world read-only hints
(`PracticeKg.tools.ts:629-634`).

**ontology.** Read-only (`OntologyToolkit.ts:919-926`):
`ontology_open_inspect`, `ontology_snapshot_describe`, `ontology_search`,
`ontology_sparql_query`, `ontology_validate`, `ontology_capability_metadata`.
Mutation (`:937`): `ontology_propose_change_batch`, `ontology_repair`,
`ontology_export_provenance`. Publish (`:954`):
`ontology_publish_provenance`. Registration is config-gated inside
`Layer.unwrap` (`OntologyMcpTransport.ts:266-275`): mutations off → read-only
only; mutations on + empty destination allowlist → read-only + mutation;
non-empty allowlist → those plus publish.

### 1.3 Ontology HTTP security (host-owned; 24-r5 owns Effect defaults)

Allowed origins (`OntologyMcpTransport.ts:50-57`):

- `http://professional-desktop.beep.localhost:1355`
- `http://localhost:1421`
- `http://127.0.0.1:1421`
- `tauri://localhost`
- `http://tauri.localhost`

`layerHttp.allowedOrigins` is set to the same list because Effect's Origin
check default-denies browser Origin when unset (`OntologyMcpTransport.ts:181-185`).
CORS `allowedHeaders` currently lists `mcp-protocol-version` and
`mcp-session-id` but **not** `mcp-method` or `mcp-name`
(`OntologyMcpTransport.ts:100-105`). A browser client speaking 2026-07-28
would fail CORS preflight for those headers even if the server accepted them.
Stdio hosts are unaffected.

Governed mutation/publish dispatch freezes a **per-session** grant set with a
12-hour TTL (`OntologyMcpTransport.ts:132-134,191-204,239-254`). Whether any
`McpRequestContext` field is stable across HTTP requests on 2026 is 11-u2 /
22-r3; if none is, this host's TierGate identity model is a G4 cost, not a
kit-only concern.

---

## 2. Client and harness inventory

G6 in-scope. Every repo-owned first message found is **stateful `initialize`
with `protocolVersion: "2025-06-18"`**. None send `server/discover`. None set
`Mcp-Method` or `Mcp-Name`. None put
`io.modelcontextprotocol/protocolVersion` in `_meta`.

### 2.1 `repo:.mcp.json`

In-repo server entry:

```json
"nlp": { "type": "stdio", "command": "bun", "args": ["run", "./packages/drivers/nlp-mcp/src/bin.ts"] }
```

(`repo:.mcp.json:25-28`). No protocol-version field, no headers. The
consuming agent binary chooses the handshake. This lane cannot prove what
Claude Code / Cursor send (Gate A finding 25). What **is** proven: the
launched server is nlp-mcp on `v2025_06_18` only, so any client that sends
`initialize` against a G4-flipped nlp-mcp hits the stdio rejection in §Shared
fact 2–3.

Other `.mcp.json` entries are third-party (`shadcn`, `next-devtools`,
`serena`, `fallow`, `chrome-devtools`, `webstorm`, `phoenix-docs`,
`phoenix`) and are out of G9. One-line note: they are not beep hosts and do
not pin Effect `McpProtocol`.

### 2.2 Ontology HTTP harness — `ontology-mcp-harness.ts`

First RPC (`repo:apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts:247-254`):

```ts
yield* client.initialize({
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "ontology-mcp-http-test", version: "0.0.0" },
});
```

Client construction: `RpcClient.make(McpSchema.ClientRpcs)` (`:248`) — the
**public stateful** group (`effect:.../McpSchema.ts:3034`), which has
`initialize` and not `server/discover`.

HTTP headers on every request (`:189-195`):

| Header | Value today | 2026-only server |
| --- | --- | --- |
| `accept` | `application/json, text/event-stream` | still required for streamable HTTP |
| `authorization` | RPC session token | still required by host middleware |
| `origin` | `http://professional-desktop.beep.localhost:1355` | still required by Origin allowlist |
| `mcp-session-id` | **replayed after initialize** from the response (`:149-169`) | unused / ignored on stateless HTTP; first request has none |
| `mcp-protocol-version` | **replayed after initialize** (`:150,169`) | **required on the first request**; missing → HTTP 400 `"MCP-Protocol-Version header is required"` |
| `mcp-method` | **not sent** | required; mismatch → HTTP 400 `"Mcp-Method header does not match request method"` |
| `mcp-name` | **not sent** | required on `tools/call` |
| `_meta` protocol / clientCapabilities | **not sent** | required on stateless requests |

Session assumption (`:145-148`): "`initialize` negotiates both a session id
and a protocol version, and the streamable HTTP transport answers 400 to any
later request that fails to echo them back." That is the 2025-06-18
streamable-HTTP contract. A 2026-only server does not mint a session at
`initialize` (there is no `initialize`).

**What fails under G4:** `makeMcpClient` cannot complete. The first POST is
`initialize` without `MCP-Protocol-Version`, classified as a stateless
request, rejected 400 header-mismatch. Even after adding the version header,
the public `ClientRpcs` group has no `server/discover` method to call, and
`tools/call` still lacks `Mcp-Name` / `_meta`.

### 2.3 Raw HTTP initialize — `ontology-mcp-http.test.ts`

Literal body (`:121-122`):

```
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"ontology-mcp-http-test","version":"0.0.0"}}}
```

Posted to `/mcp` with caller-supplied headers (`:124-133`). Used to prove
Origin 403 and missing-auth 401 (`:189-201`). Under G4 the Origin/auth
middleware still runs first; an allowed+authenticated initialize then hits
the Effect 400 header-mismatch (or, if headers were added, the protocol
error). The test does not send `Mcp-Method` / `Mcp-Name` /
`MCP-Protocol-Version`.

### 2.4 `execution-authority.pglite.test.ts`

Same harness: `makeMcpClient` / `withHttpServer` imported from
`ontology-mcp-harness.ts` (`:42-47`) and called at `:177`, `:364`, `:475`,
`:536`. Same first message as §2.2. Under G4 this entire PGlite authority
suite fails before any tool dispatch.

### 2.5 Live proof client — `goals/ontology-agent-surface/ops/live-mcp-client.ts`

`RpcClient.make(McpSchema.ClientRpcs)` (`:55`). First call (`:56-60`):

```ts
client.initialize({
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "beep-ontology-live-proof", version: "0.0.0" },
});
```

Custom `fetch` captures `Mcp-Session-Id` from the response and sets it on
later requests (`:24-39`). Headers set at protocol construction (`:45-50`):
`authorization`, `origin`. No `MCP-Protocol-Version` on the first request, no
`Mcp-Method`, no `Mcp-Name`. Session-id stability is a hard assumption of
this client. Under G4: same HTTP 400 as the harness; subsequent
`tools/list` / `tools/call` never run.

### 2.6 m365 stdio wire test — `packages/drivers/m365-mcp/test/Server.test.ts`

First stdin frame (`:120,282`):

```
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"m365-mcp-test","version":"0.0.0"}}}
```

Then, after seeing `"id":1` in stdout, `notifications/initialized` and
`tools/list` (`:121-127,142-144`); then `tools/call` `m365_list_drives`
(`:128,147-149`). Framing: one JSON object per line (`encodeRequest` appends
`\n`, `:132`). No MCP HTTP headers (stdio). Under G4 the first frame is
`initialize`; `selectStatefulProtocol` returns `undefined`; the server
answers the ProtocolError in §Shared fact 2. The test asserts `"id":1"`
appears in stdout (`:290`) and would see an error payload instead of an
initialize result.

### 2.7 practice-kg compiled smoke — `apps/practice-kg-mcp/src/smoke.ts`

Pipe script (`:203-208`):

1. `initialize` `protocolVersion: "2025-06-18"` `clientInfo.name: "compiled-smoke"`
2. `notifications/initialized`
3. `tools/list`
4. `tools/call` `corpus_search_text`

Decoded as `SmokeInitializeResponse` requiring `serverInfo.name === "beep-practice-kg"`
(`:42-54`). Under G4 step 1 fails; the smoke cannot decode an initialize
result.

### 2.8 In-process stub clients (not wire, still G4-adjacent)

These do not speak JSON-RPC, but they hard-code the stateful caller shape
(`protocolVersion: "2025-06-18"` plus `initializePayload`):

| File | Lines |
| --- | --- |
| `packages/foundation/capability/mcp-kit/test/fixtures/McpClient.ts` | `:21-32` |
| `packages/drivers/nlp-mcp/test/SanitizedSpan.test.ts` | `:47-58` |
| `packages/drivers/m365-mcp/test/SanitizedSpan.test.ts` | `:79-86` (same shape) |
| `packages/drivers/uspto-mcp/test/Server.test.ts` | `:105-118` |
| `packages/drivers/gov-legal-mcp/test/Server.test.ts` | `:197-204` |
| `packages/law-practice/server/test/PracticeKg.projections.test.ts` | `:430-437` |

A 2026-only server still serves `callTool` in-process if the stub's
`protocolVersion` field type still accepts `"2026-07-28"` (11-u2 /
`McpServerClient` shape). These suites are **not** proof the wire works.
They **are** proof that host tests encode the 2025 initialize payload as the
caller identity. G4 does not require rewriting them to keep `callTool`
green, but leaving `initializePayload.protocolVersion: "2025-06-18"` on a
2026-only server is a lie about the caller and may break anything that
branches on `client.protocolVersion`.

nlp-mcp `test/Server.test.ts` and `test/integration/Streaming.test.ts` never
construct `McpServer` over a transport. gov-legal / uspto `Server.test.ts`
use `McpServer.McpServer.layer` + `callTool`, not `layerStdio`.
`apps/practice-kg-mcp/test/Host.test.ts` tests bundle loading only.

### 2.9 What a 2026-07-28-only server would change for each client

| Client | Today | Against `protocols: [v2026_07_28]` |
| --- | --- | --- |
| `.mcp.json` `nlp` (agent-launched stdio) | unknown agent handshake; server is 2025-only | any `initialize` is rejected on stdio. Live probe still UNVERIFIED (Gate A #25). |
| m365 stdio wire test | NDJSON `initialize` | ProtocolError "initialize is not supported… (requested '2025-06-18')" |
| practice-kg smoke | NDJSON `initialize` | same ProtocolError; smoke decode of `SmokeInitializeResult` fails |
| ontology harness / HTTP tests / execution-authority / live-mcp-client | `RpcClient` `initialize` + session replay | first POST: HTTP 400 `-32020` "MCP-Protocol-Version header is required". Public `ClientRpcs` cannot express `server/discover`. CORS blocks `mcp-method` / `mcp-name` from browsers. |
| in-process stubs | `callTool` with fake 2025 client | likely still dispatch; identity fields stale |

**G4 + G6 together are a decision-challenge:** a `v2026_07_28`-only pin
breaks every in-repo wire client this lane found. Effect supports a mixed
list with one stateless adapter (`mcpRuntime.ts:193-209`). Keeping
`v2025_06_18` beside `v2026_07_28` is the option that preserves today's
harnesses without rewriting them. That option **contradicts G4**.

Rewriting in-repo clients to speak 2026 requires, at minimum:

1. A client RPC group that includes `server/discover` (public `McpSchema.ClientRpcs` does not; the 2026 group is `@internal`).
2. Injecting `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` on HTTP (generic `RpcClient.layerProtocolHttp` does not).
3. `_meta["io.modelcontextprotocol/protocolVersion"]` and `_meta["io.modelcontextprotocol/clientCapabilities"]` on every stateless request.
4. Dropping session-id capture/replay.
5. Expanding ontology CORS `allowedHeaders` with `mcp-method` and `mcp-name`.
6. Replacing stdio `initialize` / `notifications/initialized` sequences in m365 tests and practice-kg smoke.

There is no public Effect helper in `McpProtocol.ts` that builds a 2026
`RpcClient` (the public module exports adapters, not a 2026 client group;
`effect:packages/effect/src/unstable/ai/McpProtocol.ts:196`). How beep should
obtain that group is a grill question.

---

## 3. Config schemas

**None of the in-repo MCP config schemas model a protocol version.**

### 3.1 `@beep/ai-sync`

Generated cells (`packages/tooling/library/ai-sync/src/_generated/schemas.gen.ts`):

- `CodexMcpServer`: `command`, `args`, `env`, `url`, `headers`, `timeout_ms` (`:31-43`).
- `McpJsonServer`: `type` (`stdio` \| `http` \| `sse`), same transport fields (`:152-169`).
- `ClaudeMcpJson`: `mcpServers: Record<string, McpJsonServer>` (`:188-195`).
- `ClaudeSettings`: `enabledMcpjsonServers`, `enabledPlugins`, `hooks` (`:215-224`).

Transforms (`src/transforms.ts:20-73`) copy those transport fields both
ways. A `protocolVersion` / `McpProtocol` key is **NOT FOUND** under
`packages/tooling/library/ai-sync`. `headers` could carry a static
`MCP-Protocol-Version` for HTTP servers, but nothing validates or requires
it. `.mcp.json` validation through `ClaudeMcpJson` would still accept
today's nlp stdio entry after a G4 flip, because the schema does not know
about protocols.

### 3.2 Root and plugin MCP JSON

- `repo:.mcp.json` — transport only; see §2.1.
- `repo:.ai/mcp/mcp.json` — **empty file** (0 bytes). No servers, no protocol.
- `repo:plugins/github/.mcp.json` — third-party HTTP `https://api.githubcopilot.com/mcp/` (`bearer_token_env_var`). Referenced from `plugins/github/.codex-plugin/plugin.json` `mcpServers: "./.mcp.json"`.
- `repo:plugins/notion/.mcp.json` — third-party HTTP `https://mcp.notion.com/mcp`. Same plugin.json pattern.
- `repo:plugins/box/` — **NOT FOUND** `.mcp.json`.

No plugin config names `2025-06-18` or `2026-07-28`.

### 3.3 Host identity / mutation config

Host `*McpServerConfig` classes are `{ name, version }` advertised at
**stdio initialization** (nlp `Server.ts:53-64`, m365 `:37-49`, uspto
`:45-57`, gov-legal `:45-57`, practice-kg `Tools.ts:78-86`). They do not
carry a protocol list; the list is a literal in `makeServerLayer`.

`OntologyMcpServerConfig` is `{ mutationsEnabled: boolean }`
(`packages/ontology/config/src/McpConfig.ts:66-76`) plus
`ONTOLOGY_MCP_MUTATIONS_ENABLED` (`:47-49`). No protocol field. The
protocol pin lives only on `McpServer.layerHttp` in
`OntologyMcpTransport.ts:180`.

---

## 4. Per-host migration notes and cross-host patterns

### 4.1 Options (operator decides; G4-contradicting options labelled)

| Option | What it is | Tradeoff | G4 |
| --- | --- | --- | --- |
| **A. G4 as written** | Every host `protocols: [McpProtocol.v2026_07_28]` | Breaks every in-repo wire client in §2 until they are rewritten; CORS gap on ontology; no public 2026 `ClientRpcs`; USPTO array success needs 11-u2's non-object projection | matches G4 |
| **B. Mixed list** | `protocols: [McpProtocol.v2025_06_18, McpProtocol.v2026_07_28]` (order per 11-u2) | Preserves `initialize` clients; 2026 clients can opt in via headers/`_meta`; Effect designed this (`mcpRuntime.ts:193-209`) | **contradicts G4** |
| **C. Split by client kind** | Keep 2025 on hosts with in-repo initialize clients (all of them, today); 2026-only only if a host has zero such clients | Today **every** host has at least a stub or a smoke/harness that assumes 2025. There is no "easy" host. | partial G4 |
| **D. Rewrite clients first, then G4** | Land a 2026-speaking harness/kit client, flip hosts second | Matches G4 and G6; blocked on a public or beep-owned 2026 RPC group and HTTP header injector | matches G4, larger PR |

### 4.2 Per-host notes

**nlp-mcp.** Highest launcher blast radius: it is the only in-repo server in
`.mcp.json`. No stdio wire test exists, so a G4 flip can ship with unit tests
green and still break editor sessions. JSDoc (`Server.ts:76`) documents
NDJSON-RPC and "stdio initialization" — both stateful-lifecycle language.
Add a stdio initialize-or-discover smoke before flipping. Two toolkits share
one `layerStdio` via `Layer.mergeAll` (`Server.ts:110-116`); the protocol
literal is the single pin.

**m365-mcp.** Only driver host with a real stdio JSON-RPC conversation test
(`test/Server.test.ts:268-296`). That test **is** the migration canary for
stdio framing. Advertised version `0.1.0` disagrees with package.json
`0.0.0` — unrelated to protocol, but the initialize result carries it.

**uspto-mcp.** Soft-gated `api_key_required` envelope is kit-owned and
orthogonal to protocol. **Non-object success array** on
`uspto_search_applications` is the only confirmed host-side structuredContent
risk for 2026. Do not flip this host without 11-u2's non-object projection
answer. No wire test.

**gov-legal-mcp.** Hard-gate vanishing of GovInfo is composition-time, not
session-time — compatible with stateless. No wire test. Four object success
schemas.

**practice-kg.** Compiled smoke (`smoke.ts`) and `SmokeInitializeResponse`
are load-bearing for the `.mcpb` artifact. A G4 flip without rewriting the
pipe script and the initialize decode schemas fails `smoke:compiled`. App
`bin.practice-kg-mcp` is the only `package.json` bin among these hosts.

**ontology HTTP.** Largest client cluster (harness, HTTP tests, PGlite
authority tests, live proof client). CORS header list, Origin duplication
with `layerHttp.allowedOrigins`, RPC session token, and per-session TierGate
are all host-owned. G4 without mixed list implies: CORS allow
`mcp-method`/`mcp-name`; stop replaying `mcp-session-id`; first-request
`MCP-Protocol-Version`; replace `initialize` with `server/discover`; inject
routing headers in `transformClient`; revisit TierGate identity (22-r3).
`OntologyMcpConfig` does not need a protocol field unless the operator wants
the pin to be configurable rather than a literal.

**mcp-kit.** Centralize: (1) protocol-list helper so six hosts stop
copy-pasting `[McpProtocol.v2025_06_18]`; (2) stub `McpServerClient` that
does not claim `initializePayload` / `2025-06-18` once the pin moves; (3)
HTTP `transformClient` that sets 2026 routing headers from the RPC tag and
`params.name`; (4) drop the `SanitizedSpan.ts:199-202` comment that session
ids are minted at `initialize`, or gate it on stateful adapters; (5) README
line that still says MCP protocol `2025-06-18`. Kit does not own the pin
today — each host does — which is why G4 is a six-file literal edit plus the
client rewrite.

### 4.3 Cross-host patterns worth putting in the kit

1. **Single `protocols` literal.** Six copies of `[McpProtocol.v2025_06_18]`.
   A kit `stdioProtocols` / `httpProtocols` constant is the actual G4
   switch.
2. **Stdio NDJSON conversation helper.** Only m365 has one; practice-kg
   smoke reimplements it in `sh`. A shared harness that can send either
   `initialize` or `server/discover` would make the flip testable.
3. **HTTP 2026 header injector.** Every in-repo HTTP client uses
   `RpcClient.layerProtocolHttp` + `transformClient` for auth/origin and
   none for `Mcp-Method`/`Mcp-Name`. That injector belongs next to
   `sanitizedToolkit`, not copied into the desktop app.
4. **Stub caller.** Five packages duplicate `McpServerClient.of({
   protocolVersion: "2025-06-18", initializePayload: ... })`. The kit
   fixture is already the canonical one (`mcp-kit/test/fixtures/McpClient.ts`);
   hosts should import it (uspto/gov-legal/nlp/m365/practice-kg currently
   inline their own).
5. **CORS allow-list for 2026 routing headers.** Only one HTTP host, but the
   allow/expose lists should live next to the protocol helper so they cannot
   drift from `mcp-method` / `mcp-name`.
6. **Do not centralize SourceAuth / TierGate into the protocol flip.** Those
   are already kit-owned and protocol-agnostic except for session identity.

### 4.4 JSDoc / docgen files that name the protocol

| File | What it names |
| --- | --- |
| `packages/foundation/capability/mcp-kit/README.md:7` | `MCP protocol 2025-06-18` |
| every host `*McpServerConfig` JSDoc | "advertised during **stdio initialization**" |
| `packages/drivers/nlp-mcp/src/Server.ts:76` | **NDJSON-RPC** framing, stdio |
| `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:199-202` | session header minted at **`initialize`** |
| `apps/practice-kg-mcp/src/smoke.ts:44,49` | "MCP initialization" |
| host tests listed in §2.8 | literal `"2025-06-18"` |

No host `docgen.json` extra page that names `2025-06-18` was found beyond
source JSDoc / README. UNVERIFIED: generated docgen HTML output (this lane
did not run docgen).

---

## Gaps / UNVERIFIED

- Live handshake of Claude Code / Cursor / Codex against a 2026-only
  nlp-mcp stdio server (Gate A #25). Repo configs do not record what those
  binaries send.
- Effect test name that asserts the exact initialize-rejection message
  (implementation exists; named test NOT FOUND).
- Generated docgen HTML for host packages.
- Whether `McpServerClient.protocolVersion` becomes `"2026-07-28"` for
  in-process `callTool` after a G4 pin (11-u2).
- Whether USPTO `S.Array` success encodes as JSON array `structuredContent`
  on 2026 (11-u2 §8). Confirmed only that the schema is not an object.

## Gate B verdicts (2026-09-17)

Three grok refuters voted on 13 claims from this lane (13 survive, 0 killed; per-vote detail in `verification/21-r2-hosts.verdicts.jsonl`).

No claim was struck.
