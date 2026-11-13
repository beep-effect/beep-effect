---
title: "An operation that depends on an insert of its batch that did not land is held with insertAfterMissingNode"
date: 2026-11-12
lane: "agent-memory-store-p2"
reversal: "Reject such operations with unknownNode instead, by decision file, if the adversarial replay shows held dependents only add resolver work"
---

Admission judges a batch in order and keeps the ids of the batch's inserts that did not land (held or rejected; P2 has no deferral, which arrives with exact-hash dedupe in P3). An insert placed after one of them is held with insertAfterMissingNode on path afterNodeId, as decision file-is-an-ordered-node-partition requires. A replace, delete or status move naming one of them is held with the same code on path nodeId, rather than rejected as an unknown node, so the write waits for its insert's resolver instead of being lost; resolving it with theirs before its node exists returns rejected with unknownNode and keeps it open. An operation on a node the batch inserted and that landed is judged like any other, against the revision its capture step computed. Code: packages/tooling/library/agent-memory-store/src/Admission.layer.ts; test: the batch dependency case in test/Admission.layer.test.ts. Rejected: a dedicated dependency code (it needs another literal for a case the replay has not yet measured).
