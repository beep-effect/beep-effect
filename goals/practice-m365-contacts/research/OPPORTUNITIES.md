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
