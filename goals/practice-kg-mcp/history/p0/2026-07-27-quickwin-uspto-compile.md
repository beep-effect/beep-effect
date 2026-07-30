# P0 evidence — uspto-mcp Windows cross-compile + compiled-binary MCP smoke

Date: 2026-07-27 · Phase: P0 Packet + spike · Scope: quick-win Path A + partial
R1 signal (pure-JS component)

## What ran

```sh
bun build --compile --target=bun-windows-x64 \
  packages/drivers/uspto-mcp/src/bin.ts --outfile <scratch>/dist/uspto-mcp.exe
# → bundle 683 modules; compile OK; bun-windows-x64-v1.3.14; 95 MB

bun build --compile --target=bun-linux-x64 \
  packages/drivers/uspto-mcp/src/bin.ts --outfile <scratch>/dist/uspto-mcp-linux
# → compile OK; smoke-tested:
```

JSON-RPC over stdio against the compiled linux binary (stdin held open, as a
real MCP client does):

- `initialize` → `{"serverInfo":{"name":"beep-uspto",...},"protocolVersion":"2025-06-18"}` ✓
- `tools/list` → both tools with `readOnlyHint: true`, schema-first input
  schemas, FieldTier budget description intact ✓

## Findings

1. A pure-JS effect-based MCP host cross-compiles to a single Windows x64 .exe
   with zero flags and answers the protocol correctly when compiled — the
   effect `unstable/ai` MCP stdio layer survives `bun build --compile`.
2. Harness gotcha (recorded so nobody re-burns time): piping messages and
   closing stdin immediately yields silence — the server needs the pipe held
   open. Claude Desktop does this naturally; test harnesses must `sleep`
   between writes.
3. Binary size ~95 MB (embedded bun runtime). No .mcpb size cap documented;
   acceptable.

## Verdict

- Quick-win Path A (ship `uspto-mcp.exe` to Tom's machine today) — **GO**.
- R1 remaining risk narrows to exactly two components: PGlite WASM assets and
  the DuckDB native `.node` addon under `--compile` (Codex spike in flight;
  NOTES land alongside this file when done).
