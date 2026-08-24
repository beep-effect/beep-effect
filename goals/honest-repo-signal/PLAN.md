# Honest Repo Signal Plan

## Status

Status: `complete — P1-P3 shipped in PR #680 (2026-08-13); P4 closed 2026-08-24`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Lock inventory and follow-ups | complete | Confirm stub list, owning goals, and one-night cut list. | `SPEC.md` + `research/FOLLOW-UPS.md` match the live tree; protobuf excluded. |
| P1 One-night honesty pass | complete | Delete three stubs, ship public files, README subtree note, AGENTS.md table, patch delivery README. | SPEC acceptance boxes checked. |
| P2 Verify | complete | Run packet + repo-sanity-adjacent checks. | Verification matrix green or blockers recorded. |
| P3 Yeet: PR to mergeable | complete | Publish through yeet. | Shipped as PR #680, merged 2026-08-13. |
| P4 Close | complete | Reflection + status flip in the same PR as final work. | `completed-retained` flipped and reflection landed 2026-08-24. |

## P0 notes (2026-08-13)

Live `beep goals` surface is `doctor`, `index`, `set-status`. There is no
`beep goals bootstrap`. Packet copied from `goals/_template`. Recorded as
friction in `research/OPPORTUNITIES.md` and as a KSA follow-up.

VERSION-only drivers in this checkout: courtlistener, dol, federal-register,
protobuf. Protobuf is owned by another clone — leave it.

`goals/gov-legal-data-driver-delivery` still says the empty scaffolds are
intentional. P1 must supersede that sentence and point here.

## P1 implementation order

1. Inventory consumers of the three aliases (must be none besides tsconfig /
   coverage / workspace). Stop if a product import exists.
2. Delete the three package trees. Remove workspace entries, tsconfig paths,
   coverage baseline rows, knip rows if any, changesets if any.
3. Patch delivery README: scaffolds deleted; resume via
   `goals/honest-repo-signal/research/FOLLOW-UPS.md`.
4. Add `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`, PR template,
   issue-template config (`blank_issues_enabled: false` or a single
   "this is not a support queue" config).
5. README: first-party vs `.repos/effect`; squash-only refreshes; no new
   full-history subtree adds.
6. `AGENTS.md`: add a compact Touch → Skill/Command table. If the file
   grows, cut an equivalent sentence elsewhere in the same file.
7. Do not regenerate coverage baseline unless deletion makes the ratchet
   fail; prefer deleting the three rows.

## P4 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
2. `bun run beep lint reflection-artifacts`.
3. Flip status through `bun run beep goals set-status honest-repo-signal completed-retained`
   in the same PR as the final work.

## Execution Notes

- Preserve unrelated worktree changes.
- Do not implement Federal Register / DOL / CourtListener.
- Do not touch protobuf.

## Verification Commands

```sh
test "$(wc -m < goals/honest-repo-signal/GOAL.md)" -le 4000
jq . goals/honest-repo-signal/ops/manifest.json
bun run beep goals index --check
test ! -d packages/drivers/courtlistener
test ! -d packages/drivers/dol
test ! -d packages/drivers/federal-register
test -d packages/drivers/protobuf
git diff --check -- goals/honest-repo-signal
```
