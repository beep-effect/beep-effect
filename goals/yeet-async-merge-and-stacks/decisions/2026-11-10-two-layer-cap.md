---
title: "Stacks have two layers; every layer is an ordinary PR for CI"
date: 2026-11-10
lane: "docs/stack-test-results"
reversal: "Raise the cap, or gate Heavy on the lowest unmerged layer, after the pilot."
---

Each layer carries the label, runs the full matrix and re-runs after a cascade. Landing n layers bottom-up costs n(n+1)/2 runs, so routine stacks stop at two. Heavy gating by stack position stays deferred and needs a workflow change this goal does not make. Source: `explorations/stacked-pr-adoption/DECISIONS.md`, `stack-layer-heavy`.
