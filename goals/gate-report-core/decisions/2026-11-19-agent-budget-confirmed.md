---
title: "The agent budget stays 8,000 characters, 240 per line, 12 diff lines"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Change the default ConsoleBudget the library supplies."
---

Re-read against the harness limits in the exploration research (section 5 of the external landscape): Claude Code keeps about 10,000 characters of a failing command inline and Codex cuts the middle of a larger budget, so the smallest window is about 10,000 characters and 2,000 are left for what prints outside the renderer. The numbers are the default of a budget parameter, not constants in the model.
