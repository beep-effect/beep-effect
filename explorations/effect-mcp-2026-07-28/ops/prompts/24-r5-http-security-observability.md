# Lane 24-r5-http-security-observability — Stateless HTTP security and MCP observability

**Owns:** (a) the security posture of beep-effect's HTTP MCP sidecar under a 2026-07-28-only
server, and (b) the tracing, logging, and metric surface of in-repo MCP servers before and after.
Effect runtime facts belong to 11-u2; cite them briefly.

**Primary sources:** `repo:apps/professional-desktop/server/OntologyMcpTransport.ts` (Origin
middleware, CORS allow/expose lists, bearer security middleware, span and metric names),
`repo:apps/professional-desktop/server/**` wiring around it, `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts`,
`repo:standards/architecture/12-observability.md`, `repo:standards/architecture/06-configuration-boundaries.md`;
Effect `effect:packages/effect/src/unstable/ai/McpServer.ts` (`layerHttp`, `allowedOrigins`,
`spanPrefix` values), `internal/mcpRuntime.ts` (HTTP header admission),
`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/TransportsTest.ts` (security suite).

**Report sections:**
1. Header contract table: every header a 2026-07-28 HTTP request and response uses in Effect
   (`MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`, `Mcp-Session-Id`, content types) vs the
   sidecar's CORS `allowedHeaders`/`exposedHeaders`, with what breaks in a browser-origin client.
2. Method and Origin behavior: GET/PUT/PATCH/DELETE/OPTIONS responses, default-deny Origin, and the
   sidecar's own Origin middleware running alongside Effect's check (duplicate or complementary?).
3. Authentication and abuse surface without sessions: bearer middleware placement, replay,
   rate limiting, bind address, request size limits; what Effect provides vs what the app must.
4. Observability inventory: span names and prefixes (`McpServer`, `McpServer/Notifications`, kit
   sanitized spans, `ontology.mcp.origin`), attributes that carried session or client identity,
   metrics (for example `desktop_ontology_mcp_origin_decisions_total`), and log fields; how each
   maps to `12-observability.md`; what loses meaning when there is no session.
5. Options and grill questions (no decision): keep or remove the sidecar Origin middleware; CORS
   header set; per-request correlation key for traces and audit without sessions.
