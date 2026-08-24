# Distilled operational evidence

Collected 2026-08-23 during the research stage. Raw job logs were fetched via
`gh api repos/beep-effect/beep-effect/actions/jobs/<id>/logs` (GitHub retains
them ~90 days); CloudWatch series via `aws cloudwatch get-metric-statistics`
(namespace `AWS/EC2`, period 60-300s). Instance/runner identifiers below
already appear in the public Actions UI for this public repo; no account
identifiers, tokens, or raw environment values are reproduced.

## Incident census (all known occurrences of the hang signature)

| Date (UTC) | Run / job | Victim step | Done markers | Silence window | Orphan bun PIDs at cleanup | CPU plateau |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-14 01:29 | job 94646234791 | `lint:docgen` | 24 | ~40 min | 6 (three adjacent pairs) | flat ~12.7% of 8 vCPU = **1 core pinned** |
| 2026-08-17 10:14 | job 95354812245 | `lint:docgen` | 25 | ~29 min | 6 (three adjacent pairs) | flat ~25.25% = **2 cores pinned** |
| 2026-08-18 00:34 | run 32085002354 / job 95555682095 | `lint:native-runtime` | 25 | 00:40:18 → 01:24:31 (~44 min) | 6: 5420/5421, 5450/5451, 6404/6405 | (not sampled) |
| 2026-08-23 21:38 | run 32668069065 / job 97264522737 (PR #764) | `lint:native-runtime` | 25 | 21:45:31 → 22:29:03 (~43.5 min) | 6: 4762/4763, 4874/4875, 5838/5839 | flat 25.13-25.15% = **2 cores pinned** |

PR #748 (`capturePipeDeadline`, commit `5ea413ed25`) merged 2026-08-17 12:19 UTC —
between the second and third rows. Victim shifted from `lint:docgen` (spawning,
pipe-holdable) to `lint:native-runtime` (in-process, no children) at that
boundary.

Baseline: in the 100 most recent `check.yml` runs (2026-08-17 → 2026-08-23),
Lint Policy succeeded in 5-6 minutes everywhere else, including all of
2026-08-23's neighboring runs on different ephemeral instances. Other
`cancelled` entries in the window are whole-run concurrency cancellations
(many lanes cancelled together at small durations), not hangs. Frequency of
the hang signature ≈ 2 per ~90 Lint Policy runs post-fix.

## Incident 2026-08-23 (job 97264522737) timeline

- Runner `beep-ci-i-032876b44cde6141c` (= EC2 `i-032876b44cde6141c`,
  r7a.2xlarge, 8 vCPU / 64 GiB, ephemeral fleet label `beep-ec2-heavy`).
- 21:38:57 job start; 21:40:01 "Run verification lane" starts; 21:40:05 the
  lane announces all 26 policy step commands (announcement ≠ start).
- 25 `done in` markers between 21:41:24 and 21:45:31; last: `lint:judge-rubric`
  at 21:45:31.5.
- `lint:native-runtime` announced (`bun run beep laws native-runtime --check`)
  and never done; no `CapturePipeWedgedError`; no further output of any kind.
- 22:29:03 `##[error]The operation was canceled.` (GitHub 50-min job timeout),
  post-job cleanup, then `Cleaning up orphan processes` terminating six bun
  PIDs: 4762, 4763, 4874, 4875, 5838, 5839.

### Schedule reconstruction (start = done − duration, concurrency 3)

Slot A: `lint:deprecated-apis` 21:40:06→21:45:08 (302s).
Slot B: `lint:docgen` 21:40:06→21:43:27 (201s), then `lint:jsdoc` →
`lint:identity-registry` → … .
Slot C: `knowledge:semantic-delta` 21:40:06→21:41:25, `knowledge:refs-check`
→21:42:02, `lint:schema-first` →21:43:01, `lint:terse-effect` →21:43:44.8 —
then the next list entry, **`lint:native-runtime`, takes slot C at ≈21:43:45
and never returns it**. Its first ~83 seconds overlap the still-running
4-way `lint:deprecated-apis` ESLint shards (measured 12-16 GiB peak class) and
the tail of slot B's mid-size steps. From 21:45:31 it is the only step left.

## AWS instance evidence (incident 2026-08-23)

- `RunInstances` 21:38:17 by scale-up; `TerminateInstances` 22:29:15 (normal
  ephemeral teardown after the GitHub-side cancel). No reaper action mid-job.
- `StatusCheckFailed` = 0 across the whole window; kernel console output has
  zero OOM-killer / hung-task / panic lines. Not a host failure, not kernel OOM.
- CPUUtilization (60s period): burst to 76-90% max during the work phase
  (21:40-21:50), then **dead-flat 25.13-25.15% avg=max from ~21:50 to 22:25**
  — exactly 2 of 8 vCPUs at 100%, constant for ~40 minutes.
- During the plateau: EBSReadOps ≈ 0/min, EBSWriteOps ≈ 50/min (background),
  NetworkOut ≈ 7 KB/s (runner keepalive). The spin does no I/O.
- Prior incidents' instances show the same shape: flat 12.67% (1 core,
  2026-08-14, `beep-ci-i-023cf70c3a9fc98d1`) and flat 25.25% (2 cores,
  2026-08-17, `beep-ci-i-0bf2117956bf8b3fb`).

## Local reproduction attempts (2026-08-23, workstation)

- `CI=1 GITHUB_ACTIONS=true bun run beep laws native-runtime --check
  </dev/null | cat`: completes in ~10-11s, exit 0 (bun 1.3.14, same as CI's
  `.bun-version`).
- 40-iteration solo hammer of the same invocation with piped stdio: 0/40
  hangs, all 10-11s. The solo piped invocation does not reproduce; the CI
  trigger involves lane context (concurrent co-resident steps and/or the
  hosted machine state).

## Interpretation anchors (why these facts discriminate)

- actions/runner completes a step at most ~5s after the step process exits
  even if output pipes are still held (ProcessInvoker exited-fallback) — so a
  43-minute silent step means the step process tree was alive the whole time.
- The six orphans are structural, not incidental: the lane is three nested
  `bun run` pairs — (1) `bun run beep ci lane lint-policy` + `bin.ts`,
  (2) `bun run beep lint policy --full` + `bin.ts`, (3) the victim step
  `bun run beep laws …` + `bin.ts` — all detached session leaders that the
  runner's step-PID-only SIGINT/SIGTERM/SIGKILL cannot reach; identical count
  in all four incidents.
- Post-#748, a victim whose direct child exits gets reaped/completed (or dies
  loudly) within ~5-6s; neither happened, and the victim pair was alive at
  cleanup ⇒ the victim's direct child never exited: it sat spinning 1-2 cores.
