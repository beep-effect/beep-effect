---
title: "Tracked PR set: local owners, plus every open PR on the hub"
date: 2026-11-09
reversal: "Set the per-host allOpen flag off on the hub (or on everywhere) in the worker config."
---

Each host reads PRs with a local owner in `PrSessionRegistry` or a live consumer request. The orchestrator host also reads every open PR in the repository for gate-table, merge-gate and the watchers. The all-open flag is per-host configuration. All-open everywhere would cost about 6x.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.
