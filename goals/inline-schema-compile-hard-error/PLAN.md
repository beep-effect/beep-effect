# Inline Schema Compiler Hard Error Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Reproduce and classify the 2,931-finding opening baseline. | Every finding has an ownership family and migration shape; drift is explained. |
| P1 Implement | complete | Hoist compilers family by family and update generators before outputs. | All governed findings are removed without semantic changes. |
| P2 Verify | complete | Promote the rule to error and run local proof. | Rule tests, affected package checks, docgen, and canonical verification are green. |
| P3 Yeet: PR to mergeable | complete | Publish through Yeet and close checks and review threads. | `bun run beep yeet monitor` reports `merge-ready: yes`. |
| P4 Close | complete | Write the reflection and flip packet state. | Packet status and evidence are synchronized; reflection validates. |

These are the completed states carried by the closeout candidate. Its merge
remains held until final-head verification and review satisfy the unchanged
exit criteria. Earlier passing receipts are not relabeled as proof of this
candidate; final publication evidence is recorded by Yeet and the successor PR.

The implementation and review corrections merged in PRs #1019 and #1022.
`research/closeout-evidence.md` records the full passing local proof and hosted
checks on the same implementation tree. PR #1028 shipped the package-proof
runner repair and reflection, but also merged before local verification and
packet closeout finished. The clean v2 matrix passed all 106 owners, and two
supplemental package verifications cover the remaining audited owners. The
full local proof passed all 34 reported lanes. All nine review threads across
the three PRs are resolved, and the receipts are pushed in `abd5416aa2`.
The operator approved final closeout PR #1038 on 2026-09-09 after #1028 merged
before closeout. Publication of evidence commit `59bba09125` passed all 67
reported lanes, including all 23 local CI-parity stages. PR #1038 merged at
07:19 UTC before its final-head local proof or packet update. All four of its
review threads are resolved and all 18 required hosted checks passed. The
owned queued proof was stopped cleanly after the merge. The operator then
approved [successor PR #1042](https://github.com/beep-effect/beep-effect/pull/1042)
on branch `codex/inline-schema-packet-closeout`, then marked it ready for
review. It merged at 09:01:20 UTC before the packet update, 51 seconds after
Codex raised the packet-closeout P1. The agent initially replied without
resolving it. All 18 required hosted checks passed, and Yeet reported
`merge-ready: yes` before that late review and merge.

The `bba3d0aa8b` publication passed all 15 local preflight gates, 30 pre-push
lanes, and 23 local CI-parity stages. The outer command failed after proof
because the agent edited two incident-note files during the run. Its dirty-tree
guard correctly rejected those changes. Passing checker stages do not make
that publication successful or close the packet. The operator subsequently
authorized this successor on 2026-09-09, with the final packet-state update
included before publication and merging held through final verification and
review. Branch `codex/inline-schema-lifecycle-closeout` carries that update.
No verification requirement is waived. The publication checkout stays
unchanged until the command terminates; any new incident notes are captured
outside it during proof.

## P0 — Research

1. Reproduce the predecessor census against current HEAD.
2. Classify by compiler name, package, authored/generated ownership, and safe
   migration form.
3. Locate and update generator owners before generated output.
4. Establish per-family no-growth baselines and a zero target.

## P1 — Implement

1. Hoist native compiler results to module scope when a sibling constant is
   clearest.
2. Reuse selective schema statics only where they form the schema's evidenced
   public surface.
3. Preserve invocation-time parse options and Effect requirements.
4. Land families with shrinking, reproducible counts.

## P2 — Verify

1. Reach zero findings before changing severity.
2. Promote `beep(no-inline-schema-compile)` from warning to error.
3. Extend rule tests for every accepted and rejected compiler shape.
4. Run required package verification, docgen, and canonical Yeet verification.

## Closeout Checklist

Before accepting the closeout PR:

1. Drive the PR to `merge-ready: yes` through Yeet.
2. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`.
3. Run `bun run beep lint reflection-artifacts`.
4. Confirm README evidence, phase statuses, and manifest lifecycle are already
   updated in this same PR; do not defer them to a post-merge follow-up.

## Verification Commands

```sh
test "$(wc -m < goals/inline-schema-compile-hard-error/GOAL.md)" -le 4000
jq . goals/inline-schema-compile-hard-error/ops/manifest.json
rg -n "inline-schema-compile-hard-error|GOAL.md|agentLaunchers|packetAnchorDocument" goals/inline-schema-compile-hard-error
git diff --check -- goals/inline-schema-compile-hard-error
bun run beep goals doctor
bun run beep goals index --write
bun run beep goals index --check
bun test goals/inline-schema-compile-hard-error/research/scripts/package-verification.test.ts
```
