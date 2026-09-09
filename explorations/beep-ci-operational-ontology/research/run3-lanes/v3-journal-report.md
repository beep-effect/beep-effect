# Run-3 additive v3 admission-journal implementation report

## 1. Mixed-fleet safety verdict

**PASS for preservation-era readers with the v1/v2 union.** The implemented v3
rows are unknown to that reader and survive its locked rewrite byte-for-byte,
in source order, including across the 200-admission retention boundary. They
are neither quarantined nor used as scheduler corruption evidence. The new
reader decodes all nine v1/v2/v3 variants from one mixed journal. Scheduler
status (JSON and text) and apply-mode reap both succeed with that journal.

**Handoff limitation:** implementation and focused verification are complete,
but the requested commit could not be created. Git staging failed because the
shared worktree metadata is read-only in this session. The required aggregate
package verification also remains red because Node child-process spawning is
denied by the sandbox. These are environment blockers, not mixed-journal
failures. Sections 4 and 6 contain the evidence and recovery commands.

All source anchors below are relative to the implementation worktree on
`feat/ontology-v3-journal-events`; they describe the final uncommitted diff.
The checkout and local `origin/main` both started at
`663904610cce2a38c06b0619a8c414646b69361c`.

| Evidence | File and line |
| --- | --- |
| The union retains the four unchanged legacy variants and adds five v3 variants. Version-aware tag guards derive from the schemas. | `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts:557` |
| The reader service allows the test to supply exactly the old v1/v2 decoder to the production preservation boundary. Production defaults to the current reader. | `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts:639`, `:665`, `:1557` |
| Decode failures become `Option.none()` beside the original raw line. The rewrite has no quarantine path for those rows. | `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts:1561` |
| Ring trimming retains unknown rows regardless of their position, then joins the original lines in source order. | `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts:1591`, `:1595`, `:1596` |
| Eviction writes retain the existing fenced protocol read and idempotent rewrite. | `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts:1715` |
| Claim decoding and quarantine apply to files under the claims directory. Deferred claims remain shielded from legacy readers; sink acknowledgment remains unchanged. | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:671`, `:811`, `:856` |
| Promotion recovery still reads durable promotion/lease state. Admission status scans scheduler state rather than deriving admission decisions from journal rows. | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:1153`, `:1238`, `:2156` |
| JSON and text scheduler status share the existing command adapter. | `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:3369` |

The main mixed-fleet regression is **“preserves every v3 variant byte-for-byte
and in order through a v1-v2 reader ring trim”** at
`packages/tooling/tool/cli/test/quality-scheduler.test.ts:1149`. It supplies a
decoder made only from the original four schemas, places all five v3 variants
before the retention boundary with leading tabs/spaces and trailing spaces,
and forces an append that trims old admissions. It asserts exactly five
unknown rows, exact complete output text, no quarantined files, unchanged v3
order, and 200 retained admitted rows. The preservation/filter/publication
algorithm is the existing production path; the injected reader changes only
which variants that writer understands.

**“decodes one mixed v1-v2-v3 journal in source order and runs scheduler status
and reap”** at `packages/tooling/tool/cli/test/quality-scheduler.test.ts:1106`
loads all nine variants with deliberately nonchronological timestamps,
compares decoded rows in source order, runs both status formats and apply-mode
reap, and asserts byte-identical journal content and an empty quarantine.
Both tests passed in the final 135-test scheduler suite.

The review included the current descendants of #978
(`c772d25970`, preservation), #993 (`00655a974e`, claim/promotion and lock
recovery), and #1005 (`322da29861`, protocol-deferred claims). No live shared
admission journal was modified to prove these cases. Tests use the existing
runtime-root override and isolated temporary scheduler directories.

This proves the specified preservation-era v1/v2 reader shape. It does not
claim a fresh inventory or execution of every installed fleet CLI, including
any revision predating unknown-row preservation.

## 2. Event schema table

Every row has `_tag`, `schemaVersion`, `nonce`, `pid`, and `attemptId`.
`attemptId` is an `Option<UUID>` in memory and an optional UUID property on the
wire, preserving the existing absence convention. Version shorthand below
expands to `yeet-admission-journal/v1`, `/v2`, or `/v3` respectively.

| Tag | schemaVersion | Fields beyond the common fields | New surface |
| --- | --- | --- | --- |
| `admission-admitted` | v1 | `procStart`, `kind`, `weightTokens`, `priority`, `originKey`, `enqueuedAtMillis`, `admittedAtMillis` | None; unchanged and still emitted during promotion. |
| `admission-released` | v1 | `releasedAtMillis`, optional `memoryPeakBytes` | None; unchanged legacy decoder. |
| `admission-lease-evicted` | v2 | `evictedAtMillis`, `reason: owner-dead-or-reused` | None; unchanged legacy decoder. |
| `admission-ticket-evicted` | v2 | `evictedAtMillis`, `reason: queued-submitter-death` | None; unchanged legacy decoder. |
| `admission-enqueued` | v3 | `procStart`, `kind`, `weightTokens`, `priority`, `originKey`, `checkoutRoot`, `branch`, `enqueuedAtMillis` | Entire event is new. |
| `admission-withdrawn` | v3 | `procStart`, `kind`, `priority`, `originKey`, `checkoutRoot`, `branch`, `enqueuedAtMillis`, `withdrawnAtMillis` | Entire event is new. No `reason` or `weightTokens` field. |
| `admission-released` | v3 | `releasedAtMillis`, optional `memoryPeakBytes`, `checkoutRoot`, `branch` | Same tag and legacy fields; v3 adds checkout and branch. |
| `admission-lease-evicted` | v3 | `evictedAtMillis`, `reason: owner-dead-or-reused`, `checkoutRoot`, `branch`, `lastHeartbeatAtMillis` | Same tag and legacy fields; v3 adds checkout, branch, and the saved lease heartbeat. |
| `admission-ticket-evicted` | v3 | `evictedAtMillis`, `reason: queued-submitter-death`, `checkoutRoot`, `branch` | Same tag and legacy fields; v3 adds checkout and branch. |

The new schema classes start at `AdmissionJournal.ts:429`, `:453`, `:486`,
`:507`, and `:534`. They use named shared identity schemas and
`extend<...>()(...)`; ticket fields and legacy event fields are reused. No
ticket, lease, reap-claim, or promotion wire schema changed.

## 3. Call-site table

All paths in this table refer to
`packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts`.

| Event | Function and event construction line | Emission behavior |
| --- | --- | --- |
| `admission-enqueued` v3 | `withQualityAdmission` (`:2001`), constructor at `:2085` | Emitted immediately after successful exclusive ticket publication inside the existing uninterruptible acquisition bracket. |
| `admission-withdrawn` v3 | `finalizeAdmissionTicket` (`:1946`), constructor at `:1966`; called by `withQualityAdmission`'s ticket finalizer | Emitted after this finalizer removes a still-queued ticket, provided no published lease exists for that nonce and PID. A missing ticket, failed removal, or existing lease produces no withdrawal. |
| `admission-released` v3 | `runAdmitted` (`:1899`), constructor at `:1925` | Emitted during the admitted-work release finalizer, retaining existing telemetry and attempt attribution. |
| `admission-lease-evicted` v3 | `admissionEventForReapClaim` (`:746`), lease constructor at `:749` | The protocol-gated sink receives checkout, branch, and `lease.heartbeatAtMillis` from the durable claim. |
| `admission-ticket-evicted` v3 | `admissionEventForReapClaim` (`:746`), ticket constructor at `:762` | The protocol-gated sink receives checkout and branch from the durable ticket claim. |

The observed heartbeat is retained by the unchanged `claimDeadLease` path at
`:963`. Delayed or repeated sink recovery therefore uses the heartbeat saved
at claim creation rather than the retry instant. Existing eviction idempotence
and protocol gating remain in force.

## 4. Files changed, tests, and verification

### Files changed

1. `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts`:
   five v3 schemas, additive event union, schema-derived guards, injectable
   preservation reader contract/service, widened append contracts, and updated
   journal/protocol documentation.
2. `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts`:
   enqueue and withdrawal emission, v3 release/eviction construction, and the
   widened eviction sink contract.
3. `packages/tooling/tool/cli/test/quality-scheduler.test.ts`:
   new v3, mixed-fleet, and interrupted-promotion regressions plus expanded
   lifecycle/eviction assertions.
4. `packages/tooling/tool/cli/README.md`:
   event/version/field table, lifecycle behavior, protocol behavior, mixed-fleet
   preservation contract, and existing best-effort/retention limits.

No changes were made to `QualityScheduler.schemas.ts`,
`AttemptTerminationJournal.ts`, or any implementation-worktree
`explorations/` artifact. The pre-existing untracked `graft/` directory was
preserved. This explicitly requested external report is the only write under
the packet's `explorations/` path.

### Tests added or expanded

- Five parameterized tests named **“round-trips v3 '<tag>' with present and
  absent attempt attribution”** (`:1088`): every v3 variant, omitted/present
  `attemptId`, legacy-reader rejection, required branch, and tag-guard coverage.
- **“decodes one mixed v1-v2-v3 journal in source order and runs scheduler
  status and reap”** (`:1106`).
- **“preserves every v3 variant byte-for-byte and in order through a v1-v2
  reader ring trim”** (`:1149`).
- **“does not journal withdrawal when a published lease awaits failed
  promotion cleanup”** (`:4626`): failed promotion cleanup leaves its durable
  lease/promotion recoverable; it does not falsely report a withdrawal, and a
  subsequent reap completes the admitted receipt.
- Expanded **“journals an enqueued-admitted-released chain per nonce after
  ticket and lease removal”** (`:947`): full enqueue identity, versioned
  release attribution, shared nonce, and timestamp ordering.
- Expanded **“journals an enqueued-withdrawn chain when a waiting contender is
  interrupted”** (`:2964`): matching ticket identity, withdrawal instant, and
  absence of invented reason/weight fields.
- Expanded **“atomically claims dead leases and tickets before journaling each
  death once”** (`:3079`): concurrent reapers still emit one event per death;
  both v3 events carry checkout/branch, and lease eviction carries the exact
  fixture heartbeat `12345`.
- Existing admitted-work failure expectations now include enqueue. Existing
  codec property tests sample the enlarged nine-variant union. Existing lock,
  promotion, protocol-disabled, idempotence, and journal-failure regressions
  continue to pass.

### Verification results and attribution

| Command | Result |
| --- | --- |
| `CI=true bun run beep quality package-verify @beep/repo-cli` | **Environment-only failure, exit 1**, reproduced after the final production edits. All 32 dependency build tasks succeeded from cache and the CLI build reached its check step. `tools/tsgo-shim/tsgo.js:15` then failed with `spawnSync .../bin/node EPERM`. The audit did not reach its remaining test/lint/Python stages or the following package docgen step. This is not an aggregate pass. |
| `bun run docgen:local` | **PASS, exit 0**, rerun after the final production edits: 228 modules, 1,509 examples, successful example typechecking, one successful package task, and successful aggregation. Remote-cache unavailability/read-only cache-write warnings did not change the success result. |
| `bunx --bun --no-install vitest run --root packages/tooling/tool/cli --pool threads --maxWorkers 1 test/quality-scheduler.test.ts test/quality-scheduler-drift.test.ts test/quality-scheduler-degraded-inputs.test.ts test/process-identity.test.ts` | **PASS, exit 0: 4 files, 135 tests**, final run 13.20 seconds. |
| `bun tools/tsgo-shim/tsgo.js -p packages/tooling/tool/cli/tsconfig.check.json` | **PASS, exit 0**, no diagnostics. Uses the existing compiler shim through Bun. |
| `bun tools/tsgo-shim/tsgo.js -p node_modules/.tmp/v3-journal-testcheck.json` | **PASS, exit 0**, no diagnostics for the changed scheduler test and its source dependencies. The ignored temporary config uses the repository's package-test compiler posture. |
| `bunx --no-install biome check packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts packages/tooling/tool/cli/test/quality-scheduler.test.ts` | **PASS**, three files, no fixes needed. |
| `git diff --check` | **PASS**. |

The audit P0 was acknowledged through `bun run beep yeet inbox ack ...
--environment-only --reason ...`, identifying the denied Node spawn and the
passing Bun compiler invocation. `git diff --exit-code origin/main --
tools/tsgo-shim/tsgo.js` passed, proving the failing shim is unchanged from
the checkout's `origin/main`. No unrelated source repair was made.

The ordinary Vitest fork pool failed before test collection with **“Timeout
waiting for worker to respond”**. Selecting the supported thread pool allowed
the same tests to run. The package-owned test-tsgo command returned a result
artifact containing the same Node `EPERM`; its wrapper's zero exit was not
counted as a passing type check. The explicit Bun test check above is the
passing supporting evidence.

Introduced test failures were fixed before handoff: absent-attribution
fixtures now decode wire JSON rather than encode non-instance plain objects;
codec callbacks adapt the optional parse-options argument instead of
receiving the iterator index; the test reader uses `Effect.fn`; and the
filesystem test condition narrows its optional boolean explicitly.

Durable local evidence is under the ignored implementation-worktree directory
`.beep/handoffs/v3-journal/`: `v3-journal-package-verify.log`,
`v3-journal-docgen.log`, `v3-journal-scheduler-suite.log`,
`v3-journal-check.log`, `v3-journal-testcheck.log`, the temporary config copy,
and `events.patch`. Empty compiler logs correspond to successful checks.

## 5. Open questions and deliberate omissions

- No unresolved event-set design question remains. The remaining handoff
  actions are committing from a context with writable Git metadata and rerunning
  the exact package audit where Node subprocesses can start.
- No withdrawal reason was added: the finalizer has no existing classification
  of why a queued wait ended. It also omits `weightTokens`, matching the brief.
- No capacity/memory stamps, passed-step enhancement, new attempt-termination
  event, or change to `AttemptTerminationJournal` was introduced. Existing
  optional release peak-memory telemetry is preserved.
- No new ticket/lease/reap-claim schema was needed. Existing durable state
  already carries checkout, branch, and heartbeat. The eviction protocol gate
  and deferred-claim behavior are unchanged; this lane did not enable the live
  gate or alter the shared runtime journal.
- The union uses schema-derived per-tag guards because Effect v4
  `toTaggedUnion` rejects duplicate tag values across versions. Existing repo
  consumers use the guards; the underlying schema and its annotation behavior
  are retained through the existing `SchemaUtils.withStatics` helper.
- Enqueue/withdrawal/release remain best-effort journal writes. Ring retention,
  write/lock failures, and old-version traffic can leave incomplete observed
  chains. Unknown rows remain preserved across older rewrites; no retention
  policy change or complete-audit-log guarantee was added.
- The fresh worktree lacked `.repos/effect`. Running the existing
  `scripts/setup-effect-ref.sh` created its ignored symlink to the existing
  local Effect checkout. Schema extension, union discriminator behavior, and
  helper APIs were checked against that source. No dependency or skill files
  were changed.
- The CLI display projection outside this package was not widened: the grep
  hits in `apps/labs/ciops` are a separate projection schema and historical v2
  fixture, not admission journal writers or scheduler decision consumers.

## 6. Commit SHA(s) and commit handoff

**No new commit SHA exists.** The branch is still
`feat/ontology-v3-journal-events` at
`663904610cce2a38c06b0619a8c414646b69361c` (the starting base, not an
implementation commit). The named-file staging command failed with:

```text
Unable to create '.../.git/worktrees/ontology-v3-journal/index.lock': Read-only file system
```

The `.git` entry points to shared metadata in the parent checkout, outside this
session's writable roots. No permission escalation or alternate Git-metadata
workaround was attempted. The index is unchanged and empty of staged changes;
the four implementation files remain as unstaged edits. Nothing was pushed,
published, merged, or force-updated.

The full named-file patch is `.beep/handoffs/v3-journal/events.patch`, SHA-256:

```text
bd5ac52f437a99de19781ea34d723ccb2d1ae5a4b9fff71c1f0f010318495cf9
```

From the implementation worktree in a context with writable shared Git
metadata, the remaining requested commit operation is:

```sh
git add packages/tooling/tool/cli/README.md \
  packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts \
  packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts \
  packages/tooling/tool/cli/test/quality-scheduler.test.ts
git diff --cached --check
git commit -m 'feat(repo-cli): journal admission enqueue and withdrawal (v3)'
```

Do not apply the patch over these existing edits. It is a recovery artifact for
the handoff. No push or PR operation is part of this lane's authorization.
