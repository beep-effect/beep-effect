# GOAL: Ship @beep/uspto-mcp (thin USPTO MCP proving host)

Repo root: `.` (repo-relative paths throughout this packet).

Outcome: `packages/drivers/uspto-mcp` exists, builds green through repo gates,
and wires `@beep/uspto` through `@beep/mcp-kit`'s exported
`SourceAuth`/`ToolkitComposition`/`ApiKeyRequired`/`FieldTier` surfaces, proven
by fixture tests (no real `USPTO_API_KEY` required).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/uspto-mcp/README.md`
- `goals/uspto-mcp/SPEC.md`
- `goals/uspto-mcp/PLAN.md`
- `goals/uspto-mcp/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md` (`standards/architecture/{02,03,07,09,12}`). Also read
`goals/mcp-kit/SPEC.md` (the kit contract this host consumes) and the sibling
`goals/mcp-host-retrofit/SPEC.md` (jointly discharges the kit's ≥2-consumer
gate). Higher-priority repo standards outrank packet prose when they conflict.

Scope:

- In: new package `packages/drivers/uspto-mcp` (+ minimal root
  workspace/tsconfig/turbo wiring via `bun run beep create-package`).
- Out: no changes to `packages/drivers/uspto`,
  `packages/foundation/capability/mcp-kit`, `packages/drivers/nlp-mcp`, or
  `packages/drivers/m365-mcp`. No write operations. No gov-legal driver depth
  work. No live network integration tests.

Key design facts (verified 2026-07-01 for the kit; re-verify this host's
usage at P0):

- `@beep/uspto`'s layer always constructs; the API key attaches only when
  present and same-origin (`Uspto.service.ts:249-255,398`) — this is the
  kit's `soft`-gate shape (call-time degradation, not composition-time
  vanish).
- Server bootstrap mirrors `packages/drivers/nlp-mcp/src/Server.ts:101-107`
  (`Layer.mergeAll` over toolkit layers under one `McpServer.layerStdio`).
- Fixture-based `HttpClient` mocking is the required test shape (precedent:
  `packages/drivers/uspto/test/Uspto.service.test.ts`,
  `packages/drivers/nlp-mcp/test/Server.test.ts`) — never a live network call.
- `documentBag`/`patentFileWrapperDataBag` (`Uspto.service.ts:116`) are the
  large-payload shapes the kit's `FieldTier` projector must reshape under
  budget.

Workflow:

1. Inspect referenced files and current repo state, including
   `goals/mcp-kit`'s shipped package to confirm its exported surface matches
   `SPEC.md`'s deliverable contracts.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (three fixture tests +
      kit-only composition + consumer-plan README).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/uspto-mcp/GOAL.md)" -le 4000
jq . goals/uspto-mcp/ops/manifest.json
git diff --check -- goals/uspto-mcp
bun run beep yeet verify
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Stop if
`@beep/mcp-kit`'s shipped surface has drifted from the deliverable contracts
this host depends on — do not patch the kit from inside this goal.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
