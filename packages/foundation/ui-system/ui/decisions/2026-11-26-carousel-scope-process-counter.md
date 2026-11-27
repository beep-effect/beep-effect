---
title: Carousel atom-family scopes come from a process-unique counter, not React.useId
date: 2026-11-26
reversal: Replace nextCarouselScope and the scopeRef allocation in Carousel with React.useId().
governs:
  - src/components/carousel.tsx#carouselScopeCounter
  - src/components/carousel.tsx#nextCarouselScope
  - src/components/carousel.tsx#Carousel
enforcedBy: []
---

Each mounted Carousel takes its scope from a module-level monotonic counter, allocated once per instance through a ref, and keys its module-scoped `Atom.family` entries by it. The scope is unique across every React root that shares this module.
The key is never serialized for hydration, because the atoms hold client-only Embla state, so it needs per-instance stability and uniqueness but no server/client agreement.
Rejected: `React.useId()`, which is unique only within one React root (the default `identifierPrefix`); two independent roots can collide on their first carousel and alias each other's atom state.
