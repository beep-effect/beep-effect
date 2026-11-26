---
title: "P6: graph operations drop identity, map, flatMap and the description field"
date: 2026-11-24
lane: "goals/text-knowledge-stack-rebuild-p6-operations"
reversal: "Restore the identity, map and flatMap constructors and the description field in np/src/Graph/GraphOperations/Operation.ts, each taking a TermIri name."
---

Row 4 makes a graph operation an `Operation` over nodes named by its registry
term (design section 2, `GraphOperation` row). The old constructors
`identity()`, `map(f)` and `flatMap(f)` minted the fixed names
`"identity"`, `"map"` and `"flatMap"`, which have no declared term, and
`identity` re-emits a node under a fresh id, the same unlawful identity the
census removed with `TypeClass.identityOperation`. None has a consumer outside
the package's own tests and doc examples, and `transform` and `expand` cover
`map` and `flatMap` once a name is required. They are deleted.

The `description` field leaves `GraphOperation` and its constructors: the
design's field list is `{ operation, category, estimateCost, validate }`, the
term names the step, and the catalog's JSDoc keeps the prose. No reader of
`description` exists in the repository.
