## Stage A

Implemented Stage A only. Acceptance is **not complete**: the requested full-file 100% coverage
floor remains unmet in four files; canonical package/type-check commands hit the sandbox shim
failure. No worktree git/index writes or graft commands. Branch: `ttc/b7-until-ready`.

- Merge loop caches ruleset results, including `None`, once per head; reads the commit date once
  per head; stamps and persists first-observed/settled/closeout/ready timeline observations.
- Status retains classified checks and required flags using its existing two check reads.
  The scripted collector test asserts exactly two check spawns. Legacy snapshots decode with `checks: []`.
- Each poll renders the settle detail; reason changes produce one transition line. Missing/pending
  names remain in the last timeout gate line. Poll sleeps are capped by the remaining settle budget.
- Watch caches rulesets per head, derives settle verdicts before diffing, emits `settle-changed`,
  and ends with failing `settle-timeout`. A visible terminal board cannot hide missing expected
  contexts. A settled required census does not time out while optional checks remain pending.
- `--settle-timeout` accepts positive finite durations (`30m`, `1h`, `90s`, spelled-out units),
  defaults to 30 minutes, and rejects plain monitor. `--until-ready` wiring remains Stage B.
- Tests cover generated schema round-trips, a 17-context rules payload with unrelated/duplicate
  rules, matrix-parent matching, outside required rows, fallback census, every settle reason,
  scripted ruleset failure/truncation, exact TestClock timeout, head reset, persisted timeline,
  one-rerun preservation, watch transitions, duration parsing, and route legality.

Decisions / rejected alternatives:

- Reused the binding settle evaluator; no third checks process, fixed census count, fuzzy context
  matching, automatic closeout, ready terminal, inbox publication, or Stage C exit-code changes.
- Used `S.suspend` for the watch snapshot's settle schema: `Settle.ts` already imports the watch
  outcome/reason domains. This defers the schema edge without moving the binding domains.
- Used `Arbitrary.schema` / `Arbitrary.sampleEffect`: neither the specified Effect v4 reference
  nor installed `effect/Schema` exports the brief's `S.toArbitrary`. Same generated round-trip proof.
- Clock tests use `it.layer` / `it.effect`, explicit clock reset, in-memory snapshot writes, and
  `TestClock.adjust`; this removes asynchronous filesystem scheduling from the boundary proof.
- Kept generated effect-vitest inventory output. It also refreshes stale entries outside B7;
  `--write` succeeded but does not mean all existing inventory findings are resolved.

Contract extensions / corrections:

- `YeetMonitorUntilMergedOptions`: `collectStatus`, `rulesetRead`, `closeout`, `policy`, `now`,
  and `capture`. `closeout` is forwarded but intentionally unused in Stage A. `capture` reuses
  the route's existing seam for deterministic commit-date reads without live gh calls.
- `YeetMonitorRouteDependencies.settleTimeoutMs` carries the parsed flag to both loops.
- `YeetStatusRemote.checks` defaults empty; `YeetWatchSnapshot.settle` defaults `None`;
  watch config gains `rulesetRead`, `settleTimeoutMs`, and `now`; end reasons gain `settle-timeout`.
- `yeetMonitorPolicyTerminals(until-merged)` now includes `settle-timeout`: the existing table
  omitted the terminal Stage A / ruling 39 explicitly requires for that policy.
- Exported `yeetMonitorDurationMillis` through the test kit for parsing-table proof.

Orchestrator fixes after the lane (2026-09-16, before the Stage A commit): the `Settle.ts` →
`WatchStream.ts` import cycle the lane closed with `S.suspend` is broken by moving
`YeetCheckOutcome` and `YeetSettleReason` into the leaf `CheckOutcome.ts`; the two inline object
contracts the schema-first lint flagged are replaced by `YeetRulesetRulesPayload` and by deleting
`yeetSettleCheckFrom` (callers use `YeetSettleCheck.make`); three inline `S.decodeEffect` compiles
are hoisted to module scope (oxlint `no-inline-schema-compile`); the settle test gains an
`it.prop` schema-derived property over `YeetSettleInput` (schema-first `SFV4-arbitrary-tests`).
The Bun default-pool run that stalled in the sandbox passed in the orchestrator environment
(10 suites, 248 tests).

### Stage A — files

- `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorPolicy.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Porcelain.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchMode.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts`
- `packages/tooling/tool/cli/src/test/Yeet.test-kit.ts`
- `packages/tooling/tool/cli/test/yeet-settle.test.ts` (new)
- `packages/tooling/tool/cli/test/yeet-watch-mode.test.ts`
- `packages/tooling/tool/cli/test/yeet-watch-stream.test.ts`
- `packages/tooling/tool/cli/test/yeet-command-wiring.test.ts`
- `standards/effect-vitest.inventory.jsonc` (generated)
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/b7-implementation.md`

### Verification

Vitest cwd: `packages/tooling/tool/cli`. `SUITES` means these seven explicit arguments:
`test/yeet-settle.test.ts test/yeet-watch-mode.test.ts test/yeet-watch-stream.test.ts
test/yeet-command-wiring.test.ts test/yeet-monitor-loop.test.ts test/yeet-status-triage.test.ts
test/yeet-provenance-footer.test.ts`.

`COMPILER` below is the root-relative installed artifact
`node_modules/@effect/tsgo-linux-x64/artifacts/typescript/7.0.2/tsc`.
Other commands run from the worktree root. Logs are local scratch evidence, not staged files.

| Command | Runtime | Exit | Coverage / result |
| --- | --- | ---: | --- |
| `bunx vitest run $SUITES` | Node | 0 | 7 suites / 221 tests; `/tmp/b7-node-final.log` |
| `bunx --bun vitest run $SUITES` | Bun default pool | 130 | Startup banner only; interrupted; no passing evidence |
| `timeout 120s bunx --bun vitest run $SUITES --pool=threads` | Bun threads | 0 | 7 suites / 221 tests; `/tmp/b7-bun-final3.log` |
| Scoped lcov command below | Node / V8 | 1 | All 221 tests pass; 100% per-file coverage gate fails; 90.31% aggregate lines |
| `$COMPILER -p packages/tooling/tool/cli/tsconfig.check.json` | Effect native compiler | 0 | Source check; `/tmp/b7-source-final.log` |
| `$COMPILER -p packages/tooling/tool/cli/test/tsconfig.json --rootDir .` | Effect native compiler | 0 | Test-source check; `/tmp/b7-test-typecheck-final.log` |
| `bunx turbo run check --filter=@beep/repo-cli` | Bun / Node shim | 1 | `spawnSync node EPERM`; no source-check verdict |
| `bun run beep quality package-verify @beep/repo-cli` | Bun / Node shim | 1 | Build passed; audit stopped at same shim failure before subsequent proof |
| `bun run beep lint effect-vitest --write` | Bun | 0 | Generated inventory; 8,395 findings remain repository-wide |
| `bunx biome check` over the 12 listed TS source/test paths | Bun launcher | 0 | No fixes required; `/tmp/b7-biome-final.log` |
| `git diff --check` | Git read-only | 0 | No whitespace errors |
| Broad `bunx vitest run test/yeet*.test.ts --coverage …` | Node / V8 | 130 | Interrupted before completion; no full-sweep proof |

Exact scoped coverage command:

```sh
bunx vitest run $SUITES --coverage \
  --coverage.include='src/commands/Yeet/internal/{Settle,MonitorPolicy,MonitorLoop,WatchMode,WatchStream,Status,Porcelain}.ts' \
  --coverage.include='src/commands/Yeet/Yeet.command.ts' \
  --coverage.reporter=lcov --coverage.reporter=text \
  --coverage.reportsDirectory=/tmp/b7-stage-a-final-coverage \
  --coverage.thresholds.lines=100 --coverage.thresholds.branches=100 \
  --coverage.thresholds.functions=100 --coverage.thresholds.statements=100 \
  --coverage.thresholds.perFile
```

Lcov: `/tmp/b7-stage-a-final-coverage/lcov.info`; log: `/tmp/b7-final-coverage3.log`.

| Source | Lines % | Branches % | Functions % | Statements % |
| --- | ---: | ---: | ---: | ---: |
| `Settle.ts` (binding module, unchanged) | 100 | 100 | 100 | 100 |
| `MonitorPolicy.ts` | 100 | 100 | 100 | 100 |
| `WatchStream.ts` | 100 | 100 | 100 | 100 |
| `WatchMode.ts` | 100 | 100 | 100 | 100 |
| `MonitorLoop.ts` | 96.55 | 93.02 | 95.08 | 96.89 |
| `Status.ts` | 85.49 | 67 | 75.23 | 83.94 |
| `Porcelain.ts` | 44.15 | 23.25 | 15 | 43.58 |
| `Yeet.command.ts` | 94.16 | 100 | 58.82 | 90.34 |
| `Yeet.test-kit.ts` | N/A | N/A | N/A | N/A — re-export only; lcov has zero executable lines |

### Blockers

1. Required full-file 100% coverage is **not met** in the four rows above. Includes existing
   command/remote/error paths and uncovered live-default seams; no waiver or completion claim.
2. Canonical Turbo check and package-verify require an orchestrator rerun because of the shim
   `EPERM`. Direct compiler passes are supporting proof, not a canonical-gate pass. The audit
   P0 was acknowledged once as environment-only through `yeet inbox ack` with this evidence.
3. Unmodified Bun launcher did not finish; the passing thread-pool run is explicitly supplemental.
4. Full repo lint, canonical test-tsgo, docgen, Fallow, and live PR smoke were not completed here.
   No push-to-ready measurement. No Stage B/C work, commit, publication, or merge-readiness claim.

## Stage B

Stage B code and tests are implemented. **Acceptance remains incomplete**: full-file 100%
coverage and the canonical package proof are not green; the Bun hook proof is blocked below.
Stage C is not started. No worktree git/index writes, graft commands, publication, or merge.

- One policy-driven loop performs automatic read-first closeout after settle, re-reads status,
  stamps completion/readiness, and emits a P1 ready row once per head. A head change writes a
  fix-sha receipt for the prior announced row and starts a fresh ruleset/timeline scope.
- `until-ready` exits on readiness or a required non-rerunnable/spent red. Exact expected
  contexts, tolerated matrix children, and GitHub required rows share one required-name predicate.
  Optional reds still receive job decisions. Awaiting-log/run decisions keep polling.
- Status and closeout failures share the five-consecutive-poll budget; a successful poll resets
  it. Failed closeout/reread retains head state. A head change during closeout cannot lend its
  prior census or timeline to the new head. Missing/pending names and required-red job names
  are printed on terminal-specific summary lines before the porcelain exit-table summary.
- `--until-ready` and `--settle-timeout` route to the same loop. Incompatible modes fail before
  hydration. Porcelain prints `yeetMonitorExitFor` and returns `CliReportedExit` for nonzero rows.
  Ready gate/summary explicitly prints `merge-ready: yes` and the final gate carries the timeline.
- Hook labels readiness as `P1 merge-ready [id] PR #n`, injects good-news context with the PR URL
  ack, and never treats it as a denial. Tests retain an unrelated stale remediation wave.

Decisions / rejected alternatives:

- Kept the existing loop name and seam; no duplicate ready-loop engine or thin wrapper needed.
  The default closeout remains `runYeetAutomaticCloseout`, which passes only
  `yeetAutomaticCloseoutOptions`. No new code calls merge, reply, resolve, or retrigger.
- Monitor-route legality stays in `yeetMonitorCommandRoute`: `Guards.ts` sees YeetRunOptions,
  which these monitor routes never construct. Rejected guard-layer duplication.
- Required matrix reds must block the readiness criterion before a row is emitted, even when
  GitHub omitted their required flag. Rejected trusting the narrower GitHub-required view for
  readiness while using the larger ruleset census for failure terminals.
- Tests cover registration/pending/closeout/ready with optional red; durable row dedup; fresh
  heads, fix-sha supersession and once-per-head announcements; required exact/matrix/outside reds;
  one rerun then spent; awaiting-log/run; closed and merged; exact timeout; error budget reset;
  closeout failure, issues, reread failure and concurrent push; all exit rows and route rejection.
  Existing Stage A red-loop fixture now supplies an explicitly head-bound closeout artifact.

Contract extensions / corrections:

- `yeetMonitorPolicyTerminals(until-ready)` includes `merged`: an operator merge during a
  readiness wait must terminate successfully and run the existing sweep seam once.
- `YeetMonitorRouteDependencies.policy` carries the chosen policy. Both touched loop runners
  expose dual forms; the route's `mergeLoop` seam retains its data-first callable signature.
  Porcelain's error channel now includes the required `CliReportedExit` sentinel.
- Loop-local `MonitorPoll` and `MonitorHeadState.announcedRow` retain typed failures and the
  receipt target. The loop binds census-backed red checks into `requiredChecksGreen` before
  persisting/stamping readiness, using the existing criterion helper for coherent schema values.
- Hook ready rows use monitor-owned ack receipts for supersession, independent of the remediation
  dispatch head; that head belongs to a different producer and can remain stale after a push.
- Test kit additionally exports `yeetMonitorCommandRoute` for the required JSDoc import surface.

### Stage B — files

- `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorPolicy.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Porcelain.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts`
- `packages/tooling/tool/cli/src/test/Yeet.test-kit.ts`
- `packages/tooling/tool/cli/test/yeet-monitor-ready.test.ts` (new)
- `packages/tooling/tool/cli/test/yeet-settle.test.ts`
- `packages/tooling/tool/cli/test/yeet-command-wiring.test.ts`
- `packages/tooling/tool/cli/test/yeet-provenance-footer.test.ts`
- `packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts`
- `.claude/hooks/yeet-inbox.sh`
- `standards/effect-vitest.inventory.jsonc` (generated)
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/b7-implementation.md`

### Stage B — verification

Vitest cwd: `packages/tooling/tool/cli`. `SUITES` means these six explicit arguments:
`test/yeet-monitor-ready.test.ts test/yeet-settle.test.ts test/yeet-command-wiring.test.ts
 test/yeet-provenance-footer.test.ts test/yeet-inbox-hook-adapter.test.ts
 test/yeet-monitor-loop.test.ts`. `NON_HOOK` omits only the hook adapter suite.
`COMPILER` is root-relative `node_modules/@effect/tsgo-linux-x64/artifacts/typescript/7.0.2/tsc`.

| Command | Runtime | Exit | Coverage / observed result |
| --- | --- | ---: | --- |
| `bunx vitest run $SUITES` | Node | 0 | 6 suites, 164 tests before final census-red strengthening; `/tmp/b7-b-node-final.log` |
| Final scoped lcov command below | Node / V8 | 1 | All 6 suites / 164 tests pass; full-file 100% floor fails; `/tmp/b7-b-last-coverage.log` |
| `timeout 90s bunx --bun vitest run $SUITES` | Bun default pool | 124 | Startup only; no passing proof; `/tmp/b7-b-bun.log` |
| `timeout 90s bunx --bun vitest run $SUITES --pool=threads` | Bun threads | 1 | 5 suites pass, hook suite fails; 26 subprocess-pipe EPERM errors; `/tmp/b7-b-bun-threads.log` |
| `timeout 90s bunx --bun vitest run $NON_HOOK --pool=threads` | Bun threads | 0 | Final 5 suites, 159 tests; `/tmp/b7-b-bun-last.log` |
| `$COMPILER -p packages/tooling/tool/cli/tsconfig.check.json` | Effect native compiler | 0 | Final source check; `/tmp/b7-b-source-last.log` |
| `$COMPILER -p packages/tooling/tool/cli/test/tsconfig.json --rootDir .` | Effect native compiler | 0 | Final test-source check; `/tmp/b7-b-tests-last.log` |
| `bun run beep quality package-verify @beep/repo-cli` | Bun / Node shim | 1 | Dependency build passed, audit hit `spawnSync node EPERM`; `/tmp/b7-b-package-verify.log` |
| `bun run beep lint effect-vitest --write` | Bun | 0 | Inventory regenerated; 8,403 repo-wide candidates; `/tmp/b7-b-effect-vitest-last.log` |
| `bunx biome check` over the ten listed TS paths | Bun launcher | 0 | Final paths clean; `/tmp/b7-b-biome-last.log` |
| `bash -n .claude/hooks/yeet-inbox.sh` | Bash | 0 | Syntax valid |
| `git diff --check` | Git read-only | 0 | No whitespace errors |

```sh
bunx vitest run $SUITES --coverage \
  --coverage.include='src/commands/Yeet/internal/{MonitorLoop,MonitorPolicy,Porcelain}.ts' \
  --coverage.include='src/commands/Yeet/Yeet.command.ts' \
  --coverage.include='src/test/Yeet.test-kit.ts' \
  --coverage.reporter=lcov --coverage.reporter=text \
  --coverage.reportsDirectory=/tmp/b7-b-last-coverage \
  --coverage.thresholds.lines=100 --coverage.thresholds.branches=100 \
  --coverage.thresholds.functions=100 --coverage.thresholds.statements=100 \
  --coverage.thresholds.perFile
```

Lcov: `/tmp/b7-b-last-coverage/lcov.info`. MonitorPolicy is omitted from the text summary
but its lcov section has 36/36 lines and 25/25 functions; no branch records.

| Source | Lines % | Branches % | Functions % | Statements % |
| --- | ---: | ---: | ---: | ---: |
| `MonitorLoop.ts` | 97.69 | 94.66 | 95.83 | 97.89 |
| `MonitorPolicy.ts` | 100 | N/A (0 branches) | 100 | N/A (lcov only) |
| `Porcelain.ts` | 47.50 | 24.44 | 19.04 | 47.56 |
| `Yeet.command.ts` | 94.40 | 100 | 62.16 | 90.72 |
| `Yeet.test-kit.ts` | N/A | N/A | N/A | N/A — re-export only, zero executable lines |

### Stage B — blockers

1. The full-file 100% floor remains a required, unmet gate. Uncovered surfaces include existing
   collector recovery/default seams, command handlers, and Porcelain sweep/merge/reply paths.
   No exclusions, threshold relaxation, or deletion of those paths to claim a pass.
2. Canonical package audit/check/docgen needs the orchestrator environment. The package audit P0
   was acknowledged as environment-only with the shim evidence; direct compiler passes do not
   replace canonical proof. Full repo lint, test-tsgo, docgen, and Fallow were not run here.
3. Default-pool Bun timed out. Bun threads passes the non-hook suites; the hook adapter fails
   in Node's subprocess stdin stream under Bun with EPERM, including three pre-existing tests.
   The v4 Bun spawner re-exports that shared Node implementation, so changing the layer is not a fix.
4. No live PR smoke or push-to-ready wall-clock measurement; no Stage C, commit, or hosted proof.
## Stage C

Implemented the Stage C required-only census, regression tests, and docs in the Stage C
worktree. Acceptance remains incomplete because the full-file coverage floor and canonical
package verification are not green. No git writes, graft commands, or Stage B file edits.

Decisions and rejected alternatives:

- A nonzero plain-monitor watch first retains the registration retry behavior, then reads
  `collectRemoteChecks(context, true)`. Required reds and unreadable required data keep the
  failure. Required pending rows retry the same fail-fast watch after a ten-second pause.
- Pending retries use the existing 30-minute settle default. The remaining deadline also wraps
  the retrying watch, so a hanging retry cannot outlive the bound. A sixth test-only argument
  on `runMonitorCheckWatchForTesting` injects the bound. Timeout reports pending check names
  and restores the last completed recorder snapshot if interruption happened during a retry.
- Once required rows are terminal and non-red, the all-check view names optional failures.
  Only observed optional reds justify replacing the recorder's failed exit code with zero.
  An unreadable all-check view or no optional failure evidence retains the failure. Prior recorder entries and watch command output stay intact.
- Exported the existing `collectRemoteChecks` with `dual(2, ...)`; the test kit exposes it as
  `collectRemoteChecksForTesting`. No additional check read was added to status collection.
- `countYeetWatchFailures` now counts required failures. The existing event predicate and exit
  classifier consume that count. Added `countYeetWatchOptionalFailures` and the independent
  `watch-ended.optionalFailing` count. Its schema defaults to zero on construction and when
  decoding legacy rows. Optional transitions and inbox failure capsules remain observable.
- Rejected swallowing every nonzero watch result, interpreting unreadable check data as green,
  changing fail-fast, and treating optional failures as event wakes. Reused the existing outcome
  classifier so unknown required states continue waiting rather than becoming terminal.
- Updated the yeet recipe, settle explanation, readiness announcement, and lean AGENTS closeout
  instruction. PLAN carries the requested `PR1 landed; PR2 after B5` closeout marker for the
  orchestrator's final PR1 commit. This lane has not published or observed PR1 land.
- Existing changeset, exploration links, and rulings were preserved without duplication.
  All regression additions are in existing test files; no new test file or inventory entry.

### Stage C — files

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchMode.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts`
- `packages/tooling/tool/cli/src/test/Yeet.test-kit.ts`
- `packages/tooling/tool/cli/test/yeet-monitor-check-registration.test.ts`
- `packages/tooling/tool/cli/test/yeet-watch-mode.test.ts`
- `packages/tooling/tool/cli/test/yeet-watch-stream.test.ts`
- `.claude/skills/yeet/SKILL.md`
- `AGENTS.md`
- `goals/time-to-certainty/PLAN.md`
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/b7-implementation.md`

### Stage C — verification

Vitest cwd is `packages/tooling/tool/cli`. `SUITES` denotes these explicit arguments:

```text
test/yeet-monitor-check-registration.test.ts
test/yeet-watch-mode.test.ts
test/yeet-watch-stream.test.ts
test/yeet-status-triage.test.ts
```

`COMPILER` is the root-relative native artifact
`node_modules/@effect/tsgo-linux-x64/artifacts/typescript/7.0.2/tsc`.
Logs and lcov are local scratch evidence, not files for the orchestrator to stage.

| Command | Exit | Observed result |
| --- | ---: | --- |
| `bunx vitest run $SUITES` | 0 | 4 suites, 126 tests; `/tmp/b7c-node-verified.log` |
| `bunx --bun vitest run $SUITES` | 130 | Banner only; interrupted; no passing proof |
| `timeout 120s bunx --bun vitest run $SUITES --pool=threads` | 0 | 126 tests passed |
| `$COMPILER -p packages/tooling/tool/cli/tsconfig.check.json` | 0 | Source check passed |
| `$COMPILER -p packages/tooling/tool/cli/test/tsconfig.json --rootDir .` | 0 | Test check passed |
| `bun run beep quality package-verify @beep/repo-cli` | 1 | Build passed; audit shim `EPERM` |
| Scoped lcov command below | 1 | 126 tests pass; Handler/Status below the 100% floor |
| `bunx biome check` on the eight listed TypeScript files | 0 | Final check; no fixes needed |
| `git diff --check` | 0 | No whitespace errors |

Final compiler logs: `/tmp/b7c-source-final.log`, `/tmp/b7c-tests-final.log`.
Bun thread-pool log: `/tmp/b7c-bun-verified.log`.
Package log: `/tmp/b7c-package.log`. The resulting audit P0 was acknowledged environment-only
through `yeet inbox ack`; that command exited 0 (`/tmp/b7c-ack.log`).

Coverage command (100% per-file floor, with executable test-kit coverage requested):

```sh
bunx vitest run $SUITES --coverage \
  --coverage.include='src/commands/Yeet/internal/{Handler,Status,WatchMode,WatchStream}.ts' \
  --coverage.include='src/test/Yeet.test-kit.ts' \
  --coverage.reporter=lcov --coverage.reporter=text \
  --coverage.reportsDirectory=/tmp/b7c-coverage-final \
  --coverage.thresholds.lines=100 --coverage.thresholds.branches=100 \
  --coverage.thresholds.functions=100 --coverage.thresholds.statements=100 \
  --coverage.thresholds.perFile
```

The command exited 1. All 126 tests passed, but Handler and Status failed the coverage floor.
Log: `/tmp/b7c-coverage-verified.log`; lcov: `/tmp/b7c-coverage-final/lcov.info`.

| Source | Lines % | Branches % | Functions % | Statements % |
| --- | ---: | ---: | ---: | ---: |
| `Handler.ts` | 29.15 | 15.06 | 14.28 | 29.12 |
| `Status.ts` | 62.21 | 51 | 55.23 | 61.67 |
| `WatchMode.ts` | 100 | 100 | 100 | 100 |
| `WatchStream.ts` | 100 | 100 | 100 | 100 |
| `Yeet.test-kit.ts` | N/A | N/A | N/A | N/A |

The test kit only re-exports symbols; lcov reports zero executable lines, functions, and
branches for it. Its displayed 0% is not an executable coverage deficit.

### Stage C — blockers

- The full-file coverage floor remains unmet in Handler and Status. The passing regressions
  are not full-module proof for their unrelated publishing and status branches.
- The canonical package gate needs an orchestrator rerun because the sandbox rejects the
  Node spawn in `tools/tsgo-shim/tsgo.js`. Direct compiler passes are supporting evidence only.
- The default Bun pool did not finish; the passing threads run is supplemental evidence.
- No full repo lint, canonical test-tsgo, docgen, Fallow, hosted checks, or live PR smoke ran
  here. No new test files were added, so the new-file effect-vitest inventory write was not run.
- Stage B integration belongs to the orchestrator. The Stage B loop, CLI routing, inbox,
  acknowledgment, and hook files were not changed by this lane.

## Measurement

No live push→ready wall clock was observed in this sandbox. Scripted runtime tests are not a
live PR measurement. After combining Stage B and C, the orchestrator should babysit PR1 with
this exact attached command from a background tool call:

```sh
bun run beep yeet monitor --until-ready
```

Paste the actual command's exit code and these emitted lines into the PR description:

- The settle gate lines containing `settle: registration` and/or `settle: required-pending`,
  including any missing contexts and tolerated matrix parents that were observed.
- The gate line containing `settle: closeout-pending` and the
  `[yeet] closeout: <issueCount> issue(s) for head <sha7>` line.
- The `merge-ready: yes` status line and the final readiness gate line carrying
  `push→ready <duration>` and its parenthesized pushed, settled, closeout, and ready instants.
- The terminal summary
  `[yeet] merge-ready: every hard criterion is green; hand the pull request to the operator`
  and exit code 0. If it exits 1, paste that actual failure summary instead and re-arm after
  fixing the blocker and publishing.

Keep `push→ready unknown` if the commit date could not be read. Do not invent timestamps or
paste a reason that never appeared. The measured transcript, plus the orchestrator's canonical
verification results, must come from the combined PR1 head.
