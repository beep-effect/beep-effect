---
title: "Reserve applies per identity: the App bucket gets its own sampler and signal"
date: 2026-11-09
reversal: "Point the worker back at the user identity's reserve signal and remove the App identity from the ledger's configured identities."
---

Answer: the 15% background reserve applies per identity x resource. When 3b configures the beep-fleet-orchestrator App installation as a ledger identity, github-budget-ledger's per-identity sampler reads the App's `/rate_limit` and publishes a separate reserve signal for it; the worker backs off on the App signal, not the user one, and readers that fall back to direct reads on the user token keep obeying the user signal. The exploration decided the 15% threshold for the shared user bucket only; extending it per identity keeps the App bucket (shared with the orchestrator's own App use) from being driven to 0 and keeps one bucket's state from throttling the other. Source: exploration `explorations/github-api-quota/DECISIONS.md`, entries 'reserve: 15% of the shared bucket' and 'identity'.
