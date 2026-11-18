---
title: "CI runners deploy workflow drafted, not wired, until the window-5 release"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Do not add the drafted workflow; deploy prod from a gate-run dispatch instead."
---

Drafted here, not as a `.github` file: the window-5 measurement forbids any `.github/` change until the gate releases P5, and every workflow PR of this packet is disclosed to the orchestrator and merged by the operator. When released, the gate (or the lane it names) adds the workflow `deploy-ci-runners.yml` (in the repository workflows directory) with this content, adds its line to the `ci-runner-security` exemption test as cost-controls did, and asks the operator for the merge:

```yaml
name: Deploy CI runners

# Deploys the `prod` stage of the Alchemy stack in packages/tooling/infra/ci-runners:
# the runner fleet network, the heavy and shard-overflow pools (RunnerFleet), the
# runner IAM policies and the reaper. State lives in the shared S3 state store; its
# stage lease plus this concurrency group serialize prod deploys and never cancel
# one mid-apply. The plan runs first, to a file, and plan-check.ts (tested in
# src/PlanCheck.ts) stops the job before any deploy on a replace, delete, orphan,
# foreign resource or unreadable line. Credentials: the stack-scoped OIDC role
# vars.CI_RUNNERS_DEPLOY_ROLE_ARN on the ci-runners-prod environment; App
# credentials are that environment's secrets and stay Redacted to SSM.
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
      CI_RUNNERS_GITHUB_APP_ID: ${{ secrets.CI_RUNNERS_GITHUB_APP_ID }}
      CI_RUNNERS_GITHUB_APP_KEY_BASE64: ${{ secrets.CI_RUNNERS_GITHUB_APP_KEY_BASE64 }}
      CI_RUNNERS_GITHUB_WEBHOOK_SECRET: ${{ secrets.CI_RUNNERS_GITHUB_WEBHOOK_SECRET }}
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

      - name: Plan prod stage
        working-directory: packages/tooling/infra/ci-runners
        shell: bash
        run: |
          set -euo pipefail
          if ! bunx alchemy plan --stage prod --env-file /dev/null --no-input --detailed \
            > "$RUNNER_TEMP/ci-runners-plan.log" 2>&1; then
            grep -v -E 'INFO: {3}' "$RUNNER_TEMP/ci-runners-plan.log" || true
            exit 1
          fi

      - name: Check the plan before deploy
        working-directory: packages/tooling/infra/ci-runners
        run: bun plan-check.ts "$RUNNER_TEMP/ci-runners-plan.log"

      - name: Deploy prod stage
        working-directory: packages/tooling/infra/ci-runners
        shell: bash
        run: |
          set -euo pipefail
          bunx alchemy deploy --stage prod --yes --env-file /dev/null --no-input | tee "$RUNNER_TEMP/ci-runners-deploy.log"

      # One unsigned request to the webhook: the function must answer and refuse
      # it (401 or 403). No AWS describe call, so the check adds nothing to the
      # account's EC2 API rate the live scale-up shares.
      - name: Verify the webhook answers and refuses an unsigned event
        shell: bash
        run: |
          set -euo pipefail
          url="$(grep -o -E 'https://[a-z0-9]+\.lambda-url\.us-east-1\.on\.aws/' "$RUNNER_TEMP/ci-runners-deploy.log" | tail -n 1)"
          [[ -n "$url" ]]
          status="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' "$url")"
          echo "webhook status=${status}"
          [[ "$status" == "401" || "$status" == "403" ]]
```

Open points in the draft for the releasing lane: the deploy log is assumed to print the stack output, webhook URL included (beta.87 has no `alchemy output` command; confirm the format on the first deploy and adjust the `grep`); an unsigned request gets 401 from `Webhook.program.ts`, a payload that fails the allow list 403; the `paths` filter redeploys the fleet on every library source change, which is intended (the Lambdas are bundled from that source) but means every `@beep/alchemy-github-runners` PR deploys runner code on merge, so those PRs need the same review bar as this package.

Added at the packet gate's GO (2026-11-18), disarmed: the workflow ships in the P5 PR with its job gated on `if: vars.CI_RUNNERS_DEPLOY_ARMED == 'true'`, the pattern `deploy-infra-github.yml` uses, so merging it, a later push and a manual dispatch all skip the job before any step while the variable is unset. The gate sets the variable for cutover step 1, only after the deploy role and environment exist and the orchestrator confirms `BEEP_HEAVY_BURST_MAX=6`; unsetting it disarms again. Its `ci-runner-security` exemption line is added in the same PR.
