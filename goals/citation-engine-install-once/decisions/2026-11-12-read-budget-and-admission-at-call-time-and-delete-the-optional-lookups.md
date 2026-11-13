---
title: "Read budget and admission at call time and delete the optional lookups"
date: 2026-11-12
lane: "explore/citation-engine-install-and-worker-reuse"
reversal: "Reintroduce captureCitationTextReservation and the nested admission view."
---

`Effect.serviceOption` adds no requirement, so hoisting an install-time lookup would silently disable text accounting or take a second permit. The design review listed eleven budget sites and fourteen admission sites; all change in slice A2 with a lint rule. Source: `explorations/citation-engine-install-and-worker-reuse/research/design-review-2026-11-12.md`, findings 3 and 4.
