# Status census: the eight claim status sites after P4 row 6

Final record required by decision 2026-11-19-p0-rq2-assessments-confirmed-total-carrier-eight-sites
and design 2026-11-23-p4-design.md section 4.2. Measured on the P4 lane after the claim envelope
(makeClaimEnvelope / ClaimVersion) and StructuralVerdict were deleted. Paths are repo-relative.
Coordinate classification does not replace stored fields: owners project them into a total
assessment record only for policy evaluation, and stored bytes keep their local meaning.

| Site | Owner and definition | Current consumers | Meaning | Final class | Projection loss |
| --- | --- | --- | --- | --- | --- |
| ReviewState | @beep/epistemics, packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:160 (makeClaimReview) | party packages/party/domain/src/entities/Claim/Claim.model.ts:63; Kb packages/tooling/tool/cli/src/commands/Kb/Kb.schemas.ts:295; Holds packages/tooling/tool/cli/src/commands/Holds/Holds.schemas.ts:484 | Proposed/Accepted/Rejected/Disputed/Retracted with per-case payloads (disposition, challengers, retraction reason/time) | review coordinate, recorded as separate review records joined at read time, never inside a claim core | none: per-case encoded payloads are unchanged; old rows read through the frozen import readers |
| ReviewTag | @beep/epistemics, packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:189 | party ClaimReadScope packages/party/domain/src/entities/Claim/Claim.model.ts:464; party ProjectionScope packages/party/domain/src/policies/Projection/Projection.behavior.ts:56 | discriminant selector for read scopes | projection derived from the ReviewState union cases; no independent status authority | the payload of each case; selection only |
| ReviewerDisposition | @beep/epistemics, packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:133 | party packages/party/domain/src/entities/Claim/Claim.model.ts:127; EvidenceSignals.reviewer in every makeClaimReview binding | accepted/rejected/abstained with reviewer, exact basis digest, reviewedAt and reason | reviewer signal value; no admission token implied | none |
| StructuralVerdict | deleted from packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts | none; party competency tests use ClaimGateResult | shape-only admitted/rejected | duplicate of ClaimGateResult; removed | none: ClaimGateResult carries the same verdict with typed violations |
| ClaimGateResult | @beep/epistemics, packages/foundation/modeling/epistemics/src/ClaimGate/ClaimGateResult.model.ts:135 | packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:82 and the epistemic use-case, server and agent-memory-store consumers | structural (SHACL) admitted/rejected verdict | structural verdict coordinate; existing verdict law kept | none |
| ClaimDispositionStatus | @beep/epistemics, packages/foundation/modeling/epistemics/src/ClaimDispositionStatus/ClaimDispositionStatus.model.ts:33 | packages/epistemic/domain/src/entities/ClaimDisposition/ClaimDisposition.model.ts:85; SQL CHECK epistemic_claim_disposition_bounded at packages/_internal/db-admin/drizzle/20260813143745_baseline-functions/migration.sql:47 | active/rejected/superseded per stored epistemic claim | disposition coordinate; literals and SQL CHECK unchanged | none |
| ClaimEvidenceReviewStatus | @beep/epistemics, packages/foundation/modeling/epistemics/src/ClaimEvidenceReview/ClaimEvidenceReview.model.ts:177 | packages/epistemic/domain/src/values/ClaimEvidenceReview/ClaimEvidenceReview.model.ts:73; epistemic UI review panel | pending/current/stale evidence review per claim | evidence-review coordinate, claim-local (row 5 two-claims proof keeps it per claim, not per occurrence) | none |
| ClaimLifecycle | @beep/shared-domain, packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts:49 | packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts and 27 other files | lifecycle of an epistemic claim | lifecycle coordinate; stays in shared/domain, the epistemic slice owns advance | none |

## Retirement evidence

- `rg -n 'makeClaimEnvelope|ClaimVersion\b|StructuralVerdict|versionsAt|BitemporalVersion' packages apps --glob '*.ts' --glob '*.tsx' --glob '!**/dist/**'`
  finds no live production symbol; frozen v1 claim rows are read only by private, format-named wire
  readers in the CLI package.
- Party, Kb and Holds store immutable cores plus separate generation, evidence, review, signal,
  challenge, retraction, admission and stance records. Admitted stance is never a stored flag.
