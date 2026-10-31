# Run the typecheck and build gates on the Effect-patched tsrs Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Verify Effect-TS/tsgo #901 and `@effect/tsgo` 0.59.0, measure the Effect tsrs against tsc-rs 0.8.0, prove rule coverage. | `research/measurements-2026-10-26.md` records the numbers. |
| P1 Implement | complete | Pin `tsrs` with `@effect/tsgo` 0.59.0, patch it in `prepare`, swap every gate script and scaffold default, update the policy test, runbook and cache baseline. | Acceptance criteria in `SPEC.md` are met; `--fast` stays off. |
| P2 Verify | complete | Local `turbo run check` on tsrs, then hosted `Heavy / Check` and `Heavy / Build` on the swap PR with timings against the tsc-rs baseline. | Hosted gates green on tsrs (#2260: Check 3m36s, Build 2m23s); recorded in `SPEC.md`. |
| P2b Fold | complete | PR 2: fold the standalone Effect Diagnostics lane into Check (profile into the compiler maps, ignore flags false, lane and hosted job removed). | Full check graph green with the rules gating (337/337 on 2026-10-27); PR 2 mergeable; ruleset drops the retired context at merge. |
| P3 Yeet: PR to mergeable | in-progress | Qualify a fresh closeout PR through Yeet, retain its exact-head readiness evidence, merge with passing required checks, and refresh completion. #2262 merged with two required reds, so its historical receipt is unsatisfied. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
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

- 2026-10-28: resume closeout in `codex/tsrs-gates-closeout`; preserve #2262 historical reds and bind the proposal to the new PR before content-final. Operative lifecycle stays active until completion refresh verifies.

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/tsrs-gates/GOAL.md)" -le 4000
jq . goals/tsrs-gates/ops/manifest.json
rg -n "tsrs-gates|GOAL.md|agentLaunchers|packetAnchorDocument" goals/tsrs-gates
git diff --check -- goals/tsrs-gates
```
