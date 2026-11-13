# GitHub Budget Ledger Plan

## Status

Status: closing. P0 to P2 are complete. The implementation merged in #3068, with accounting fixes in #3200 and #3247. The 24 h hub baseline is `history/2026-11-13-hub-baseline.md`, and the T3 share threshold is decision 2026-11-13 "T3 share threshold". The final PR carries both, the reflection and the closeout.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | complete | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | complete | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | complete | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | complete | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status github-budget-ledger completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug github-budget-ledger` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

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

### P0 complete, P1 in progress, 2026-11-10

P0 closed with the normative design `research/2026-11-10-design.md`: schemas, driver change, ledger service and store, gh spawn attribution, sampler and calibration, reserve signal, the github-headroom parcel, the test plan and the slicing. It resolves SPEC ambiguities A1 to A20, one decision file each, and records the laws and feasibility review dispositions. P1 implements the design as one PR, in the design's commit order.

Reverse: Set P0 back to pending in PLAN.md and ops/manifest.json and delete this checkpoint.

<!-- beep:decisions:end -->
