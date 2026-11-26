---
title: MarkdownVisitor walks an already-parsed tree and surfaces a too-deep foreign tree as an Error event
date: 2026-11-26
reversal: Make the visitor take source text and parse it as the yaml and toml visitors do, with a fallible stream type, or let a too-deep tree die as a defect.
governs:
  - src/MarkdownVisitor.ts#MarkdownVisitor
  - src/MarkdownVisitor.ts#MarkdownVisitorEvent
  - test/visitor.test.ts#deepForeignTree
enforcedBy: []
---

The visitor follows the sibling contract: the event union is an `S.TaggedUnion` of three tagged structs (the jsonc precedent), and the statics class exposes a single `visit`. It deliberately deviates from yaml and toml, which visit text because their event source is the parse itself: this visitor walks an already-parsed tree, which is what keeps it infallible at the type level.

The depth-guard posture mirrors stringify. A decoded foreign tree deeper than `MAX_NESTING_DEPTH` surfaces deliberately as one terminal `Error` event ending the walk, never a defect, and the same tree fails `stringifyResult` typed; `visitor.test.ts` pins both as the posture link.

Rejected: visiting source text like the yaml and toml visitors, and a defect or a typed stream failure for a too-deep tree.
