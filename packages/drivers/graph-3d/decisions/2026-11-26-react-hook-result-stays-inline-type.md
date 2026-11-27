---
title: useGraph3DHandle returns an inline structural type, not an exported schema
date: 2026-11-26
reversal: Replace the inline return type of useGraph3DHandle in src/Graph3D.react.ts with an exported schema-backed result type.
governs:
  - src/Graph3D.react.ts#useGraph3DHandle
enforcedBy: []
---

`useGraph3DHandle` declares its result `{ containerRef, error, handle }` inline instead of exporting a schema for it.
Reason: a live DOM ref and an imperative render handle are runtime capabilities that are never encoded, decoded or validated, so a schema would describe no data.
Rejected: an exported schema-first result model, which could only wrap the ref and the handle in `S.Any`-style declarations without checking anything.
