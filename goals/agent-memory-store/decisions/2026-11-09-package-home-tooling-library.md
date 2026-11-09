---
title: "Package home: tooling/library/agent-memory-store as @beep/agent-memory-store"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Move the package with a new routing decision file once a second named consumer outside repo operations exists; create-package --family foundation --kind capability is the only alternative home that passes the negative gate"
---

Specific-home-first (standards/architecture/07, routing step 3): the store is repo operations and automation for operator agent memory, with no product semantics and no external engine of its own, so it routes to tooling before foundation/capability (step 5, which also needs two named importers and has none). Created only through bun run beep create-package agent-memory-store --family tooling --kind library. The memory command group is @beep/repo-cli/commands/Memory importing the library, because goals/beep-cli-composition is still active and repo-cli remains the composition root (DECISIONS 2026-10-28). Rejected: foundation/capability (fails the negative gate today), and a domain/store split before any consumer exists (SPEC Non-Goals exclude product memory).
