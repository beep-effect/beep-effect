# GitHub Budget Ledger Plan

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

- The ledger, sampler and reserve signal are keyed by identity x resource from the start, with the identity list
  as configuration, so goal 3 adds the App identity's sampler without a ledger change.
- First slice (MAP): transport rows from `yeet monitor --until-ready` (resource + identity added in
  `drivers/github`) -> host ledger under `$XDG_STATE_HOME/beep/github/ledger` -> `/rate_limit` sampler ->
  `github-headroom` line in `session open`. Widen to `gh` spawn attribution and `GraphqlBudget` only after that path
  is green.
- Schema first: `LedgerRow`, resource `LiteralKit`, identity label and the parcel model before the ledger
  `Context.Service`, then implementation.
- Start the 24 h hub baseline as soon as the slice merges; the baseline note and the T3 threshold decision are the
  last deliverables and gate this goal's closeout.
- Sibling dependency: [`github-state-worker`](../github-state-worker/PLAN.md) requires `github/budget-ledger`
  (reserve signal + baseline). Goal 3's rerun widening (3a) starts after this goal lands and may then run alongside
  goal 2; stay within three open PRs across the three packets.
- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add github-budget-ledger --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/github-budget-ledger/GOAL.md)" -le 4000
jq . goals/github-budget-ledger/ops/manifest.json
rg -n "github-budget-ledger|GOAL.md|agentLaunchers|packetAnchorDocument" goals/github-budget-ledger
git diff --check -- goals/github-budget-ledger
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug github-budget-ledger`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
