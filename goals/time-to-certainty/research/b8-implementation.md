# B8 implementation — heavy-check admission

Lane reports for the stages of `goals/time-to-certainty/research/b8-brief.md` (rulings 50–57).
Worktree `ttc-b8`, branch `ttc/b8-heavy-admission`, stacked on B7. No git writes by the lanes.

## Stage A

Stage A lane, 2026-09-16 (Fable subagent, medium reasoning). Everything below is uncommitted in
the worktree; the orchestrator stages by name.

### Files touched

New:

- `packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts` — the schemas and the pure
  decision: `HEAVY_ADMISSION_LABEL`, `HEAVY_CONTEXT_PREFIX`, `HeavyAdmissionSource`,
  `HeavyAdmissionVerdict`, `HeavyAdmissionEventName`, `HeavyAdmissionEvent`, `HeavyAdmission`,
  `heavyDocsOnlyPattern` + `isHeavyDocsOnlyPath`, `decideHeavyAdmission`, the minimal
  `GhPullRequestEventPayload`, `HeavyAdmissionReadInput`, `readHeavyAdmissionChangedPaths`
  (fetch base like `heavy.yml`, then `git diff --name-only origin/<base>...HEAD` through the
  injectable repo capture), `readHeavyAdmissionEvent`, the two renderers
  (`renderHeavyAdmissionGithubOutput`, `renderHeavyAdmissionSummary`), and
  `heavyAdmissionSchemasForTesting`. Imports only `@beep/schema`, `effect`, the repo-run
  capture and `Ci.errors.ts`, so `Yeet/internal/Settle.ts` can import it as a leaf.
- `packages/tooling/tool/cli/src/commands/Ci/CiAdmission.ts` — the `ci admission` subcommand:
  `CiAdmissionInput`, `HeavyAdmissionJson`, `runCiAdmission(input, capture)` (prints JSON or
  the `--no-json` summary, appends `verdict=`, `admitted=`, `docs_only=`, `sources=` to the
  resolved `$GITHUB_OUTPUT`), flag/env resolution (`--event-name`/`--event-path` over
  `GITHUB_EVENT_NAME`/`GITHUB_EVENT_PATH`, `--base`, `--json` default on, `--github-output`).
  Exit 0 for every verdict; `CiCommandError` → `failWithReportedExit` only for unreadable inputs
  (no event name, unknown event name, missing/undecodable payload, unsafe base, failed diff,
  `--github-output` without `GITHUB_OUTPUT`).
- `packages/tooling/tool/cli/test/ci-heavy-admission.test.ts` — 10 tests (5 round-trips, the
  decision table, a property test, the docs-only rows, the renderers, the reader, the command).

Modified:

- `packages/tooling/tool/cli/src/commands/Ci/Ci.command.ts` — registers `ciAdmissionCommand`
  and lists it in the `ci` help.
- `packages/tooling/tool/cli/src/commands/Ci/index.ts` — re-exports `CiAdmission.ts` and
  `HeavyAdmission.ts` (tests and doc examples import through `@beep/repo-cli/commands/Ci`; there
  is no separate Ci test-kit, matching `ci-command.test.ts`).
- `packages/tooling/tool/cli/src/commands/Yeet/internal/CheckOutcome.ts` — `YeetSettleReason`
  gains `heavy-not-admitted` with docs.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Settle.ts` — `YeetGatedContextFamily`,
  `yeetGatedFamiliesFor` (folds `Heavy / ` members out of the expected set, `admittedBy` =
  `HEAVY_ADMISSION_LABEL`), `gated` on the census (default `[]`), `families` + optional
  `admission` on `YeetSettleInput`, `admission` on `YeetSettleVerdict`, the gating in
  `deriveSettleVerdict`, `yeetSettleVerdictIsHeld`, the gate-line renderer, and
  `yeetSettleSchemasForTesting` + `yeetSettleStampFor` docs.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts` — `labels` added to the
  `gh pr view --json` field list, to the private `GhStatusPullRequest` (array of `{name}`,
  default `[]`), and to `YeetStatusRemote` (array of names, default `[]`; legacy snapshots still
  decode).
- `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts` — `MonitorHeadState`
  gains `settleClockMs`, `families`, `changedPaths`, `admission`; `readChangedPaths` (once per
  head through `options.capture`, like `readPushedAt`; a failed read yields `[]`, whose only
  possible verdict is `hold`, never `skip-satisfied`); admission re-decided every poll from the
  snapshot's labels + draft + the head's diff with `eventName: "pull_request"`; a verdict flip
  logs `[yeet] heavy admission: <from> → <to>` and resets the settle clock; families + admission
  flow into `YeetSettleInput`; a held head sleeps the full poll interval instead of racing the
  exhausted budget. Exit-code table untouched.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts` — `YeetSettleChanged`
  gains `gated` (default `[]`), populated from the census.
- `packages/tooling/tool/cli/test/yeet-settle.test.ts` — the B8 fixture rows, the family fold,
  the widened property test, the labelled timeout loop (fixture 2), the held → labelled → ready
  loop (fixture 6), `labels` through `gh pr view` and on legacy decode, and the per-head capture
  count (2 → 4: push time + merge-base diff per head).
- `standards/effect-vitest.inventory.jsonc` — `bun run beep lint effect-vitest --write`
  (6 judgment-class entries for the new file, 2 line moves in the settle test).

### Decision table (implemented and tested)

`decideHeavyAdmission` is total over `HeavyAdmissionEvent`:

| event         | label | draft | docs-only diff | verdict          | sources         |
| ------------- | ----- | ----- | -------------- | ---------------- | --------------- |
| pull_request  | no    | any   | no             | `hold`           | `[]`            |
| pull_request  | no    | any   | yes            | `skip-satisfied` | `[]`            |
| pull_request  | yes   | any   | any            | `run`            | `["label"]`     |
| push          | any   | any   | any            | `run`            | `["main-push"]` |
| merge_group   | any   | any   | any            | `run`            | `["merge-group"]` |

`docsOnly` = `pull_request` with a non-empty diff where every path matches
`heavyDocsOnlyPattern`; an empty diff is never docs-only. `admitted` = `verdict === "run"`.
`draft` is carried, never admits. The property test checks these invariants over generated
events (60 runs).

`heavyDocsOnlyPattern` =
`^(goals/(INDEX|README)\.md|goals/[^/]+/(GOAL|PLAN|README|SPEC|DECISIONS)\.md|goals/[^/]+/ops/manifest\.json)$|^docs/|^explorations/|^research/|^\.changeset/[^/]+\.md$|\.md$`
— the `goals_document_pattern` of `scripts/ci-change-profile.sh` verbatim plus the four
widenings. Rows tested include `goals/x/scripts/run.sh` (code), `goals/x/ops/fixtures.json`
(code), `packages/a/README.md` (docs), `.changeset/config.json` (code), `docs/assets/diagram.svg`
(docs), `packages/a/src/index.md.ts` (code).

Settle rule under admission (`deriveSettleVerdict`):

| admission        | gated family members            | census                                 | reason order                                                      | timeout   |
| ---------------- | ------------------------------- | -------------------------------------- | ----------------------------------------------------------------- | --------- |
| `None` / `run`   | ignored                         | B7 unchanged                           | registration → required-pending → settled                         | B7        |
| `skip-satisfied` | ignored                         | B7 unchanged; `skip` outcomes settle   | as B7; gate line appends `heavy: docs-only, lanes pass without work` | B7        |
| `hold`           | leave `missing`/`pending` → `gated` (members and their matrix children) | registration → required-pending (non-gated open) → heavy-not-admitted (only gated open) → settled | skipped while gated is non-empty; `waitedMs` still reported |

Gate lines:

- hold, only gated open: `settle: heavy-not-admitted; gated: Heavy / Check, Heavy / Docgen;
  admit: gh pr edit --add-label ready-for-heavy; waited 5s (not counted toward the 1s settle
  timeout)`
- hold, non-gated still open: `settle: required-pending; pending: Lint; gated: …; admit: …;
  waited … (not counted toward …)`
- skip-satisfied, settled: `settle: settled; closeout bound; heavy: docs-only, lanes pass
  without work`

`yeetSettleStampFor(heavy-not-admitted)` is `None`; `yeetSettleVerdictIsTerminal` is unchanged
(`settle-timeout` only).

### Verification (what ran, from inside the worktree)

All commands wrapped as `zsh -ic '…'` from the worktree root; the zle/gitstatus noise omitted.

- `bunx turbo run check --filter=@beep/repo-cli` — PASS (run 4 times; final:
  `Tasks: 33 successful, 33 total`, `EXIT 0`). First run failed on two
  `TS377118 … Effect.fromOption expresses this Option-to-Effect conversion more directly` hits
  in the new files; fixed.
- `node node_modules/.bin/vitest run --pool=forks <six suites>` — PASS:
  `Test Files 6 passed (6) / Tests 147 passed (147)` (ci-heavy-admission, yeet-settle,
  yeet-monitor-ready, yeet-watch-stream, yeet-watch-mode, ci-command).
- `bunx --bun vitest run <six suites>` — PASS: `6 passed / 147 passed`.
- `bun run beep lint effect-vitest --write` then `bun run beep lint effect-vitest` — PASS:
  `files=1125 findings=8430`, `introduced=0 resolved=0`, `EXIT 0`.
- `bun run beep lint circular` — PASS: `No circular dependencies found.`
- `bun run beep lint schema-first` — PASS after adding the property test (first run raised one
  `SFV4-arbitrary-tests` advisory on the new test file: "3 Schema codec assertions but no
  schema-derived property coverage"); final: every advisory counter 0, `EXIT 0`.
- `bun run beep lint tooling-schema-first` — FAIL, inherited: 289 pre-existing findings
  (`pascal-case-file`, `export-interface`, `tagged-union-pattern`, `service-id`), none on the
  touched files; the same command exits 1 on the clone's `main`.
- `bun run docgen:local` — PASS on the second run (`Tasks: 1 successful`, `EXIT 0`). First run:
  `docs/examples/src-commands-Ci-CiAdmission.ts-constant-HeavyAdmissionJson-0.ts(4,32): error
  TS2339: Property 'encodeSync' does not exist on type 'JsonStringCodec<…>'` — my example; fixed
  to the codec's `encode` effect.
- `bunx biome check --write <11 touched files>` — clean (`Fixed 6 files`, then `No fixes
  applied`); `bunx oxlint --quiet --disable-nested-config <same files>` — clean.

Not run (left for the orchestrator's proof): `bun run beep quality test-tsgo`, scoped lcov,
`bun run beep quality package-verify @beep/repo-cli`, Fallow, the full `bun run docgen`.

### Blockers and deviations from the brief

1. **`--watch` (`WatchMode.ts`) is not admission-aware.** The brief's loop paragraph says the
   watch stream "streams `settle-changed` when the reason flips"; the event schema now carries
   `gated`, but `WatchMode`'s own settle still runs the B7 input (no families, no admission), so
   a held head under `--watch` reports `missing` and can still `settle-timeout`. Reason: the
   watch reads its own `gh pr view` (no `labels`) and needs a merge-base diff spawn per head,
   and `yeet-watch-mode.test.ts`'s scripted spawner routes every unrecognised command to the
   threads script (consuming a poll index), so wiring a `git diff` there means reworking that
   1.6k-line harness. `--until-ready` (the recipe AGENTS.md names) is fully wired. Follow-up: add
   `labels` to `WatchPullRequestView`, a `changedPathsRead` seam on `runYeetWatchStream`, and a
   `git diff` branch in the scripted spawner.
2. **`held` requires gated contexts, not merely `admission === hold`.** The brief says the
   timeout comparison is skipped "while the verdict is `hold`". Implemented as hold AND
   `census.gated` non-empty. Otherwise an unlabelled code PR whose ruleset read failed (fallback
   census, no families) or whose ruleset has no `Heavy / *` context would never time out on an
   unrelated never-registering context — the exact hole B7's timeout closes. With a heavy
   family present the two definitions coincide.
3. **Command lives in `CiAdmission.ts`, not `HeavyAdmission.ts`.** Keeps the module Settle
   imports free of `effect/unstable/cli`, `findRepoRoot`, and Config; both are exported from the
   `Ci` barrel.
4. **The monitor's merge-base diff does not fetch.** `origin/<base>...HEAD` on the local
   remote-tracking ref is a merge-base diff, so a stale ref still yields the head's own changes;
   only the CI reader fetches (shallow checkout). A failed diff read yields `[]` → `hold`.
5. **Extra log line** `[yeet] heavy admission: hold → run` on a verdict flip (the settle-reason
   line `[yeet] settle: heavy-not-admitted → settled` still fires as before).
6. **Existing timing test re-labelled.** "ends exactly at timeout…" now feeds a labelled head
   (it is the brief's fixture 2: admission `run` → `missing` → `settle-timeout`); without the
   label it would hold forever by design. Its per-head capture count is 4 (push time + diff ×
   2 heads).
7. **`YeetSettleChanged.gated`** is populated only where `deriveSettleVerdict` sees families,
   i.e. today only through the monitor loop's verdict (see 1).

### Friction receipts

- **Schema defect inside the forked loop is invisible.** `YeetMergeReady.make({ ready: false,
  …, failing: O.none() })` in a test fixture dies with `Schema validation failed` inside
  `pollUntilMerged`; the loop fiber dies silently and the test only shows
  `expected 1 to be 3` on the poll counter. Cost: five runs with ad-hoc `Effect.tapCause`
  scaffolding to surface `YeetMergeReady.make … Schema validation failed`. Prevention: export a
  `mergeReadyFor(criteria)` fixture from the Yeet test-kit (the monitor-ready test hand-rolls
  the same `A.findFirst(YeetMergeReadyCriterion.Options, …)`), and have
  `runYeetMonitorUntilMerged` tests assert on `Fiber.join`/`Effect.exit` before poll counts.
- **`TestConsole` is shared across `it.layer` tests.** The held-loop test failed only in the
  full file: `expect(lines).not.toContain("settle-timeout")` saw the previous test's
  `[yeet] settle-timeout` line. Passes in isolation (`-t "holds an unlabelled"`). Cost: three
  runs. Prevention: a `TestConsole` line cursor helper in `@beep/test-utils` (read
  `A.length(logLines)` first, `A.drop` later), or a note in the effect-vitest canon that
  `it.layer` shares the console.
- **`Fiber.poll` is not an Effect in v4** (`yield*` on it throws "is not iterable"); debugging
  only, one run lost.
- **tsgo effect rule TS377118** wants `Effect.fromOption(option, onNone)` over `O.match` with
  `Effect.fail`; two hits, one rerun of `turbo run check` (~6s cached). Cheap, but the rule is
  not in the "known traps" list of the lane prompt.
- **`JsonStringCodec` has no `encodeSync`**; the doc example cost one `docgen:local` rerun
  (42s). Prevention: the codec's JSDoc could name its three members in the interface lead.
- **`tooling-schema-first` is red on `main`** (289 inherited findings); it cannot serve as a
  gate for this lane and had to be attributed by running it on the clone (`~/YeeBois/projects/
  beep-effect`) too.
- **zsh `=word` expansion**: `echo ====CI_CMD` inside the Bash tool fails with
  `===CI_CMD not found` because zsh expands `=cmd` to a path; quote such separators. One round
  trip.
- `zsh -ic` prints ~12 lines of `can't change option: zle` / `gitstatus failed to initialize`
  per invocation (known); every log had to be ANSI-stripped and grep-filtered to read.

### Stage A follow-up (--watch)

Closes deviation 1 above: `yeet monitor --watch` now computes heavy admission from the same
function as CI and the `--until-ready` loop, so rulings 54/55 hold for both loops.

Files:

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Settle.ts` — `readYeetChangedPaths`
  (the once-per-head merge-base diff, exported and shared; a failed/truncated read yields `[]`,
  whose only verdict is `hold`).
- `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts` — its private reader
  replaced by the shared `readYeetChangedPaths` (behaviour unchanged, same `options.capture`).
- `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts` — `YeetWatchSnapshot`
  gains `labels` (default `[]`); `YeetSettleChanged.gated` was already added in Stage A.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchMode.ts` — `labels` on the watch's
  `gh pr view --json` field list and on the private `WatchPullRequestView` (array of `{name}`,
  default `[]`, so old fixtures decode); `WatchSettleState` gains `settleClockMs`, `families`
  (from `yeetGatedFamiliesFor(expected)`), `changedPaths`, `admission`; `runYeetWatchStream`
  gains the `changedPathsRead` seam (default `readYeetChangedPaths`, read once per head);
  admission re-decided every poll from `snapshot.labels` + `!criteria.notDraft` + the head's
  diff, a flip logs `[yeet] heavy admission: <from> → <to>` on stderr and resets the settle
  clock; families + admission flow into the watch's `YeetSettleInput`; a held head sleeps the
  full interval. The `settle-changed` row streams on the reason flip through the existing diff
  and carries `gated`.
- `packages/tooling/tool/cli/test/yeet-watch-mode.test.ts` — `viewJson`/`greenScript` take
  `labels`; the scripted spawner answers `git diff --name-only …` by argv prefix from a
  per-layer `diff` string (default `packages/a/src/index.ts`) without consuming a poll index;
  the B7 timeout test now labels its heads (an unlabelled head holds by design); three new
  tests under `B8 watch heavy admission`.

Tests added (all `it.live`, scripted spawner, injected `now`):

1. held head never reaches `settle-timeout`: four unlabelled polls span 1.5s against a 1s
   budget, the gate line reads `settle: heavy-not-admitted; gated: Heavy / Check; admit: gh pr
   edit --add-label ready-for-heavy; waited 1s 500ms (not counted toward the 1s settle
   timeout)`, no `settle-changed` row, the stream ends on the merged view.
2. label lands: two held polls (2s each, past the budget), then the labelled view with
   `Heavy / Check` passing → exactly one `settle-changed` row
   `{ from: "heavy-not-admitted", to: "closeout-pending", gated: [] }`, stderr carries
   `[yeet] heavy admission: hold → run`, `changedPathsRead` called once, end `all-terminal`,
   exit success.
3. docs-only head: unlabelled, diff `docs/runbooks/ci.md` + `goals/…/PLAN.md`, `Heavy / Check`
   reported `SKIPPED` → settles on the first poll with the gate line ending
   `heavy: docs-only, lanes pass without work`, end `all-terminal`.

Verification (`zsh -ic`, worktree root):

- `bunx turbo run check --filter=@beep/repo-cli` — PASS (`33 successful, 33 total`).
- `node node_modules/.bin/vitest run --pool=forks` yeet-watch-mode + yeet-watch-stream +
  yeet-remediation — PASS `3 files / 90 tests`; yeet-settle + yeet-monitor-ready +
  ci-heavy-admission — PASS `3 files / 77 tests`.
- `bunx --bun vitest run` watch-mode + watch-stream + settle + monitor-ready +
  ci-heavy-admission — PASS `5 files / 145 tests`.
- `bun run beep lint effect-vitest --write` then check — PASS (`introduced=0 resolved=0`); the
  inventory records 2 `unjustified-live-test` + 2 `unresolved-layer-provide` judgment entries
  for the new watch tests, the same classes the sibling B7 watch tests carry.
- `bun run beep lint circular` — PASS. `bun run beep lint schema-first` — PASS (`EXIT 0`).
- `bun run docgen:local` — PASS (`Tasks: 1 successful`).
- `bunx biome check --write` + `bunx oxlint` on the five touched files — clean.

Deviation 2 (held = `hold` AND `gated` non-empty) is kept; deviation 1 is closed. Harness
rework stayed small: the spawner branch is four lines and no poll index is consumed.

## Acceptance (live, 2026-09-16, PR #1155)

- **Hold never times out.** Head `15a1e77a99`, unlabelled: `Heavy Admission=success`,
  `Heavy=skipped`, zero `Heavy / *` check runs, `mergeStateStatus: BLOCKED`. Tier 1 settled and
  `yeet monitor --until-ready` printed `settle: heavy-not-admitted; gated: Heavy / Check, Heavy /
  Docgen, Heavy / Doctest, Heavy / Lint Policy, Heavy / Test Integration; admit: gh pr edit
  --add-label ready-for-heavy; waited 30m 10s (not counted toward the 30m settle timeout)` —
  past the default budget with no `settle-timeout`.
- **The label admits within one poll.** `gh pr edit 1155 --add-label ready-for-heavy` at
  08:41:59Z; the next poll logged `heavy admission: hold → run` and `settle: heavy-not-admitted →
  required-pending; missing: Heavy / …; waited 0 of 30m` (clock reset). `Heavy Admit` run
  35075215936 started at 08:42:03Z; the Check run from 08:11 stayed `completed/success`, so the
  label neither cancelled nor re-ran tier 1.
- **`size/*` never triggers.** Head `8d87484c2f` received exactly one Check run although the
  pr-size job applied `size/L` mid-run (GITHUB_TOKEN events do not start workflows).
- **Main pushes always admit.** Push run 35066098614 after PR A ran all seven heavy lanes.
- **Docs-only skip, first probe failed the ruleset.** PR C #1164 (`explorations/github-merge-queue/`,
  head 434eed9762): `Heavy Admission=success` with `verdict=skip-satisfied`, heavy called with
  `admitted: false`, but the job-level `if:` skipped the matrix before expansion and GitHub
  reported one context, `Heavy / matrix.name: skipped`. The required `Heavy / Check`,
  `Heavy / Lint Policy`, `Heavy / Test Integration`, `Heavy / Docgen`, `Heavy / Doctest` stayed
  "Expected" and the PR was `BLOCKED`. Plan B (PR D): the verify job always runs, `runs-on`
  switches to `ubuntu-24.04` when not admitted, and `lane-gate` skips every step, so each
  context expands and passes without work. Proven only once PR D reaches `main` and #1164 is
  re-run against it.
- **Gap found and closed the same day.** A push after the label admits the new head through
  `check.yml` while the previous head's `Heavy Admit` matrix keeps running (concurrency groups
  do not cross workflows); the admission job now cancels superseded `Heavy Admit` runs for the
  ref (`actions: write`, `gh run cancel`).

