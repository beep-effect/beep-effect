---
title: Octokit takes the raw token string and a silent logger
date: 2026-11-26
reversal: Configure an @octokit/auth-app authStrategy for the App path and let octokit log through its default console logger.
governs:
  - src/internal/octokit.ts#makeOctokit
enforcedBy: []
---

`makeOctokit` passes the unwrapped token as `auth` and a no-op `log`.
Reason: `@octokit/auth-token` emits `bearer` for a three-segment JWT and `token` otherwise, exactly the split between an app JWT and an installation token, so the App path needs no separate auth strategy. The raw string reaches octokit only; errors, spans and logs this package builds never carry it.
Retries log through `Effect.logDebug`, and an application maps Effect's logs to its own runtime, so no GitHub Actions knowledge lives in this client.
Rejected: an `@octokit/auth-app` auth strategy; octokit's console logging.
