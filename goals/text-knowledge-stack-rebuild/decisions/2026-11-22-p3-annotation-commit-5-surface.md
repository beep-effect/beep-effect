---
title: "P3: merge and restrict return the caller's document type, conflicts take the least and greatest time, contains is dual"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Re-validate the outputs through the schema, refuse more than two times, and drop the data-last contains form, by a decision file"
---

Four surface calls the design did not settle, taken while writing commit 5.

- `merge` and `restrict` take any document type over `AnnotationDocumentView` and return that type, rebuilt from the input with its tables replaced; neither re-runs the schema. Both preserve every pure check by construction (the union of content-keyed tables of one capture, refused when a pair would carry two times; the kept annotations of a set closed under references, with the anchors and attribution they use), and `L2-4` proves the outputs pass the schema and the checked codec.
- A `GenerationTimeConflict` takes the least and the greatest time of its (content, activity) group under `Option.makeOrder(DateTime.Order)`, `None` first. Two documents that each pass their checks give at most two times per pair, so the group is the two sides.
- `contains(kinds)` is dual: `(document, outer, inner)` and `(outer, inner)(document)`, as the design module had it.
- `restrictToOa` throws when its restriction or its `OaDocument` decode fails, which the design calls a defect; it stays a pure function with the signature of section 1.6, through `Result.getOrThrow`.

`closure` and `restrict` take any `KindRegistry`, and the kept set is `HashSet<KindName<Kinds>>`, so an unregistered name is a type error. The test generator of commit 4 now prefixes each activity seed with its index, so two equal drawn labels still name two activities and a generated document never holds two generations of one pair.
