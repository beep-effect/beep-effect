# Lane 21-r2-hosts — In-repo MCP hosts, launchers, clients, and harnesses

**Owns:** every in-repo MCP server host and every in-repo MCP client, launcher, harness, and
config: what each sends and expects today, and what a 2026-07-28-only server would change for it.

**Hosts:** `repo:packages/drivers/nlp-mcp` (both `NlpToolkit` and the 17-tool `StreamingToolkit`
in `StreamingTools.ts`/`StreamingHandlers.ts`), `repo:packages/drivers/m365-mcp`,
`repo:packages/drivers/uspto-mcp`, `repo:packages/drivers/gov-legal-mcp`,
`repo:packages/law-practice/server` with `repo:apps/practice-kg-mcp`,
`repo:apps/professional-desktop/server/OntologyMcpTransport.ts` with
`repo:packages/ontology/config` (`McpConfig`, mutation-enable config).

**Clients, launchers, harnesses, configs:** `repo:.mcp.json` (the `nlp` stdio entry; other entries
are third-party servers and only need a one-line note),
`repo:apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts`,
`repo:apps/professional-desktop/test/integration/ontology-mcp-http.test.ts`,
`repo:apps/professional-desktop/test/integration/execution-authority.pglite.test.ts`,
`repo:goals/ontology-agent-surface/ops/live-mcp-client.ts`, host `test/**` wire tests,
`repo:packages/tooling/library/ai-sync` (`ClaudeMcpJson`, `.mcp.json` validation, Codex/Claude MCP
map transforms), `repo:plugins/*/.mcp.json`, and `repo:.ai/mcp/mcp.json`.

**Report sections:**
1. Host inventory table, one row per host: transport; protocol pin (`path:line`); server
   name/version; toolkits and tool count; tools whose success schema is not an object;
   `failureMode` usage; prompts/resources; reverse-client use; auth; CORS allow/expose headers; bin
   entrypoint; tests that exercise the MCP wire; JSDoc/docgen files that name the protocol.
2. Client and harness inventory: for each item above, the exact first messages and headers it
   sends today (`initialize` body and `protocolVersion`, `Mcp-Session-Id`, `MCP-Protocol-Version`,
   `Mcp-Method`, `Mcp-Name`), what it assumes about sessions, and what would fail against a
   2026-07-28-only server (cite 11-u2's area of Effect source only as needed).
3. Config schemas: whether `ai-sync` / `.mcp.json` / plugin configs model anything
   protocol-version-specific.
4. Per-host migration notes and cross-host patterns worth centralizing in the kit.
