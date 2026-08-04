# PR-A part 3 implementation report

Date: 2026-08-04

Worktree: `/home/elpresidank/YeeBois/projects/beep-effect3-pra`

Branch: `feat/pipeline-speed`

## Per-item status

1. **Timing fields — complete**
   - `RepoStepRunResult` now carries `startedAt`, `endedAt`, and
     `elapsedMs`; both captured and streaming repo-run executors populate
     them.
   - Yeet wraps special/nonstandard steps at the phase boundary so every
     returned Yeet step result has timing.
   - `yeet-verdict/v2` adds run-level `startedAt`, `endedAt`,
     `elapsedMs`, `attemptId`, `failedStepId`, and `failureKind`.
     Failure attribution uses a returned nonzero step when present and the
     current first-unreturned plan step for Handler-channel errors.

2. **Attempt journal — complete**
   - Added branch-run `attempts.ndjson` beside `verdict.json`.
   - A schema-valid `attempt-started` event is appended and synced before
     execution. A schema-valid `attempt-finished` event embeds the exact
     terminal verdict after `verdict.json` is written.
   - Start-write failure fails closed. Terminal-write failure is reported
     without replacing an existing primary Yeet error.
   - Retention keeps the newest 50 attempt starts and their following events.
   - Plan and status modes do not journal; a live status run confirmed no
     `attempts.ndjson` was created.

3. **Fallow envelope mode split — complete**
   - Fixed names are `<feature>.check.json` and
     `<feature>.advisory.json`.
   - Producer defaults, CI orchestration, workflow validation/summary, the CI
     contract checker, and the Yeet advisory consumer use the split names.
   - Yeet injects the current attempt start timestamp into the advisory
     consumer; malformed or older advisory envelopes are rejected.

4. **Agent-effectiveness elapsed time — complete**
   - Scoring is wrapped with `Effect.timed`.
   - The measured duration is threaded through the schema-modeled record
     options into `AiMetricsBenchmarkRunInput.elapsedMs`; the hard-coded zero
     is gone.

5. **Integration split — complete**
   - Added `test:integration:parallel` to exactly 22 packages.
   - Added `test:integration:serial` to exactly
     `@beep/drizzle`, `@beep/postgres`, and `@beep/test-utils`.
   - Existing package-local `test:integration` scripts remain unchanged.
   - `turbo.json` registers both task names.
   - Root test execution runs the bounded parallel pass first, then provisions
     SQL and runs the serial pass with `--concurrency=1`; failures from both
     sequential passes are accumulated.
   - Static planning emits the same order.

6. **Unresolved-comments closeout gate — complete**
   - Remote status performs one GraphQL review-thread query per status check.
   - The remote schema/output includes unresolved count and thread IDs/paths.
   - Status merge guidance and monitor/publish-monitor merge readiness require
     zero unresolved threads; errors name the threads.
   - Closeout now includes every unresolved thread, including outdated threads,
     until it is explicitly resolved.
   - The Yeet skill law was updated to the same zero-unresolved rule.

7. **Rerun-failed — complete (suggest-only v1)**
   - Remote status records matching failed workflow runs for the PR head SHA.
   - When the same SHA has a successful local verdict and hosted red, the next
     command is `gh run rerun <run-id> --failed` instead of push guidance.
   - Monitor and publish-monitor error output records the same-SHA decision and
     suggested command. No GitHub write is invoked automatically.

## Schema changes

- `RepoStepRunResult`: optional wire-compatible
  `startedAt`/`endedAt`/`elapsedMs`, populated by real execution.
- `YeetVerdict`: version bumped from `yeet-verdict/v1` to
  `yeet-verdict/v2`; new required attempt/run timing fields and optional
  failure attribution.
- `YeetFailureKind`: `step-exit | handler-error`.
- `YeetAttemptStarted` and `YeetAttemptFinished`, united by
  `YeetAttemptJournalEvent` at
  `yeet-attempt-journal/v1`.
- `YeetStatusRemote`: unresolved-thread inventory plus rerun-failed command
  and decision fields.
- Added schema-backed minimal GitHub review-thread and workflow-run payloads.

Decode/round-trip coverage includes repository-step timing, verdict v2,
attempt-journal events and retention, Fallow freshness, and remote status
thread/rerun fields.

## Verification

- Repo-cli source overlay tsgo:
  `bunx tsgo -p /tmp/repo-cli-pra-overlay.json --pretty false`
  - **0 errors**
- Targeted Vitest:
  - `quality-tasks.test.ts`
  - `ci-lane.test.ts`
  - `yeet.test.ts`
  - `agent-effectiveness-eval-scorer.test.ts`
  - **4 files, 177 tests passed**
- Fallow workflow contract:
  `bun run beep quality fallow ci-contract-check .github/workflows/check.yml --expect-blocking-lanes audit,dead-code --require-upload --advisory`
  - **green**
- Package manifest JSON validation:
  - **135 manifests decoded**
  - **22 parallel / 3 serial integration owners**
- `bun run beep yeet status`
  - **exit 0**
  - local-only status, dirty worktree reported honestly
  - status did not create a journal attempt
- `git diff --check`
  - **green**

No install, Turbo execution, full verify, commit, push, PR mutation, or
automatic workflow rerun was performed.

## Deviations and bounded choices

- The requested `publish-scope.test.ts` file does not exist in this checkout;
  publish-scope tests are part of `yeet.test.ts` and were included.
- The one-query status contract reads the first 100 review threads. If GitHub
  reports another page, status adds a named truncation marker and remains
  non-merge-ready rather than issuing another GraphQL query or claiming zero.
- Bounded retention necessarily compacts the NDJSON file after append once a
  51st attempt appears. Events are append-only during normal writes; compaction
  rewrites the whole retained suffix rather than editing individual events.
- Remote GitHub behavior was not exercised against a live PR because the
  requested verification was local `yeet status`; remote payloads and
  decisions are covered by schema/behavior tests.
