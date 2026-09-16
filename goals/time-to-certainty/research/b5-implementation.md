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


## Review round 1

Local review fixes for PR #1143, 2026-09-15. This lane made no git writes and did not
publish or reply to GitHub threads. Fable owns those actions and outside-sandbox proof.

### Decisions and rejected alternatives

- **I15 — PRRT_kwDOPbO_N86ixI15:** every existing-record transition now rereads and
  writes under the existing journal mutex implementation, using a per-job `.lock`,
  `pid:procStart:nonce` ownership, bounded retries, identity-fenced stale takeover,
  and guaranteed release. Publication stays idempotent inside the mutex. This is a
  per-record consistency mutex, not a scheduler or admission lock. Rejected a third
  lock implementation and stale snapshot writes. Cancel releases the mutex before
  `systemctl stop`, avoiding a stop/ExecStopPost deadlock. Barrier-driven repeated
  cancel-first/finalize-first cases cover ordering, stamps, reasons, late updates,
  cleanup, and dead-owner takeover.
- **I5w — PRRT_kwDOPbO_N86ixI5w:** unstamped finished jobs with dead runners and
  missing units reconcile through finalization, retain the verdict, gain an unknown
  systemd stamp, publish once, and become observable by wait/ack. Both green and red
  verdicts are tested. Rejected treating an unstamped finished phase as settled.
- **I5e — PRRT_kwDOPbO_N86ixI5e:** documented CLI-finished versus finalizer-stamped
  state; shared `isSettledProofJob` governs wait and prune. Added ruling 36 amendment.
- **LRl / Yeh — PRRT_kwDOPbO_N86ixLRl / PRRT_kwDOPbO_N86ixYeh:** nonzero systemctl
  results produce null JSON telemetry and an active-job text note, never error output
  presented as telemetry. ConfigProvider PATH is forwarded at the command boundary
  so the tests exercise actual handler subprocess routing.
- **LRm — PRRT_kwDOPbO_N86ixLRm:** finalize requires matching job id and unit; when
  both invocation ids exist they must match. Errors name the offending variable.
  This same-user accident fence is explicitly not an authorization boundary.
- **LRW — PRRT_kwDOPbO_N86ixLRW:** corrected the three journal claims and appended
  ruling 38 amendment: dead runners have attempt facts; launch failure has a terminal
  job record and inbox row without inventing an attempt.
- **LRb / LRh — PRRT_kwDOPbO_N86ixLRb / PRRT_kwDOPbO_N86ixLRh:** appended the
  installed Arbitrary API correction and added lint/type commands to the brief.
  Ratified text was preserved.
- Coverage tests additionally exercise list/status/wait/logs/cancel/finalize, detach
  guards, observed acknowledgments, missing/busy journals, verdict bookkeeping, and
  fail-fast proof execution with valid/invalid/absent RSS. Duration shorthand tests
  exposed an existing `30s` normalization bug; normalization now uses Effect's actual
  duration unit names. Compiled codecs and predicates live at module scope.
- Rejected lowering coverage floors or editing the effect-vitest inventory. An
  inherited Node-thread real-subprocess proof test stalls; its Bun version passes.
  Deterministic spawner-backed proof cases provide Node coverage for the same seam.
  Broad wildcard coverage selected unrelated retirement suites and was stopped;
  targeted producer suites below give explicit, reproducible coverage. Both friction
  points were recorded in OPPORTUNITIES when encountered.

### Review round 1 — files

- `AGENTS.md`
- `goals/time-to-certainty/PLAN.md`
- `goals/time-to-certainty/ops/manifest.json`
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/b5-brief.md`
- `goals/time-to-certainty/research/b5-implementation.md`
- `goals/time-to-certainty/research/decisions.md`
- `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJob.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJobLauncher.ts`
- `packages/tooling/tool/cli/test/proof-job.test.ts`
- `packages/tooling/tool/cli/test/yeet-command-wiring.test.ts`

The untracked `research/b5-review-1-brief.md` was provided to this lane and was not edited.
No forbidden configuration, manifest script, inventory, or journal implementation file
was edited; the journal mutex helpers were already exported by AdmissionJournal.

### Verification

Commands run from the worktree root unless the coverage section specifies otherwise.
Final successful reruns supersede corrected intermediate lint/type failures.

| Exact command | Exit | Result |
| --- | ---: | --- |
| `bunx --bun vitest run packages/tooling/tool/cli/test/proof-job.test.ts packages/tooling/tool/cli/test/yeet-command-wiring.test.ts --pool=threads` | 0 | 90 tests pass; deterministic race barriers and full job command matrix. |
| `bunx biome check --write packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJob.ts packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJobLauncher.ts packages/tooling/tool/cli/test/proof-job.test.ts packages/tooling/tool/cli/test/yeet-command-wiring.test.ts goals/time-to-certainty/ops/manifest.json` | 0 | Touched TypeScript and JSON formatted; the final test-only formatting pass also exits 0. |
| `bunx oxlint --disable-nested-config packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJob.ts packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJobLauncher.ts packages/tooling/tool/cli/test/proof-job.test.ts packages/tooling/tool/cli/test/yeet-command-wiring.test.ts` | 0 | No beep errors; one inherited warning on the fixture UUID Effect.runSync. |
| `bun run beep lint effect-vitest` | 0 | Zero introduced findings; inventory unchanged. |
| `bun run beep lint schema-first` | 0 | No advisories. |
| `bun run beep quality fallow audit --check --base origin/main` | 0 | No findings. |
| `bun run beep quality fallow health --check --base origin/main` | 0 | No findings. |
| `bun run beep lint jsdoc --package packages/tooling/tool/cli` | 0 | Pass. |
| `bun run beep quality test-tsgo` | 1 | Blocked by sandbox: spawnSync node EPERM. |
| `bunx turbo run check --filter=@beep/repo-cli` | 1 | Blocked by sandbox: spawnSync node EPERM. |
| `bun run beep quality package-verify @beep/repo-cli` | 1 | Blocked at tsgo by sandbox; build passed, package docgen not reached. |
| `bunx tsc -p packages/tooling/tool/cli/tsconfig.check.json --noEmit` | 0 | Supporting source check; does not replace canonical gates. |
| `bunx tsc -p packages/tooling/tool/cli/test/tsconfig.json --rootDir packages/tooling/tool/cli --noEmit` | 0 | Supporting test check. |
| `git diff --check` | 0 | Read-only whitespace check. |

Canonical type gates are blocked by sandbox (`spawnSync node EPERM`); direct tsc
checks are supporting evidence only. Package docgen, default-pool and live-systemd
proof are not claimed by this review lane.

### Coverage restoration

All percentages are lines / statements / branches / functions. Coverage is V8 under
Node with `--pool=threads`. The union below merges Istanbul hit counts from explicit
producer suites, not averages; Yeet.command uses only its final-source run. No source
coverage exclusions or baseline reductions were introduced.

| File | Final | Floor | Result |
| --- | --- | --- | --- |
| `commands/Yeet/Yeet.command.ts` | 97.41 / 96.01 / 100 / 80 | 96.77 / 92.36 / 100 / 67.74 | restored |
| `commands/Yeet/internal/Ack.ts` | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | restored |
| `commands/Yeet/internal/Handler.ts` | 49.39 / 47.59 / 37.5 / 39.26 | 49.39 / 47.5 / 37 / 38.27 | restored |
| `commands/Yeet/internal/Inbox.ts` | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | restored |
| `commands/Yeet/internal/InboxPorcelain.ts` | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | restored |
| `internal/repo-run/AttemptTerminationJournal.ts` | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | restored |

The following reproducible Node invocations identify each completed coverage run from
`packages/tooling/tool/cli`; every run exited 0. Reporter argument order is normalized
here, and presentation-only `--reporter=verbose` is omitted. JSON reports were retained
alongside LCOV where requested to merge counts.

| Reproducible coverage invocation | Exit | Tests |
| --- | ---: | ---: |
| `CI=true bunx vitest run --pool=threads --testTimeout=30000 --coverage --coverage.include=src/commands/Yeet/Yeet.command.ts --coverage.include=src/commands/Yeet/internal/Ack.ts --coverage.include=src/commands/Yeet/internal/Inbox.ts --coverage.include=src/commands/Yeet/internal/InboxPorcelain.ts --coverage.include=src/commands/Yeet/internal/Handler.ts --coverage.include=src/internal/repo-run/AttemptTerminationJournal.ts --coverage.reporter=lcov --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory=/tmp/b5-core-cov --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 test/proof-job.test.ts test/yeet-command-wiring.test.ts test/yeet-ack.test.ts test/yeet-inbox.test.ts test/yeet-inbox-porcelain.test.ts test/yeet-inbox-view.test.ts test/yeet-artifact-writers.test.ts test/yeet-verdict-lane-repair.test.ts` | 0 | 181 |
| `CI=true bunx vitest run --pool=threads --testTimeout=30000 --coverage --coverage.include=src/internal/repo-run/AttemptTerminationJournal.ts --coverage.reporter=lcov --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory=/tmp/b5-journal-cov --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 test/yeet.test.ts -t 'yeet attempt journal'` | 0 | 25 |
| `CI=true bunx vitest run --pool=threads --testTimeout=30000 --coverage --coverage.include=src/internal/repo-run/AttemptTerminationJournal.ts --coverage.reporter=lcov --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory=/tmp/b5-scheduler-cov --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 test/quality-scheduler.test.ts -t 'keeps a protocol-disabled eviction sink pending'` | 0 | 1 |
| `CI=true bunx vitest run --pool=threads --testTimeout=30000 --coverage --coverage.include=src/commands/Yeet/internal/Handler.ts --coverage.reporter=lcov --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory=/tmp/b5-handler-cov --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 test/yeet-monitor-phase-empty.test.ts test/yeet-monitor-check-registration.test.ts test/yeet-provenance-footer.test.ts test/flake-quarantine.test.ts` | 0 | 69 |
| `CI=true bunx vitest run --pool=threads --testTimeout=30000 --coverage --coverage.include=src/commands/Yeet/internal/Handler.ts --coverage.reporter=lcov --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory=/tmp/b5-verdict-cov --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 test/yeet.test.ts -t 'verdict\|pre-push red\|wrapper lane facts'` | 0 | 6 |
| `CI=true bunx vitest run --pool=threads --testTimeout=30000 --coverage --coverage.include=src/commands/Yeet/Yeet.command.ts --coverage.reporter=lcov --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory=/tmp/b5-command-final-cov --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 test/proof-job.test.ts test/yeet-command-wiring.test.ts` | 0 | 86 |
| `CI=true bunx vitest run --pool=threads --testTimeout=10000 --coverage --coverage.include=src/commands/Yeet/internal/Handler.ts --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory=/tmp/b5-coordinator-cov --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 test/yeet-review-fixes.test.ts -t 'installs a persistent\|allows two same-origin\|serializes same-origin'` | 0 | 3 |
| `CI=true bunx vitest run --pool=threads --testTimeout=30000 --coverage --coverage.include=src/commands/Yeet/internal/Handler.ts --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory=/tmp/b5-proof-phase-cov --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 test/proof-job.test.ts -t 'proof phase record integration'` | 0 | 3 |
| `CI=true bunx vitest run --pool=threads --testTimeout=30000 --coverage --coverage.include=src/commands/Yeet/internal/Handler.ts --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory=/tmp/b5-handler-plan-cov --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 test/yeet.test.ts -t 'shares ProofFact\|journals every terminal\|carries immutable attempt\|builds \|plans \|keeps pushed false\|requires a publish message\|rejects push-only reuse'` | 0 | 29 |
| `CI=true bunx vitest run --pool=threads --testTimeout=30000 --coverage --coverage.include=src/commands/Yeet/internal/Handler.ts --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory=/tmp/b5-handler-refusal-cov --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 test/yeet.test.ts -t 'refuses publish on main\|requires explicit --pr'` | 0 | 2 |
| `CI=true bunx vitest run --pool=threads --testTimeout=30000 --coverage --coverage.include=src/commands/Yeet/internal/Handler.ts --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory=/tmp/b5-bookkeeping-cov --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 test/proof-job.test.ts -t 'proof verdict bookkeeping'` | 0 | 4 |

Aggregation command (root, exit 0):

```sh
node /tmp/b5-merge-coverage.cjs /tmp/b5-core-cov /tmp/b5-journal-cov /tmp/b5-scheduler-cov /tmp/b5-handler-cov /tmp/b5-verdict-cov /tmp/b5-command-final-cov /tmp/b5-coordinator-cov /tmp/b5-proof-phase-cov /tmp/b5-handler-plan-cov /tmp/b5-handler-refusal-cov /tmp/b5-bookkeeping-cov
```

Reproducible aggregator body; output `/tmp/b5-cov-final/{lcov.info,coverage-summary.json,coverage-final.json}`:

```js
const fs = require('node:fs');
const coverage = require(process.cwd() + '/node_modules/istanbul-lib-coverage');
const report = require(process.cwd() + '/node_modules/istanbul-lib-report');
const reports = require(process.cwd() + '/node_modules/istanbul-reports');
const map = coverage.createCoverageMap({});
for (const directory of process.argv.slice(2)) { const input = JSON.parse(fs.readFileSync(directory + '/coverage-final.json', 'utf8')); for (const key of Object.keys(input)) if (key.endsWith('/Yeet.command.ts') && directory !== '/tmp/b5-command-final-cov') delete input[key]; map.merge(input); }
const context = report.createContext({dir: '/tmp/b5-cov-final', coverageMap: map});
for (const name of ['lcovonly', 'json-summary', 'json']) reports.create(name).execute(context);
for (const file of map.files()) {
  const summary = map.fileCoverageFor(file).toSummary().toJSON();
  console.log(file.slice(file.indexOf('/src/') + 5), ...['lines','statements','branches','functions'].map(k => summary[k].pct));
}
```

Remaining zero-hit LCOV entries are below. Ack, Inbox, InboxPorcelain and
AttemptTerminationJournal have none. Handler retains inherited uncovered orchestration
paths while meeting every floor; command branches are all covered.

<details>
<summary>packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts — FNF:50, FNH:40, LF:232, LH:226, BRF:63, BRH:63</summary>

```text
FNDA:0,(anonymous_36)
FNDA:0,(anonymous_37)
FNDA:0,(anonymous_38)
FNDA:0,(anonymous_40)
FNDA:0,(anonymous_42)
FNDA:0,(anonymous_43)
FNDA:0,(anonymous_44)
FNDA:0,(anonymous_46)
FNDA:0,(anonymous_47)
FNDA:0,(anonymous_48)
DA:958,0
DA:960,0
DA:963,0
DA:985,0
DA:997,0
DA:1045,0
```

</details>

<details>
<summary>packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts — FNF:163, FNH:64, LF:498, LH:246, BRF:200, BRH:75</summary>

```text
FNDA:0,(anonymous_7)
FNDA:0,(anonymous_11)
FNDA:0,(anonymous_14)
FNDA:0,(anonymous_17)
FNDA:0,(anonymous_18)
FNDA:0,(anonymous_19)
FNDA:0,(anonymous_24)
FNDA:0,(anonymous_29)
FNDA:0,(anonymous_30)
FNDA:0,(anonymous_33)
FNDA:0,(anonymous_34)
FNDA:0,(anonymous_35)
FNDA:0,(anonymous_36)
FNDA:0,(anonymous_37)
FNDA:0,(anonymous_38)
FNDA:0,(anonymous_39)
FNDA:0,(anonymous_40)
FNDA:0,(anonymous_41)
FNDA:0,(anonymous_44)
FNDA:0,(anonymous_47)
FNDA:0,(anonymous_48)
FNDA:0,(anonymous_49)
FNDA:0,(anonymous_50)
FNDA:0,(anonymous_51)
FNDA:0,(anonymous_52)
FNDA:0,(anonymous_53)
FNDA:0,(anonymous_54)
FNDA:0,(anonymous_55)
FNDA:0,(anonymous_56)
FNDA:0,(anonymous_57)
FNDA:0,(anonymous_58)
FNDA:0,(anonymous_59)
FNDA:0,(anonymous_60)
FNDA:0,(anonymous_61)
FNDA:0,(anonymous_62)
FNDA:0,(anonymous_63)
FNDA:0,(anonymous_64)
FNDA:0,(anonymous_65)
FNDA:0,(anonymous_66)
FNDA:0,(anonymous_67)
FNDA:0,(anonymous_68)
FNDA:0,(anonymous_69)
FNDA:0,(anonymous_70)
FNDA:0,(anonymous_71)
FNDA:0,(anonymous_72)
FNDA:0,(anonymous_73)
FNDA:0,(anonymous_74)
FNDA:0,(anonymous_75)
FNDA:0,(anonymous_76)
FNDA:0,(anonymous_77)
FNDA:0,(anonymous_85)
FNDA:0,(anonymous_88)
FNDA:0,(anonymous_89)
FNDA:0,(anonymous_90)
FNDA:0,(anonymous_92)
FNDA:0,(anonymous_99)
FNDA:0,(anonymous_100)
FNDA:0,(anonymous_105)
FNDA:0,(anonymous_106)
FNDA:0,(anonymous_108)
FNDA:0,(anonymous_110)
FNDA:0,(anonymous_114)
FNDA:0,(anonymous_118)
FNDA:0,(anonymous_122)
FNDA:0,(anonymous_125)
FNDA:0,(anonymous_126)
FNDA:0,(anonymous_127)
FNDA:0,(anonymous_128)
FNDA:0,(anonymous_129)
FNDA:0,(anonymous_130)
FNDA:0,(anonymous_131)
FNDA:0,(anonymous_132)
FNDA:0,(anonymous_133)
FNDA:0,(anonymous_134)
FNDA:0,(anonymous_135)
FNDA:0,(anonymous_136)
FNDA:0,(anonymous_137)
FNDA:0,(anonymous_138)
FNDA:0,(anonymous_139)
FNDA:0,(anonymous_140)
FNDA:0,(anonymous_141)
FNDA:0,(anonymous_142)
FNDA:0,(anonymous_143)
FNDA:0,(anonymous_144)
FNDA:0,(anonymous_145)
FNDA:0,(anonymous_146)
FNDA:0,(anonymous_147)
FNDA:0,(anonymous_148)
FNDA:0,(anonymous_149)
FNDA:0,(anonymous_150)
FNDA:0,(anonymous_151)
FNDA:0,(anonymous_152)
FNDA:0,(anonymous_153)
FNDA:0,(anonymous_154)
FNDA:0,(anonymous_155)
FNDA:0,(anonymous_156)
FNDA:0,(anonymous_157)
FNDA:0,(anonymous_158)
FNDA:0,(anonymous_159)
DA:180,0
DA:181,0
DA:270,0
DA:271,0
DA:272,0
DA:306,0
DA:307,0
DA:309,0
DA:313,0
DA:383,0
DA:394,0
DA:397,0
DA:400,0
DA:401,0
DA:402,0
DA:463,0
DA:515,0
DA:516,0
DA:517,0
DA:527,0
DA:528,0
DA:539,0
DA:549,0
DA:610,0
DA:611,0
DA:612,0
DA:614,0
DA:615,0
DA:628,0
DA:629,0
DA:630,0
DA:640,0
DA:641,0
DA:642,0
DA:644,0
DA:652,0
DA:655,0
DA:656,0
DA:692,0
DA:693,0
DA:717,0
DA:718,0
DA:719,0
DA:720,0
DA:722,0
DA:746,0
DA:780,0
DA:781,0
DA:784,0
DA:786,0
DA:787,0
DA:788,0
DA:789,0
DA:790,0
DA:791,0
DA:792,0
DA:793,0
DA:794,0
DA:797,0
DA:813,0
DA:814,0
DA:815,0
DA:817,0
DA:818,0
DA:831,0
DA:834,0
DA:835,0
DA:841,0
DA:842,0
DA:845,0
DA:849,0
DA:850,0
DA:851,0
DA:858,0
DA:859,0
DA:863,0
DA:869,0
DA:874,0
DA:888,0
DA:892,0
DA:893,0
DA:899,0
DA:900,0
DA:902,0
DA:903,0
DA:904,0
DA:911,0
DA:913,0
DA:919,0
DA:920,0
DA:923,0
DA:927,0
DA:928,0
DA:929,0
DA:931,0
DA:932,0
DA:934,0
DA:954,0
DA:955,0
DA:957,0
DA:958,0
DA:959,0
DA:969,0
DA:992,0
DA:995,0
DA:996,0
DA:1005,0
DA:1006,0
DA:1009,0
DA:1010,0
DA:1012,0
DA:1026,0
DA:1027,0
DA:1028,0
DA:1029,0
DA:1030,0
DA:1032,0
DA:1033,0
DA:1042,0
DA:1043,0
DA:1044,0
DA:1057,0
DA:1058,0
DA:1060,0
DA:1061,0
DA:1062,0
DA:1063,0
DA:1074,0
DA:1075,0
DA:1076,0
DA:1077,0
DA:1081,0
DA:1093,0
DA:1094,0
DA:1106,0
DA:1107,0
DA:1108,0
DA:1110,0
DA:1188,0
DA:1194,0
DA:1219,0
DA:1222,0
DA:1223,0
DA:1224,0
DA:1253,0
DA:1254,0
DA:1255,0
DA:1256,0
DA:1258,0
DA:1260,0
DA:1301,0
DA:1314,0
DA:1315,0
DA:1316,0
DA:1317,0
DA:1320,0
DA:1321,0
DA:1324,0
DA:1325,0
DA:1326,0
DA:1329,0
DA:1330,0
DA:1332,0
DA:1397,0
DA:1398,0
DA:1399,0
DA:1400,0
DA:1402,0
DA:1445,0
DA:1454,0
DA:1458,0
DA:1461,0
DA:1473,0
DA:1482,0
DA:1515,0
DA:1617,0
DA:1687,0
DA:1688,0
DA:1689,0
DA:1690,0
DA:1691,0
DA:1712,0
DA:1733,0
DA:1734,0
DA:1736,0
DA:1737,0
DA:1738,0
DA:1741,0
DA:1742,0
DA:1747,0
DA:1748,0
DA:1749,0
DA:1750,0
DA:1761,0
DA:1762,0
DA:1763,0
DA:1764,0
DA:1765,0
DA:1772,0
DA:1773,0
DA:1774,0
DA:1775,0
DA:1776,0
DA:1777,0
DA:1778,0
DA:1780,0
DA:1781,0
DA:1782,0
DA:1783,0
DA:1786,0
DA:1787,0
DA:1788,0
DA:1791,0
DA:1792,0
DA:1793,0
DA:1795,0
DA:1808,0
DA:1809,0
DA:1810,0
DA:1811,0
DA:1816,0
DA:1824,0
DA:1826,0
DA:1839,0
DA:1842,0
DA:1848,0
DA:1861,0
DA:1865,0
DA:1899,0
DA:1900,0
DA:1901,0
DA:1902,0
DA:1903,0
DA:1904,0
DA:1906,0
DA:1908,0
DA:1925,0
DA:1926,0
DA:1927,0
DA:1930,0
DA:1933,0
DA:1934,0
DA:1935,0
DA:1938,0
DA:1939,0
DA:1957,0
DA:1958,0
DA:2003,0
DA:2027,0
DA:2028,0
DA:2029,0
DA:2032,0
BRDA:305,3,0,0
BRDA:306,4,0,0
BRDA:306,4,1,0
BRDA:312,5,0,0
BRDA:373,7,1,0
BRDA:376,8,1,0
BRDA:377,9,1,0
BRDA:418,10,0,0
BRDA:441,12,0,0
BRDA:495,15,0,0
BRDA:537,16,0,0
BRDA:611,17,0,0
BRDA:611,17,1,0
BRDA:629,18,0,0
BRDA:629,18,1,0
BRDA:641,19,0,0
BRDA:641,19,1,0
BRDA:661,20,2,0
BRDA:661,20,3,0
BRDA:672,21,0,0
BRDA:673,22,0,0
BRDA:692,23,0,0
BRDA:692,23,1,0
BRDA:694,24,0,0
BRDA:694,24,1,0
BRDA:712,25,0,0
BRDA:715,26,0,0
BRDA:745,27,0,0
BRDA:780,30,0,0
BRDA:780,30,1,0
BRDA:788,31,0,0
BRDA:788,31,1,0
BRDA:789,32,0,0
BRDA:789,32,1,0
BRDA:793,33,0,0
BRDA:793,33,1,0
BRDA:813,34,0,0
BRDA:813,34,1,0
BRDA:845,35,0,0
BRDA:845,35,1,0
BRDA:845,35,2,0
BRDA:850,36,0,0
BRDA:850,36,1,0
BRDA:899,37,0,0
BRDA:899,37,1,0
BRDA:903,38,0,0
BRDA:903,38,1,0
BRDA:923,39,0,0
BRDA:923,39,1,0
BRDA:923,39,2,0
BRDA:928,40,0,0
BRDA:928,40,1,0
BRDA:931,41,0,0
BRDA:931,41,1,0
BRDA:955,42,0,0
BRDA:955,42,1,0
BRDA:969,43,0,0
BRDA:969,43,1,0
BRDA:1005,44,0,0
BRDA:1005,44,1,0
BRDA:1013,45,0,0
BRDA:1013,45,1,0
BRDA:1029,46,0,0
BRDA:1029,46,1,0
BRDA:1032,47,0,0
BRDA:1032,47,1,0
BRDA:1081,48,0,0
BRDA:1081,48,1,0
BRDA:1083,49,0,0
BRDA:1083,49,1,0
BRDA:1106,50,0,0
BRDA:1106,50,1,0
BRDA:1107,51,0,0
BRDA:1107,51,1,0
BRDA:1152,54,0,0
BRDA:1187,56,0,0
BRDA:1221,57,0,0
BRDA:1255,58,0,0
BRDA:1255,58,1,0
BRDA:1316,59,0,0
BRDA:1316,59,1,0
BRDA:1320,60,0,0
BRDA:1320,60,1,0
BRDA:1459,62,0,0
BRDA:1467,63,1,0
BRDA:1469,64,0,0
BRDA:1472,65,0,0
BRDA:1504,67,0,0
BRDA:1530,69,0,0
BRDA:1712,77,0,0
BRDA:1712,77,1,0
BRDA:1712,78,0,0
BRDA:1712,78,1,0
BRDA:1716,79,0,0
BRDA:1716,79,1,0
BRDA:1727,80,0,0
BRDA:1733,81,0,0
BRDA:1733,81,1,0
BRDA:1766,82,0,0
BRDA:1766,82,1,0
BRDA:1782,83,0,0
BRDA:1782,83,1,0
BRDA:1787,84,0,0
BRDA:1787,84,1,0
BRDA:1816,85,0,0
BRDA:1816,85,1,0
BRDA:1816,86,0,0
BRDA:1816,86,1,0
BRDA:1817,87,0,0
BRDA:1817,87,1,0
BRDA:1820,88,0,0
BRDA:1820,88,1,0
BRDA:1820,89,0,0
BRDA:1820,89,1,0
BRDA:1826,90,0,0
BRDA:1826,90,1,0
BRDA:1848,91,0,0
BRDA:1848,91,1,0
BRDA:1903,92,0,0
BRDA:1903,92,1,0
BRDA:1956,93,0,0
BRDA:2002,96,0,0
BRDA:2023,97,1,0
BRDA:2027,98,0,0
BRDA:2027,98,1,0
```

</details>

Earlier broad coverage attempts were interrupted (exit 130), rather than counted as
passing proof. The isolated inherited Node proof-step probe was likewise interrupted;
`bunx --bun vitest run packages/tooling/tool/cli/test/yeet-review-fixes.test.ts --pool=threads --testTimeout=10000 --reporter=verbose -t 'stops the proof phase'`
exited 0 (one test). Narrow coverage producers above all completed.

Inbox attribution commands (all exit 0):

| Exact command | Exit |
| --- | ---: |
| `bun run beep yeet inbox ack proof-job-cf6c8083-11e8-439a-b19a-ed0c1482db7e --observed` | 0 |
| `bun run beep yeet inbox ack local-shard-ffe20774941b --thread-url https://github.com/beep-effect/beep-effect/pull/1143` | 0 |
| `bun run beep yeet inbox ack local-shard-a5a4a4612b50 --environment-only --reason 'Package audit failed at the tsgo shim because the sandbox denied spawnSync node with EPERM; canonical type verification must run outside this sandbox.'` | 0 |

The final inbox inspection showed zero unacknowledged rows. No remote thread reply is
claimed by the local thread-url acknowledgment.
