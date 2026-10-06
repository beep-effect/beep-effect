# Practice Mail Tagging Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Ground in `@beep/m365`, `@beep/box`, the Box tree, and the practice KG; settle the design. | `SPEC.md` design and Decision Log D-1..D-8 recorded. |
| P1 Implement | complete | Capability core (#1464), Outlook / practice-KG / Box adapters (#1480), entrypoint app, sample unit and runbook (#1495), known-documents fix (#1511), first-apply checklist (#1515), review-category fix (#1518). | Acceptance criteria 1-8 and 10 met. |
| P2 Verify | in-progress | Live dry-run since 2026-07-01 done ([record](history/2026-10-06-live-dry-run.md)). First apply and undo drill passed on the operator's IT mailbox ([record](history/2026-10-06-first-apply-it-mailbox.md)); first live apply on the attorney's mailbox for mail since 2026-10-01 ([record](history/2026-10-06-first-apply-attorney-mailbox.md)). Remaining: the July-September backfill, attorney spot-check (counts, review category, contact overlay), the attended bounded apply with an undo drill, then the full apply and the unit. Attachment filing is blocked on Box storage (D-42). | Apply and undo-drill reports recorded in `history/`. |
| P3 Yeet: PR to mergeable | in-progress | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
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
