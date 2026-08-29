# Brief — CI step watchdog and hang forensics

<!-- Shape-stage pitch. Fat-marker fidelity: concrete enough to decompose,
rough enough to leave design latitude. Grounded in RESEARCH.md and
DECISIONS.md (2026-08-23). -->

## Problem

Roughly 2% of hosted `Lint Policy` runs finish 25 of their 26 policy steps in
~5 minutes, then sit completely silent until the 50-minute job timeout, fail
the required check, and block the PR. Four incidents share one proven
signature: a live bun process tree busy-spinning 1-2 full cores for the
entire silence window, struck at a schedule-determined step; attribution to
the open bun#27766 / bun#34069 family (on the then-pinned Bun 1.3.14) is
the leading inference pending an on-host stack (`RESEARCH.md`). Each incident costs a 50-minute billable EC2 hang,
a lane rerun, and — until this packet — a diagnosis dead-end, because a
running policy step is a black box: no live output, no per-step bound, no
forensics at cancellation. PR #748 bounded the child-exited-but-pipe-held
class; nothing bounds a child that never exits.

## Appetite

One focused PR arc plus one low-touch canary — about a week of calendar, a
few days of actual work. This is a bounded-hardening arc, not an
observability platform: if the watchdog and forensics land and one natural
recurrence is captured, the arc has paid for itself.

## Solution sketch

Four pieces, one goal packet:

1. **Split-await lifecycle events** (StepExec): timestamped, single-line
   structured markers on the existing stdout channel for each captured step —
   spawned (pid/pgid), exit-resolved (code, elapsed), capture-EOF, deadline
   armed/fired. The current `done in` marker collapses exit and EOF into one
   state; splitting them makes the next incident legible from the job log
   alone.
2. **Per-step watchdog** at the `runStepGroup`/`collectResolvedStepOutput`
   seam, covering every captured step group in every lane: deadline =
   max(flat floor, small multiplier × the step's expected LPT duration —
   must clear `lint:deprecated-apis` at ~435s with margin). On fire:
   capture a forensic dump, group-kill the step (TERM → KILL escalation),
   retry once, fail the lane only if the retry fails.
3. **Forensic dump** written to a well-known directory and uploaded via an
   `always()` artifact step in `check.yml`: `ps --forest` with
   pid/ppid/pgid/sid/stat/pcpu/wchan, per-bun-pid `/proc`
   `stat|status|wchan|syscall` (R-state + frozen voluntary context switches
   ⇒ userspace spin), optional 2s `strace -f -c` and `gdb -batch` thread
   backtraces where the host permits. The dump is designed to identify the
   spinning pid and its stack in ONE recurrence.
4. **Trigger-surface reduction, in parallel:**
   - **Bun 1.4.0 canary**: a temporary standalone shadow workflow (the
     ci-lane-shadow precedent — check.yml stays untouched except the
     artifact step) running the lint-policy lane on Bun 1.4.0; after ~a week
     of green parity and no hangs, a repo-wide pin bump PR (`.bun-version`,
     `packageManager`, fleet AMI `/etc/beep-ci/bun-version` note).
   - **Wrapper drop**: `repoCliStep` invokes
     `bun packages/tooling/tool/cli/src/bin.ts -- …` directly instead of
     the nested `bun run` script alias — halves bun processes per step and removes the
     wrapper wait path from the suspect set.

## Rabbit holes

- **ptrace/gdb availability on AL2023** (Yama `ptrace_scope`, gdb not baked
  into the AMI): the dump must degrade gracefully — `/proc` + `ps` alone are
  already decisive for spin-vs-wait; treat strace/gdb as best-effort extras.
- **Watchdog false positives on legitimately slow steps**: expected-duration
  data exists (LPT table), but a cold-cache or contended run can exceed it;
  the multiplier/floor must be generous, and a watchdog kill must be
  unmistakably labeled in output so it is never misread as a step failure.
- **Retry masking a genuine regression**: a real infinite loop introduced by
  a diff would also be killed-and-retried; the dump is always captured and
  the retry is marked, so the evidence trail survives the green lane. Accept
  this consciously (align: determinism argument).
- **check.yml ownership**: the artifact-upload step touches check.yml —
  coordinate with any in-flight CI work before landing.
- **Bun 1.4.0 behavioral diffs beyond the spin family** (e.g. spawn encoding
  change #36050): the canary week exists precisely to surface these; do not
  shortcut it.
- **AMI-baked bun vs checkout pin mismatch**: the setup action already
  compares them; the bump PR must keep that path green.

## No-gos

- No hosted observability infrastructure this arc: no CloudWatch agent, no
  OTel/LGTM export, no dashboards. (Align, round 1.)
- No attempt to fix Bun itself; filing/linking an upstream issue with our
  forensic dump is welcome but not a gate.
- No waiting on upstream: the watchdog ships regardless of bun#27766's fate.
- No check.yml restructuring beyond the always() artifact step.
- No retention/cost machinery: dumps ride GitHub's default artifact
  retention.
- No workstation repro harness as part of the arc. (Align, round 2.)
