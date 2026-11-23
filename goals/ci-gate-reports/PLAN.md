# CI Gate Reports Plan

## Status

Status: `active`. P0, P1, P3 and P4 are complete (decision `report-carrier` and the P1, P3 and
P4 checkpoints): the `task-outcomes/v2` feed record, the CI projection, `beep ci append-gate-reports`,
the main-feed lookup, the CI-job adapter and `beep ci failures` are built, and the guidance names
the command. P2 (workflow wiring) is open: its workflow PRs wait for the driver's window. The
seven-day census runs a week after the guidance merges, once the census rule counts `beep ci
failures` as a CI-log read (P4 checkpoint).

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Confirm the workflow census, choose the report carrier against the six criteria in `SPEC.md`, and fix the feed's record schema. | One decision file names the carrier with each criterion answered by evidence; the census table in `SPEC.md` matches the workflows at that head. |
| P1 Projection and feed record | complete | The CI renderer (summary, grouped log, annotations) from gate reports, the planned CI subcommand that appends it, and the feed record schema. | The renderer, limit and neutralization tests pass. |
| P2 Workflow wiring | pending | Every gate job in `check.yml`, `shard-overflow.yml`, `storybook.yml`, `property-laws-nightly.yml`, `fleet-lane-probe.yml` and `heavy.yml` renders the projection and uploads its reports. | The workflow upload test and `bun run beep ci workflow-lint` pass; the first `main` run after each workflow PR shows the projection in every gate job, cited by run id. |
| P3 Lookup, adapter and failing-region command | complete | The main-feed lookup, the CI-job adapter, the extracted log route and the failing-region command. | The lookup, adapter and command fixture tests pass; the monitor's tests pass unchanged; the ledger shows REST only. |
| P4 Guidance and measurement | complete | Replace the raw `gh api` log recipe in `AGENTS.md` and the yeet skill; record the census or fixture numbers. | `bun run beep skills update --check` passes; the measurement is recorded as a checkpoint. |
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

### P3 complete: main-feed lookup, CI-job adapter, shared log route and `beep ci failures`, 2026-11-22

P3 is complete. `MainFeed` (`Ci/CiMainFeed.ts`) returns main's newest reports, red included, at the merge base or the nearest first-parent ancestor within 100, through `GitHubClient`; the recorded-REST tests show a merge-base hit in 3 requests and the ancestor walk in 4, with no GraphQL. `Ci/CiFeedArtifact.ts` downloads a task-outcome artifact up to 64 MiB and inflates only JSON entries up to 1 MiB. `ciRunGateReport` (`Ci/CiJobAdapter.ts`) maps `GET /actions/runs/{id}/jobs` to gate `run`, unit job, item step. The log route moved out of the monitor's private `readFailedJobLog` into the exported `readYeetFailedJobLog` and its `YeetJobLogRead` union (`Yeet/internal/MonitorLoop.ts`, same span name); the monitor's 48 tests pass unchanged. `bun run beep ci failures --run <id> | --pr <number>` prints each red job's uploaded agent console without fetching a log, or else the bounded failing region with the verdict first and last, and saves the run's record and full log under `.beep/gates/run/<run>-<attempt>`; an unbounded log prints one line naming the saved path. 23 fixture tests across `ci-main-feed`, `ci-job-adapter` and `ci-failures` pass, with 100% statement, branch, function and line coverage of the four new modules.

Lane goals/ci-gate-reports-p3

Reverse: Revert the P3 commit; the monitor's private log read returns and the ci failures command is removed

### P4 complete: guidance names `beep ci failures`, census baseline recorded, 2026-11-23

P4 is complete. `AGENTS.md`'s log-read line, `.claude/skills/yeet/references/gh-rest.md`, the yeet skill's `references/failure-handling.md` and the orchestrate skill's red-check row now name `bun run beep ci failures --run <id> | --pr <n>` instead of the raw `gh api ... /logs` recipe; `bun run beep skills update --check` passes.

Census baseline before the guidance merges: `bun run beep ai-metrics census --until 2026-11-23T02:00:00Z --write-baseline` wrote `standards/agent-output-census/runs/2026-11-23T02-00-00Z--census-rules-2026-11-18.json` (window 2026-11-16T02:00Z to 2026-11-23T02:00Z, rules `census-rules/2026-11-18`). CI-log fetches: 464 runs, 3 unfiltered, so 461 (99.4%) piped or redirected (the 2026-11-18 census run: 803 of 805, 99.8%). Turns fetching a CI log: 425 of 7,190 run-verification turns, 5.9% (2026-11-18: 747 of 10,109, 7.4%). Targets: at most 20% filtered and at most 3.7%.

Seven-day window: run `bun run beep ai-metrics census --since <merge time> --until <merge time + 7 days> --write-baseline` once a week has passed after this guidance merges on `main`, and compare its `ci-logs` filter row and `fetch-ci-log` turn row with this file. Gap: the census rule `ci-logs` (`census-rules.ts` in `@beep/repo-ai-metrics`) matches `gh run view --log`, the `/logs` endpoint and `yeet gh ... log`, not `beep ci failures`, so a call of the new command lands in `beep-other` and the share of it piped through `tail`, `head` or `grep` is not counted. The post-merge census needs that rule widened (a new rule version) before its filtered share measures the command.

Fixture stand-in, live and REST only: `bun run beep ci failures --run 45083821617` (Check on `main`, Repo Sanity red) printed a 7,950-character job block and `--run 45056484054` (Check, Heavy / Lint Policy red) a 7,976-character block, each within core's agent budget of 8,000 characters with no line over 240; both named the failing lane (`lint:comment-law`, `lint:policy`), printed the verdict first and last, and saved the record and log under `.beep/gates/run/` (151,414 and 524,854 bytes). Neither job uploaded a gate report, so both took the failing-region route.

Lane goals/ci-gate-reports-p4

Reverse: Revert the P4 commit; the guidance names the raw logs endpoint again and the census baseline file is removed

<!-- beep:decisions:end -->
