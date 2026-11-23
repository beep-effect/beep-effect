---
title: "P1 term stability runs uncached over git state"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p1c-bindings"
reversal: "Add certified git base inputs to the cache key before admitting the term stability gate to a cached scoped graph."
---

The identity registry gate compares the published term snapshot against the merge base with origin/main. Turbo inputs do not hash that git state, so the gate runs uncached and unscoped under law L0-3. Rejected: caching the gate by source files alone, which could replay a verdict against a different published base.
