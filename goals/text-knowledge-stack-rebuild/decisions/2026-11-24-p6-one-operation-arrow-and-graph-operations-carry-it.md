---
title: "P6: one Operation arrow at fixed channels; GraphOperation carries an Operation and TypeClass.ts is deleted"
date: 2026-11-24
lane: "p6"
reversal: "Restore np/src/Graph/TypeClass.ts and its test, restore GraphOperation's own execute field and ExecutionMetrics.combine, and drop np/src/Operation.ts"
---

Four operation models exist (research/2026-11-24-p6-map-operations.md section 4): the nlp OperationBuilder (0 consumers), np TextOperation in Graph/TypeClass.ts (0 consumers, and identityOperation mints a fresh node id at TypeClass.ts:174-181, so it is not an identity), np GraphOperation (live through the catalog and one wink test) and the design sketch. P6 keeps the sketch's shape: Operation = { name: TermIri, run: (a) => Effect<B, E, R> } with pure, compose (dual 3, one fixed E and R, explicit name), map, sequential product and traverse with concurrency 1. Fixing E and R is what makes compose(pure(identity), f) the same type as f. A GraphOperation becomes { operation: Operation<GraphNode<A>, ReadonlyArray<GraphNode<B>>, E, R>, category, estimateCost, validate }, so the executor, result store and catalog stay and run the one arrow. ExecutionMetrics.combine (Types.ts:160-187) is deleted because no src code calls it; ExecutionMetrics.empty stays. Input and output schemas leave the arrow; a tool attaches them in its own Tool.make. Answers O6 and F3.

Amended after independent review. A `GraphOperation` is named by its `operation:` term and `GraphOperation.name` is removed (decision `2026-11-24-p6-graph-catalog-steps-declare-operation-terms`); `compose`, `map`, `product` and `traverse` suspend their components, and `Pure` is branded (decision `2026-11-24-p6-pure-is-branded-and-commute-is-the-production-interchange`).
