# Execution friction

## 2026-10-09 — fresh lane package checks need dependency declarations

- Activity: first edited-driver typecheck through `beep-heavy`.
- Evidence: `bun run --cwd packages/drivers/m365 check` reported TS6305 for
  missing identity/schema/utils declaration outputs, followed by cascading
  unknown/never diagnostics. The lane was installed but not built.
- Attribution: missing dependency build products are an environment precondition;
  the cascading source diagnostics do not yet prove source regressions.
- Prevention: package qualification should explicitly build its dependency
  declaration graph before invoking package-level TypeScript checks.

## 2026-10-09 — reference and installed Effect source differ at one version

- Activity: checking cryptography API against the required `.repos/effect` reference.
- Evidence: both package manifests say `4.0.2`; the reference source exposes
  `randomUUIDv4()` while the installed package exposes `randomUUIDv4` as an Effect.
  The installed package's own example confirms the property form.
- Resolution: use the installed v4 contract, then prove it in the offline CLI.
- Prevention: pin reference commit as well as package version in API checks.

## 2026-10-09 — inherited reference gate flags prose in another goal

- Activity: hosted-parity `bun run knowledge:refs-check`.
- Evidence: exit 1; one live gated observation at
  `goals/repository-simplification-confidence/SPEC.md:374` for a home-path literal.
- Attribution: the same sentence is present in untouched base `36027982f2`;
  the gate is inherited, outside this lane's packet ownership.
- Prevention: recognize quoted prohibition examples before treating them as paths,
  or correct the originating packet in the program's consolidated red-remediation PR.

## 2026-10-09 — shared heavy budget delays the first qualification result

- Activity: full driver package verification and one app fixture file.
- Evidence: both logs repeatedly report `all 3 slots busy, waiting`;
  their units retain the required 32 GiB cap and zero swap. Read-only lock and
  process inspection confirms other lanes own the occupied slots and are running
  actual gate processes. No other lane was stopped or altered.
- Prevention: a fair FIFO admission queue with estimated wait and owner metadata
  would make qualification progress predictable. The current waiter opens slot
  metadata with truncation before failing its lock, erasing useful owner receipts.

- Subsequent inspection observed another job holding a fourth slot, while this
  lane's approved wrapper remains on its three-slot default. No slot-count
  override or cap increase was applied here. Admission policy changes should
  propagate to lane briefs and waiters together.

- Resolution found: the installed wrapper gained its configured slot-floor
  support after these waiters started. Its current floor is four slots, with
  memory still 32 GiB and concurrency two. Restarted only the two queued lane
  waiters through the current wrapper; set no slot override and changed no
  configuration or cap. Old waiters are recorded as cancelled-before-gate,
  never as passing proofs. A running waiter should reread admission policy.

## 2026-10-09 — application qualification exposes service-context leaks

- Activity: full application package verification after upstream builds.
- Evidence: 40 dependency build tasks passed; the application's own audit failed
  on uncaptured FileSystem/Crypto dependencies and platform/schema error types,
  plus Effect compiler rules for yieldable errors and entrypoint provisioning.
- Attribution: introduced application and fixture defects. Capture platform
  handles in the service layer, build scoped CLI/test contexts, preserve typed
  decoding and expose pipeable planning helpers. These failures are repaired,
  never attributed to other lanes.
- Prevention: qualify the application service contract with the strict compiler
  immediately after wiring it, before constructing the operational runbook.

- The repaired driver gate then remained unexecuted for over 50 minutes while
  shared slots turned over. Replaced only that queued command with a bounded
  driver-and-parity batch to avoid another admission cycle per short gate.
  The cancelled waiter's result is explicitly false; a successful systemd stop
  must never be read as a successful quality command.

- Terminal blocker: after the wrapper refresh, waiter restarts and bounded
  batching, the repaired driver and application qualifications still did not
  acquire a slot despite repeated turnover. At one inspection there were 22
  waiters for four slots. Stopped only this lane's two unstarted waiters under
  the brief's repeating-blocker condition; both terminal results are explicitly
  `cancelled-before-gate`, `passed: false`. No home configuration, cap or other
  lane was changed. Prevention: fair queued admission rather than lock polling.

## 2026-10-09 — strict fixture qualification on resume

- Activity: repaired driver package verification through the five-slot wrapper.
- Evidence: dependency builds passed; audit reported `deterministicKeys`,
  `preferTypedSchemaDecoder`, `unnecessaryFailYieldableError` and
  `strictEffectProvide` in the new contact fixtures.
- Attribution: introduced fixture defects. Fix commit `cbb6a545b0` uses the
  established `it.layer` harness, typed codecs and the deterministic service key.
  The P0 row is acknowledged with the fix sha; replacement proof remains queued.
- Prevention: run the test compiler immediately after authoring new fixtures,
  and compose their layers with the repository test harness from the beginning.

- Current-main knowledge-reference check identified one introduced host-path
  observation at the seeding runbook's state-directory example. Replaced it
  with `<state-home>` and the environment-variable/default description. The
  earlier inherited observation is historical; this run uses the new result.

- Resume app verification reached the strict compiler after 40 successful
  dependency tasks; three composition diagnostics remained. Fix `b19e9a1036`
  expresses pipeable layer building and scopes the executable's runtime context.
  Replacement proof is required; upstream success is not an app pass.

## 2026-10-09 — fallow qualification of rollback branches

- Activity: hosted-parity fallow audit, dead-code and health.
- Evidence: two introduced dead export/type findings for `ContactsFailureReason`
  and three complexity findings in undo selection and HTTP fixture generation.
  Health itself passed.
- Remediation: internal failure domain, side-effect-free selection and count
  passes, explicit undo validation and empty-owned-folder cleanup, and a simpler
  fixture response constructor. No suppressions or baseline edits.
- Prevention: run fallow after the initial schema/service implementation rather
  than after the broad dependent docgen proof.

## 2026-10-09 — publish catches integration policies after package qualification

- Activity: first PR 1 publish; nothing pushed on refusal.
- Evidence: cache-policy flagged seven new-app tasks; goals doctor rejected
  phase token `done`; effect-vitest found eleven introduced fixture judgments.
  Schema-first also flagged two untouched Accounts schemas; thirteen Vitest
  findings are in untouched main files, attributed for S11.
- Remediation: canonical `complete`, scoped app-only cache review via the owner,
  harness-owned filesystem layer, bounded fixture hook budgets and canonical
  Option assertion. Native filesystem judgment records why real permissions,
  lock and export behavior need the platform layer; inherited rows stay open.
- Prevention: run cheap policy integration before long dependent docgen closure.

## 2026-10-09 — hosted inventory red omits its underlying cause

- Activity: follow-up PR #1595 readiness monitoring; JSDoc Ratchet failed.
- Evidence: completed hosted inventory log prints only
  `Failed to generate JSDoc documentation inventory.` Main `3200e01946`
  job 114066037311 reproduces that same failure independently.
- Attribution: inherited under S11; no TypeScript/docgen-config follow-up diff.
- Prevention: retain the typed inventory error cause in the failure capsule so
  agents can attribute it directly without a second main-job comparison.

## 2026-10-09 — full lint policy finds codec construction inside callbacks

- Activity: follow-up Heavy Lint Policy completed-log attribution.
- Evidence: five contacts schema-hoisting errors in command output, export and
  fixtures; package audits had passed but omit this root oxlint policy.
- Remediation: hoist existing JSON schemas to private module constants; run the
  scoped root rule directly, then requalify affected packages and one push wave.
- Prevention: include scoped root oxlint in the package handoff contract, and
  inspect every named failure before acknowledging an aggregate hosted red.

## 2026-10-10: grant handback wait after merged delivery

- Work: advance the merged contact driver/job into the read-only grant probe
  and pre-seed export, preserving the authorization and export ordering.
- Evidence: PR 1 #1591 merged at 22:56:39 UTC; repair follow-up #1595 merged
  at 00:19:46 UTC. The S13 final gate was consumed. At 00:50 UTC the required
  scoped grant handback remained absent. No mailbox call or write had run.
- Friction: merge completion does not provide a visible grant execution state;
  the worker can only poll for the final authorization handback until the
  brief's three-hour deadline. The cause of the delay is unknown.
- Prevention: give the grant owner an explicit queued/running/failed receipt
  beside the final InScope proof, so the worker can distinguish scheduling
  delay from a failed grant without querying or modifying the tenant.

## 2026-10-13 — heavy wrapper user-bus environment

- Doing: read-only grant probe through `beep-heavy` after workstation reboot.
- Evidence: the initial wrapper failed before admission with user scope bus
  unavailable; the env verification itself passed. Providing the standard
  user-bus environment let the wrapper admit and Graph return HTTP 403.
- Prevention: initialize the user runtime directory and bus address in the
  lane launcher so every heavy job has the same user-systemd context.
- Outcome: wrapper repaired for this invocation only; no home config changed.
  HTTP 403 is a separate grant-propagation observation, not a wrapper failure.
- Reversal: remove the invocation-local environment once the launcher supplies it.

## 2026-10-13 — read-only propagation probe queues behind heavy work

- Doing: scheduled retry of the credential-gated folder-list smoke.
- Evidence: retry 8 reached `beep-heavy` around 20:28 UTC and reported all
  five slots busy; still unadmitted at 20:33 UTC. This is not a Graph result.
- Prevention: a governed admission weight for short live read probes could
  keep safety checks from waiting behind multi-package builds. This needs
  a later owner decision; this lane does not bypass the required wrapper.
- Outcome: keep the existing waiter and poll its result every minute.

## 2026-10-13 — zero-create first run has no receipt

- Doing: online planning before the authorized smoke/apply.
- Evidence: plan has Create 0, SkipExistsInMailbox 480, SkipUnidentifiable 7.
  `ContactSeeding.apply` returns before folder discovery and journal save
  when creates is empty; per-run undo rejects absent journal state.
- Prevention: fixture the first online apply against an already populated
  mailbox and define a no-op receipt/undo contract before live verification.
- Outcome: stop before writes; reviewed fix or scope ruling required.


## 2026-10-13 — zero-create qualification blocked upstream

- Task: qualify the bounded empty-journal repair before the authorized live sequence.
- Evidence: full driver package proof passes; full app package proof stops in
  `@beep/box:build` with `TS2589: Type instantiation is excessively deep` before
  the app audit starts. Box source matches origin/main; no contacts driver edit.
- Prevention: make direct package qualification distinguish dependency-build
  failures from failures in the touched package, retaining both receipts.
- Response: acknowledged inherited failure under S11; qualify app audit,
  test typecheck and scoped coverage directly through beep-heavy. Do not edit Box.


## 2026-10-13 — live-smoke admission delay

- Task: run the already-qualified contacts-only smoke after the clean online plan.
- Evidence: beep-heavy reports all five shared slots busy; the live batch remains
  queued while repository-wide inventory generation runs in the parity batch.
  Polls find no smoke result yet, so no write or smoke pass is claimed.
- Prevention: expose durable queue position and admission time in result receipts.
- Response: retain the waiter and poll every minute; do not cancel it for timeout
  or bypass the shared budget. At most two lane heavy units remain active.


## PR 2 review qualification admission (2026-10-13)

While qualifying the two PR #1623 journal-safety review fixes,
`beep-heavy bun run beep quality package-verify @beep/practice-m365-contacts`
remained queued for more than ten minutes with `all 5 slots busy, waiting`.
No gate had started and no pass was claimed. The waiter was retained under the
brief's admission ruling. A fair admission queue with a durable position and
wait estimate would make review-wave completion easier to coordinate.
