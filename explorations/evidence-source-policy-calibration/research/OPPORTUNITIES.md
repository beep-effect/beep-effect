# Opportunities

## 2026-10-09 — Partial gate report loses provenance at the handoff

While inventorying ClaimGateResult and ClaimDisposition, the live result exposed
admitted/rejected plus projected violations, but no complete immutable report
reference, shape version or severity counts. That makes a consumer reconstruct
validation provenance or mistake a gate verdict for a reviewer decision.
Evidence: `packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts`
and `packages/epistemic/domain/src/entities/ClaimDisposition/ClaimDisposition.model.ts`.
Prevention: G3's ValidatorAssessment adapter retains the complete raw report and
versions alongside the separate admission verdict. This is recorded NET-NEW,
not repaired by editing packages in this docs lane.
