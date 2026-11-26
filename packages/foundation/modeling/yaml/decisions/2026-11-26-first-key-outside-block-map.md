---
title: A block mapping's first key is the sibling before its CST node, and the visitor reads roles from indicators
date: 2026-11-26
reversal: Re-parent the scalar before each block-map node into that node in the CST parser, and walk block-map children with plain key/value alternation from an expected key.
governs:
  - src/internal/cst-visitor.ts#walkSiblings
  - src/internal/cst-visitor.ts#walkSibling
  - src/internal/cst-visitor.ts#applyBlockMapIndicator
  - src/internal/cst-visitor.ts#blockMapScalarEvent
  - src/internal/cst-visitor.ts#findMapContent
  - src/internal/cst-visitor.ts#walkBlockMapChildren
  - src/internal/cst-visitor.ts#applyFlowMapIndicator
  - src/internal/cst-visitor.ts#walkFlowMapChildren
enforcedBy: []
---

The block-map node opens at its first `:`, so for `name: John` the document children are `flow-scalar("name")` and `block-map(": John")`, whose children start with the `:` leaf. The visitor (`walkSiblings`, document level and sequence entries) emits a scalar as a key when the next content sibling is a block map; one node of look-ahead suffices because the block map always follows its key with no content between. Every other sibling is a leaf event or a collection. Inside a block map a leading `:` means the key was that sibling; a compact mapping in a sequence (`- a: 1`) holds its first key, so its walk starts by expecting one. Flow maps hold their keys too, which is why the sibling pattern applies to block maps only. Flow lexing yields no directive or document children, so a flow map's remaining children are collections or aliases.

Roles come from indicators, not alternation, so an omitted value never shifts later events: a `?`, or in flow a `,`, opens a key; a `:` closes it and owes an empty key event when the key had no content; a `:` after an entry boundary with no key expected opens a new key first; and a scalar followed on its line by a `:` is the next entry's key even when the previous entry had no value. A scalar or collection can absorb the newline ending an entry, so the boundary checks also read the preceding child's source.

Rejected: re-parenting the first key into the block-map node, which needs the parser to rewrite an already-built sibling list; strict key/value alternation, which shifts every role after an omitted value (`a:\nb: 2`).
