---
title: Practice KG tool rows widen the domain kind kits locally with their synthetic bundle members
date: 2026-11-26
reversal: Add "bundle" to KgNodeKind and "bundle-manifest" to PracticeKgProvenanceKind in the domain and drop the local unions in PracticeKg.tools.ts.
governs:
  - src/PracticeKg.tools.ts#PracticeKgToolNodeKind
  - src/PracticeKg.tools.ts#PracticeKgToolProvenanceKind
enforcedBy: []
---

Tool rows admit the persisted domain literals plus the synthetic members the bundle-status row uses when `kg_provenance` is called without an identity: node kind `bundle` and provenance kind `bundle-manifest`.
Reason: `bundle` is not a `kg_node` kind and `bundle-manifest` is not a stored provenance kind, so the domain kits stay closed over what is persisted.
Rejected: adding the synthetic members to the domain kits, which would let stored rows claim kinds that never exist in the bundle.
