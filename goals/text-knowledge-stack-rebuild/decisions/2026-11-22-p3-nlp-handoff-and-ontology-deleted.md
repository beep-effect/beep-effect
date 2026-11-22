---
title: "P3: the nlp Handoff and Ontology subpaths are deleted; UnitInterval consumers import @beep/schema/UnitInterval"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Restore the Ontology subpath from history by a decision file; the Handoff contract has no consumer to restore it for"
---

The census b dispositions for the Handoff contract are executed: `AnnotatedDocument`, `Mention` and `TextChunk` are replaced by the annotation document and its kinds, and `Span`, `Provenance`, `Entity` and `Relation` are deleted, so `packages/foundation/modeling/nlp/src/Handoff`, its test and the `./Handoff` exports go. The `UnitInterval` re-export's consumers (8 files, covered) import `@beep/schema/UnitInterval`.

Ontology `Kind` (0 consumers) was to fold into the kind registry. The structure kinds' containment levels replace its poset, and its `Document`, `Token` and `Character` kinds have no annotation kind and no consumer, so it is deleted rather than ported. Semantic-loss row: those three kinds. The sums are re-measured in the census at the P3 base.
