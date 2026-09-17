# Lane 24-r5 — Stateless HTTP security and MCP observability

Lane: `24-r5-http-security-observability`. Packet: `effect-mcp-2026-07-28`. Date: 2026-09-16.

**Owns:** (a) security posture of beep-effect's HTTP MCP sidecar under a 2026-07-28-only
server, and (b) tracing, logging, and metric surface of in-repo MCP servers before and after.
Effect runtime admission belongs to 11-u2; session-keyed governance belongs to 22-r3. Cited
briefly where they change the HTTP or audit picture.

**Working assumptions challenged:** G4 (`v2026_07_28` only). The sidecar today pins
`McpProtocol.v2025_06_18` only (`repo:apps/professional-desktop/server/OntologyMcpTransport.ts:180`).
A G4 flip does not only change the protocol list: it changes which headers a browser-origin
client must send, which CORS lists must allow, what OPTIONS returns, and what identity
survives on spans and ledger runs.

Effect clone: commit `a7a71921de` (upstream main, 2026-09-16). Diff base: tag `effect@4.0.0-rc.115`.
beep-effect: this lane checkout. No installs, builds, or tests were run.

---

## 1. Header contract table

Effect HTTP header names are stored lowercase (`effect:packages/effect/src/unstable/http/Headers.ts:1-7`,
`:48-61`). Wire names in tests and the spec are mixed-case; comparison is case-insensitive
([RFC 9110 field names](https://datatracker.ietf.org/doc/html/rfc9110#name-field-names);
[2026-07-28 Streamable HTTP — Case Sensitivity](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)).

Internal constants in the runtime:

```
mcp-session-id
mcp-protocol-version
mcp-method
mcp-name
```

(`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:27-30`,
`effect:packages/effect/src/unstable/ai/McpServer.ts:646-647`)

Sidecar CORS on `/mcp` (`repo:apps/professional-desktop/server/OntologyMcpTransport.ts:100-105`):

| CORS list | Values |
| --- | --- |
| `allowedOrigins` | same five desktop origins as the Origin middleware (see §2) |
| `allowedMethods` | `POST`, `OPTIONS` |
| `allowedHeaders` | `authorization`, `content-type`, `mcp-protocol-version`, `mcp-session-id` |
| `exposedHeaders` | `mcp-protocol-version`, `mcp-session-id` |
| `credentials` | unset → `false` (`effect:packages/effect/src/unstable/http/HttpMiddleware.ts:339`) |

`/rpc` on the same sidecar is a different CORS contract: `allowedOrigins: ["*"]`,
`allowedHeaders: ["*"]` (`repo:apps/professional-desktop/server/main.ts:73-78`). That
wildcard does **not** apply to `/mcp`.

### 1.1 Request headers a 2026-07-28 HTTP POST uses

| Header (wire) | Required by Effect 2026-07-28? | In sidecar `allowedHeaders`? | Browser-origin consequence |
| --- | --- | --- | --- |
| `Content-Type: application/json` | Yes. First media type must be `application/json` or HTTP 415 (`effect:packages/effect/src/unstable/ai/McpServer.ts:1595-1597`; conformance `effect:packages/effect/test/unstable/ai/McpServer/McpConformance/TransportsTest.ts:537-555`). Case-insensitive; `Application/JSON; charset=utf-8` accepted. | Yes (`content-type`) | CORS-safelisted only for a few form types; `application/json` **forces a preflight**. Listed, so preflight can succeed. |
| `Accept: application/json, text/event-stream` | Yes. Both types required or HTTP 406 (`effect:packages/effect/src/unstable/ai/McpServer.ts:1598-1601`; `:556-559` of the same test). `*/*` is **not** enough. | No | `Accept` is CORS-safelisted. Preflight is not blocked by its absence from `allowedHeaders`. |
| `MCP-Protocol-Version` | Yes for every stateless request. Missing → HTTP 400 HeaderMismatch `"MCP-Protocol-Version header is required"` (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:228-229`). Must equal `_meta.io.modelcontextprotocol/protocolVersion` (`:241-243`). Spec: [Protocol Version Header](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http). | Yes (`mcp-protocol-version`) | Preflight can succeed. |
| `Mcp-Method` | Yes. Must equal JSON-RPC `method` (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:268-270`). Spec table: required for all requests. | **No** | **Breaks browser-origin clients.** A cross-origin `fetch` that sets `Mcp-Method` is non-simple. The preflight `Access-Control-Request-Headers` includes it; the allow-list does not; the browser never sends the POST. |
| `Mcp-Name` | Yes for `tools/call` and `prompts/get` (`params.name`) and `resources/read` (`params.uri`); other methods skip it (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:49-58`, `:272-278`). Base64 sentinel `=?base64?…?=` is decoded before compare (`effect:packages/effect/src/unstable/ai/internal/mcpProtocol.ts:45-59`). | **No** | **Breaks browser-origin `tools/call` / `resources/read` / `prompts/get`.** Same preflight failure as `Mcp-Method`. |
| `Mcp-Session-Id` | Ignored on 2026-07-28. Conformance: sending `Mcp-Session-Id: ignored-modern-session` still 200, and the response does not echo a session id (`effect:packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts:117-128`; `effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:981-987`). Spec: ignore it, do not mint or echo. | Yes (`mcp-session-id`) | Harmless leftover from the stateful pin. Does not help 2026-07-28. |
| `Authorization: Bearer …` | Not an MCP header. Sidecar requires it on every non-OPTIONS request (`repo:apps/professional-desktop/server/RpcSessionAuth.ts:66-73`, `:88-114`). | Yes (`authorization`) | Preflight can succeed. `credentials: false` is compatible: a custom `Authorization` header does not need `Access-Control-Allow-Credentials`. |
| `Origin` | Effect: if **present**, must be in `allowedOrigins` or HTTP 403 empty (`effect:packages/effect/src/unstable/ai/McpServer.ts:1729-1735`, `:1525-1528`). Missing Origin is allowed (non-browser). Spec: [Security & Endpoint](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) — if present and invalid, MUST 403. | N/A (browsers send it; not a CORS-allowed request header) | Sidecar Origin middleware is **stricter** than Effect: missing Origin is denied (see §2). |
| `Mcp-Param-{name}` | Only if a tool schema carries `x-mcp-header`. Effect compares `mcp-param-${annotation.toLowerCase()}` to the argument (`effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts:602-613`). Spec: clients MUST mirror annotated params. | **No** | **Would break** any browser-origin `tools/call` against an `x-mcp-header` tool. **NOT FOUND** in beep-effect tool schemas today (`x-mcp-header` / `Mcp-Param` only appear in `explorations/effect-mcp-2026-07-28/research/13-s1-spec-delta.md`). |

HeaderMismatch code is `-32020` (`effect:packages/effect/src/unstable/ai/McpSchema.ts:595`).
Unsupported protocol version is `-32022` (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:33`, `:254-266`).

### 1.2 Response headers

| Header / content type | 2025-06-18 (current sidecar) | 2026-07-28 | In sidecar `exposedHeaders`? | Browser-origin consequence |
| --- | --- | --- | --- | --- |
| `Content-Type: application/json` | Single JSON-RPC response (`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/TransportsTest.ts:261-267`, `:562-570`) | Same | Not listed (CORS-safelisted response header) | Readable. |
| `Content-Type: text/event-stream` | Notifications, streams, or multi-message bodies (`effect:packages/effect/src/unstable/ai/McpServer.ts:1610-1616`, `:1708-1726`) | Same, including `subscriptions/listen` (`:439` of `mcpRuntime.ts`) | Not listed (not a CORS-safelisted response header) | **JS in a browser cannot read the SSE `Content-Type` via `get()` unless exposed.** EventSource / fetch streaming may still consume the body; `headers.get("content-type")` is opaque. |
| `MCP-Protocol-Version` echo | Stateful initialize and subsequent session responses set `mcp-protocol-version` (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:504-510`; `effect:packages/effect/src/unstable/ai/McpServer.ts:1040-1048`; conformance replay `TransportsTest.ts:413-423`) | The session pre-response handler runs only when `prepared.binding` is defined (`McpServer.ts:1040`). Stateless admission sets `binding: undefined` (`mcpRuntime.ts:280`). Conformance for 2026-07-28 asserts `Mcp-Session-Id` is null and does **not** assert a protocol-version echo (`v2026_07_28.test.ts:85-88`, `:117-128`). | Yes | Exposing a header the 2026-07-28 server likely never sets is a no-op. |
| `Mcp-Session-Id` | Minted at `initialize` as UUIDv4 (`mcpRuntime.ts:501-509`; `TransportsTest.ts:306-327`) | Not minted; ignored if sent (see §1.1) | Yes | Leftover. Browser JS cannot read a header that is not there. |
| `Allow: POST` | 405 on GET/PUT/PATCH/DELETE/OPTIONS when Origin is allowed (`McpServer.ts:1555-1568`; `TransportsTest.ts:285-302`, `:573-580`) | Same | Not listed | Browser JS cannot read `Allow`. Irrelevant if the client is POST-only. |
| `X-Accel-Buffering: no` | Spec SHOULD on SSE ([Receiving Messages](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)). | **NOT FOUND** in `toServerSentEvents` (`McpServer.ts:1708-1726`). | No | Reverse-proxy buffering risk. Not a CORS issue. |

### 1.3 What breaks in a browser-origin client under G4

The sidecar Origin allowlist is itself a browser-origin list: portless
`http://professional-desktop.beep.localhost:1355`, Vite diagnostic
`http://localhost:1421` / `http://127.0.0.1:1421`, and Tauri
`tauri://localhost` / `http://tauri.localhost`
(`repo:apps/professional-desktop/server/OntologyMcpTransport.ts:50-58`).
Those origins are cross-origin to the sidecar (`127.0.0.1:${CHAT_SIDECAR_PORT}` default 3939,
`repo:apps/professional-desktop/server/main.ts:55-57`, `:116`). CORS applies.

No renderer `src/` caller of `/mcp` was found (UNVERIFIED whether a shipped UI
panel currently POSTs `/mcp`; the allowlist and CORS layer exist for that class
of client). In-repo HTTP tests are **not** browser CORS: they use Effect
`HttpClient` / `toWebHandler` and set `origin` + `authorization` as ordinary
headers (`repo:apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts:186-196`).
Those tests will not catch a preflight failure.

Under a 2026-07-28-only server, a real browser `fetch` from an allowed origin
that adds `Mcp-Method` (and `Mcp-Name` on tool/resource/prompt calls) will fail
the preflight against today's `allowedHeaders`. Non-browser clients (Node
`HttpClient`, curl, in-repo `RpcClient`) skip CORS and are not blocked by the
list.

The in-repo harness still speaks **stateful** `initialize` with
`protocolVersion: "2025-06-18"` and captures `mcp-session-id` /
`mcp-protocol-version` from the response (`ontology-mcp-harness.ts:145-177`,
`:247-254`; `ontology-mcp-http.test.ts:121-123`). That is a G4 launcher break
owned in detail by 21-r2; it is listed here because the same harness is the
only HTTP security proof for Origin/bearer.

---

## 2. Method and Origin behavior

### 2.1 Effect `layerHttp` methods

`layerHttp` registers GET, PUT, PATCH, DELETE, and OPTIONS as `methodNotAllowed`
(HTTP 405, `Allow: POST`) **if** Origin is allowed; attacker Origin on those
methods is HTTP 403 empty (`effect:packages/effect/src/unstable/ai/McpServer.ts:1555-1568`,
`:1591-1594`). POST is the only implemented MCP method (`:1591`).

HEAD is not registered. `HttpRouter.asHttpEffect` retries HEAD as GET
(`effect:packages/effect/src/unstable/http/HttpRouter.ts:199-201`), so HEAD
follows the GET 405/403 path.

Conformance (stateful suite and 2026-07-28 `statelessModernSuite`):

| Method | Allowed Origin (or no Origin) | Attacker Origin `https://attacker.example` |
| --- | --- | --- |
| POST | 200/202/4xx from admission | 403 (`TransportsTest.ts:427-446`, `:583-595`) |
| GET | 405 + `Allow: POST` (`:296-302`, `:573-580`) | 403 |
| PUT / PATCH / HEAD | 405 (`:285-292`, `:573-580`) | 403 |
| DELETE | 405; does not terminate a session (`:347-359`) | 403 |
| OPTIONS | 405 on Effect's own server (no CORS middleware) | 403 |

Allowed-origin positive control in the Effect suite is
`https://allowed.example` (`effect:packages/effect/test/unstable/ai/McpServer/TestUtils/McpServerLayer.ts:30`;
`TransportsTest.ts:432-437`). Default `allowedOrigins` is empty: any present
Origin is 403 unless the caller passed a list (`McpServer.ts:1729-1735`,
`:1525-1528`). The sidecar **does** pass the desktop list (`OntologyMcpTransport.ts:181-185`).

### 2.2 Sidecar Origin middleware vs Effect's check

Sidecar Origin middleware (`OntologyMcpTransport.ts:65-93`):

```
isAllowedOntologyMcpOrigin =
  Headers.get(origin) exists AND value ∈ ontologyMcpAllowedOrigins
```

`O.exists` on a missing header is false. **Missing Origin is 403** with JSON body
`OntologyMcpOriginForbidden` (`:60-63`, `:80-86`). Effect's check allows missing
Origin (`McpServer.ts:1733-1734`). The two checks share the same five-origin
list when Origin **is** present (`:50-58`, `:185`).

Integration proof that the sidecar body wins on POST: attacker Origin with a
valid bearer returns 403 whose text includes `OntologyMcpOriginForbidden`
(`repo:apps/professional-desktop/test/integration/ontology-mcp-http.test.ts:189-201`).
Effect's own 403 is an empty body (`McpServer.ts:1592-1593`). The typed JSON
therefore comes from the sidecar middleware, not from Effect.

Complement vs duplicate:

| Case | Sidecar Origin MW | Effect `isAllowedMcpOrigin` | Relationship |
| --- | --- | --- | --- |
| POST, Origin in allowlist | allow, then bearer, then route | allow | Duplicate allowlist (same five strings) |
| POST, attacker Origin | 403 JSON `OntologyMcpOriginForbidden` | would 403 empty (never reached) | Duplicate deny; sidecar is the one that answers |
| POST, **no** Origin | 403 JSON | would **allow** (non-browser) | **Complementary / stricter than spec and Effect** |
| OPTIONS, any Origin | see §2.3 | would 405 or 403 | CORS short-circuit; Effect OPTIONS never runs |

The sidecar comment states the intent: `layerHttp` "runs its own DNS-rebinding
Origin check" and the list "must mirror" the surrounding middleware and CORS
(`OntologyMcpTransport.ts:181-184`). That is accurate for POST with an Origin
header. It is not accurate for missing Origin, and it is not accurate for
OPTIONS (next subsection).

Spec ([Security & Endpoint](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)):
validate Origin on all incoming connections; if present and invalid, MUST 403.
Missing Origin is not required to 403. Effect's docs match the spec
(`McpServer.ts:1525-1528`: "Origin-less non-browser clients remain valid").

**decision-challenge (G4-adjacent, not G4 itself):** keeping the sidecar Origin
middleware after Effect grew the same check is a duplicate for the browser
happy path and a behavior change vs Effect for Origin-less clients (curl,
some `RpcClient`s). In-repo tests always send `origin: allowedOrigin`
(`ontology-mcp-harness.ts:194`), so they do not prove Origin-less access.

### 2.3 OPTIONS: CORS 204 vs Effect 403/405

`HttpMiddleware.cors` short-circuits OPTIONS to HTTP 204 with CORS headers and
does not call the inner app (`effect:packages/effect/src/unstable/http/HttpMiddleware.ts:447-451`).
The sidecar comment relies on that: "No explicit OPTIONS route… `HttpMiddleware.cors`
in `security` short-circuits every OPTIONS request with a 204 plus CORS headers
before any route handler is reached" (`OntologyMcpTransport.ts:258-262`).

Middleware composition is `origin.combine(auth).combine(cors)` (`:95-107`).
`combine` keeps the first function as `layerFn` and stacks later middleware as
dependencies (`effect:packages/effect/src/unstable/http/HttpRouter.ts:1003-1016`,
`:988-998`). `HttpMiddleware.cors` short-circuits OPTIONS to 204 without calling
the inner app (`HttpMiddleware.ts:447-451`). The sidecar comment states that
this 204 happens for **every** OPTIONS before any route handler
(`OntologyMcpTransport.ts:258-262`). That is only true if CORS is reached for
attacker Origin too — i.e. CORS sits outside the Origin middleware, or Origin
does not deny OPTIONS. Origin middleware does **not** exempt OPTIONS (`:68-92`).

**UNVERIFIED by test:** `ontology-mcp-http.test.ts` has no OPTIONS case. Exact
onion order among `{origin, auth, cors}` is inferred from `combine` +
`getMiddleware` (`HttpRouter.ts:1021-1048`, `:134-137`) plus that comment, not
from a status-code assertion.

Consequences if the comment holds (CORS reached on every OPTIONS):

1. OPTIONS never reaches Effect's OPTIONS 405 handler.
2. Attacker Origin OPTIONS: CORS returns **204**. `allowOrigin` for a
   non-listed origin emits only `vary: Origin` (no
   `access-control-allow-origin`) (`HttpMiddleware.ts:347-353`, `:399-405`).
   The browser hides the 204; the spec still says invalid Origin MUST 403.
   Effect's own security suite asserts 403 for OPTIONS + attacker Origin
   (`TransportsTest.ts:438-445`, `:587-594`). Sidecar CORS **fails that
   Effect/spec assertion** while still failing the browser preflight.
3. Allowed Origin OPTIONS: 204 + `access-control-allow-origin` of that origin
   (multi-origin list uses reflect-request-origin, `HttpMiddleware.ts:347-353`).
   Bearer would have exempted OPTIONS anyway (`RpcSessionAuth.ts:66-73`).

This is the load-bearing OPTIONS finding: **sidecar CORS and Effect Origin
checks are not equivalent on OPTIONS.** Duplicate on POST; CORS-only on
preflight.

### 2.4 Scope of HTTP MCP in-repo

G9 hosts besides the desktop sidecar are `layerStdio` only (`repo:packages/drivers/nlp-mcp/src/Server.ts:115`,
`m365-mcp/src/Server.ts:72`, `uspto-mcp/src/Server.ts:96`,
`gov-legal-mcp/src/Server.ts:95`, `law-practice/server/src/Tools.ts:133`;
21-r2 §1.1). They have no Origin, CORS, or HTTP method surface.

The sidecar HTTP MCP layer is mounted only when
`BEEP_DESKTOP_RPC_SESSION_TOKEN` is present (`main.ts:95-107`). IPC transport
never mounts it (`main.ts:124-130`, `:135-137`).

---

## 3. Authentication and abuse surface without sessions

Effect `layerHttp` docs: "The surrounding HTTP server remains responsible for
binding to an appropriate interface and installing authentication"
(`McpServer.ts:1527-1528`). Effect provides Origin (DNS-rebinding), media-type
gates, and header/body admission. It does **not** provide bearer auth, rate
limits, or body-size limits. **NOT FOUND** in
`effect:packages/effect/src/unstable/ai/McpServer.ts` and `internal/mcpRuntime.ts`:
rate-limit, max body bytes, replay nonce.

### 3.1 What the app provides

| Control | Where | What Effect provides | What the app must keep |
| --- | --- | --- | --- |
| Bind address | `BunHttpServer.layer({ hostname: "127.0.0.1", port: PORT, idleTimeout: 255 })` (`main.ts:116`) | None | Loopback. Matches spec SHOULD bind 127.0.0.1, not 0.0.0.0. Port default 3939 (`main.ts:55-57`). |
| Bearer | `requireRpcSessionToken` on `/mcp` (`OntologyMcpTransport.ts:97`) and globally on `/rpc` when the token exists (`main.ts:91-94`, `RpcSessionAuth.ts:127-128`) | None | Per-launch `BEEP_DESKTOP_RPC_SESSION_TOKEN` (`RpcSessionAuth.ts:28-36`). Compared as exact `Authorization: Bearer ${token}` (`:44`, `:55-56`). OPTIONS exempt (`:66-73`). Failure: 401 text `"Unauthorized desktop RPC session."` (`:110-113`). |
| Origin | Sidecar MW + `allowedOrigins` passed into `layerHttp` | DNS-rebinding 403 when Origin present and not listed | Sidecar extra: deny missing Origin; typed JSON 403; metric/span/log (see §4). |
| CORS | Sidecar only | None | Header lists (§1). Outermost OPTIONS 204. |
| Request size | **NOT FOUND** on `/mcp` or in Effect MCP HTTP | `request.text` with no cap (`RpcServer.ts:1094-1096` reads the full body after admission already parsed `request.text` in `layerMcpProtocolHttp` at `McpServer.ts:1603-1605`) | App must set a limit if one is wanted. UNVERIFIED Bun default. |
| Rate limit | **NOT FOUND** on `/mcp` | None. Spec notes intermediaries MAY rate-limit on mirrored headers but SHOULD verify `MCP-Protocol-Version` first ([Server Validation](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)). | App must add one if wanted. `Mcp-Method` / `Mcp-Name` become the natural keys after G4; they are not in CORS today. |
| Replay | **NOT FOUND** | Sessions are not a replay nonce on 2026-07-28 (header ignored) | Static per-launch bearer + Origin. A captured POST from an allowed origin with the live bearer replays until the sidecar process exits. No request nonce, no body hash, no expiry on the token other than process lifetime. |
| Idle / SSE | `idleTimeout: 255` (Bun max) (`main.ts:113-116`) | Request-scoped SSE; GET SSE not offered (405) | Long `subscriptions/listen` needs this timeout. Spec encourages SSE comment keep-alives; **NOT FOUND** in `toServerSentEvents`. |

### 3.2 Bearer placement relative to Effect

Observed POST outcomes (`ontology-mcp-http.test.ts:189-201`):

- Allowed Origin, no `Authorization` → **401** (bearer MW).
- Attacker Origin, valid bearer → **403** JSON `OntologyMcpOriginForbidden` (sidecar Origin MW).

Those two cases do not pin whether bearer or Origin runs first: both orders
produce the same pair. Unauthenticated + attacker Origin is **UNVERIFIED**
(401 if bearer is outer, 403 if Origin is outer). CORS on non-OPTIONS only
appends a pre-response handler then calls inner (`HttpMiddleware.ts:453-454`),
so CORS does not skip bearer/Origin on POST.

G4 does not change bearer placement. It does change what a replayed request
must carry (`Mcp-Method`, `Mcp-Name`, `_meta`) without adding a session-bound
nonce.

### 3.3 Sessions are not an auth factor today

The bearer is per-launch, not per MCP session (`22-r3` §1.5;
`RpcSessionAuth.ts:88-119`). `mcp-session-id` is not checked by
`requireRpcSessionToken`. Dropping sessions does not remove HTTP
authentication. It does remove the only stable per-client key the governed
gate uses on HTTP (22-r3; summarized in §4.4).

Config boundary: the token is `Config.Redacted("BEEP_DESKTOP_RPC_SESSION_TOKEN")`
(`RpcSessionAuth.ts:36`), which matches `06-configuration-boundaries.md` (typed
`Config`, redacted secrets). The Origin allowlist is a **literal array** in
`OntologyMcpTransport.ts:50-58`, not a config declaration. That is a
config-boundary smell, not a G4 blocker.

---

## 4. Observability inventory

Doctrine: `repo:standards/architecture/12-observability.md`. Slice boundaries
are span boundaries; names are `<slice>.<concept>.<action>`; no raw user input
on spans (§3); happy path is spans not logs (§4).

### 4.1 Spans

| Span name | Source | Attributes today | Maps to 12-observability? | After no session |
| --- | --- | --- | --- | --- |
| `ontology.mcp.origin` | Sidecar Origin MW (`OntologyMcpTransport.ts:90`) | `decision`: `allowed`/`denied`; `method` (`:72`) | Close to `<slice>.<concept>.<action>`. Low-cardinality attributes. | Unchanged. No session/client identity was ever attached. |
| `desktop.rpc.authorize` | Bearer MW (`RpcSessionAuth.ts:116`) | `decision`, `method` (`:96-99`) | Protocol-adjacent; `desktop` is the app, not a slice package. Low cardinality. | Unchanged. Token is not logged (redacted compare). |
| `mcp.tool.call.${tool.name}` | `withSanitizedToolSpan` (`SanitizedSpan.ts:164-165`, `:191`, `:324`) | Toolkit dispatch also tries to set `parameters`; wrapper drops keys in `defaultSanitizedSpanKeys` = `["parameters"]` (`:58`, `:132-136`) | Technical MCP namespace, not slice.concept.action. Tool name in the span **name** is cardinality = number of tools (usually fine). Suppressing `parameters` is exactly doctrine §3 ("Do not attach raw user input"). | Unchanged sanitizer. Caller identity is in `CurrentMcpCaller`, not on the span. |
| `McpKit.handle` | `Effect.fn("McpKit.handle")` around dispatch (`SanitizedSpan.ts:302`) | None at open | Anti-pattern adjacent: function-path name (`12-observability.md:221`). | Unchanged. |
| `McpServer` | `RpcServer.make(..., { spanPrefix: "McpServer" })` (`McpServer.ts:1333-1335`) | Effect RPC request spans under that prefix | Effect technical prefix. Not beep slice names. | Unchanged. |
| `McpServer/Notifications` | Broadcast notification client (`McpServer.ts:324-325`) | — | Effect technical. | Unchanged. Delivery without sessions is an 11-u2 runtime fact (`canDeliver` on stateless returns true, `mcpRuntime.ts:445-446`). |
| `McpServer/Client` | Reverse/MRTR client (`mcpProtocol.ts:524-526`) | — | Effect technical. | Unchanged. |
| `professional_desktop.sidecar.runtime` | `Layer.withSpan` on Main (`main.ts:157`) | — | Process lifetime, not per request. | Unchanged. |
| `Epistemic.GovernedTierGate.evaluate` | `Effect.fn` (`GovernedTierGate.gate.ts:342`) | — | Codepath-ish name (doctrine §6). | Still opens; run identity underneath changes (§4.4). |
| `http.route` attribute | Router sets `http.route` on the parent span when sampled (`HttpRouter.ts:223-227`) | Path template | OTel technical. | Unchanged (`/mcp`). |

### 4.2 Metrics

| Name | Labels / attributes | Source | After no session |
| --- | --- | --- | --- |
| `desktop_ontology_mcp_origin_decisions_total` | `decision`, `method` (`OntologyMcpTransport.ts:46-48`, `:72-73`) | Incremented on every Origin MW evaluation, allow or deny | Unchanged. OPTIONS no longer hits this counter if CORS is outermost (§2.3). |
| `desktop_rpc_auth_decisions_total` | `decision`, `method` (`RpcSessionAuth.ts:20`, `:96-100`) | Every bearer MW evaluation | Unchanged. OPTIONS exempt, so OPTIONS does not increment if CORS short-circuits first. |

OTLP export is opt-in via `OTEL_EXPORTER_OTLP_ENDPOINT`
(`apps/professional-desktop/src/runtime/Observability.ts:35-38`, `:56-77`).
Resource attributes include `session_id` from **`BEEP_QA_SESSION_ID`**, not MCP
(`:60`, `:78-84`), plus `launch_id`, `build_commit`, `transport`,
`component: sidecar`. Prometheus prefix `professional_desktop` (`:87`).
Exact exported Prometheus series name: UNVERIFIED (prefix wrapping).

Stdio hosts (nlp/m365/uspto/gov-legal/practice-kg): **NOT FOUND** host-local
MCP metrics equivalent to the two desktop counters. They inherit Effect +
`sanitizedToolkit` spans only.

### 4.3 Logs

| Event | Fields | Doctrine |
| --- | --- | --- |
| `ontology MCP origin denied` (Warn) | `method`, `subsystem: ontology_mcp` (`OntologyMcpTransport.ts:77-78`) | Deny path: log + span. No Origin **value** is logged (good; Origin can be high-cardinality / attacker-controlled). |
| `desktop RPC session authorization denied` (Warn) | `method`, `subsystem: rpc_auth` (`RpcSessionAuth.ts:104-108`) | Same pattern. Token not logged. |
| `professional desktop sidecar ready` (Info) | `auth_enabled`, `ontology_mcp_mutations_enabled`, `port`, `transport` (`main.ts:139-145`) | Boot, not per request. |
| `governed tier gate refused a dispatch` (Warn) | `guidance`, `reason`, `subsystem: epistemic_governed_tier_gate`, `tool` (`GovernedTierGate.gate.ts:332-338`) | Bounded reason stays off the agent-facing audit (22-r3). **No `sessionId` / `clientId` on the log.** |
| `Tool call failed…` path | `Effect.tapCause(Effect.log)` in sanitized dispatch (`SanitizedSpan.ts:329`, `:341`) | Failure-path log. |

Happy-path tool calls emit no host log, which matches doctrine §4.

### 4.4 Identity attributes that lose meaning without sessions

`McpCallerIdentity` (`repo:packages/foundation/capability/mcp-kit/src/McpCaller.ts:21-28`,
`:42-55`):

- `clientId` — "one **protocol exchange**, not one session". HTTP mints it per
  request (`effect:packages/effect/src/unstable/rpc/RpcServer.ts:1074`, `:1097`).
- `sessionId` — `mcp-session-id` header, `None` when absent. Populated in
  `sanitizedToolkit` from `HttpServerRequest` (`SanitizedSpan.ts:199-202`,
  `:304-322`).

On 2026-07-28 HTTP:

- Server does not mint or echo `Mcp-Session-Id` (§1.2).
- `sessionId` on `CurrentMcpCaller` is therefore `None` unless a client
  **sends** a leftover header. Effect ignores that header for routing
  (`v2026_07_28.test.ts:123-128`) but `Headers.get` would still populate
  `McpCallerIdentity.sessionId` if a client chooses to send one
  (`SanitizedSpan.ts:314-316`). That is an **unauthenticated, client-supplied**
  string — a decision-challenge if anything keys on it after G4.

`GovernedTierGate.runIdOf` (owned by 22-r3; cited because it is the audit
join key the sidecar actually uses):

```
Some(sessionId) → "session:${sessionId}"
None            → "client:${clientId}"
```

(`repo:packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:188-197`)

On stdio, `RpcServer` protocol `clientIds` is `Set([0])`
(`RpcServer.ts:1398`) and `sessionId` is `None`, so `runId` is stable
`client:0` for the process. On **HTTP** 2026-07-28, `clientId++` per POST
makes `runId` **per request**. Comment on the gate: keying on `clientId`
"would open a new run per dispatch and reduce every chain to a single genesis
row" (`GovernedTierGate.gate.ts:188-192`). Desktop HTTP integration depends on
one MCP session chaining two mutations
(`ontology-mcp-http.test.ts` title at `:242`; 22-r3 §1.4). That test's
observability/audit meaning does not survive a G4-only HTTP sidecar.

Grant freeze comment still says sessions "exist only after an `initialize`
that already cleared the origin allowlist and the per-launch bearer token"
(`GovernedTierGate.gate.ts:35-37`, `:283-285`). Under G4, `initialize` is not
supported (11-u2 / Gate A: `mcpRuntime.ts:319-326`). The comment is then false
for HTTP.

Spans themselves never carried `mcp-session-id`. What loses meaning is the
**join** across: origin decision → auth decision → `mcp.tool.call.*` →
`GovernedTierGate.evaluate` → ledger `runKey`. Today the join is the session
header (HTTP) or `client:0` (stdio). After G4 HTTP, the join is a
per-request integer plus whatever OTLP trace id Effect already propagates
(`supportsSpanPropagation: true` on stdio protocol, `RpcServer.ts:1402`; HTTP
path UNVERIFIED for traceparent).

`McpRequestContext` still has `clientId`, `protocolVersion`, `clientCapabilities`,
`clientInfo`, `requestMetadata` (`mcpRuntime.ts:355-361`). `clientInfo` is
client-asserted per request on 2026-07-28, not a server-minted stable id
(11-u2 owns field population). It is **not** currently copied onto
`ontology.mcp.origin` or `mcp.tool.call.*` spans.

### 4.5 Stdio hosts after G4

nlp / m365 / uspto / gov-legal / practice-kg: `sanitizedToolkit` +
`layerStdio` + `McpServer` span prefix. No Origin metric. `sessionId` already
`None`. `clientId` already connection-scoped `0`. Observability regression
from dropping sessions is **small** on stdio relative to the HTTP sidecar.

---

## 5. Options and grill questions (no decision)

### 5.1 Keep or remove the sidecar Origin middleware

| Option | What it does | Tradeoff | Label |
| --- | --- | --- | --- |
| **A. Keep** sidecar Origin MW + pass the same list into `layerHttp` | Typed JSON 403, metric, span, log; deny missing Origin | Duplicate allowlist with Effect on POST; OPTIONS still bypasses it via CORS 204; Origin-less clients stay blocked | Status quo |
| **B. Remove** sidecar Origin MW; keep Effect `allowedOrigins` + CORS | One Origin check; Effect 403 empty; Origin-less clients work | Lose `desktop_ontology_mcp_origin_decisions_total`, `ontology.mcp.origin`, typed `OntologyMcpOriginForbidden`; OPTIONS still 204 not 403 | Complementary-only CORS |
| **C. Keep MW, drop `allowedOrigins` from `layerHttp`** | Sidecar is the only Origin check | Effect default-deny empty list would 403 **every** browser Origin if the option is omitted (`McpServer.ts:1734`). Must pass the list **or** omit Origin from browser clients. | Foot-gun |
| **D. Make OPTIONS 403 for attacker Origin** (inner Origin MW before CORS, or CORS that 403s disallowed Origin) | Spec/Effect conformance on OPTIONS | Browsers only need "no ACAO"; 403 vs 204 is not user-visible. Adds complexity. | Spec-strict |
| **E. Keep a stateful protocol on the sidecar only** (mixed list) | Sessions remain for HTTP governance + CORS `mcp-session-id` stays meaningful | Contradicts G4. Effect allows mixed lists with at most one stateless adapter (`mcpRuntime.ts:193-209`). | **G4-contradicting** |

### 5.2 CORS header set under G4

| Option | `allowedHeaders` | `exposedHeaders` | Tradeoff |
| --- | --- | --- | --- |
| **F. Status quo** | `authorization, content-type, mcp-protocol-version, mcp-session-id` | `mcp-protocol-version, mcp-session-id` | Browser 2026-07-28 clients cannot preflight. In-repo `HttpClient` tests stay green. |
| **G. Add routing headers** | Add `mcp-method`, `mcp-name` | Drop `mcp-session-id`; keep or drop `mcp-protocol-version` (likely unset on 2026-07-28 responses) | Minimum for a conforming browser POST. |
| **H. Add `mcp-param-*`** | Wildcard or reflect `Access-Control-Request-Headers` (empty `allowedHeaders` reflects, `HttpMiddleware.ts:375-379`) | — | Needed if any tool gains `x-mcp-header`. Reflecting is looser than an allow-list. |
| **I. Expose `content-type` and `allow`** | — | Add `content-type` (SSE is not safelisted), maybe `allow` | Only if browser JS must inspect SSE vs JSON. |
| **J. `allowedHeaders: ["*"]` like `/rpc`** | Wildcard | — | Simplest; weaker explicitness than `/mcp` has today. |

### 5.3 Per-request correlation without sessions

| Option | Key | Stable across HTTP POSTs of one UI session? | Auth-bound? | Notes |
| --- | --- | --- | --- | --- |
| **K. OTLP trace id** | Effect span propagation | Only if the client sends `traceparent` | No | Already the doctrine-shaped join (`12-observability.md` §1). HTTP `supportsSpanPropagation` for MCP: UNVERIFIED. |
| **L. `clientInfo` from `_meta`** | `name`/`version` (and any extra fields) | Only if the client repeats them | No (client-asserted) | Present on every 2026-07-28 request (`mcpRuntime.ts:244-252`, `:348-360`). High collision. |
| **M. JSON-RPC `id`** | Per request | No | No | Fine for one POST, useless across POSTs. |
| **N. Per-launch bearer as run id** | Token identity (not the secret) | Yes, for the whole sidecar process | Yes | Collapses every webview user on that launch into one governed run. Opposite of today's per-MCP-session freeze. |
| **O. New correlation header** (e.g. `Mcp-Client-Session` / `BEEP-Run-Id`) minted by the desktop shell | App-defined | Yes if the shell holds it | Only if bound to the bearer | Not in the MCP spec. Would need CORS `allowedHeaders`. Closest replacement for `mcp-session-id` on HTTP. |
| **P. Trust client-supplied `Mcp-Session-Id` even though 2026-07-28 ignores it** | Header `sanitizedToolkit` already reads | Yes if the client sends it | **No** — Effect ignores it; any caller can pick a string | **decision-challenge.** Quietly preserves gate chaining with an unauthenticated key. |
| **Q. Mixed protocol on the sidecar** | Real `mcp-session-id` | Yes | Indirect (only after Origin+bearer `initialize`) | **G4-contradicting.** Preserves 22-r3 invariants and today's CORS expose list. |

Stdio G9 hosts: option N/K are enough; `client:0` already joins a process.

### 5.4 Grill questions (operator only)

1. Is any **browser-origin** client of `/mcp` in scope for G4 (Tauri webview, portless Vite, future workbench), or is `/mcp` only for in-repo `HttpClient` / tests? CORS `Mcp-Method` / `Mcp-Name` only matter if the answer includes a browser.
2. Should attacker-Origin **OPTIONS** stay 204-without-ACAO (CORS) or become 403 (spec / Effect security suite)?
3. Should Origin-less POST stay denied (sidecar) or become allowed (Effect/spec non-browser path)?
4. Keep the sidecar Origin middleware for the typed 403 + metric, or treat Effect `allowedOrigins` as sufficient?
5. Under G4 HTTP, what is the governed-run identity: per-launch bearer, a new shell-minted header, OTLP trace, client-supplied `Mcp-Session-Id`, or keep a stateful adapter on the sidecar (G4-contradicting)?
6. Should `mcp.tool.call.*` / `ontology.mcp.origin` grow a correlation attribute (`clientInfo.name`, run id, trace id) so origin/auth/tool/ledger can be joined without `mcp-session-id`?
7. Do we want an HTTP body-size cap and/or rate limit keyed on `Mcp-Method`/`Mcp-Name` now that those headers exist, or is loopback + bearer enough?
8. Is the Origin allowlist allowed to remain a literal in `OntologyMcpTransport.ts`, or does `06-configuration-boundaries.md` require a config declaration before it is touched?

---

## Sources

- Effect: `packages/effect/src/unstable/ai/McpServer.ts`, `internal/mcpRuntime.ts`, `internal/mcpProtocol.ts`, `internal/mcpProtocol/v2026_07_28.ts`, `unstable/http/HttpMiddleware.ts`, `unstable/http/HttpRouter.ts`, `unstable/http/Headers.ts`, `unstable/rpc/RpcServer.ts`
- Effect tests: `McpConformance/TransportsTest.ts`, `v2026_07_28.test.ts`, `ProtocolAdapters.test.ts`, `TestUtils/McpServerLayer.ts`
- Spec: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
- Repo: `apps/professional-desktop/server/OntologyMcpTransport.ts`, `RpcSessionAuth.ts`, `main.ts`, `src/runtime/Observability.ts`, `test/integration/ontology-mcp-http.test.ts`, `test/integration/support/ontology-mcp-harness.ts`
- Repo: `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts`, `McpCaller.ts`
- Repo: `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts`
- Repo: `standards/architecture/12-observability.md`, `06-configuration-boundaries.md`
- Sibling lanes: `research/11-u2-stateless-runtime.md` (admission), `research/21-r2-hosts.md` (hosts/harnesses), `research/22-r3-governance-identity.md` (run keys)

## Gate B verdicts (2026-09-17)

Three grok refuters voted on 11 claims from this lane (10 survive, 1 killed; per-vote detail in `verification/24-r5-http-security-observability.verdicts.jsonl`).

Struck claims (2 of 3 refuted):

- ~~`24-r5-http-security-observability-13` (decision-challenge): sanitizedToolkit still reads mcp-session-id into McpCallerIdentity.sessionId. Under 2026-07-28 HTTP the server does not mint that header, so sessionId is None unless a client supplies one. A client-supplied value is unauthenticated: Effect ignores it for routing but the kit and GovernedTierGate would still key a run on it.~~
  - Refuters: sanitizedToolkit only writes sessionId into McpCallerIdentity when McpServerClient is Some (SanitizedSpan.ts:313-322). 2026-07-28 ClientRequestRpcs has no McpServerClientMiddleware (mcpSchema/v2026_07_28.ts:614-625 vs v2025_06_18.ts:13-15), and provideInvocationContext does not attach serverClient (McpServer.ts:180-186; invocationFromRequestContext). CurrentMcpCaller is therefore None; GovernedTierGate.evaluate refuses no-grant-in-scope and never keys a run on a client-supplied mcp-session-id (GovernedTierGate.gate.ts:343-348).
