# Retire ./scripts into beep CLI commands and a compiled beep binary for CI Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | complete | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | complete | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | in-progress | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | complete | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

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
  (`bun run beep goals decisions add scripts-to-beep-cli --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/scripts-to-beep-cli/GOAL.md)" -le 4000
jq . goals/scripts-to-beep-cli/ops/manifest.json
rg -n "scripts-to-beep-cli|GOAL.md|agentLaunchers|packetAnchorDocument" goals/scripts-to-beep-cli
git diff --check -- goals/scripts-to-beep-cli
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug scripts-to-beep-cli`; add a `kind: checkpoint` file there, never edit this block._

### Goals-only re-final after #2921 merged inside its review window, 2026-11-08

#2921 merged at 00:52:56Z, under 20 minutes after its last push (anchor 00:43:24Z) and before the strict verify/publish/until-ready steps ran. `goals completion refresh --slug scripts-to-beep-cli --readiness-job b9411f51` returned unsatisfied: the review window was open at merge, and no Yeet verdict was bound to the merged head (the publish verdict named 1825039bfbf). This goals-only re-final PR re-binds `proposedCloseout` to itself, keeps #2921 as a supporting PR, and takes the strict route before merging.

Lane `scripts-to-beep-cli-p3`

Reverse: Close the re-final PR and keep #2921 as the final PR

### Third goals-only re-final after #2922 merged before its merge-ready line, 2026-11-08

#2922 merged at 03:16:40Z (main 2398f39133), before the strict route recorded a merge-ready verdict on its head. `goals completion refresh --slug scripts-to-beep-cli --readiness-job f50864e8` returned unsatisfied. All 15 required contexts were green at accepted head c0f3a2b449, and the review window had elapsed. But the gating yeet-verdict was bound to an older head ("declared verdict head mismatch"), and no until-ready job ran on c0f3a2b449. This re-final re-binds `proposedCloseout` to itself and keeps #2922 as a supporting PR. It stays a draft through final-check, verify and publish, and is flipped ready only immediately before `yeet monitor --until-ready`, so it cannot be merged before the merge-ready line.

Lane `scripts-to-beep-cli-p3`

Reverse: Close the re-final PR and keep #2922 as the final PR

### Fourth goals-only re-final after #2961 was hand-merged seven seconds after its ready flip, 2026-11-09

#2961 merged at 11:35:12Z (main 031fa9d4af), seven seconds after it was flipped ready at 11:35:05Z, by hand from the operator account, with all 45 of its checks green. `goals completion refresh --slug scripts-to-beep-cli` on tbk-worker returned unknown: the review window was open at merge, no until-ready job ran on accepted head e8fa214954, the gating yeet-verdict file lives on the publishing workstation, and this guest's fine-grained token gets 403 on the ruleset-history and rule-suite endpoints the merge-time required-check inventory needs. This fourth re-final re-binds `proposedCloseout` to itself and keeps #2961 as a supporting PR. It stays a draft. The strict route (flip ready, `yeet monitor --until-ready` to merge-ready: yes, merge, `goals completion refresh --readiness-job <id>`) has to run from one workstation whose token reads rulesets, and the PR must not be hand-merged before the merge-ready line, which is what unbound the three previous finals.

Lane `scripts-to-beep-cli-refinal4`

Reverse: Close this re-final and keep #2961 as the final PR

<!-- beep:decisions:end -->
