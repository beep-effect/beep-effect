---
title: "Cache tokens reach GitHub by stdin handoff under new names, not GitHub.Secret in this stack"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-turbo-cache"
reversal: "Add GitHub.Secret resources for TURBO_CACHE_WRITE_TOKEN and TURBO_CACHE_READ_TOKEN to alchemy.run.ts and a repository-admin GITHUB_TOKEN secret to turbo-cache-prod."
---

`GitHub.Secret` in this stack would need a credential that can write repository and environment secrets inside the `turbo-cache-prod` deploy job; the Actions `GITHUB_TOKEN` cannot, so it would mean a new long-lived admin token or an App installation (App minting is out of scope, D10). Instead tokens stay in state only (never a stack output) and `token.ts` pipes one to a receiver's stdin: `gh secret set TURBO_CACHE_WRITE_TOKEN --env turbo-cache-write` for `ci-main`, `gh secret set TURBO_CACHE_READ_TOKEN` (repository) for `ci-pr`, the workstation's 1Password item for the trusted writers. The live `TURBO_API`, `TURBO_TEAM`, `TURBO_TOKEN` and `TURBO_READ_TOKEN` are untouched: the new names stand beside them until stage 2 flips `setup-monorepo-ci`. `@beep/infra-github` reconciles these secrets when it lands, reading the tokens with `Output.stackRef`-style state reads rather than a second distribution path.
