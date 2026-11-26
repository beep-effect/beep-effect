---
title: "Claim provenance returns admissions as an append-order array"
date: 2026-11-24
lane: "p6"
reversal: "Add an admission id to LawAdmission and return a set keyed by it."
---

LawAdmission has no id of its own, and two admissions of one claim can differ only in time and token. ClaimProvenance.admissions is therefore S.Array(LawAdmission) in store append order, while activities are a set encoded as an id-sorted array and captures a canonical set of CaptureId.
