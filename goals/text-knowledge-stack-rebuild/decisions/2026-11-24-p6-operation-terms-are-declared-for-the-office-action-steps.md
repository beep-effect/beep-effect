---
title: "P6: operation:MapToLaw and operation:ProposeClaim are declared; composites name a term only when they leave a process"
date: 2026-11-24
lane: "p6"
reversal: "Remove the two terms from identity/registry/namespaces/operation.json, regenerate the registry and snapshot with --base origin/main, and name the steps with existing terms"
---

Operation.name is a TermIri (identity/src/Term.ts:49-60), and the office-action flow gains two attributed steps the registry does not name. P6 declares operation:MapToLaw (IrToLaw.toLaw over a langextract handoff) and operation:ProposeClaim (minting and promoting a law claim core). Admission is a principal's act through LawAdmission, not an operation, so no admit term is declared. compose takes an explicit term; a production composite or step that leaves a process (is recorded, served or logged) carries a declared operation term, while in-process composites may reuse their parent's. Law tests reuse operation:Extract because the name is outside the declared observation. The registry and term snapshot are written with bun run beep identity registry --write --base origin/main per 2026-11-23-p5-stack-layers-write-the-term-snapshot-against-origin-main; Registry.data.ts is a CI binary closure input, so the PR takes one closure release and pin cycle. Answers O4 and F15.

Amended after independent review. Ten further `operation:` terms are declared for the graph catalog steps, which now name their operation by term and drop `GraphOperation.name` (decision `2026-11-24-p6-graph-catalog-steps-declare-operation-terms`).
