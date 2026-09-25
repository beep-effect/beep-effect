# A3 — economics as a Yeet surface: contract (2026-09-25)

Item A3 (`SPEC.md`: "the A1 computation becomes a yeet subcommand reading the same journals, so
every closeout can print where the minutes went; schema first: the report is an `S.Class` document
with a schema version"). This note is the design contract the implementation follows. Rulings 73–75
below are proposed by the orchestrator; the merge of the PR that lands them is the lock, as for
rulings 68–70. The read-only port brief that grounds every claim here is session-scoped; its
findings that matter are restated in §0.

Amended in review round 1 of #1239 before the lock: rulings 73, 74 and 75.

## 0. What the A1 script cannot be as a checkout command (findings)

1. **Post-A5 verdicts list wrapper lanes and inner lanes together**, both with `durationMs`
   (`Verdict.ts` `laneFromQualityTaskRun` forces phase `"full"`). The script's lane sums
   (`lane_metrics`) and episode lane minutes (`laneDurationMs`) therefore count the same wall time
   twice on any journal written after A5. Its first-failure walk does not: it stops at the first
   failed lane that has a duration, and `buildYeetVerdict` lists every executed wrapper before any
   inner lane, so on the fleet it always stops at the failed wrapper. The A1 baseline predates A5 and
   is unaffected; the A3 surface must not inherit the defect.
2. **The script's inner-lane → GitHub-context map is stale** (`pre-push:*`; current ids are
   `quality:<CiLaneId>` per `GithubChecks.ts`, authoritative names in `CI_LANE_DESCRIPTORS`).
3. **Live-journal discovery misses `$HOME/YeeBois/projects/beep-effectN-worktrees/*`**, where every
   lane lives (31 lanes with `.beep/yeet/runs` on 2026-09-25).
4. **M4 is hardcoded `unmeasurable`** and **termination reasons are loaded but never aggregated**,
   although A5 rows carry `diffFingerprint` and a 16-value reason vocabulary.
5. **`hosted`, `admission`, `executionAmplification`'s hosted join, `articleComparison`, corpus
   replay and receipt validation** need the gh snapshot, the frozen corpus or fleet-wide joins; they
   are not checkout facts.
6. **`WaveOrder.ts` reads the committed `research/economics.json` by JSON pointer**; the TS command
   must never write that file.

## Proposed ruling 73 (A3-1) — `yeet economics` is a checkout report over live attempt journals

`bun run beep yeet economics [--json] [--branch <name>] [--fleet] [--packet-dir <dir>]`.

- **Default scope**: every `<packetDir>/runs/<runId>/attempts.ndjson` of the current checkout
  (`--packet-dir`, default `.beep/yeet`, resolved against each checkout unless absolute), plus an
  orphan `verdict.json` beside a journal that has no terminal row for that attempt. `--branch`
  narrows to that branch's run directory (`repoRunArtifactId(branch)`). `--fleet` adds every sibling
  checkout under the projects root, the parent of the clone. The clone comes from the checkout's git
  metadata without spawning git: a `.git` directory makes the checkout its own clone, and a `.git`
  file's `gitdir:` line names `<clone>/.git/worktrees/<name>`. Only when `.git` is unreadable does
  the directory name decide (a lane under `<clone>-worktrees/` sits one level deeper than a clone).
  The fleet is the directories named `beep-effect*`, the lanes under `beep-effect-worktrees/*` and
  `beep-effect*-worktrees/*`, and the lanes under every clone's `.claude/worktrees/*`, each labelled
  by its path relative to the projects root. Symlinked candidates are skipped. Checkouts without
  `<packetDir>/runs` are skipped, not errors.
- **Document**: `YeetEconomicsReport`, an `S.Class`, `schemaVersion: "yeet-economics/v1"`;
  `--json` prints it through a `JsonStringCodec`. Field names shared with
  `verification-economics/v1` keep the Python spelling (`p50Ms`, `closedEpisodes`,
  `startsWithoutFinish`, …) so rows compare by name; nothing is written to `research/`.
- **Stays with the A1 script**: hosted runs, admission, the hosted execution-amplification join
  (M3), the article comparison, corpus replay, input receipts, and the ratified close re-run
  (ruling 8: same script, row by row).
- **Rejected**: reusing `verification-economics/v1` (the document drops four sections and adds two);
  a section in `yeet status` (per-branch; the sample is per-checkout); writing a persisted artifact
  at closeout (nothing reads one).

## Proposed ruling 74 (A3-2) — wrapper lanes and inner lanes are separate populations

- A verdict lane is **inner** when it carries `parentLaneId`; `YeetVerdictLane` gains
  `parentLaneId: S.optionalKey(S.String)` (additive; `yeet-verdict/v2` unchanged), set by
  `laneFromQualityTaskRun` from `QualityTaskLaneRunReport.parentLaneId`. For verdicts written before
  this lands, a lane is a **wrapper** when its id starts with one of `full:`, `feedback:`,
  `prepare:`, `publish:`, `monitor:`, `closeout:`, `advisory:`, `commit:`; every other lane is inner.
- Each population has its own denominator: share percentages, totals and the accounted-time
  percentage are computed within the population, whose attempt time is the elapsed time of the
  attempts that contributed at least one observation to it. The two are never summed.
- First-failure offsets (M2) have one definition for every attempt, stated by the constant
  `firstFailure.offsetMethod`. The failing lane is the first failed **inner** lane that carries a
  duration; if none, the first failed **wrapper** that carries a duration; if none, the attempt is
  `notReconstructable`. Start offset = the non-negative durations of every wrapper that precedes
  the failing lane's parent wrapper in verdict order (the parent is `parentLaneId`; for a legacy
  verdict without it, the first failed timed wrapper; when no parent is found, every wrapper
  precedes) plus the durations of that wrapper's inner lanes that precede the failing inner lane.
  When the failing lane is itself a wrapper, the start offset is the wrappers before it. Completion
  offset = start offset + the failing lane's duration. The actionable lane order is unchanged: the
  first failed inner lane, else `failedStepId`, else the first failed lane of either population,
  else `unlocated`.

## Proposed ruling 75 (A3-3) — metric definitions carried by the surface

- **M1** `redToGreen`: episodes keyed by `(checkout, runId)`, attempts sorted by
  `(startedAt, attemptId)`; a red attempt joins the streak, a green attempt with no streak closes
  nothing, a green attempt after a streak closes an episode with `spanMs = max(0, end − start)`
  (`end` = the green's `endedAt`, else its `startedAt`; `start` = the first red's `startedAt`). Red =
  `outcome !== "success"`; a terminated row is red. **Comparable** = mode in
  `verify | repair | publish` and not a lock bounce (`failureKind === "handler-error"` and the
  message contains `Another Yeet full proof`, case-sensitive). `comparable24h` keeps closed episodes
  with span ≤ 86 400 000 ms; `uncut` keeps all closed episodes. **Left-censored** (ruling 18): the
  journal has a compaction cutoff (`terminalEvictionCutoffRecordedAt`, else
  `oldestEvictedRecordedAt`) and `start ≤ cutoff`. **Right-censored**: a streak still open at the
  end, reported with its observed lower bound `rightCensoredObservedSpanMinutes` (summed over open
  streaks: the last member's `endedAt`, else `startedAt`, minus the first red's `startedAt`). Each
  summary: `closedEpisodes`, `p50Ms`, `p95Ms`, `totalEpisodeSpanMinutes`,
  `measuredAttemptMachineMinutes`, `leftCensoredEpisodesExcluded`, `leftCensoredObservedAttempts`,
  `rightCensoredStreaks`, `rightCensoredRedAttempts`, `rightCensoredObservedSpanMinutes`, and for
  `comparable24h` also `closedEpisodesOver24hExcluded`. **Elapsed**: a terminated row whose reason
  the journal reconciler stamps at sweep time (`legacy-unowned-start`, `owner-dead`,
  `stale-unverifiable-owner`) has `elapsedMs = None`, so its `recordedAt` ends no duration (episode
  machine minutes, `attemptElapsedMs`); it still orders the attempt, keeps it red and bounds a
  right-censored streak. Rows written when the attempt dies (`interrupted`, `signal`, `oom-killed`,
  `timeout`, `cancelled`, `lease-eviction`, `queued-submitter-death`, `unrecorded-failure`, …) keep
  the `endedAt − startedAt` fallback.
- **M2** `firstFailure.completionOffsetP50Ms` per ruling 74, plus `startOffsetP50Ms`, both P95s,
  `redAttempts`, `attemptsWithReconstructableOuterFailure`,
  `attemptsWithoutReconstructableOuterFailure`, `actionableLaneMix` and `receiptProxyMix` (the
  seven proxy classes and match order of the A1 script: `scheduler-lock-bounce`,
  `native-compiler-flake`, `stale-workspace-or-projection`, `base-churn`,
  `scheduler-or-submitter`, `semantic-delta-path`, `unclassified`, matched on the lowercased
  concatenation of message, every lane's `repairCommand`, and `failedStepId`).
- **M4** `unchangedFingerprint` is the fingerprint-repeat proxy for M4: within one
  `(checkout, runId)`, `failedUnchangedFingerprintThenGreen` pairs consecutive attempts of the
  comparable sequence M1 walks (mode `verify | repair | publish`, not a lock bounce) and counts the
  pairs whose red side carries a verdict (`outcome` is present, so a terminated row never counts)
  and whose next attempt is green with the same `diffFingerprint`. `byActionableLane` and
  `byReceiptProxy` key each counted red attempt by its actionable lane and receipt-proxy class, as
  M2 computes them, so completion gate 3's classes can be read. `attemptsWithFingerprint` counts
  attempts carrying one; `classification` is `measured` when at least one attempt carries a
  fingerprint, else `unmeasurable`. SPEC M4's join with ack resolution kinds is not on this
  surface. The A1 script still hardcodes `unmeasurable`; the packet records that the close re-run
  inherits it.
- **M5** `terminations`: `starts`, `startsWithoutFinish` (starts minus terminal rows), and
  `reasonMix` over `YeetAttemptTerminationReason` (the 16 values), sorted by count then reason.
- **M3** is not on this surface (it needs the hosted join); recorded as the A1 close re-run's job.
- **Estimator**: nearest rank, index `clamp(ceil(p · n) − 1, 0, n − 1)`, `None` on empty input;
  rounding is `Math.round` (not round-half-to-even; documented in the schema annotation). Missing
  percentiles encode as `null` (`S.OptionFromNullOr`). The `Option`-returning helper at
  `Ci/LaneTimings.ts` (`nearestRank`, ~L2194) is promoted to a shared internal module and
  `Cache/Cache.command.ts` (~L342) points at it; no third copy.

## 1. Data model (schema first) — `commands/Yeet/internal/Economics.schemas.ts`

All classes are `S.Class` with `$I.annote`, JSDoc per `.patterns/jsdoc-documentation.md`. Count
maps are sorted row arrays, not records, so the document is deterministic.

```
CountRow            { key: S.String, count: S.Int }              // sorted count desc, then key
LaneRow             { id, label, phase: S.String, attempts, executions: S.Int,
                      p50DurationMs, p95DurationMs: S.OptionFromNullOr(S.Int),
                      totalDurationMs: S.Int, sharePct: S.OptionFromNullOr(S.Number),
                      statusMix: ReadonlyArray<CountRow> }       // over this row's observations
LanePopulation      { rows: ReadonlyArray<LaneRow>,              // total desc, then id, label
                      executions: S.Int, totalDurationMs: S.Int,
                      attemptElapsedMs: S.Int,                   // attempts with >= 1 observation here
                      accountedPct: S.OptionFromNullOr(S.Number) }
AttemptMix          { outcomeMix, modeMix, failureKindMix: ReadonlyArray<CountRow> }
FirstFailure        { redAttempts, attemptsWithReconstructableOuterFailure,
                      attemptsWithoutReconstructableOuterFailure: S.Int,
                      offsetMethod: S.Literal(<ruling 74 walk>),
                      startOffsetP50Ms, startOffsetP95Ms, completionOffsetP50Ms,
                      completionOffsetP95Ms: S.OptionFromNullOr(S.Int),
                      actionableLaneMix, receiptProxyMix: ReadonlyArray<CountRow> }
EpisodeSummary      { label: S.String, closedEpisodes: S.Int, p50Ms, p95Ms: S.OptionFromNullOr(S.Int),
                      totalEpisodeSpanMinutes, measuredAttemptMachineMinutes: S.Number,
                      leftCensoredEpisodesExcluded, leftCensoredObservedAttempts,
                      rightCensoredStreaks, rightCensoredRedAttempts: S.Int,
                      rightCensoredObservedSpanMinutes: S.Number,   // 2 dp
                      closedEpisodesOver24hExcluded: S.OptionFromNullOr(S.Int) }
RedToGreen          { comparable24h: EpisodeSummary, uncut: EpisodeSummary }
Terminations        { starts, startsWithoutFinish: S.Int, reasonMix: ReadonlyArray<CountRow> }
UnchangedFingerprint{ classification: LiteralKit("measured","unmeasurable"),  // M4 proxy, no ack join
                      attemptsWithFingerprint, failedUnchangedFingerprintThenGreen: S.Int,
                      byActionableLane, byReceiptProxy: ReadonlyArray<CountRow> }
Diagnostics         { journalsObserved, unreadableJournals, invalidRows, compactionReceipts,
                      leftCensoredJournals, duplicateStartedRowsDeduplicated,
                      duplicateFinishedRowsDeduplicated, orphanVerdictFilesAdded,
                      unkeyedVerdictFiles, starts, finishedAttempts, startsWithoutFinish,
                      verdictsWithoutStart, inFlightStartsExcluded, verdictV2Attempts,
                      verdictOtherAttempts: S.Int }
DataQuality         { attemptWindowStartUtc, attemptWindowEndUtc: S.OptionFromNullOr(S.String),
                      diagnostics: Diagnostics,
                      percentileEstimator: S.Literal("nearest-rank ceil(p*n)-1"),
                      rounding: S.Literal("Math.round") }
EconomicsScope      { kind: LiteralKit("checkout","branch","fleet"),
                      checkouts: ReadonlyArray<S.String>, branch: S.OptionFromNullOr(S.String) }
YeetEconomicsReport { schemaVersion: S.Literal("yeet-economics/v1"), scope: EconomicsScope,
                      measurementAsOf: S.String, attempts: { all: AttemptMix, comparable: AttemptMix },
                      wrapperLanes: LanePopulation, innerLanes: LanePopulation,
                      firstFailure: FirstFailure, redToGreen: RedToGreen,
                      terminations: Terminations, unchangedFingerprint: UnchangedFingerprint,
                      dataQuality: DataQuality }
YeetEconomicsReportJson = JsonStringCodec(YeetEconomicsReport)
YeetEconomicsOptions { json: S.Boolean, branch: S.OptionFromNullOr(S.String), fleet: S.Boolean,
                       packetDir: S.String /* default .beep/yeet */ }
```

Input side (the normalized attempt the fold consumes; also `S.Class`, exported for fixtures):

```
EconomicsLane       { id, label, phase, status: YeetLaneStatus, durationMs: Option<number>,
                      repairCommand: Option<string>, population: LiteralKit("wrapper","inner"),
                      parentLaneId: Option<string> /* default None */ }
EconomicsAttempt    { checkout, runId, attemptId: S.String, branch: S.String,
                      mode: Option<string>, outcome: Option<YeetOutcome>,
                      failureKind: Option<YeetFailureKind>, failedStepId: Option<string>,
                      message: S.String, startedAt, endedAt: Option<string>,
                      elapsedMs: Option<number>, diffFingerprint: Option<string>,
                      terminationReason: Option<YeetAttemptTerminationReason>,
                      verdictSchemaVersion: Option<string>, lanes: ReadonlyArray<EconomicsLane> }
EconomicsJournal    { checkout, runId: S.String, cutoff: Option<string>,
                      attempts: ReadonlyArray<EconomicsAttempt>, diagnostics: Diagnostics-subset }
```

Journal rows are decoded through a **projection union** of only the consumed fields (the
`AttemptJournalRetentionEvent` pattern in `internal/repo-run/AttemptTerminationJournal.ts`), never
the full `YeetAttemptJournalEvent` (which would silently drop rows the Python counts as invalid).
Rows that fail the projection count as `invalidRows`. Resolution order per attempt follows the A1
loader: live terminal row wins over an orphan verdict; `startedAt` from the verdict then the start
row; `endedAt` from the verdict's `endedAt`, then `createdAt`, then the row's `recordedAt`;
`elapsedMs` from the verdict, else `endedAt − startedAt`, except that a terminated row whose reason
the reconciler stamps at sweep time (`legacy-unowned-start`, `owner-dead`,
`stale-unverifiable-owner`) has `elapsedMs = None` and its `recordedAt` ends no duration, while
still ordering the attempt and bounding a right-censored streak (ruling 75); facts from the terminal
row then the start row; `branch` from the verdict, then the start row, then the runId; a terminated
row has no verdict so its `outcome` is `None` (red) and no lanes.

## 2. Service contract — `Context.Service`

```
class YeetEconomicsSource extends Context.Service<YeetEconomicsSource, {
  readonly read: (scope: EconomicsScopeRequest) =>
    Effect.Effect<ReadonlyArray<EconomicsJournal>, YeetEconomicsError>
}>()("@beep/repo-cli/Yeet/EconomicsSource") {
  static readonly layer: Layer.Layer<YeetEconomicsSource, never, FileSystem.FileSystem | Path.Path>
}
```

- `EconomicsScopeRequest { repoRoot: string, branch: Option<string>, fleet: boolean,
  packetDir: string (default .beep/yeet), inFlightAttemptId: Option<string> (default None) }`.
  `inFlightAttemptId` is an attempt the caller is still running: its start row is dropped before
  folding when it has no terminal row, and counted in `inFlightStartsExcluded`.
- Reads never fail the report for a bad journal: an unreadable file counts in
  `unreadableJournals`; a line that fails the row projection counts in `invalidRows`. The one
  exemption is the journal's own torn-tail rule (`AttemptTerminationJournal.ts`): invalid JSON on an
  unterminated last line is an append still in flight and is not counted; a complete JSON row there
  that fails the projection is still an invalid row. Stray files and symlinks under `runs/` are
  skipped without a count; a guard refusal counts a file as unreadable only when the file itself
  exists.
- `YeetEconomicsError` (`S.TaggedError`) carries a `reason` (`LiteralKit`): `no-runs-directory` (a
  non-fleet scope has no `<packetDir>/runs`), `run-id` (a branch's run id cannot be derived),
  `repo-root` (the working directory is not in a checkout), `encode` (the report's JSON encoding
  failed). The command turns only `no-runs-directory` into an empty report, mirroring
  `proof-report` on an empty ledger; every other cause fails it.
- Pure fold: `buildYeetEconomicsReport(journals, scope, now): YeetEconomicsReport` (no effects; the
  fixture surface). `renderYeetEconomicsReport(report): string` (plain text, the `proof-report`
  style). `renderYeetEconomicsCloseoutSummary(report): ReadonlyArray<string>` (at most five lines:
  attempts and outcomes; closed-episode span p50; first-failure completion offset p50; the top
  wrapper lane by minutes; terminations). `runYeetEconomics(options)` wires source → fold → print.
- Files: `commands/Yeet/internal/Economics.schemas.ts` (document + input model + options),
  `commands/Yeet/internal/Economics.ts` (source service, fold, render, run), shared percentile in
  `internal/stats/NearestRank.ts` (or the closest existing internal home — check
  `packages/tooling/tool/cli/src/internal/` for a stats/number module first), command wiring in
  `commands/Yeet/Yeet.command.ts` beside `proof-report`, exports through the Yeet test barrel
  (`cli/test/Yeet.test-kit.ts`) so tests import `@beep/repo-cli/test/Yeet`.
- Closeout: in `Handler.ts` `runCloseoutMode`, after `writePrCloseoutReport` and before
  `printOperatorStatusSummary`, print the closeout summary for the current branch through
  `printYeetEconomicsCloseoutSummary(repoRoot, branch, packetDir, inFlightAttemptId)`, reading
  `context.packetDir` and passing the closeout's own attempt id (journaled as started before the
  closeout runs) as in flight, so the terminations line reads ` (1 in flight)` instead of a phantom
  death; any failure of that read is one `[yeet] economics: <reason>` line and never fails the
  closeout.

## 3. Must-have fixtures (`test/yeet-economics.test.ts`, effect-vitest, temp roots)

1. Loader: started + finished + terminated + compaction rows → diagnostics counts, cutoff read,
   duplicate starts/terminals deduplicated, an orphan `verdict.json` synthesizes a terminal row, a
   verdict without `attemptId` counts as `unkeyedVerdictFiles`, a malformed line counts as
   `invalidRows`, an unreadable journal counts as `unreadableJournals`.
2. Populations: a post-A5 verdict with `parentLaneId` splits inner from wrapper; a legacy verdict
   splits by prefix; shares sum to 100 within each population and nothing is double-counted (the
   totals of the two populations differ from the Python's single sum on the same fixture).
3. First failure: an inner failure's offset adds the wrappers before its parent and its earlier
   siblings (post-A5 by `parentLaneId`, legacy by the first failed timed wrapper); falls back to the
   failed timed wrapper when no failed inner lane has a duration; `notReconstructable` when no failed
   lane has a duration; each receipt-proxy class matched by its own sentinel and `unclassified`
   otherwise.
4. Red-to-green: red,red,green → one closed episode with the exact span; a leading green closes
   nothing; lock bounce excluded from `comparable`; an episode over 24 h is in `uncut` and excluded
   from `comparable24h`; `start ≤ cutoff` is left-censored; an open streak is right-censored; a
   terminated row is red; episodes never span two runIds.
5. M4: a verdict red then green with the same fingerprint counts once, under its actionable lane and
   proxy class; a different fingerprint, an interrupted red and a closeout pair do not;
   `unmeasurable` when nothing carries a fingerprint.
6. M5: `reasonMix` sorted by count then reason; `startsWithoutFinish` equals starts minus terminals.
7. Document: `YeetEconomicsReportJson` round-trips; `schemaVersion` is the literal; a report over
   zero journals is valid (all counts zero, percentiles `null`).
8. Scope: `--branch` reads only that runId; `--fleet` over a temp projects root with a numbered
   clone, `beep-effect-worktrees/<lane>` and `beep-effectN-worktrees/<lane>` labels each by
   relative path and skips a sibling without `.beep/yeet/runs`.
9. Render: the text report names every section; the closeout summary is at most five lines and is
   produced for an empty report.
10. Percentile helper: the shared `nearestRank` equals the previous `LaneTimings` helper on a
    property sample, and the `Cache.command` call site still passes its existing tests.
11. Closeout: `runCloseoutMode` fixture (or the smallest seam available) shows the summary printed
    and a failing source reduced to one log line.

## 4. Gates before handoff (all from the lane, `zsh -ic`)

`bunx turbo run check --filter=@beep/repo-cli`; `bunx vitest run` on the new file plus
`yeet-*.test.ts`, `proof-shadow.test.ts`, `cache-command.test.ts`, `ci-lane-timings*.test.ts`;
`bun run beep lint effect-vitest --write` (new test file → inventory row; review the diff touches
only the new file); the JSDoc ratchet (`bun run beep lint --help` lists it) at zero introduced;
`bunx biome check <touched files>`; `bun run beep quality package-verify @beep/repo-cli`; new source
files need rows in `standards/coverage.regression-baseline.jsonc` spliced by hand with measured
coverage (precedent: `git show 71a11ae563 -- standards/coverage.regression-baseline.jsonc`);
`bun run beep lint package-scripts --write` only if a manifest script changed (it should not).
PLAN.md A3 is ticked in this PR with the date and the rulings; decisions.md gains a "round 23" (round 22 is reserved by the concurrent pr-event-awareness amendments)
section with rulings 73–75 verbatim from this note; OPPORTUNITIES.md gets a receipt for findings 0.1
and 0.3 (the A1 close re-run inherits them until the script is fixed).
