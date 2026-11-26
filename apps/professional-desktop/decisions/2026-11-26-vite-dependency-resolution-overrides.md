---
title: Vite dependency optimizer and resolver overrides
date: 2026-11-26
reversal: Drop the optimizeDeps lists and the decode-named-character-reference alias and let Vite discover and prebundle defaults.
governs:
  - vite.config.ts#optimizeDeps
  - vite.config.ts#domFreeDecodeNamedCharacterReference
enforcedBy: []
---

`@cosmos.gl/graph` stays un-prebundled and `seedrandom` is interop-wrapped, because cosmos imports CJS/UMD dependencies. Since 3.4.2 it imports gl-bench's ESM build by deep path, so no gl-bench alias is needed. `oxigraph` is a WASM sidecar driver the web optimizer must not initialize. `effect/schema` and `effect/Schema` prebundle to entry names that differ only by case, so rolldown dedupes one and the optimizer loses it; the barrel stays unbundled.

`three` is reached only through `@beep/graph-3d`'s lazy import on the first 3D toggle, so it is included up front; discovered mid-session, Vite re-optimizes and the stale hashed chunk URL 404s.

`decode-named-character-reference` resolves to its default build: the `browser` build calls `document.createElement` at module top level, a ReferenceError in a module worker, which Vite resolves with browser conditions.

Rejected: a bare gl-bench alias, which Vite prefix-rewrites into a doubled, nonexistent path.

Rejected: optimizer defaults, which break each case above at dev time.
