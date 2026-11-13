---
title: "Op capture derives base node kinds from the partition of the base text"
date: 2026-11-12
lane: "agent-memory-store-p2"
reversal: "Add kind to BaseNode and read it in capture by decision file once a producer other than the projector exports bases"
---

BaseNode carries a node id, a revision and an occurrence anchor whose quote is the node's exact text, but no kind, and the exported base is built by the MarkdownProjector layer, so adding a kind field would change a P1 contract and its producer. Capture needs base kinds only to tell a kept node from a same-text node of another kind and to refuse a replace that would change a node's kind. It derives them: the concatenated quotes of a base file are partitioned, and when that partition cuts exactly the base nodes (same count, same texts) each base node takes the kind of its partition node. When it does not (a log state whose node boundaries differ from a fresh parse, such as a P1 insert without its separator), the file's base kinds are unknown: kept nodes then match by text alone and no changed pair becomes a replace, so every changed node is a delete plus an insert. Operation.models.ts is unchanged. Code: packages/tooling/library/agent-memory-store/src/internal/OperationCapture.align.ts; tests: the misaligned-base case in packages/tooling/library/agent-memory-store/test/OperationCapture.test.ts. Rejected: adding kind to BaseNode in this lane (a contract change for a case the derivation already covers) and refusing a misaligned base (the log can hold one, and capture can still express any edit of it exactly).
