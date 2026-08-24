# CI Step Watchdog Spec

Normative contract. Packet anchor document. Repo instructions and governing
standards outrank this file when they conflict. This spec was seeded on
2026-08-23 from the operator-confirmed
[`BRIEF.md`](../../explorations/ci-hang-observability/BRIEF.md), the ratified
[`MAP.md`](../../explorations/ci-hang-observability/MAP.md), and the
[`DECISIONS.md`](../../explorations/ci-hang-observability/DECISIONS.md) log.
Those links preserve provenance; this packet states the execution contract in
its own words.

## Objective

Bound every captured CI step with a per-step watchdog that converts runtime
hangs (the bun#27766/#34069 busy-spin class) into a forensic dump plus one
retried step, so no lane ever again burns a 50-minute timeout blind.

## Non-goals

- Do not add hosted observability infrastructure, including a CloudWatch
  agent, OTel or LGTM export, or dashboards.
- Do not attempt to repair Bun. An upstream report backed by a captured dump
  is useful, but it cannot block this goal.
- Do not wait for bun#27766 or bun#34069 to close before shipping the
  watchdog.
- Do not restructure `.github/workflows/check.yml` beyond the watchdog dump's
  `always()` artifact upload step.
- Do not add artifact-retention or cost-management machinery. Use GitHub's
  default artifact retention.
- Do not build a workstation reproduction harness in this arc.

## Source hierarchy

1. The operator objective that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture and package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target surfaces

- `packages/tooling/tool/cli/src/internal/process/StepExec.ts` for the split
  process-exit and capture-EOF lifecycle.
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` for the captured
  step-group watchdog, expected-duration policy, retry, and `repoCliStep`
  wrapper removal.
- `packages/tooling/tool/cli/test/step-capture-lifecycle.test.ts` and focused
  Quality task tests, using the existing fake-spawner pattern.
- One well-known watchdog-dump directory shared by the CLI and workflow.
- `.github/workflows/check.yml` for an `always()` artifact upload only.
- The post-bump soak record for Bun 1.4.0 (the pin landed ungated via PR
  #769, 2026-08-23; no shadow workflow — main's required-lane runs are the
  soak). The fleet AMI `/etc/beep-ci/bun-version` rebake is noted as
  fleet-ops housekeeping outside this packet.

## Workstreams

| Workstream | Required result |
| --- | --- |
| W1 split-await lifecycle events | Emit schema-first lifecycle events — an `S.Class` step-lifecycle event schema in the CLI, encoded as one-line JSON behind a stable `[beep-step]` prefix — for spawned pid/pgid, exit resolution with code and elapsed time, capture EOF, and watchdog deadline armed/fired. Preserve the existing captured-output contract while making exit and EOF independently visible. |
| W2 per-step watchdog | Bound every captured step group with `max(120 seconds, 2 × expectedSeconds)`, where `expectedSeconds` is a new step field seeded from the measured LPT timing data. On expiry, dump first, group-kill with TERM then KILL escalation, retry exactly once, and fail only if the retry fails. |
| W3 forensic dump and upload | Record the process tree and Bun process state in a stable directory, add best-effort tracing when the host permits it, and upload the directory from `check.yml` under `always()`. |
| W4 trigger reduction | Drop the nested `bun run beep` wrapper in both CLI-internal spawn sites (`repoCliStep` and `bunRunStep`); run the Bun 1.4.0 post-bump soak observation — the pin bump already landed ungated via PR #769 (2026-08-23), so required-lane runs on main are the soak: record 7 calendar days AND ≥30 Lint Policy runs on 1.4.0, noting zero hang signatures or any recurrence. |

## Constraints

- The first vertical slice joins W1, W2, and W3 on the Lint Policy lane. A
  synthetic hang built from the fake spawner in
  `packages/tooling/tool/cli/test/step-capture-lifecycle.test.ts` must drive
  watchdog fire, dump creation, process-group kill, one retry, and a green
  lane. A hosted run must expose the dump artifact.
- The watchdog ultimately covers every captured step group in every lane, not
  only Lint Policy.
- The deadline policy is settled: `max(120 seconds, 2 × expectedSeconds)`
  with `expectedSeconds` seeded per step from the measured LPT timing data
  (grilling 2026-08-23). This gives the roughly 435-second
  `lint:deprecated-apis` step ~14.5 minutes of headroom while bounding
  10-second steps at 2 minutes; a false positive costs one dump plus one
  retry, not a red lane. Record the seeded values and their evidence.
- Mark a watchdog expiry and its retry unmistakably in the job log. Always
  preserve the dump, including when the retry succeeds, so a retry cannot
  erase evidence of a real regression.
- The mandatory dump is `ps --forest` with pid, ppid, pgid, sid, state, CPU,
  wait channel, elapsed time, and command plus per-Bun-pid `/proc` `stat`,
  `status`, `wchan`, and `syscall`. Add a two-second `strace -f -c` summary and
  batch gdb thread backtraces only when available and permitted.
- Missing ptrace permission, `strace`, or gdb must not prevent the `/proc` and
  `ps` dump, process-group kill, retry, or artifact upload.
- Coordinate ownership before changing `.github/workflows/check.yml`. Keep
  the existing workflow structure intact apart from the `always()` upload.
- The Bun 1.4.0 pin bump landed ungated via PR #769 (2026-08-23) before this
  packet started, so no shadow workflow exists. W4's soak is observational:
  record 7 calendar days AND at least 30 Lint Policy runs on 1.4.0. Zero hang
  signatures confirms the trigger-surface claim; a recurrence proves 1.4.0
  did not fix bun#27766 and its watchdog forensics become the packet's
  captured evidence.
- The setup action's baked-versus-checkout Bun comparison stays intact; the
  fleet AMI's baked bun still needs its own 1.4.0 rebake as fleet-ops
  housekeeping outside this packet.
- A natural recurrence can strengthen the evidence but is not a completion
  gate. The synthetic end-to-end fixture is the deterministic proof.

## Decision log

| Date | Question | Answer | Rationale |
| --- | --- | --- | --- |
| 2026-08-23 | Which fix posture ships first? | Ship the watchdog and Bun 1.4.0 canary in the same arc; include the `repoCliStep` wrapper drop. | The watchdog bounds the failure class while the canary and wrapper change reduce likely triggers. None is a substitute for the bound. |
| 2026-08-23 | What observability is authorized? | In-job lifecycle events and watchdog-triggered process dumps only. | Ephemeral runners need evidence at the moment of failure; hosted telemetry would add plumbing and cost without answering the immediate stack question as directly. |
| 2026-08-23 | What happens when the watchdog fires? | Dump, group-kill, and retry once; fail if the retry fails. | Neighboring deterministic runs overwhelmingly pass, so one labeled retry limits CI delay while preserving the incident evidence. |
| 2026-08-23 | Where does the watchdog apply? | Every captured step group in every lane. | The failure is a runtime/process class, not a Lint Policy-only defect. |
| 2026-08-23 | Should this arc add a local reproduction harness? | No. Use the synthetic lifecycle fixture and hosted forensics. | Two synthetic stress attempts did not reproduce the low-frequency CI race; implementation time is better spent bounding and capturing it. |
| 2026-08-23 | Was the exploration ready to move past alignment? | Proceed through shape and decomposition, then graduate the single promised-now goal. | The operator confirmed the brief, the blocking-question list is empty, and the MAP identifies the work and existing seams. |
| 2026-08-23 | What cost and retention defaults apply? | No hosted-observability spend; use GitHub's default log and artifact retention. | The chosen in-job approach needs no new service or retention policy. |
| 2026-08-23 | How is each step's watchdog deadline computed? | `max(120s, 2 × expectedSeconds)`, with `expectedSeconds` a new per-step field seeded from measured LPT data. | One number cannot serve both ~435s and ~10s steps; 2× keeps false positives rare while detecting short-step hangs 24× faster than the job timeout, and the retry policy makes a false positive cheap. Rejected: flat lane-wide cap (slow detection), static duration classes (coarser for no gain). |
| 2026-08-23 | What format do lifecycle events use? | Schema-first JSON lines: an `S.Class` event schema encoded one-line behind a stable `[beep-step]` prefix. | Greppable by eye, machine-decodable by the same schema in tests and tooling; matches the repo's schema-first law. Rejected: text-only markers (regex parsing), dual text+JSON (marker noise). |
| 2026-08-23 | What exactly gates the Bun 1.4.0 pin bump? | Nightly-cron shadow workflow; 7 calendar days AND ≥30 green runs with zero hang signatures; operator-approved bump PR. | ~2%/run incidence needs both soak time and run count for confidence; the watchdog ships independently, so the gate buys confidence, not protection. Rejected: ≥60-run count gate (more spend for marginal power), count-only gate (weak soak signal). |
| 2026-08-23 | Which `bun run beep` wrappers are dropped? | The CLI-internal spawn sites: `repoCliStep` and `bunRunStep`. `check.yml`'s `run_lane` invocation stays. | Six bun processes per hung lane become four entirely within CLI-owned code; check.yml keeps its minimal-touch constraint (artifact step only). Rejected: full-chain drop (extra check.yml ownership), victim-path-only (leaves the orchestrator pair's wrapper in the suspect set). |
| 2026-08-23 | What replaces the canary after PR #769 bumped Bun to 1.4.0 ungated? | Post-bump soak observation: no shadow workflow; main's required-lane runs are the soak, recorded over 7 days AND ≥30 Lint Policy runs. | The gate's premise (repo pinned 1.3.14) was invalidated the same day by the routine deps refresh; observation preserves the gate's confidence intent at zero new infrastructure, and the watchdog — not the bump — is the protection. Rejected: dropping the soak entirely (loses the attribution evidence), inverse 1.3.14 canary (real EC2 cost for marginal science). |

## Acceptance criteria

- [ ] W1 emits all required lifecycle markers and independently exposes
      process exit and capture EOF without changing successful output.
- [ ] W2 applies a calibrated deadline to every captured step group, captures
      the dump before kill, escalates TERM to KILL for the process group,
      retries only watchdog expiries exactly once, and fails a failed retry.
- [ ] W3 writes the mandatory `ps` and `/proc` evidence to one documented
      directory; unavailable optional tools degrade cleanly.
- [ ] `.github/workflows/check.yml` uploads the watchdog directory under
      `always()` without other workflow restructuring.
- [ ] The Lint Policy first slice uses the existing fake-spawner pattern to
      prove watchdog fire, dump, group-kill, retry, and green completion; a
      hosted run exposes the dump artifact.
- [ ] Deadline calibration clears the slowest expected LPT work, including
      `lint:deprecated-apis`, with recorded margin.
- [ ] Both CLI-internal spawn sites (`repoCliStep` and `bunRunStep`) call
      `bun packages/tooling/tool/cli/src/bin.ts -- ...` directly instead of
      nesting the `bun run` script alias.
- [ ] The Bun 1.4.0 post-bump soak record covers 7 calendar days AND at
      least 30 Lint Policy runs, with the hang-signature outcome noted
      either way (the pin landed ungated via PR #769, 2026-08-23).
- [ ] Focused tests, CLI package checks, the Lint Policy lane, and packet
      checks pass.
- [ ] The completed work ships through `/yeet` until each required PR is
      merge-ready with all review threads resolved.
- [ ] No unrelated refactors or formatting churn.

## Verification matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Lifecycle and watchdog tests | `bunx --bun vitest run packages/tooling/tool/cli/test/step-capture-lifecycle.test.ts packages/tooling/tool/cli/test/quality-tasks.test.ts` | Synthetic hang covers dump, kill, retry-once, and failure paths |
| CLI typecheck | `bun run --cwd packages/tooling/tool/cli check` | Passes |
| Lint Policy | `bun run beep lint policy --full` | Passes without a watchdog false positive |
| Hosted first slice | Lint Policy Actions run plus uploaded watchdog artifact | Green run; artifact is present under `always()` |
| Bun soak | Post-bump soak record: 7 days AND ≥30 Lint Policy runs on 1.4.0 | Record complete with the hang-signature outcome noted either way |
| Packet launcher size | `test "$(wc -m < goals/ci-step-watchdog/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/ci-step-watchdog/ops/manifest.json` | Passes |
| Goal packet doctor | `bun run beep goals doctor` | No finding caused by this packet |
| Goal index | `bun run beep goals index --check` | Passes |
| Whitespace | `git diff --check -- goals/ci-step-watchdog goals/INDEX.md` | Passes |
| Delivery | `bun run beep yeet monitor` | `merge-ready: yes`; zero unresolved review threads |

## Stop conditions

- The watchdog cannot terminate the captured step's process group without
  leaving descendants alive.
- Safe timing values cannot clear known legitimate LPT durations with enough
  margin to avoid routine false positives.
- The implementation needs a broader `check.yml` restructure, hosted
  observability, new dependencies, or fleet changes beyond the noted
  fleet-AMI Bun rebake housekeeping.
- Another owner has overlapping work in `check.yml` or the target CLI seams
  and coordination has not resolved it.
- The Bun 1.4.0 soak records a hang recurrence or incompatible runtime
  behavior on the already-landed pin — report it with the watchdog forensics
  rather than improvising a rollback.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
