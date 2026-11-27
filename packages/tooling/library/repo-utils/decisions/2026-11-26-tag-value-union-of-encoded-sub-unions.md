---
title: TagValue is a union of per-category sub-unions of encoded tag classes
date: 2026-11-26
reversal: Build TagValue as one S.Union of the 113 tag-value classes and apply S.toTaggedUnion to it directly.
governs:
  - src/JSDoc/models/tag-values/index.ts#TagValue
enforcedBy: []
---

S.toTaggedUnion requires Objects ASTs, not Declarations, so each TaggedClass enters the union through S.toEncoded, which unwraps its Declaration and leaves the _tag literal visible. The 113 members are grouped into one sub-union per tag category, which keeps the total Flatten depth within TypeScript's recursion limit.
Rejected: one flat union of the classes themselves, which toTaggedUnion refuses and whose 113-member Flatten exceeds TypeScript's recursion limit.
