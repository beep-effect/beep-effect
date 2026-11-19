---
title: "P0 confirms RQ1: @beep/annotation is created in P3 as a foundation/modeling package"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
reversal: "Land the L2 contract inside @beep/nlp-processing instead, by a decision file before P3 opens; the SPEC L2 acceptance row is edited in the same change."
---

Confirmed against the live tree at f9982f3b5e6. The census (research/consumer-census.md, group b) shows the handoff contract has 40 consumer lines in 10 files, all in langextract and the semantica lab, and that neither IrToLaw nor the semantica projection reads AnnotatedDocument today, so there is no reader to keep compatible and no reason to land the contract inside a package that P7 retires. The package is pure schemas and pure functions over them (document, merge, restrict, containment), which is foundation/modeling; its OA and NIF codec lives in an adapter subpath so the base stays rdf-free. The routing proof is the separate decision p0-routing-annotation-asset-pack-and-write-tool-host.
