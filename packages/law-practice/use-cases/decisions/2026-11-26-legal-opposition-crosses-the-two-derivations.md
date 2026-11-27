---
title: Prima facie opposition compares one relation's opposite view with the other's correlative view
date: 2026-11-26
reversal: Compare the two stored positions (kind and content) and the two role ids directly in isPrimaFacieOpposed.
governs:
  - src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.service.ts#isPrimaFacieOpposed
  - src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.service.ts#candidateFor
enforcedBy: []
---

Two relations are prima facie opposed when one relation's opposite view coincides with the other's correlative view on bearer, counterparty, kind and content.
Reason: every stored kind is advantage-side and every kind's opposite is burden-side, so a stored-against-stored comparison is vacuously false and finds nothing.
Parties are compared by the party (`player`) each role names: two norms may give the same party differently named roles, and the question is whether the same two parties are involved.
The derivations commute and are involutive, so the relation is symmetric and an unordered pair is the honest shape of a candidate. The candidate's act is read off the left relation because the views coincide on content and neither derivation rewrites a description.
Rejected: comparing the stored kinds, and comparing role ids instead of the parties they name.
