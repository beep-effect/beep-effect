# History Message Overlay Plan

## Status

Status: `P4 Close in progress` — all four slices are in final PR #2785; publication proof follows its merge.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | complete | Slice 1: map import + schema + `@beep/git` notes reads + `history notes --check`. Slice 2: `--write`, `sync`, worktree/cloud bootstrap hooks. Slice 3: post-merge publication workflow. Slice 4: cutover folder archive + docs. (Order: `explorations/git-history-rewrite/MAP.md`.) | Acceptance criteria are met. |
| P2 Verify | complete | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | complete | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | in-progress | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

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
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add history-message-overlay --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/history-message-overlay/GOAL.md)" -le 4000
jq . goals/history-message-overlay/ops/manifest.json
rg -n "history-message-overlay|GOAL.md|agentLaunchers|packetAnchorDocument" goals/history-message-overlay
git diff --check -- goals/history-message-overlay
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug history-message-overlay`; add a `kind: checkpoint` file there, never edit this block._

### Slice 1 landed in the lane: map tracked, history notes --check, 2026-11-06

docs/history/commit-message-map.json (940 rows) tracked; @beep/git gains notesList and hashObject; beep history notes --check decodes the map, proves every key reachable from origin/main and compares published notes by blob id. Real-repo run: 940/940 reachable, ref not yet published. Next: slice 2 (--write, sync, bootstrap hooks).

Lane `git-history-rewrite` · PR #2785

Reverse: Revert the slice-1 commits on the branch

### Slice 2 in the lane: --write, sync, bootstrap hooks, 2026-11-06

beep history notes --write and sync landed with @beep/git replaceNotes and configSet; History files at 100% coverage (scoped run), worktree hook tested; policy fingerprint regenerated for the new import. Next: slice 3 (post-merge publication workflow with fetch-depth 0 and a force-push of refs/notes/history).

Lane `git-history-rewrite` · PR #2785

Reverse: Revert the slice-2 commit on the branch

### Slices 3 and 4 in the lane: publication workflow, docs, folder archived, 2026-11-06

History Notes Publish (.github/workflows/history-notes-publish.yml) runs on main pushes that touch docs/history/commit-message-map.json and on dispatch: full-history checkout, --write, --check --require-published, then a force-push of refs/notes/history with the job token (contents: write, job-scoped). beep ci workflow-lint: clean. docs/history/README.md documents sync, publication and the blobless clone. The cutover folder moved to $HOME/.local/state/beep/archive/beep-effect-cutover/ and goals/legacy-drain has a checkpoint. Remaining acceptance needs main: the first workflow run publishing the ref, then --check against it.

Lane `git-history-rewrite` · PR #2785

Reverse: Delete .github/workflows/history-notes-publish.yml and restore the folder from the archive

### Post-merge publication proven; #2858 re-finals the closeout, 2026-11-07

History Notes Publish run 42339731476 on 12ba0fe044 published refs/notes/history at b40fd076d8 (identical to the pre-merge scratch write). sync plus check with require-published: 940 of 940 notes match. #2785 merged before its until-ready monitor recorded merge-ready, so completion refresh reported unsatisfied; #2858 fixes the 14 semantic-delta findings #2785 put on main (lane names rendered as docs/ paths, a bare upstream man-page path) and is the goal's final PR.

Lane `git-history-rewrite` · PR #2858

Reverse: Revert #2858; the overlay ref stays published and can be deleted with git push origin :refs/notes/history

<!-- beep:decisions:end -->
