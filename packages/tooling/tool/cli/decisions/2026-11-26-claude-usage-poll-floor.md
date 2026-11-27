---
title: A Claude account's usage is read at most once per five minutes, across every reader
date: 2026-11-26
reversal: Make pollFloorOf in src/commands/Accounts/AccountsUsage.service.ts return O.none() for every provider, so each poll asks Anthropic again.
governs:
  - src/commands/Accounts/AccountsUsage.service.ts#CLAUDE_POLL_FLOOR
enforcedBy: []
---

`loadAccountsReport` reuses a Claude row that was polled, or a collector snapshot that was captured, within the last five minutes. That covers every outcome, a rate-limit failure included. The accounts screen and `accounts status` start from the staged Palantiri headroom snapshot, so the floor holds across processes, not just within one screen.
Reason: Anthropic's `/api/oauth/usage` rate-limits each account (HTTP 429, `rate_limit_error`, `retry-after: 0`), and every Claude Code session signed in to that account reads the same endpoint. On 2026-11-26 the 60-second screen poll left all four Claude accounts on 429 ("Rate limited. Please try again later."), while a single read a minute apart answered 200.
Rejected: honouring `retry-after`, because it is always 0; a per-process back-off, because the screen, `accounts status` and Palantiri each start fresh and would still hit the endpoint together.
