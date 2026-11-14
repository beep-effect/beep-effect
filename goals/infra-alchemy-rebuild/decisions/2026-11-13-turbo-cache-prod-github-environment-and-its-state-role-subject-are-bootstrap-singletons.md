---
title: "turbo-cache-prod GitHub environment and its state-role subject are bootstrap singletons"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-turbo-cache"
reversal: "gh api -X DELETE repos/beep-effect/beep-effect/environments/turbo-cache-prod; set the beep-alchemy-state-rw trust policy sub list back to the beep-effect-web-prod and storybook-prod subjects with aws iam update-assume-role-policy."
---

Created 2026-11-13 for `.github/workflows/deploy-turbo-cache.yml`, by hand because `@beep/infra-github` does not exist yet: GitHub environment `turbo-cache-prod` (custom branch policy, `main` only), its variable `ALCHEMY_STATE_ROLE_ARN` (the `beep-effect-web-prod` value), and its secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` piped from `op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN` and `.../CLOUD_CLOUDFLARE_ACCOUNT_ID` without printing them. The trust policy of role `beep-alchemy-state-rw` was read first (two subjects, the storybook lane's edit included) and now lists three: `beep-effect-web-prod`, `storybook-prod`, `turbo-cache-prod`. `TURBO_CACHE_ALERT_EMAIL` is not set (no recipient chosen). `@beep/infra-github` adopts the environment, variable and secrets when it lands (D20).
