# Palantiri Parcels Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Parcel specs, sources per parcel, HttpApi contract. | Schemas drafted; sources verified. |
| P1 Slice | pending | Account-headroom parcel + gauge + CLI. | First vertical slice verified live. |
| P2 Parcels | pending | Remaining four parcels + completeness check. | Decode + freshness tests green. |
| P3 MCP + session | pending | palantiri-mcp host; session-open push. | MCP handshake smoke green. |
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
test "$(wc -m < goals/palantiri-parcels/GOAL.md)" -le 4000
jq . goals/palantiri-parcels/ops/manifest.json
rg -n "palantiri-parcels|GOAL.md|agentLaunchers|packetAnchorDocument" goals/palantiri-parcels
git diff --check -- goals/palantiri-parcels
```
