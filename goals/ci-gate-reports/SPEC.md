# CI Gate Reports Spec

## Objective

Render GitHub Actions output from gate reports, upload every hosted run's reports as the feed for
main's baseline, and put a failing job's cause one command away.

`gate-report-core` builds the gate report (gate > unit > item), the recorder that writes it under
`.beep/gates/`, and the agent and terminal projections. This goal adds the third projection
(decision `audience-three-projections`): a GitHub job summary plus a grouped log, rendered from the
same report. It uploads the reports of every hosted run and gives a lane a lookup for main's
newest reports at its merge base (the hosted feed of decision `history-baseline`). It adds a
planned command on the repo CLI that prints a failing job's verdict and isolated failing region by
run or PR number, and a CI-job adapter that reads a workflow run as a gate.

The design is settled in the exploration: `explorations/agent-verification-output/BRIEF.md`,
`explorations/agent-verification-output/MAP.md` (candidate 6) and
`explorations/agent-verification-output/DECISIONS.md` (`audience-three-projections`,
`history-baseline`, `agent-surface`).

## Non-Goals

- The report model, the agent and terminal projections, the recorder (`gate-report-core`).
- History labels and the store that reads the feed (`gate-run-history`). This goal ships the feed
  and its lookup; history consumes them.
- Putting the remaining local gates on the contract (`gate-report-rollout`).
- SARIF upload to code scanning and a Checks API writer (decision `interchange-projections`).
- MCP tools or hooks (decision `agent-surface`).
- Workflow changes that do not serve the projection, the upload or the adapter.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

Repo CLI paths are under `packages/tooling/tool/cli/src/commands/`.

- Workflows: `.github/workflows/check.yml`, `.github/workflows/heavy.yml`,
  `.github/workflows/shard-overflow.yml`, `.github/workflows/storybook.yml`,
  `.github/workflows/property-laws-nightly.yml`, `.github/workflows/fleet-lane-probe.yml`, and
  `.github/actions/setup-monorepo-ci/action.yml`.
- CI commands: `Ci/Ci.command.ts` (`append-turbo-summary`), `Ci/CiTaskOutcomes.ts`
  (`TaskOutcomeRecord`, `taskOutcomeArtifactPrefix`, `taskOutcomesOf`), `Ci/RouteCorpus.ts` (the
  hosted artifact reader), `HostedTaskOutcome` in `Ci/Route.schemas.ts`, `Ci/CiRunnerOutputs.ts`,
  `Ci/CiLane.ts`, `Ci/CiGovernance.ts` (`workflow-lint`).
- The failing-region route: `isolateYeetMonitorJobLogFailure`, `stripYeetMonitorLogDecoration` and
  the private `readFailedJobLog` in `Yeet/internal/MonitorLoop.ts`.
- Renderers to reuse: `Render.markdown` and `Render.githubLog` in
  `packages/foundation/capability/cli-kit/src/Render.ts`, `GithubAnnotation` in
  `packages/foundation/capability/cli-kit/src/GithubAnnotation.ts`, `CommandNeutralizer` and
  `WorkflowCommand` in `packages/foundation/modeling/github-commands/src/`, and `CheckDocument` and
  `GitHubMarkdown` in `packages/foundation/modeling/github-reporting/src/`.
- GitHub access: `GitHubClient` in `packages/drivers/github/src/GitHubClient.ts`, `ActionOutputs`
  in `packages/drivers/github-actions/src/ActionOutputs.ts`, and the budget ledger in
  `packages/tooling/tool/cli/src/internal/github/GithubLedger.service.ts`.
- The gate-run services and the planned `gate` command family from `gate-report-core`.
- Guidance: `AGENTS.md` (the REST log-read line) and `.claude/skills/yeet/references/gh-rest.md`.

## Workflows that run gates today

33 workflows live under `.github/workflows/` (re-listed in P0 on 2026-11-22). These run gates:

| Workflow | Gate jobs | Logs | Step summary | Per-task record and artifacts |
| --- | --- | --- | --- | --- |
| `check.yml` | Running `ci lane`: Repo Sanity, Docs Policy, Ecosystem Contracts, Codegen Drift, Labs, Lint (per partition), Test Plan, Test Unit (per partition; overflow through `shard-overflow.yml`), Test Integration (per partition), Coverage Regression, Professional Desktop IPC Stdio, Property Laws (per partition), Fallow Advisory Envelopes, JSDoc Ratchet, Nix Shell, SAST. Gates that do not run `ci lane`: Commitlint, Secret Scanning, Security | raw stream of `bun run beep ci lane <id>` through a `run_lane` shell wrapper, Turbo with `TURBO_LOG_ORDER=stream` | `bun run beep ci append-turbo-summary` after Labs, Lint, Test Unit, Test Integration and Property Laws; hand-built Markdown in Fallow Advisory and JSDoc Ratchet | `bun run beep ci task-outcomes` writes `.beep/ci-task-outcomes/record.json` (`task-outcomes/v1`) in Repo Sanity, Ecosystem Contracts, Codegen Drift, Labs, Lint, Test Unit, Test Integration and Property Laws, uploaded `always()` as `task-outcomes-<run>-<attempt>-<job>-<partition>` with `retention-days: 30`. The sampled records carry `tasks: []`, red jobs included (decision `report-carrier`) |
| `heavy.yml` (called as `heavy.yml@main` by `check.yml` and `heavy-admit.yml`) | Lint Policy, Check, Docgen, Doctest, Build | `run_lane ci lane <id>`, raw stream | one `append-turbo-summary` | Turbo summary uploaded as `turbo-summary-verify-<lane>`; no task-outcome record |
| `shard-overflow.yml` | Test Unit overflow partitions | `run_lane ci lane test-unit` | `append-turbo-summary` | task-outcome record and artifact |
| `storybook.yml` | Storybook | `run_lane ci lane storybook` | `append-turbo-summary` | two artifacts |
| `property-laws-nightly.yml` | Property Laws Sweep | `bun run beep ci lane property` | `append-turbo-summary` | none |
| `fleet-lane-probe.yml` | Lane Probe (one lane by input) | `bun run beep ci lane <lane> --summarize` | none | none |

Other summary writers in source: the check-census gate table (`Quality/CheckCensus.ts`), the
rerun decision (`Ci/CiRerunRunnerLoss.ts`), `Ci/CiRunnerOutputs.ts` and
`Ci/CiOperational.service.ts`. Annotations are hand-written `::error::` and `::warning::` lines in
workflow shell (eight in `check.yml`) plus Vitest's `github-actions` reporter, which Turbo passes
`GITHUB_ACTIONS` through to. No workflow adds a problem matcher.

## The CI projection

- One renderer, from the gate report only, never from the job's log. It produces the neutral
  document of `gate-report-core` and renders it through `Render.markdown` for the step summary
  and `Render.githubLog` for the grouped log.
- **Job summary.** The same verdict line and failure list the local agent console prints, in the
  same order, as GitHub-flavoured Markdown: verdict, the failing items (location, code, first
  message line), the cap line (`... N more in the record`), the record's artifact name. One
  summary per gate step.
- **Grouped log.** One `::group::` block per unit holding its items, after the tool's raw stream,
  with the verdict line printed last outside any group.
- **Annotations.** One `::error` or `::warning` per failing item with `file`, `line` and `col`,
  ranked by the model's order, capped at 10 per level per step and 50 per job (GitHub's limits);
  the summary states how many were not annotated.
- **Limits are laws of the renderer.** The summary stays under 1 MiB per step (GitHub's limit) and
  under a renderer budget of 64 KiB; a job writes at most 20 step summaries (GitHub shows no
  more). Every tool-provided string passes through `CommandNeutralizer`, so text inside a
  diagnostic never becomes a workflow command.
- Workflow steps call a planned CI subcommand on the repo CLI that appends the projection for the
  reports a job wrote, beside `append-turbo-summary`.

## Report upload and the main feed

- Every hosted job that runs a gate uploads its `.beep/gates/` reports and raw logs, red or green,
  with `retention-days` set (`bun run beep ci workflow-lint` rejects an upload without it).
- A planned lookup command answers: the newest main reports for a given merge base. It finds the
  newest completed `main` run at the merge base, or at the nearest ancestor that has reports
  within a bounded walk, and returns the reports for the requested gates. `gate-run-history`
  reads this lookup for its "already red on main" label.
- **The carrier is chosen in P0 against these criteria, recorded as a decision:**
  1. Red runs are carried. The baseline exists to identify reds already on main, so a carrier
     that keeps only passing tasks fails.
  2. The lookup is keyed by commit: it resolves "main at SHA" without scanning unbounded run
     history.
  3. Each lookup's GitHub request count is bounded and recorded in the budget ledger; the target
     is five REST requests or fewer for a hit at the merge base, and no GraphQL.
  4. Retention covers the oldest live lane's merge base: at least 30 days.
  5. No new paid service or endpoint.
  6. One record per job, decodable by schema, with no second copy of the same facts.
- The candidates: workflow artifacts holding the gate reports; the per-task outcome record
  (`TaskOutcomeRecord`) widened to carry or point to them, which `Ci/RouteCorpus.ts` already reads
  through `GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts`; and the Turbo remote cache,
  which keys task outputs by task hash and does not store failed tasks.

## The failing-region command

- A planned command on the repo CLI takes a run id or a PR number and prints, for each failed job
  of that run (or of the PR head's newest runs), the job's verdict and failures.
- When the job uploaded a gate report, it prints that report's agent console. No log is fetched.
- Otherwise it reuses the monitor's route: `gh run view --job <id> --log-failed`, then the
  per-job logs endpoint through `GitHubClient`, cut by `isolateYeetMonitorJobLogFailure` and
  cleaned by `stripYeetMonitorLogDecoration`. The route moves out of the private
  `readFailedJobLog` into one exported function that both the monitor and the command call.
- The printed region is bounded by core's agent budget, verdict first and last. The whole log is
  saved under `.beep/gates/` and named by path and size.
- A log whose failing step cannot be bounded prints one line saying so, with the saved path.
- Every request goes through `GitHubClient`, so the budget ledger records it. The command spends
  REST only; GraphQL is shared at 5,000 points an hour per identity across every session
  (`.claude/skills/yeet/references/gh-rest.md`).
- No `yeet gh` subcommand fetches logs today; the yeet skill documents a raw `gh api ... /logs`
  call. This command replaces that recipe.

## The CI-job adapter

- A workflow run is a gate, each job a unit, each step an item: `GET
  /repos/{owner}/{repo}/actions/runs/{run_id}/jobs` gives steps with status and conclusion, and no
  log read.
- Step conclusions map onto the closed outcome set: `success` passed, `failure` failed, `skipped`
  skipped, `cancelled` and `timed_out` failures with their own counts (honest counts). A job with
  no steps never reads as green.
- A failed step's item detail is the job's gate-report verdict when one was uploaded, else the
  isolated region.
- The failing-region command and the lookup both use the adapter; the run's report is recorded
  locally like any other gate.

## Constraints

- Design order is the repo law: the CI-projection document and the feed's record schema first,
  then the service contracts (projection, uploader, lookup, log route), then implementation.
- No CI console renders from a raw stream (BRIEF no-go). The raw stream stays in the job log and
  in the uploaded raw log.
- `check.yml` and `heavy-admit.yml` call `heavy.yml@main`. A change to `heavy.yml` never runs in
  the PR that carries it; it proves itself on the first `main` run after merge. `heavy.yml`
  changes ride their own PR, opened after the commands they call are on `main`.
- A workflow file is a global input to the coverage ratchet, so workflow PRs carry no package
  source.
- GitHub API quota is shared by every session on an identity. Lookups and log reads use REST
  through `GitHubClient` and are visible in `bun run beep github ledger report`; uploads run on
  the runner's token and spend no agent identity's quota.
- The monitor's behaviour is unchanged by extracting the log route: its tests keep
  passing unchanged.
- Every edited workspace package passes `bun run beep quality package-verify <@beep/package>`
  before hand-off.

## Acceptance Criteria

- [ ] P0 records the carrier decision with each of the six criteria answered by evidence (a
  fixture lookup, a request count, the retention setting).
- [ ] A renderer test: for a red gate-report fixture, the job summary's verdict line and failure
  list equal the local agent console's verdict and failure lines (same items, same order).
- [ ] A 200-item fixture renders at most 10 error annotations for the step, a cap line naming the
  rest, and a summary under 64 KiB; a diagnostic message containing `::error::` renders as text,
  not as a workflow command.
- [ ] Every gate job listed in "Workflows that run gates today" renders its summary from gate
  reports. Evidence: the first `main` run after each workflow PR merges, cited by run id in a
  checkpoint, shows the projection in every gate job.
- [ ] A test over the workflow files asserts every job that runs `bun run beep ci lane` uploads
  its gate reports with `retention-days` set; `bun run beep ci workflow-lint` passes.
- [ ] The lookup, against recorded REST fixtures, returns main's reports at a given merge base,
  walks to the nearest ancestor with reports when the merge base has none, returns red reports,
  and spends at most five REST requests for a hit at the merge base.
- [ ] The failing-region command, given a run id or a PR number with recorded fixtures: prints the
  uploaded report's verdict and failures when one exists; otherwise prints the isolated region
  within core's agent budget, verdict first and last, plus the saved log's path and size; prints
  one line for an unbounded log. It spends no GraphQL.
- [ ] The monitor calls the extracted log route, and its existing log-classification tests pass
  unchanged.
- [ ] The CI-job adapter, from a recorded jobs response: one failed step yields one failed item
  under its job; `cancelled` and `timed_out` steps count as failures with their own counts; a job
  with no steps is not green.
- [ ] `.claude/skills/yeet/references/gh-rest.md` and the `AGENTS.md` log-read line name the
  planned command instead of the raw `gh api` recipe; `bun run beep skills update --check` passes.
- [ ] Census, once the planned census command of `agent-output-census` exists, over seven days
  after the guidance merges: the share of CI-log fetches piped through `tail`, `head` or `grep`
  falls from 100% (805 fetches, none unfiltered, on 2026-11-18) to 20% or less, and turns spent
  fetching a CI log fall from 747 (7.4% of the 10,117 verification turns) to at most 3.7% of
  verification turns. Until the command exists, fixtures stand in: the failing-region output for
  the recorded red job is at most core's agent budget.
- [ ] `bun run beep quality package-verify` passes for every touched package.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/ci-gate-reports/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/ci-gate-reports/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/ci-gate-reports` | Passes |
| Projection and limits | renderer tests, run by `bun run beep quality package-verify @beep/repo-cli` | Same lines as local; caps hold |
| Upload coverage | workflow test; `bun run beep ci workflow-lint` | Every gate job uploads with retention |
| Lookup | recorded-fixture lookup tests | Hit, ancestor walk, reds, at most five requests |
| Failing region | recorded-fixture command tests | Bounded, verdict first and last, REST only |
| Hosted proof | first `main` run after each workflow PR, by run id | Projection in every gate job |
| GitHub spend | `bun run beep github ledger report` | Lookup and log reads attributed, REST only |
| Skills | `bun run beep skills update --check` | Passes |
| Census | the planned census command, seven-day window | Rows at or under the targets above |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add ci-gate-reports --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug ci-gate-reports`; add a `kind: decision` file there, never edit this block._

### A failing job is reached through files and a repo CLI command, not MCP or hooks, 2026-11-18

Operator ruling in `explorations/agent-verification-output/DECISIONS.md`, entry `agent-surface`: an agent reaches detail beyond the verdict through typed records on disk and repo CLI commands; no MCP tools and no hooks are added. For CI this means a planned command on the repo CLI that prints a failing job's verdict and isolated failing region by run or PR number, saves the whole log under `.beep/gates/` and names it by path and size. It behaves the same under Claude, Codex, Cursor and Grok, adds nothing to always-loaded context, and replaces the raw `gh api` log recipe in the yeet skill. Footer pointers are runnable commands.

Lane explore/agent-verification-output

Reverse: Add an MCP tool for CI failures and drop the failing-region command

### The CI projection is the third view of the same gate report, 2026-11-18

Operator ruling in `explorations/agent-verification-output/DECISIONS.md`, entry `audience-three-projections`: one record, three projections chosen by detection with a flag to override. This goal builds the CI one: a GitHub job summary plus a grouped log, rendered from the gate report and never from the job log. A hosted red therefore reads the same facts in the same order as the local agent console, so a human checking a hosted job sees what an agent saw. GitHub limits (annotations per step and per job, summary size, summaries per job) are laws of the renderer.

Lane explore/agent-verification-output

Reverse: Leave hosted jobs on raw tool streams and Turbo step summaries

### Hosted runs upload their gate reports as the main baseline feed, 2026-11-18

Operator ruling in `explorations/agent-verification-output/DECISIONS.md`, entry `history-baseline`: a history label compares against the lane's own earlier runs plus main's latest hosted results, so output distinguishes a failure introduced on the lane from one already red on main. This goal supplies the hosted half: every hosted gate job uploads its reports, red or green, and a lookup returns main's newest reports for a given merge base. `goals/gate-run-history` consumes the lookup in its hosted-main phase. The carrier (workflow artifacts, the per-task outcome record, or the Turbo remote cache) is chosen in P0 against the criteria in `SPEC.md`; a carrier that drops red runs fails the first criterion.

Lane explore/agent-verification-output

Reverse: Stop the upload and the lookup; history labels then compare against lane runs only

### ci failures review round 1: run selection, partial reports, saved-log labels, inflate cap, 2026-11-22

CodeRabbit's first review of PR #3493 raised six findings and a nitpick; each was verified and fixed.

- **Run selection.** A pull request's head runs are read when the newest run of a workflow concluded `failure` or `timed_out`, or has not completed. A `cancelled` run is left out: the head's code did not fail it, a newer push or a manual cancel did.
- **Artifact listing failure.** A failed artifact listing reads as no feeds, so every red job falls back to its log instead of failing the command.
- **Partial reports.** A job is reported from its artifact only when every report in it decoded. When some reports are unreadable, the command names them, prints one verdict line per readable report (at most a quarter of the agent budget, the rest counted on one line) and still reads the job's log, so the failing log region keeps its share of the budget.
- **Budget.** The bounded failing region reserves room for the job header, the partial-report verdict lines, the verdict lines, the saved-log line and the omission line. Every frame line is cut to `agentBudget.maxLineChars`, so the frame takes at most about 3,200 characters and the region keeps the rest of the budget. When even the omission line does not fit beside the frame, the region returns no line, so a job section never passes `agentBudget.maxChars`.
- **Saved-log label.** The saved-log line and each section of the saved file say what the log holds: failing steps only (`gh run view --log-failed`, marked when the capture was truncated) or the whole job log. The monitor's own wording is unchanged.
- **Inflate cap.** A feed artifact may hold at most 8 MiB of JSON entries in total (eight times the 1 MiB per-entry cap), each entry counted at the larger of its compressed and declared original sizes, because fflate copies a stored entry by its compressed size. A stored entry whose two sizes differ is refused. Entries past the limit are not inflated, and either case fails the read with a `CiCommandError`.
- **Option decoding.** Job and step `conclusion` and a job's `steps` decode to `Option` (`OptionFromNullOr`, `OptionFromOptionalNullOr`) and encode back to their wire forms.

Lane goals/ci-gate-reports-p3 · PR #3493

Reverse: Revert the round-1 fix commit on PR #3493; the prior failure-only filter, all-or-nothing feed reading and unlabelled log line return.

### CI-job adapter: cancelled steps count as unhandled; a stepless job is a fault unless skipped or not started, 2026-11-22

`ciRunGateReport` (`Ci/CiJobAdapter.ts`) reads a run as gate `run`, each job a unit and each step an item. `success` passes, `failure` fails, `skipped` and `neutral` skip, a step with no conclusion has not finished and skips, and any other conclusion is a plain failure. `timed_out` fails with `failureKind` `timeout` and `cancelled` fails with `unhandled`, so both keep their own totals buckets: the gate-report model has no cancel kind, and `unhandled` (the run stopped the step, not an assertion) is the nearest. A job with no steps is never green. GitHub lists a job skipped by `if:`, or one not yet started, with `steps: []`: that job reads as one skipped item. Any other job with no steps gets one `FaultKey` item, counted as `errored`, even when GitHub calls it a success. A red job whose steps all passed gets the same fault item, so the report never reads green while the job is red.

Lane goals/ci-gate-reports-p3

Reverse: Edit STEP_READINGS and jobItems in Ci/CiJobAdapter.ts

### The failing-region command is `beep ci failures`, 2026-11-22

The failing-region command is `bun run beep ci failures --run <id> | --pr <number>` (`Ci/CiFailures.ts`). It sits in the `ci` family beside `task-outcomes` and `append-gate-reports`, because it reads the same carrier and the same GitHub runs; `failures` names what it prints, the failed jobs of a run, and reads plainly after `ci`. A pull request resolves to the newest run of each workflow at its head that failed or is still running. Each red job is joined to its uploaded task-outcome artifact by `record.job` (a job reached through a reusable workflow is listed as `<caller> / <job>`, so a record also joins a job whose name starts with `<job> / `). GitHub's job name does not give the artifact key, so the command ranks this attempt's artifacts by token overlap with the red job names and downloads at most 8 (`FAILED_JOB_ARTIFACT_DOWNLOADS_MAX`), stopping once every red job is joined.

Lane goals/ci-gate-reports-p3

Reverse: Rename the subcommand in Ci/CiFailures.ts and Ci.command.ts and update the help line

### Main-feed lookup keys on job artifact and gate filter, 2026-11-22

`MainFeed.lookup` (`Ci/CiMainFeed.ts`) takes a merge base, the caller's first-parent ancestors, the job artifact keys to read and a gate filter (empty means every gate). A gate name alone cannot address an artifact: artifacts are named per job, `task-outcomes-<run>-<attempt>-<job>`, so the caller names the jobs. The caller supplies `git rev-list --first-parent` past the merge base, since the checkout already has it and the walk then costs no API call; the lookup lists `check.yml` push runs on `main` once, bounded by the merge base run's creation time, and takes the first listed ancestor within 100 (`MAIN_FEED_ANCESTOR_LIMIT`) whose run concluded `success` or `failure`. A cancelled or skipped run ran no gate; red runs are kept, because main's red reports are the baseline a lane compares against. A hit at the merge base costs 1 listing plus 2 requests per job (artifact by exact name, zip), 3 for one job; everything goes through `GitHubClient`, REST only.

Lane goals/ci-gate-reports-p3

Reverse: Change MainFeedRequest in Ci/CiMainFeed.ts and its callers

### The report carrier is the per-job task-outcome artifact, widened to hold the gate records, 2026-11-22

The feed's carrier is the existing per-job task-outcome artifact, widened. Each hosted gate job uploads one artifact, `task-outcomes-<run>-<attempt>-<job>-<partition>` (name unchanged, so `Ci/RouteCorpus.ts` keeps finding it), uploaded `if: always()` with `retention-days: 30`. It holds:

- `.beep/ci-task-outcomes/record.json`, a `task-outcomes/v2` record;
- every gate record and log the job wrote, at their repo-relative paths: `<package>/.beep/gates/<gate>/report.json` and `report.log`, and the root's `.beep/gates/<gate>/…` (`recordLocation` in `@beep/repo-gate-record/GatePaths`).

**Record schema (`task-outcomes/v2`).** `{ schemaVersion: "task-outcomes/v2", job, runId, runAttempt, tasks: HostedTaskOutcome[], reports: GateFeedEntry[] }`. `GateFeedEntry` is `{ gate: GateName, subject, record: RepoRelativePath, log: RepoRelativePath }`, an index into the same artifact. It carries no verdict or counts: those stay in the `gate-report/v1` record it points to, so no fact is stored twice. Readers decode `v1 | v2` while v1 artifacts are inside their 30-day window, then drop v1.

**Evidence for the six criteria** (live REST reads against `main`, 2026-11-22):

1. *Red runs are carried.* The task-outcome upload already runs `always()`. Run 44994851897's red `Test Unit (repo-cli-8)` uploaded `task-outcomes-44994851897-1-test-unit-shard-repo-cli-8`. But that record and a green one (run 45042229032, `test-unit-shard-unit-e`) both decode to `tasks: []`, so today's record carries no failure facts. Widening it with the gate records is what makes a red job's facts survive. The Turbo remote cache fails here: Turbo writes cache entries only for tasks that succeed.
2. *Keyed by commit.* `GET /actions/workflows/{check.yml}/runs?head_sha=<mergeBase>&event=push&status=completed` resolves main at a SHA. A miss is common: 18 of main's last 40 Check runs were `cancelled` without running, because the concurrency group keeps one pending run. So the fallback is one listing, `…/runs?branch=main&event=push&status=completed&created=<=<merge base run's created_at>&per_page=100`, intersected locally with `git rev-list --first-parent <mergeBase>`. The lookup never pages further: no ancestor in that page means "no main baseline". The Turbo remote cache fails here: it is keyed by task hash, not commit.
3. *Bounded requests.* A hit at the merge base takes 3 REST requests: the runs by `head_sha`, `GET /actions/runs/{id}/artifacts?name=<exact name>` (one artifact, no paging of a run's 137 artifacts), and `GET /actions/artifacts/{id}/zip`. An ancestor hit takes 4. Measured: merge base `bc49cb6` had a cancelled Check run (request 1). Request 2 listed 66 completed runs; the nearest first-parent ancestor was `4e3343774cc`, 4 commits back (run 45042229032). Request 3 returned artifact 14763290472, and request 4 returned its zip (`record.json`, 110 bytes). No GraphQL. Each further job requested adds 2 (artifact, zip). These reads ran through `gh api`; the ledger proof comes with the `GitHubClient` lookup in P3 (its fixture test asserts at most five).
4. *Retention.* `retention-days: 30` on every task-outcome upload. The sampled artifact expires 2026-12-22, 30 days after creation. Gate uploads that today use 7 days (`turbo-summary-verify-*` in `heavy.yml`) do not carry the feed.
5. *No new paid service.* Workflow artifacts on the existing GitHub plan, uploaded with the runner's token. The lookup spends REST on an agent identity's existing quota.
6. *One record per job, no second copy.* One artifact and one record per job. A separate `gate-reports-*` artifact beside `task-outcomes-*` would pass criteria 1 to 5 but fail this one: two artifacts per job, both indexing the same job, and about 50 more artifacts per Check run on top of today's 137.

**Rejected:** the Turbo remote cache (fails 1, 2 and 6); a separate gate-report artifact (fails 6).

The P2 workflow PRs add the record and upload to the gate jobs that lack one today: Docs Policy, Test Plan, Coverage Regression, Professional Desktop IPC Stdio, Fallow Advisory, JSDoc Ratchet, Nix Shell, SAST, every `heavy.yml` lane, Storybook, the nightly Property Laws Sweep and the Lane Probe.

Lane goals/ci-gate-reports-p0

Reverse: Upload the gate records as a separate gate-reports artifact per job and read that in the lookup

### ci lane steps count the annotations they stream; append-gate-reports reads the count by default, 2026-11-23

The CI projection keeps GitHub's annotation caps: 10 per level per step and 50 per job. Until now nothing counted the annotations a job's earlier steps had already spent, so `--annotations-used` was always 0. The count now comes from the stream the lane recorder (decision `lane-step-gate-records`) already tees.

**Count.** While it streams the lane child's output, the recorder scans whole lines (`scanWorkflowCommands`, carrying a partial line across chunks). It counts a line as an annotation when, after leading whitespace, it reads `::error`, `::warning` or `::notice` (any case), optionally followed by properties, and closed by `::`. `::group::` and other commands do not count.

**Persist.** Each step caps each level at 10 (`shownAnnotationsOf`), because GitHub drops the rest, and adds the result to `.beep/ci/annotations-used.json`, a `ci-annotations-used/v1` record `{ errors, warnings, notices }`. The file is outside every `.beep/gates` directory, so it is never staged as a gate record.

**Read.** `beep ci append-gate-reports` takes `--annotations-used` when it is given. Otherwise it reads the file's total (`resolveAnnotationsUsed`). No file means 0, and a file that does not decode fails the step, so a broken count is never taken for zero. The gate-reports action needs no change: it already omits the flag.

**Known overcount, on the safe side.** Two lane invocations in one workflow step are capped separately, and commands inside a `::stop-commands::` block are counted. Both can only make the projection write fewer annotations than GitHub would accept, never more. Annotations from steps that are not `ci lane` (actions, raw `bun run` steps) are not counted.

**Rejected:** a `--annotations-used` value computed in workflow YAML (the YAML cannot see earlier steps' output); reading the job log through the API mid-job (the log is not available until the job ends).

Lane goals/ci-gate-reports-lane-records

Reverse: Make --annotations-used default to 0 again in CiGateProjection.ts and drop the addAnnotationsUsed call from CiLaneRecording.ts

### A hosted ci lane step records its lane through a recorded child process, 2026-11-23

On a GitHub runner, `beep ci lane <id>` records its lane through a child: the CLI entry (`GITHUB_ACTIONS=true`, `process.argv[1]` is `packages/tooling/tool/cli/src/bin.ts`, no `BEEP_CI_LANE_RECORDED`) runs itself again with the same argv and `BEEP_CI_LANE_RECORDED=1`, streams the child's merged output through to the job log and into a scratch log, and exits with the child's exit code (`GateToolExit`). The child runs the lane exactly as before. Code: `packages/tooling/tool/cli/src/commands/Ci/CiLaneRecording.ts`.

**Record.** After the child exits, the recorder compares the modification times of the checkout's gate records (`findJobGateRecordTargets`, now in `CiGateRecordSearch.ts`) with a reading taken before the child started. A new or rewritten record, a package `gate run` or a Turbo cache restore, means the step wrote its own record, and the recorder writes nothing. Otherwise it writes a root run of the `lane` gate, `.beep/gates/lane/<run-id>.{json,log}`, through `runGate` with `withGateServices` (`GateRecorder` over `GateRecordStore`, no history) and prints that console. The subject is the lane id and the item kind is `step`. A zero exit is one passed step. Any other exit states no item, so the reducer records an `errored` run whose fault message is the excerpt of the lane's log. `append-gate-reports` then shows a verdict for Docs Policy, Fallow Advisory, JSDoc Ratchet, Nix Shell, SAST, Professional Desktop IPC Stdio, Test Plan, Coverage Regression's compare step and Verify's repo-sanity step.

**Why a child process.** Lane steps spawn their tools with inherited stdio from more than a dozen call sites (`runLaneProcess`, `Quality/Tasks.ts` step runners, Turbo, partition runners). Re-running the CLI as a child is the one place that sees the whole stream without changing any of them. It costs one extra CLI start per lane step.

**Measurement never decides the step.** Only a failure to start the child or to read its exit code fails the step. Searching the checkout, counting annotations, opening or writing the scratch log, the job-log tee, reading the output to its end and writing the record each print one `[ci] lane recording:` line on failure and keep the child's exit code. A failed tee or log write stops only that copy: the recorder keeps reading the child's output so the child never blocks, and a record written without a log has an empty one. The scratch directory's removal ignores failures.

**Output that outlives the lane.** The child is detached, so it leads its own process group. Once it exits, the recorder waits at most 5 s (`CI_LANE_DRAIN_GRACE_MS`) for its output to close, then stops reading and stops the group. This bounds the descendant-holding-the-pipe case that `run_lane`'s `setsid` group kill already handles.

**Off a runner** (developer shells, `beep ci local`, tests calling the command), the lane runs in place as before.

Lane goals/ci-gate-reports-lane-records

Reverse: Delete CiLaneRecording.ts and the ciLaneSelfCommand branch at the top of the ci lane handler; lanes run in place again and record-less jobs print 'no gate records'

### Event-only gate workflows prove on their first run, 2026-11-26

Two of the six gate workflows have not run on `main` since PR 3 (#3490) wired them, and neither runs on a `main` push. `shard-overflow.yml` is a called workflow that runs only when a Test Unit partition overflows the hosted pool. `fleet-lane-probe.yml` is operator-dispatched onto the fleet heavy pool. P2's exit criterion asks for the first `main` run after each workflow PR. For these two, that run would only exist if an agent forced an overflow or dispatched the operator's probe.

Call: P2 closes on the static proof for these two plus the hosted proof for the other four. The static proof is `beep ci workflow-lint`, whose upload rule now runs in CI, and the repository-workflow test in `test/ci-governance.test.ts`, which pins every gate job id in all six files and fails when any of them loses the render or upload step. The overflow job's steps are the same block as the hosted Test Unit shard's, which uploaded on main run 45688461000. Each workflow's first natural run is its hosted proof, read with `beep ci failures --run <id>` or the run's artifacts list.

Lane goals/ci-gate-reports-upload-lint

Reverse: Hold P2 in progress until a main shard-overflow.yml run and a dispatched fleet-lane-probe.yml run upload their reports, then flip it

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
