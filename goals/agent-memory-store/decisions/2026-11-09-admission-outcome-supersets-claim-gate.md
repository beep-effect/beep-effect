---
title: "Admission outcomes are a superset of ClaimGateResult with a pure projection onto it"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Collapse AdmissionOutcome to ClaimGateResult plus a side channel for deferral and held texts, by decision file, if the four-way outcome stops earning its keep"
---

Amends findings-reuse-epistemics-gate. ClaimGateVerdict is two-way (admitted, rejected), but admission has four outcomes: landed, deferred (exact-hash dedupe), held (both texts kept for a resolver) and rejected. A two-way verdict cannot carry the deferred node or the held texts, so AdmissionOutcome stays a store union discriminated on outcome. It does not duplicate the gate shapes: every finding is a MemoryGateViolation { code, violation } whose violation is a ClaimGateViolation with ClaimGateSeverity, and the pure toClaimGateResult projects any outcome onto ClaimGateResult (landed and deferred to admitted; held and rejected to rejected with the inner ClaimGateViolations). RecallResult findings use the same MemoryGateViolation. Code: packages/tooling/library/agent-memory-store/src/Admission.models.ts. Rejected: embedding a ClaimGateResult field in each variant (stores the verdict twice and lets it disagree with the outcome tag).
