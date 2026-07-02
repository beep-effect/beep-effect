# USPTO MCP Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Confirm `@beep/mcp-kit`'s shipped surface (`SourceAuth`, `ToolkitComposition`, `ApiKeyRequired`, `FieldTier`) matches this host's expected call shape; run the `create-package` wiring checklist. | Kit surface confirmed compatible; scaffolded via `bun run beep create-package uspto-mcp --family drivers`. One correction to `SPEC.md`: `drivers` is a flat, individually-listed workspace family (not globbed like `foundation/capability`), so `create-package` DID edit root `package.json`'s `workspaces` array — not a SKIP as originally assumed. |
| P1 Implement | complete | Scaffold `packages/drivers/uspto-mcp` and wire `@beep/uspto` through the kit per `SPEC.md` deliverables. | Acceptance criteria met: `UsptoSourceAuth.ts` (soft gate), `UsptoDocumentTiers.ts` (array-level field-tier budget projector composed from kit primitives), `UsptoTools.ts` + `UsptoHandlers.ts` (two tools: `uspto_search_applications`, `uspto_get_documents`), `Server.ts` (`composeGatedLayers`/`gatedLayer`/`sanitizedToolkit` seam mirroring nlp-mcp), `bin.ts`. Also adopted the kit's new `sanitizedToolkit` (added during `mcp-host-retrofit`, see that goal's P0/P1) proactively since it is a zero-cost drop-in for `McpServer.toolkit` — a deviation beyond the literal SPEC list, noted here rather than silently expanding scope. |
| P2 Verify | complete | Run required checks and capture evidence. | `bunx tsgo -b`, `biome check`, `bun run beep docgen local --package=@beep/uspto-mcp`, and `TURBO_FORCE=1 bunx turbo run check test lint --filter=@beep/uspto-mcp` all green. Three fixture tests pass (`test/Server.test.ts`): api_key_required when absent, real data when present, documentBag reshaped under the 8000-byte default budget — all via fixture-mocked `HttpClient`, no real network or credential. |
| P3 Yeet: PR to mergeable | pending | Drive the shared-branch PR to mergeable via `/yeet` (coordinated with `mcp-host-retrofit`). | PR open and mergeable; hosted checks green or inherited baseline reds documented. |
| P4 Close | pending | Prepare review response, write the closeout reflection, and final readiness. | Packet status and evidence are updated; a closeout reflection exists. |

## P3/P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` /
`complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo tooling,
   the implementation, and the goal/prompt. Frontmatter must validate against
   `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (`reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.
4. Confirm `@beep/mcp-kit`'s package README consumer table names this package
   once it lands (coordinate with `mcp-host-retrofit` — the gate is only
   discharged once both consumers are in).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- This goal shares a branch with `mcp-host-retrofit`; sequence commits so each
  goal's changes stay reviewable independently (separate commits, not
  interleaved diffs).
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/uspto-mcp/GOAL.md)" -le 4000
jq . goals/uspto-mcp/ops/manifest.json
rg -n "uspto-mcp|GOAL.md|agentLaunchers|packetAnchorDocument" goals/uspto-mcp
git diff --check -- goals/uspto-mcp
bun run beep yeet verify
```
