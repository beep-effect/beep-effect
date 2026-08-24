# CI Step Watchdog Plan

## Status

Status: `paused`

The packet is authored but implementation has not started. Resume by setting
the lifecycle to `active`, confirming ownership of the target CLI and workflow
files, and starting W1.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research inheritance | complete | Carry the confirmed exploration's problem, decisions, decomposition, and source ledger into this packet. | `SPEC.md` and `research/SOURCES.md` trace the root cause and every binding decision to the exploration. |
| W1 Split-await lifecycle events | pending | Expose spawn, exit, capture EOF, and deadline states on the existing output channel. | Focused tests distinguish exit resolution from stream EOF and assert every required marker. |
| W2 Per-step watchdog | pending | Add the calibrated deadline and dump-kill-retry-once behavior at the captured step-group seam. | The fake spawner proves timeout, dump-before-kill ordering, one retry, and final failure; a real-process Linux integration test proves TERM-to-KILL escalation removes an entire detached group with a TERM-ignoring descendant. |
| W3 Forensic dump and artifact upload | pending | Persist mandatory process evidence and upload it from `check.yml` under `always()`. | W1-W3 pass end-to-end on the Lint Policy synthetic-hang slice and a hosted run exposes the artifact. |
| W4 Trigger-surface reduction | pending | Drop the `bun run` wrapper at both CLI-internal spawn sites and record the Bun 1.4.0 post-bump soak (the pin landed ungated via PR #769, 2026-08-23). | Direct CLI invocation is proven; the soak record covers 7 calendar days AND ≥30 Lint Policy runs on 1.4.0 with the hang-signature outcome noted either way. |
| P5 Verify | pending | Prove all captured groups are bounded without false positives or workflow regressions. | Focused tests, CLI checks, Lint Policy, hosted artifact evidence, packet doctor, and index checks pass. |
| P6 Yeet: PR to mergeable | pending | Publish the work through Yeet and close every hosted gate and review thread. | `merge-ready: yes` for each required PR; zero unresolved review threads. |
| P7 Close | pending | Record the closeout evidence and reflection, then flip packet lifecycle. | A schema-valid reflection exists and packet status/evidence match the shipped result. |

## First vertical slice: W1 + W2 + W3

Keep the first three workstreams joined until the failure path works
end-to-end on Lint Policy:

1. Extend the split await in `StepExec.ts` with schema-first lifecycle events
   (`S.Class`, one-line JSON behind the `[beep-step]` prefix) for spawn, exit
   resolution, capture EOF, and deadline state.
2. At the `runStepGroup` / `collectResolvedStepOutput` seam, derive the
   deadline as `max(120s, 2 × expectedSeconds)` from a new per-step
   `expectedSeconds` field seeded from measured LPT data.
3. Extend the existing fake-spawner test pattern with a child that does not
   exit. Advance the test clock through watchdog fire.
4. Write the process dump before signalling the group, escalate TERM to KILL,
   then retry once.
5. Prove the retry turns the synthetic hang into a green Lint Policy result
   while leaving the incident dump intact; add the real-process Linux
   group-kill integration test (detached leader + TERM-ignoring descendant).
6. Make the hosted artifact deterministic: always write a per-run watchdog
   summary into the dump directory, and add the opt-in synthetic-hang
   trigger; run the slice on hosted CI and confirm the `always()` artifact
   exists on an ordinary run, then once via the synthetic-hang trigger with
   a full incident dump.

Do not widen coverage or start W4 until this slice passes.

## W1 split-await lifecycle events

- Preserve captured output and the post-exit pipe deadline introduced by PR
  #748.
- Emit one timestamped, single-line JSON record per event — an `S.Class`
  step-lifecycle event schema encoded behind the stable `[beep-step]`
  prefix — for spawned pid/pgid, exit-resolved code and elapsed time,
  capture EOF, deadline armed, and deadline fired.
- The same schema decodes the records in tests and log archaeology; no
  telemetry service is introduced.

## W2 per-step watchdog

- Compute `max(120 seconds, 2 × expectedSeconds)`; seed each step's
  `expectedSeconds` from measured LPT timing data and record the values and
  their evidence.
- Cover every captured step group in every quality lane after the first slice.
- On expiry, label the watchdog event, invoke W3's dump, group-kill with TERM
  and bounded KILL escalation, then retry exactly once.
- Do not retry ordinary nonzero exits. If the timeout retry fails or hangs,
  fail the lane with both attempts identified.

## W3 forensic dump and artifact upload

- Choose one documented directory shared by the CLI and workflow.
- Capture `ps --forest` with pid, ppid, pgid, sid, state, CPU, wait channel,
  elapsed time, and command.
- For every Bun pid, capture `/proc/<pid>/stat`, `status`, `wchan`, and
  `syscall` before signalling it.
- Attempt a two-second `strace -f -c` and batch gdb thread backtraces only
  when installed and permitted. Record why each optional probe was skipped.
- Add one `always()` upload step to `check.yml`; do not restructure the
  workflow.

## W4 trigger-surface reduction

1. Change both CLI-internal spawn sites — `bunRunStep`/`repoCliStep` in
   `Quality/Tasks.ts` (victim steps) and the separate `bunRunStep` helper in
   `Ci/CiLane.ts` (the middle `bun run beep lint policy --full` pair) — to
   call `bun packages/tooling/tool/cli/src/bin.ts -- ...` directly and
   prove command, exit, and capture behavior stays equivalent
   (`check.yml`'s `run_lane` invocation is out of scope). Both files are
   required to reach six-to-four processes per hung lane.
2. The repo already runs Bun 1.4.0: PR #769 (2026-08-23) bumped
   `.bun-version` and `packageManager` ungated, superseding the planned
   shadow canary. No shadow workflow is added.
3. Record the post-bump soak instead: 7 calendar days AND at least 30 Lint
   Policy runs on 1.4.0, with zero hang signatures — or any recurrence,
   whose watchdog forensics then become the packet's captured evidence that
   1.4.0 did not fix bun#27766.
4. The fleet AMI's baked bun rebake to 1.4.0 is fleet-ops housekeeping
   outside this packet; the setup action's baked-versus-checkout comparison
   covers the gap meanwhile.

## P5 verification

```sh
bunx --bun vitest run packages/tooling/tool/cli/test/step-capture-lifecycle.test.ts packages/tooling/tool/cli/test/quality-tasks.test.ts
bun run --cwd packages/tooling/tool/cli check
bun run beep lint policy --full
test "$(wc -m < goals/ci-step-watchdog/GOAL.md)" -le 4000
jq . goals/ci-step-watchdog/ops/manifest.json
bun run beep goals doctor
bun run beep goals index --check
git diff --check -- goals/ci-step-watchdog goals/INDEX.md
```

Attach the hosted Lint Policy run, watchdog artifact, the post-bump soak
record, selected
deadline constants, and any natural recurrence under `history/`. A natural
recurrence is useful evidence, not a prerequisite for P6.

## P7 closeout checklist

Before changing lifecycle to `completed-retained`:

1. Drive every required PR to `merge-ready: yes` through `/yeet` and resolve
   every review thread.
2. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`, starting
   from `history/reflections/_TEMPLATE.md`.
3. Run `bun run beep lint reflection-artifacts`.
4. Update `README.md`, this plan, and `ops/manifest.json` in the same closeout
   PR so the phase and lifecycle state agree.

## Current blockers

None. The lifecycle pause records that execution has not been authorized in
this scaffold session; activating the packet is the resume condition.
