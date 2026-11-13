---
title: "infra-github manages no secret on day one; secret delivery waits for a ruling"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-github"
reversal: "Declare GitHub.Secret resources for the secrets with a value source once a delivery route is ruled."
---

`GitHub.Secret` re-uploads its value on every deploy, so a secret is managed only when the deploy can read its value. On day one the stack manages no secret. With a 1Password source: `KNOWLEDGE_MINT_APP_PRIVATE_KEY` (item `beep-knowledge-mint GitHub App`, field `private_key`); `VERCEL_TOKEN` has two candidate fields (`CLOUD_VERCEL_TOKEN`, `CLOUD_VERCEL_API_TOKEN`) and no record of which one it holds. No known source: `APP_ENV`, `APP_LOG_FORMAT`, `APP_LOG_LEVEL`, `APP_NAME`, `NEXT_PUBLIC_ENV`. Produced by another stack and not duplicated: the repository `TURBO_R2_READ_ACCESS_KEY_ID`, `TURBO_R2_READ_SECRET_ACCESS_KEY`, `TURBO_READ_TOKEN`, `TURBO_TEAM` and the `turbo-cache-write` environment's `TURBO_R2_WRITE_ACCESS_KEY_ID`, `TURBO_R2_WRITE_SECRET_ACCESS_KEY`, `TURBO_TOKEN` (turbo cache), and `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` on `beep-effect-web-prod`, `storybook-prod` and `turbo-cache-prod` (each app stack's deploy credentials). A CI deploy cannot read a 1Password value without putting a new long-lived credential into the workflow; the smallest option is a 1Password service-account token, scoped to a vault holding only these items, as an `infra-github-prod` environment secret read by `op run` in the deploy step. That needs an operator ruling and is not built.
