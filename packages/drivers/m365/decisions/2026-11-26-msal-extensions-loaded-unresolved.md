---
title: The optional MSAL extensions peer is imported through a non-literal specifier with a local type mirror
date: 2026-11-26
reversal: Import "@azure/msal-node-extensions" by literal specifier and add it as a dependency or an ambient module declaration in src/M365.auth.ts.
governs:
  - src/M365.auth.ts#MSAL_NODE_EXTENSIONS_SPECIFIER
  - src/M365.auth.ts#MsalNodeExtensions
enforcedBy: []
---

`@azure/msal-node-extensions` is an optional peer: hosts that set `tokenCachePath` install it, this workspace does not. It is loaded with a dynamic import of a non-literal specifier so TypeScript never resolves the module, and `MsalNodeExtensions` mirrors the upstream 5.5.0 `types/persistence/*.d.ts` for exactly the members the driver uses.
Reason: a literal import fails typechecking where the peer is absent, and an ambient module declaration would shadow the real package types in any program that includes the package.
Rejected: an ambient `declare module` for the peer, and a hard dependency on it.
Accepted limit: the mirror must be updated by hand when the driver uses more of the upstream surface.
