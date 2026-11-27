---
title: "Cache encoded viewer states by weak object identity"
date: 2026-11-26
reversal: "Re-encode on every render and profile a streaming transcript before retiring the weak cache."
governs:
  - "src/viewer.tsx#encodedStates"
  - "src/viewer.tsx#encodeOnce"
  - "src/viewer.tsx#EditorViewer"
enforcedBy: []
---

Compute both encoded and decorated strings once per state object and hold them in a WeakMap keyed by that object.
A transcript re-renders for every streamed block; unchanged messages must reuse the same serialization instead of repeatedly serializing all visible history into identical strings.
Weak keys let an unreferenced timeline state release its cache entry without an explicit retention registry.
Rejected: re-encode each mounted message on every render, which repeats whole-history work per streamed frame; a strongly held object cache would retain departed messages.
