# CI Step Watchdog Sources and Provenance

Primary and canonical ledger:
[`explorations/ci-hang-observability/research/SOURCES.md`](../../../explorations/ci-hang-observability/research/SOURCES.md).
This goal carries the exploration's source tables so implementers can work
from the goal packet without losing the original provenance. Resolve any
disagreement in favor of the canonical exploration ledger.

## Inherited research

- [`BRIEF.md`](../../../explorations/ci-hang-observability/BRIEF.md) records
  the operator-confirmed problem, appetite, solution shape, rabbit holes, and
  no-gos.
- [`MAP.md`](../../../explorations/ci-hang-observability/MAP.md) defines the
  W1-W4 decomposition and the Lint Policy first vertical slice.
- [`DECISIONS.md`](../../../explorations/ci-hang-observability/DECISIONS.md)
  records the align decisions carried into `SPEC.md`.
- [`RESEARCH.md`](../../../explorations/ci-hang-observability/RESEARCH.md)
  synthesizes the four-incident census, code trace, host evidence, Bun prior
  art, and mitigation gap.
- [`EVIDENCE.md`](../../../explorations/ci-hang-observability/research/evidence/EVIDENCE.md)
  preserves the operational evidence distilled from short-lived CI and host
  sources.

## Upstream repositories and licenses

| Repo | License | Disposition |
| --- | --- | --- |
| [actions/runner](https://github.com/actions/runner) | MIT | Reference only for process completion, signal escalation, and orphan cleanup semantics. |
| [oven-sh/bun](https://github.com/oven-sh/bun) | MIT | Reference only for spawn and stream semantics plus the hang-class issues. |
| [nodejs/node](https://github.com/nodejs/node) | MIT | Reference only for process `close` versus `exit` and detached-process semantics. |
| [sindresorhus/execa](https://github.com/sindresorhus/execa) | MIT | Reference only for timeout, forced kill, and descendant-kill prior art. |
| [typescript-eslint/typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) | MIT | Reference only for project-service non-exit prior art; it is not on the victim path. |
| [vercel/turborepo](https://github.com/vercel/turborepo) | MIT | Reference only for daemon lifecycle; it is not on the victim path. |
| [github-aws-runners/terraform-aws-github-runner](https://github.com/github-aws-runners/terraform-aws-github-runner) | MIT | Reference only for ephemeral runner lifecycle; the repo already carries its own infrastructure bridge. |
| [dsherret/ts-morph](https://github.com/dsherret/ts-morph) | MIT | Existing dependency and the victim law's engine. |
| [Effect](https://github.com/Effect-TS/effect) | MIT | Existing platform; validate process-spawner behavior against `.repos/effect`. |

All upstream entries are MIT. This goal uses them as behavioral references or
existing dependencies; it does not vendor upstream code.

## Key external citations

- [actions/runner `ProcessInvoker.cs`](https://github.com/actions/runner/blob/main/src/Runner.Sdk/ProcessInvoker.cs)
  documents stream EOF waiting, the exited-process fallback, and Linux signal
  behavior.
- [actions/runner `JobExtension.cs`](https://github.com/actions/runner/blob/main/src/Runner.Worker/JobExtension.cs)
  documents environment-tagged orphan cleanup.
- [actions/runner issue 4601](https://github.com/actions/runner/issues/4601)
  records the orphan-sweep race and the unimplemented per-job cgroup proposal.
- [Bun issue 27766](https://github.com/oven-sh/bun/issues/27766) is the open
  Bun 1.3.14 concurrent-child busy-spin and SIGTERM-immune case.
- [Bun issue 34069](https://github.com/oven-sh/bun/issues/34069) is the open
  parent pipe-reader busy-spin case with a synthetic hammer that also failed
  to reproduce the suite failure.
- [Bun pull request 34780](https://github.com/oven-sh/bun/pull/34780) covers a
  timer-related `epoll_pwait` busy-spin fix shipped in 1.4.0.
- [Bun pull request 36711](https://github.com/oven-sh/bun/pull/36711) covers
  nested `bun run` wait and signal behavior in 1.4.0.
- [Bun 1.4.0 release notes](https://bun.com/blog/bun-v1.4) list the related
  runtime fixes and motivated the originally planned shadow canary
  (superseded by PR #769's ungated pin bump; see the SPEC decision log).
- [Bun issue 11892](https://github.com/oven-sh/bun/issues/11892),
  [Bun issue 1498](https://github.com/oven-sh/bun/issues/1498), and
  [Bun issue 31653](https://github.com/oven-sh/bun/issues/31653) provide
  GitHub Actions and piped-stdout hang prior art.
- [Bun spawn documentation](https://bun.sh/docs/api/spawn) describes parent
  lifetime relative to child processes.
- [Node child process documentation](https://nodejs.org/api/child_process.html)
  distinguishes process exit from stream close.
- [GitHub Actions timeout syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idtimeout-minutes)
  defines the current job-level bound.
- [ringerc/github-actions-signal-handling-demo](https://github.com/ringerc/github-actions-signal-handling-demo)
  has no verified license and is reference-only evidence for observed signal
  timing.

The remaining external URL corpus is cataloged in
[`external-prior-art.md`](../../../explorations/ci-hang-observability/research/lanes/external-prior-art.md)
and
[`external-bun-spin.md`](../../../explorations/ci-hang-observability/research/lanes/external-bun-spin.md).

## Mined lane reports

| Id | Producer | Path | Disposition |
| --- | --- | --- | --- |
| code-trace | GPT-5.6 Sol, 2026-08-23 | [`code-trace-report.md`](../../../explorations/ci-hang-observability/research/lanes/code-trace-report.md) | Primary in-repo trace; file and line claims were spot-verified against live source during synthesis. |
| external-prior-art | Grok 4.6, 2026-08-23 | [`external-prior-art.md`](../../../explorations/ci-hang-observability/research/lanes/external-prior-art.md) | External source survey with primary citations. |
| external-bun-spin | Grok 4.6, 2026-08-23 | [`external-bun-spin.md`](../../../explorations/ci-hang-observability/research/lanes/external-bun-spin.md) | Follow-up on the 100 percent CPU signature and Bun-side diagnostics. |

## Operational evidence

| Source | Access path | Retention note |
| --- | --- | --- |
| Incident job logs for jobs 97264522737, 95555682095, 95354812245, and 94646234791 | `gh api repos/beep-effect/beep-effect/actions/jobs/<id>/logs` | GitHub retains the logs for a limited window; the durable summary is in the exploration's `EVIDENCE.md`. |
| 100-run `check.yml` job census | `gh run list` plus the per-run jobs API | Point-in-time 2026-08-23 snapshot summarized in `EVIDENCE.md`. |
| EC2, CloudWatch, and CloudTrail incident evidence | Read-only service metrics, console output, and event lookup | Short-lived one-minute metric series; key values are copied into `EVIDENCE.md`. |
| Local reproduction hammer | Workstation Bun 1.3.14 scratch run | The 0/40 result is recorded in `EVIDENCE.md`; the scratch script is not a goal artifact. |

## In-repo capability references

| Brick | Path | Role and disposition |
| --- | --- | --- |
| `run_lane` session wrapper | `.github/workflows/check.yml` | Reuse the existing session and group TERM/KILL envelope. |
| CI lane dispatch | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` | Reuse the `lint-policy` dispatch path. |
| Policy scheduler | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` | Extend `runStepGroup`, the 26-step LPT schedule, expected durations, and completion markers. |
| Captured exec and wedge guard | `packages/tooling/tool/cli/src/internal/process/StepExec.ts` | Extend `runCaptured` and preserve `capturePipeDeadline`; W1 event emission is new. |
| Victim law | `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts` | Reference the proven in-process victim path when checking process-tree assumptions. |
| CLI teardown hard exit | `packages/tooling/tool/cli/src/bin-main.ts` | Preserve the current successful teardown guard. |
| Child-process spawner | `.repos/effect/packages/platform/{bun,node-shared}/src` | Reuse and verify detached leader and group-kill semantics. |
| Capture lifecycle tests | `packages/tooling/tool/cli/test/step-capture-lifecycle.test.ts` | Extend the fake-spawner pattern for the first vertical slice. |
| Hosted timing collector | `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` | Reuse timing evidence for deadline calibration. |
| Fleet probes | `.github/workflows/fleet-lane-probe.yml`, `.github/workflows/fleet-shadow-check.yml` | Reuse as host-diagnostic and shadow-workflow precedents. |
| Fleet infrastructure and reaper | `infra/src/CiRunners.ts` | Reference only; the existing reaper was not implicated. |

## Cross-links

- Source exploration:
  [`explorations/ci-hang-observability`](../../../explorations/ci-hang-observability/README.md).
- Goal decision contract: [`SPEC.md`](../SPEC.md#decision-log).
- Goal execution sequence: [`PLAN.md`](../PLAN.md#phases).
