---
title: "Package homes: header capture in drivers/github, ledger and parcel in tooling"
date: 2026-11-09
reversal: "Move the ledger module into drivers/github (or a new package via create-package) and record a superseding decision."
---

Header capture and rate-limit handling extend `packages/drivers/github` (`internal/octokit.ts` `transport.rateLimit`, `Resilience.ts`); the ledger, `/rate_limit` sampler and `gh` attribution live in `packages/tooling/tool/cli`; the `github-headroom` parcel lives in `packages/tooling/library/palantiri` and the CLI Palantiri commands. Source: exploration `explorations/github-api-quota/DECISIONS.md`, "package homes".
