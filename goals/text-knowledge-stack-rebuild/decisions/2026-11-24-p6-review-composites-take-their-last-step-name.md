---
title: "Review composites take their last step's name"
date: 2026-11-24
lane: "p6"
reversal: "Add operation:OfficeActionReview to the registry and name the outer composite with it."
---

`composeLogged` needs a name for each composite; the composite records no activity. The operation registry has no review-level term, and adding one only to name a derived view is not worth a registry entry, so the inner composite takes `operation:MapToLaw` and the outer `operation:ProposeClaim`, the name of its last step. Code: `OfficeActionReview.service.ts` (`review`).
