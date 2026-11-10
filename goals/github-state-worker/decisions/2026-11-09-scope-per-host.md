---
title: "Scope: one reader per PR per host, no fleet-wide state"
date: 2026-11-09
reversal: "Introduce a fleet-shared snapshot store and single cross-host reader (reopen the exploration at decompose via the github-fleet-sharing gate)."
---

Each host runs one reader per PR. Hosts coordinate only through goal 1's ledger, which reads the free `GET /rate_limit` for true fleet-wide usage. Fleet-wide state and webhook-first were rejected.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.
