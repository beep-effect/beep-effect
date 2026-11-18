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
# Armed, only the two cutover dispatches run (`bootstrap`, then
# `default-security-group`): a `routine` run, every push included, also needs
# CI_RUNNERS_ROUTINE_ARMED = `true`, which the gate sets only after step 1b
# succeeds. So no push can reconcile the stack between 1a and 1b.
#
# The plan step plans the stage, runs the plan check (src/PlanCheck.ts) and
# saves the checked plan; it stops the job on a replace, delete or orphan, a
# destructive binding change, a foreign resource or a stack action. The deploy
# step plans again under the stage lease, checks again and applies that same
# plan object only when it equals the saved one (src/CheckedDeploy.ts,
# applyIfUnchanged); any drift between the two stops it before a write. The
# dispatch input `mode` names the cutover expectation both steps enforce:
# `bootstrap` (step 1a) and `default-security-group` (step 1b) refuse any other
# change; pushes run as `routine`.
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
    inputs:
      mode:
        description: "routine; bootstrap (cutover step 1a: creates only, no DefaultSecurityGroup); default-security-group (step 1b: that one create)"
        type: choice
        options: [routine, bootstrap, default-security-group]
        default: routine

concurrency:
  group: alchemy-ci-runners-prod
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  deploy:
    name: Deploy CI runners (prod)
    if: >-
      vars.CI_RUNNERS_DEPLOY_ARMED == 'true' &&
      (vars.CI_RUNNERS_ROUTINE_ARMED == 'true' ||
      (github.event_name == 'workflow_dispatch' && inputs.mode != 'routine'))
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
          # A push carries no inputs, so it plans as routine.
          MODE: ${{ inputs.mode || 'routine' }}
          EXCLUDE: ${{ inputs.mode == 'bootstrap' && 'DefaultSecurityGroup' || '' }}
        shell: bash
        run: |
          set -euo pipefail
          bun plan-check.ts plan --stage prod --expect "$MODE" ${EXCLUDE:+--exclude "$EXCLUDE"} \
            --out "$RUNNER_TEMP/ci-runners-checked-plan.json"

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
          MODE: ${{ inputs.mode || 'routine' }}
          EXCLUDE: ${{ inputs.mode == 'bootstrap' && 'DefaultSecurityGroup' || '' }}
        run: |
          set -euo pipefail
          bun plan-check.ts deploy --stage prod --expect "$MODE" ${EXCLUDE:+--exclude "$EXCLUDE"} \
            --checked "$RUNNER_TEMP/ci-runners-checked-plan.json" \
            | tee "$RUNNER_TEMP/ci-runners-deploy.log"

      # One unsigned request to the webhook: the handler must answer and refuse
      # it with 401. A 403 is Lambda refusing to invoke the function URL, so
      # GitHub could not deliver either: it fails the job. No AWS describe call, so the check adds nothing to the
      # account's EC2 API rate the live scale-up shares.
      # A bootstrap deploy is filtered, so it prints no stack output; the next full deploy checks the webhook.
      - name: Verify the webhook answers and refuses an unsigned event
        if: ${{ inputs.mode != 'bootstrap' }}
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
          [[ "$status" == "401" ]]
```

Open points in the draft for the releasing lane: `plan-check.ts deploy` prints the stack output's webhook URL as one `webhookUrl=<url>` line, which the last step reads (beta.87 has no `alchemy output` command); the unsigned probe passes only on the handler's 401 from `Webhook.program.ts`; a 403 means Lambda refused to invoke the function URL (missing invoke permission), so GitHub could not deliver either, and it fails the job (amended 2026-11-18); the `mode` dispatch input runs cutover step 1a (`bootstrap`: `--exclude DefaultSecurityGroup` on both commands, creates only, no probe) and step 1b (`default-security-group`: exactly that one create); the `paths` filter redeploys the fleet on every library source change, which is intended (the Lambdas are bundled from that source) but means every `@beep/alchemy-github-runners` PR deploys runner code on merge, so those PRs need the same review bar as this package.

Added at the packet gate's GO (2026-11-18), disarmed: the workflow ships in the P5 PR with its job gated on `if: vars.CI_RUNNERS_DEPLOY_ARMED == 'true'`, the pattern `deploy-infra-github.yml` uses, so merging it, a later push and a manual dispatch all skip the job before any step while the variable is unset. The gate sets the variable for cutover step 1, only after the deploy role and environment exist and the orchestrator confirms `BEEP_HEAVY_BURST_MAX=6`; unsetting it disarms again. Its `ci-runner-security` exemption line is added in the same PR.
