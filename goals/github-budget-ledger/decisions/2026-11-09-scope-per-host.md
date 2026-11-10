---
title: "Scope: per-host ledger, fleet view only via the free /rate_limit"
date: 2026-11-09
reversal: "Introduce a fleet-shared ledger store through the gated github-fleet-sharing candidate and supersede this decision."
---

The ledger is host-scoped. Hosts coordinate only through the free `GET /rate_limit`, which reports the true fleet-wide usage of the shared user bucket; no cross-host state is built. Source: exploration `explorations/github-api-quota/DECISIONS.md`, "scope: per host first".
