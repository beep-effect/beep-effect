# MCP Host Retrofit Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Confirm `@beep/mcp-kit`'s shipped `SanitizedSpan`/`ToolAnnotations`/`TierGate` surface; audit both hosts' tool surfaces for any genuine write/gateable tool (tier-gate applicability) and confirm which tool sets lack four-hint annotations. | Kit surface confirmed compatible; per-host retrofit scope (span, hints, tier-gate applicability) recorded. |
| P1 Implement | pending | Adopt the kit's `SanitizedSpan` wrapper and `ToolAnnotations` helper in both hosts per `SPEC.md` deliverables; apply the tier-gate wrapper only if P0 found a genuine target. | Acceptance criteria are met (proof tests, hint parity, unchanged behavior). |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Drive the shared-branch PR to mergeable via `/yeet` (coordinated with `uspto-mcp`). | PR open and mergeable; hosted checks green or inherited baseline reds documented. |
| P4 Close | pending | Update `@beep/mcp-kit`'s README consumer table, write the closeout reflection, and final readiness. | Packet status and evidence are updated; a closeout reflection exists. |

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
4. Confirm `@beep/mcp-kit`'s package README consumer table names both this
   goal's packages and `uspto-mcp` (coordinate with the `uspto-mcp` goal — the
   gate is only discharged once both consumers are in).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- This goal shares a branch with `uspto-mcp`; sequence commits so each goal's
  changes stay reviewable independently (separate commits, not interleaved
  diffs).
- Deliverables #1/#2/#4 are mechanical (wrapper/helper adoption, no behavior
  change) — verify via unchanged test outcomes, not new test logic.
  Deliverable #3 requires per-tool judgment on hint values.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/mcp-host-retrofit/GOAL.md)" -le 4000
jq . goals/mcp-host-retrofit/ops/manifest.json
rg -n "mcp-host-retrofit|GOAL.md|agentLaunchers|packetAnchorDocument" goals/mcp-host-retrofit
git diff --check -- goals/mcp-host-retrofit
bun run beep yeet verify
```
