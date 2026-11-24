---
title: A nested score is containment below a top-level limitation
date: 2026-11-23
reversal: Count every part-of edge, including one whose parent is the claim root, as nested.
governs:
  - test/evaluation/positive.main.ts#program
  - test/evaluation/inspection.main.ts#program
  - test/evaluation/inspection-tool.main.ts#program
enforcedBy: []
---

A claim scores nested only when a part-of edge sits below a top-level limitation, which is a parent other than the claim number.

Reason: an ordinary root limitation is a part-of edge whose parent is the claim itself, and counting it would mark every decomposed claim nested.

Rejected: treating a root part-of edge as nested.
