# Research intake 2026-11 Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | complete | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | complete | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | in-progress | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
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
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add research-intake-2026-11 --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/research-intake-2026-11/GOAL.md)" -le 4000
jq . goals/research-intake-2026-11/ops/manifest.json
rg -n "research-intake-2026-11|GOAL.md|agentLaunchers|packetAnchorDocument" goals/research-intake-2026-11
git diff --check -- goals/research-intake-2026-11
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug research-intake-2026-11`; add a `kind: checkpoint` file there, never edit this block._

### P0: research-library-routes is unmerged; routes run first, mine commands build in parallel, 2026-11-07

The SPEC constraint requires research-library-routes merged before the intake runs. On 2026-11-06 that goal was active with every phase pending and no lane, branch or PR. The orchestrating session launched it as its own Opus 5.5 medium lane (T3 delegate, worktree isolation) with a handoff file naming the CLI surface. Hop-0 census confirmed paths and counts only: the Nov-5 aggregation holds 332 files (5.5 GB; 143 md, 57 json, 39 vtt, 38 mkv, 3 pdf) under the operator research root; the library root is the beep-effect collection beside it with intakes 2026-10-06 and 2026-10-14. No snapshot is frozen and nothing is acquired until routes merges, because the Box nightlies are part of hop 0 and arrive through the Box route. The mine commands (T1/T2/T3 runners) do not depend on the routes and are built now in this lane.

Lane `feat/research-intake-2026-11`

Reverse: If routes lands a different CLI surface, re-plan acquisition against goals/research-library-routes/history/intake-handoff.md

### goals-only re-final after #2892 merged before merge-ready, 2026-11-07

#2892 merged at 2026-11-07T20:46:58Z as 774ac7b7bc while its until-ready readiness monitor still reported not merge-ready, with Heavy Check, Docgen, Doctest and Test Integration pending and no final line posted. `goals completion refresh --slug research-intake-2026-11` therefore returns unsatisfied for #2892. This goals-only re-final PR becomes the final pull request, #2892 becomes supporting, and the gating yeet verdict moves to this branch. The PR is held for `merge-ready: yes` from its own until-ready monitor and merged through the strict merge gate. The three uncovered new files #2892 left on main (Library.mine.ts, Library.mine.runner.ts, Library.mine.text.ts) are covered in the separate unblocks-main research-library coverage PR together with the seven #2868 files.

Reverse: Point proposedCloseout.finalPullRequest back at #2892 and drop this checkpoint

### second goals-only re-final: the #2904 gating verdict was retired with its lane, 2026-11-07

#2904 merged on a merge-ready until-ready monitor (job 08aa6339) at eedcff79d9, but its lane was retired with `yeet sweep --retire` before `goals completion refresh` ran. The gating yeet verdict and the monitor's canonical status.json lived only in that lane's ignored yeet runs directory, so the refresh cannot read a head-bound verdict and reports unknown. This second re-final becomes the final pull request, with #2892 and #2904 as supporting. Its lane stays in place until the refresh prints verified.

Recovery for this re-final: record the full until-ready monitor job UUID outside the PR (the orchestrator thread and the PR's final comment), let that job print merge-ready before the merge, and after the merge run `bun run beep goals completion refresh --slug research-intake-2026-11 --readiness-job <uuid>` from this retained lane until it prints verified.

PR #2904

Reverse: Point proposedCloseout.finalPullRequest back at #2904 and drop this checkpoint

<!-- beep:decisions:end -->
