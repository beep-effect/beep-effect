# M365 MCP Server

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship `@beep/m365-mcp`: expose the `@beep/m365` driver's read verbs as MCP tools
via `effect/unstable/ai` (the `@beep/nlp-mcp` pattern), so beep's agents reach
Microsoft 365 over a stdio MCP server while the app keeps typed errors,
telemetry, and least-privilege scopes.

Graduated from
[`explorations/microsoft-365-integration`](../../explorations/microsoft-365-integration/README.md).
Depends on [`m365-driver`](../m365-driver/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/m365-mcp/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`../m365-driver`](../m365-driver/README.md) - the driver this server exposes (dependency).
6. [`../../explorations/microsoft-365-integration`](../../explorations/microsoft-365-integration/README.md) - graduated source exploration.

## Current Phase

P3 Close - completed. `@beep/m365-mcp` now exposes the `@beep/m365` read
surface as schema-first MCP tools over stdio, with mock-backed toolkit and
stdio smoke coverage.

## Latest Evidence

- 2026-06-18: `TURBO_FORCE=1 bunx turbo run build check lint test --filter=@beep/m365-mcp`
  passed with 34/34 Turbo tasks successful and `test/Server.test.ts` 3/3 tests
  passing, including staged stdio JSON-RPC initialize, tools/list, and
  `m365_list_drives` call coverage.
- 2026-06-18: `bun install` refreshed `bun.lock` so the new workspace package is
  present in the tracked lockfile.
- 2026-06-18: Added
  [`history/reflections/2026-06-18-codex.md`](./history/reflections/2026-06-18-codex.md)
  for P3 closeout.

## Notes

- Mirror `@beep/nlp-mcp` exactly: `Tool.make` toolkits + `McpServer.toolkit` +
  `makeServerLayer` over `McpServer.layerStdio`, `bin.ts` launcher,
  `failureMode: "return"` → `AiToolError`.
- This package owns no Graph logic; it delegates to `@beep/m365`. Read-only tools
  in v1; spans annotate counts/sizes, never raw content.
- 2026-10-06 (post-closeout, additive): the server contract gained the
  handshake-era MCP protocol versions `2025-11-25`, `2025-06-18`, `2025-03-26`
  and `2024-11-05` after `2026-07-28`, because Claude clients open every server
  with `initialize` and a host that lists only `2026-07-28` refuses it. Tools,
  instructions and handlers are unchanged. Decision:
  `goals/m365-agent-outbox/SPEC.md` D-12.
