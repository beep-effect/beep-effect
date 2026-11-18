---
title: "Port the core into a gate-neutral model, not the whole project"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Reopen the exploration and widen the port inventory in SPEC.md"
---

The model (gate, unit, item) is designed first. The pure pieces are then ported into it: the shape-by-outcome dispatch table and its cells, the honest-count rules and the failure signature. The history classifier goes to goals/gate-run-history and the GitHub summary to goals/ci-gate-reports. Vitest is one adapter beside the type checker. Design order follows the repo law: schema, then service contract, then implementation. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `port-breadth`.
