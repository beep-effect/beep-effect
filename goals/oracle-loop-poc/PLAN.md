# Oracle Loop POC Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | pending | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
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
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- P0: discover existing owners for findings, evidence, receipts, source anchors,
  and canonical identity; record reuse and the bounded fixture boundary before
  adding shapes.
- P1: complete the existing first generic slice, then implement the lab-local
  [question-binding fixture](./QUESTION-BINDING.md). Keep the patent profile and
  remaining codec work on their existing acceptance path.
- P2: run the original comparisons and Q1–Q16, with separate verdicts. Record
  the synthetic feedback-rule counterexample and simulated adoption decision.
  Answer-binding, authority, or commitment-preservation failures block promotion
  of affected shapes until fixed and rerun. Existing numeric criteria still apply.
- If the fixture appears to require a general engine, production service, or
  shared-model change, record the unmet requirement and no-go for that extension.
  Continue the scoped document experiment; do not silently expand scope or mark
  a missing fixture as passed. The inversion remains independent of this work.

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/oracle-loop-poc/GOAL.md)" -le 4000
jq . goals/oracle-loop-poc/ops/manifest.json
rg -n "oracle-loop-poc|GOAL.md|agentLaunchers|packetAnchorDocument" goals/oracle-loop-poc
git diff --check -- goals/oracle-loop-poc
```
