# B5 implementation handoff

Implementation lane: `ttc/b5-detached-proof-jobs`. Both stages are implemented in the
working tree. No git write command or graft command was run. No package manifest,
`turbo.json`, or `.claude/settings.json` was edited. Fable owns staging and commits.

The file lists below name this lane's authored paths, including the pre-existing,
orchestrator-written job schema and launcher contract that this lane extended.
Concurrent orchestrator changes to `GOAL.md`, `PLAN.md`, `ops/manifest.json`,
`research/decisions.md`, the brief, and `src/test/Yeet.test-kit.ts` were preserved
and are not lane-owned edits. Verification generated ignored `.beep` artifacts;
logs referenced below are temporary `/tmp/b5-*.log` files, not publication artifacts.

## Stage A

Implemented the checkout-scoped `ProofJobLauncher.make` service: atomic contained
record writes, no-follow reads, newest-first listing, terminal-only pruning,
submission through `systemd-run`, normal runner transitions, finalization,
identity-fenced reconciliation, cancellation, and timed waiting. Submission probes
support before creating any record and retains a typed failed-launch record on
spawn or nonzero-exit failure. Environment names are filtered before sensitive
leaves are loaded; only approved names are stored in the record.

The finalizer publishes a P2 green result or P1 red/terminated result, and uses the
existing attempt-journal lock to append a death only when the attempt has no
terminal row. It preserves the start row's immutable proof facts. Repeated
finalization returns the stamp without re-publishing an acknowledged inbox row.
A wait acknowledgment uses `observed/job-wait`; a cancellation request is durable
before `systemctl stop`.

The runner hooks report after `attempt-started` and `attempt-finished`, with
bookkeeping errors logged without failing the proof. Admission adopts the existing
proof service without invoking busctl. A verified dead lease carrying a proof
service authorizes a stop unless a live lease represents the same unit. No new
scheduler, lease, or lock was introduced.

### Decisions and rejected alternatives

- Reused `writeContainedFileString` for atomic publication and
  `readContainedFileStringNoFollow` for containment; rejected raw truncate-and-write.
  UUID allocation uses Effect's `Crypto.randomUUIDv4` and schema decoding.
- Kept the supplied schema fields and service operations. Extended the attempt
  reason domain and Python loader with the four ruled reasons plus
  `finalizer-missing`, so reconciliation also produces a precise M5 journal fact.
- Put `isProofJobUnitName` beside run-scope schemas and re-exported it from
  `ProofJob.ts`; rejected importing the planner/schema graph into the scheduler.
  Re-exported the locked journal helper through the already exposed launcher
  module; did not edit the out-of-scope test-kit barrel.
- Kept only names in `request.forwardedEnvNames`. Denied credential-shaped names
  and `OP_*`, including values hidden beneath the allowed BEEP/TURBO prefixes.
- Quoted ExecStopPost words for systemd, including backslashes, quotes, dollar
  signs, percent specifiers, and newlines. Added `--expand-environment=no`, confirmed
  by local `systemd-run --help`, to preserve literal ExecStart argv. Rejected shell
  command concatenation and parsed-option reserialization.
- Publish journal/inbox effects before the final completion stamp; a retry repairs
  an interrupted finalization. `wait` waits for the systemd stamp on a normal
  finished record before acknowledging it, avoiding an ack-before-inbox race.
- An absent unit alone does not prove a dead job. Reconciliation requires a dead
  process identity; unknown identities remain open. Before a runner exists, use
  the submitter identity to avoid racing initial launch.
- The brief's `FastCheck`/`S.toArbitrary` spellings do not exist in installed Effect
  rc.113 or `.repos/effect`. Used the current `Arbitrary.schema` with
  `it.effect.prop` instead: 18 schema/domain properties, 20 cases each, fixed seed 5.
  Replaced supplied `UUID.makeUnsafe` examples with schema decoding.
- Updated the existing verdict-writer test layer to NodeServices because the
  runner bookkeeping now uses Crypto and ChildProcessSpawner. Rejected leaving
  tests with an incomplete requirements channel merely because jobs are absent.

### Stage A — files

- `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJob.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJobLauncher.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Ack.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Inbox.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/InboxView.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts`
- `packages/tooling/tool/cli/src/internal/repo-run/AttemptTerminationJournal.ts`
- `packages/tooling/tool/cli/src/internal/repo-run/RunScope.ts`
- `packages/tooling/tool/cli/src/internal/repo-run/RunScope.schemas.ts`
- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts`
- `packages/tooling/tool/cli/test/proof-job.test.ts`
- `packages/tooling/tool/cli/test/run-scope.test.ts`
- `packages/tooling/tool/cli/test/quality-scheduler.test.ts`
- `packages/tooling/tool/cli/test/yeet-artifact-writers.test.ts`
- `goals/time-to-certainty/research/scripts/economics.py`
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/b5-implementation.md`

### Verification and measurements

| Exact command | Exit code | Evidence |
| --- | ---: | --- |
| `bun run beep architecture --help` | 0 | Read the architecture command surface; no topology mutation. |
| `bunx --bun vitest run packages/tooling/tool/cli/test/proof-job.test.ts --pool=threads` | 0 final | 35 tests; all 11 job classes and 7 literal domains have generated round trips. Launcher/finalizer/cancel/wait/reconcile/prune/quoting cases pass. Earlier introduced import/API failures are in OPPORTUNITIES. |
| `bunx --bun vitest run packages/tooling/tool/cli/test/proof-job.test.ts packages/tooling/tool/cli/test/run-scope.test.ts --pool=threads` | 0 | Stage A checkpoint: 46 tests, 5.39 seconds, before the additional five recovery tests. |
| `bunx --bun vitest run packages/tooling/tool/cli/test/quality-scheduler.test.ts --pool=threads -t 'stops a dead lease unit'` | 0 | Two targeted reaper cases pass: ordinary scope and proof service. |
| `bunx --bun vitest run packages/tooling/tool/cli/test/proof-job.test.ts packages/tooling/tool/cli/test/quality-scheduler.test.ts --pool=threads` | 0 | Final regression after finalizer idempotence and reaper simplification: 168 tests pass; 23.92 seconds. |
| `bun run beep quality test-tsgo` | 1 | Blocked by sandbox: tsgo's `spawnSync node EPERM`. |
| `bunx tsc --noEmit --incremental false -p packages/tooling/tool/cli/tsconfig.json` | 1 | Supporting command corrected after TS6379: composite projects require incremental settings. |
| `bunx tsc --noEmit --tsBuildInfoFile /tmp/b5.tsbuildinfo -p packages/tooling/tool/cli/tsconfig.json` | 0 final | Supporting full CLI source typecheck, including Effect diagnostics. |
| `bunx tsc --noEmit -p packages/tooling/tool/cli/test/tsconfig.json` | 1 | Supporting command needs rootDir override; TS6059. |
| `bunx tsc --noEmit --rootDir . --composite false --incremental false -p packages/tooling/tool/cli/test/tsconfig.json` | 0 final | Supporting full CLI test typecheck, including Effect diagnostics. |
| `systemd-run --help \| rg 'expand-environment'` | 0 | Confirmed the expansion-control option; did not launch a unit. |

Live systemd submission, submitter death survival, cgroup telemetry, ExecStopPost
environment, and garbage collection remain Fable's workstation smoke. PATH shims
exercise the command boundaries here; they do not prove those kernel/manager facts.

## Stage B

Implemented `--detach` and `--job-max-runtime` for verify, publish, closeout,
monitor, and repair. The detach branch precedes planning, reads only repository
identity and the requested resolved head, and replays the original yeet words.
It rejects `--plan`, recursive detachment, and a runtime ceiling without detach.
Submission prints the id, unit, log, and wait command, or schema-encoded JSON.

Added `yeet job list`, `status [--ack]`, `wait [--timeout]`, `logs [--tail]`,
`cancel`, and an unlisted `finalize`. Status includes live systemctl telemetry for
nonterminal jobs. Wait maps green/red/terminated to 0/1/2. Finalize reads its
optional result variables through the Effect config provider. Added
`inbox ack --observed`, restricted to proof-job rows so it cannot dismiss P0 gates.
The Python economics reader consumes attempt facts; observed receipts do not add
new gate-resolution inputs.

The hook identifies job rows by jobId and advertises the observed ack form. Tests
prove P2 at SessionStart, P1 at PreToolUse, and no denial from the P1 job result.
Updated the Yeet skill and the Quality Operator law with detached-job usage.

### Decisions and rejected alternatives

- Used the existing command tree, handlers, inbox view, and ack ledger; rejected
  a second CLI executable, detached shell processes, or an attached fallback.
- Kept `status` and `pre-push-hook` free of detach flags. Used `Command.unlisted`
  for the systemd-only finalizer while retaining ordinary parser registration.
- `job status --json` emits a record plus telemetry envelope; submit/list/wait
  encode their record schemas directly. No raw Option objects are serialized.
- Kept scripts untouched; package-scripts generation was not needed.
- Bun/threads hits sandbox stdin-pipe EPERM in the hook adapter, including existing
  tests. Kept that named failing run visible and used Node/threads as supplemental
  evidence instead of weakening assertions or changing hook behavior for the sandbox.
- The package verification P0 was acknowledged as environment-only after its log
  showed the same tsgo spawn restriction, not a repository defect.

### Stage B — files

- `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/InboxPorcelain.ts`
- `packages/tooling/tool/cli/test/yeet-command-wiring.test.ts`
- `packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts`
- `.claude/hooks/yeet-inbox.sh`
- `.claude/skills/yeet/SKILL.md`
- `AGENTS.md`
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/b5-implementation.md`

### Verification and measurements

| Exact command | Exit code | Evidence |
| --- | ---: | --- |
| `bunx --bun vitest run packages/tooling/tool/cli/test/proof-job*.test.ts packages/tooling/tool/cli/test/run-scope.test.ts packages/tooling/tool/cli/test/quality-scheduler.test.ts packages/tooling/tool/cli/test/yeet-inbox*.test.ts packages/tooling/tool/cli/test/yeet-ack.test.ts packages/tooling/tool/cli/test/yeet-command-wiring.test.ts --pool=threads` | 1 | Final named run: 286 passed, four hook-adapter failures, 46 Bun stdin-pipe EPERM reports; 47.46 seconds. |
| `node node_modules/vitest/vitest.mjs run packages/tooling/tool/cli/test/proof-job*.test.ts packages/tooling/tool/cli/test/run-scope.test.ts packages/tooling/tool/cli/test/quality-scheduler.test.ts packages/tooling/tool/cli/test/yeet-inbox*.test.ts packages/tooling/tool/cli/test/yeet-ack.test.ts packages/tooling/tool/cli/test/yeet-command-wiring.test.ts --pool=threads` | 0 | All 290 tests in the requested selection pass under Node/threads. |
| `node node_modules/vitest/vitest.mjs run packages/tooling/tool/cli/test/proof-job*.test.ts packages/tooling/tool/cli/test/run-scope.test.ts packages/tooling/tool/cli/test/quality-scheduler.test.ts packages/tooling/tool/cli/test/yeet-inbox*.test.ts packages/tooling/tool/cli/test/yeet-ack.test.ts packages/tooling/tool/cli/test/yeet-command-wiring.test.ts packages/tooling/tool/cli/test/yeet-artifact-writers.test.ts --pool=threads` | 0 | 296 tests across 10 files pass; 54.79 seconds. Adds the changed verdict-writer integration surface. |
| `node node_modules/vitest/vitest.mjs run packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts --pool=threads` | 0 | All five hook tests pass, including new job P1/P2 behavior. |
| `bun run beep lint schema-first` | 0 final | No schema-first advisories. Initial exit 1 fixed by capsule-derived input and real schema property tests. |
| `bun run beep quality fallow audit --check --base origin/main` | 0 final | No findings. Earlier exit 1 findings repaired: duplicated runner bookkeeping extracted to a shared boundary; dead-lease reaper branching simplified to meet complexity limits. |
| `bun run beep quality fallow health --check --base origin/main` | 0 | No findings. |
| `bun run beep lint laws --package packages/tooling/tool/cli` | 0 | Native-runtime, frozen grants, effect-fn, and package-test imports have zero findings; four pre-existing terse-effect advisories outside touched files. |
| `bun run beep lint jsdoc --package packages/tooling/tool/cli` | 0 final | Initial descriptions/spacing warnings repaired. Package-wide scope is the available CLI scope. |
| `bunx biome check --write packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJob.ts packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJobLauncher.ts packages/tooling/tool/cli/src/commands/Yeet/internal/Ack.ts packages/tooling/tool/cli/src/commands/Yeet/internal/Inbox.ts packages/tooling/tool/cli/src/commands/Yeet/internal/InboxView.ts packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts packages/tooling/tool/cli/src/commands/Yeet/internal/InboxPorcelain.ts packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts packages/tooling/tool/cli/src/internal/repo-run/AttemptTerminationJournal.ts packages/tooling/tool/cli/src/internal/repo-run/RunScope.ts packages/tooling/tool/cli/src/internal/repo-run/RunScope.schemas.ts packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts packages/tooling/tool/cli/test/proof-job.test.ts packages/tooling/tool/cli/test/run-scope.test.ts packages/tooling/tool/cli/test/quality-scheduler.test.ts packages/tooling/tool/cli/test/yeet-command-wiring.test.ts packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts packages/tooling/tool/cli/test/yeet-artifact-writers.test.ts` | 0 | 19 touched TypeScript files checked and formatted; final formatter run clean. Executed equivalently through `xargs` with these exact paths. |
| `bunx turbo run check --filter=@beep/repo-cli` | 1 | Blocked by sandbox: tsgo's `spawnSync node EPERM`; 32 prerequisite tasks were cached. |
| `bun run beep quality package-verify @beep/repo-cli` | 1 | Blocked by sandbox at the audit's typecheck; package docgen did not run. |
| `bun run beep yeet inbox ack local-shard-9165e885b747 --environment-only --reason 'Package audit reached tsgo but the sandbox denied its node spawn with EPERM. Direct tsc passed; the orchestrator must rerun canonical type gates outside this sandbox.'` | 0 | Recorded attribution for the verification-generated P0; no false fix SHA or observed gate bypass. |
| `git diff --check` | 0 | Whitespace check only; no git writes. |

The three canonical type gates remain blocked by sandbox; supporting direct source
and test tsc checks pass but do not substitute for those gates. Package docgen and
the live detached-systemd smoke still require Fable. No live job, git commit, push,
PR, merge, network change, privilege request, or secret operation was performed.

## Orchestrator verification (Fable, 2026-09-15, PR #1143)

Run outside the Codex sandbox in the same worktree, after the lane's handoff.

| Check | Result |
| --- | --- |
| `bunx turbo run check --filter=@beep/repo-cli` | exit 0 (33 tasks) before and after the fixes below |
| `bunx --bun vitest run` on the ten affected files, Bun default pool | 296 passed; 211 passed again after the effect-vitest edits; 43 passed on the two layer-timeout files |
| `bunx --bun vitest run packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts` | 64 passed after the deriver fix |
| `bun run beep lint effect-vitest` | 0 new findings after canon fixes plus `--write` for reviewed residuals |
| Live smoke 1 — `yeet verify --tier cheap-gates --detach`, then `yeet job wait` | job `71105fde-34e0-4698-913f-7cec6c037d08` ran as `beep-proof-<id>.service` under `agent-runs.slice`; record moved `submitted → running → finished`; systemd stamp `exit-code / exited / 1` with the invocation id; `attempt-started` (owner pid = the job) and `attempt-finished` in the branch journal; one `proof-job-finished` P1 row, acknowledged `observed/job-wait`; unit `LoadState=not-found` afterwards. The verdict was red on `lint:effect-vitest` only (12 ratchet findings in the lane's tests, fixed below), which is the correct signal. |
| Live smoke 2 — submit, `kill -KILL <MainPID>` at phase `running` | job `5be4c779-4238-43ad-b642-c50f95c0ab5e`: record `terminated / signal` with `signal / killed / KILL`; the finalizer appended `attempt-terminated reason=signal` for the runner's attempt (M5 by construction); P1 row, later acknowledged `observed/job-status` through `yeet job status --ack`; unit collected. |
| Live smoke 3 — `yeet job cancel` on the running publish job | job `01e3a3ba-a7a0-4a4f-b1f6-ad79743f7422`: `stop-requested`; the job's own CLI handled SIGTERM and wrote `attempt-terminated reason=interrupted` (exit 130); the finalizer recorded `terminated / cancelled` from the durable cancel request without a second journal row; P1 row acknowledged through `yeet inbox ack --observed`; unit collected. |
| `lint:oxlint` inside that publish job | 11 `beep(no-inline-schema-compile)` errors in the lane's files (inline `S.encodeEffect`/`decodeUnknownEffect`/`decodeOption`/`S.is` compiles); hoisted to module scope, verified with `bunx oxlint --disable-nested-config` on the touched files (the rule still fires on the pre-fix file). |
| `bun run beep quality package-verify @beep/repo-cli` (first run) | exit 1: `knowledge-semantic-delta.test.ts` (static command-surface deriver rejected the bare `Command.unlisted` transform; fixed below) and three `quality-tasks.test.ts` "cheap gate" tests; the two that fail regardless of `op` on `PATH` fail identically on the untouched main checkout at 1969de85bf, so they are environment-only, not this branch. |
| `bun run beep quality package-verify @beep/repo-cli` (rerun after the fixes) | exit 1 on the same `quality-tasks.test.ts` "cheap gate" tests only (3 failed, 3,992 passed, 203 of 204 files green); the semantic-delta failure is gone. Attribution: environment-only (identical failures on the untouched main checkout), acknowledged as such in the checkout inbox. |

Fixes applied by the orchestrator after the handoff:

- `yeet job status` declared `Flag.Boolean("ack")` without a default, which made `--ack`
  required; `Flag.withDefault(false)` restores the optional flag (found by the live smoke).
- The effect-vitest ratchet: `assertTrue` for the `Option.isSome` branch assertion; the new
  run-scope and command-wiring tests moved under `it.layer(..., { timeout: "30 seconds" })`
  (the recursive-detach case nests a `ConfigProvider` layer); the reaper case uses
  `it.live.each` instead of `it.each` + `Effect.runPromise`; the two `it.live` polling tests carry
  their live-clock reason. Remaining review-class rows (EV004 whole-body scope, EV009 live tests,
  EV010 platform imports) were reviewed into `standards/effect-vitest.inventory.jsonc`.
- `Knowledge.command-surface.ts` accepts bare `Command.<member>` transforms from a
  `SurfaceNeutralBareCommandTransform` domain (`unlisted`), so the static surface derivation
  matches the live command tree that carries the hidden finalizer.

The branch itself was published by a detached job (`yeet publish --start-pr-early --monitor --pr
--detach`, job `01e3a3ba-a7a0-4a4f-b1f6-ad79743f7422`): the early push and PR creation ran inside
`beep-proof-<id>.service` with the forwarded `SSH_AUTH_SOCK`, and the full pre-push wave ran under
the job unit as its admission run scope. The PR provenance footer records the agent as `unknown`
because ruling 39 forwards no harness environment into the job.
