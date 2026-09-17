# Lane 10-u1-api-delta — Effect MCP public API delta

**Owns:** the public-API before/after for the MCP surface. Runtime behavior belongs to
11-u2; kit consequences to 20-r1; documentation to 12-u3.

**Question:** What changed in Effect's public MCP API between `effect@4.0.0-rc.115` and
`a7a71921de`, and which changes break a consumer like beep-effect at compile time or at runtime?

**Start with:**
`git -C ${EFFECT_REF} log --oneline effect@4.0.0-rc.115..a7a71921de -- effect:packages/effect/src/unstable/ai effect:packages/effect/src/unstable/rpc`
and `git diff` of the modules below over the same range.

**Report sections:**
1. Method: commands run; commits in range touching the modules below.
2. Export inventory diff for `unstable/ai/McpServer.ts`, `McpSchema.ts`, `McpProtocol.ts`,
   `Tool.ts`, `Toolkit.ts`, plus only the `unstable/rpc/RpcServer.ts` and `RpcSerialization.ts`
   exports that MCP code calls (for example `layerProtocolStdio`, the JSON-RPC and NDJSON codecs).
   For each export added, removed, or changed: before (rc.115 `path:line`) and after
   (`a7a71921de` `path:line`).
3. Breaking-change table: symbol | before | after | consumer impact | evidence. Cover at least:
   handler requirements (`McpServerClient` vs `McpSchema.McpRequestContext`) on
   `McpServer.toolkit`/`registerToolkit`/`resource`/`registerResource`/`prompt`/`registerPrompt`;
   `layerStdio`/`layerHttp`/`layer`/`run` options (`protocols`, `instructions`, `description`,
   `websiteUrl`, `icons`, `extensions`, `allowedOrigins`, anything else new); `McpServerClient`
   shape and when it is provided; `Toolkit.handle` signature and `SchemaAST.ParseOptions`;
   `Toolkit.FailureOrigin`/`Tool.FailureOrigin`; declared-failure projection.
4. `Tool.Strict` dual use: separate its provider structured-output meaning from MCP's reuse of
   `Tool.getStrictMode` for excess-property rejection (`effect:.../McpServer.ts` call sites).
5. Type-level evidence: `effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts`, `Tool.tst.ts`.
6. Cross-check: do `.changeset/*.md` and `migration/annotations/effect__ai__McpServer.yaml`,
   `effect__ai__McpSchema.yaml` match the code? List every mismatch.
