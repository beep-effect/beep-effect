---
title: "A6 GraphqlBudget trusts only fresh transport-basis readings"
date: 2026-11-10
reversal: "Allow sample-basis readings."
---

`GraphqlBudget` may skip its probe only on a transport-basis (GraphQL header) reading at most 60 s old whose reset is still ahead, from memory or `latest/transport-*.json`. It never trusts samples.

Resolves SPEC ambiguity A6 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
