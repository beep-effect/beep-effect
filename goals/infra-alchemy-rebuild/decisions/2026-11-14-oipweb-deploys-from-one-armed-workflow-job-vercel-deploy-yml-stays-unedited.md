---
title: "OipWeb deploys from one armed workflow job; vercel-deploy.yml stays unedited"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p4-oip-web"
reversal: "Delete .github/workflows/deploy-oip-web-infra.yml and its ci-runner-security exemption line; unset the OIP_WEB_INFRA_DEPLOY repository variable."
---

`.github/workflows/deploy-oip-web-infra.yml`: push to `main` filtered to the stack, the Vercel provider source and the workflow itself, plus a bare `workflow_dispatch`; one GitHub-hosted job (`timeout-minutes: 30`), environment `oip-web-infra-prod`, concurrency `alchemy-oip-web-infra` (never cancelled). Per stage, `staging` then `prod`: plan teed to a log, `bun apps/oip-web/stack/plan-guard.ts` (refuses replace, delete or orphan of a project, domain, DNS record or bucket and fails closed on a log without a `Plan:` line), deploy, then a curl poll of every hostname against today's responses (200 apex, 308 or 307 redirects). The job runs only while the repository variable `OIP_WEB_INFRA_DEPLOY` is `enabled`, so merging deploys nothing. It needs a stack-scoped OIDC role (`OIP_WEB_DEPLOY_ROLE_ARN`, state bucket plus `oip-law-web-assets-*`) because the state role is state-only. No change to `check.yml`, `heavy.yml`, `setup-monorepo-ci`, runner labels or any pull-request job. Because the projects are adopted in place, `vercel-deploy.yml` keeps its project ids and is not edited.
