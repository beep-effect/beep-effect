# T3-Native Orchestration Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Re-verify the removal map against current `main`; capture the installed T3 server's MCP tool listing (names and arguments). | Required facts and blockers are recorded. |
| P1 Implement | complete | Delete in removal-map §0 order (CLI, session adapters, `@beep/t3-code`, unused observation-launch modules, docs, packets); rewrite skills and runbooks for T3; run the §6 regeneration commands. | Acceptance criteria are met. |
| P2 Verify | in-progress | Cheap gates, goals doctor, atlas check, semantic-delta, skills relock; live Codex↔Claude round trip through T3 recorded in `history/`. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/t3-native-orchestration/GOAL.md)" -le 4000
jq . goals/t3-native-orchestration/ops/manifest.json
rg -n "t3-native-orchestration|GOAL.md|agentLaunchers|packetAnchorDocument" goals/t3-native-orchestration
git diff --check -- goals/t3-native-orchestration
```
