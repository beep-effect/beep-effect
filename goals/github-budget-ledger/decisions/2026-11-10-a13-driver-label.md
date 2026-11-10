---
title: "A13 The driver takes an opaque budgetLabel and a technical credential"
date: 2026-11-10
reversal: "Move label resolution into the driver."
---

The driver learns the identity only through an opaque `budgetLabel` option (the Prow budget-id pattern) and a technical `credential` (`token`, `app-jwt` or `unauthenticated`). The driver never composes a label; the CLI derives `/jwt` and `anonymous` from `credential`.

Resolves SPEC ambiguity A13 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
