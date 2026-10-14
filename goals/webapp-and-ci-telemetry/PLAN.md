# Web App and CI Telemetry Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Confirm runtimes (Node vs Edge) per route. | Facts recorded. |
| P1 Web | pending | Instrumentation in both apps. | Local spans verified. |
| P2 CI | pending | Summary→span converter. | Fixture test green. |
| P3 Dev loop | pending | LGTM sink + note. | Documented. |
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
test "$(wc -m < goals/webapp-and-ci-telemetry/GOAL.md)" -le 4000
jq . goals/webapp-and-ci-telemetry/ops/manifest.json
rg -n "webapp-and-ci-telemetry|GOAL.md|agentLaunchers|packetAnchorDocument" goals/webapp-and-ci-telemetry
git diff --check -- goals/webapp-and-ci-telemetry
```
