---
title: "Open a stack only while main's required checks are green"
date: 2026-11-10
lane: "docs/stack-test-results"
reversal: "Restore the 80% over 14 days health bar as a precondition."
---

Bypass can merge only the lowest layer, so on a red main a stack lands bottom-up with one cascade per layer. The pilot rule replaces the old health gate: open a stack when main's required checks are green, and unstack when that stops being true for a working day. Source: `explorations/stacked-pr-adoption/DECISIONS.md`, `graduate-one-goal`.
