---
title: "Gates only: the rollout wraps no command the repo does not own"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Widen the rollout to a general command wrapper in a new exploration"
---

Operator ruling in `explorations/agent-verification-output/DECISIONS.md`, entry `scope-gates-only`: the packet covers verification gates (test, check, lint, build, docgen, quality, Yeet and CI logs) under one verdict contract. This goal therefore puts every gate the repo owns on the gate report and wraps nothing else. Output of commands an agent chooses for itself (`rg`, `cat`, `git`) stays out; it is deferred to its own exploration (entry `search-read-output`). A tool appears here only as the engine of a repo gate, and its adapter reads its machine format.
