# Lane A research — candidate verdict-family names and owners

Date: 2026-08-13

These names are proposals for the shared epistemic-family align decision. This
research does **not** lock them.

## Existing naming evidence

The repo already demonstrates three useful distinctions:

- `ClaimGateResult` is a tagged admitted/rejected gate result with violations,
  not a persisted human disposition
  ([`ClaimGateResult.model.ts:93-140`](../../../packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts#L93)).
- `ClaimDisposition` separately records who resolved a candidate, when, why,
  and with what status
  ([`ClaimDisposition.model.ts:68-106`](../../../packages/epistemic/domain/src/entities/ClaimDisposition/ClaimDisposition.model.ts#L68)).
- `ExecutionVerdict` is a typed allowed/denied action evaluation carrying a
  bounded denial reason
  ([`ExecutionVerdict.model.ts:202-230`](../../../packages/epistemic/domain/src/values/ExecutionVerdict/ExecutionVerdict.model.ts#L202)).

Evidence verification is also already a manifestation/receipt rather than a
truth verdict: the digest seals an exact evidence id and verified source-text
anchor
([`EvidenceVerification.model.ts:22-47`](../../../packages/epistemic/domain/src/values/EvidenceVerification/EvidenceVerification.model.ts#L22)),
and runtime use must re-verify the persisted receipt
([`EvidenceVerification.model.ts:80-95`](../../../packages/epistemic/domain/src/values/EvidenceVerification/EvidenceVerification.model.ts#L80)).

## Proposed canonical family

| Concern | Proposed canonical name | Proposed owner | Why this stem |
| --- | --- | --- | --- |
| Shape validity | `ShapeValidationResult` | schema-owning domain; shared primitive only if two slices share the exact vocabulary | “Result” matches deterministic validation with issues; avoids implying human acceptance. |
| Anchor fidelity | `AnchorVerificationResult` | `@beep/provenance` | Extends the live verification/receipt vocabulary; proves source manifestation correspondence only. |
| Semantic stance | `SemanticStance` | `@beep/epistemic-domain` | It is a classification such as supports/contradicts/abstains, not a gate or disposition. |
| Source authority/currentness | `SourceAuthorityAssessment` | consuming legal/domain slice, with shared structural carrier only if needed | Authority and currentness are scoped, reason-bearing assessments; neither is textual fidelity. |
| Human disposition | `HumanDisposition` as the family stem; domain-qualified concrete types such as `ClaimDisposition` | domain that owns the reviewed subject | Matches the live durable decision record and avoids one universal status vocabulary. |
| Action authorization | `ExecutionVerdict` | `@beep/epistemic-domain` / governed-execution boundary | Already live and correctly scoped to principal, operation, sink, destination, and audience. |
| Release | `ReleaseDisposition` | release-owning application/domain boundary | Release is a durable scoped decision, downstream of verification and approval, not another execution verdict. |

Two alternatives should remain visible at align:

1. Use `...Verdict` uniformly for every computed gate. Rejected because it
   obscures the material distinction between validation, classification,
   assessment, recorded disposition, authorization, and release.
2. Use `SourceAuthorityVerdict` and `ReleaseVerdict`. This is terser, but the
   live repo's strongest boundary is that human decisions are dispositions;
   `...Disposition` better signals durable principal/time/rationale provenance.

## Ownership law proposed for align

Names may be shared; vocabularies should not be centralized prematurely.
Structural verification belongs with the structure it verifies. Human
dispositions belong with the reviewed subject. Execution authorization stays
at the enforcement boundary. A belief-view policy may consume typed values
from several families but owns none of their truth or disposition semantics.

This follows the triage constraint that semantic stance must never double as
anchor fidelity, source authority, or disposition
([`epistemic-contradiction-triage/SPEC.md:62-78`](../../../goals/epistemic-contradiction-triage/SPEC.md#L62)).

