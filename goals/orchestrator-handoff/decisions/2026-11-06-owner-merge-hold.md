---
title: "yeet merge-gate holds an owner-merge-hold PR"
date: 2026-11-06
lane: "feat/orchestrator-handoff-p2"
reversal: "Drop the owner-hold step from structuralHold and the HOLD column from the gate table."
---

The repository's GitHub labels include `owner-merge-hold`, which an owner puts on a PR it merges itself (2026-11-06: #2797, titled OWNER HOLD), but nothing in the CLI read it: `yeet merge-gate` would have merged it at the gate. The gate now holds such a PR as `owner-hold` (a structural hold, after draft and before conflicting, in strict and relaxed mode), and `yeet gate-table` names it in a `HOLD:` column and never offers it as GATE-MET. Found by the P3 take-over drill.
