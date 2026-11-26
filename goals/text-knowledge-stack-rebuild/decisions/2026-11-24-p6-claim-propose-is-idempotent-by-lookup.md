---
title: "P6: claim_propose is idempotent by lookup: an unsuperseded proposed claim for the same scope, logical key and support is returned, not re-minted"
date: 2026-11-24
lane: "p6"
reversal: "Declare claim_propose idempotent: false and let a retry mint a new claim or be refused"
---

Independent review of the P6 design. The first draft declared claim_propose idempotent, but the claim/v1 preimage hashes generatedBy and knowledgeStart (epistemics/src/ClaimCore.ts:78-95), and both are fresh per call (generatedBy is the activity id minted over started), so a retry minted a second claim id and was either appended as a duplicate proposition or refused as ValidTimeOverlap within the same partition (epistemics/src/ClaimLog.ts:99-100). An agent retries tool calls, so the hint should be true and honest. Inside the partition's permit, the handler first calls LawClaimProposals.findProposed({ scope, logicalKey, supportAtCreation }); an unsuperseded proposed claim found there is returned as it is, with no new activity, mint or append. Property (d) of the write-tools test asserts that two identical dispatches return the same claim id, leave one claim and one activity record, and record no activity on the second.
