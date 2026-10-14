# GOAL: ship the `@beep/m365-mcp` MCP server

Repo: `.` (beep-effect).

Outcome: an Effect-native MCP server at `packages/drivers/m365-mcp` that exposes
the `@beep/m365` driver's read verbs (OneDrive/SharePoint files + Outlook
mail/calendar) as schema-first MCP tools over stdio, so agents reach Microsoft
365 while the app keeps typed errors, telemetry, and least-privilege scopes.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/m365-mcp/README.md`
- `goals/m365-mcp/SPEC.md`
- `goals/m365-mcp/PLAN.md`
- `goals/m365-mcp/ops/manifest.json`

Read those first, plus `goals/m365-driver/SPEC.md` (the driver this server
exposes) and the graduated exploration
`explorations/microsoft-365-integration/{BRIEF.md,DECISIONS.md,MAP.md}`, then
`AGENTS.md`, `CLAUDE.md`, and the standards `SPEC.md` names. Higher-priority repo
standards outrank packet prose when they conflict.

Dependency: requires `@beep/m365` (`goals/m365-driver`). If the driver is not yet
built, stub against its service interface + a mock Layer and report the blocker.

Scope:

- In: `packages/drivers/m365-mcp/**` (depends on `@beep/m365`,
  `effect/ai`, `@effect/platform-node`).
- Out: any Graph logic of its own (delegate to `@beep/m365`); write tools;
  HTTP/SSE transport; Teams/Excel/Search tools; ingest wiring.

Reuse (do not reinvent): `@beep/nlp-mcp` — `Server.ts` (`makeServerLayer` +
`McpServer.toolkit` + `McpServer.layerStdio`), `bin.ts`
(`Layer.launch(...).pipe(NodeRuntime.runMain)`), `Tool.make` toolkits +
`Tool.HandlersFor`, `failureMode: "return"` → `AiToolError`.

Workflow:

1. Scaffold `@beep/m365-mcp` (`bun run create-package`), depending on `@beep/m365`.
2. Define a read toolkit with `Tool.make` (schema-first I/O, `$I` annotations):
   list drives/sites, delta, download content, read `listItem.fields`+`/versions`,
   list/get mail, list/get events.
3. Implement handlers (`Tool.HandlersFor<…>`) that delegate to the `@beep/m365`
   service; `failureMode: "return"` → `AiToolError`.
4. Assemble `makeServerLayer` mounting the toolkit over `McpServer.layerStdio`;
   add `bin.ts`. Spans annotate counts/sizes, never content; no token logging.
5. Smoke: enumerate tools + one call over stdio against a mock `@beep/m365` layer.
6. At P3 Close, write `history/reflections/<date>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification passes, or unrelated failures are reproduced and
      recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/m365-mcp/GOAL.md)" -le 4000
jq . goals/m365-mcp/ops/manifest.json
git diff --check -- goals/m365-mcp
bun run beep lint reflection-artifacts
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive state
beyond the In-scope list unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
