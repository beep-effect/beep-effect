---
title: The fps sampler keeps its counters as mutable closure state
date: 2026-11-26
reversal: Move the counters in makeFpsSampler (src/Cosmos.renderer.ts) into Effect Ref values when the sampler becomes an Effect-owned scoped resource.
governs:
  - src/Cosmos.renderer.ts#makeFpsSampler
enforcedBy: []
---

`makeFpsSampler` holds `active`, `currentFps`, `frames`, `lastTime` and `frameId` as `let` bindings mutated by its requestAnimationFrame callback.
Reason: the counters are callback state of a plain browser frame loop that no Effect fiber owns; the handle reads them synchronously through `fps()`.
Rejected: Effect `Ref` counters, which would need an Effect runtime inside every animation frame while the sampler is not a scoped resource.
