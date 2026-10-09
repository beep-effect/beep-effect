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
