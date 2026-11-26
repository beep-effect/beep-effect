---
title: "The review authorizes claim-proposal on the capture scope"
date: 2026-11-24
lane: "p6"
reversal: "Remove the authorize call from review and wall only the store append."
---

`OfficeActionReview.review` asks `MatterAuthority.authorize` for `claim-proposal` on the capture scope (the extraction request's `source.scopeRef`) before it runs any step, and fails with `ClaimProposalRefused.DeniedScope` when the answer is `Denied`. The principal is the host's `LawPrincipal`, passed in the review's deps. `extractCandidate` stays unwalled so the Practice KG claims batch keeps working under the empty default. Code: `OfficeActionReview.service.ts` (`review`).
