---
title: "The review assesses alignment and reference, then support through the gate"
date: 2026-11-24
lane: "p6"
reversal: "Make updateAssessment accept partial records and replace assess with three serial updates."
---

`OfficeActionAssessmentArrows.updateAssessment` returns `Updated` only when the whole record is assessed and passes the gate; otherwise it returns `Refused` with the old record. Three serial updates from an all-`Unassessed` record therefore never get past the first. The review instead builds the record with `alignment` (from the distinction reading's alignment status) and `reference` (`identified`, because the reference document number is non-empty text) already assessed, then makes one `updateAssessment` for `support: "verified"` through `OfficeActionDistinctionGate`. A record that does not pass keeps `support` `Unassessed`, which `LawAdmission.admit` reports as `GateNotPassed`. Code: `use-cases/src/OfficeActionReview/OfficeActionReview.service.ts` (`assess`).
