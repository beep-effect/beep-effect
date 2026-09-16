# B7 implementation brief — `yeet monitor --until-ready`, the canonical PR babysit path

Owner: Fable orchestrator. Implementer: one Codex `codex exec` lane (`gpt-6-astra`, reasoning
`medium`, `workspace-write`) in worktree `~/YeeBois/projects/beep-effect8-worktrees/ttc-b7` on
branch `ttc/b7-until-ready`. The lane makes **no git writes** (Fable stages listed paths by name
and signs commits) and runs **no graft commands**. Results file:
`goals/time-to-certainty/research/b7-implementation.md` (one `## Stage <X>` per stage with
decisions + rejected alternatives, `### Stage <X> — files`, a verification table with exit codes,
measurements, blockers). Friction receipts go to `goals/time-to-certainty/research/OPPORTUNITIES.md`
at the moment they happen (public repo: redact, `~` for home, minimal error text).

## Read first

1. `research/decisions.md` rulings B7-1..B7-8 (this item's design; binding), rulings 11–18
   (journal facts), `research/b7-design-tree.md` (verified facts + decision tree),
   `research/b7-research.md` (gh CLI / GitHub / merge-bot evidence; re-verify anything relied on),
   `SPEC.md` B7, `PLAN.md` B7.
2. The orchestrator-written schemas and contracts, which the lane implements against and may
   extend only with a recorded reason in the results file:
   - `commands/Yeet/internal/Settle.ts` — `GhBranchRule`, `YeetRulesetRequiredContexts`,
     `rulesetRequiredContextsFromRules`, `readYeetRulesetRequiredContexts` (gh boundary, degrades
     to `None`), `YeetSettleCheck`, `YeetExpectedContextInput`/`Census`, `matchExpectedContexts`,
     `YeetSettleInput`, `YeetSettleVerdict`, `deriveSettleVerdict`, `yeetSettleVerdictIsTerminal`,
     `renderYeetSettleDetail`, `yeetSettleCheckFrom`, `yeetSettleStampFor`.
   - `commands/Yeet/internal/MonitorPolicy.ts` — `YEET_SETTLE_TIMEOUT_DEFAULT_MILLIS`,
     `YEET_MONITOR_POLL_ERROR_BUDGET`, `YeetMonitorTerminalState` (moved here from
     `MonitorLoop.ts`; now `merged | closed | ready | required-red | settle-timeout |
     poll-error-budget`), `YeetUntilMergedPolicy`/`YeetUntilReadyPolicy`/`YeetMonitorLoopPolicy`
     (tagged on `kind`), `yeetMonitorPolicyTerminals`, `YeetMonitorExit`, `yeetMonitorExitFor`,
     `yeetMonitorExitTable`, `YeetHeadTimeline`, `YeetHeadTimelineStamp`, `yeetHeadTimelineStamp`,
     `yeetPushToReadyMillis`, `renderYeetHeadTimeline`.
   - `commands/Yeet/internal/WatchStream.ts` — `YeetSettleReason` (`registration`,
     `required-pending`, `closeout-pending`, `settle-timeout`) and the `settle-changed` event
     `YeetSettleChanged` (in the `YeetWatchEvent` union).
   - `commands/Yeet/internal/Inbox.ts` — `YeetPrMergeReadyCapsule`, `YeetPrMergeReadyRow`
     (`kind: "pr-merge-ready"`, severity `P1`), `yeetPrMergeReadyRowId` (PR number + head SHA),
     wired into `YeetInboxRow`, `yeetInboxExpectedRowId`, `describeYeetInboxRow`.
   - `commands/Yeet/internal/Status.ts` — `YeetStatusSnapshot.timeline: Option<YeetHeadTimeline>`.
   - `commands/Yeet/internal/Closeout.ts` — `writePrCloseoutReport` (moved from `Handler.ts`),
     `yeetAutomaticCloseoutOptions`, `runYeetAutomaticCloseout` (read-first, never reply/resolve/
     retrigger).
   - `commands/Yeet/internal/Porcelain.ts` — `YeetMonitorRouteDependencies` gains `collectStatus`,
     `rulesetRead`, `closeout` seams. Every loop test runs against these stubs; the existing
     `mergeLoop`, `hydrate`, `view`, `capture`, `registry`, `watchStream` seams stay.
   All are re-exported from `src/test/Yeet.test-kit.ts` (`@beep/repo-cli/test/Yeet`).
3. Code to change: `internal/MonitorLoop.ts` (`pollUntilMerged`, `runYeetMonitorUntilMerged`,
   `YeetMonitorUntilMergedOptions`, `renderMergeReadyGate*`, `yeetMonitorTerminalState`),
   `internal/WatchMode.ts` (`watchStreamEnd`, `yeetWatchExitFailure`, `runYeetWatchStream`,
   `collectYeetWatchSnapshot`), `internal/WatchStream.ts` (`countYeetWatchFailures`,
   `diffYeetWatchSnapshots`, `YeetWatchSnapshot`), `internal/Porcelain.ts` (`runYeetMergeLoop`,
   `runYeetWatchLoop`, `rejectYeetUntilEventPairing` idiom), `Yeet.command.ts` (`monitorFlags`,
   `YeetMonitorCommandRoute`, `yeetMonitorCommandRoute`, `yeetMonitorCommand`),
   `internal/Handler.ts` (`runMonitorCheckWatch`, `runMonitorPhase`), `internal/Status.ts`
   (`renderYeetStatusSummary`, `collectYeetStatus`), `internal/Remediation.ts`
   (`supersedeYeetDispatchState` — the head-supersession idiom to mirror for the merge-ready row),
   `internal/Ack.ts` (`writeYeetAckReceipt`, `YeetAckFixResolution`),
   `.claude/hooks/yeet-inbox.sh` (`row_label`, `render_context`),
   `.claude/skills/yeet/SKILL.md`, `AGENTS.md` (Quality Operator "PR closeout" bullet; edit
   `AGENTS.md`, never the `CLAUDE.md` symlink), `explorations/pr-event-awareness/README.md`
   (Trail) and `research/SOURCES.md` (§5 cross-links), `PLAN.md`, `.changeset/`.
4. Tests to extend: `test/yeet-monitor-loop.test.ts`, `test/yeet-watch-mode.test.ts` (the
   scripted `ChildProcessSpawner` idiom: `scriptedSpawnerLayer`, `PollScript`),
   `test/yeet-watch-stream.test.ts`, `test/yeet-status-triage.test.ts`,
   `test/yeet-inbox.test.ts`, `test/yeet-inbox-hook-adapter.test.ts`,
   `test/yeet-command-wiring.test.ts` (route table), `test/yeet-provenance-footer.test.ts`
   (the `runYeetMergeLoop` dependency-stub idiom), `test/yeet-monitor-check-registration.test.ts`
   (`runMonitorCheckWatchForTesting` idiom). Effect v4 reference for every API:
   `~/YeeBois/projects/beep-effect8/.repos/effect` (the lane has no `.repos` symlink); never
   training-data priors.

## Why (measured, 2026-09-15/16)

During the C3 closeout train the orchestrator could not babysit PRs with yeet alone and wrote a
25-line shell watcher instead. Plain `yeet monitor` exits 1 while printing `merge-ready: yes` when
an optional check (Vercel, Coverage Regression) is red; `--watch --until-event` fires instantly on
standing optional reds because `countYeetWatchFailures` ignores `required`; nothing composes
"required census settled → closeout → merge-ready" so `--until-merged` prints
`not merge-ready: blocked on closeout-run` forever; there is no exit-0 terminal a session can
block on; and a watcher declared the board settled 90 s after a push while heavy checks were
still registering (receipts 2026-09-12 and 2026-09-13 in `OPPORTUNITIES.md`).

Live facts (2026-09-16, #1143): the `main` ruleset (id 10240248) lists 17 required contexts;
`gh pr checks --required` lists 16 — `Test Unit` never reports under its own name because its
jobs register as `Test Unit (unit-a|unit-b|repo-cli)`. `Lint` matches exactly today. The matcher
tolerates an expected context with no exact match when at least one `<context> (…)` child is
reported, and waits for those children.

## Stages — one commit each (Fable commits), all three in this launch

### Stage A — settle rule wired into the loop (schemas exist; implement + test)

1. **Ruleset read once per head.** `runYeetMonitorUntilMerged` reads `rulesetRead(context)` on
   the first poll of each head SHA and caches the `Option<YeetRulesetRequiredContexts>` in the
   loop state; a head change re-reads. The seam comes from `YeetMonitorUntilMergedOptions`
   (extend it with `collectStatus?`, `rulesetRead?`, `closeout?`, `policy`, `now?`) and
   `runYeetMergeLoop` passes the route dependencies through.
2. **Checks for the settle rule** come from the status snapshot: extend `collectYeetStatus`'s
   remote read so `YeetStatusRemote` carries `checks: Array<YeetSettleCheck>` (name, classified
   outcome via `classifyYeetCheckOutcome`, `required` from the `--required` view) as an optional
   key with an empty default — the counts stay. Do not add a third `gh pr checks` spawn.
3. **Head timeline.** Loop state holds `YeetHeadTimeline` per head: `firstObservedAt` from the
   first poll; `pushedAt` from one `gh api repos/{owner}/{repo}/commits/<sha> --jq
   .commit.committer.date` capture per head (degrade to `None` on failure, never fail the loop);
   `settledAt`/`closeoutAt`/`readyAt` via `yeetHeadTimelineStamp` on first observation. Write it
   into the snapshot (`timeline`) before `writeYeetStatusSnapshot`.
4. **Settle verdict per poll.** `deriveSettleVerdict(YeetSettleInput.make({ expected, checks,
   closeoutBound: snapshot.mergeReady.criteria.closeoutRun, waitedMs: now − firstObservedAt,
   timeoutMs: policy.settleTimeoutMs }))`. Print the gate line every poll as
   `[yeet] <merge-ready detail>; <renderYeetSettleDetail(verdict)>` and, on a reason
   change, one `[yeet] settle: <from> → <to>` line. `settle-timeout` ends the loop with the
   `settle-timeout` terminal; the exit summary names `census.missing` and `census.pending`.
5. **`--settle-timeout <duration>`** on `monitor` (`Flag.String`, default `""` → 30 minutes;
   parse with `S.DurationFromString` after normalising `30m`/`1h`/`90s` to `30 minutes` etc. the
   way the B5 lane's `durationMillis` does — copy that helper into `Yeet.command.ts` under a
   general name; reject non-positive). Legal with `--until-merged`, `--until-ready`, and
   `--watch`; illegal with plain monitor (reject like `rejectYeetUntilEventPairing`).
6. **`settle-changed` in the watch stream.** `YeetWatchSnapshot` gains `settle:
   O.Option<YeetSettleVerdict>` (None until a ruleset read happened); `runYeetWatchStream` reads
   the ruleset once per head through the same seam, derives the verdict each tick from the
   snapshot's checks, and `diffYeetWatchSnapshots` emits `settle-changed` when the reason moved.
   `--watch` honours `--settle-timeout` by ending with reason `poll-error`? No — add
   `settle-timeout` to `YeetWatchEndReason`; `yeetWatchExitFailure` treats it as a failure.
7. **Tests (Stage A)** in `test/yeet-settle.test.ts` (new, `@effect/vitest`, `@beep/*` imports):
   `S.toArbitrary` round-trips for every class in `yeetSettleSchemasForTesting` and for
   `YeetMonitorLoopPolicy`, `YeetMonitorExit`, `YeetHeadTimeline`, `YeetSettleChanged`,
   `YeetPrMergeReadyRow`; `rulesetRequiredContextsFromRules` over a fixture that mirrors the live
   `main` payload (17 contexts, one `pull_request` rule with unrelated parameters, duplicates);
   `matchExpectedContexts` with the live census (`Test Unit` tolerated via `Test Unit (unit-a)`,
   `Heavy / Check` missing, `Vercel` optional red ignored, a `--required` row outside the
   expected set still pending); `deriveSettleVerdict` for every reason including the fallback
   census and the timeout boundary (`waitedMs === timeoutMs`); `readYeetRulesetRequiredContexts`
   against a scripted spawner (exit 0 → `Some`, exit 1 → `None` + one stderr line, truncated →
   `None`); the loop under `TestClock` (`it.layer`/`it.effect` with `effect/testing/TestClock`
   `adjust`; mind `excludeTestServices: true` where a real `Effect.sleep` is required) proving
   `settle-timeout` fires at exactly `timeoutMs` for a never-registering context and names it;
   `--settle-timeout` parsing table (`30m`, `1 hour`, `0s` rejected, `x` rejected);
   `yeet-watch-stream.test.ts` gains the `settle-changed` diff case.

### Stage B — closeout composition, `--until-ready`, the merge-ready row

1. **Policy union in the loop.** `runYeetMonitorUntilMerged(context, options)` takes
   `policy: YeetMonitorLoopPolicy` (default `YeetUntilMergedPolicy.make({})`); one
   `pollUntilMerged`-shaped step decides the terminal through `yeetMonitorPolicyTerminals`. Keep
   the function name and the `mergeLoop` seam; add `runYeetMonitorUntilReady` as a thin wrapper
   only if the CLI route reads better with it.
2. **Automatic closeout.** When the verdict reason is `closeout-pending`, call
   `closeout(context)` (seam), stamp `closeoutAt`, re-read status on the same poll (one extra
   `collectStatus`) so the gate line shows the bound criterion, and print
   `[yeet] closeout: <issueCount> issue(s) for head <sha7>` — issues are readiness blockers, not
   loop failures. Never pass reply/resolve/retrigger. The artifact binds `reviewedHeadSha`, so a
   push invalidates it and the next settle re-runs it; a closeout error is logged and retried on
   the next poll (counts toward the poll-error budget).
3. **`ready` terminal.** On the first poll with `mergeReady.ready === true` (settle verdict
   `None`), stamp `readyAt`, print the final gate line with `renderYeetHeadTimeline`, append the
   `pr-merge-ready` row (see 5), and under `until-ready` return `ready`; under `until-merged`
   announce once per head (`[yeet] merge-ready announced for head <sha7>`; state carries the
   announced head) and keep looping.
4. **Required-red terminal (until-ready only).** After `planYeetMonitorReruns`, if any decision
   is `needs-code-fix` or `rerun-spent` **and** that job's name is in the required set (matched
   contexts, matrix children of tolerated parents, or a `--required` row), return `required-red`
   naming the job(s) in the exit summary. `awaiting-log`, `awaiting-run`, and `rerun` keep
   polling. Optional reds are reported in the decision lines and never end the loop.
5. **`pr-merge-ready` row.** `appendYeetInboxRowOnce(repoRoot, YeetPrMergeReadyRow.make({...}))`
   with `yeetPrMergeReadyRowId`; capsule from the timeline (`url` from `snapshot.remote.url`).
   On a head change, supersede the prior head's row when one was appended: write a `fix-sha`
   receipt (`writeYeetAckReceipt`) naming the new head SHA — mirror how
   `supersedeYeetDispatchState` scopes per head. Exactly one row per head; re-observing readiness
   on the same head appends nothing.
6. **Poll-error budget.** `collectStatus` failures no longer escape: count consecutive failures,
   log `[yeet] poll failed (<n>/<budget>): <message>`, reset on success, and return
   `poll-error-budget` when the budget is spent (both policies).
7. **CLI + legality.** `--until-ready` on `monitor`; `YeetMonitorCommandRoute` gains
   `ready-loop` and `invalid-until-ready`; `yeetMonitorCommandRoute` rejects `--until-ready`
   with `--until-merged`, `--until-event`, or `--watch` (message via a
   `rejectYeetUntilReadyPairing` sibling of `rejectYeetUntilEventPairing`; legality lives in the
   route selector because `Guards.ts` only sees `YeetRunOptions`, which the monitor routes never
   build — record this in the results file). `runYeetMergeLoop` maps the terminal through
   `yeetMonitorExitFor`: print `[yeet] <summary>` and `failWithReportedExit` when `exitCode !== 0`.
8. **Hook label.** `.claude/hooks/yeet-inbox.sh` `row_label`: a `pr-merge-ready` row renders as
   `P1 merge-ready [<id>] PR #<n>` and `render_context` prefixes merge-ready rows with
   "Good news, not incident work:" and names `--thread-url <pr url>` as the natural ack form
   (PR1 acks with the existing forms; B5's `--observed` arrives in PR2). Extend
   `test/yeet-inbox-hook-adapter.test.ts`.
9. **Tests (Stage B)** in `test/yeet-monitor-ready.test.ts` (new): drive
   `runYeetMonitorUntilMerged` with stubbed `collectStatus` / `rulesetRead` / `closeout` /
   `onMerged` and `TestClock`: (a) registration → required-pending → settled → automatic closeout
   called exactly once for the head → `ready` with exit 0 while an optional check is red (assert
   the row exists once, its id, its timeline fields, and that a second poll on the same head
   appends nothing); (b) required red that matched no flake class → `required-red` naming the
   job; a matched flake → one rerun then `required-red` when spent; (c) `CLOSED` → `closed`;
   (d) `--settle-timeout` boundary → `settle-timeout` with `missing` names; (e) poll-error budget
   → `poll-error-budget` after exactly 5 consecutive failures, reset by one success; (f) a push
   mid-loop starts a new timeline, re-reads the ruleset, re-runs closeout for the new head, and
   supersedes the prior row with a `fix-sha` receipt; (g) `until-merged` announces readiness once
   per head and keeps looping to `merged` (sweep seam called once); (h) exit table: one test
   iterating `yeetMonitorExitTable` against `YeetMonitorTerminalState.Options`; (i) route table
   additions in `yeet-command-wiring.test.ts` and the `--until-ready --watch` rejection through
   `runYeetCommand`.

### Stage C — exit-code census fixes, docs, packet

1. **Plain monitor.** `runMonitorCheckWatch` (Handler): when the `gh pr checks --watch
   --fail-fast` step exits non-zero and it is not the registration case, re-read the required
   view (`collectRemoteChecks(context, true)` — export it from `Status.ts` under a testing-safe
   name) and decide by the required census: a required red fails as today; only optional reds
   → log `[yeet] optional check(s) red: <names>; required census green` and treat the step as
   passed (replace the recorder entry's exit code the way the retry path rewinds it); required
   still pending (fail-fast broke out early) → re-run the watch step, bounded by the settle
   timeout default. Tests in `yeet-monitor-check-registration.test.ts` (the
   `runMonitorCheckWatchForTesting` idiom): optional red → pass; required red → fail; optional red
   then required pending → second watch attempt.
2. **`--watch` census.** `countYeetWatchFailures` counts `required` checks only (rename nothing;
   fix the predicate and its JSDoc); `watchStreamEnd`'s `untilEvent` red trigger uses it; add
   `countYeetWatchOptionalFailures` for the `watch-ended` row's new `optionalFailing` field
   (default 0) so consumers still see optional reds. Regression tests in
   `yeet-watch-mode.test.ts`: a standing optional red no longer exits 1 or fires `--until-event`;
   a required red still does; `yeetWatchExitFailure` table updated.
3. **Docs.** `.claude/skills/yeet/SKILL.md`: step 6 becomes the `--until-ready` recipe (attached,
   background tool call; exit 0 = hand to the operator; exit 1 = read the summary line, fix,
   publish, re-arm); the `--watch --until-event` section is demoted to "stream consumers";
   `--until-merged` section mentions the readiness announcement; a new "Settle rule" paragraph
   names the ruleset read, the tolerated matrix parents, `--settle-timeout`, and the gate line
   reasons. `AGENTS.md` Quality Operator "PR closeout" bullet: `bun run beep yeet monitor
   --until-ready` until it exits 0 with `merge-ready: yes`; unresolved review threads remain the
   `yeet reply` gate. `PLAN.md` B7 entry (check off in PR1's last commit as "PR1 landed; PR2 after
   B5"), `explorations/pr-event-awareness/README.md` Trail line + `research/SOURCES.md` §5
   cross-link (the polling half is being built as ttc B7; webhooks, push sources, lane dispatch
   stay out of scope). `.changeset/yeet-monitor-until-ready.md` (`"@beep/repo-cli": minor`).
4. **Measurement.** The final gate line prints `renderYeetHeadTimeline`; the results file
   records the push→ready wall clock observed in the lane's own live smoke (if any) and the
   command Fable runs for PR1's babysit so the PR description can carry the transcript.

## Verification the lane runs (Codex sandboxes cannot spawn the tsgo shim; report what could not run)

Per touched suite, both runtimes:

```
cd packages/tooling/tool/cli && bunx vitest run test/<file>.test.ts
cd packages/tooling/tool/cli && bunx --bun vitest run test/<file>.test.ts
```

Scoped lcov for every touched src file (100 floor; remove unreachable guards rather than leave
them uncovered):

```
cd packages/tooling/tool/cli && bunx vitest run test/<file>.test.ts --coverage.include='src/commands/Yeet/internal/<File>.ts' --coverage.reporter=lcov
```

`bun run beep lint effect-vitest --write` after adding test files (EV006: `assertSome`/`assertNone`
from `@effect/vitest/utils`, never `expect(O.isSome(...))`). Biome forbids `new Error` in tooling
src; exported 2/3-arg functions need `dual(N, …)` (TS377101) or a single input class; nested
pipeable calls trip TS377050. Fable runs `bun run beep lint`, `bunx turbo run check
--filter=@beep/repo-cli`, `bun run beep quality test-tsgo`, `bun run beep quality package-verify
@beep/repo-cli`, docgen, and Fallow before each commit and reports back; fix what those name.

## Rejected in the brief (do not re-open)

- A third `gh pr checks` spawn per poll for the settle rule (the status read already has both
  views). — Prefix-matching required contexts beyond the `<context> (` matrix-child form
  (fuzzy matching would count unrelated jobs as required). — Treating unreported contexts as
  failed (merge-queue semantics; lies about what was observed). — An opt-in `--closeout` flag.
  — Changing plain monitor's fail-fast default. — Guards.ts as the home of monitor-route
  legality (it never sees those flags).
