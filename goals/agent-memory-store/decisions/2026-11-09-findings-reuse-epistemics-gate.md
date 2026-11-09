---
title: "Typed findings reuse the @beep/epistemics claim-gate shapes"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Introduce a store-local finding union by decision file if the epistemics gate vocabulary changes under the store"
---

The SPEC reuses the epistemic kernel where it fits and @beep/repo-cli already depends on @beep/epistemics. Admission outcomes and retrieval-gate findings extend ClaimGateResult, ClaimGateViolation and ClaimGateSeverity with store-specific violation codes as a LiteralKit domain (held conflict, backward status move, missing candidate edge, failed identity lookup, unimported folder); the typed identity lookup is one violation kind. One finding vocabulary serves claim gates and memory admission. Rejected: a store-local union that duplicates severity and verdict shapes.
