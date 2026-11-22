# CI Gate Reports Plan

## Status

Status: `active`. P0 and P1 are complete (decision `report-carrier` and the P1 checkpoint): the
`task-outcomes/v2` feed record, the CI projection and `beep ci append-gate-reports` are built. P2
(workflow wiring) is next and opens after PR 1 merges.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Confirm the workflow census, choose the report carrier against the six criteria in `SPEC.md`, and fix the feed's record schema. | One decision file names the carrier with each criterion answered by evidence; the census table in `SPEC.md` matches the workflows at that head. |
| P1 Projection and feed record | complete | The CI renderer (summary, grouped log, annotations) from gate reports, the planned CI subcommand that appends it, and the feed record schema. | The renderer, limit and neutralization tests pass. |
| P2 Workflow wiring | pending | Every gate job in `check.yml`, `shard-overflow.yml`, `storybook.yml`, `property-laws-nightly.yml`, `fleet-lane-probe.yml` and `heavy.yml` renders the projection and uploads its reports. | The workflow upload test and `bun run beep ci workflow-lint` pass; the first `main` run after each workflow PR shows the projection in every gate job, cited by run id. |
| P3 Lookup, adapter and failing-region command | pending | The main-feed lookup, the CI-job adapter, the extracted log route and the failing-region command. | The lookup, adapter and command fixture tests pass; the monitor's tests pass unchanged; the ledger shows REST only. |
| P4 Guidance and measurement | pending | Replace the raw `gh api` log recipe in `AGENTS.md` and the yeet skill; record the census or fixture numbers. | `bun run beep skills update --check` passes; the measurement is recorded as a checkpoint. |
| P5 Yeet: PR to mergeable | pending | Publish through yeet and drive each PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P6 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Pull requests

The packet holds at most three open PRs at once. Workflow files ride PRs with no package source.

1. PR 1, code: P0's decisions and P1 (renderer, CI subcommand, feed record).
2. PR 2, code: P3 (lookup, adapter, log route, failing-region command). Opens beside PR 1; it
   reads the feed record schema, so it merges `main` once PR 1 lands.
3. PR 3, workflows: P2 for `check.yml` and the four smaller workflows. Opens after PR 1 merges,
   because the workflow steps call PR 1's commands.
4. PR 4, workflows: P2 for `heavy.yml`. Opens after PR 1 merges. `heavy.yml` runs from `main`, so
   it proves itself on the first `main` run after it merges, not in its own checks.
5. PR 5, final: P4 and the closeout. Opens after PR 2 merges, since the guidance names its
   command, and only while fewer than three siblings are open.

After PR 1 merges, at most PR 2, PR 3 and PR 4 are open together. `gate-run-history`'s hosted-main
phase waits for PR 2, PR 3 and PR 4: the reports are uploaded and the lookup exists.

## P0 Work Breakdown

1. Re-list every job in the gate workflows and its log, summary and artifact outputs at the
   current head; correct the census table if a job moved.
2. For each carrier candidate (workflow artifacts of gate reports, a widened `TaskOutcomeRecord`,
   the Turbo remote cache) answer the six criteria with evidence: a recorded lookup against real
   `main` runs, its REST request count from `bun run beep github ledger report`, the retention
   setting, and whether a red job's report survives.
3. Record the choice and the record schema as a decision; name the artifact or record path the
   upload writes.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status ci-gate-reports completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug ci-gate-reports` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add ci-gate-reports --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.
- Name `gate-report-core`'s packages by role (the gate-report model, the gate-run library) until
  that goal records their final names.
- `gate-report-rollout` also edits `Yeet/internal/MonitorLoop.ts`; whichever PR merges second takes
  `main` first.

## Verification Commands

```sh
test "$(wc -m < goals/ci-gate-reports/GOAL.md)" -le 4000
jq . goals/ci-gate-reports/ops/manifest.json
rg -n "ci-gate-reports|GOAL.md|agentLaunchers|packetAnchorDocument" goals/ci-gate-reports
git diff --check -- goals/ci-gate-reports
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug ci-gate-reports`; add a `kind: checkpoint` file there, never edit this block._

### P0 complete: census re-listed, carrier chosen, 2026-11-22

P0 is complete. The SPEC census was re-listed at origin/main on 2026-11-22: 33 workflows; Test Plan added; Commitlint, Secret Scanning and Security marked as gates without `ci lane`; the task-outcome writers corrected. The carrier is chosen in decision `report-carrier`: the per-job `task-outcomes-*` artifact widened to a `task-outcomes/v2` record plus the job's gate records, with each criterion answered by a live REST lookup (3 requests at the merge base, 4 for an ancestor). P1 (renderer, CI subcommand, the v2 feed record) is next and rides PR 1 with these decisions.

Lane goals/ci-gate-reports-p0

Reverse: Reopen P0 by reverting this checkpoint and the report-carrier decision

### P1 complete: feed record v2, CI projection and append-gate-reports, 2026-11-22

P1 is complete. `beep ci task-outcomes` writes `task-outcomes/v2` (`TaskOutcomeRecordV2` in `Ci/CiTaskOutcomes.ts`), whose `reports` index every gate record found in the job's checkout (`<package>/.beep/gates/<gate>/report.json` and root `.beep/gates/<gate>/<run-id>.json`); `GateFeedEntry` reuses `GateName` and `RepoRelativeDir` from `@beep/repo-gate-record/GatePaths`. `AnyTaskOutcomeRecord` decodes v1 or v2, and `Ci/RouteCorpus.ts` reads both and skips the `.beep/gates/` files a v2 artifact carries. The CI projection lives in `Ci/CiGateProjection.ts` (the repo CLI, not `@beep/repo-gate-run`, since its limits are GitHub's and its only caller is the ci command family): each summary section is the agent console `beep gate show` prints, fenced, under a 64 KiB budget; the grouped log has one group per unit and the verdict last; annotations keep 10 per level per step and 50 per job. `beep ci append-gate-reports --artifact <name>` prints the log and appends the summary. The route corpus downloads a task-outcome artifact up to 64 MiB (`ARTIFACT_DOWNLOAD_BYTES_MAX`), so a v2 artifact carrying raw logs is still read, and inflates only JSON entries up to 1 MiB (`ENTRY_INFLATE_BYTES_MAX`).

Lane goals/ci-gate-reports-p0

Reverse: Revert the P1 commit; task-outcomes writes v1 again and the append-gate-reports command is removed

<!-- beep:decisions:end -->
