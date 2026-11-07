---
title: "SHACL shapes are derived from the AssembledOntology inside the Library group"
date: 2026-11-06
lane: "feat/research-library-ontology-core"
reversal: "Move libraryShapes into @beep/ontology as toShacl when a second consumer appears; regenerated files must stay byte-equal"
---

@beep/ontology exposes fold, toTurtle, toJsonLd and toMarkdown, but no SHACL projection. The Library group derives NodeShapes from assembled classes and predicates (targetClass, min/maxCount, datatype, class, sh:in for LiteralKit members). It emits @beep/semantic-web ShaclNodeShape values and serializes them to Turtle with N3TurtleCodec, so the shapes stay generated from the same S.Class source. Promoting the projection into @beep/ontology waits for a second consumer.
