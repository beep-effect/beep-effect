---
title: The reference census flattens its accumulators once
date: 2026-11-27
reversal: Accumulate fence lines, line candidates, document chunks and observations with per-item A.append or A.appendAll.
governs:
  - src/commands/Knowledge/Knowledge.refs.ts#knowledgeDocumentFenceLines
  - src/commands/Knowledge/Knowledge.refs.ts#extractDocumentRefs
  - src/commands/Knowledge/Knowledge.refs.ts#scanKnowledgeRefsTree
enforcedBy: []
---

The census builds each collection in one allocation: fence lines through one `A.map` with the fence
state threaded through the closure, a document's candidates through one `A.flatMap`, the corpus as
per-document chunks flattened once, and the observations through one sequential `Effect.forEach`.
Rejected: per-item `A.append` or `A.appendAll`, which re-copies the whole accumulator on every item
and makes the scan quadratic; at corpus scale (about 18k candidates) it dominated the census runtime.
