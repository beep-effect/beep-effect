# Harvested Alpha Triage Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Schema | pending | Verdict row and merge-output schemas; confirm the ledger is on `main`. | Schemas merged or staged; ledger SHA recorded. |
| P1 Panel | pending | Three separate sessions judge every row; argv recorded as a decision file. | Three complete verdict files committed. |
| P2 Merge and seed | pending | Deterministic merge, disagreement list, scaffold a new exploration packet `harvested-alpha-2026-11` at `shape`. | Atlas regenerates and the seeded manifest reports stage `shape`. |
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

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add harvested-alpha-triage --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/harvested-alpha-triage/GOAL.md)" -le 4000
jq . goals/harvested-alpha-triage/ops/manifest.json
rg -n "harvested-alpha-triage|GOAL.md|agentLaunchers|packetAnchorDocument" goals/harvested-alpha-triage
git diff --check -- goals/harvested-alpha-triage
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug harvested-alpha-triage`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
