---
title: "Cost controls deploy workflow: one hosted job, main pushes, plan before deploy, polled check"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-cost-controls"
reversal: "Delete .github/workflows/deploy-cost-controls.yml and its line in the ci-runner-security exemption list; the stack's resources stay as last deployed."
---

`.github/workflows/deploy-cost-controls.yml` deploys the `prod` stage under the packet's standing conditions:

- Triggers: `push` to `main` filtered to `packages/tooling/infra/cost-controls/**`, `packages/tooling/library/alchemy-aws-extras/src/**`, `bun.lock` and the workflow file, plus a bare `workflow_dispatch` with no inputs (no `--adopt` path: the one adoption that needs it is declared per resource in source).
- Exactly one GitHub-hosted job, `Deploy cost controls (prod)`, on `ubuntu-24.04` with `timeout-minutes: 20`, in its own environment `cost-controls-prod`, under concurrency group `alchemy-cost-controls-prod` with `cancel-in-progress: false`; the S3 stage lease is the second guard.
- Credentials: `aws-actions/configure-aws-credentials` (same pinned SHA as the other deploy workflows) assumes `vars.COST_CONTROLS_DEPLOY_ROLE_ARN`, the stack-scoped role, not the shared state role.
- `alchemy plan --stage prod --detailed` writes to a file under `$RUNNER_TEMP` (on failure only its non-property lines are printed), then the pre-deploy gate step runs `plan-check.ts` on that file and on the live values of the nine adopted settings, then `alchemy deploy --stage prod --yes` without `--detailed`; all with `--env-file /dev/null --no-input`, `CI=true`, `ALCHEMY_TELEMETRY_DISABLED=1`. No property value reaches the log. The recipient secret is passed to plan and deploy and read only in the `live` phase. The gate is the window-5 ruling's condition 2 (decision "Cost controls is not lane-affecting on two conditions").
- A post-deploy check polls (10 tries, 15 s apart) until the budget `beep-account-monthly-cost` exists and the monitor `beep-account-services` carries `alchemy::stack=CostControls`, because Budgets and Cost Explorer are eventually consistent.
- Nothing else changes: no edit to `check.yml`, `heavy.yml`, `.github/actions/setup-monorepo-ci`, runner labels or any pull-request job. The job's line joins the exemption list in `packages/tooling/tool/cli/test/ci-runner-security.test.ts` beside the other two Alchemy deploys.

Rulings (packet gate session, 2026-11-14): the first `prod` plan runs only in this workflow, never from a workstation; this lane's PR opens when the gate says a packet slot is free (next in line after the three open PRs drain by one). The first run happens on the merge of this lane's PR. It needs the role, environment and variable from the deploy-role decision first; without them the credentials step fails and nothing is touched.
