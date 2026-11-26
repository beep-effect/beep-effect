---
title: "P6: law claims are held in a LawClaimStore port with only a memory layer; no stored format in P6"
date: 2026-11-24
lane: "p6"
reversal: "Add a persistent LawClaimStore layer with a versioned table and migrate the memory layer's callers to it"
---

Proposed law claims, generation facts, activity records and admissions need somewhere to live for the flow, the claim toolkit, admission and provenance traversal. No host persists them in P6 (the toolkit is not hosted, decision 2026-11-24-p6-the-claim-toolkit-is-defined-in-law-practice-and-not-yet-hosted), so a table now would be a stored format nobody reads. LawClaimStore is a use-cases port (append, get, openAdmission, binding, generation, admissions) with a typed LawClaimStoreError, and the server ships LawClaimStore.memory.ts only. A persistent store is versioned from its first row when a host adds it, which keeps the stored-format law simple: no row exists that would need a read-side converter. Answers A2 and F6.

Amended after independent review. The single `LawClaimStore` port splits into `LawClaimProposals` and `LawClaimAdmissions` (decision `2026-11-24-p6-the-claim-store-splits-proposal-and-admission-ports`), and the proposal side holds one claim log per scope with stamp-then-append serialized per partition (decision `2026-11-24-p6-claim-logs-partition-by-scope-and-serialize-stamp-then-append`). The server's memory layer backs both ports and has its own server test, `ClaimStore.memory.test.ts`. No stored format is added.
