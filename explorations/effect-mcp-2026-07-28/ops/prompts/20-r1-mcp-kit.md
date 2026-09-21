# Lane 20-r1-mcp-kit — @beep/mcp-kit under the new Effect MCP API

**Owns:** kit call sites, kit overlap with new upstream behavior, and the kit's test and
documentation surface. `McpRequestContext` field semantics belong to 11-u2; governance invariants
to 22-r3.

**Question:** Module by module, what in `@beep/mcp-kit` breaks, becomes redundant, or gains a native
upstream replacement when beep-effect moves to the snapshot and to `McpProtocol.v2026_07_28`?

**Primary sources:** `repo:packages/foundation/capability/mcp-kit/**` (src, test, `README.md`,
`AGENTS.md`, `docgen.json`, `package.json`); host tests that stub the MCP client:
`repo:packages/drivers/nlp-mcp/test/SanitizedSpan.test.ts`,
`repo:packages/drivers/m365-mcp/test/SanitizedSpan.test.ts`;
`repo:standards/jsdoc-documentation.inventory.jsonc` entries for `@beep/mcp-kit`; the Effect
source at `a7a71921de` for every API the kit touches
(`effect:packages/effect/src/unstable/ai/{McpServer,McpSchema,Tool,Toolkit}.ts`).

**Report sections:**
1. Kit anatomy: each module (`SanitizedSpan`, `McpCaller`, `TierGate`, `ApiKeyRequired`,
   `FieldTier`, `ToolkitComposition`, `ToolAnnotations`, `SourceAuth`, `Version`, `index`): purpose,
   exports, and the Effect MCP APIs it depends on.
2. Break table: module | construct | why it breaks at the snapshot or under a 2026-07-28-only
   server | evidence. Include the `McpServerClient` requirement exclusions, the `mcp-session-id`
   header read, `Effect.serviceOption(McpServerClient)`, the no-arg parameter wildcard handling,
   and every `McpServerClient.of` / `makeStubMcpClient` fixture (kit and host tests).
3. Redundancy table: kit behavior now provided upstream (server `instructions`, strict input
   validation, `isError` projection, failure reporting, output schemas, Origin checks), with the
   exact overlap and the remaining kit-only value.
4. Documentation surface: JSDoc examples and named in-source vitest examples (for example the one
   in `SanitizedSpan.ts`), `docgen.json`, `AGENTS.md`, README version and protocol pins, and the
   jsdoc inventory rows a rewrite would touch.
5. Test and ratchet surface: tests asserting session-era behavior; coverage obligations.
