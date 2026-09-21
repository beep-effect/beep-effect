# B5 review round 1 brief — PR #1143 threads

Owner: Fable orchestrator. Implementer: one Codex `codex exec` lane (`gpt-6-astra`, reasoning
`medium`, `workspace-write`) in worktree `~/YeeBois/projects/beep-effect21-worktrees/ttc-b5` on
branch `ttc/b5-detached-proof-jobs` (PR #1143, head `1aee123ecf`). No git writes, no graft. Results:
append `## Review round 1` to `goals/time-to-certainty/research/b5-implementation.md` (decisions,
rejected alternatives, `### Review round 1 — files`, verification table with exit codes). Friction
receipts in `research/OPPORTUNITIES.md` at the moment they happen (redacted, `~` for home).

Read first: `research/b5-brief.md`, rulings 35–40 in `research/decisions.md`,
`commands/Yeet/internal/ProofJobLauncher.ts` (whole file), `ProofJob.ts`, `Yeet.command.ts`
(`jobStatusCommand`, `jobFinalizeCommand`, `renderJob`), `test/proof-job.test.ts`,
`internal/repo-run/AttemptTerminationJournal.ts` (`acquireJournalFileLock` /
`releaseJournalFileLock`, the stale-lock takeover), `internal/repo-run/JournalFile.ts`,
`internal/cli/FsGuards.ts`, `.repos/effect` for every Effect v4 API.

## Threads and the fix each one gets

1. **P1 — unsynchronized job-record read-modify-write** (`ProofJobLauncher.ts` `cancel` L~393;
   thread PRRT_kwDOPbO_N86ixI15). Every record transition — `markRunning`, `markFinished`,
   `cancel`, `finalize`, and the reconcile inside `read` — becomes an atomic
   read-modify-write under a per-job lock file `<jobId>.lock` next to the record (exclusive
   create with a `pid:procStart:nonce` token, bounded retries, stale-lock takeover fenced by the
   holder's process identity — reuse or export the journal lock helpers rather than writing a
   third lock). Inside the lock the transition re-reads the record and applies its rule:
   `cancel` never downgrades a terminal record (`already-terminal`) and only adds
   `cancelRequestedAt`; `markFinished` never overwrites `terminated` or an existing systemd
   stamp; `finalize` decides `finished`-stamp vs `terminated` from the record it re-read inside
   the lock, so a cancel that landed first maps to `cancelled` and a finalize that landed first is
   never reverted. Publish (inbox row + journal row) stays idempotent and runs inside the lock.
   This is a per-record file mutex for the record's own consistency, not an admission lock —
   say so in one sentence of JSDoc and in the results file (the packet forbids a new scheduler
   or admission lock, not this).
   Tests: (a) `Effect.all([cancel, finalize], { concurrency: "unbounded" })` repeated over a
   deterministic set of interleavings with an artificially slow `save` (inject a delay through
   the test layer or a `Ref`-driven barrier), asserting the final record is terminal, carries the
   systemd stamp, and — whenever `cancelRequestedAt` was recorded before the finalize read —
   has reason `cancelled`; never a non-terminal snapshot after finalize returned; (b) cancel
   after finalize → `already-terminal`, stamp intact; (c) `markFinished` after `finalize` leaves
   `terminated` untouched; (d) the lock file is removed after each transition and a stale lock
   from a dead pid is taken over.

2. **P1 — `finished` skips finalizer-missing reconciliation** (`read` L~255;
   PRRT_kwDOPbO_N86ixI5w). `read` reconciles a record that is `submitted`, `running`, or
   `finished` without a systemd stamp: when the unit is `not-found` and the runner (or, before a
   runner exists, the submitter) identity is dead, a `finished` record gains a systemd stamp
   `{ serviceResult: "unknown", exitCode: none, exitStatus: none, invocationId: unit.invocationId,
   finalizedAt: now }` and keeps `finished` (the inbox row is published from the verdict, P2/P1 by
   ruling 37); `submitted`/`running` still become `terminated / finalizer-missing`. `wait`'s
   settle rule (terminated, or stamped) is unchanged and now reachable. Tests: markFinished →
   dead runner + not-found unit → `read` returns `finished` with `systemd.serviceResult ===
   "unknown"` and exactly one inbox row; `wait` returns that record and acks it.

3. **P2 — contract wording** (`ProofJobLauncher.ts` module Details L~66-72; PRRT_kwDOPbO_N86ixI5e).
   Rewrite the header and the `ProofJobRecord` **Details** in `ProofJob.ts`: the job's CLI writes
   `finished` (`markFinished`); `finalize` is the only writer of `terminated` and of the systemd
   stamp; a job is *settled* when it is `terminated` or carries a stamp; `wait`, `prune`, and
   the inbox row use that one definition. Add an `isSettledProofJob(record)` helper in
   `ProofJob.ts` (exported, JSDoc example) and use it in `wait` and `prune` instead of the two
   inline predicates. Append one amendment line under ruling 36 in `research/decisions.md`
   ("Amendment, review round 1 (2026-09-15): …") — never rewrite the ratified text.

4. **P2 — `jobStatus` ignores `systemctl show` nonzero exit** (`Yeet.command.ts` L~702-709;
   PRRT_kwDOPbO_N86ixLRl and PRRT_kwDOPbO_N86ixYeh). Branch on `result.exitCode`: nonzero →
   telemetry absent (`null` in `--json`, a one-line "unit not loaded" note in text) instead of
   printing the failure output as telemetry. Wiring test with a PATH-shimmed `systemctl` that
   exits 1.

5. **P2 — bind `job finalize` to its job** (`Yeet.command.ts` L~777-792; PRRT_kwDOPbO_N86ixLRm).
   `jobFinalizeCommand` requires `BEEP_YEET_JOB_ID` to equal the argument and
   `BEEP_YEET_JOB_UNIT` to equal `proofJobUnitName(jobId)` (both set on the unit by
   `proofJobSystemdRunArguments`, so `ExecStopPost` sees them); when the record carries
   `unit.invocationId` and `INVOCATION_ID` is present they must match. Any mismatch fails with a
   `YeetCommandError` naming the variable. JSDoc states this is an accident fence for same-user
   processes, not an authorization boundary. Tests through `Command.runWith` with and without the
   variables (ConfigProvider layer).

6. **Docs — journal coverage claim** (PLAN.md B5 line L~72-74, `ops/manifest.json` statusNote,
   AGENTS.md Quality Operator bullet; PRRT_kwDOPbO_N86ixLRW). `job-start-failed` happens before
   any runner attempt exists, so it is a job-record reason only: the finalizer journals
   `attempt-terminated` for every dead **runner** (`signal`, `oom-killed`, `timeout`,
   `cancelled`, `unrecorded-failure`), and a start failure is a terminal job record plus an
   inbox row. Fix the three sentences; add an amendment line under ruling 38.

7. **Docs — brief amendments** (`research/b5-brief.md`; PRRT_kwDOPbO_N86ixLRb and
   PRRT_kwDOPbO_N86ixLRh). Append `## Amendments (2026-09-15, review round 1)`: (a) the
   arbitrary API is `Arbitrary.schema` / `Arbitrary.sampleEffect` from
   `effect/unstable/arbitrary` with `it.effect.prop` (installed Effect exports neither
   `FastCheck` from `effect/testing` nor `Schema.toArbitrary`); (b) the verification list gains
   `bun run beep lint effect-vitest`, `bunx oxlint --disable-nested-config <touched files>` and
   `bun run beep quality test-tsgo`. Do not rewrite the original stage text.

## Coverage restoration (the third local proof's only red; hosted `Heavy / Coverage Regression` will report the same)

The per-file ratchet (`beep-cli coverage` against `standards/coverage.regression-baseline.jsonc`)
judges changed-package rows at the base floor; lowering a row in this PR does not pass. Restore
every row below with tests (rows are lines / statements / branches / functions):

| File | Measured | Floor |
| --- | --- | --- |
| `commands/Yeet/Yeet.command.ts` | 66.21 / 62.91 / 24.07 / 52.08 (uncovered 75 lines, 89 statements, 41 branches, 23 functions) | 96.77 / 92.36 / 100 / 67.74 |
| `commands/Yeet/internal/Ack.ts` | 96.66 / 96.66 / 100 / 88.88 (1 line, 1 function) | 100 / 100 / 100 / 100 |
| `commands/Yeet/internal/Handler.ts` | 48.79 / 47.03 / 36.5 / 38.03 | 49.39 / 47.5 / 37 / 38.27 |
| `commands/Yeet/internal/Inbox.ts` | 97.43 / 97.56 / 100 / 93.54 (2 lines, 2 functions) | 100 / 100 / 100 / 100 |
| `commands/Yeet/internal/InboxPorcelain.ts` | 98.92 / 98.94 / 95.31 / 100 (1 line, 3 branches) | 100 / 100 / 100 / 100 |
| `internal/repo-run/AttemptTerminationJournal.ts` | 98.99 / 98.55 / 95.23 / 100 (2 lines, 3 branches) | 100 / 100 / 100 / 100 |

The uncovered code is the B5 surface: the `job list|status|wait|logs|cancel|finalize` handlers
and the `--detach` branch in `Yeet.command.ts`, the `observed` render/ack branches in `Ack.ts`
and `InboxPorcelain.ts`, the `proof-job-finished` describe/id functions in `Inbox.ts`,
`updateProofJobBookkeeping` in `Handler.ts`, and `appendProofJobAttemptTerminated`'s early
returns (missing journal, busy lock, no start row, terminal row present). Drive each handler
through `Command.runWith(yeetCommand, …)` against a temp checkout (record files under
`.beep/yeet/jobs/`, PATH-shimmed `systemctl`/`systemd-run`, a `ConfigProvider` layer for
`BEEP_YEET_JOB_*`, `SERVICE_RESULT`, `EXIT_CODE`, `EXIT_STATUS`, `INVOCATION_ID`), including
`--json` and the error branches. Yeet.command.ts must reach 100 % branches: every `if`/ternary/
`O.match` arm in the new handlers needs a case. If a branch is genuinely unreachable from a test,
restructure the code (pure helper in `ProofJob.ts` with its own tests) rather than leave it.

Faithful local proof, from `packages/tooling/tool/cli` on Node (matches hosted to two decimals):

```sh
CI=true bunx vitest run --coverage --coverage.include='src/commands/Yeet/Yeet.command.ts' \
  --coverage.reporter=lcov --coverage.reportsDirectory=/tmp/b5-cov \
  --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 \
  --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 \
  test/yeet-command-wiring.test.ts test/proof-job.test.ts <every test that exercises the file>
```

then read `LH/LF`, `FNH/FNF`, `BRH/BRF` from `/tmp/b5-cov/lcov.info` and list the remaining
`DA:<line>,0` / `BRDA:…,0` / `FNDA:0,<fn>` lines. Repeat per file until each row is at or above
its floor; record the final numbers per file in the results table.

## Verification the lane runs (report exit codes)

- `bunx --bun vitest run packages/tooling/tool/cli/test/proof-job.test.ts
  packages/tooling/tool/cli/test/yeet-command-wiring.test.ts --pool=threads` (Fable reruns on the
  default pool).
- `bunx biome check --write <touched files>`; `bunx oxlint --disable-nested-config <touched
  files>` (must print no `beep(...)` error); `bun run beep lint effect-vitest` (0 new findings —
  use canon primitives for new tests: `it.layer(L, { timeout: "30 seconds" })`, `assertTrue`,
  `it.live` only with a comment reason); `bun run beep lint schema-first`; `bun run beep quality
  fallow audit --check --base origin/main`; `bun run beep quality fallow health --check --base
  origin/main`; `bun run beep lint jsdoc --package packages/tooling/tool/cli`.
- `bun run beep quality test-tsgo` and `bunx turbo run check --filter=@beep/repo-cli` only if the
  sandbox permits (expect `spawnSync node EPERM`; say "blocked by sandbox" in one line).

## Hard file-scope rule

Touch only: `packages/tooling/tool/cli/src/commands/Yeet/internal/{ProofJob.ts,ProofJobLauncher.ts,Ack.ts,Inbox.ts,InboxPorcelain.ts,Handler.ts}`,
`packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts`,
`packages/tooling/tool/cli/src/internal/repo-run/{AttemptTerminationJournal.ts,JournalFile.ts}`
(only to export or extract the lock helpers), `packages/tooling/tool/cli/test/**`, `AGENTS.md`
(one bullet), and under `goals/time-to-certainty/`: `PLAN.md` (the B5 line only),
`ops/manifest.json` (statusNote only), `research/decisions.md` (amendment lines only),
`research/b5-brief.md` (amendments section only), `research/b5-implementation.md`,
`research/OPPORTUNITIES.md`. Never edit `.claude/settings.json`, `turbo.json`, `package.json`,
or `standards/effect-vitest.inventory.jsonc` (Fable refreshes it). Repo laws apply: Effect v4 from
`.repos/effect`, `Effect.fn`/`Effect.fnUntraced`, no plain Set/Map, LiteralKit without `as const`,
JSDoc `**Example** (Title)` with an observable result on every export, exported multi-argument
functions are `dual`, compiled schema codecs (`S.decodeEffect(...)`, `S.is(...)`, …) live at module
scope, `@beep/*` imports in tests.
