---
title: "Admission names what it refused: unknownNode, unknownRevision and statusOutsideLifecycle join the violation codes"
date: 2026-11-12
lane: "agent-memory-store-p2"
reversal: "Fold the three codes back into heldConflict with distinguishing messages by decision file if consumers never branch on them"
---

AC-3 needs every held or rejected write to carry a typed finding, and the P0 MemoryViolationCode domain had no code for the outright refusals the P2 admission layer makes: an operation naming a node the log never held (or an insert whose predecessor is no node of its file, the same rule as the log's UnplacedNodeError), an expected revision that was never a revision of its node, and a status move whose field has no lifecycle, whose target value is outside it or whose node text holds no single value of it. Reusing staleExpectedRevision or identityLookupFailed would make a never-existed revision read as a lost race and a malformed status move read as a retrieval finding. The domain gains unknownNode, unknownRevision and statusOutsideLifecycle; MemoryGateViolation and the projection onto ClaimGateResult are unchanged. Code: packages/tooling/library/agent-memory-store/src/Admission.models.ts. Rejected: one generic malformedOperation code (a consumer of the replay could not tell a bad base from a bad lifecycle).
