# M365 MCP Server Spec

## Objective

Deliver `@beep/m365-mcp` (at `packages/drivers/m365-mcp`): an Effect-native MCP
server that exposes the `@beep/m365` driver's read verbs as MCP tools via
`effect/ai`. Tools are defined with `Tool.make` (schema-first
input/output), handlers implement `Tool.HandlersFor<…>` and delegate to the
`@beep/m365` service, mounted with `McpServer.toolkit` into a `makeServerLayer`
over `McpServer.layerStdio`, with a `bin` entrypoint. `failureMode: "return"`
surfaces typed `AiToolError`; spans annotate counts/sizes, never raw content.

## Non-Goals

- No Graph logic of its own — all M365 calls delegate to `@beep/m365`.
- No write tools (read-only in v1, matching the driver's scopes).
- No HTTP/SSE transport in v1 (stdio only).
- No Teams/Excel-content or Search tools.
- No document-portal ingest wiring.

## Source Hierarchy

1. User objective: implement the graduated `microsoft-365-integration` plan (MCP
   goal).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `explorations/microsoft-365-integration/{DECISIONS.md,BRIEF.md,MAP.md,RESEARCH.md}`
   and `goals/m365-driver/SPEC.md` (the driver contract this server exposes).
4. Governing architecture/package standards (`standards/ARCHITECTURE.md`) and
   schema-first doctrine.
5. This `SPEC.md`.
6. `PLAN.md`.
7. `GOAL.md`.
8. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/m365-mcp/**` (new package `@beep/m365-mcp`).
- Depends on `@beep/m365` (workspace), `effect/ai`, `@effect/platform-node`.

## Constraints

- Mirror `@beep/nlp-mcp` (`Server.ts` `makeServerLayer` + `McpServer.toolkit` +
  `McpServer.layerStdio`; `bin.ts` `Layer.launch(...).pipe(NodeRuntime.runMain)`).
- Tools are schema-first (`Tool.make` with `effect/Schema` I/O, `$I` annotations).
- `failureMode: "return"` → `AiToolError`; never throw raw driver errors across
  the MCP boundary.
- Spans annotate counts/sizes/paths, never raw document or message content;
  no token logging.
- Read-only tool surface in v1; do not expose write verbs even if the driver
  later adds them.
- Server runs in-process over stdio (the desktop sidecar host); no HTTP transport.

## Acceptance Criteria

- [ ] `@beep/m365-mcp` exists at `packages/drivers/m365-mcp`, builds, and
      lints/type-checks green.
- [ ] A `makeServerLayer` mounts an M365 read toolkit (Files/Sites + Mail/Calendar
      verbs) over `McpServer.layerStdio`; a `bin` launches it.
- [ ] Each tool delegates to `@beep/m365` and decodes via the driver's schemas;
      `failureMode: "return"` yields `AiToolError` on failure.
- [ ] A smoke run enumerates the toolkit over stdio (tools list + one tool call
      against a fixture/mock driver layer).
- [ ] Spans annotate counts/sizes only; no raw content or tokens logged.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Package types/lint | repo `check`/`lint` filtered to `@beep/m365-mcp` | Passes |
| Toolkit smoke | enumerate tools + one call over stdio against a mock `@beep/m365` layer | Passes |
| Packet launcher size | `test "$(wc -m < goals/m365-mcp/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/m365-mcp/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/m365-mcp` | Passes |

## Stop Conditions

- `m365-driver` (`@beep/m365`) is not yet available — this packet depends on it.
- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (write tools, HTTP transport, etc.).
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
