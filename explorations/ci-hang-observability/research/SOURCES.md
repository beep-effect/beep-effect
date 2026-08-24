# Sources — provenance ledger

Started 2026-08-23 (research stage). Conventions per `explorations/README.md`:
every external citation carries its URL and license where relevant; mined lane
reports are archived under [`lanes/`](./lanes/); operational evidence is
distilled in [`evidence/EVIDENCE.md`](./evidence/EVIDENCE.md).

## Upstream repos cited (license → disposition)

| Repo | License | Disposition |
| --- | --- | --- |
| [actions/runner](https://github.com/actions/runner) | MIT | Reference only (semantics: ProcessInvoker EOF wait + 5s exited-fallback, SIGINT 7.5s → SIGTERM 2.5s → SIGKILL step-PID-only, `RUNNER_TRACKING_ID` orphan sweep) |
| [oven-sh/bun](https://github.com/oven-sh/bun) | MIT | Reference only (spawn/stream semantics, hang-class issues) |
| [nodejs/node](https://github.com/nodejs/node) | MIT | Reference only (`'close'` vs `'exit'`, detached+unref+ignore daemon pattern) |
| [sindresorhus/execa](https://github.com/sindresorhus/execa) | MIT | Reference only (timeout / forceKillAfterDelay / killDescendants prior art) |
| [typescript-eslint/typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) | MIT | Reference only (projectService non-exit prior art; not on the victim path) |
| [vercel/turborepo](https://github.com/vercel/turborepo) | MIT | Reference only (daemon lifecycle; not on the victim path) |
| [github-aws-runners/terraform-aws-github-runner](https://github.com/github-aws-runners/terraform-aws-github-runner) | MIT | Reference only (ephemeral runner lifecycle; already vendored via Pulumi bridge in `infra/`) |
| [dsherret/ts-morph](https://github.com/dsherret/ts-morph) | MIT | Already a repo dependency; the victim law's engine |
| [Effect (effect-smol / .repos/effect)](https://github.com/Effect-TS/effect) | MIT | Already the repo's platform; spawner semantics verified against the local reference checkout |

## Key external citations (full URL set in the lane reports)

- actions/runner `ProcessInvoker.cs` — step completion waits on stdout/stderr
  EOF **but** force-completes ~5s after process exit; Linux kill is per-PID,
  never process-tree: <https://github.com/actions/runner/blob/main/src/Runner.Sdk/ProcessInvoker.cs>
- actions/runner `JobExtension.cs` — orphan cleanup = `RUNNER_TRACKING_ID`
  env sweep + `Process.Kill()` (SIGKILL), no cgroup:
  <https://github.com/actions/runner/blob/main/src/Runner.Worker/JobExtension.cs>
- actions/runner#4601 (2026-08-03) — orphan sweep race; proposes per-job
  cgroup kill (unimplemented): <https://github.com/actions/runner/issues/4601>
- oven-sh/bun#27766 (2026-03, **open; confirmed on 1.3.14**) — concurrent bun
  children with piped stdio: 5-10% permanently spin at 100% of one core,
  never exit, ignore SIGTERM (zero-timeout poll stacks); the primary named
  suspect: <https://github.com/oven-sh/bun/issues/27766>
- oven-sh/bun#34069 (2026-07, open; on 1.3.13/1.3.14) — parent pipe-reader
  wait-loop spin at ~100% after a lost child exit; reporter's synthetic
  hammer also 0/40: <https://github.com/oven-sh/bun/issues/34069>
- oven-sh/bun#34780 (2026-07, shipped in 1.4.0) — epoll_pwait fallback
  busy-spin on sub-ms timers: <https://github.com/oven-sh/bun/pull/34780>
- oven-sh/bun#36711 (2026-08, 1.4.0) — nested `bun run` wait/signal
  semantics; documents the wrapper waits in `wait4`:
  <https://github.com/oven-sh/bun/pull/36711>
- Bun 1.4.0 release notes (2026-08-20; no 1.3.15 exists) — spin-family fixes
  + 5× idle CPU claim: <https://bun.com/blog/bun-v1.4>
- oven-sh/bun#11892 (2024-06, open) — spawn "works locally, hangs on GitHub
  Actions waiting for stdoutPromise": <https://github.com/oven-sh/bun/issues/11892>
- oven-sh/bun#1498 — pending piped-stdout `read()` never resolves, keeps bun
  alive: <https://github.com/oven-sh/bun/issues/1498>
- oven-sh/bun#31653 (2026-06, bun 1.3.8) — `bun test` hangs on GHA, stream
  never EOFs, CI-only: <https://github.com/oven-sh/bun/issues/31653>
- Bun spawn docs — "The parent `bun` process does not terminate until all
  child processes have exited" (`unref()` opt-out):
  <https://bun.sh/docs/api/spawn>
- Node child_process docs — `'close'` (stdio closed) vs `'exit'` (process
  ended) distinction: <https://nodejs.org/api/child_process.html>
- GitHub `timeout-minutes` semantics:
  <https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idtimeout-minutes>
- ringerc/github-actions-signal-handling-demo (no license file — cited as
  empirical timing demo only): SIGINT → 7.5s → SIGTERM → 2.5s → SIGKILL:
  <https://github.com/ringerc/github-actions-signal-handling-demo>

The full cited corpus (≈40 more issue/doc URLs with dates and versions) lives
in [`lanes/external-prior-art.md`](./lanes/external-prior-art.md) and
[`lanes/external-bun-spin.md`](./lanes/external-bun-spin.md).

## Mined lane reports (archived verbatim)

| Id | Producer | Path | Disposition |
| --- | --- | --- | --- |
| code-trace | GPT-5.6 Sol (codex exec, high reasoning), 2026-08-23 | [`lanes/code-trace-report.md`](./lanes/code-trace-report.md) | Primary in-repo trace; file:line claims spot-verified against live source during synthesis |
| external-prior-art | Grok 4.6 (xhigh), 2026-08-23 | [`lanes/external-prior-art.md`](./lanes/external-prior-art.md) | External landscape §§1-6; primary-source cited |
| external-bun-spin | Grok 4.6 (xhigh), 2026-08-23 | [`lanes/external-bun-spin.md`](./lanes/external-bun-spin.md) | Follow-up on the 100%-CPU spin signature and bun-side diagnostics |

## Operational evidence (this repo / this AWS account)

| Source | Access path | Retention note |
| --- | --- | --- |
| Incident job logs (jobs 97264522737, 95555682095, 95354812245, 94646234791) | `gh api repos/beep-effect/beep-effect/actions/jobs/<id>/logs` | GitHub retains ~90 days; distilled in [`evidence/EVIDENCE.md`](./evidence/EVIDENCE.md) |
| 100-run `check.yml` job census | `gh run list` + per-run jobs API | Point-in-time snapshot 2026-08-23; distilled in EVIDENCE.md |
| EC2/CloudWatch/CloudTrail for the incident instances | `AWS/EC2` metrics, `get-console-output`, CloudTrail lookup (read-only) | 1-minute CW granularity ~15 days; key series copied into EVIDENCE.md |
| Local repro hammer (0/40 solo) | scratchpad script, workstation bun 1.3.14 | Result recorded in EVIDENCE.md |

## In-repo bricks this packet composes (live-source verified)

| Brick | Path | Role |
| --- | --- | --- |
| `run_lane` session wrapper | `.github/workflows/check.yml` (verification step) | setsid + group TERM/KILL after leader exit |
| CI lane dispatch | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` | `lint-policy` → `bun run beep lint policy --full` |
| Policy scheduler | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` (`runStepGroup`, `rootRepoLintPolicySteps`, concurrency 3 LPT) | the 26-step group + `done in` markers |
| Captured exec + wedge guard | `packages/tooling/tool/cli/src/internal/process/StepExec.ts` (`runCaptured`, `capturePipeDeadline`, PR #748) | dual await (exit ∧ EOF) + post-exit reap |
| Victim law | `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts` | in-process ts-morph scan, no children |
| CLI teardown hard-exit | `packages/tooling/tool/cli/src/bin-main.ts` | success-path `process.exit(0)` guard |
| Spawner | `.repos/effect/packages/platform/{bun,node-shared}/src` | BunServices → NodeChildProcessSpawner: detached leaders, `'exit'`-event exitCode, group-kill finalizers |
| Capture lifecycle tests | `packages/tooling/tool/cli/test/step-capture-lifecycle.test.ts` | unit coverage of the #748 guard |
| Hosted timing collector | `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` | offline job/setup/pickup durations (no RSS) |
| Fleet probes | `.github/workflows/fleet-lane-probe.yml`, `fleet-shadow-check.yml` | operator-dispatched host diagnostics (not in check.yml) |
| Fleet infra + reaper | `infra/src/CiRunners.ts` | ephemeral fleet stack; TTL reaper (not implicated) |
