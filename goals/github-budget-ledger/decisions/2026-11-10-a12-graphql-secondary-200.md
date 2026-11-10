---
title: "A12 GraphQL secondary limits served as 200 are recorded, not reclassified"
date: 2026-11-10
reversal: "Reclassify it as `rateLimited` in `GraphQL.ts`."
---

A GraphQL secondary rate limit served with status 200 is recorded with outcome `secondary-limited`. The driver's retry classification is unchanged in goal 1; goal 2's rate-limit handling owns it.

Resolves SPEC ambiguity A12 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
