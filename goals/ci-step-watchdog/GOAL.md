# GOAL: bound every captured CI step

Repo root: the current working directory, the `beep-effect` checkout you are
running in. Use repo-relative paths because several checkouts may exist.

Outcome: Bound every captured CI step with a per-step watchdog that converts
runtime hangs (the bun#27766/#34069 busy-spin class) into a forensic dump plus
one retried step, so no lane ever again burns a 50-minute timeout blind.

This is a compact `/goal` launcher. The packet files are the contract:

- `goals/ci-step-watchdog/README.md`
- `goals/ci-step-watchdog/SPEC.md`
- `goals/ci-step-watchdog/PLAN.md`
- `goals/ci-step-watchdog/ops/manifest.json`
- `goals/ci-step-watchdog/research/SOURCES.md`

Read them first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md`. Repo instructions outrank packet prose when they conflict.

Scope:

- In: captured process lifecycle in `StepExec.ts`; step-group scheduling,
  deadlines, retry, and the spawn sites in `Tasks.ts` AND `CiLane.ts`;
  focused CLI tests; watchdog dumps; one `always()` upload in `check.yml`;
  the Bun 1.4.0 post-bump soak record (pin landed ungated via PR #769).
- Out: hosted telemetry, dashboards, a Bun runtime fix, a local repro harness,
  retention machinery, and any other `check.yml` restructuring.

Workflow:

1. Confirm the packet is `active`, inspect current ownership and changes on
   every target file, and preserve unrelated work.
2. W1: split process exit from capture EOF and emit the required lifecycle
   markers without changing successful output.
3. W2: add the calibrated per-step deadline. On timeout, invoke W3's dump,
   TERM then KILL the process group, retry once, and fail only if the retry
   fails.
4. W3: add the mandatory `ps` and per-Bun-pid `/proc` dump, optional
   strace/gdb probes, and the sole `check.yml` change: an `always()` artifact
   upload.
5. Prove W1-W3 as one Lint Policy vertical slice with the existing
   `step-capture-lifecycle.test.ts` fake-spawner pattern. The synthetic hang
   must produce the dump, die as a group, retry, finish green, and expose its
   artifact on a hosted run.
6. Widen the watchdog to every captured step group. Record deadline
   calibration that clears `lint:deprecated-apis` with margin.
7. W4: drop the `bun run beep` wrapper at both spawn sites (`Tasks.ts`
   `bunRunStep`/`repoCliStep` AND the `CiLane.ts` `bunRunStep` helper).
   The Bun 1.4.0 pin already landed ungated (PR #769, 2026-08-23): record
   the post-bump soak instead — 7 days AND >=30 Lint Policy runs on 1.4.0,
   observational only; clean runs are never confirmation.
8. Run the `SPEC.md` verification matrix. Publish through `/yeet`, monitor to
   `merge-ready: yes`, resolve every review thread, then complete P7.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion passes.
- [ ] Watchdog events and retries are unmistakable, and every timeout leaves
      a dump even when the retry succeeds.
- [ ] Optional host probes degrade cleanly to mandatory `ps` and `/proc`
      evidence.
- [ ] Each required PR is merge-ready through `/yeet`.
- [ ] No unrelated refactors or formatting churn.

Stop and report instead of improvising if process-group kill leaves orphans,
safe deadline calibration is not possible, `check.yml` needs broader changes,
target-file ownership overlaps, the 1.4.0 soak shows a recurrence, or the
work needs an unnamed dependency, credential, cost, destructive effect, or
policy approval.
