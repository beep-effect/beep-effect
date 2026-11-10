# Lane Cockpit Spike Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Create the lab; prove `render` from `@textjs/react/testing` under the repo's Vitest; capture one real `session open --json` report as a fixture. | The test runner question is settled and a fixture exists, or the circuit breaker fired. |
| P1 Implement | pending | Report schema, lanes service, then the board: ordering, detail pane, keys, filter, error state. | `SPEC.md` acceptance criteria for behaviour are met. |
| P2 Verify | pending | Frame tests, `quality package-verify`, one manual run against the live ledger. | Verification matrix rows are green or a blocker is documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable, then merge. | PR merged; zero unresolved review threads. |
| P4 Close | pending | Run the keep test for one working day, record the verdict, delete the lab on kill, update the exploration's map, write the reflection. | Verdict decision file, reflection and packet state landed. |

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
  (`bun run beep goals decisions add lane-cockpit-spike --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/lane-cockpit-spike/GOAL.md)" -le 4000
jq . goals/lane-cockpit-spike/ops/manifest.json
rg -n "lane-cockpit-spike|GOAL.md|agentLaunchers|packetAnchorDocument" goals/lane-cockpit-spike
git diff --check -- goals/lane-cockpit-spike
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug lane-cockpit-spike`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
