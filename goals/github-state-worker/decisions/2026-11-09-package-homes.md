---
title: "Package homes: ETag layer in drivers/github, worker and readers in repo-cli"
date: 2026-11-09
reversal: "Move the conditional-fetch layer into packages/tooling/tool/cli/src/internal/github and drop it from @beep/github."
---

The conditional-request (ETag) layer and rate-limit handling go in `packages/drivers/github` beside `Resilience.ts` and `internal/octokit.ts`, exposed through `TransportOptions.fetch`. The per-host worker, PR snapshot and Yeet readers go in `packages/tooling/tool/cli`; parcels in `packages/tooling/library/palantiri`. Rationale: driver-boundary standard lists transport helpers as driver concerns; automation routes to tooling.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.
