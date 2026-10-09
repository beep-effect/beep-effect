# Hosted CI policy checks

`bun run beep ci workflow-lint` checks parsed workflows for writer-environment isolation, trusted caller guards, explicit artifact retention and non-cancelling main-push concurrency. `bun run beep ci held-group` reports an old waiting main Check run with a pending successor, includes its pending-deployment count and exits nonzero. API errors and truncated results report unknown, never clean. Neither command changes GitHub settings or cancels runs.

`bun run beep ci ruleset --capture` reads ruleset 10240248, compares required contexts with `CI_LANE_DESCRIPTORS` and regenerates the dated context snapshot. `--check` performs the read-only comparison. Knip's context, job and descriptor must be removed in the orchestrator's coordinated merge window; recapture immediately afterward.

`bun run beep ci settings --check` fails when the desktop environment is missing or lacks a nonempty required-reviewer rule. The enabled desktop release path also requires its signing key; a successful environment check alone does not establish release readiness.

## Heavy workflow merge proof

`check.yml` and `heavy-admit.yml` call `heavy.yml@main`, under the runner group's trusted-workflow restriction. A PR changing `heavy.yml` proves the previous main version. Every such PR requires a post-merge Heavy probe before its workflow change is accepted:

1. Record the exact merge SHA and the Check main-push run for that SHA.
2. Read its jobs and require all seven `Heavy / *` matrix lanes to execute successfully. A docs-only skip does not qualify.
3. Record writer environment attachment only on Turbo lanes and the trusted-push cache mode from their logs. Save the short-lived Turbo summary artifacts as evidence.
4. If the run is stuck, use `ci held-group` and route remediation to the orchestrator. If it fails, attribute the failure and repair it once on main. The lane remains unqualified until a successful probe.

## Trust posture

Most required contexts use PR-ref workflows. A same-repository author can modify those workflows. This repository deliberately accepts that single-operator posture; the trusted reusable Heavy workflow and environment-only writer secret are independent boundaries. Reconsider this posture when independent contributors or maintainers become regular users.

Cache-writer expressions stay in trusted caller workflows. The composite setup action and its environment exporter execute PR code and may only receive the already-guarded tuple. Fork Heavy execution requires both admission labels; fork documentation changes stay held rather than marking required contexts satisfied without proof.
