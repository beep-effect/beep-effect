---
title: "P6: the pre-save SHACL lint refuses a batch that raises the violation count, not one that leaves it non-conforming"
date: 2026-11-24
lane: "p6"
reversal: "Replace ensureShaclNotWorsened in OntologyToolService.ts with a conformance check, or delete it"
---

Row 12 measured that proposeChangeBatch (OntologyToolService.applyAndSave) saved a batch without running SHACL validation. The lint now validates the session before and after the batch and refuses when the count of violation-severity findings rises, or when the after-run is truncated and the before-run was not. It does not require the result to conform: the ontology_repair path saves through the same applyAndSave and a repair may reduce violations without clearing them, and an ontology that already fails SHACL must still accept batches that fix or leave its violations alone. When both runs are truncated the counts are capped at the validation budget and the batch passes. A finding-identity diff was rejected because property shapes are blank nodes whose labels are not stable across runs. The refusal is OntologyProposedTermRefusal with lint ShaclWorsened {before, after, truncated}.
