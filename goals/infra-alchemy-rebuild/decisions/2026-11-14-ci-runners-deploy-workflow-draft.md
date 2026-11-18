---
title: "CI runners deploy workflow drafted, not wired, until the window-5 release"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Do not add the drafted workflow; deploy prod from a gate-run dispatch instead."
---

Drafted here, not as a `.github` file: the window-5 measurement forbids any `.github/` change until the gate releases P5, and every workflow PR of this packet is disclosed to the orchestrator and merged by the operator. When released, the gate (or the lane it names) adds the workflow `deploy-ci-runners.yml` (in the repository workflows directory) with this content (synced 2026-11-18 to the shipped file: App secrets on the two steps that run the stack program only, and the checked deploy of the cutover decision's condition d), adds its line to the `ci-runner-security` exemption test as cost-controls did, and asks the operator for the merge:

```yaml
name: Deploy CI runners

# Deploys the `prod` stage of the CiRunners Alchemy stack in
# packages/tooling/infra/ci-runners: the runner fleet network, the heavy and
# shard-overflow pools (RunnerFleet), the runner IAM policies and the reaper,
# built beside the Pulumi beep-ci-runners/production fleet under new names
# (goals/infra-alchemy-rebuild P5). State lives in the shared S3 state store;
# its stage lease plus this concurrency group serialize prod deploys and never
# cancel one mid-apply.
#
# The job is DISARMED: it runs only while the repository variable
# CI_RUNNERS_DEPLOY_ARMED is `true`. Unarmed, the job is skipped before any
# step, so merging this workflow deploys nothing, and neither does a push or a
# manual dispatch. The packet gate arms it for cutover step 1 only after the
# orchestrator confirms the CI goals driver lowered the heavy burst cap to 6
# (decision "CI runners cutover from the Pulumi fleet").
#
# The plan step plans the stage, runs the plan check (src/PlanCheck.ts) and
# saves the checked plan; it stops the job on a replace, delete or orphan, a
# destructive binding change, a foreign resource or a stack action. The deploy
# step plans again under the stage lease, checks again and applies that same
# plan object only when it equals the saved one (src/CheckedDeploy.ts,
# applyIfUnchanged); any drift between the two stops it before a write.
# Credentials: the stack-scoped OIDC role vars.CI_RUNNERS_DEPLOY_ROLE_ARN on
# the ci-runners-prod environment; App credentials are that environment's
# secrets, passed only to the plan and deploy steps, and stay Redacted to SSM.
# Runbook: docs/runbooks/alchemy-infra.md.
on:
  push:
    branches: [main]
    paths:
      - packages/tooling/infra/ci-runners/**
      - packages/tooling/library/alchemy-github-runners/src/**
      - packages/tooling/library/alchemy-aws-extras/src/**
      - bun.lock
      - .github/workflows/deploy-ci-runners.yml
  workflow_dispatch:

concurrency:
  group: alchemy-ci-runners-prod
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  deploy:
    name: Deploy CI runners (prod)
    if: vars.CI_RUNNERS_DEPLOY_ARMED == 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    environment:
      name: ci-runners-prod
    permissions:
      contents: read
      id-token: write
    env:
      CI: "true"
      ALCHEMY_TELEMETRY_DISABLED: "1"
    steps:
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup monorepo CI
        uses: ./.github/actions/setup-monorepo-ci

      - name: Configure AWS credentials (ci-runners deploy role)
        uses: aws-actions/configure-aws-credentials@e1253824e5c10ff9df46874f81ed3ec929e19cfd # v6.3.0
        with:
          role-to-assume: ${{ vars.CI_RUNNERS_DEPLOY_ROLE_ARN }}
          role-session-name: alchemy-ci-runners-prod
          aws-region: us-east-1

      # Plans prod, prints resources, actions and bindings (never a value), runs
      # the plan check and saves the checked plan for the deploy step.
      - name: Plan and check the prod stage
        working-directory: packages/tooling/infra/ci-runners
        # The App secrets reach only the two steps that run the stack program.
        env:
          CI_RUNNERS_GITHUB_APP_ID: ${{ secrets.CI_RUNNERS_GITHUB_APP_ID }}
          CI_RUNNERS_GITHUB_APP_KEY_BASE64: ${{ secrets.CI_RUNNERS_GITHUB_APP_KEY_BASE64 }}
          CI_RUNNERS_GITHUB_WEBHOOK_SECRET: ${{ secrets.CI_RUNNERS_GITHUB_WEBHOOK_SECRET }}
        run: bun plan-check.ts plan --stage prod --out "$RUNNER_TEMP/ci-runners-checked-plan.json"

      # Applies only the checked change set: plans again, checks again, and
      # refuses before any write when the plan differs from the saved one.
      - name: Deploy the checked plan
        working-directory: packages/tooling/infra/ci-runners
        shell: bash
        # The App secrets reach only the two steps that run the stack program.
        env:
          CI_RUNNERS_GITHUB_APP_ID: ${{ secrets.CI_RUNNERS_GITHUB_APP_ID }}
          CI_RUNNERS_GITHUB_APP_KEY_BASE64: ${{ secrets.CI_RUNNERS_GITHUB_APP_KEY_BASE64 }}
          CI_RUNNERS_GITHUB_WEBHOOK_SECRET: ${{ secrets.CI_RUNNERS_GITHUB_WEBHOOK_SECRET }}
        run: |
          set -euo pipefail
          bun plan-check.ts deploy --stage prod --checked "$RUNNER_TEMP/ci-runners-checked-plan.json" \
            | tee "$RUNNER_TEMP/ci-runners-deploy.log"

      # One unsigned request to the webhook: the function must answer and refuse
      # it (401). No AWS describe call, so the check adds nothing to the
      # account's EC2 API rate the live scale-up shares.
      - name: Verify the webhook answers and refuses an unsigned event
        shell: bash
        run: |
          set -euo pipefail
          url="$(grep -o -E '^webhookUrl=https://[a-z0-9]+\.lambda-url\.us-east-1\.on\.aws/' "$RUNNER_TEMP/ci-runners-deploy.log" | tail -n 1 | cut -d= -f2- || true)"
          if [[ -z "$url" ]]; then
            echo "::error::the deploy log names no webhook function URL"
            exit 1
          fi
          status="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' "$url")"
          echo "webhook status=${status}"
          [[ "$status" == "401" || "$status" == "403" ]]
```

Open points in the draft for the releasing lane: `plan-check.ts deploy` prints the stack output's webhook URL as one `webhookUrl=<url>` line, which the last step reads (beta.87 has no `alchemy output` command); an unsigned request gets 401 from `Webhook.program.ts`, a payload that fails the allow list 403 (an empty allow list admits no repository); the `paths` filter redeploys the fleet on every library source change, which is intended (the Lambdas are bundled from that source) but means every `@beep/alchemy-github-runners` PR deploys runner code on merge, so those PRs need the same review bar as this package.

Added at the packet gate's GO (2026-11-18), disarmed: the workflow ships in the P5 PR with its job gated on `if: vars.CI_RUNNERS_DEPLOY_ARMED == 'true'`, the pattern `deploy-infra-github.yml` uses, so merging it, a later push and a manual dispatch all skip the job before any step while the variable is unset. The gate sets the variable for cutover step 1, only after the deploy role and environment exist and the orchestrator confirms `BEEP_HEAVY_BURST_MAX=6`; unsetting it disarms again. Its `ci-runner-security` exemption line is added in the same PR.
