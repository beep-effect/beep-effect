# Comment Law Sweep Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | in-progress | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status comment-law-sweep completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug comment-law-sweep` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add comment-law-sweep --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/comment-law-sweep/GOAL.md)" -le 4000
jq . goals/comment-law-sweep/ops/manifest.json
rg -n "comment-law-sweep|GOAL.md|agentLaunchers|packetAnchorDocument" goals/comment-law-sweep
git diff --check -- goals/comment-law-sweep
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug comment-law-sweep`; add a `kind: checkpoint` file there, never edit this block._

### Hold new Opus author launches while the only Claude account with quota sits at its 50% floor, 2026-11-23

On 2026-11-23 benjamintoppold read 50% left with every other Claude account's week used up, Codex Sol has no admissible account until 11-24 13:41, and Cursor's Opus pool is empty, so no author route exists. The parent ruled: no new Opus children (the yaml lexer.ts pilot included); Grok classifier-B and verifier work, the lane owner's own proofs, merge-gate work and PR opens continue.

Lane goals/comment-law-sweep-w9a

Reverse: Lift when any other Claude account resets (first boppold, about 2026-11-26 02:00Z) or benjamintoppold reads above 50% left in beep accounts status.

<!-- beep:decisions:end -->
