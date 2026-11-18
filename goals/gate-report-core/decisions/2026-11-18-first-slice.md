---
title: "Test and check prove the contract first, through one renderer"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Ship the test gate alone in the first slice and move check to P4"
---

The first vertical slice is P1 through P3: the model, the agent projection, and `test` plus `check` for one package printing the contract end to end. Vitest reaches the model through the ported report builder, the type checker through the diagnostic pattern moved out of IssueParser.ts, and both render through the same dispatch table. One test-shaped and one diagnostic-shaped gate through one renderer is the proof that the model is gate-neutral. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `first-slice`.
