---
title: "P6: the gUFO lint audits the subjects of the batch's added quads, in the use case every save runs through"
date: 2026-11-24
lane: "p6"
reversal: "Move the lint into OntologyToolHandlers.ts or audit every typed term of the session"
---

The gUFO audit runs over the named subjects of the batch delta added quads, against the typings the whole post-apply asserted partition states, so a batch is judged on the terms it touches with the context the ontology already holds. Terms the batch does not touch are not audited, so a pre-existing violation elsewhere never blocks an unrelated batch. Both lints run in OntologyToolService.applyAndSave, the session use case every mutation saves through, rather than in the MCP handler, so ontology_repair is linted too and the handler stays a TierGate wrapper. The refusal joins OntologyToolFailure, so the MCP tool returns it as a value. @beep/ontology-use-cases takes @beep/ontology as a dependency; @beep/ontology-server takes it as a devDependency because only its handler test reads OntoViolation.
