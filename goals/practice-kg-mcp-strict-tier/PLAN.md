# Practice KG MCP Strict Telemetry Tier Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Seam pin test; DPAPI feasibility; tool enum. | Facts recorded. |
| P1 Gate | pending | Serializer gate + egress client + stderr logger. | Golden + canary tests green. |
| P2 Spool + tier | pending | Encrypted spool; fail-closed tier resolution. | Spool round-trip + tier tests green. |
| P3 Proof | pending | Mutation tests; privacy receipt; Windows smoke. | All proofs green. |
| P4 Yeet | pending | PR to mergeable. | Merge gate passes. |
| P5 Close | pending | Reflection; packet flip. | completed-retained. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/practice-kg-mcp-strict-tier/GOAL.md)" -le 4000
jq . goals/practice-kg-mcp-strict-tier/ops/manifest.json
rg -n "practice-kg-mcp-strict-tier|GOAL.md|agentLaunchers|packetAnchorDocument" goals/practice-kg-mcp-strict-tier
git diff --check -- goals/practice-kg-mcp-strict-tier
```
