# Lane 13-s1-spec-delta — MCP specification 2026-07-28 delta

Lane owns: what the MCP specification says. Effect implementation coverage belongs to lane 11-u2.

Primary sources: official revision changelogs and the `2026-07-28` specification pages at `https://modelcontextprotocol.io/specification/...`. GitHub compare links are listed as the changelog's "full changelog" pointers. Working assumption G4 (`McpProtocol.v2026_07_28` only) is treated as an assumption, not a fact; section 4 records spec language that bears on it.

---

## 1. Changelog and SEP index

### 1.1 Official revision changelogs

| Revision | Official changelog | Diff base | Full GitHub compare (as linked from the changelog) |
| --- | --- | --- | --- |
| `2025-06-18` | https://modelcontextprotocol.io/specification/2025-06-18/changelog | `2025-03-26` | https://github.com/modelcontextprotocol/specification/compare/2025-03-26...2025-06-18 |
| `2025-11-25` | https://modelcontextprotocol.io/specification/2025-11-25/changelog | `2025-06-18` | https://github.com/modelcontextprotocol/specification/compare/2025-06-18...2025-11-25 |
| `2026-07-28` (current) | https://modelcontextprotocol.io/specification/2026-07-28/changelog | `2025-11-25` | https://github.com/modelcontextprotocol/specification/compare/2025-11-25...2026-07-28 |

GitHub release tags (stable announcements, not the spec text):

- `2025-06-18`: https://github.com/modelcontextprotocol/modelcontextprotocol/releases
- `2025-11-25`: same releases page
- `2026-07-28` stable: https://github.com/modelcontextprotocol/modelcontextprotocol/releases (tag `2026-07-28`)
- Blog announcement of the `2026-07-28` spec: https://blog.modelcontextprotocol.io/posts/2026-07-28/

Versioning policy (current revision): the protocol uses `YYYY-MM-DD` identifiers for the last date of backwards-incompatible change. Current protocol version is `2026-07-28`. https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning

### 1.2 `2025-06-18` — major items (changelog)

Source: https://modelcontextprotocol.io/specification/2025-06-18/changelog

1. Remove JSON-RPC batching — PR https://github.com/modelcontextprotocol/specification/pull/416
2. Structured tool output — PR https://github.com/modelcontextprotocol/modelcontextprotocol/pull/371
3. MCP servers classified as OAuth Resource Servers; protected resource metadata — PR https://github.com/modelcontextprotocol/modelcontextprotocol/pull/338
4. Clients MUST implement Resource Indicators (RFC 8707) — PR https://github.com/modelcontextprotocol/modelcontextprotocol/pull/734
5. Security considerations / best-practices page
6. Elicitation — PR https://github.com/modelcontextprotocol/modelcontextprotocol/pull/382
7. Resource links in tool results — PR https://github.com/modelcontextprotocol/modelcontextprotocol/pull/603
8. Require negotiated protocol version via `MCP-Protocol-Version` on subsequent HTTP requests — PR https://github.com/modelcontextprotocol/modelcontextprotocol/pull/548
9. Change SHOULD to MUST in Lifecycle Operation

Other schema: `_meta` on more types (PR 710); `context` on `CompletionRequest` (PR 598); `title` field (PR 663).

### 1.3 `2025-11-25` — major items (changelog)

Source: https://modelcontextprotocol.io/specification/2025-11-25/changelog

1. OpenID Connect Discovery 1.0 for authorization-server discovery — PR https://github.com/modelcontextprotocol/modelcontextprotocol/pull/797
2. Icons metadata for tools/resources/templates/prompts — [SEP-973](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/973)
3. Incremental scope consent via `WWW-Authenticate` — [SEP-835](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/835)
4. Tool-name guidance — [SEP-986](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1603)
5. `ElicitResult` / `EnumSchema` titled/untitled, single/multi-select — [SEP-1330](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1330)
6. URL-mode elicitation — [SEP-1036](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/887)
7. Sampling tool calling (`tools` / `toolChoice`) — [SEP-1577](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1577)
8. OAuth Client ID Metadata Documents as recommended registration — [SEP-991](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/991), PR https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1296
9. Experimental tasks — [SEP-1686](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1686)

Minor of particular interest: HTTP 403 for invalid Origin on Streamable HTTP (PR 1439); input-validation errors as Tool Execution Errors not Protocol Errors ([SEP-1303](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1303)); JSON Schema 2020-12 default dialect ([SEP-1613](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1613)); SSE polling / disconnect-at-will ([SEP-1699](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1699)); RFC 9728 alignment making `WWW-Authenticate` optional with `.well-known` fallback ([SEP-985](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/985)).

### 1.4 `2026-07-28` — major items, SEPs, and related PRs (changelog)

Source: https://modelcontextprotocol.io/specification/2026-07-28/changelog

| # | Change | SEP / PR |
| --- | --- | --- |
| 1 | Remove protocol-level sessions and `Mcp-Session-Id`. List endpoints no longer vary per-connection. Cross-call state uses server-minted handles as ordinary tool arguments. | [SEP-2567](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2567) |
| 2 | Stateless core: remove `initialize` / `notifications/initialized`. Every request carries version + client capabilities in `_meta`. Clients SHOULD identify themselves; servers SHOULD identify themselves in result `_meta`. Version mismatch → `UnsupportedProtocolVersionError`. | [SEP-2575](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575) |
| 3 | Add `server/discover` (servers MUST implement). Clients MAY call it first, or use it as a stdio backward-compat probe. | SEP-2575 |
| 4 | Replace HTTP GET + `resources/subscribe`/`unsubscribe` with `subscriptions/listen`. | SEP-2575 |
| 5 | Remove `ping`, `logging/setLevel`, `notifications/roots/list_changed`. Log level is per-request `_meta.io.modelcontextprotocol/logLevel`; servers MUST NOT emit `notifications/message` unless that field was present. | SEP-2575 |
| 6 | Tasks leave the core protocol; official extension `io.modelcontextprotocol/tasks`. | [SEP-2663](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2663) |
| 7 | Multi Round-Trip Requests (MRTR) replace server-initiated JSON-RPC requests. | [SEP-2322](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2322) |
| 8 | Required `resultType` (`"complete"` / `"input_required"`). Clients MUST treat omitted field from earlier-protocol servers as `"complete"`. | SEP-2322 |
| 9 | Remove SSE resumability / `Last-Event-ID`. Clients MUST re-issue a broken stream as a new request with a new ID. | SEP-2575 |

Minor (selected, all from the same changelog):

- Extensions map on capabilities.
- OpenTelemetry `_meta` keys — [SEP-414](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/414)
- Deterministic `tools/list` order (SHOULD)
- Required HTTP headers `Mcp-Method`, `Mcp-Name`; `x-mcp-header` — [SEP-2243](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2243)
- `ttlMs` / `cacheScope` on list/read results — [SEP-2549](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2549)
- Resource-not-found error `-32002` → `-32602`
- RFC 9207 `iss` — [SEP-2468](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2468)
- DCR `application_type` — [SEP-837](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/837)
- Credentials bound to issuer — [SEP-2352](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2352)
- JSON Schema 2020-12 keywords, `$ref` resolution, composition bounds — [SEP-2106](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2106)
- Remove `notifications/elicitation/complete` and URL-mode `elicitationId`
- Error-code allocation: `-32020` HeaderMismatch, `-32021` MissingRequiredClientCapability, `-32022` UnsupportedProtocolVersion

Deprecated in this revision (changelog + registry https://modelcontextprotocol.io/specification/2026-07-28/deprecated):

| Feature | SEP / PR | Earliest removal |
| --- | --- | --- |
| Roots | [SEP-2577](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2577) | first revision on or after 2027-07-28 |
| Sampling | SEP-2577 | same |
| Logging | SEP-2577 | same |
| OAuth Dynamic Client Registration | [PR #2858](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2858) | first revision on or after 2027-07-28 |
| `includeContext` `"thisServer"` / `"allServers"` | [SEP-2596](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2596) (soft-deprecated 2025-11-25) | follows Sampling |
| HTTP+SSE transport | SEP-2596 (deprecated since 2025-03-26) | three months after SEP-2596 reaches Final |

Governance: feature lifecycle / deprecation policy [SEP-2596](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2596); PR-based SEP workflow [SEP-1850](https://github.com/modelcontextprotocol/specification/pull/1850).

### 1.5 Official SEP pages (historical; spec text is authoritative)

The spec site hosts accepted SEPs as historical records. Each page states that post-Final spec edits are **not** reflected in the SEP body; use the current specification for MUST/SHOULD.

| SEP | Official page | GitHub PR | Status |
| --- | --- | --- | --- |
| SEP-2575 Make MCP Stateless | https://modelcontextprotocol.io/seps/2575-stateless-mcp.md | https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575 | Final |
| SEP-2567 Sessionless MCP via Explicit State Handles | https://modelcontextprotocol.io/seps/2567-sessionless-mcp.md | https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2567 | Final |
| SEP-2322 Multi Round-Trip Requests | https://modelcontextprotocol.io/seps/2322-MRTR.md | https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2322 | Final. Persistent-task workflow in this SEP (`tasks/result`, `tasks/input_response`) is historical; 2026-07-28 moved tasks to the `io.modelcontextprotocol/tasks` extension (SEP-2663) and kept MRTR in core. |
| SEP-2243 HTTP Header Standardization | https://modelcontextprotocol.io/seps/2243-http-standardization.md (linked from SEP-2663) | https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2243 | UNVERIFIED page body |
| SEP-2549 TTL for List Results | https://modelcontextprotocol.io/seps/2549-TTL-for-list-results | https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2549 | Final |
| SEP-2663 Tasks Extension | https://modelcontextprotocol.io/seps/2663-tasks-extension | https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2663 | Final |
| SEP-2164 Resource Not Found error code | https://modelcontextprotocol.io/seps/2164-resource-not-found-error | (changelog cites the `-32002` → `-32602` change) | Final |
| SEP-1686 Tasks (historical core feature) | https://modelcontextprotocol.io/seps/1686-tasks.md | (2025-11-25 experimental tasks) | Final, superseded in core by SEP-2663 |
| SEP-1303 Input validation as tool execution errors | https://modelcontextprotocol.io/seps/1303-input-validation-errors-as-tool-execution-errors | https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1303 | Final (landed in 2025-11-25) |

SEP-2575 records three post-Final spec edits that **override** the SEP body (https://modelcontextprotocol.io/seps/2575-stateless-mcp.md "Changes since SEP became Final"):

1. `io.modelcontextprotocol/clientInfo` became optional; clients **SHOULD** include it — [PR #3002](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3002).
2. `io.modelcontextprotocol/serverInfo` moved to optional result `_meta`; top-level `DiscoverResult.serverInfo` removed — same PR.
3. `subscriptions/listen` gained a graceful completion result; servers **SHOULD** send it before closing the stream — [PR #2953](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2953).

The current spec pages already incorporate those three. Do not implement `clientInfo` as required from the SEP body.

### 1.6 Handshake contrast: `2025-06-18` / `2025-11-25` vs `2026-07-28`

Both earlier revisions **MUST** start with `initialize`:

> The initialization phase **MUST** be the first interaction between client and server.

> The client **MUST** initiate this phase by sending an `initialize` request …

> After successful initialization, the client **MUST** send an `initialized` notification …

> If the server supports the requested protocol version, it **MUST** respond with the same version. Otherwise, the server **MUST** respond with another protocol version it supports.

https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle (same MUST language; 2025-11-25 additionally advertises experimental `tasks` on both sides)

`2026-07-28` inverts that: there is no handshake; every request is independently versioned. See §2.1.

---

## 2. `2026-07-28` normative rules (quoted MUST/SHOULD)

Each subsection quotes the specification language. Quotes are from the fetched page text. URLs are the page URLs.

### 2.1 Connection / session establishment and version negotiation

There is no handshake. Every request carries its version; the server accepts or rejects independently.

> There is no negotiation handshake. Every request carries its protocol version, and the server accepts or rejects each request independently.

https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning

> If the server does not implement the requested version (whether the version is unknown to the server, or is a known version the server has chosen not to support), it **MUST** respond with an `UnsupportedProtocolVersionError` listing the versions it does support.

> The client **SHOULD** select a mutually supported version from the `supported` list and retry the request, or surface an error to the user if no compatible version exists.

> Servers **MUST** implement `server/discover`. Clients **MAY** call it before sending any other requests to learn the server's supported versions up front, but are not required to: a client is free to invoke any RPC inline and handle `UnsupportedProtocolVersionError` if its preferred version is not supported.

https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning

Statelessness of the connection itself:

> Servers **MUST NOT** rely on prior requests over the same connection to establish context (e.g., capabilities, protocol version, client identity). Every request supplies this metadata in its `_meta` field.

> State that needs to span multiple requests (e.g., long-running tasks, application-level handles) **MUST** be referenced by an explicit identifier the client passes on each request.

https://modelcontextprotocol.io/specification/2026-07-28/basic/index

Required `_meta` on every request:

> | `io.modelcontextprotocol/protocolVersion` | `string` | Yes | Protocol version for this request |
> | `io.modelcontextprotocol/clientCapabilities` | `ClientCapabilities` | Yes | Client capabilities relevant to this request |
> | `io.modelcontextprotocol/clientInfo` | `Implementation` | No | Client name and version |

> A request missing any required field is malformed; the server **MUST** reject it with JSON-RPC error code `-32602` (Invalid params). On HTTP, the response status **MUST** be `400 Bad Request`.

> Clients **SHOULD** include `io.modelcontextprotocol/clientInfo` on every request unless specifically configured not to do so.

> A server **MUST NOT** rely on capabilities the client has not declared. If processing a request requires a capability the client did not include in `io.modelcontextprotocol/clientCapabilities`, the server **MUST** return a `MissingRequiredClientCapabilityError` (`-32021`) … On HTTP, the response status **MUST** be `400 Bad Request`.

> Servers **SHOULD** include … `io.modelcontextprotocol/serverInfo` in every result's `_meta` …

https://modelcontextprotocol.io/specification/2026-07-28/basic/index

`server/discover`:

> Servers **MUST** implement it.

> Calling `server/discover` is optional for clients — a client may invoke any RPC inline and handle `UnsupportedProtocolVersionError` if the server does not support the requested version.

https://modelcontextprotocol.io/specification/2026-07-28/server/discover

`resultType`:

> Result responses **MUST** include a `resultType` field to indicate the type of the result.

> For backward compatibility with servers implementing earlier protocol versions, which do not include `resultType`, clients **MUST** treat an absent `resultType` as `"complete"`.

https://modelcontextprotocol.io/specification/2026-07-28/basic/index

### 2.2 Session identifiers

Protocol-level sessions are gone. A modern-only HTTP server **SHOULD** ignore leftover session headers rather than mint IDs.

> Remove protocol-level sessions and the `Mcp-Session-Id` header from the Streamable HTTP transport.

https://modelcontextprotocol.io/specification/2026-07-28/changelog

> A server that supports only this revision and receives such traffic from an older client **SHOULD** respond as follows:
> * HTTP GET or DELETE to the MCP endpoint: respond with `405 Method Not Allowed`.
> * An `Mcp-Session-Id` header on a request: ignore it, and do not mint or echo session IDs.
> * A `Last-Event-ID` header: ignore it; streams are not resumable.

https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http

Application-level handles (non-normative on the tools page, but the base protocol makes the identifier requirement MUST):

> MCP has no protocol-level session, so a server cannot rely on implicit per-connection state to relate one tool call to the next. Servers that need to maintain state across calls … should do so by returning an explicit handle from a creation tool and accepting that handle as an argument on subsequent calls.

https://modelcontextprotocol.io/specification/2026-07-28/server/tools

The only remaining identifier that looks session-like is `io.modelcontextprotocol/subscriptionId`, which is the JSON-RPC id of a `subscriptions/listen` request, scoped to that request, not to the connection. See §2.6.

### 2.3 Per-request metadata and required HTTP headers

Every HTTP POST **MUST** carry `MCP-Protocol-Version`, and it **MUST** match body `_meta`. `Mcp-Method` is required on all requests; `Mcp-Name` is required for `tools/call`, `resources/read`, `prompts/get`.

> Every POST request to the MCP endpoint **MUST** include an `MCP-Protocol-Version` header.

> The header value **MUST** match the `io.modelcontextprotocol/protocolVersion` field carried in the request body's `_meta`. If the values do not match, the server **MUST** reject the request with `400 Bad Request` and a `HeaderMismatch` JSON-RPC error.

> If the server does not implement the requested protocol version … it **MUST** respond with `400 Bad Request` and an `UnsupportedProtocolVersionError` listing its supported versions.

> If the server does not implement the requested RPC method, it **MUST** respond with `404 Not Found` and a JSON-RPC error with code `-32601` (`Method not found`).

> A server that does not support [clients earlier than `2025-06-18`] **MUST** reject a request without the header per Server Validation.

https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http

> These headers are **REQUIRED** for compliance. [`Mcp-Method` for all requests; `Mcp-Name` for `tools/call`, `resources/read`, `prompts/get`]

> Clients **MUST** include an `Accept` header listing both `application/json` and `text/event-stream` as supported content types.

> The client **MUST** include the request metadata headers on each POST request.

> The body of the HTTP POST **MUST** be a single JSON-RPC *request* or *notification*. The client **MUST NOT** send JSON-RPC *responses*.

Header/body validation:

> Servers that process the request body **MUST** reject requests where the values specified in the headers do not match the corresponding values in the request body.

> When rejecting a request due to header validation failure, servers **MUST** return HTTP status `400 Bad Request` and **MUST** include a JSON-RPC error response using … `-32020` `HeaderMismatch`.

`x-mcp-header` (client MUST, server MAY):

> While the use of `x-mcp-header` is optional for servers, clients **MUST** support this feature. When a server's tool definition includes `x-mcp-header` annotations, conforming clients **MUST** mirror the designated parameter values into HTTP headers.

> Clients using the Streamable HTTP transport **MUST** reject tool definitions where any `x-mcp-header` value violates these constraints. Rejection means the client **MUST** exclude the invalid tool from the result of `tools/list`.

https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http

stdio has no header layer:

> All request metadata for the stdio transport is carried inline in the JSON-RPC message body. … There is no header layer.

https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio

### 2.4 stdio transport framing and compatibility probing

Framing:

> Messages are delimited by newlines, and **MUST NOT** contain embedded newlines.

> The server **MUST NOT** write anything to its `stdout` that is not a valid MCP message.

> The client **MUST NOT** write anything to the server's `stdin` that is not a valid MCP message.

> The client **MUST NOT** write JSON-RPC *responses*.

> The server **MUST NOT** write JSON-RPC *requests* to `stdout`. Server-to-client interactions are carried in `InputRequiredResult` replies.

> The server **MAY** write UTF-8 strings to `stderr` for any logging purposes … The client **MAY** capture, forward, or ignore the server's `stderr` output and **SHOULD NOT** assume `stderr` output indicates error conditions.

Cancellation / shutdown:

> To cancel an in-flight request, the client **MUST** send a `notifications/cancelled` notification referencing the request's ID. … Servers **SHOULD** stop work on a cancelled request as soon as practical and **MUST NOT** send any further messages for it.

> The client **SHOULD** initiate shutdown by: 1. Closing the input stream … 2. Waiting for the server to exit. 3. If the server does not exit within a reasonable time, forcibly terminating the process …

> Servers **SHOULD** exit promptly when their standard input is closed or reads return end-of-file.

> If the server process exits unexpectedly, the client **SHOULD** restart it.

https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio

Compatibility probing (dual-era *clients*; modern-only clients have a weaker SHOULD/RECOMMENDED):

> A client that supports both modern (per-request-metadata) MCP versions and a legacy version that requires an `initialize` handshake **SHOULD** probe with `server/discover` before sending any other request, setting its preferred modern version in `_meta`. The probe has three possible outcomes:
> * The server returns a `DiscoverResult`: the server is modern. …
> * The server returns a recognized modern JSON-RPC error such as `UnsupportedProtocolVersionError`: the server is modern but does not support the requested version. Use one of the versions in its advertised `supported` list. Do **not** fall back to `initialize`.
> * The server returns any other error, or does not respond within a reasonable timeout: the server is legacy. Fall back to the `initialize` handshake.

> The fallback **MUST NOT** be keyed to one specific error code: legacy servers respond to unknown pre-`initialize` requests with implementation-defined errors (commonly `-32601` or `-32602`) or not at all.

> A client that only supports modern versions does not need to probe, but probing is still **RECOMMENDED**: some legacy servers do not validate that a request arrives after `initialize` and would process an era-ambiguous method (such as `tools/call`) under legacy semantics. Probing yields a deterministic failure instead.

https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio

### 2.5 Multi-round-trip / input-required requests

> Servers **MUST** send server-to-client requests (such as `roots/list`, `sampling/createMessage`, or `elicitation/create`) using the MRTR pattern. The previous pattern of server-initiated requests is no longer supported. This is a breaking change.

> Every request **MUST** include the required `_meta` fields.

https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr

Allowed methods:

> Servers **MAY** send `InputRequiredResult` responses on the following client requests: `prompts/get`, `resources/read`, `tools/call`.

> Servers **MUST NOT** send `InputRequiredResult` responses on any other client requests.

Server requirements (selected):

> `inputRequests` keys … **MUST** be unique within the scope of the request.

> `inputRequests` values … **MUST** be one of `ElicitRequest`, `CreateMessageRequest`, or `ListRootsRequest`.

> If a client request contains a `requestState` field, servers **MUST** treat `requestState` as an attacker-controlled input. If `requestState` influences authorization, resource access, or business logic, servers **MUST** protect its integrity (e.g. HMAC or AEAD) and **MUST** reject state that fails verification.

> To prevent replay, servers **SHOULD** include [principal, TTL, originating-request identifier] inside the integrity-protected `requestState` payload and verify each on receipt.

> Servers for which a given `requestState` must be consumed at most once … **MUST** enforce that invariant server-side.

> Servers **MUST** include at least one of `inputRequests` or `requestState` in every `InputRequiredResult` response.

> Servers **MUST NOT** send an `inputRequests` that the client has not declared support for in its capabilities.

> Servers **MUST NOT** assume that clients will fulfill the `inputRequests` or retry the original request.

Client requirements:

> If a client receives an `InputRequiredResult` that contains the `inputRequests` field, the client **MUST** construct the requested inputs before retrying the original request.

> If an `InputRequiredResult` contains the `requestState` field, the client **MUST** echo back the exact value … Clients **MUST NOT** inspect, parse, modify, or make any assumptions about the `requestState` contents.

> The JSON-RPC `id` **MUST** be different between the initial request and the retry.

https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr

HTTP transport restates that servers **MUST NOT** send independent JSON-RPC *requests* on the SSE stream; MRTR is the only path. https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http

### 2.6 Subscriptions and change notifications

> The server **MUST NOT** send notification types the client has not explicitly requested.

> The server **MUST** send `notifications/subscriptions/acknowledged` as the first message carrying the subscription's ID in `_meta` under `io.modelcontextprotocol/subscriptionId`, and **MUST NOT** send any notification on the subscription before it.

> On stdio, where all messages share a single channel, clients **MUST** use this field to correlate notifications with their originating subscription.

> A client **MAY** have multiple active subscriptions concurrently.

> When the server ends a subscription on its own initiative … it **SHOULD** respond to the original `subscriptions/listen` request with a completion result before closing the stream.

> On **stdio**, if the connection is terminated and then re-established, the client **MUST** re-send `subscriptions/listen` to re-establish its subscriptions — the server holds no subscription state across reconnections.

https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions

Tools list-changed:

> When the list of available tools changes, servers that declared the `listChanged` capability **SHOULD** send a notification to clients that have opened a `subscriptions/listen` stream with `toolsListChanged: true`.

https://modelcontextprotocol.io/specification/2026-07-28/server/tools

Request-scoped notifications (`notifications/progress`, `notifications/message`) stay on the originating request's response stream, not on `subscriptions/listen` (changelog item 4; restated on the Streamable HTTP page).

Logging opt-in (changelog item 5; `_meta` table):

> `io.modelcontextprotocol/logLevel` — Minimum log level the server should emit for a request.

https://modelcontextprotocol.io/specification/2026-07-28/basic/index

Confirmed on the logging page (deprecated feature, still in the spec for ≥12 months):

> To receive log messages for a specific request, include `io.modelcontextprotocol/logLevel` in the request's `_meta`. The server **MUST NOT** emit `notifications/message` for a request that does not include this field.

> When the field is present, the server **MAY** send `notifications/message` notifications at or above the requested level on the response stream of that request, before the final response. `notifications/message` is request-scoped: the server **MUST NOT** deliver it on a `subscriptions/listen` stream or on any stream other than the one carrying the response to the request that set the log level.

> New implementations **SHOULD NOT** adopt it; existing implementations **SHOULD** migrate to logging to `stderr` for stdio transports, or to OpenTelemetry for structured observability.

> Log messages **MUST NOT** contain: Credentials or secrets; Personal identifying information; Internal system details that could aid attacks.

> Servers **SHOULD**: Rate limit log messages …

https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/logging

### 2.7 Tool output schemas and structured content

Capability:

> Servers that support tools **MUST** declare the `tools` capability.

> Servers that declare the `tools` capability **MUST** respond to `tools/list` requests with the set of tools currently available to the requesting client. This set **MAY** be empty and **MAY** change over time … but **MUST NOT** vary per-connection or as a side effect of other requests on the connection. The set **MAY** vary by the authorization presented on the request.

> Servers **SHOULD** return tools in a deterministic order …

`inputSchema`:

> **MUST** be a valid JSON Schema object (not `null`)

`outputSchema` / structured content:

> If an output schema is provided:
> * Servers **MUST** provide structured results that conform to this schema.
> * Clients **SHOULD** validate structured results against this schema.

> For backwards compatibility, a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block.

JSON Schema dialect (base protocol):

> Clients and servers **MUST** support JSON Schema 2020-12 for schemas without an explicit `$schema` field.

> Clients and servers **MUST** validate schemas according to their declared or default dialect. They **MUST** handle unsupported dialects gracefully by returning an appropriate error indicating the dialect is not supported.

> Implementations **MUST NOT** automatically dereference `$ref` values that resolve to a network URI.

> Implementations **MAY** offer an opt-in mode that fetches non-local `$ref`s but it **MUST** be disabled by default and **SHOULD** enforce an allowlist of hosts …

https://modelcontextprotocol.io/specification/2026-07-28/basic/index and https://modelcontextprotocol.io/specification/2026-07-28/server/tools

Tool-name guidance remains SHOULD (SEP-986 carried forward): length 1–128, case-sensitive, `[A-Za-z0-9_.-]`. https://modelcontextprotocol.io/specification/2026-07-28/server/tools

Annotations:

> For trust & safety and security, clients **MUST** consider tool annotations to be untrusted unless they come from trusted servers.

https://modelcontextprotocol.io/specification/2026-07-28/server/tools

### 2.8 Authorization

Authorization is OPTIONAL at the protocol layer. When used:

> Authorization is **OPTIONAL** for MCP implementations. When supported:
> * Implementations using an HTTP-based transport **SHOULD** conform to this specification.
> * Implementations using an STDIO transport **SHOULD NOT** follow this specification, and instead retrieve credentials from the environment.
> * Implementations using alternative transports **MUST** follow established security best practices for their protocol.

> Authorization servers **MUST** implement OAuth 2.1 with appropriate security measures for both confidential and public clients.

> Authorization servers and MCP clients **SHOULD** support OAuth Client ID Metadata Documents.

> Authorization servers and MCP clients **MAY** support [RFC7591 DCR]. Note that Dynamic Client Registration is deprecated …

> MCP servers **MUST** implement OAuth 2.0 Protected Resource Metadata (RFC 9728). MCP clients **MUST** use [it] for authorization server discovery.

> MCP authorization servers **MUST** provide at least one of [RFC 8414 AS metadata, OpenID Connect Discovery 1.0]. MCP clients **MUST** support both discovery mechanisms.

> Before initiating the authorization flow, MCP clients **MUST** obtain a client ID through one of three registration mechanisms …

Resource indicators:

> MCP clients **MUST** implement Resource Indicators for OAuth 2.0 as defined in RFC 8707 …
> 1. **MUST** be included in both authorization requests and token requests.
> 2. **MUST** identify the MCP server that the client intends to use the token with.
> 3. **MUST** use the canonical URI of the MCP server …

Access tokens:

> MCP client **MUST** use the Authorization request header field … `Authorization: Bearer <access-token>`
> Note that authorization **MUST** be included in every HTTP request from client to server.
> Access tokens **MUST NOT** be included in the URI query string.

> MCP servers **MUST** validate access tokens as described in OAuth 2.1 Section 5.2.
> MCP servers **MUST** validate that access tokens were issued specifically for them as the intended audience, according to RFC 8707 Section 2.
> Invalid or expired tokens **MUST** receive a HTTP 401 response.

> MCP clients **MUST NOT** send tokens to the MCP server other than ones issued by the MCP server's authorization server.
> MCP servers **MUST** only accept tokens that are valid for use with their own resources.
> MCP servers **MUST NOT** accept or transit any other tokens.

RFC 9207 issuer:

> MCP authorization servers **SHOULD** include the `iss` parameter in authorization responses, including error responses …
> On receiving the authorization response, MCP clients **MUST** apply the validation in RFC9207 Section 2.4 before transmitting the authorization code to any token endpoint.

Scope challenges:

> When a client makes a request with an access token with insufficient scope … the server **SHOULD** respond with HTTP 403 Forbidden … `error="insufficient_scope"` …
> Servers **MUST** account for scope hierarchies … when deciding whether a token is sufficient for an operation.

https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization

### 2.9 Removed or deprecated

Removed from the *core protocol* in this revision (changelog; these are gone, not merely deprecated):

- `initialize` / `notifications/initialized`
- `Mcp-Session-Id` and protocol-level sessions
- HTTP GET standalone SSE endpoint; `resources/subscribe` / `resources/unsubscribe`
- `ping`, `logging/setLevel`, `notifications/roots/list_changed`
- SSE `Last-Event-ID` resumability
- Core-protocol experimental tasks (`tasks/result`, `tasks/list`); moved to extension
- Server-initiated JSON-RPC requests (replaced by MRTR)
- `notifications/elicitation/complete` and URL-mode `elicitationId`

Deprecated but still in the spec (new implementations **SHOULD NOT** adopt; existing **SHOULD** migrate):

Quoted from https://modelcontextprotocol.io/specification/2026-07-28/deprecated :

> A Deprecated feature remains part of the specification but is scheduled for removal: new implementations **SHOULD NOT** adopt it, and existing implementations **SHOULD** migrate before the feature's earliest removal.

HTTP+SSE specifically:

> New implementations **SHOULD NOT** adopt it; existing implementations **SHOULD** migrate to Streamable HTTP.

https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http

---

## 3. Requirements a server application must satisfy that a protocol library typically leaves to the application

These are specification MUST/SHOULD items whose enforcement is not "JSON-RPC framing" and typically cannot be fully owned by a protocol SDK. A library may *expose hooks*; the application still has to supply the policy.

### 3.1 Origin validation (HTTP)

> Servers **MUST** validate the `Origin` header on all incoming connections to prevent DNS rebinding attacks.
> * If the `Origin` header is present and invalid, servers **MUST** respond with HTTP 403 Forbidden. The HTTP response body **MAY** comprise a JSON-RPC *error response* that has no `id`.
> When running locally, servers **SHOULD** bind only to localhost (127.0.0.1) rather than all network interfaces (0.0.0.0).
> Servers **SHOULD** implement proper authentication for all connections.

https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http

Allowlist of valid Origins, local bind address, and what "invalid" means for a given deployment are application configuration.

### 3.2 Authorization (HTTP) / credentials from the environment (stdio)

The protocol library can parse `Authorization` and emit 401/403 shapes. The application MUST:

- implement RFC 9728 protected-resource metadata (or not offer HTTP auth at all);
- validate audience-bound tokens (RFC 8707);
- never accept or transit tokens issued for someone else;
- for stdio, **SHOULD NOT** follow the HTTP OAuth flow and instead retrieve credentials from the environment.

https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization

`requestState` integrity (HMAC/AEAD, principal binding, TTL, single-use) is explicitly a server-application duty when MRTR is used for authorization-sensitive work. https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr

### 3.3 Rate limiting

> Servers **MUST**:
> * Validate all tool inputs
> * Implement proper access controls
> * Rate limit tool invocations
> * Sanitize tool outputs

https://modelcontextprotocol.io/specification/2026-07-28/server/tools

The spec does not define a rate-limit algorithm, headers, or error code for "too many tool calls". That is application policy. Intermediaries **SHOULD** verify `MCP-Protocol-Version` before trusting mirrored headers for routing/rate-limiting. https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http

### 3.4 Audit / logging

> Clients **SHOULD**:
> * … Log tool usage for audit purposes

https://modelcontextprotocol.io/specification/2026-07-28/server/tools

Protocol-level Logging (`logging/setLevel`, `notifications/message` as a capability) is **deprecated**; migration is "Log to `stderr` for stdio transports; use OpenTelemetry for observability". https://modelcontextprotocol.io/specification/2026-07-28/deprecated

Per-request `io.modelcontextprotocol/logLevel` remains the opt-in for `notifications/message` on a single request (changelog item 5). Application audit of who called which tool with which arguments is not provided by that channel.

### 3.5 Other application-owned duties the spec names

- **JSON Schema `$ref` network fetch**: MUST NOT auto-dereference network URIs; any opt-in MUST be off by default with host allowlist. https://modelcontextprotocol.io/specification/2026-07-28/basic/index
- **Composition-keyword DoS bounds**: implementations SHOULD cap schema depth / subschema count / validation time. Same page.
- **Icon fetching**: MUST reject unsafe URI schemes; fetch without credentials; same-origin SHOULD. Same page.
- **Human in the loop** for tools: applications SHOULD present confirmation UI. https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- **Handle authorization**: "a handle is a name, not a capability. The server should validate the caller's authorization against the handle on every call." Same page (non-normative on the tools page). The security-best-practices page **does** MUST this when authorization is implemented: "MCP servers that implement authorization **MUST** verify all inbound requests. MCP servers **MUST NOT** treat possession of a state handle as authentication." https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices
- **Cache `ttlMs` / `cacheScope`**: the server application chooses freshness and public vs private. Changelog minor 5 / tools list response. SEP-2549: servers MUST provide `ttlMs` on those list/read results; `ttlMs` MUST be `>= 0`. https://modelcontextprotocol.io/seps/2549-TTL-for-list-results
- **Token storage / PKCE / HTTPS**: clients and servers **MUST** implement secure token storage; clients **MUST** implement PKCE and **MUST** use `S256` when technically capable; all authorization-server endpoints **MUST** be served over HTTPS; redirect URIs **MUST** be localhost or HTTPS. https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations
- **Token passthrough forbidden**: "MCP servers **MUST NOT** accept any tokens that were not explicitly issued for the MCP server." https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices
- **Confused-deputy / proxy consent**: MCP proxy servers using static client IDs **MUST** obtain user consent for each dynamically registered client before forwarding to third-party authorization servers. Same security-considerations page; expanded MUST list (per-client consent registry, consent UI, `__Host-` cookies, exact `redirect_uri`, OAuth `state`) on the best-practices page.
- **CIMD fetch / SSRF**: authorization servers fetching client metadata **SHOULD** consider SSRF; **MUST** validate `client_id` matches URL exactly and **MUST** validate redirect URIs against the document. https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration
- **Client registration priority** (clients supporting all options **SHOULD**): (1) pre-registered credentials if available, (2) CIMD if AS advertises `client_id_metadata_document_supported`, (3) DCR if `registration_endpoint` is present, (4) prompt the user. Same page.
- **Issuer-bound credentials**: clients **MUST** key persisted credentials by issuer, **MUST NOT** reuse them with a different AS, **MUST** re-register when the AS changes. Same page / changelog SEP-2352.
- **Local one-click server install**: if an MCP client supports one-click local server configuration, it **MUST** implement proper consent (show the exact command, require explicit approval) before executing. https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices
- **OAuth authorization URL validation** (client): **MUST** only allow `http://`/`https://` (http only for loopback in development); **MUST NOT** open URLs via a shell. Same page.

---

## 4. Spec rules that bear on working assumption G4 ("2026-07-28 only")

G4 says: `McpProtocol.v2026_07_28` only on every in-repo server (no mixed protocol lists).

The specification **permits** a modern-only server. It does not require dual-era. Dual-era is opt-in:

> A server that wishes to support both legacy clients (which expect an `initialize` handshake) and modern clients (which use per-request metadata) **MAY** implement both behaviors.

https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning

### 4.1 What a modern-only server does when a client sends `initialize`

Compatibility matrix, row **Legacy client × Modern server** (this is G4):

> Fails. stdio: the server rejects `initialize` with a JSON-RPC error; the exact code is implementation-defined (`initialize` is an unknown method and the request also lacks the required `_meta` fields). HTTP: the request is missing the required headers and is rejected per server validation with `400 Bad Request` (a client on the deprecated HTTP+SSE transport fails at its opening `GET` instead). Legacy clients have no fall-forward mechanism.

https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning

The spec **SHOULD**s a diagnostic, it does not MUST a particular error body:

> A server that supports only modern versions **SHOULD** name the protocol versions it supports in any error it returns to an `initialize` request, on any transport: legacy clients have no fall-forward mechanism, and this message may be the only diagnostic they can surface to users.

Same page.

**decision-challenge for G4 (stdio):** a G4 server that answers `initialize` with a bare `-32601 Method not found` and no `supported` list is spec-legal (the code is implementation-defined) but against the SHOULD. Dual-era clients that probe with `server/discover` will *not* fall back to `initialize` if they get a *recognized modern* error such as `UnsupportedProtocolVersionError`; they *will* fall back if they get "any other error" or a timeout. So a G4 server that implements `server/discover` (MUST) is unambiguously modern to dual-era clients. A G4 server that is missing `server/discover` would look legacy to a probing dual-era client — but missing `server/discover` would itself violate the 2026-07-28 MUST.

**SEP vs current spec on stdio fallback (do not implement from the SEP body):** SEP-2575's historical Backward Compatibility section said a dual-era stdio client should fall back to `initialize` if `server/discover` returns `Unsupported protocol version` **or** `Method not found`. The current stdio page contradicts that: a recognized modern error including `UnsupportedProtocolVersionError` means **do not** fall back; only "any other error" or a timeout means legacy. The SEP page itself warns that post-Final edits are not in the SEP body. Current spec wins: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio vs https://modelcontextprotocol.io/seps/2575-stateless-mcp.md

**SEP-2575 rejected optional handshake:** the SEP considered keeping `initialize` as an optional parallel path and rejected it because two interaction models would force every implementation to maintain two logic paths. A G4 modern-only server is exactly the design the SEP preferred. Dual-era is an interoperability concession (`MAY`), not the intended steady state. Same SEP page, "Alternative Considered: Optional Handshake".

### 4.2 Do clients probe or fall back?

| Client kind | stdio | HTTP |
| --- | --- | --- |
| Modern-only | Probe not required; probe **RECOMMENDED** so a legacy server does not silently execute `tools/call` under legacy semantics. No fallback to `initialize`. | Attempt a modern POST. On `400`, inspect body. Recognized modern error → retry with advertised version, **do not** fall back. |
| Dual-era | **SHOULD** probe `server/discover` first. `DiscoverResult` or recognized modern error → stay modern. Any other error / timeout → fall back to `initialize`. Fallback **MUST NOT** be keyed to one error code. | **MAY** attempt a modern request first. On `400`, inspect body before falling back. Empty / unrecognized body → `initialize`, and possibly further to HTTP+SSE. |

https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio
https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning

G6 (external agent clients do not gate the flip) is consistent with this matrix **only if** those clients are already modern or dual-era and will treat a modern-only server as "Works" (modern×modern) or "Fails" (legacy×modern). A still-legacy external client **cannot** talk to a G4 server. The spec says that outcome is expected and there is no fall-forward.

**decision-challenge for G4 (HTTP leftover traffic):** a G4 Streamable HTTP server **SHOULD** answer GET/DELETE with `405`, ignore `Mcp-Session-Id`, ignore `Last-Event-ID`. It **MUST** still implement `server/discover`, required headers, Origin checks, and `UnsupportedProtocolVersionError` with a `supported` list that, under G4, contains only `"2026-07-28"`.

**decision-challenge for G4 vs dual-era *in-repo clients*:** G6 puts in-repo launchers/harnesses/`RpcClient` in scope. Those clients, if they remain dual-era, **SHOULD** probe on stdio and **MAY** probe on HTTP. They will not fall back if `server/discover` succeeds. If they are flipped to modern-only as well, they **SHOULD NOT** implement `initialize` fallback; probing is only a deterministic-failure aid against *other people's* legacy servers.

### 4.3 `supportedVersions` advertising

`server/discover` response `supportedVersions` is the server's advertised set. A G4 server advertises `["2026-07-28"]` only. A client that then sends `_meta.protocolVersion: "2025-11-25"` **MUST** get `UnsupportedProtocolVersionError` with `data.supported: ["2026-07-28"]`. That is implementable; it is not a spec contradiction of G4.

Example in the versioning page uses `"supported": ["2026-07-28", "2025-11-25"]` as an *illustration of a dual-era server*, not a requirement that every server list both.

### 4.4 Mixed-protocol lists inside one process

The spec allows a dual-era server to "serve both eras concurrently on the same endpoint or process" (MAY). It does not require it. G4's "no mixed protocol lists" is therefore a product choice the spec permits, not a spec requirement. The cost is the Legacy×Modern failure row, not an unimplementable protocol state.

---

## 5. UNVERIFIED items

- Schema TypeScript source of truth (`https://github.com/modelcontextprotocol/specification/blob/main/schema/2026-07-28/schema.ts`) was not opened; error-code numbers and field names are taken from the HTML spec pages. The schema is declared as the source of truth on https://modelcontextprotocol.io/specification/2026-07-28/basic/index
- SEP-2243 page body was not fetched (`https://modelcontextprotocol.io/seps/2243-http-standardization.md`). Header MUST/SHOULD rules above are from the current Streamable HTTP spec page.
- SEP-2596 is the adopted feature-lifecycle policy (https://modelcontextprotocol.io/community/feature-lifecycle). Whether that SEP itself is labeled Final on GitHub is UNVERIFIED; the policy page is live and the deprecated registry still dates HTTP+SSE earliest removal as "three months after SEP-2596 reaches Final". The twelve-month floor and ninety-day security expedite are quoted from that policy page.
- GitHub compare diffs (`specification/compare/2025-03-26...2025-06-18` etc.) were not walked commit-by-commit; the official changelog pages are treated as the complete advertised delta.
- Effect-TS `McpProtocol.v2026_07_28` runtime behavior when a client sends `initialize` is owned by lane 11-u2; this lane does not claim it.
- Official `llms.txt` documentation index was not successfully fetched (one DNS failure). The page set used here is the three changelogs plus the topic pages named in the lane brief, not a proof of completeness against the full spec tree.
- Authorization-server-discovery subpage (`/specification/2026-07-28/basic/authorization/authorization-server-discovery`) was not fetched in full; the overview page's MUST list (RFC 9728, RFC 8414 and/or OIDC Discovery, both client discovery mechanisms) is cited instead.

---

## Appendix — key page URLs used

- https://modelcontextprotocol.io/specification/2025-06-18/changelog
- https://modelcontextprotocol.io/specification/2025-11-25/changelog
- https://modelcontextprotocol.io/specification/2026-07-28/changelog
- https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning
- https://modelcontextprotocol.io/specification/2026-07-28/basic/index
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
- https://modelcontextprotocol.io/specification/2026-07-28/server/discover
- https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr
- https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions
- https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- https://modelcontextprotocol.io/specification/2026-07-28/deprecated
- https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning
- https://blog.modelcontextprotocol.io/posts/2026-07-28/
- https://modelcontextprotocol.io/seps/2575-stateless-mcp.md
- https://modelcontextprotocol.io/seps/2567-sessionless-mcp.md
- https://modelcontextprotocol.io/seps/2549-TTL-for-list-results
- https://modelcontextprotocol.io/seps/2663-tasks-extension
- https://modelcontextprotocol.io/seps/2164-resource-not-found-error
- https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/logging
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration
- https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
- https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle

## Gate B verdicts (2026-09-17)

Three grok refuters voted on 34 claims from this lane (33 survive, 1 killed; per-vote detail in `verification/13-s1-spec-delta.verdicts.jsonl`).

Struck claims (2 of 3 refuted):

- ~~`13-s1-spec-delta-29` (semantic): Servers MUST validate the Origin header on all incoming connections to prevent DNS rebinding. If Origin is present and invalid, servers MUST respond HTTP 403 (body MAY be a JSON-RPC error with no id). When running locally, servers SHOULD bind only to localhost rather than 0.0.0.0. Servers SHOULD implement proper authentication for all connections. Allowlist, bind address, and what counts as invalid Origin are application configuration.~~
  - Refuters: Origin MUST-validate, present-and-invalid MUST 403 (body MAY JSON-RPC error with no id), local SHOULD bind localhost not 0.0.0.0, and SHOULD authenticate all match. The closing assertion that allowlist, bind address, and what counts as invalid Origin are application configuration is not in the cited spec; bind address is a specific SHOULD, and allowlist is never mentioned.
