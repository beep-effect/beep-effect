# D1 — machine-wide weighted admission: design record

Date: 2026-08-27. Companion to the D1 implementation PR; forensic baseline in
`c5-concurrency-policy.md` (written 2026-08-13, before the v3 per-origin coordinator
landed in #837/#840/#845 — this record reconciles the two).

## What shipped

- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts` — schema-first
  models: `AdmissionWorkKind` (LiteralKit: full-proof, merged-preview, review-fix, publish),
  `AdmissionPriority` (publish, verify), `YeetAdmissionLease` (`yeet-admission-lease/v1`:
  pid + procStart, kind, weightTokens, originKey, checkout, branch, command, heartbeat,
  hotPaths reserved for E5), `YeetAdmissionTicket` (`yeet-admission-ticket/v1`),
  `AdmissionConfig` (chartered defaults), `AdmissionSnapshot`, `QualitySchedulerError`.
- `QualityScheduler.ts` — `MemoryStats` `Context.Service` (live layer reads
  `/proc/meminfo` `MemAvailable`; `os.freemem` fallback under-reports, which only tightens
  admission), durable ticket queue + lease store under
  `${XDG_RUNTIME_DIR}/beep/admit/{queue,leases,quarantine}` (0700, symlink/uid/mode
  validated like the proof-coordinator directory; uid-suffixed tmpdir fallback),
  `withQualityAdmission` bracket, `admissionStatus`, `reapAdmissionState`.
- `Yeet/internal/ProofState.ts` — `acquireFullProofLockOrObserve`: one non-blocking
  acquisition attempt that succeeds with `None` instead of failing on `refuse-active`;
  legacy v2 and unreadable locks still fail closed byte-identically.
  `acquireFullProofLock` (fail-fast) is unchanged and still pinned by its tests.
- `Yeet/internal/Handler.ts` — `runWithFullProofCoordinator` now runs
  admission-around-origin-gate: verify full = full-proof(3) verify priority, verify
  `--merged` = merged-preview(5), both publish proof scopes = full-proof(3) with publish
  priority; `verify --tier review-fix` takes review-fix(1) with no origin gate;
  cheap-gates takes neither.
- `beep quality scheduler status [--json] | reap [--apply]` operator surface
  (reap is dry-run by default per c5 recommendation 4).

## Chartered parameters (SPEC D1, verbatim)

slot 5 GiB · capacity `min(10, floor((MemAvailable − 10) / 5))` · hard floor 15 GiB ·
weights full-proof 3 / merged-preview 5 / review-fix 1 (×3) / publish 1 · heartbeat 5s ·
progress 15s · publish aging 120s. All live in `AdmissionConfig` constructor defaults.

## Decisions and deviations

1. **Publish weight.** SPEC lists `publish 1`, but the Handler's publish coordinator scope
   *contains* the full local proof (30–45 GiB per c5). Admitting that scope at 1 token
   would break the memory arithmetic, so publish proof scopes request `full-proof` (3)
   with publish *priority*. The `publish` kind (1 token) remains in the schema for the
   post-proof mutation phase once heavy tokens release before push (c5 rec 3) and for E5
   `(origin, branch)` publish serialization — both follow-ups.
2. **The origin lock waits instead of refusing.** c5 rec 3 ("a contender waits instead of
   failing") is implemented at the scheduler layer: `refuse-active` becomes stay-queued
   via `acquireFullProofLockOrObserve`, while corruption dispositions (legacy v2,
   unreadable) keep failing closed with the existing messages. Old Yeet binaries in
   sibling checkouts keep their fail-fast behavior against a held lock and fail closed
   against nothing new — the lock file format is untouched.
3. **Deterministic single-candidate promotion.** All contenders share one sort order
   (effective priority, enqueue time, pid, nonce); only the first non-skippable ticket
   that fits capacity may admit itself. Skippable = same-origin lease already admitted,
   or review-fix class cap reached — so a blocked origin never head-of-line-blocks other
   origins. Head-of-line waiting *for capacity* is chartered FIFO and preserved.
4. **Overshoot rollback.** Two racing observers can promote in the same tick; after
   writing its lease each admittee re-scans, and the newest admission rolls itself back
   *before* starting work — running work is never preempted (SPEC D1 / c5 rec 3).
5. **Lease directory naming.** SPEC D1 names `${XDG_RUNTIME_DIR}/beep/admit/`; c5
   predates it with `beep-effect-quality/`. SPEC wins. The shared-tmpdir fallback is
   uid-suffixed (`beep-admit-uid-<uid>`) since only XDG_RUNTIME_DIR is per-user.
6. **Reap rule.** Only pid-dead or `/proc` starttime mismatch (SPEC D3); stale heartbeats
   mark suspicion but never kill. Malformed state quarantines with a visible diagnostic
   instead of blocking forever — the v3 lock's refuse-unreadable stance inverted for
   admission state, where fail-open is safe because capacity re-checks every tick.

## Proof

`test/quality-scheduler.test.ts` (16 tests, real temp filesystem, fake MemoryStats):
capacity table + property (fc), weight pins, stat-line parsing past hostile executable
names, immediate admission + full cleanup, FIFO wait/release, same-origin skip without
cross-origin blocking, publish-over-verify ordering, review-fix class cap, dead-pid +
starttime-mismatch reaping, garbage quarantine, origin-gate wait + release counting,
hard-floor block/recover, interrupt removes ticket, failure releases lease, and the
8-token two-full-proofs / no-second-merged-preview arithmetic from SPEC D1.
`test/yeet-review-fixes.test.ts` re-pins coordinator-held-across-checkpoints and
release-on-failure through the new admission path.

## Adversarial-review hardening (pre-publish)

A high-effort review pass over the diff surfaced six correctness gaps, all fixed before
publish: (1) the overshoot-rollback loser is now chosen by an immutable `admittedAtMillis`
instead of the continuously-refreshed heartbeat, so concurrent over-admissions always roll
back; (2) a head ticket whose origin lock is held by a process *without* an admission lease
(a sibling checkout on the previous Yeet release) stamps `blockedOnOriginAtMillis` and
becomes skippable for later origins — mixed-version fleets can no longer starve the queue,
and the stamp expires so a crashed holder cannot leave a permanent skip; (3) machines whose
installed memory can never fit a request clamp the weight to the machine ceiling, or fall
back to origin-gate-only coordination below the envelope — no permanent hang on small
hosts; (4) promotion runs inside `Effect.uninterruptibleMask` with the sleep restored, so
an interrupt can never leak a lease or origin lock, while `Ctrl-C` still lands during the
wait; (5) lease/ticket creation stages full content and publishes it with an atomic hard
link, so a concurrent repair scan can never quarantine a half-written file; (6) merged
previews acquire the 5-token admission around the whole flow — worktree materialization
and monorepo install included — with the origin lock kept inside the preview proof. The
review also drove: single scan per wait tick and a once-per-run origin-path resolution
(no git spawn per 5s attempt), `suspectAfterSeconds` wired into progress/status output as
a stale-heartbeat diagnostic (never a kill signal), and the `/proc` stat parser
consolidated so the fleet registry, proof coordinator, and scheduler share one
implementation.

## Follow-ups (tracked in PLAN P4)

D2 adaptive lane concurrency (scheduler-selected turbo args); D3 remainder (PSI/load
watermarks, centralized process-group TERM→KILL, per-lane peak-RSS into verdicts);
A4 dead-owner takeover on top of these leases; E5 contention families via `hotPaths`.
