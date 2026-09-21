# Lane 11-u2 — 2026-07-28 runtime semantics in Effect

Research lane for exploration packet `effect-mcp-2026-07-28`. Evidence is from
Effect upstream main at commit `a7a71921de` (read-only), unless marked `repo:`.
Paths under `effect:` are relative to the Effect repo root.

Working assumptions G1/G7, G4, G6, G9 are treated as operator grounding, not
facts. Challenges to those assumptions are labeled `decision-challenge`.

Public `McpSchema.ts` is the authoring surface, not the dated wire contract.
Wire decode/encode for this revision is
`effect:packages/effect/src/unstable/ai/internal/mcpSchema/v2026_07_28.ts`.

---

## 1. Protocol selection

### Adapter list construction

`McpRuntime.make` walks the configured protocol list once:

- First protocol with `runtime._tag === "Stateful"` becomes the sessionful
  runtime (`mcpStatefulRuntime.make()`). Later stateful adapters are still
  registered; they share that one session table. `selectStatefulProtocol`
  matches by offered `protocolVersion`, else falls back to the **first
  stateful** adapter
  (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:182-187`,
  `:193-209`).
- Stateless adapters: **at most one**. A second `runtime._tag === "Stateless"`
  fails **Layer construction** with
  `Cause.IllegalArgumentError("MCP runtime supports at most one stateless protocol")`
  (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:198-208`).
  This is not a per-request error.
- Duplicate versions fail in the registry:
  `Duplicate MCP protocol version: <version>`
  (`effect:packages/effect/src/unstable/ai/internal/mcpProtocolRegistry.ts:52-59`).
  Empty lists fail with `MCP protocol declaration must contain at least one MCP protocol`
  (`:45-48`).

`McpProtocol.v2026_07_28` is the only shipped `StatelessRuntimeDescriptor`
(`effect:packages/effect/src/unstable/ai/McpProtocol.ts:122-128`, `:196`;
`effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts:664-671`).
Its transport policy is `{ jsonRpc: { acceptsBatches: false }, http: {} }`
(no `requiresVersionHeader`).

Handlers are installed under namespaced RPC tags
`@effect/mcp/<url-encoded-version>/` and incoming methods are re-prefixed after
the adapter is chosen
(`effect:packages/effect/src/unstable/ai/internal/mcpProtocolRegistry.ts:12-14`,
`:61-78`).

### HTTP matching (`selectHttpProtocol` + `admitHttp`)

Header names are lower-cased constants: `mcp-protocol-version`, `mcp-method`,
`mcp-name`, `mcp-session-id`
(`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:27-33`). HTTP
headers are already normalized to lowercase by Effect `Headers`.

Metadata keys:

- `io.modelcontextprotocol/protocolVersion` (`:31`)
- `io.modelcontextprotocol/clientCapabilities` (`:32`)

A request is classified **stateless** when any of
(`:215-226`):

1. `params._meta["io.modelcontextprotocol/protocolVersion"]` is present
   (`claim.present`); or
2. it is **not** an `initialize` request (or there is no stateful runtime)
   **and** a stateless adapter is configured **and** either:
   - `MCP-Protocol-Version` equals that adapter's version, or
   - there is **no stateful runtime at all** and the body is a JSON-RPC request
     (method string + string/number `id`).

On a **v2026-only** server, clause (2) is true for every JSON-RPC request
including `initialize`, because `stateful === undefined`.

Once classified as stateless, admission requires **all** of:

| Check | HTTP | JSON-RPC |
| --- | --- | --- |
| `MCP-Protocol-Version` present | 400 | `HEADER_MISMATCH_ERROR_CODE` (`-32020`), `MCP-Protocol-Version header is required` (`:61-65`, `:228-229`; constant `effect:packages/effect/src/unstable/ai/McpSchema.ts:595`) |
| `_meta` present and protocol-version claim is a string (except `notifications/cancelled`) | 400 | `INVALID_PARAMS_ERROR_CODE` (`-32602`), `Required request metadata is missing` (`:231-239`; constant `McpSchema.ts:557`) |
| header version equals `_meta` version (cancelled may omit `_meta`; if present it must match) | 400 | header-mismatch `MCP-Protocol-Version header does not match request metadata` (`:241-243`) |
| `_meta["io.modelcontextprotocol/clientCapabilities"]` is an object (except cancelled) | 400 | `-32602`, `io.modelcontextprotocol/clientCapabilities request metadata is required` (`:244-252`) |
| header version equals the single configured stateless adapter | 400 | `-32022`, `Unsupported protocol version '<header>'`, `data: { supported, requested }` (`:33`, `:254-266`) |
| `Mcp-Method` equals JSON-RPC `method` | 400 | header-mismatch `Mcp-Method header does not match request method` (`:268-270`) |
| For `tools/call` and `prompts/get`: `Mcp-Name` (routing-header decoded) equals `params.name`. For `resources/read`: equals `params.uri`. Other methods skip `Mcp-Name`. | 400 | header-mismatch `Mcp-Name header does not match request parameters` (`:49-58`, `:272-278`) |

`Mcp-Name` decoding: printable ASCII (`[\t\x20-\x7e]*`) is used as-is; values
wrapped in a Base64 sentinel are decoded; a wrapper that fails decode is not a
literal fallback inside the sentinel pair
(`effect:packages/effect/src/unstable/ai/internal/mcpProtocol.ts:45-60`). An
**unmatched** Base64-looking string (incomplete wrapper) is treated as a
literal (test in §10).

On success: `{ _tag: "Accepted", binding: undefined, protocol: statelessProtocol }`
(`mcpRuntime.ts:280`). **No session is created.** `Mcp-Session-Id` is not
consulted on the stateless path. A 2026-only server ignores a caller-supplied
`Mcp-Session-Id` on an otherwise valid modern request
(`effect:packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts:117-128`).

If the request is **not** classified stateless (legacy / mixed-list):

- unknown `Mcp-Session-Id` → HTTP 404 empty (`mcpRuntime.ts:282-285`);
- non-`initialize` with unknown `MCP-Protocol-Version` → HTTP 400 empty (`:286-292`);
- session whose adapter has `http.requiresVersionHeader === true` and header
  mismatch → HTTP 400 empty (`:293-299`);
- otherwise accept with the session binding (`:300`).

`admitHttp` then (`:365-440`):

- parse failure + unknown version header → HTTP 400 empty; otherwise JSON-RPC
  parse error with **HTTP 200** (`PARSE_ERROR_CODE` `-32700` via `ParseError`)
  (`:372-380`; `McpSchema.ts:581`);
- **JSON-RPC batches** (`Array.isArray(input)`): empty array → HTTP 400
  `Invalid Request` (`-32600`); otherwise HTTP 400 empty if selection failed,
  **any** batch member has protocol-version `_meta`, **any** member is
  `initialize`, **or** the selected adapter does not `acceptsBatches`
  (`:383-395`). `v2026_07_28` has `acceptsBatches: false`, so **every HTTP
  batch is 400** on a 2026-only server and on a mixed list that selected the
  stateless adapter;
- invalid JSON-RPC shape → HTTP 200, `Invalid Request` (`:419-420`);
- `initialize` **with** `Mcp-Session-Id`, or non-initialize **without** session
  **and** selected protocol is not Stateless → HTTP 400 (`:422-426`);
- request whose method is absent from the stateless adapter's `handlerRpcs` /
  `clientRpcs` → HTTP **404**, JSON-RPC `MethodNotFound` (`-32601`)
  `Method not found: <method>` (`:427-435`; `McpSchema.ts:545`);
- `subscriptions/listen` is flagged `isSubscription: true` (`:438-439`);
- notification-only (no `id`) is `acknowledge: true` → POST handler returns
  empty **202** (`effect:packages/effect/src/unstable/ai/McpServer.ts:1618-1620`).

### Stdio matching

Stdio does **not** run `selectHttpProtocol` / `admitHttp`. Framing is
newline-delimited JSON-RPC (`mcpStdioSerialization`,
`effect:packages/effect/src/unstable/ai/McpServer.ts:1449-1510`). The JSON-RPC
decoder copies `method` onto `Request.tag` with **no allowlist**
(`effect:packages/effect/src/unstable/rpc/RpcSerialization.ts:316-323`).

Protocol selection happens in `prepareRequest`
(`mcpRuntime.ts:308-362`):

- If `_meta` carries `io.modelcontextprotocol/protocolVersion`, pick the adapter
  with that version, else the single stateless adapter, else `protocols[0]`
  (`:314-316`).
- Else if a stateful session is bound to `clientId` / headers, use that.
- Else if `request.tag === "initialize"`: `selectStatefulProtocol`; **if none**,
  fail with `ProtocolError` code `-32022`, message
  `initialize is not supported by the configured MCP protocols (requested '<offeredVersion>')`
  (`:319-327`).
- Else `protocols[0]`.

`ProtocolError` is mapped to a JSON-RPC error via `sendRequestError`
(`McpServer.ts:1136-1145`, `:733-738`).

Stdio `initialize` also drives **batch policy** in the framer: only initialize
messages update `selectedProtocol` via `selectStatefulProtocol`
(`McpServer.ts:1484-1487`). On a 2026-only list that returns `undefined`,
`acceptsBatches` stays false, so batches are rewritten to an internal
`invalid/json-rpc-batch` request (`:1467-1483`) and encoded as
`-32600` `JSON-RPC batches are not supported` (`:1493-1502`).

### What a `v2026_07_28`-only server answers to `initialize`

`initialize` is **not** in `ClientRequestRpcs` / `handlerRpcs`
(`effect:packages/effect/src/unstable/ai/internal/mcpSchema/v2026_07_28.ts:614-630`;
`effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts:292`,
`:364-661`).

**HTTP, modern headers + `_meta`:** classified stateless, then `admitHttp`
returns HTTP **404** + JSON-RPC `-32601` `Method not found: initialize`
(`mcpRuntime.ts:427-435`; pinned
`effect:packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts:131-138`).

**HTTP, bare legacy `initialize` (no version header / no `_meta`):** classified
stateless because `stateful === undefined`, then header-mismatch HTTP **400**
`-32020` `MCP-Protocol-Version header is required` (same classification as any
headerless JSON-RPC request; pinned `:158-180`, including a body whose
`params.protocolVersion` is `"2025-11-25"`).

**HTTP, `initialize` plus `Mcp-Session-Id`:** `admitHttp` HTTP **400** empty
(`mcpRuntime.ts:422-426`) — this fires only if the request was **not**
classified stateless. On a 2026-only server the stateless classification
usually wins first, so the 404/400-header paths above dominate. Mixed-list
servers use this 400 for initialize-with-session
(`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/TransportsTest.ts:360`).

**Stdio, no protocol-version `_meta`:** `prepareRequest` yields ProtocolError
`-32022`
`initialize is not supported by the configured MCP protocols (requested '<version>')`
(`mcpRuntime.ts:319-326`). There is no HTTP status; the JSON-RPC error is
written on stdout. The stdio harness never sends `initialize` on a Stateless
adapter — it sends `server/discover` instead
(`effect:packages/effect/test/unstable/ai/McpServer/TestUtils/McpStdioHarness.ts:250-257`).
The `-32022` stdio-initialize path is therefore **code-backed**; a dedicated
stdio test name was **not found** in the files listed in this lane's brief.

**Stdio, with 2026 `_meta`:** `claim.present` selects the stateless adapter,
skips the initialize branch, then `clientRpcs` has no `initialize` →
`Method not found: initialize` (`McpServer.ts:1110-1117`).

### Mixed-list behavior (decision-challenge vs G4)

G4 says `McpProtocol.v2026_07_28` **only**. The runtime **does** accept mixed
lists with at most one stateless adapter. On a mixed list
`[v2026_07_28, v2025_11_25]`:

- A legacy `initialize` (no 2026 `_meta`) is **not** classified stateless
  (`isInitialize && stateful !== undefined`). It is handled by the first
  stateful adapter. Offering `protocolVersion: "2026-07-28"` still negotiates
  **stateful** `2025-11-25` and mints `Mcp-Session-Id`
  (`effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:704-721`).
- A modern request with 2026 `_meta` ignores a recognized legacy session
  (`:725-740`).
- G4 is **implementable**. Mixed lists are the thing that **keeps `initialize`
  alive**. A v2026-only server is the only configuration in which `initialize`
  is removed.

---

## 2. `server/discover`

### Request

RPC `server/discover`. Payload is `RequestParams` = `{ _meta: RequestMetaObject }`
(`effect:packages/effect/src/unstable/ai/internal/mcpSchema/v2026_07_28.ts:66-78`,
`:368-382`). `RequestMetaObject` requires:

- `io.modelcontextprotocol/protocolVersion: string`
- `io.modelcontextprotocol/clientCapabilities: ClientCapabilities`
- optional `progressToken`, `io.modelcontextprotocol/clientInfo`,
  `io.modelcontextprotocol/logLevel`, plus rest JSON.

The handler ignores the payload body beyond what `prepareRequest` already
decoded (`v2026_07_28.ts:466-477`).

### Response

`DiscoverResult` (`:368-376`) is a cacheable complete result:

- `resultType: "complete"`
- `ttlMs` (int ≥ 0), `cacheScope: "public" | "private"` (`:350-355`)
- `_meta` including required `io.modelcontextprotocol/serverInfo`
  (`Implementation`) (`:91-96`)
- `supportedVersions: string[]` — `context.supportedVersions`, i.e. every
  configured adapter's version (`mcpRuntime.ts:458`; `v2026_07_28.ts:328`,
  `:472`)
- `capabilities: ServerCapabilities`
- optional `instructions`

The handler always injects `ttlMs: 0`, `cacheScope: "private"`
(`v2026_07_28.ts:208-211`, `:470-476`).

### Capabilities (`getDiscovery`, `:320-328`)

Always starts as `{ completions: {}, logging: {} }`.

Then:

- `extensions` copied from `serverInfo.extensions` **only** for values that
  are JSON objects. Scalar / array / null extension settings are dropped
  (`:316-322`; pinned
  `v2026_07_28.test.ts:93-114`).
- `tools` iff tools are registered: `{ listChanged: supportsSubscriptions }`
- `resources` iff resources registered:
  `{ listChanged: supportsSubscriptions, subscribe: supportsSubscriptions }`
- `prompts` iff prompts registered: `{ listChanged: supportsSubscriptions }`

`supportsSubscriptions` is `sendNotification !== undefined` (`:313-314`).
`McpServer` supplies `sendNotification` only when
`RpcServer.Protocol.supportsNotifications` is true
(`McpServer.ts:806-813`). Stdio and Streamable HTTP both set
`supportsNotifications: true`
(`effect:packages/effect/src/unstable/rpc/RpcServer.ts:1206`, `:1403`).
A custom protocol with `supportsNotifications: false` advertises
`listChanged: false` / `subscribe: false` and rejects `subscriptions/listen`
(§7).

On a features-empty 2026 stdio server, discover returns
`capabilities: { completions: {}, logging: {} }`
(`v2026_07_28.test.ts:215-239`).

### `instructions`, `description`, `websiteUrl`, `icons`

- `instructions` is a **top-level** optional DiscoverResult field, taken from
  `context.serverInfo.instructions` (`v2026_07_28.ts:474`;
  `HandlerInstallationOptions.serverInfo` `mcpRuntime.ts:122-130`).
- `description`, `websiteUrl`, `icons` are **not** top-level DiscoverResult
  fields. They live on `Implementation` inside
  `_meta["io.modelcontextprotocol/serverInfo"]`
  (`effect:packages/effect/src/unstable/ai/internal/mcpSchema/v2025_11_25.ts:32-37`,
  re-exported by the 2026 schema; encoded via `encodeImplementation` in
  `projectCompleteResult` `v2026_07_28.ts:213-223`, `:89-97`).
- `Implementation` fields are optional; omitted values are not forced present.

The conformance harness's `initialize()` for Stateless adapters **rewrites**
`server/discover` into a synthetic `InitializeResult` with
`serverInfo: { name, version }` only
(`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/McpConformance.ts:40-47`,
`:263-288`). That harness shape is **not** the wire DiscoverResult.

---

## 3. Stdio framing

`layerStdio` installs `mcpStdioSerialization` + `RpcServer.layerProtocolStdio`
(`McpServer.ts:1430-1447`). Docs: "newline-delimited JSON-RPC messages"
(`:1414-1415`).

### Newline-delimited JSON-RPC vs Content-Length

Framer uses `RpcSerialization.ndjson` (`includesFraming: true`) then a JSON-RPC
parser (`McpServer.ts:1459-1488`). `makeNdjson` splits on `\n`, `JSON.parse`s
each line, and holds a remainder buffer
(`effect:packages/effect/src/unstable/rpc/RpcSerialization.ts:142-191`).
Encode appends `\n` (`McpServer.ts:1504-1505`).

**Content-Length framing is not implemented.** No `Content-Length` token
appears in `mcpStdioSerialization` or `makeNdjson`.

### Chunked UTF-8 reconstruction

`makeNdjson.decode` concatenates incoming chunks with
`TextDecoder.decode(bytes, { stream: true })` into `buffer`, then splits on
`\n` (`RpcSerialization.ts:157-176`). Incomplete lines stay in the buffer.
Pinned by
`TransportsTest.ts` "SCENARIO parses UTF-8 JSON-RPC records split across input chunks"
and the 2026 clone
"should reconstruct a UTF-8 stdio message when its bytes arrive in separate chunks"
(`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/TransportsTest.ts:58`,
`:488`).

Default max buffer: `defaultMaxBufferSize` in `RpcSerialization.ts` (not
re-read here). Overflow throws `MaxBufferSizeExceeded` and clears the buffer
(`:152-155`, `:163-174`).

### Batches (`acceptsBatches`)

Per adapter. 2026: `false` (`v2026_07_28.ts:664-671`). A JSON array frame is
rejected unless `selectedProtocol?.runtime.transport.jsonRpc.acceptsBatches === true`,
and is also rejected if empty, if any member has protocol-version `_meta`, or
if any member is `initialize` (`McpServer.ts:1467-1483`). Encode path for the
internal invalid-batch tag:
`-32600` `JSON-RPC batches are not supported` (`:1493-1502`).

On a 2026-only stdio server, `selectedProtocol` is only set from `initialize`
(`:1484-1487`), which never succeeds, so batches stay rejected for the life of
the process.

### Stdin close / shutdown

`makeProtocolStdio` runs `stdio.stdin` through `Stream.runForEach`, decoding
each chunk and `writeRequest(0, message)` (`RpcServer.ts:1362-1378`). On stream
exit it `Fiber.interrupt`s the current fiber (`:1376`). Stdout is a bounded
queue of 8 (`:1359`). `clientIds` is a constant `Set([0])` (`:1398`).
Pinned: "MUST shut down when the client closes stdin" / 2026
"should shut down the stdio server when the client closes stdin"
(`TransportsTest.ts:143`, `:512`).

There is **no** per-request `Eof` disconnect on stdio comparable to HTTP:
`McpServer` only calls `disconnectClient` on `Eof` when `!isHttp`
(`McpServer.ts:1153-1157`), and stdio never emits `Eof` per message — stdin
end tears down the whole server fiber.

---

## 4. Streamable HTTP without sessions

`layerHttp` is a **single-endpoint POST** Streamable HTTP transport
(`McpServer.ts:1512-1575`, `:1585-1624`). Docs explicitly: no historical
two-endpoint HTTP+SSE, no GET SSE, no event resumption, no session expiry, no
client session termination (`:1530-1534`).

### POST

1. Origin check (`:1592-1594`).
2. `Content-Type` must be `application/json` (media-type list, q-values
   dropped if invalid) else **415** (`:1595-1597`, `:1737-1752`).
3. `Accept` must include both `application/json` **and** `text/event-stream`
   else **406** (`:1598-1601`).
4. Body parsed as JSON; `admitHttp` (§1).
5. Response: if `isSubscription` **or** streaming body **or** the buffered
   body contains a newline (multiple JSON-RPC messages), convert to SSE
   `text/event-stream` with `data: <line>\n\n` frames (`:1610-1616`,
   `:1708-1727`). Otherwise `application/json`.
6. `acknowledge: true` (notification or JSON-RPC response POST) → empty
   **202**, swallowing encode failures (`:1618-1620`). A 200 JSON body with
   content-length 0 is also rewritten to 202 (`:983-994`).

`mcpHttpSerialization` uses JSON-RPC **with** `includesFraming: true` and
appends `\n` after each encoded message so the HTTP transport can split
buffered chunks (`:1626-1643`). That is why
`RpcServer.makeProtocolWithHttpEffect` reports `supportsNotifications: true`
(`RpcServer.ts:1206`) even though GET SSE is not offered.

### Per-request streaming and `sendNotification`

Each POST allocates `clientId++` (`RpcServer.ts:1074`, `:1097`, `:1141-1142`).
Writes go to a per-request queue. If the queue is still open after the initial
chunk, the HTTP body is a `Stream` (`:1177-1184`), which `layerMcpProtocolHttp`
maps to SSE (`McpServer.ts:1614-1615`).

`sendNotification` encodes a server notification RPC and
`protocol.send(clientId, { _tag: "Request", isNotification: true, ... })`
(`McpServer.ts:749-775`). On HTTP that write lands on **that POST's** queue —
there is no other connection. Logging and progress for a tool call therefore
share the originating POST's SSE stream (pinned
`LoggingTest.ts:441-467`). They are **not** delivered onto a different
`subscriptions/listen` stream (`:397-473`).

### GET / PUT / PATCH / DELETE / OPTIONS

All five are registered as `methodNotAllowed`
(`McpServer.ts:1555-1568`):

- Origin allowed (or Origin-less): HTTP **405**, `Allow: POST`.
- Origin present and not in allowlist: HTTP **403** empty (no `Allow`).

GET SSE is therefore **not offered**. Pinned:
"MUST return method not allowed when GET SSE is not offered"
(`TransportsTest.ts:296`); 2026
"should reject GET and unsupported HTTP methods when only POST is available"
(`:573`).

### Origin / `allowedOrigins`

`isAllowedMcpOrigin`: `origin === undefined || (allowedOrigins ?? []).includes(origin)`
(`McpServer.ts:1729-1735`).

**Default `allowedOrigins` is `undefined` → treated as `[]`.** Any `Origin`
header is **403**. Origin-less non-browser clients are allowed. Exact string
match; no wildcard. Applied to every MCP route including 405 handlers
(`:1559-1562`, `:1592-1594`). Pinned:
"should reject browser Origins by default while accepting Origin-less clients"
(`McpServer.test.ts:1348`);
"MUST validate the Origin header before every MCP route"
(`TransportsTest.ts:428`); 2026
"should reject every MCP HTTP route when its Origin is not explicitly allowed"
(`:584`).

The test harness defaults `allowedOrigins: ["https://allowed.example"]`
(`effect:packages/effect/test/unstable/ai/McpServer/TestUtils/McpServerLayer.ts:30`).
That is harness-only, not the production default.

### `Mcp-Session-Id`

On a 2026-only server, the stateless HTTP path never reads or sets
`Mcp-Session-Id` (`mcpRuntime.ts:280`; `v2026_07_28.test.ts:117-128`).
Stateful initialize still mints a UUID and sets both `mcp-session-id` and
`mcp-protocol-version` on the response (`mcpRuntime.ts:501-511`). Mixed-list
modern requests that also carry a legacy session id still dispatch as
stateless and **do not** echo a session header
(`ProtocolAdapters.test.ts:725-739`).

---

## 5. `McpSchema.McpRequestContext`

### Fields

Public service
(`effect:packages/effect/src/unstable/ai/McpSchema.ts:2824-2835`):

| Field | Type | Who mints it |
| --- | --- | --- |
| `clientId` | `number` | transport (`RpcServer.Protocol`) |
| `protocolVersion` | `string` | client `_meta` (decoded) |
| `clientCapabilities` | `ClientCapabilities` | client `_meta` |
| `clientInfo` | `Implementation \| undefined` | client `_meta` (optional on 2026) |
| `requestMetadata` | initialize `_meta` or `JsonObject` | client `_meta` as decoded |
| `inputResponses` | `Record<string, McpInputResponse> \| undefined` | **client follow-up payload**, merged in the 2026 handler |
| `requestState` | `string \| undefined` | **client follow-up payload** (opaque echo) |

### Population (`prepareRequest`)

Stateless path (`mcpRuntime.ts:348-362`):

1. `profileFromRequestMetadata` decodes `_meta` with `RequestMetaObject`
   (`v2026_07_28.ts:79-87`): protocol version is the **schema's**
   `protocolVersion` constant `"2026-07-28"`, not the raw `_meta` string after
   HTTP admission has already matched versions.
2. `McpRequestContext.of({ clientId, protocolVersion, clientCapabilities, clientInfo, requestMetadata })`.
3. `inputResponses` / `requestState` are **not** set here.

`McpServer` then `Effect.provideService(..., McpRequestContext, prepared.requestContext)`
for both notifications and requests (`McpServer.ts:1105-1107`, `:1132-1134`).

Follow-up merge (`v2026_07_28.ts:333-345`): `getInputInvocation` copies the
context and overlays decoded `inputResponses` + `requestState` from the RPC
payload (`InputResponseRequestParams`, schema `:344-348`).

`provideInvocationContext` additionally maps
`requestMetadata["io.modelcontextprotocol/logLevel"]` onto `CurrentLogLevel`
(`McpServer.ts:164-178`).

Lifetime: the service is request-scoped. There is no session table for
stateless adapters (`stateless.installHandlers` passes `lifecycle: undefined`,
`mcpRuntime.ts:464-466`).

### `clientId` stability

**Stdio:** `writeRequest(0, ...)` always; `clientIds: Set([0])`
(`RpcServer.ts:1369`, `:1398`). `clientId` is **0 for every request** of that
process. It is stable, but it does not distinguish clients. Stdin close
interrupts the server fiber, not a per-client disconnect.

**HTTP:** `const id = clientId++` per POST (`RpcServer.ts:1097`). The id is
removed in the request-scope finalizer (`:1127-1140`). `McpServer` also
registers `disconnectClient(clientId)` on that HTTP scope (`McpServer.ts:1015-1020`).
**`clientId` is not stable across HTTP requests from one client.** Comment in
source: "Each HTTP POST has its own transport ID" (`:1079`).

### Server-minted stable HTTP identity

**None of the `McpRequestContext` fields is server-minted and stable across
HTTP requests.** `clientId` is per-POST. Everything else is client-supplied.
2026 does not mint `Mcp-Session-Id`. `requestState` is an opaque **client-echoed**
string; the server does not store it (§6). Subscription ids are the **client's
JSON-RPC request id**, copied into `_meta["io.modelcontextprotocol/subscriptionId"]`
(`v2026_07_28.ts:392`).

---

## 6. Multi-round-trip tool results

### How a handler returns it

Public `McpSchema.InputRequired` is a tagged class requiring at least one of
`inputRequests` or `requestState`
(`McpSchema.ts:2697-2715`). Tool/prompt handlers return
`CallToolResult | InputRequired` / `GetPromptResult | InputRequired`
(`McpServer.ts:217`, `:287`). `addTool` / `addPrompt` map the tagged class to
`McpCore.OperationOutcome.InputRequired` (`:436-439`, `:577-581`).

Wire form: `InputRequiredResult` with `resultType: "input_required"`,
`_meta.serverInfo`, and either `inputRequests` (record) or `requestState`
(string), or both (`v2026_07_28.ts:320-342`). Projection:
`projectInputRequired` (`v2026_07_28.ts:100-109`).

### Input kinds

`InputRequest` union (`:313`):

- `{ method: "sampling/createMessage", params: CreateMessageRequest.params }`
  (`:220-234`)
- `{ method: "roots/list", params?: { _meta } }` (`:245-248`)
- `{ method: "elicitation/create", params: form | url }` (`:285-302`)

`InputResponse` union: `CreateMessageResult | ListRootsResult | ElicitResult`
(`:315`). Elicit result actions: `accept | decline | cancel` (`:304-310`).

Canonical `McpInputRequest` in public `McpSchema.ts:2668-2671` is the same
three methods.

### Follow-up

The client retries the **same method** (`tools/call`, `prompts/get`; schema
also allows `resources/read`) with `inputResponses` (keyed like
`inputRequests`) and/or `requestState`
(`InputResponseRequestParams`, `:344-348`). `getInputInvocation` overlays
those onto `McpRequestContext` (`:333-345`).

**The server holds no continuation store.** `requestState` is opaque and
"returned unchanged with the keyed input responses" (`McpSchema.ts:2691-2692`).
If the handler rejects the echoed state, that is an `InvalidToolContinuation`
→ JSON-RPC `-32602` (test
`v2026_07_28.test.ts:547`).

`resources/read` **schema** allows `InputRequiredResult` (`:425-429`) but
`core.resources.read` returns `ReadResourceResult` only
(`mcpCore.ts:193-199`) and the 2026 handler never branches on
`InputRequired` (`v2026_07_28.ts:500-509`). MRTR is implemented for
`tools/call` and `prompts/get` only.

### Capability gate before returning `input_required`

`validateInputRequestCapabilities` (`:347-363`) returns HTTP **400** +
`-32021` `MISSING_REQUIRED_CLIENT_CAPABILITY`
("The request requires client capabilities that were not declared") with
`data.requiredCapabilities` when:

- `roots/list` and client has no `roots`
- `sampling/createMessage` and client has no `sampling`, or needs
  `sampling.tools` / `sampling.context` (`includeContext` `thisServer`/`allServers`)
- `elicitation/create` mode `url` without `elicitation.url`; mode `form`
  (default) unless `elicitation.form` is present **or** `elicitation` is `{}`
  (empty object counts as form support) (`:155-162`; tests
  `v2026_07_28.test.ts:569-657`)

### Reverse client

`toReverseClient` always fails with `McpReverseOperationUnsupported`:
reason `"MCP 2026-07-28 carries server input requests in multi round-trip results"`
(`v2026_07_28.ts:282-288`, `:683-687`). `ServerRequestRpcs` is empty
(`mcpSchema/v2026_07_28.ts:632-635`). There is no in-band
elicitation/sampling/roots JSON-RPC request from server to client.

---

## 7. `subscriptions/listen`

### Handler

Present (`v2026_07_28.ts:365-465`). Payload:
`{ _meta, notifications: SubscriptionFilter }`
(`mcpSchema/v2026_07_28.ts:535-561`). Filter fields (all optional):
`toolsListChanged`, `promptsListChanged`, `resourcesListChanged`,
`resourceSubscriptions: string[]` (`:535-540`).

### What can be subscribed / notification kinds

Honored **subset** of the filter intersected with `registrationPresence`
(`v2026_07_28.ts:375-391`):

| Filter | Canonical event | Wire notification |
| --- | --- | --- |
| `toolsListChanged` | `ToolsChanged` | `notifications/tools/list_changed` |
| `promptsListChanged` | `PromptsChanged` | `notifications/prompts/list_changed` |
| `resourcesListChanged` | `ResourcesChanged` | `notifications/resources/list_changed` |
| `resourceSubscriptions` (URI set) | `ResourceUpdated` if URI in set | `notifications/resources/updated` |

Other `ServerNotification` tags (`LoggingMessage`, `Progress`, `Cancelled`,
`ElicitationComplete`) are **not** delivered on this stream. The 2026
`projectNotification` returns `undefined` for subscription-class events
(those go only through `subscriptions/listen`) and otherwise uses the
progress-capable projector (`:688-694`). Logging/progress use the originating
request's `clientId` (§4, §8).

Acknowledgment: `notifications/subscriptions/acknowledged` with the **honored**
filter (not the requested superset) (`:438-444`). Then the handler races a
delivery loop against overflow (`:445-456`) and finally returns
`SubscriptionsListenResult` `{ resultType: "complete", _meta: { subscriptionId, serverInfo } }`
(`:457-464`).

Filtering: `targetClientId` on the pubsub event must match `client.id` or be
unset (`:401-403`). Overflow: dropping queue of **64**
(`MAX_PENDING_SUBSCRIPTION_NOTIFICATIONS`, `:34`, `:394-395`); overflow
cancels the subscription and, on HTTP, `protocol.end(clientId)`
(`McpServer.ts:786-801`).

### No `sendNotification`

If `context.sendNotification` is undefined, the handler fails with
`METHOD_NOT_FOUND` (`-32601`) `Method not found: subscriptions/listen`
(`v2026_07_28.ts:369-373`). Discovery then advertises `listChanged: false`
(§2). Pinned:
"should not advertise subscriptions and should reject listen when the transport cannot send notifications"
(`SubscriptionsTest.ts:203-277`).

Stdio and `layerHttp` **do** pass `sendNotification` (both
`supportsNotifications: true`). The no-notification case is a **custom**
`RpcServer.Protocol`.

---

## 8. Tool outputs and failures

### Output schemas and `structuredContent`

2026 `Tool.outputSchema` is a JSON-schema object with rest
(`mcpSchema/v2026_07_28.ts:163-175`) — not required to have `type: "object"`.
`CallToolResult.structuredContent` is `optional(Schema.Json)` (`:484-491`),
so non-object JSON (string, array, null, number, boolean) is valid on this
revision.

`registerToolkit` copies `result.encodedResult` into `structuredContent` on
success and JSON-stringifies it into `content[0].text`
(`McpServer.ts:1780-1781`, `:1899-1904`). Pinned:
"should project non-object JSON Toolkit outputs only for the July protocol"
(`ProtocolAdapters.test.ts:1495-1551`) — `structuredContent: "shared-result"`
and `["array", null]`. Older revisions omit `structuredContent` for those
tools (`:1499-1511`).

Public authoring `McpSchema.ToolOutputJson` is still `Schema.JsonObject`
(`McpSchema.ts:1594-1602`); `registerToolkit` decodes the JSON Schema
**document** through that codec (`McpServer.ts:1861-1863`). A JSON Schema
document is an object even when it describes a non-object instance type.

### Strict excess-property rejection

`Tool.getStrictMode(tool) === true` → `decodeOptions: { onExcessProperty: "error" }`
(`McpServer.ts:1828-1835`, `:1888`). Strict **raw JSON Schema** tools die at
registration:
`McpServer cannot strictly validate the raw JSON Schema for tool '<name>'; use an Effect Schema instead`
(`:1830-1833`). Pinned: `McpServer.test.ts` "advertises closed strict input
schemas…", "validates strict return-mode arguments…", "dies on strict raw JSON
Schema tools…".

Non-strict uses `onExcessProperty: "ignore"` for the input JSON Schema
document (`:1924-1926`).

### Invalid arguments

Parameter-validation `AiError` with origin `"parameters"` → `InvalidParams`
(`McpServer.ts:1852-1854`). `addTool` maps `InvalidParams` to
`InvalidToolInput` on a **fresh** call, or `InvalidToolContinuation` if
`requestState` or `inputResponses` is already present (`:425-434`).

The 2026 `tools/call` handler **catches** `ToolExecutionError` and
`InvalidToolInput` and turns them into
`CallToolResult { isError: true, content: [{ type: "text", text: error.message }] }`
(`v2026_07_28.ts:629-638`). So **first-call invalid arguments are a result
with `isError: true`**, not a JSON-RPC error.

`InvalidToolContinuation` is **not** in that `catchTag` list; it goes through
`projectError` → JSON-RPC `-32602` (`:234-250`, `:158-175`).
`ToolNotFound` likewise becomes `-32602` `Tool '<name>' not found`.

Unknown tool name: protocol error, not `isError`
(`ToolsTest.ts` "MUST reject an unknown tool name with a protocol error").

### `failureMode` error vs return

Toolkit default `failureMode` is `"error"` (`Tool.ts:1289`).
`registerToolkit` does **not** branch on `failureMode` by name. It:

- treats a **declared** handler failure (`isDeclaredFailure(error)` and origin
  `"handler"`) as `CallToolResult { isError: true }` with encoded failure
  payload in `content` text, no `structuredContent` (`McpServer.ts:1855-1856`,
  `:1842-1846`, `:1901-1902`);
- treats parameter validation as `InvalidParams` (above);
- treats anything else (defects, undeclared errors) as an internal tool error.

Pinned: "returns schema-validated messages for declared handler failures",
"encodes declared non-Error failures without structured content or internal
diagnostics", "distinguishes `<origin>` failures from decoding failures in
`<failureMode>` mode" (`McpServer.test.ts:1707-1764`).

### Defects and encoding errors

Handler defects: log + `ErrorReporter.report` +
`CallToolResult { isError: true, content: [{ type: "text", text: "Tool execution failed due to an internal server error." }] }`
(`McpServer.ts:1772-1824`). Client never sees the cause.

Response-serialization defects: same generic message
(`McpServer.test.ts:1875`). Declared-failure encode failure: scrubbed the
same way (`:1739`).

Non-Fail defects on the RPC exit path are rewritten to
`InternalError { message: "Internal error" }` (`McpServer.ts:955-969`) with
`disableFatalDefects: true` (`:1335`).

2026 `projectError` maps `SchemaError` / unknown feature failures via
`ProtocolError.fromFeature` → `-32603` `MCP feature handler failed` unless
the error already looks like `{ code, message }` (`mcpProtocol.ts:177-199`).
`ResourceNotFound` is `-32602` with `data: { uri }` on 2026
(`v2026_07_28.ts:235-239`; `v2026_07_28.test.ts:442-453`) — not the legacy
resource-not-found code.

### Diagnostics / logging

No `logging/setLevel` method (404, `v2026_07_28.test.ts:333-352`).
Request-scoped level is `_meta["io.modelcontextprotocol/logLevel"]`.
Unknown level fails `RequestMetaObject` decode → `-32602`
(`LoggingTest.ts:497-503`). Delivery of `notifications/message` on a
stateless adapter requires that same request's `clientId` and a declared
level that is ≤ the notification level (`McpServer.ts:1276-1289`).
Background / other-request logs are not written onto a listen stream
(`LoggingTest.ts:397-473`).

---

## 9. Coverage matrix

Sources: `ClientRequestRpcs` / `ClientNotificationRpcs` /
`ServerRequestRpcs` / `ServerNotificationRpcs`
(`mcpSchema/v2026_07_28.ts:614-647`), `makeHandlers`
(`v2026_07_28.ts:364-661`), `PingRpcs` only on **stateful** install
(`mcpRuntime.ts:67`, `:471`), `admitHttp` 404 for methods not in
`handlerRpcs`/`clientRpcs` (`mcpRuntime.ts:427-435`).

| Method / capability | Status | Evidence |
| --- | --- | --- |
| `server/discover` | **handler present** | `makeHandlers` `:466-477`; always advertised via being the lifecycle replacement |
| `tools/list` | **handler present** | `:577-588`. Capability `tools` advertised only if tools registered; `listChanged` iff `sendNotification` |
| `tools/call` | **handler present** | `:589-655`; MRTR + `x-mcp-header` checks |
| `prompts/list` | **handler present**; **404 if no prompts registered** | `:511-532` (`METHOD_NOT_FOUND` HTTP 404). Capability `prompts` only if registered |
| `prompts/get` | **handler present** | `:533-552`; MRTR |
| `resources/list` | **handler present** | `:478-488`. Capability `resources` only if registered |
| `resources/templates/list` | **handler present** | `:489-499` |
| `resources/read` | **handler present**; **MRTR schema-only** | `:500-509`; success union includes `InputRequiredResult` but core/handler never return it |
| `resources/subscribe` / `unsubscribe` | **absent** (404) | not in `ClientRequestRpcs`; test `:333-352`. Subscribe **capability bit** advertised on discover when resources exist **and** `sendNotification` |
| `completion/complete` | **handler present**; capability **always advertised** `{ completions: {} }` | `:553-576`, `:321`. Empty completions still succeed with whatever `core.completions.complete` returns |
| `logging/setLevel` | **absent** (404) | test `:333-352`. Capability **always advertised** `{ logging: {} }`. Level is request `_meta` |
| `notifications/message` | **server notification present**; not a client method | `ServerNotificationRpcs` `:638-647`; delivery §8 |
| `subscriptions/listen` | **handler present**; **404 if no `sendNotification`** | `:365-373`. Not a discover capability object of its own |
| `notifications/subscriptions/acknowledged` | **server notification present** | `:608-611`, `:438-444` |
| `notifications/cancelled` | **client notification handler present** (no-op body) | `:656-660`. Real interrupt is in `McpServer` (`:1071-1094`) |
| `notifications/progress` (client → server) | **absent** from `ClientNotificationRpcs` | HTTP 404 via `admitHttp`; stdio unknown notifications are dropped (`McpServer.ts:1110-1112`) |
| `notifications/progress` (server → client) | **server notification present** | `ProgressNotification` `:573-581`; projector `supportsProgressMessage: true` (`:692-694`); stateless delivery requires matching `progressToken` (`McpServer.ts:1270-1274`) |
| `ping` | **absent** on 2026 | not in `ClientRequestRpcs`; `PingRpcs` installed only for stateful (`mcpRuntime.ts:471`); HTTP 404 (`v2026_07_28.test.ts:338`) |
| `initialize` / `notifications/initialized` | **absent** | §1 |
| elicitation / sampling / roots as reverse RPCs | **absent** (`ServerRequestRpcs` empty); **MRTR only** | `:632-635`, `:683-687` |
| `tasks/*` | **absent** (404) | test `:342` |
| pagination `cursor` / `nextCursor` | **schema present, handlers ignore `cursor`** | `PaginatedRequestParams` `:357-360`; no `cursor` read in `v2026_07_28.ts` (UNVERIFIED that core list methods paginate; the 2026 adapter does not pass `cursor` through) |
| cache metadata on list/discover/read | **present**, hard-coded `ttlMs: 0`, `cacheScope: "private"` | `:208-211` |

**HTTP cancellation of an in-flight 2026 request is a no-op.**
`notifications/cancelled` on HTTP returns immediately when
`session === undefined` (`McpServer.ts:1075-1078`). Stateless requests have
`binding: undefined`. Interrupt of an active tool is pinned **only on stdio**,
where `clientId` is always `0` so the cancel notification shares the map
(`UtilitiesTest.ts:254-291`). HTTP 2026 cancel of a live POST is
**decision-challenge** for anyone assuming spec cancellation works over
Streamable HTTP without sessions.

---

## 10. Test map

Files: `packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts`
(also **loads** the named conformance suites below),
`McpProtocol.test.ts`, `ProtocolAdapters.test.ts`, `McpServer.test.ts`,
`McpSchema.test.ts`,
`McpConformance/{BaseProtocol,Transports,Utilities,Tools,Resources,Prompts,Completion,Logging,MultiRoundTrip,Subscriptions}Test.ts`,
harnesses `TestUtils/{McpStdioHarness,McpHttpHarness,McpHttpResponse,McpServerLayer}.ts`.

### §1 Protocol selection / initialize

| Test | File |
| --- | --- |
| should return method not found when the removed initialize method is requested | `v2026_07_28.test.ts:131` |
| should return HeaderMismatch when a July-only request omits headers and metadata (includes legacy initialize) | `:158` |
| should reject routing headers when they are missing, malformed, or mismatched | `:277` |
| should reject an unsupported request version with the supported versions (`-32022`, `data.supported`) | `:305` |
| should return method not found when a request uses an unknown or removed method (`ping`, `logging/setLevel`, `resources/subscribe`, `resources/unsubscribe`, `tasks/get`) | `:333` |
| should return InvalidParams when required request metadata is missing | `:357` |
| should accept cancellation notifications without request metadata | `:141` |
| should serve independent requests when no discovery or session exists (ignores `Mcp-Session-Id`) | `:117` |
| should negotiate a stateful protocol when initialize offers the stateless revision | `ProtocolAdapters.test.ts:704` |
| should ignore a recognized legacy session when dispatching a modern request | `:725` |
| should keep requests out of legacy routing when modern metadata is malformed | `:995` |
| should reject an empty declaration… / should reject duplicate versions… | `McpProtocol.test.ts:81`, `:91` |
| should reject stateless requests inside a legacy `{transport}` batch | `McpServer.test.ts:657` |
| validates supplied protocol versions on POST | `:2012` |
| MUST reject initialize requests carrying a session identifier | `TransportsTest.ts:360` |
| Base Protocol > Stateless messages (ids, invalid jsonrpc, method not found, invalid params, parse error) | `BaseProtocolTest.ts:56-198` |

Stdio `-32022` initialize: **NOT FOUND** as a named test; code path
`mcpRuntime.ts:319-326`.

### §2 `server/discover`

| Test | File |
| --- | --- |
| should discover the server when no initialization or session exists | `v2026_07_28.test.ts:80` |
| should advertise supported extension settings when discovering a server with legacy configuration | `:93` |
| should exchange self-contained newline-delimited requests over stdio (empty capabilities, `ttlMs: 0`, `serverInfo`) | `:215` |
| should discover the modern server without initialization or a session | `ProtocolAdapters.test.ts:743` |
| should attach modern result and cache metadata to every cacheable operation | `v2026_07_28.test.ts:458` |
| should advertise logging when request-scoped log filtering is supported | `LoggingTest.ts:477` |
| should advertise supported subscription capabilities when features are registered | `SubscriptionsTest.ts:154` |
| MUST advertise completions when argument completion is supported | `CompletionTest.ts:52` |
| MUST advertise the tools capability when tools are registered / MUST NOT when not | `ToolsTest.ts:61`, `:69` |

### §3 Stdio framing

| Test | File |
| --- | --- |
| MUST exchange compact UTF-8 newline-delimited JSON-RPC records | `TransportsTest.ts:37` |
| SCENARIO parses UTF-8 JSON-RPC records split across input chunks | `:58` |
| SCENARIO processes consecutive stdio messages independently | `:84` |
| MUST shut down when the client closes stdin | `:143` |
| should exchange one compact newline-delimited JSON-RPC message per stdio line | `:475` |
| should reconstruct a UTF-8 stdio message when its bytes arrive in separate chunks | `:488` |
| should process consecutive stateless stdio requests independently | `:501` |
| should shut down the stdio server when the client closes stdin | `:512` |
| should exchange self-contained newline-delimited requests over stdio | `v2026_07_28.test.ts:215` |
| should preserve the remaining batch result when a sibling STDIO request is cancelled | `UtilitiesTest.ts:316` (gated on `acceptsBatches`; **does not run** for 2026) |

Content-Length: **NOT FOUND** (no implementation, no test).

### §4 Streamable HTTP

| Test | File |
| --- | --- |
| MUST accept JSON-RPC requests/notifications/responses through POST | `TransportsTest.ts:168-186` |
| MUST require application/json content type (415) | `:219` |
| MUST require clients to accept application/json and text/event-stream (406) | `:235` |
| MUST return application/json for a single JSON-RPC response | `:261` |
| MUST return an empty 202 for accepted notifications and responses | `:268` |
| MUST reject unsupported HTTP methods with method not allowed | `:285` |
| MUST return method not allowed when GET SSE is not offered | `:296` |
| MUST validate the Origin header before every MCP route | `:428` |
| 2026 clones of content-type/accept/GET/Origin | `:538-584` |
| should reject browser Origins by default while accepting Origin-less clients | `McpServer.test.ts:1348` |
| rejects unsupported HTTP methods without disturbing an initialized session | `:1908` |
| returns an empty 202 for notifications and responses… | `:1925` |
| should frame HTTP batch notifications and results as separate SSE events | `:553` (legacy batches) |
| should stream acknowledgment before matching events when using HTTP | `SubscriptionsTest.ts:567` |
| should close only the HTTP subscription stream when its pending backlog overflows | `:583` |
| should validate nested mirrored parameters before executing a tool (`Mcp-Param-*`) | `v2026_07_28.test.ts:185` |
| should accept every required routing name when the header matches | `:242` |
| should treat an unmatched Base64 wrapper as a literal | `:265` |

### §5 `McpRequestContext` / `clientId`

| Test | File |
| --- | --- |
| should accept a request when optional client identity is omitted | `v2026_07_28.test.ts:389` |
| should preserve caller metadata alongside authoritative protocol facts | `:406` |
| should isolate interleaved stateful and stateless request contexts | `ProtocolAdapters.test.ts:958` |
| should omit a legacy client when a toolkit registered in a session handles a stateless request | `:822` |
| should expose current request metadata when invoking a handler | `:1215` |
| should provide the neutral request service to handlers | `McpServer.test.ts:1323` |
| should use the current HTTP request when another request registered the resource | `ProtocolAdapters.test.ts:898` |

HTTP `clientId` increment: **code** `RpcServer.ts:1097`; no test asserts
cross-POST inequality by number. Stability conclusion is from that allocator
plus `disconnectClient` on HTTP scope (`McpServer.ts:1015-1020`).

### §6 MRTR

| Test | File |
| --- | --- |
| should return InvalidParams when a resumed tool rejects its requestState | `v2026_07_28.test.ts:547` |
| should reject tool-enabled sampling when the client omits sampling.tools | `:569` |
| should treat an empty elicitation capability as form support | `:592` |
| should reject input requests when the client omits their required capabilities (`-32021`) | `:633` |
| should return input_required and then complete when prompts/get is retried with client input | `MultiRoundTripTest.ts:107` |
| should reject prompt input requests when the client omits their required capabilities | `:170` |
| should return supported keyed input requests and resume when matching responses are supplied | `:191` |
| should return a retry state without requesting client input | `:267` |
| should remain input-required when continuation keys or request state do not match | `:291` |
| should reject a continuation when its input responses or request state are malformed | `:325` |
| should require context capability when sampling requests include server context | `:47` |
| should reject direct reverse operations when the selected protocol is stateless | `ProtocolAdapters.test.ts:1288` |
| should expose continuation input to modern resource and prompt handlers | `:764` |

### §7 Subscriptions

| Test | File |
| --- | --- |
| should not advertise subscriptions and should reject listen when the transport cannot send notifications | `SubscriptionsTest.ts:203` |
| should advertise supported subscription capabilities when features are registered | `:154` |
| should update discovery and subscription capabilities after late registration | `:167` |
| should deliver a change notification when its kind is requested | `:386` |
| should deliver a resource update when its URI is subscribed | `:417` |
| should acknowledge only the supported subset when requested filters exceed server capabilities | `:435` |
| should deliver a matching event to each subscription | `:455` |
| should keep another subscription active when its peer is cancelled | `:475` |
| should preserve notification metadata and own the subscription identifier | `:512` |
| should deliver modern changes only when an active subscription matches | `:535` |
| should buffer matching events while the subscription acknowledgment is blocked | `:280` |
| should release the scoped subscription when a blocked listener is interrupted | `:325` |
| should terminate only the slow subscription when its pending backlog overflows | `McpServer.test.ts:2239` |

### §8 Tools / failures / logging

| Test | File |
| --- | --- |
| MUST call a registered tool with valid arguments | `ToolsTest.ts:148` |
| MUST reject an unknown tool name with a protocol error | `:170` |
| MUST return tool execution failures with isError | `:240` |
| MUST keep tool execution errors distinct from protocol errors | `:246` |
| SHOULD not expose defects or internal error details | `:265` |
| should return structured content when a structured tool is called | `:331` |
| should list a non-object output schema when the tool declares one | `:416` |
| should return primitive structured content when declared by the tool | `:436` |
| should reject a tools/call request when its required routing name is missing | `:448` |
| should reject a tool call when a required parameter header is missing | `:465` |
| distinguishes malformed requests from tool validation errors by protocol revision | `:339` |
| should project non-object JSON Toolkit outputs only for the July protocol | `ProtocolAdapters.test.ts:1495` |
| should reject invalid structured content at the protocol serialization boundary | `:1798` |
| should reject a tool schema when inputSchema is not an object | `:1811` |
| registerToolkit: strict schemas, declared failures, defects, generic messages | `McpServer.test.ts:1419-1908` |
| should apply every specified log level to the request that declares it | `LoggingTest.ts:486` |
| should reject a request when its request-scoped log level is unknown | `:497` |
| MUST not deliver logs from `{background, another request}` on an HTTP subscription stream | `:400` |
| should send no response when a cancellation notification is received (HTTP 202) | `UtilitiesTest.ts:239` |
| should interrupt work and suppress its response when an active request is cancelled (**stdio**) | `:254` |

`McpSchema.test.ts` pins public (not dated) metadata/enum round-trips only
(`:5-29`); it does not pin 2026 runtime.

---

## Decision-challenges (working assumptions)

1. **G4 (`v2026_07_28` only) is implementable** and is the only way to make
   `initialize` fail. Mixed lists still accept `initialize` via the first
   stateful adapter, even if the client offered `"2026-07-28"`
   (`ProtocolAdapters.test.ts:704-721`).
2. **HTTP cancellation of in-flight 2026 work is not implemented.** Cancel
   notifications are 202-acked and dropped when `session === undefined`
   (`McpServer.ts:1075-1078`). Interrupt is proven on stdio only. A
   v2026-only HTTP server cannot cancel another POST's tool call.
3. **No server-minted stable HTTP identity.** `clientId` is per-POST.
   `Mcp-Session-Id` is ignored. MRTR state is entirely client-echoed.
   Anything in beep-effect that keys auth/rate-limits on `clientId` or a
   session header will not survive G4 over HTTP.
4. **`allowedOrigins` default is deny-all Origins.** Origin-less clients work;
   browser clients 403 unless the in-repo launcher passes an allowlist
   (`McpServer.ts:1729-1735`). G6 in-repo HTTP launchers are in scope for
   that knob.
5. **`ping` and `logging/setLevel` are gone** on 2026 (404). In-repo clients
   that probe `ping` after connect will fail unless updated (G6).

---

## Options (no recommendation)

| Option | What changes | Cost |
| --- | --- | --- |
| A. G4 as stated: every in-repo server `protocols: [v2026_07_28]` | `initialize` 404/400; discover is the hello; no sessions | In-repo launchers, harnesses, `RpcClient`s must send 2026 headers + `_meta` (G6). External agents ignored (G6). |
| B. Mixed list (contradicts G4) | `initialize` still works; 2026 clients can skip it | Two vocabularies, session table still allocated, "at most one stateless" already the runtime rule |
| C. Custom `RpcServer.Protocol` without notifications | Discover advertises `listChanged: false`; `subscriptions/listen` 404 | Loses live list/resource updates; tools still work |
| D. Keep HTTP cancellation | Would need a new correlation (session, or cancel-on-same-POST only) | Not present in `a7a71921de`; would be an Effect or wrapper change |

Grill questions this lane cannot answer are in
`11-u2-stateless-runtime.summary.json`.

## Gate B verdicts (2026-09-17)

Three grok refuters voted on 33 claims from this lane (33 survive, 0 killed; per-vote detail in `verification/11-u2-stateless-runtime.verdicts.jsonl`).

No claim was struck.
