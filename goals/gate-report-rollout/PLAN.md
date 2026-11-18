# Gate Report Rollout Plan

## Status

Status: `pending`. Blocked on `goals/gate-report-core`: P1 starts once core's model, recorder and
agent projection are on `main`. P0 may start at once.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Fix the lane-to-adapter registry, the machine format per tool, the heartbeat CPU source and the block-mode state location. | `research/lane-catalog.md` maps every live catalog id to one adapter kind and one input format; one decision file per pick (Biome reporter, oxlint format, commitlint route, CPU source). |
| P1 Adapters and conformance | pending | Put every test-, diagnostic- and build-shaped lane on gate reports through the registry. | The conformance test passes over the live catalog; adapter fixture tests pass; no lane parses Biome or oxlint console text. |
| P2 Aggregates and Yeet consumers | pending | Render `package-verify`, `final-check`, `cheap-gates` and `publish` from gate reports; make `YeetVerdict`, `QualityIssueIndex` and the lane-run report consumers. | The consumer, decode and render criteria in `SPEC.md` pass. |
| P3 Heartbeat and block until changed | pending | Heartbeat in the gate-run supervisor; the block-until-changed mode on the gate table, `job wait` and the readiness monitor. | The `TestClock` heartbeat tests and the three delta tests pass; the GitHub ledger shows no added spend. |
| P4 Guidance and measurement | pending | Update `AGENTS.md`, the yeet and orchestrate skills; record the census or fixture numbers. | `bun run beep skills update --check` passes; the measurement is recorded as a checkpoint. |
| P5 Yeet: PR to mergeable | pending | Publish through yeet and drive each PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P6 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Pull requests

The packet holds at most three open PRs at once.

1. PR 1 carries P0's research file and decisions plus P1. It touches the lane catalog, the
   adapters and `Ci/CiLane.ts`.
2. PR 2 carries P2. It opens once PR 1's registry is on `main`, because consumers read the
   registry.
3. PR 3 carries P3. It touches only the Yeet status commands and the gate-run supervisor, so it
   runs beside PR 1 and PR 2.
4. PR 4 carries P4 and the closeout. It opens after PR 1 merges, so no more than three are open,
   and it is the final PR: guidance describes behaviour already on `main`.

Each PR goes through P5 on its own. A PR that shares a file with an open sibling merges `main`
after each sibling merge (`bun run beep yeet siblings <pr>` lists them).

## P0 Work Breakdown

1. Enumerate the live catalog from `githubCheckLanesForModeForTesting` (both tiers),
   `CI_LANE_ID_VALUES`, `QUALITY_TASK_NAMES` and `FinalCheckGate` into `research/lane-catalog.md`,
   one row per id: kind, unit and item shape, tool, installed version, input format.
2. Pick Biome's machine reporter (`sarif` or `rdjson`) and oxlint's (`json` or `sarif`) by fixture:
   run each on a planted violation and keep the one that carries rule code, file, line and column
   with no loss.
3. Record each CI-image tool's machine mode (sherif, gitleaks, the SAST scanner, `bun audit`).
4. Choose the CPU-time source for heartbeat activity and the behaviour where it is absent.
5. Choose where the gate-table block mode persists its last report under the Yeet state root.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status gate-report-rollout completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug gate-report-rollout` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add gate-report-rollout --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.
- Name `gate-report-core`'s packages by role (the gate-report model, the gate-run library) until
  that goal records their final names.

## Verification Commands

```sh
test "$(wc -m < goals/gate-report-rollout/GOAL.md)" -le 4000
jq . goals/gate-report-rollout/ops/manifest.json
rg -n "gate-report-rollout|GOAL.md|agentLaunchers|packetAnchorDocument" goals/gate-report-rollout
git diff --check -- goals/gate-report-rollout
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug gate-report-rollout`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
