---
title: "Claim proposal checks support before promote, so its refusals are defects"
date: 2026-11-24
lane: "p6"
reversal: "Catch ClaimCoreInvalid from promote and map it to SupportUnverified again, and restore the anchor lookup as an Option match."
---

`ClaimProposal.propose` re-verifies the support itself before it calls `promote`: the checked document decode guarantees every candidate target has an anchor row, the request names only annotations of the document (an absent one is refused as `SupportUnverified`), and every supporting anchor is verified against the text the authorized resolver returns. Every refusal `promote` can raise is therefore checked before it runs, so a `promote` refusal is a defect, as are a claim store failure and a mint failure. The service error channel is `ClaimProposalRefused` only, matching section 2 of the design, and the new files carry no unreachable refusal branch.
