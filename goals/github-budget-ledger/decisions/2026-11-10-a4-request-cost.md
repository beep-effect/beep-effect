---
title: "A4 Per-request cost: nominal cost plus telescoped fleet usage"
date: 2026-11-10
reversal: "Record `rateLimit{cost}` per GraphQL document (goal 2)."
---

Rows store the raw headers plus `nominalCost`: REST 1; 304, `/rate_limit` and primary `rate-limited` 0; GraphQL a floor of 1. Hourly fleet usage telescopes per reset epoch. Per-command points use a min-positive same-pid delta-used estimator per GraphQL operation, with at least three candidates. A `gh` spawn costs 1, bounded by the residual.

Resolves SPEC ambiguity A4 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
