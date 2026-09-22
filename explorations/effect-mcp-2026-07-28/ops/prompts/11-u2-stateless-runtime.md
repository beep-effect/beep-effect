# Lane 11-u2-stateless-runtime — 2026-07-28 runtime semantics in Effect

**Owns:** runtime behavior of Effect's MCP server at `a7a71921de`: protocol selection, transports
and framing, `McpRequestContext` field population and `clientId` stability, MRTR, subscriptions,
tool output and failure projection, and the method/capability coverage matrix. Other lanes cite
this lane's claims instead of re-deriving them.

**Question:** Exactly how does an Effect MCP server configured with `McpProtocol.v2026_07_28`
behave over stdio and Streamable HTTP, and what happens to traffic it does not accept?

**Primary sources:** `effect:packages/effect/src/unstable/ai/McpServer.ts`,
`internal/{mcpRuntime,mcpStatefulRuntime,mcpProtocol,mcpProtocolRegistry,mcpCore}.ts`,
`internal/mcpProtocol/v2026_07_28.ts`, `internal/mcpSchema/v2026_07_28.ts`,
`unstable/rpc/RpcServer.ts`; tests under `effect:packages/effect/test/unstable/ai/`: `McpSchema.test.ts`,
`McpServer/McpProtocol.test.ts`, `McpServer/v2026_07_28.test.ts`, `McpServer/McpServer.test.ts`,
`McpServer/ProtocolAdapters.test.ts`, `McpServer/McpConformance/TransportsTest.ts` (including the
stateless and security suites), and the harnesses `McpServer/TestUtils/{McpStdioHarness,McpHttpHarness,McpHttpResponse,McpServerLayer}.ts`.

**Report sections:**
1. Protocol selection: how a request is matched to an adapter over HTTP (headers such as
   `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`; `_meta`) and over stdio; mixed-list rules (at
   most one stateless adapter); and exactly what a `v2026_07_28`-only server answers when a client
   sends `initialize` (error code and message), with evidence.
2. `server/discover`: request/response shape and what it advertises (capabilities including
   `completions` and `logging`, `instructions`, `description`, `websiteUrl`, `icons`,
   `extensions`).
3. Stdio framing: `mcpStdioSerialization`, newline-delimited JSON-RPC vs Content-Length, batch
   policy per adapter (`acceptsBatches`), chunked UTF-8 reconstruction, stdin close/shutdown.
4. Streamable HTTP without sessions: single-endpoint POST, per-request response streaming,
   notification delivery through `sendNotification`, what GET/PUT/PATCH/DELETE/OPTIONS return,
   Origin checks and `allowedOrigins` defaults, and any `Mcp-Session-Id` handling.
5. `McpSchema.McpRequestContext`: each field, where it is populated (`mcpRuntime.ts`
   `prepareRequest`), lifetime, whether `clientId` is stable across requests from one client on
   stdio and on HTTP, and whether ANY field is server-minted and stable across HTTP requests.
6. Multi-round-trip tool results: `McpSchema.InputRequired`, how a handler returns it, how the
   follow-up carries `inputResponses`/`requestState`, what state (if any) the server holds between
   rounds, and which input kinds exist.
7. `subscriptions/listen`: what can be subscribed, notification kinds, filtering, and behavior
   when the transport has no `sendNotification` (method-not-found).
8. Tool outputs and failures: output schemas and `structuredContent` for non-object JSON values;
   strict excess-property rejection; invalid arguments; declared failures in `failureMode` error vs
   return; defects and encoding errors; diagnostics.
9. Coverage matrix with no presumed answers: every method and capability in the
   2026-07-28 adapter (tools, prompts, resources, resource templates, completion, logging,
   subscriptions, cancellation, progress, ping, elicitation/sampling/roots via MRTR) → handler
   present / advertised-but-empty / absent, citing `v2026_07_28.ts` and `mcpRuntime.ts`.
10. Test map: the test names that pin sections 1–8.
