---
title: "P2: rdf Evidence.ts and its codecs are deleted with no full-union replacement; the trustgraph script gets a local schema"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Restore Evidence.ts from git; the frozen trustgraph artifact decodes with either schema."
---

EvidenceSelectorKind, the three selectors, EvidenceSelector, EvidenceTarget, EvidenceAnchor, BoundedEvidenceProjection and the nine evidence codecs in Adapters/WebAnnotation.ts go. They have no package or app consumer and every transform throws a defect on bad input. A DTO codec over the whole Selector union is not written: it would need RangeSelector and refinedBy DTOs plus two unregistered oa terms (a term-snapshot release), and the OA profile of p0-item7, which P3 implements, has only the position and quote selectors. The census missed one consumer: goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts decodes a frozen evidence artifact with BoundedEvidenceProjection through a relative path that no typecheck covers and that reference goal's rerun.verify runs. The script gets a local schema for the frozen shape (anchors of text-quote selectors, truncated) so the rerun still works; the artifact is not edited. Census row f-1 records the narrowings: positions are non-empty and unit-tagged, Fragment.conformsTo is required, and EvidenceAnchor id and note have no L1 counterpart (the WebAnnotation DTO keeps id and bodyValue).
