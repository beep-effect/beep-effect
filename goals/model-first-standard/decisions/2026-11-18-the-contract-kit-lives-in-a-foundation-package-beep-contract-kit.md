---
title: "The contract kit lives in a foundation package, @beep/contract-kit"
date: 2026-11-18
lane: "claude/model-first-standard-scaffolder"
reversal: "Move Catalog into the shared kernel package or inline it in each contract, and delete @beep/contract-kit"
---

Catalog.make and waitsOnProjection (ported from scratchpad/model-first-slices/shared/contract-kit) go into a new packages/foundation/modeling/contract-kit created with bun run beep create-package. The kit is product-neutral substrate over @alchemy.run/domain, so it is foundation, not the shared kernel, which the doctrine keeps to language. It is deleted when upstream splits the Api from the model (explorations/model-first-slices/DECISIONS.md D9). Design: research/01-scaffolder-design.md.
