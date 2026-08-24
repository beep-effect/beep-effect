# Map — candidate goal packets

<!-- Decompose-stage output. Grounded in BRIEF.md (confirmed 2026-08-23) and
DECISIONS.md rounds 1-2. Every major component cites an existing repo
capability or is marked NET-NEW. -->

## Candidate goals

### 1. `ci-step-watchdog` (promised now — the only goal this packet spawns)

**Mission:** bound every captured CI step with a per-step watchdog that
converts runtime hangs (the bun#27766/#34069 busy-spin class) into a
forensic dump plus one retried step, so no lane ever again burns a
50-minute timeout blind.

**Dependencies:** none — all four workstreams land inside this one packet.
The Bun 1.4.0 pin-bump PR is *gated* on the canary week inside the goal,
not a separate goal.

**Workstreams (sequenced):**

| # | Workstream | What ships | Capability citation |
| --- | --- | --- | --- |
| W1 | Split-await lifecycle events | Structured single-line markers (spawned pid/pgid, exit-resolved, capture-EOF, deadline armed/fired) around the existing dual await | Existing seam: `runCaptured` / `capturePipeDeadline` (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:604-635,506-522`); marker precedent: `[beep-cli] … done in` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1434-1443`). Event emission NET-NEW. |
| W2 | Per-step watchdog + dump-kill-retry-once | Deadline = max(flat floor, multiplier × expected duration); on fire: forensic dump → group-kill (TERM→KILL) → single retry; lane fails only if retry fails | Seam: `runStepGroup`/`collectResolvedStepOutput` (`Tasks.ts:1371-1449`); kill mechanics exist: `handle.kill({ forceKillAfter })` + group-kill finalizers (`StepExec.ts:510-513`, spawner `.repos/effect/packages/platform/node-shared/src/NodeChildProcessSpawner.ts:362-384`); expected-duration data: LPT table (`Tasks.ts:1835-1883`) + `beep ci lane-timings` (`packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts`). Watchdog + retry policy NET-NEW. |
| W3 | Forensic dump + artifact upload | Dump script (`ps --forest`, per-bun-pid `/proc` stat/status/wchan/syscall; best-effort `strace -c`/`gdb -batch`) to a well-known dir; `always()` upload step in `check.yml` | Dump recipe: researched + validated (`explorations/ci-hang-observability/research/lanes/external-bun-spin.md` §5); artifact-step precedent: fallow always-run envelopes in `check.yml`; host-probe precedent: `.github/workflows/fleet-lane-probe.yml`. Dump script + upload step NET-NEW. |
| W4 | Trigger-surface reduction | (a) Bun 1.4.0 canary: temp standalone shadow workflow running the lint-policy lane on 1.4.0, ~1 week green → repo-wide pin-bump PR (`.bun-version`, `packageManager`, AMI `/etc/beep-ci/bun-version`); (b) wrapper drop: `repoCliStep` invokes `bun packages/tooling/tool/cli/src/bin.ts -- …` directly | Shadow-workflow precedent: ci-lane-shadow (lint-policy-single-digit campaign); pin-compare logic exists: `.github/actions/setup-monorepo-ci/action.yml` (baked-vs-checkout bun version); `repoCliStep` (`Tasks.ts:1512-1529`). Canary workflow NET-NEW; wrapper drop is a one-site edit. |

**First vertical slice:** W1 + W2 + W3 scoped to proving end-to-end on the
Lint Policy lane — a synthetic hang fixture (test double already exists:
`packages/tooling/tool/cli/test/step-capture-lifecycle.test.ts` fake-spawner
pattern) drives watchdog fire → dump written → group-kill → retry → lane
green, with the dump artifact visible on a hosted run. Coverage widening to
all captured step groups and W4 follow once the slice is proven.

**Inherited risks (from BRIEF rabbit holes):** ptrace/gdb availability on
AL2023 (dump degrades to `/proc`+`ps`); watchdog false positives (generous
multiplier, unmistakable labeling); retry masking a real regression
(accepted in align — dump always captured); `check.yml` coordination; Bun
1.4 behavioral diffs (canary week exists for this); AMI/checkout pin
mismatch path stays green.

## Explicitly not goals

- Hosted observability (CW agent / OTel / LGTM) — no-go in align round 1;
  re-entry point only if in-job forensics prove insufficient after a
  captured recurrence.
- Upstream bun fix / issue-filing — welcome side effect, never a gate.
- Workstation repro harness — rejected in align round 2.

## Capability check verdict

Every component either cites a live repo brick above or is marked NET-NEW
(event emission, watchdog policy, dump script, canary workflow) — and each
NET-NEW item is a thin layer over an existing seam, not a rebuilt brick.
