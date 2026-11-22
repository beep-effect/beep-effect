# Gate Run History Spec

## Objective

Record every gate report by branch, and label each failure against two series: the lane's own
earlier runs and main's latest hosted results at the lane's merge base. A re-run on a lane says
what changed since the last one.

The labels answer the question the repo's attribute-before-repairing law asks: is this red mine,
inherited, or noise. This goal delivers the history store, the label classifier, the fix-loop
delta line, the history queries of the planned `gate` command family on the repo CLI, the
reconciliation with flake quarantine, and the hosted-main baseline.

The design is settled in `explorations/agent-verification-output`: `BRIEF.md` ("History"),
`DECISIONS.md` (entries `history-baseline`, `core-enhancements`, `agent-surface`), `MAP.md`
candidate 4, and `research/vitest-agent-core.md` sections 3.2 to 3.4 and 9, cited against the
reference checkout `.repos/vitest-agent` at `1cf1ab94`. The report model, the console and its
label and delta slots are `goals/gate-report-core`; this spec uses its types and names.

## Non-Goals

- The report model, the recorder and the console projections: `goals/gate-report-core`.
- Choosing the carrier for hosted reports and uploading them from CI: `goals/ci-gate-reports`.
  This goal consumes what that goal uploads.
- Changing the detection rules of flake quarantine. History adds labels; the quarantine keeps
  deciding whether a lane passes.
- Coverage trends, failure-signature occurrence counts, notes, hypotheses and the session, turn,
  agent and TDD tables of upstream's database (decision `tdd-workflow-no-go` in the exploration).
- An MCP tool or a hook for history (decision `agent-surface`).
- History for output of commands the repo does not own.

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

- The gate-run library `goals/gate-report-core` creates (working name `@beep/repo-gate-run`,
  `tooling/library/repo-gate-run`): the history store module, its layer and the
  baseline import. The store module is a separate entry that the Vitest adapter never imports.
- The gate-report model (working name `@beep/gate-report`,
  `foundation/modeling/gate-report`): the series and observation schemas, the label
  classifier and the delta, as pure functions.
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`: the task path ingests each rendered
  record into history after the console is flushed.
- The planned `gate` command family on the repo CLI (the `Gate` command directory core adds):
  list a subject's history, show one item's series, import main's hosted baseline for the lane's
  merge base.
- `packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts`: quarantine
  incidents are recorded as history observations. Its detection is unchanged.

Reused: `@beep/sqlite` (`packages/drivers/sqlite`; exports `SqliteClient`, `make`, `makeLayer`,
`SqliteError`, `SqliteTestLayer`) and `@beep/xdg` (`packages/foundation/capability/xdg`;
`AppDirs` with its `state` kind of `AppDirKind`). Precedent: `@beep/agent-memory-store`
(`packages/tooling/library/agent-memory-store`, `MemoryLog.layer.ts`), a tooling library on the
same driver.

## Constraints

### The series

- The series key is `(gate, subject, item key, branch)`. The item key is core's: the file and
  full name for a test; the file, code or rule, and message shape for a diagnostic.
- An observation is one item outcome in one run: `passed` or `failed`, with the run's input
  fingerprint (core: the Turbo task hash, else a digest of head and uncommitted changes), head
  commit, branch, origin (`local` or `hosted`) and time. Each attempt of a runner retry is its own
  observation on the run's input.
- A diagnostic gate records only failing items. An item key absent from a unit the run checked is
  a `passed` observation. An item in a unit the run did not check is no observation.
- A cache replay is not an observation. A restored record keeps its original run id; inserts are
  idempotent on run id, and every answer for a report excludes observations carrying that report's
  own run id. A cache hit therefore renders the same labels and delta as the run it replays.
- The window `W` is configuration, default 10 runs per series per branch. The reader and the
  retention use the same `W`; upstream reads 20 and keeps 10 (study section 3.3). Runs are retained
  newest 200 per `(gate, subject, branch)`; pruning a run never deletes the observations still in
  a window (upstream `0003_run_retention.ts:92-155`).

### The two comparison series

- **Lane series `L`**: the earlier observations of the item on the report's branch with origin
  `local`, newest first, at most `W`.
- **Main baseline `M`**: the item's observation in main's hosted report for the same gate and
  subject at the lane's merge base with `main`. If no hosted report exists for that commit, the
  newest hosted main report whose head is an ancestor of the merge base serves, and the console
  names its distance (`main baseline 3 commits before merge base`). Local runs on `main` never
  serve as the baseline. Without either, `M` is absent.

### Labels

Upstream's `classifyTest` (`.repos/vitest-agent/packages/sdk/src/utils/classify-test.ts:11-26`, study section 3.3) is
the starting point:

| Current | Prior runs in window | Upstream result |
| --- | --- | --- |
| failed | none, or all passed | `new-failure` |
| failed | newest prior failed | `persistent` |
| failed | some failed, newest passed | `flaky` |
| passed | none, or none failed | `stable` |
| passed | any failed | `recovered` |

Its named weaknesses and the fix for each:

| Weakness (study section 9) | Fix here |
| --- | --- |
| One window shared by every branch and worktree, so a red on one lane relabels the same test on all of them | Series partitioned by branch; main's baseline from hosted results only |
| Two flaky rules that disagree (`classify-test.ts:15-20` and the MCP query, `DataReaderLive.ts:711-730`) | One flaky rule, below, used by the label, the queries and the quarantine reconciliation |
| Vitest's retry flag stored and never read | Each retry attempt is an observation on the run's input |
| Window a constant: read 20, keep 10 (`HistoryTrackerLive.ts:13`, `DataStoreLive.ts:458`) | `W` is configuration, the same for reading and retention |
| `recovered` sticks for up to nine green runs after one red | `recovered` marks only the first green run after a red, stated here as the law |
| `new-failure` cannot tell a lane's own red from an inherited one | `introduced-on-lane` and `red-on-main` are separate labels with separate evidence |

**The flaky rule.** An item is flaky when two of its observations on the same input fingerprint
disagree, one `failed` and one `passed`. The observations considered are the current run's
attempts, `L`, and `M`'s hosted series for the baseline input. A fail and a pass on different
inputs are a code change, not flakiness.

**Labels for a failed item**, the closed set from core, first match wins:

1. `flaky`: the flaky rule holds.
2. `red-on-main`: `M` exists and the item failed in it.
3. `persistent`: the newest observation in `L` failed.
4. `introduced-on-lane`: `M` exists and the item passed in it, or `L` holds a `passed`
   observation of the item.
5. No label: none of the above can be decided. The console says once why
   (`no main baseline for <merge-base>`). A failure is never labelled `introduced-on-lane`
   without evidence.

**`recovered`** labels a passed item whose newest observation in `L` failed. It holds for that one
run only. It never appears on a failure line; it feeds the delta's `fixed` count and the record.

### The fix-loop delta

The delta compares the report with the newest earlier run on the same branch, origin `local`, same
gate and subject, over the items in units both runs checked:

- `fixed`: failed in the earlier run; passed or absent from a checked unit now.
- `still failing`: failed in both.
- `new`: failed now; passed or absent from a checked unit in the earlier run.

Items in units only one run checked are not counted, and the line then ends with
`(scope differs)`. Without an earlier run there is no delta line. On a red run the line reads
`since last run: F fixed, S still failing, N new`; on a green run with `F > 0` it is a suffix of
the one verdict line, `(F fixed since last run)`.

### Storage

- The store sits on `@beep/sqlite`, which wraps `@effect/sql-sqlite-bun` over `bun:sqlite` and runs
  only under Bun. A tooling package may depend on a driver only for a narrowly scoped operational
  adapter, declaring the driver dependency and project reference directly and keeping product
  semantics out of the driver (`standards/ARCHITECTURE.md`, "Family And Kind Dependency Rules").
  `@beep/agent-memory-store` is the precedent. The history store is that adapter: the library's
  only driver.
- One SQLite file per repository under the XDG state directory, through `@beep/xdg` `AppDirs`:
  `$XDG_STATE_HOME/beep/gate-history/<repository-key>.sqlite`. The key is the canonical `origin`
  URL as `host__owner__repo`, else a digest of the real path of the git common directory. Every
  clone and worktree of the repository shares the file; the branch column partitions it.
- Write-ahead logging and a busy timeout on every connection. The driver turns both on by default
  and retries the WAL switch on `SQLITE_BUSY` within the busy timeout.
- One transaction per run: the run row, its checked units and its observations commit together,
  with the retention prune. The connection is synchronous, so the transaction body never yields
  to the scheduler mid-transaction, the invariant upstream holds with
  `References.PreventSchedulerYield` (`.repos/vitest-agent/packages/engine/src/utils/persist-transaction.ts:175`).
- A concurrent first open is a typed failure. `SqliteError` never crosses the store's port; the
  store translates it into a `GateHistoryError` whose reason is a `LiteralKit` domain
  (`open-busy`, `open-failed`, `migrate-failed`, `write-failed`, `read-deadline`). `open-busy` and
  migration contention retry on a bounded, jittered exponential schedule (5 attempts from 50 ms).
  Upstream dies untyped at the WAL switch (`.repos/vitest-agent/okf/limitations/concurrent-first-open-wal-switch.md`).
- Migrations are versioned and idempotent and run inside a transaction, so two first openers
  converge on one schema.

### Rendering never waits on the store

- The label and delta read for a report runs under a deadline, default 250 ms, configuration. On
  the deadline or any `GateHistoryError`, the console renders without labels and delta and adds
  one line naming the cause. The verdict is never hidden (core law 10).
- Writes start only after the console is flushed. A failed write leaves the console as printed
  and is reported on stderr in one line.
- The store is written by the repo CLI task path under Bun, from the records the gates wrote. It
  is never opened inside a Vitest process, which may be Node.

### Hosted-main baseline

- Main's reports reach a lane through the carrier `goals/ci-gate-reports` chooses: workflow
  artifacts, the per-task outcome record
  (`packages/tooling/tool/cli/src/commands/Ci/CiTaskOutcomes.ts`) or the Turbo remote cache.
- The `gate` command family's baseline import fetches the hosted main reports for the lane's merge
  base and records them with origin `hosted` and branch `main`, one transaction per report.
- Until that carrier exists, `M` is absent, labels 2 and 4 fall back to lane evidence, and the
  console says so once.

### Reconciliation with flake quarantine

`FlakeQuarantine.ts` quarantines a no-location TS2589 failure whose standalone rerun passes
(`detectNoLocationTs2589Flake`, `FlakeQuarantineIncident`, the artifact
`.beep/yeet/flake-quarantine.json`). That is the flaky rule: one input, two outcomes. Each
incident is recorded as two observations of the check item `(package, TS2589, no location)` on one
input fingerprint, `failed` then `passed`, so history labels it `flaky`. The quarantine stays the
authority on the lane's verdict.

### Port inventory

Paths are relative to `.repos/vitest-agent` at `1cf1ab94`.

| Upstream | Disposition |
| --- | --- |
| `.repos/vitest-agent/packages/sdk/src/utils/classify-test.ts:11-26` | port into the model, rules as above |
| `.repos/vitest-agent/packages/engine/src/layers/HistoryTrackerLive.ts:13-41` | port; window becomes configuration |
| `.repos/vitest-agent/packages/engine/src/services/HistoryTracker.ts:26` | port; key becomes the series key |
| `.repos/vitest-agent/packages/engine/src/utils/persist-transaction.ts:175`, `.repos/vitest-agent/okf/invariants/persist-transaction-no-yield.md` | port the invariant |
| `.repos/vitest-agent/packages/engine/src/layers/DataStoreLive.ts:217,458`, `DataReaderLive.ts:498,711-730` | read for invariants; the second flaky rule is replaced |
| `.repos/vitest-agent/packages/engine/src/migrations/0003_run_retention.ts:92-155` | read for the retention invariant; result tables only |
| `.repos/vitest-agent/packages/engine/src/utils/resolve-project-key-from-cwd.ts:17-38` | read for the repository-key canonicalization |
| `.repos/vitest-agent/okf/decisions/31-deterministic-xdg-path-resolution.md:117-125` | read; one file shared by worktrees is kept, the shared window is not |

The ported code lands in packages core creates, which already carry the dual-copyright MIT
`LICENSE` (beep-effect and C. Spencer Beggs) and the README `Provenance` and `Attribution`
sections. This goal adds its upstream files to that `Attribution` list. The porting order and
style conversions are core's (`goals/gate-report-core/SPEC.md`, "Porting order and style").

## Acceptance Criteria

- [ ] **AC-H1 Partition.** In one store, a red on branch A never changes a label or a delta on
  branch B; a test writes both branches and reads each.
- [ ] **AC-H2 Labels.** A table test covers each label and the no-label case with the exact rule
  above, including a retried pass, a red already on main, and a failure with neither baseline nor
  lane evidence.
- [ ] **AC-H3 One flaky rule.** A fail and a pass on one input fingerprint label `flaky`; a fail
  and a pass on two inputs do not. The label, the history queries and the quarantine
  reconciliation call the same function.
- [ ] **AC-H4 `recovered` holds one run.** After red, green, green, only the first green item is
  `recovered`.
- [ ] **AC-H5 Window as configuration.** With `W = 3`, the reader and the retention both keep three
  observations per series per branch.
- [ ] **AC-H6 Delta.** A re-run of a fixture prints the exact fixed, still-failing and new counts;
  a re-run over fewer units prints `(scope differs)`; a green re-run after a red carries the
  `fixed` suffix on its one line.
- [ ] **AC-H7 Red on main.** A failure red in main's hosted report at the lane's merge base is
  labelled `red-on-main`; a local run on `main` never is the baseline; the ancestor fallback names
  its distance.
- [ ] **AC-H8 Degrade.** With a locked, unreadable or slow store, the console renders without
  labels, names the cause in one line, keeps the verdict first and last, and the exit code is
  unchanged.
- [ ] **AC-H9 Concurrency.** Twelve writer processes open a missing store file at once and each
  records 25 runs; the store then holds 300 runs, each readable, and no writer fails untyped. The
  test runs at normal priority with bounded work.
- [ ] **AC-H10 Replay.** Ingesting a restored record twice adds nothing, and a Turbo cache hit
  prints the same labels and delta as the run it replays.
- [ ] **AC-H11 Quarantine.** Replaying a flake-quarantine incident fixture labels the check item
  `flaky`, and the quarantine's verdict for the lane is unchanged.
- [ ] **AC-H12 Boundaries.** The library's manifest declares `@beep/sqlite` as its only driver; the
  Vitest adapter's import graph does not reach the store module.
- [ ] **AC-H13 Queries.** The planned `gate` command family lists a subject's history and shows
  one item's series by branch.
- [ ] `bun run beep quality package-verify` passes for every touched package.
- [ ] When `goals/agent-output-census` has landed, the census rows for log digs per run and turns
  per verdict are cited before and after in `history/`.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| History tests | the `AC-H1` to `AC-H13` tests in the model and library packages | All pass |
| Package gates | `bun run beep quality package-verify <@beep/package>` for each touched package | Passes |
| Concurrency | the twelve-writer test (`AC-H9`) | 300 runs, no untyped failure |
| Driver boundary | `jq '.dependencies' packages/tooling/library/repo-gate-run/package.json` | `@beep/sqlite` is the only driver |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |
| Packet launcher size | `test "$(wc -m < goals/gate-run-history/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/gate-run-history/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/gate-run-history` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add gate-run-history --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug gate-run-history`; add a `kind: decision` file there, never edit this block._

### History is read through files and repo CLI commands, never MCP or hooks, 2026-11-18

History is reached through the planned `gate` command family on the repo CLI: list a subject's history, show one item's series by branch, import main's hosted baseline. Labels and the delta appear in the console the record renders. No MCP tool and no hook is added to any harness. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `agent-surface`.

Lane explore/agent-verification-output

Reverse: Add an MCP tool over the history store in a new goal

### The fix-loop delta is computed here; core renders it, 2026-11-18

Of the four enhancements the operator chose, this goal owns the fix-loop delta: a re-run on a lane reports fixed, still failing and new counts against the lane's previous run of the same gate and subject, over the units both runs checked. goals/gate-report-core renders the line from the history slot; a cache replay renders the same delta as the run it replays. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `core-enhancements`.

Lane explore/agent-verification-output

Reverse: Remove the delta from the history service and the console slot

### Labels compare against the lane's own runs and main's hosted results, 2026-11-18

Every run is recorded with its branch, and the series key is gate, subject, item key and branch. A failure is labelled against two series: the lane's own earlier local runs, and main's hosted report at the lane's merge base (local runs on main never serve). Output distinguishes a failure introduced on the lane from one already red on main, and a red on one lane never relabels another. Upstream's one history shared by every worktree and branch is replaced by this partition. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `history-baseline`.

Lane explore/agent-verification-output

Reverse: Drop the main baseline and label from lane history alone

### The delta's scope differs when the unit sets differ; a green run shows only its fixed count, 2026-11-20

RunDelta gains scopeDiffers (default false), set when the two runs' checked unit sets are not equal; only units both checked are counted. An item skipped or warned now is not fixed, since it neither passed nor is absent; an item skipped or warned before that fails now counts as new, because the earlier run did not see it fail. The red delta line ends with (scope differs) then. Core rendered a green run's delta as '; since last run: F fixed, 0 still failing, 0 new'; the SPEC asks for '(F fixed since last run)' and only when F > 0, so the plain-text projection now renders that suffix, with ', scope differs' inside the parentheses when the scopes differ, and nothing when a green run fixed nothing.

Lane goals/gate-run-history-lane

Reverse: Render the full delta phrase as the green verdict suffix again and drop scopeDiffers from RunDelta.

### Task-path history is automatic outside Vitest, with an off switch and a file override, 2026-11-20

The SPEC says the store is never opened inside a Vitest process. The CLI's automatic history setting therefore resolves no store when VITEST is set; BEEP_GATE_HISTORY=off (or 0, false, no) turns history off anywhere, and BEEP_GATE_HISTORY_FILE names another store file. The Vitest rule comes first, so a named file does not turn the automatic setting on inside Vitest; only an explicit HistoryAt setting does. Tests pass an explicit HistoryAt setting with a file and scope instead of touching the environment. A detached checkout records under detached@<sha>, so it never joins a branch's series. Resolution never fails a gate run: outside a git checkout or without a state directory there is no history.

Lane goals/gate-run-history-lane

Reverse: Drop the VITEST check and the two BEEP_GATE_HISTORY variables and always resolve the store from git and XDG.

### P1 to P3 ship first; the hosted-main baseline waits for the ci-gate-reports carrier, 2026-11-20

On 2026-11-20 goals/ci-gate-reports has not started, so no hosted report reaches a lane. Lane history, the labels that need only lane evidence, the delta, the queries and the quarantine reconciliation ship in a first pull request. Until the carrier exists the main baseline is absent, red-on-main is never emitted, introduced-on-lane rests on lane evidence, and the console says once that there is no main baseline. P4 and AC-H7 follow in a second pull request once ci-gate-reports uploads reports, and the goal closes with that one.

Lane goals/gate-run-history-lane

Reverse: Hold the whole goal until the carrier exists and ship it as one pull request.

### Warned and skipped items are no observation, and a retried pass is labelled flaky, 2026-11-20

The SPEC names two observed outcomes, passed and failed, and leaves warned and skipped items open. A warned diagnostic is not a failure and a skipped test did not run, so neither records an observation and neither gets a label. A warned diagnostic is still reported, so its key is not absent and no passed observation is added for it. The flaky rule is applied before the outcome split, so a passed item whose attempts disagree on one input (a retried pass) is labelled flaky; a passed item otherwise gets recovered only when the newest lane observation failed. This is what AC-H2's retried-pass row needs and what the quarantine reconciliation expects.

Lane goals/gate-run-history-lane

Reverse: Record warned items as passed observations and label only failed items flaky in classifyItem.

### A quarantine incident is one check run whose item failed then passed; repo-gate-run coverage runs under Bun, 2026-11-20

Each flake-quarantine incident becomes one check report for the package whose one item, DiagnosticKey(file = package, code = TS2589, shape = 'no location'), has attempts failed then passed on the incident's own input fingerprint (run id quarantine-<lane>-<task>-<detectedAt>). The one flaky rule labels it flaky; recording returns nothing, so the quarantine stays the authority on the lane's verdict. The report covers one item of the package's check, so it is recorded with a partial scope: it is never the run a real check's delta compares with, and it adds no passed observation for the package's other known diagnostics. The SQLite store's tests need bun:sqlite, so @beep/repo-gate-run's coverage script runs vitest under Bun, as @beep/agent-memory-store's does; the suites skip under Node.

Lane goals/gate-run-history-lane

Reverse: Record incidents as two separate runs, and return the coverage script to Node with the SQLite suites skipped.

### A lock wait while opening or reading is capped at the read deadline; only writes wait the busy timeout, 2026-11-20

bun:sqlite waits on a lock synchronously, so an Effect deadline cannot interrupt a busy wait. The store therefore opens and reads with PRAGMA busy_timeout set to the read deadline (250 ms), raises it to the write timeout (5 s) only before a write transaction, which runs after the console was printed, and checks PRAGMA user_version before taking the migration's write lock, so an open of a current schema never waits on a writer. In WAL mode a reader is never blocked by an ordinary writer; an exclusive-mode holder makes a read fail open-busy. The 250 ms caps each SQLite lock wait, not a whole open and read: opening and migration retry open-busy with backoff. A gate run reads under its own deadline over the whole answer, so its console never waits longer; gate history and gate series have no such deadline and can take several lock waits under contention. A failed open is not remembered: the next use, such as the write after the console, opens again. A failed read is reported with reason open-failed, the closed domain having no read reason; read-deadline is left to the gate run's own deadline, which renders 'no answer within 250ms'.

Lane goals/gate-run-history-lane

Reverse: Open every connection with the driver's 5 s busy timeout for reads and writes alike.

### The history store is the gate-run library's one driver dependency, loaded by dynamic import, 2026-11-20

@beep/repo-gate-run depends on @beep/sqlite for the history store only, as a narrowly scoped operational adapter, the same edge @beep/agent-memory-store holds. The store module is a separate entry that loads the driver with a dynamic import, as the memory store does, so the rest of the library still loads under Node and the Vitest adapter's import graph never reaches bun:sqlite. A boundary test asserts both.

Lane goals/gate-run-history-lane

Reverse: Move the store into its own tooling library that owns the driver edge.

### The store is one SQLite file per repository, keyed by the origin URL, 2026-11-20

The file is gate-history/<repository-key>.sqlite under the beep state directory from @beep/xdg AppDirs. The key is the canonical origin URL written as host__owner__repo, lower-cased, with the .git suffix and any credentials dropped, and an underscore of the URL written as _u so no two origins share a key; a repository with no origin takes a digest of the real path of its git common directory. Upstream derives its key from the package manifest's repository field and falls back to the directory name; the origin URL is used here because every clone and worktree of this repository shares it and a worktree's directory name does not identify the repository.

Lane goals/gate-run-history-lane

Reverse: Key the file by the checkout path and accept one history per clone.

### The window is 10 runs, the read deadline 250 ms, and open contention retries 5 times from 50 ms, 2026-11-20

The window W is 10 observations per series per branch, for the reader and for retention alike. Runs are kept newest 200 per gate, subject and branch. The label and delta read runs under core's existing deadline constant, 250 ms. A busy open or a contended migration retries on a jittered exponential schedule, 5 attempts from 50 ms. These are the spec's values; nothing in the upstream sources or the driver argues for others.

Lane goals/gate-run-history-lane

Reverse: Change the defaults in the history configuration schema; they are configuration, not constants.

### A run keeps the answer it rendered, and its id is kept for good, 2026-11-22

A replay must render what the original run rendered, but the window and the run retention drop the evidence that answer came from. Schema version 2 adds gate_history_ingested, one row per run id ever ingested, with the branch and the labels, delta and baseline line the console showed. A replay on the same branch is answered with that row; on another branch it is answered from that branch, so AC-H1 still holds. A run whose console had no answer (a read past its deadline) keeps the answer read at ingest, or none, and is then answered afresh.

The same table decides a replay, so a run id ingested before adds nothing even after its run row was pruned. The table is not pruned: a row is the run id, the branch and the labels of the items that had one, typically under a kilobyte, so ten thousand runs take under ten megabytes. Version 1 stores are migrated from the run ids their rows still hold, with no kept answer.

Reverse: Drop gate_history_ingested, recompute the answer of a replay from the retained window, and judge a replay by the run row alone.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
