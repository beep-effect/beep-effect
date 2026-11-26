---
title: "LawAdmission.admit takes the assessments it gates on"
date: 2026-11-24
lane: "p6"
reversal: "Store assessments with each proposal in LawClaimProposals and read them in admit."
---

The design's `LawAdmission.admit(request: { claim, token, grounding, revision })` has no source for the office-action assessments its gate check needs, and the store keeps proposals only. `admit` therefore takes `assessments: OfficeActionAssessments` in its request and checks `OfficeActionDistinctionGate.passes` before the epistemics admission; a failing record returns `GateNotPassed`. The attorney action carries the review's assessment record (or one the attorney revised). Code: `use-cases/src/LawAdmission/LawAdmission.ports.ts`.
