---
title: sourceMultiline is stamped by one post-pass over the composed document
date: 2026-11-25
reversal: Compute sourceMultiline at every node construction site in the block, flow and scalar composers and delete the decoration pass.
governs:
  - src/internal/composer/document.ts#decorateSourceMultiline
  - src/internal/composer/document.ts#decorateDocumentSourceMultiline
enforcedBy: []
---

After a document is composed, `decorateSourceMultiline` walks the AST and stamps `sourceMultiline: true` on every scalar, mapping and sequence whose source span contains a line break. A single-line scalar is returned unchanged, and a document whose decorated contents are identical is returned without a copy.

Rejected: threading the flag through the dozens of construction sites in the composers, where every new site would have to remember it.
