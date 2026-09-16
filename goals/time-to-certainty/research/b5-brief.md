# B5 implementation brief — detached durable proof jobs

Owner: Fable orchestrator. Implementer: one Codex `codex exec` lane (`gpt-6-astra`, reasoning
`medium`, `workspace-write`) in worktree `~/YeeBois/projects/beep-effect21-worktrees/ttc-b5` on
branch `ttc/b5-detached-proof-jobs`. The lane makes **no git writes** (Fable stages listed paths by
name and signs commits) and runs **no graft commands**. Results file:
`goals/time-to-certainty/research/b5-implementation.md` (one `## Stage <X>` per stage with
decisions + rejected alternatives, `### Stage <X> — files`, a verification table with exit codes,
measurements, blockers). Friction receipts go to `goals/time-to-certainty/research/OPPORTUNITIES.md`
at the moment they happen (public repo: redact, `~` for home, minimal error text).

## Read first

1. `research/decisions.md` rulings 35–40 (this item's design; binding), rulings 11–18 (journal
   facts, terminal tags, stale-start reconciliation), `SPEC.md` B5/B6/M5.
2. The orchestrator-written schema and contract, which the lane implements against and may extend
   only with a recorded reason: `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJob.ts`
   and `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJobLauncher.ts` (both already
   re-exported from `src/test/Yeet.test-kit.ts`; add `make` to the `ProofJobLauncher` class in the
   `ProofLedger` idiom, constructed per checkout root, and export any new pure helpers from
   `ProofJob.ts` or a sibling so docgen examples can import them from `@beep/repo-cli/test/Yeet`).
3. Code: `internal/repo-run/RunScope.ts` (+ `.schemas.ts`, `test/run-scope.test.ts` — the PATH-shim
   idiom for `busctl`/`systemctl` that the new tests copy for `systemd-run`),
   `internal/repo-run/QualityScheduler.ts` (`enterRunScope` call ~L1850, `runScopeUnitNamesForLease`
   and `deadLeaseScopePlan` ~L2376–2420), `internal/repo-run/AttemptTerminationJournal.ts`
   (`YeetAttemptTerminationReason`, `reconcileJournalLocked`, journal lock),
   `commands/Yeet/internal/AttemptJournal.ts` (`appendYeetAttemptJournalEvent`),
   `commands/Yeet/internal/Handler.ts` (`makeYeetAttempt` ~L1646, `ensureAttemptTerminated`
   ~L1555, `runPlanExecution`), `commands/Yeet/internal/Inbox.ts` (row union, ids,
   `describeYeetInboxRow`, `appendYeetInboxRowOnce`), `commands/Yeet/internal/Ack.ts`
   (`YeetAckResolution`, `writeYeetAckReceipt`), `commands/Yeet/internal/InboxPorcelain.ts`,
   `commands/Yeet/Yeet.command.ts` (flag tables, `runYeetMode`, subcommand registration),
   `commands/Yeet/internal/Guards.ts` (option legality table), `commands/Yeet/internal/ProofLedger.ts`
   (the `Context.Service` + `make` idiom to mirror), `internal/repo-run/RepoRun.executor.ts`
   (`runRepoCommandCapture`), `internal/cli/FsGuards.ts` (contained reads/writes),
   `internal/repo-run/JournalFile.ts` (`publishJournalTextAtomically`),
   `.claude/hooks/yeet-inbox.sh` (`row_label` jq), `test/yeet-inbox-hook-adapter.test.ts`,
   `research/scripts/economics.py` (`ATTEMPT_TERMINATION_REASONS`), `.repos/effect` for every
   Effect v4 API (never training-data priors).

## Why (measured)

On 2026-09-03 two Codex sessions and one `nohup` publish died mid tool-call with nothing in the
scheduler journal, the user journal, the OOM log or the Codex rollout; the one long process that
survived ran in its own systemd user scope. 327 of 3,069 started attempts (10.7%) had no finish row
in the P0 baseline (M5). A5 made abnormal ends journal `attempt-terminated` when the process can
still write, and the reconciler closes `owner-dead` starts on the next run — but nothing today
survives a SIGKILL of the submitter's process group, and nothing tells the successor session what
happened. Probes on this workstation (systemd 261) proved the mechanism in ruling 35's inputs.

## Systemd facts the implementation relies on (probed 2026-09-15)

- `systemd-run --user --unit=<u> --collect --quiet --service-type=exec --slice=agent-runs.slice
  --working-directory=<dir> --setenv=K=V … -p 'ExecStopPost=<quoted words>' -p
  'StandardOutput=append:<log>' -p 'StandardError=append:<log>' -p TimeoutStopSec=60
  [-p RuntimeMaxSec=<s>] -- <execPath> <entrypoint> yeet <words…>` returns 0 once the exec
  succeeded and non-zero (with a message) when the binary cannot be executed.
- `ExecStopPost` runs after the main process ends with env `SERVICE_RESULT` (`success`,
  `protocol`, `timeout`, `exit-code`, `signal`, `core-dump`, `watchdog`, `exec-condition`,
  `oom-kill`, `start-limit-hit`, `resources`), `EXIT_CODE` (`exited` | `killed` | `dumped`) and
  `EXIT_STATUS` (a number or a signal name such as `KILL`); `INVOCATION_ID` is set for both lines.
  Verified for `exit 3` and for `kill -KILL <MainPID>`.
- After `ExecStopPost` finishes the unit is unloaded (`systemctl --user show <u> -p LoadState
  --value` → `not-found`), so nothing leaks and the reaper's stop reads as `absent`.
- `systemctl --user show <u> -p ActiveState,SubState,MainPID,MemoryPeak,TasksCurrent` works for
  services exactly as `readRunScopeTelemetry` uses it for scopes.
- The Bash tool and the user manager both have `XDG_RUNTIME_DIR=/run/user/<uid>` and
  `DBUS_SESSION_BUS_ADDRESS`; the receipt of 2026-09-03 was an `env -i` launch. Forward both
  (ruling 39) so the finalizer's `systemctl` and a `cancel` from a scrubbed shell still work.
- `process.execPath` under `bun run beep` is the real bun binary
  (`~/.local/share/mise/installs/bun/<v>/bin/bun`), not the mise shim; `Bun.argv.slice(2)` /
  `process.argv.slice(2)` starts at the first user word (`yeet`).

## Stages — one commit each (Fable commits), both stages in this launch

### Stage A — store, launcher, finalizer, journal, scheduler seams (schema → contract → impl)

1. **Record store** (`ProofJobLauncher.make(repoRoot)` per ruling 36): `.beep/yeet/jobs/<jobId>.json`
   + `<jobId>.log`, written/rewritten atomically (reuse `publishJournalTextAtomically` or the
   contained-write guards; no new lock), read with the no-follow guards; `list` newest-first by
   `submittedAt`; `prune(keepTerminal)` deletes the oldest terminal records and their logs beyond
   the budget; `read`/`list`/`wait` reconcile `submitted`/`running` records whose unit is
   `not-found` and whose runner pid identity is dead into `terminated / finalizer-missing`
   (use `ProcessIdentity.ts` probes, never pid-only liveness).
2. **Launcher** `submit`: `support` first (ruling 40; `detectRunScopeSupport`), allocate the job id
   (`crypto.randomUUID` through Effect's `Crypto`/the repo's existing UUID source), build the
   record (`phase: submitted`), write it, compose the `systemd-run` argv from the record with the
   exported pure function `proofJobSystemdRunArguments`, spawn through `runRepoCommandCapture`
   (`ChildProcessSpawner`), and on a non-zero exit mark the record `terminated / job-start-failed`
   (systemd result `unknown`) and fail with `YeetCommandError` carrying the captured output. The
   environment is computed by the exported pure `forwardedProofJobEnvironment(env)` per ruling 39.
   Submit-only flags are removed by the exported pure `stripProofJobSubmitFlags(argv)`
   (`--detach`, `--job-max-runtime <value>` and `--job-max-runtime=<value>`).
3. **Runner hooks**: when `BEEP_YEET_JOB_ID` is set, the Yeet handler calls `markRunning` right
   after the attempt-started row is written (pid, `processStartIdentityForPid`, attempt id,
   `INVOCATION_ID` when present) and `markFinished` where the ordinary `attempt-finished` row is
   written (verdict outcome, verdict artifact path, elapsed ms). Failures of these bookkeeping
   writes are logged, never fatal to the proof.
4. **Finalizer** `finalize(jobId, systemd)` per rulings 36–38: stamp; derive the terminal phase and
   reason (`cancelRequestedAt` wins → `cancelled`); when the phase becomes `terminated` and the
   record carries an attempt id, append `attempt-terminated` for it under the journal lock only if
   that attempt has no terminal row (put the helper next to `reconcileJournalLocked`, reuse its
   locked read/append); append the inbox row through `appendYeetInboxRowOnce` (severity per
   ruling 37); return `ProofJobFinalization`. Second call: no second row, `duplicate: true`.
5. **RunScope short-circuit** (ruling 35): `enterRunScope` returns
   `RunScopeRecord { unitName: BEEP_YEET_JOB_UNIT, support: "active", attachedPid }` without
   spawning `busctl` when that variable names a `beep-proof-*.service`; `runScopeCleanupHint`
   says the service is collected by systemd when the job ends.
6. **Reaper** (ruling 35): `deadLeaseScopePlan` treats a recorded `isProofJobUnitName` unit on a
   dead lease as `{ _tag: "stop", unitName }` (not `recorded-unit-mismatch`); `stopRunScopeForReap`
   already maps a collected unit to `absent`.
7. **Journal vocabulary** (ruling 38): extend `YeetAttemptTerminationReason` and
   `research/scripts/economics.py` `ATTEMPT_TERMINATION_REASONS`.
8. **Inbox + ack** (ruling 37): `YeetProofJobFinishedRow` (`kind: "proof-job-finished"`, capsule
   `YeetProofJobCapsule` from `ProofJob.ts`, severity `P1 | P2`) joins the `YeetInboxRow` union,
   `yeetProofJobRowId`, `yeetInboxExpectedRowId`, `describeYeetInboxRow`; `YeetAckObservedResolution`
   (`kind: "observed"`, `via`) joins `YeetAckResolution` and `renderYeetAckResolution`.
9. **Tests** (`packages/tooling/tool/cli/test/proof-job*.test.ts`, `@effect/vitest`, `@beep/*`
   imports only): schema round-trips through `S.toArbitrary(schema)(fc)` for every `ProofJob.ts`
   class and literal domain (`fc` is `FastCheck` from `effect/testing`); `stripProofJobSubmitFlags`
   and `forwardedProofJobEnvironment` (a `TURBO_TOKEN`, an `OP_SERVICE_ACCOUNT_TOKEN` and a
   `BEEP_FOO_KEY` in the input never reach the output; `BEEP_RUN_SCOPES` does; values never
   appear in the record); `proofJobSystemdRunArguments` (unit name, slice, `--collect`,
   `--service-type=exec`, working directory, both `append:` properties, `TimeoutStopSec=60`,
   the quoted `ExecStopPost` line, optional `RuntimeMaxSec`, ExecStart words = execPath +
   entrypoint + `yeet` + argv without submit-only flags); `submit` against a PATH-shimmed
   `systemd-run` that records argv (exit 0 → record `submitted` with unit fields; exit 1 →
   `terminated / job-start-failed` + `YeetCommandError`); `support` unsupported → error and no
   record; `finalize` matrix: `finished`+`success` → P2 row, no journal row; `running`+
   `signal/killed/KILL` → `terminated/signal`, one `attempt-terminated` (reason `signal`) in the
   branch journal, P1 row; `oom-kill` → `oom-killed`; `timeout` → `timeout`; `protocol` →
   `job-start-failed`; `cancelRequestedAt` set → `cancelled`; a start that already has a terminal
   row gets no second journal row; a second `finalize` returns `duplicate: true` and appends no
   second inbox row; `wait` returns the terminal record (use a `TestClock`-free polling loop with
   a short interval; the existing `excludeTestServices: true` idiom if needed), times out with a
   `YeetCommandError`, and acks the row `observed/job-wait`; `cancel` writes `cancelRequestedAt`
   then calls the PATH-shimmed `systemctl stop`; reconcile of a dead `running` record →
   `finalizer-missing` + P1 row; the RunScope short-circuit under `BEEP_YEET_JOB_UNIT`; the reaper
   plan for a dead lease with a recorded job unit (`quality-scheduler*.test.ts` idiom).

### Stage B — CLI surface, hook, docs

1. `--detach` (boolean) and `--job-max-runtime <duration>` on `verify`, `publish`, `closeout`,
   `monitor`, `repair` (not `status`, not `pre-push-hook`); `runYeetMode` branches before any
   planning when `detach` is set: hydrate only what the record needs (repo root, branch, base,
   resolved head), build the submission from `process.execPath`, `process.argv[1]` (resolved
   absolute against the cwd), `process.argv.slice(2)` (drop a leading `--`; the first word must
   be `yeet`), the submitter facts (pid, `processStartIdentityForPid`, cwd), call `submit`, print
   per ruling 40 (`--json` → the record as JSON), exit 0. Guards: `--detach` with `--plan`
   rejected; `--detach` inside a job (`BEEP_YEET_JOB_ID` set) rejected (no recursive detach).
2. `yeet job` subcommand group: `list [--json]`, `status <jobId> [--json] [--ack]` (live
   `ActiveState/SubState/MainPID/MemoryPeak` via `systemctl --user show` while not terminal),
   `wait <jobId> [--timeout <duration>] [--json]` (exit 0 green, 1 red, 2 terminated; acks
   `observed/job-wait`), `logs <jobId> [--tail <n>]`, `cancel <jobId>`, and the hidden
   `finalize <jobId>` that reads `SERVICE_RESULT`, `EXIT_CODE`, `EXIT_STATUS`, `INVOCATION_ID`
   from the process environment through the Effect config provider (all optional; missing →
   `unknown`). `yeet inbox ack <id> --observed` (via `inbox-ack`).
3. Hook: `.claude/hooks/yeet-inbox.sh` `row_label` gains `.capsule.jobId` in the jq fallback
   chain and `render_context` lists the `--observed` form; extend
   `test/yeet-inbox-hook-adapter.test.ts` with a P2 job row (SessionStart surfaces it, PreToolUse
   does not) and a P1 job row (PreToolUse injects it without denying).
4. Wiring tests in `test/yeet-command-wiring.test.ts` (the `job` group and the five `--detach`
   commands register; `status`/`pre-push-hook` do not accept `--detach`); guard tests.
5. Docs: `.claude/skills/yeet/SKILL.md` — a "Detached durable jobs" block under Canonical
   Commands (submit, wait, status, logs, cancel; when to use); `AGENTS.md` Quality Operator — one
   bullet after the `agent-run-<ticket>.scope` bullet naming `beep-proof-<jobId>.service`,
   `--detach`, `yeet job wait`, and that a job death is journaled by the finalizer.
6. `bun run beep lint package-scripts --write` if any scripts block changed (none expected).

## Verification the lane runs (report exit codes in the results file)

- `bunx --bun vitest run packages/tooling/tool/cli/test/proof-job*.test.ts
  packages/tooling/tool/cli/test/run-scope.test.ts packages/tooling/tool/cli/test/quality-scheduler.test.ts
  packages/tooling/tool/cli/test/yeet-inbox*.test.ts packages/tooling/tool/cli/test/yeet-ack.test.ts
  packages/tooling/tool/cli/test/yeet-command-wiring.test.ts --pool=threads` (the sandbox denies
  the forks pool; Fable reruns on the default pool).
- `bun run beep lint schema-first`, `bun run beep quality fallow audit --check --base origin/main`,
  `bun run beep quality fallow health --check --base origin/main`, `bun run beep lint laws
  --package packages/tooling/tool/cli` (if present), `bunx biome check --write <touched files>`,
  `bun run beep lint jsdoc` scoped to touched files if available.
- Type gates (`bun run beep quality test-tsgo`, `bunx turbo run check --filter=@beep/repo-cli`,
  `bun run beep quality package-verify @beep/repo-cli`) only if permitted — the sandbox usually
  denies the tsgo shim's `node` spawn (`spawnSync node EPERM`); report "blocked by sandbox" in one
  line and do not write a receipt for that condition alone. Fable runs them before committing.
- The live workstation smoke (`bun run beep yeet verify --tier cheap-gates --detach` →
  `yeet job wait`) is Fable's, not the lane's.

## Hard file-scope rule

Touch only: `packages/tooling/tool/cli/src/commands/Yeet/**`, `packages/tooling/tool/cli/src/internal/repo-run/{RunScope.ts,RunScope.schemas.ts,QualityScheduler.ts,QualityScheduler.schemas.ts,AttemptTerminationJournal.ts}`,
`packages/tooling/tool/cli/test/**`, `.claude/hooks/yeet-inbox.sh`, `.claude/skills/yeet/SKILL.md`,
`AGENTS.md`, `goals/time-to-certainty/research/{b5-implementation.md,OPPORTUNITIES.md,scripts/economics.py}`.
Never edit `.claude/settings.json`, `turbo.json`, `package.json` scripts, or any file under `goals/`
other than the three named. Do not add `as const` to inline `LiteralKit([...])` arrays; JSDoc on
every export uses `**Example** (Title)` with an observable result; no plain `Set`/`Map`; no
`node:http`; Effect helpers over native helpers; `Effect.fn`/`Effect.fnUntraced` for generators.

## Amendments (2026-09-15, review round 1)

- Property tests use `Arbitrary.schema` / `Arbitrary.sampleEffect` from
  `effect/unstable/arbitrary` with `it.effect.prop`. The installed Effect exports
  neither `FastCheck` from `effect/testing` nor `Schema.toArbitrary`.
- The verification list also requires `bun run beep lint effect-vitest`,
  `bunx oxlint --disable-nested-config <touched files>`, and
  `bun run beep quality test-tsgo`.
