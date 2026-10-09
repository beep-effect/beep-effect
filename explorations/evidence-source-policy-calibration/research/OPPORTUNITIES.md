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

## 2026-10-09 — Heavy wrapper needs the user-session bus

Running the required semantic-delta gate through beep-heavy initially failed
before starting a unit: "XDG_RUNTIME_DIR not defined" and missing user bus.
The environment-only precondition was repaired by supplying the standard
user-session runtime directory and D-Bus address to the same wrapper, which
then queued normally because all three machine-wide slots were busy.
Prevention: the lane launcher should pass its user-session bus environment.
No machine configuration was changed and no admission guard was bypassed.

## 2026-10-09 — Knowledge refs inherits a main-owned gated literal

The committed-HEAD refs check exited 1 on exactly one live gated observation
in `goals/repository-simplification-confidence/SPEC.md`, line 374, classified
external-mirror-reference. The path-literal example at that line was confirmed
unchanged in merged base `36027982f2`. No lane document was a gated finding.
Attribution: inherited, outside this lane's ownership. Prevention: the owning
main repair should teach the checker about the example or revise that prose;
this lane preserves the failure rather than editing another packet or weakening
its gate. The orchestrator owns consolidated inherited-red burn-down.
