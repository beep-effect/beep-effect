---
title: Value extraction dispatches on the node _tag, not on schema guards
date: 2026-11-25
reversal: Replace the _tag comparisons in walkTypedNode, pairKeyRegisteringAnchor and registerLiveAnchor with the module's S.is guards (isScalar, isMap, isSeq, plus one for YamlAlias).
governs:
  - src/YamlNode.ts#walkTypedNode
  - src/YamlNode.ts#pairKeyRegisteringAnchor
  - src/YamlNode.ts#registerLiveAnchor
enforcedBy: []
---

The value walk receives nodes that are already typed AST nodes, so it branches on `node._tag` directly instead of the derived `S.is` guards the rest of the module uses.

Reason: the walk runs once per materialized node, including every node an alias expansion produces under the budget guard. Revalidating the recursive node schemas on each of those visits makes the budget guard itself expensive, badly so under coverage instrumentation.

Rejected: the repo-default `S.is(YamlScalar)`-style guards, which stay green but turn the alias-budget tests slow.
