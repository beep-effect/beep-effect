---
title: "P6: ontology_propose_change_batch runs SHACL and the gUFO audit before the session's CAS save"
date: 2026-11-24
lane: "p6"
reversal: "Remove the pre-save lint from OntologyToolHandlers.ts and the session use case, and delete typingsFromDataset from @beep/ontology Gufo.ts"
---

ontology_propose_change_batch (packages/ontology/server/src/tools/OntologyToolHandlers.ts:164-167) saves an agent's batch into the session workspace immediately. The workspace is the proposed state and ontology_publish_provenance behind TierGate is the authority step, so the tool already emits proposed state; what is missing is the chapter 16 obligation that agent-proposed terms are linted. P6 runs, before the CAS save, the session SHACL validation (packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts) if the row measures that proposeChangeBatch does not already run it, and the gUFO audit from @beep/ontology/Gufo over the typings the batch states, read by a new pure typingsFromDataset from rdf:type gufo class-type and rdfs:subClassOf assertions. A violation returns a typed refusal and saves nothing. An untyped term is not audited, which is the L3-3 contract. Answers A6.
