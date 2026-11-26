---
title: "P6: typingsFromDataset types a term only on one stated class type and reads mediations over the subclass closure"
date: 2026-11-24
lane: "p6"
reversal: "Change classTypeOf, instanceCategoryOf and mediationsOf in @beep/ontology Gufo.ts"
---

typingsFromDataset types a named non-gUFO subject only when it states exactly one rdf:type gufo:<ClassType>; none or several leaves it untyped, so the audit stays silent rather than guessing (the L3-3 contract). Its instance category is the first of gufo:Relator, gufo:Quality and gufo:Event that its rdfs:subClassOf closure reaches, otherwise Object, because a gUFO class type such as Kind does not fix the category and Object is the endurant default. Mediations are the owl:onProperty gufo:mediates restrictions stated anywhere in the closure, so a relator subkind inherits its supertype mediations: owl:someValuesFrom reads as cardinality 1 and owl:qualifiedCardinality or owl:minQualifiedCardinality with owl:onClass as its value, the largest per mediated type winning. specializes keeps only named non-gUFO superclasses, since a gUFO upper class as an untyped supertype would wrongly exempt a role from RoleWithoutKind. A relator stated with no mediation cannot be a GufoTyping (its check requires one), so StatedTypings lists it in unmediated and auditStated reports it as RelatorUndermediated. The namespace IRIs come from the identity registry rows; the owl restriction terms are not registry terms, so they are spelled against the owl namespace row.
