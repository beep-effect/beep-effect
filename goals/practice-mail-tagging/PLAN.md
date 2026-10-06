# Practice Mail Tagging Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Ground in `@beep/m365`, `@beep/box`, the Box tree, and the practice KG; settle the design. | `SPEC.md` design and Decision Log D-1..D-8 recorded. |
| P1 Implement | in-progress | PR 1: domain schemas, ports, tagger, job, filer, undo, file ledgers, synthetic tests. PR 2: Box, practice-KG, and `@beep/m365` adapters plus the service entrypoint (after workstream A's write verbs merge). | Acceptance criteria 1-7 are met. |
| P2 Verify | pending | Live dry-run over mail since 2026-07-01 (counts only), attorney spot-check of a sample, operator-attended apply, undo drill on one message. | Reports recorded in `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

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
test "$(wc -m < goals/practice-mail-tagging/GOAL.md)" -le 4000
jq . goals/practice-mail-tagging/ops/manifest.json
rg -n "practice-mail-tagging|GOAL.md|agentLaunchers|packetAnchorDocument" goals/practice-mail-tagging
git diff --check -- goals/practice-mail-tagging
```
