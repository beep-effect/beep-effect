---
title: "P3: the nlp Graph span becomes an optional Position resolved uniquely; the node schemas move with Core in P6"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Adapt the Graph node schemas into annotation kinds in P3 by a decision file with re-measured census sums"
---

Census disposition change for Graph `Schema` (147 lines in 10 files, 138 of them in `@beep/nlp-processing`), from "adapt into `@beep/annotation` kinds in P3" to "moves with Core to `@beep/nlp-processing` in P6". The node types (text, POS, lemma, dependency, entity, relation) are an NLP engine's linguistic graph for which L2 has no kinds. The PLAN row asks only for the span, and P6 already moves Core and absorbs nlp-processing's graph layer.

P3 deletes the float `Span`. `EntityNode.span` and `RelationParticipant.span` become `S.OptionFromOptionalKey(Position)` from `@beep/text` (`start < end`, `utf16-code-unit`), and `@beep/nlp` gains `@beep/text`. The wink backend fills the span with `resolve` of a quote selector over the text: `Unique` gives the position, and `Ambiguous` or `NotFound` give none. Today it returns the first match, or the fabricated `{ start: 0, end: length }` when the value is absent, which is the L1-5 bug. semantica's pattern lane keeps its `fabricated-span` degradation for a missing span.
