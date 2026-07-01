# USPTO MCP Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Confirm `@beep/mcp-kit`'s shipped surface (`SourceAuth`, `ToolkitComposition`, `ApiKeyRequired`, `FieldTier`) matches this host's expected call shape; run the `create-package` wiring checklist. | Kit surface confirmed compatible or drift documented; new-package scaffold plan recorded. |
| P1 Implement | pending | Scaffold `packages/drivers/uspto-mcp` and wire `@beep/uspto` through the kit per `SPEC.md` deliverables. | Acceptance criteria are met (three fixture tests, kit-only composition, consumer-plan README). |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
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
