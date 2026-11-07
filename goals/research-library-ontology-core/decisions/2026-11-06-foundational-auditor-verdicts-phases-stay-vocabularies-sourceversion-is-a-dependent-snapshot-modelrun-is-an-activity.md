---
title: "Foundational-auditor verdicts: phases stay vocabularies, SourceVersion is a dependent snapshot, ModelRun is an activity"
date: 2026-11-06
lane: "feat/research-library-ontology-core"
reversal: "Reclassify in Library.schemas.ts and Library.ontology.ts and regenerate the T-Box; record why in a superseding decision"
---

Primary-seat verdicts are in research/FOUNDATIONAL-AUDIT.md and the independent adversary seat is in research/FOUNDATIONAL-AUDIT-REVIEW.md. Capture status, effective categories, access class, source kind, ownership and qualification status are controlled vocabularies (SKOS concepts plus sh:in), never OWL classes. Source and SourceVersion are both rigid kinds. SourceVersion depends on one Source through prov:specializationOf and is never a subclass of it. Occurrence and Derivation are reified relators. hopDepth is an edge property measured from an intakeId anchor. ModelRun is a prov:Activity associated with a prov:SoftwareAgent model pin; the first design called it a SoftwareAgent, which merged specification and execution. Artifact drops the dcat:Distribution alignment. The option DTOs have no domain referent and stay out of the fold. Steward ratification is an agent decision under the 2026-10-06 autonomy charter.
