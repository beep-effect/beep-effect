# P4 map: claims core and its consumers

Read-only measurement at 71242e1de7b. No source was edited. Paths are repo-relative. Counts below are reproducible lexical inventories; the P0 chapter-11 semantic sums in research/consumer-census.md:514-538 are historical, not re-labelled as live sums.

## Current core

ClaimEnvelope is a factory description, not an exported class: Claim/Claim.model.ts:276 in packages/foundation/modeling/epistemics/src exports makeClaimEnvelope. It returns ClaimVersion and four supporting schemas at :370. ClaimVersion at :343 puts id, proposition, assertion support/challenges, valid/knowledge intervals, supersedes, review and five signals in one row. The three bindings are party/domain/src/entities/Claim/Claim.model.ts:13, tooling/tool/cli/src/commands/Kb/Kb.schemas.ts:210 and tooling/tool/cli/src/commands/Holds/Holds.schemas.ts:407 (all under packages/).

EvidenceSpan at packages/foundation/modeling/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:147 combines TextAnchorFields with Confidence (:107-119); Confidence is UnitInterval (:48), not a calibrated probability. Signal Present/Absent and the four absence reasons are Claim/Claim.model.ts:39-70, Measurement is :94. Five signal coordinates are :311-319. ReviewState is :331, ReviewerDisposition :304, StructuralVerdict :157, ReviewTag :186; SQL disposition and the other sites are inventoried in map-model.

The defaults are real: apps/labs/semantica/src/layers/ExtractorLive.ts:299-300 and :833 manufacture 1; packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:107 manufactures 0.9. The separate ValueConflictConfidence at epistemics/src/ContradictionDetection/ContradictionDetection.model.ts:48 is a named detector constant, not a missing-extraction fallback; keep it typed and do not delete it by number search.

DeterministicCheck is packages/law-practice/use-cases/src/DocketIntake/DocketReview.schemas.ts:224-233: passed is Boolean. DocketReview.policy.ts:283-287 treats unavailable text as true; :388-389 gates by every passed bit.

## Every lexical epistemics import site

Command: `rg -n '"@beep/epistemics(?:/[^"\n]*)?"' packages apps --glob '*.ts' --glob '*.tsx'`.
Measured 211 matching lines in 97 files (lexical lines, including examples and imports; not semantic-use sums).

| File and first matching line | Matching lines | Migration responsibility |
| --- | ---: | --- |
| apps/labs/semantica/src/corpus/Canonical.ts:1 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| apps/labs/semantica/src/layers/ExtractorLive.ts:1 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| apps/labs/semantica/src/schema/Evidence.ts:1 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| apps/labs/semantica/test/Evaluator.test.ts:3 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| apps/labs/semantica/test/Projection.test.ts:4 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| apps/labs/semantica/test/Schema.test.ts:3 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| apps/labs/semantica/test/helpers/CrashProbeChild.ts:2 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| apps/professional-desktop/src/contradiction/ContradictionQaSeed.ts:45 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/entities/ClaimDisposition/ClaimDisposition.model.ts:7 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:38 | 3 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts:8 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/values/ClaimEvidenceReview/ClaimEvidenceReview.model.ts:12 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/values/ClaimProjection/ClaimProjectionView.model.ts:7 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:25 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/values/ContradictionDetection/ContradictionDetection.behavior.ts:7 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/values/ContradictionDetection/ContradictionDetection.model.ts:14 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/values/EdgeEndpoint/EdgeEndpoint.model.ts:7 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/values/EvidenceVerification/EvidenceVerification.model.ts:10 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:16 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/src/values/Retention/Retention.behavior.ts:6 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/test/ClaimEvidenceReview.test.ts:7 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/test/Contradiction.test.ts:29 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/test/ContradictionDetection.test.ts:9 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/test/EpistemicDomain.test.ts:13 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/domain/test/FactoryBinding.types.test.ts:9 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/server/scripts/retention-calibrate.ts:16 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/server/src/ContradictionTriage/ContradictionTriage.repo.ts:60 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/server/test/BoundedShaclValidator.test.ts:9 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/server/test/integration/ContradictionTriage.pg.test.ts:41 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/server/test/integration/ContradictionTriage.pglite.test.ts:47 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/server/test/integration/EdgeAuthority.pglite.test.ts:24 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/tables/src/entities/Evidence/Evidence.converters.ts:10 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/tables/src/entities/EvidenceVerification/EvidenceVerification.converters.ts:8 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/tables/test/ContradictionTables.test.ts:38 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/tables/test/EpistemicTables.test.ts:12 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/ui/stories/ClaimEvidenceReview.stories.tsx:9 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/ui/test/ClaimEvidenceReviewPanel.test.tsx:9 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/use-cases/src/ClaimDisposition/ClaimDisposition.service.ts:20 | 3 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/use-cases/src/ClaimGate/ClaimGate.ports.ts:15 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:17 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts:16 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/use-cases/src/ContradictionDetection/ContradictionDetection.layer.ts:28 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/use-cases/src/Retention/Retention.service.ts:24 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/use-cases/test/ClaimDisposition.test.ts:7 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/use-cases/test/ClaimEvidenceReview.test.ts:8 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/use-cases/test/ContradictionDetection.golden.test.ts:19 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/epistemic/use-cases/test/EpistemicUseCases.test.ts:5 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/Claim/Claim.behavior.ts:21 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:30 | 8 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/ClaimDispositionStatus/ClaimDispositionStatus.model.ts:23 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/ClaimDispositionStatus/index.ts:14 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/ClaimEvidenceReview/ClaimEvidenceReview.model.ts:31 | 5 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/ClaimGate/ClaimGateResult.model.ts:27 | 5 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/ClaimGate/index.ts:14 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/ClaimProjection/ClaimProjectionView.model.ts:21 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/Contradiction/Contradiction.model.ts:48 | 20 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/ContradictionDetection/ContradictionDetection.behavior.ts:34 | 4 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/ContradictionDetection/ContradictionDetection.model.ts:24 | 8 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/EdgeEndpoint/EdgeEndpoint.model.ts:26 | 4 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/EdgeRelation/EdgeRelation.model.ts:22 | 6 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/EdgeRelation/index.ts:14 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:39 | 7 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/EvidenceSpan/index.ts:15 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/EvidenceVerification/EvidenceVerification.model.ts:35 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/Factory/Factory.model.ts:26 | 5 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/KnowledgeInterval/KnowledgeInterval.behavior.ts:26 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/KnowledgeInterval/KnowledgeInterval.model.ts:28 | 4 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:56 | 5 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/ValidInterval/ValidInterval.behavior.ts:26 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/ValidInterval/ValidInterval.model.ts:28 | 4 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/src/index.ts:15 | 15 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/test/Claim.test.ts:1 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/test/EvidenceSpan.test.ts:7 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/test/Factories.test.ts:6 | 11 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/test/Factory.test.ts:5 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/test/Interval.test.ts:1 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/epistemics/test/index.test.ts:1 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/foundation/modeling/identity/src/packages.ts:3502 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/law-practice/use-cases/src/VerdictProjector/VerdictProjector.schemas.ts:9 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/party/domain/src/entities/Claim/Claim.model.ts:6 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/party/domain/src/policies/Admission/Admission.model.ts:20 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/party/domain/src/policies/Projection/Projection.behavior.ts:14 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/party/domain/src/policies/Resolution/Resolution.behavior.ts:6 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/party/domain/test/Party.competency.test.ts:1 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/party/domain/test/fixtures/acme.ts:2 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/party/server/src/values/ContactEvidence/ContactEvidence.behavior.ts:7 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/party/server/src/values/IdentityEvidence/IdentityEvidence.behavior.ts:6 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/party/server/src/values/MailIndex/MailIndex.behavior.ts:6 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/party/server/src/values/ReviewLoop/ReviewLoop.behavior.ts:7 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/party/server/src/values/ReviewLoop/ReviewLoop.model.ts:6 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/tooling/library/agent-memory-store/src/Admission.models.ts:8 | 2 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/tooling/library/agent-memory-store/src/internal/AdmissionPlan.ts:13 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts:749 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/tooling/tool/cli/src/commands/Holds/Holds.schemas.ts:9 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/tooling/tool/cli/src/commands/Kb/Kb.schemas.ts:6 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts:348 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |
| packages/tooling/tool/cli/test/canonical-digest-owner-differential.test.ts:22 | 1 | Audit import; retain unchanged unless the retirement table below identifies a changed facet |

## Retiring names and derived consumer reach

Command: `rg -n 'ClaimVersion|EvidenceSpan|makeClaimEnvelope|KbClaim|HoldClaimVersion' packages apps --glob '*.ts' --glob '*.tsx'`.
Measured 342 matching lines in 62 files (lexical lines, including examples and imports; not semantic-use sums).

| File and first matching line | Matching lines | Migration responsibility |
| --- | ---: | --- |
| apps/labs/semantica/src/layers/ExtractorLive.ts:1 | 1 | Separate extractor signal; retain claim identity and receipts |
| apps/labs/semantica/src/schema/Evidence.ts:1 | 1 | Separate extractor signal; retain claim identity and receipts |
| apps/labs/semantica/test/Evaluator.test.ts:3 | 1 | Rewrite fixtures and assertions with the owning consumer |
| apps/labs/semantica/test/Projection.test.ts:4 | 1 | Rewrite fixtures and assertions with the owning consumer |
| apps/labs/semantica/test/Schema.test.ts:3 | 1 | Rewrite fixtures and assertions with the owning consumer |
| apps/labs/semantica/test/helpers/CrashProbeChild.ts:2 | 1 | Rewrite fixtures and assertions with the owning consumer |
| apps/professional-desktop/src/contradiction/ContradictionQaSeed.ts:45 | 3 | Evidence position plus extractor signal and existing evidence association |
| packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts:8 | 3 | Evidence position plus extractor signal and existing evidence association |
| packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:914 | 1 | Evidence position plus extractor signal and existing evidence association |
| packages/epistemic/domain/test/ClaimEvidenceReview.test.ts:7 | 4 | Rewrite fixtures and assertions with the owning consumer |
| packages/epistemic/domain/test/Contradiction.test.ts:29 | 1 | Rewrite fixtures and assertions with the owning consumer |
| packages/epistemic/domain/test/EpistemicDomain.test.ts:17 | 15 | Rewrite fixtures and assertions with the owning consumer |
| packages/epistemic/server/src/ContradictionTriage/ContradictionTriage.repo.ts:60 | 2 | Evidence position plus extractor signal and existing evidence association |
| packages/epistemic/server/test/integration/ContradictionTriage.pg.test.ts:41 | 1 | Rewrite fixtures and assertions with the owning consumer |
| packages/epistemic/server/test/integration/ContradictionTriage.pglite.test.ts:47 | 1 | Rewrite fixtures and assertions with the owning consumer |
| packages/epistemic/tables/src/entities/Evidence/Evidence.converters.ts:10 | 7 | Evidence position plus extractor signal and existing evidence association |
| packages/epistemic/tables/src/entities/EvidenceVerification/EvidenceVerification.converters.ts:8 | 2 | Evidence position plus extractor signal and existing evidence association |
| packages/epistemic/tables/test/ContradictionTables.test.ts:38 | 1 | Rewrite fixtures and assertions with the owning consumer |
| packages/epistemic/tables/test/EpistemicTables.test.ts:12 | 1 | Rewrite fixtures and assertions with the owning consumer |
| packages/epistemic/ui/stories/ClaimEvidenceReview.stories.tsx:9 | 2 | Rewrite fixtures and assertions with the owning consumer |
| packages/epistemic/ui/test/ClaimEvidenceReviewPanel.test.tsx:9 | 2 | Rewrite fixtures and assertions with the owning consumer |
| packages/epistemic/use-cases/test/ClaimEvidenceReview.test.ts:8 | 3 | Rewrite fixtures and assertions with the owning consumer |
| packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:254 | 11 | Foundation ingredients, references or retirement |
| packages/foundation/modeling/epistemics/src/ClaimEvidenceReview/ClaimEvidenceReview.model.ts:15 | 2 | Foundation ingredients, references or retirement |
| packages/foundation/modeling/epistemics/src/Contradiction/Contradiction.model.ts:36 | 1 | Foundation ingredients, references or retirement |
| packages/foundation/modeling/epistemics/src/ContradictionDetection/ContradictionDetection.model.ts:14 | 1 | Foundation ingredients, references or retirement |
| packages/foundation/modeling/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:28 | 31 | Foundation ingredients, references or retirement |
| packages/foundation/modeling/epistemics/src/EvidenceSpan/index.ts:11 | 4 | Foundation ingredients, references or retirement |
| packages/foundation/modeling/epistemics/src/index.ts:164 | 2 | Foundation ingredients, references or retirement |
| packages/foundation/modeling/epistemics/test/Claim.test.ts:1 | 9 | Rewrite fixtures and assertions with the owning consumer |
| packages/foundation/modeling/epistemics/test/EvidenceSpan.test.ts:4 | 18 | Rewrite fixtures and assertions with the owning consumer |
| packages/foundation/modeling/epistemics/test/Factories.test.ts:30 | 2 | Rewrite fixtures and assertions with the owning consumer |
| packages/foundation/modeling/text/src/TextAnchor.ts:9 | 1 | Evidence position plus extractor signal and existing evidence association |
| packages/party/domain/src/entities/Claim/Claim.model.ts:6 | 7 | Core plus separate evidence, review and admission records |
| packages/party/domain/src/policies/Admission/Admission.model.ts:30 | 7 | Core plus separate evidence, review and admission records |
| packages/party/domain/src/policies/Projection/Projection.behavior.ts:29 | 6 | Core plus separate evidence, review and admission records |
| packages/party/domain/src/policies/Resolution/Resolution.behavior.ts:19 | 8 | Core plus separate evidence, review and admission records |
| packages/party/domain/src/policies/Resolution/Resolution.model.ts:9 | 3 | Core plus separate evidence, review and admission records |
| packages/party/domain/src/values/Ids/Ids.model.ts:33 | 19 | Core plus separate evidence, review and admission records |
| packages/party/domain/test/Admission.test.ts:11 | 3 | Rewrite fixtures and assertions with the owning consumer |
| packages/party/domain/test/Claim.test.ts:1 | 7 | Rewrite fixtures and assertions with the owning consumer |
| packages/party/domain/test/Party.competency.test.ts:11 | 6 | Rewrite fixtures and assertions with the owning consumer |
| packages/party/domain/test/Resolution.test.ts:1 | 3 | Rewrite fixtures and assertions with the owning consumer |
| packages/party/domain/test/fixtures/acme.ts:3 | 6 | Rewrite fixtures and assertions with the owning consumer |
| packages/party/server/src/internal/claimFromAssertion.ts:6 | 7 | Core plus separate evidence, review and admission records |
| packages/party/server/src/values/ContactEvidence/ContactEvidence.model.ts:9 | 2 | Core plus separate evidence, review and admission records |
| packages/party/server/src/values/IdentityEvidence/IdentityEvidence.behavior.ts:7 | 5 | Core plus separate evidence, review and admission records |
| packages/party/server/src/values/Ledger/Ledger.memory.ts:7 | 7 | Core plus separate evidence, review and admission records |
| packages/party/server/src/values/ReviewLoop/ReviewLoop.model.ts:8 | 2 | Core plus separate evidence, review and admission records |
| packages/party/server/test/Ledger.test.ts:1 | 17 | Rewrite fixtures and assertions with the owning consumer |
| packages/party/use-cases/src/values/Ledger/Ledger.ports.ts:7 | 3 | Core plus separate evidence, review and admission records |
| packages/tooling/tool/cli/src/commands/Holds/Holds.inventory.ts:16 | 12 | CLI binding and frozen stored-row read transform |
| packages/tooling/tool/cli/src/commands/Holds/Holds.program.ts:33 | 15 | CLI binding and frozen stored-row read transform |
| packages/tooling/tool/cli/src/commands/Holds/Holds.schemas.ts:9 | 7 | CLI binding and frozen stored-row read transform |
| packages/tooling/tool/cli/src/commands/Holds/Holds.service.ts:26 | 10 | CLI binding and frozen stored-row read transform |
| packages/tooling/tool/cli/src/commands/Kb/Kb.projection.ts:14 | 7 | CLI binding and frozen stored-row read transform |
| packages/tooling/tool/cli/src/commands/Kb/Kb.schemas.ts:6 | 7 | CLI binding and frozen stored-row read transform |
| packages/tooling/tool/cli/src/commands/Kb/Kb.service.ts:24 | 13 | CLI binding and frozen stored-row read transform |
| packages/tooling/tool/cli/src/commands/Kb/KbGraph.service.ts:34 | 2 | CLI binding and frozen stored-row read transform |
| packages/tooling/tool/cli/test/Holds.inventory.test.ts:6 | 2 | Rewrite fixtures and assertions with the owning consumer |
| packages/tooling/tool/cli/test/Holds.verdict.test.ts:4 | 3 | Rewrite fixtures and assertions with the owning consumer |
| packages/tooling/tool/cli/test/Kb.test.ts:7 | 9 | Rewrite fixtures and assertions with the owning consumer |

## Inventory interpretation

The import table includes documentation examples, kept concepts and consumers of unaffected facets. Its rows are audit sites, not instructions to rewrite kept status, interval or projection semantics. The retirement table gives the actual changed-name reach. Foundation helpers known through derived bindings are counted there; consumer-census.md remains the semantic facet-disposition authority.

## Open questions

1. Where does Confidence move when EvidenceSpan is deleted?
2. Which supporting envelope schemas stay, and how do existing party policies read separate records?
3. How are missing extractor values distinguished from explicit numeric measurements?
4. Does the factory itself prove logical-key completeness or must each owner supply an equivalence law?

## Manifest importers

Command: `rg -n '"@beep/epistemics"' packages apps --glob package.json`. Measured 13 dependency declarations. These are retained package dependencies unless the consumer migration removes their last kept facet.

```text
apps/professional-desktop/package.json:66:    "@beep/epistemics": "workspace:^",
apps/labs/semantica/package.json:42:    "@beep/epistemics": "workspace:^",
packages/tooling/tool/cli/package.json:208:    "@beep/epistemics": "workspace:^",
packages/epistemic/use-cases/package.json:61:    "@beep/epistemics": "workspace:^",
packages/epistemic/ui/package.json:71:    "@beep/epistemics": "workspace:^",
packages/epistemic/server/package.json:60:    "@beep/epistemics": "workspace:^",
packages/epistemic/tables/package.json:76:    "@beep/epistemics": "workspace:^",
packages/epistemic/domain/package.json:72:    "@beep/epistemics": "workspace:^",
packages/party/server/package.json:61:    "@beep/epistemics": "workspace:^",
packages/law-practice/use-cases/package.json:76:    "@beep/epistemics": "workspace:^",
packages/party/domain/package.json:61:    "@beep/epistemics": "workspace:^",
packages/foundation/modeling/epistemics/package.json:2:  "name": "@beep/epistemics",
packages/tooling/library/agent-memory-store/package.json:65:    "@beep/epistemics": "workspace:^",
```

## Independent review: consumer closure and early retirement

The package/app import census above does not cover retained design modules. In commit 2, move
L4.claims.ts:16 AbsenceReason to @beep/schema/Signal and retain only ValidTime from
@beep/epistemics/Claim; inspect every retained goals/**/ops/design module for retired exports.
The quote closure continues through SourceRef, ReviewItem and nested QuestionFact to ReviewFiles
items.jsonl and DocketQuestions.schemas.ts. The remeasured whole-symbol file table in
2026-11-23-p4-map-stored-and-consumers.md supersedes the narrower quote list. Commit 7 owns that
entire closure and the reopened-store proof; commit 1 freezes its representative old rows.
