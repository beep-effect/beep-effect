---
title: "deploy-infra-github.yml ships disarmed behind INFRA_GITHUB_DEPLOY_ARMED"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-github"
reversal: "Delete .github/workflows/deploy-infra-github.yml and its exemption line in ci-runner-security.test.ts."
---

`.github/workflows/deploy-infra-github.yml`: push to `main` filtered to `packages/tooling/infra/github/**` and the workflow file, plus a bare `workflow_dispatch`; one GitHub-hosted job `Deploy infra-github (prod)` on `ubuntu-24.04`, `timeout-minutes: 20`, environment `infra-github-prod`, concurrency group `alchemy-infra-github-prod` without cancellation, the OIDC state role for AWS. Steps: package tests (no token), App token mint, plan, deploy, then a ruleset check that polls for up to 120 seconds until ruleset 10240248 is `active` and lists `beep-reviewer` exactly when the committed switch says `required`. The job is disarmed: it runs only while the repository variable `INFRA_GITHUB_DEPLOY_ARMED` is `true`, so merging this package changes nothing live and creates no environment. Arming is the reviewed live-adoption step: mint the App, create `infra-github-prod` (branch policy `main`) with `INFRA_GITHUB_APP_ID`, `INFRA_GITHUB_APP_PRIVATE_KEY` and `ALCHEMY_STATE_ROLE_ARN`, add `repo:beep-effect/beep-effect:environment:infra-github-prod` to the `beep-alchemy-state-rw` trust policy, then set the variable. No change to `check.yml`, `heavy.yml`, `setup-monorepo-ci`, runner labels or any pull-request job; the job is in the explicit exemption list of `ci-runner-security.test.ts`.
