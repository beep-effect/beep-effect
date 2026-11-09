# Law-practice product reader report

Read-only repository assessment, 2026-11-08. This report describes the checked-out source, not an assertion that live credentials, private corpora, deployments, tests, or external services currently work. No tests, installs, compute jobs, or state-changing Git commands were run. The only created files are this requested scratchpad report and an external report-generation utility. `path:line` references identify the exact local evidence; quoted standards claims below are claims made by repository comments, not an independent standards-compliance audit. Inferences are explicitly labelled.

## 1. Package inventory and product behavior

### Package boundaries

- **@beep/law-practice-domain**: Law-practice context domain models for the runtime proof. (`packages/law-practice/domain/package.json:4`). Declared package exports: `.`, `./entities`, `./entities/ActFrame`, `./entities/CandorDisposition`, `./entities/Claim`, `./entities/CorrectionDelta`, `./entities/Distinction`, `./entities/IdsSubmissionFact`, `./entities/LegalClient`, `./entities/LegalContact`, `./entities/LegalOppositionCandidate`, `./entities/LegalPositionRelator`, `./entities/Matter`, `./entities/OfficeAction`, `./entities/PatentAsset`, `./entities/PatentCitationEvent`, `./entities/PowerExercise`, `./entities/PriorArtReference`, `./entities/Rejection`, `./values`, `./values/ApplicationNumber`, `./values/CitingApplicationIdentity`, `./values/ClaimElement`, `./values/CourtReporterVocabulary`, `./values/DocketDeadline`, `./values/KindCode`, `./values/MailTagging`, `./values/ObservationVersionRef`, `./values/OfficeCode`, `./values/PatentDocument`, `./values/PatentDocumentTriplet`, `./values/PatentNumber`, `./values/ReviewItem`, `./values/SourceRef`, `./values/VerdictRow`, `./values/AnswerRow`, `./values/Question`, `./values/DocStructure`, `./values/PracticeProfile`, `./values/SetupRequirement`, `./test`, `./package.json` (`packages/law-practice/domain/package.json:35`).

- **@beep/law-practice-use-cases**: Law-practice use-case package: IR-to-law mapping and office-action review loop contracts. (`packages/law-practice/use-cases/package.json:4`). Declared package exports: `.`, `./public`, `./server`, `./CandorPolicy`, `./CandorRecord`, `./ClaimSelfCheck`, `./DailyNotice`, `./DocketIntake`, `./IrToLaw`, `./LegalPositionRecord`, `./LegalPositionRelatorPolicy`, `./DocumentIdentification`, `./MailTagging`, `./OfficeActionReview`, `./PatentClaimCandidate`, `./PracticeSetup`, `./QuestionQueue`, `./QuestionWrites`, `./ReviewHub`, `./ReviewItemStore`, `./ReviewQueue`, `./test`, `./internal/*`, `./OfficeActionStructure`, `./VerdictProjector`, `./package.json` (`packages/law-practice/use-cases/package.json:36`).

- **@beep/law-practice-server**: Law-practice server tier: live Layer surface composing the IR-to-law mapping and office-action review loop over the epistemic server. (`packages/law-practice/server/package.json:4`). Declared package exports: `.`, `./layer`, `./CandorPromotionGate`, `./CandorRecord`, `./ClaimInspection`, `./DocketIntake`, `./LegalPositionRecord`, `./DocumentIdentification`, `./MailTagging`, `./NoticeMailbox`, `./internal/*`, `./PracticeKgHost`, `./OfficeActionStructure`, `./QuestionCalendar`, `./ReviewFiles`, `./UsptoClaims`, `./package.json`, `./PartyContactSource` (`packages/law-practice/server/package.json:39`).

- **@beep/law-practice-tables**: law practice table declaration package. (`packages/law-practice/tables/package.json:4`). Declared package exports: `.`, `./tables`, `./entities`, `./entities/*`, `./internal/*`, `./package.json` (`packages/law-practice/tables/package.json:37`).

The domain root re-exports entities and values (`packages/law-practice/domain/src/index.ts:9`). The use-cases root delegates to `/public` and documents an empty root export set (`packages/law-practice/use-cases/src/index.ts:10`); substantive APIs are subpaths and `/server`. The server root exposes claim inspection, the composed Layer, office-action structure, contact adapter, practice KG queries/build/projections/handlers and Tools (`packages/law-practice/server/src/index.ts:9`). Tables exposes actual entity/read-model/table collections (`packages/law-practice/tables/src/index.ts:20`), despite its README still calling it “Shell-only” (`packages/law-practice/tables/README.md:3`).

The use-cases README says “CONTRACTS ONLY” and “no implementation bodies and no live Layers” (`packages/law-practice/use-cases/README.md:12`), but implementations now live here, including `makeIrToLaw`, `makeOfficeActionReview`, `makeDocketIntakeLayer` and `ClaimSelfCheck` (`packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:180`; `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:242`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:1616`; `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimSelfCheck.service.ts:73`). This is observed documentation drift, not a recommendation to relocate those implementations.

### Apps and concrete verticals

“End to end” here means the repository contains an app entry/composition and the use-case/live adapter path. It does not mean a live deployment was exercised.

| App | Concrete behavior supported by the checked-out code/docs | Evidence |
| --- | --- | --- |
| `practice-kg-mcp` | Build a portable PGlite + DuckDB catalog/FTS bundle, serve read-only stdio MCP, run an explicitly enabled remote candidate-claims batch | `apps/practice-kg-mcp/README.md:3`, `apps/practice-kg-mcp/README.md:24`, `apps/practice-kg-mcp/src/runtime/Layer.ts:1` |
| `docket-intake` | Outlook mail → paralegal extraction → secretary rereading → deterministic dates and review rounds → tentative due/reminder or needs-review calendar entries; polling, dry-run, journals, undo, smoke and daily digests | `apps/docket-intake/README.md:7`, `apps/docket-intake/README.md:37`, `apps/docket-intake/src/runtime/Layer.ts:89` |
| `practice-mail-tagging` | Matter Outlook categories; routable attachments filed to Box; resumable passes, dry-run, apply/watch and category rollback | `apps/practice-mail-tagging/README.md:3`, `apps/practice-mail-tagging/README.md:16`, `apps/practice-mail-tagging/src/runtime/Layer.ts:1` |
| `practice-identify` | Explicit private contacts/evidence input → index → USPTO lookups → client/docket resolutions and evaluation; no document filing or model endpoint invoked by these CLI commands | `apps/practice-identify/README.md:27`, `apps/practice-identify/README.md:46`, `apps/practice-identify/src/runtime/Layer.ts:1` |
| `practice-m365-contacts` | Explicit CSV census and contact-create plans, pre-seed export, tagged contact creation and guarded rollback; VCF is census-only | `apps/practice-m365-contacts/README.md:3`, `apps/practice-m365-contacts/README.md:12`, `apps/practice-m365-contacts/src/Contacts.service.ts:1` |
| `practice-review-hub` | HTTP MCP over review items, answers and verdicts; daily notice command | `apps/practice-review-hub/README.md:3`, `apps/practice-review-hub/README.md:7`, `apps/practice-review-hub/src/runtime/Layer.ts:1` |
| `practice-gateway` | Claude Desktop extension with profile-selected providers, setup doctor and a self-check | `apps/practice-gateway/README.md:3`, `apps/practice-gateway/README.md:7`, `apps/practice-gateway/src/Server.ts:1` |
| `practice-claude-mod` | Attorney Claude Code plugin: matter selection, explicit timer, verdict capture/export and firm briefing/review skills; selection/timer state resets on reload | `apps/practice-claude-mod/README.md:18`, `apps/practice-claude-mod/README.md:30`, `apps/practice-claude-mod/README.md:45` |

`practice-setup` is an adjacent setup app (`apps/practice-setup/README.md:1`); the direct TypeScript import scan below did not identify it as a direct law-practice package consumer. Apps such as the ontology workbench may matter to the broader foundation proposal, but are not counted as law-practice consumers unless an actual law-practice import exists.

The office-action review is a runnable library composition over file processing, LangExtract, `IrToLaw`, epistemic gating and projection (`packages/law-practice/server/README.md:6`; `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:242`). Its entity mapping remains explicitly a spike (`packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:12`). The citation extraction implementation has a connected private source→extraction→resolution→document path (`packages/law-practice/server/src/internal/Citation/SourceDocument.ts:59`), while the complete public engine service is still documented unfinished (`packages/law-practice/use-cases/README.md:30`, `packages/law-practice/use-cases/README.md:60`). Schema coverage, private compositions and a complete shipped citation guard must be distinguished.

### Complete direct app→law-practice import inventory

The following includes source and tests; fixture/test imports alone do not establish a shipped feature.

#### docket-intake

- `apps/docket-intake/src/Backfill.ts:11`: `{ ReviewItem }` from `@beep/law-practice-domain`.

- `apps/docket-intake/src/Backfill.ts:12`: `{ DocketJournalKind, docketQuestionEmailOf, readDocketJournal, readDocketStateFile, }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/src/Backfill.ts:18`: `{ DocketIntakeError, DocketIntakeOutcome, DocketQuestionItemId, docketQuestionDigest, docketQuestionNamesEmail, withDocketQuestionEmail, }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/Backfill.ts:26`: `{ ReviewItemStore }` from `@beep/law-practice-use-cases/ReviewItemStore`.

- `apps/docket-intake/src/Backfill.ts:36`: `type { DocketJournalEntry }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/src/Backfill.ts:37`: `type { DocketIntakeState, DocketQuestionEmail }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/Backfill.ts:38`: `type { QuestionReviewItem }` from `@beep/law-practice-use-cases/QuestionQueue`.

- `apps/docket-intake/src/Commands.ts:9`: `{ DocketFileStoreOptions, DocketRunSummary, DocketUndoReport, makeDocketFileJournalLayer, makeDocketFileStoreLayer, }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/src/Commands.ts:16`: `{ makeReviewFilesLayer, ReviewFilesConfig }` from `@beep/law-practice-server/ReviewFiles`.

- `apps/docket-intake/src/Commands.ts:17`: `{ DocketIntakeError, DocketPollOptions }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/Commands.ts:35`: `type { DocketIntakeJournal }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/src/Commands.ts:36`: `type { DocketIntake, DocketIntakeStore }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/Config.ts:9`: `{ DocketReviewConfig, ReviewMaxRounds }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/Cycle.ts:9`: `{ DocketIntakeJournal, DocketRunId, docketDayInZone, recordDocketRunCompleted, writeDigestFile, }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/src/Cycle.ts:16`: `{ DocketIntake, DocketIntakeState, DocketIntakeStore, DocketPollOptions, DocketPollReport, }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/Cycle.ts:33`: `type { DocketIntakeError }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/DryRun.ts:11`: `{ DocketCategory }` from `@beep/law-practice-domain/values/DocketDeadline`.

- `apps/docket-intake/src/DryRun.ts:12`: `{ DocketRunId, docketDayInZone, makeDocketRunId, readDocketStateFile, }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/src/DryRun.ts:18`: `{ DocketCalendar, DocketEntryFlag, DocketEntryKind, DocketIntake, DocketIntakeError, DocketIntakeOutcome, DocketIntakeStore, DocketMailbox, DocketPollReport, DocketWrittenEntry, }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/DryRun.ts:45`: `type { DocketCalendarEntry, DocketIntakeState, DocketPollOptions, }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/Errors.ts:12`: `type { DocketIntakeError }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/Questions.ts:11`: `{ makeReviewFilesLayer, ReviewFilesConfig }` from `@beep/law-practice-server/ReviewFiles`.

- `apps/docket-intake/src/Questions.ts:12`: `{ DocketIntakeOutcome, DocketQuestionInput, DocketQuestions, DocketQuestionsLive, }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/Questions.ts:18`: `{ ReviewItemStore }` from `@beep/law-practice-use-cases/ReviewItemStore`.

- `apps/docket-intake/src/Questions.ts:27`: `type { DocketIntakeState, DocketLedgerRecord }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/src/Smoke.ts:10`: `{ DocketCategory }` from `@beep/law-practice-domain/values/DocketDeadline`.

- `apps/docket-intake/src/Smoke.ts:11`: `{ docketDayInZone }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/src/Undo.ts:10`: `{ applyDocketUndo, DocketRunId, dryRunDocketUndo, latestDocketRun, planDocketUndo, readDocketJournal, readDocketStateFile, summarizeDocketRuns, }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/src/Undo.ts:25`: `type { DocketJournalEntry }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/src/runtime/Layer.ts:9`: `{ DocketFileStoreOptions, DocketGraphConfig, DocketJournalingPortsLive, DocketKgBundleOptions, DocketMatterLookupUnavailableLive, DocketTrackedDatesCsvOptions, makeDocketAgentsLayer, makeDocketFileJournalLayer, makeDocketFileStoreLayer, makeDocketGraphLayer, makeDocketGraphReadOnlyLayer, makeDocketMatterLookupLayer, makeDocketTrackedDatesCsvLayer, }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/src/runtime/Layer.ts:24`: `{ DocketIntakeConfig, DocketReviewConfig, makeDocketIntakeLayer, }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/test/Backfill.test.ts:8`: `{ DocketJournalEntry, DocketRunId }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/test/Backfill.test.ts:9`: `{ makeReviewFilesLayer, ReviewFilesConfig }` from `@beep/law-practice-server/ReviewFiles`.

- `apps/docket-intake/test/Backfill.test.ts:10`: `{ DocketIntakeState, DocketLedgerRecord, DocketNeedsReview, DocketQuestionEmail, DocketQuestionInput, DocketQuestions, DocketQuestionsLive, DocketWrittenEntry, docketQuestionNamesEmail, }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/test/Backfill.test.ts:21`: `{ ReviewItemStore }` from `@beep/law-practice-use-cases/ReviewItemStore`.

- `apps/docket-intake/test/Backfill.test.ts:40`: `type { DocketIntakeError }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/test/Backfill.test.ts:41`: `type { ReviewItemStoreShape }` from `@beep/law-practice-use-cases/ReviewItemStore`.

- `apps/docket-intake/test/Commands.test.ts:8`: `{ DocketRunId, makeDocketRunId, readDocketJournal }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/test/Commands.test.ts:9`: `{ makeReviewFilesLayer, ReviewFilesConfig }` from `@beep/law-practice-server/ReviewFiles`.

- `apps/docket-intake/test/Commands.test.ts:10`: `{ DocketIntakeState, DocketLedgerRecord, DocketNeedsReview, DocketQuestionInput, DocketQuestions, DocketQuestionsLive, DocketWrittenEntry, IntakeFailed, NotDocketItem, }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/test/Commands.test.ts:21`: `{ ReviewItemStore }` from `@beep/law-practice-use-cases/ReviewItemStore`.

- `apps/docket-intake/test/Commands.test.ts:57`: `type { DocketIntakeStore }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/test/Cycle.test.ts:6`: `{ DocketIntake, DocketIntakeState, DocketIntakeStore }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/test/DryRun.test.ts:5`: `{ DocketCalendar, DocketCalendarEntry, DocketIntakeError, DocketMailbox, DocketWrittenEntry, }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/test/Errors.test.ts:4`: `{ DocketIntakeError }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/test/Questions.test.ts:8`: `{ makeReviewFilesLayer, ReviewFilesConfig }` from `@beep/law-practice-server/ReviewFiles`.

- `apps/docket-intake/test/Questions.test.ts:9`: `{ DocketCandidateDate, DocketIntakeState, DocketLedgerRecord, DocketNeedsReview, DocketWrittenEntry, IntakeFailed, }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/test/Questions.test.ts:17`: `{ ReviewItemStore }` from `@beep/law-practice-use-cases/ReviewItemStore`.

- `apps/docket-intake/test/support/Pipeline.ts:5`: `{ DocketResponsePeriod }` from `@beep/law-practice-domain/values/DocketDeadline`.

- `apps/docket-intake/test/support/Pipeline.ts:6`: `{ DocketFileStoreOptions, DocketJournalingPortsLive, DocketMatterLookupUnavailableLive, makeDocketFileJournalLayer, makeDocketFileStoreLayer, }` from `@beep/law-practice-server/DocketIntake`.

- `apps/docket-intake/test/support/Pipeline.ts:13`: `{ DocketCalendar, DocketIntakeConfig, DocketIntakeError, DocketIntakeState, DocketIntakeStore, DocketMailbox, DocketMessage, DocketParalegal, DocketSecretary, DocketWrittenEntry, makeDocketIntakeLayer, ParalegalDocketEntry, ParalegalRevision, SecretaryReview, }` from `@beep/law-practice-use-cases/DocketIntake`.

- `apps/docket-intake/test/support/Pipeline.ts:44`: `type { DocketCalendarEntry }` from `@beep/law-practice-use-cases/DocketIntake`.

#### practice-claude-mod

- `apps/practice-claude-mod/src/PracticeMod.hooks.ts:45`: `type { Verdict }` from `@beep/law-practice-domain/values`.

- `apps/practice-claude-mod/src/PracticeMod.values.ts:10`: `{ ReviewItemId }` from `@beep/law-practice-domain/values`.

- `apps/practice-claude-mod/src/PracticeMod.verdicts.ts:10`: `{ ReviewBatchId, ReviewItemId, Verdict, VerdictRow }` from `@beep/law-practice-domain/values`.

- `apps/practice-claude-mod/test/PracticeMod.hooks.test.ts:1`: `{ VerdictRow }` from `@beep/law-practice-domain/values`.

- `apps/practice-claude-mod/test/PracticeMod.verdicts.test.ts:1`: `{ VerdictRow }` from `@beep/law-practice-domain/values`.

- `apps/practice-claude-mod/test/PracticeMod.verdicts.test.ts:20`: `type { Verdict }` from `@beep/law-practice-domain/values`.

#### practice-gateway

- `apps/practice-gateway/src/Approvals.ts:11`: `{ Remediation }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/src/Approvals.ts:12`: `{ makeSetupApprovals, RepairDecision, SetupApprovals }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/src/Approvals.ts:22`: `type { SetupRequirement }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/src/PracticeGateway.errors.ts:9`: `{ PracticeProvider }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/src/PracticeKgProvider.ts:22`: `type { PracticeKgToolkitLayer }` from `@beep/law-practice-server`.

- `apps/practice-gateway/src/PracticeKgProvider.ts:23`: `type { loadPracticeKgBundleContext, makePracticeKgHostResourcesLayer, runPracticeKgSelfCheck, }` from `@beep/law-practice-server/PracticeKgHost`.

- `apps/practice-gateway/src/Probes.ts:9`: `{ ProbeBroken, ProbeMissing, ProbeSatisfied, SetupRequirementId }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/src/Probes.ts:10`: `{ SetupProbes, SetupProbesShape, SetupProbeUnavailable, SetupRepairFailed, }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/src/Probes.ts:31`: `type { ProbeResult, SetupRequirement }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/src/ProfileStore.ts:11`: `{ PracticeProfile }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/src/Requirements.ts:10`: `{ AdminRights, AutomaticRemediation, CapabilityChoice, HumanRemediation, Remediation, SetupCapability, SetupProvider, SetupRequirement, SetupRequirementId, }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/src/Requirements.ts:26`: `type { PracticeCapability, PracticeProfile, PracticeProvider }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/src/SelfCheck.ts:10`: `{ SetupReport }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/src/SelfCheck.ts:11`: `{ SetupDoctor }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/src/SelfCheck.ts:23`: `type { SetupGraphInvalid, SetupProbeUnavailable }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/src/Server.ts:10`: `{ SetupDoctor }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/src/SetupTools.ts:10`: `{ CapabilityChoice, ItLimits, PracticeProfile, ProbeResult, Remediation, RequirementCheck, SetupReport, SetupRequirementId, }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/src/SetupTools.ts:20`: `{ RepairRefusal, SetupDoctor }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/src/SetupTools.ts:34`: `type { SetupRequirement }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/src/SetupTools.ts:35`: `type { SetupGraphInvalid, SetupProbeUnavailable, SetupRepairFailed, SetupRepairRefused, }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/src/package.ts:10`: `{ PracticeKgToolkit }` from `@beep/law-practice-server`.

- `apps/practice-gateway/test/Approvals.test.ts:1`: `{ Remediation, SetupRequirement }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/test/Approvals.test.ts:2`: `{ SetupApprovals }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/test/BoxDriveTools.test.ts:1`: `{ CapabilitySupported, PracticeProfile }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/test/LazyPracticeKg.test.ts:1`: `{ ProbeBroken, RequirementCheck }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/test/LazyPracticeKg.test.ts:2`: `{ SetupDoctor }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/test/OnboardingGuide.test.ts:1`: `{ SetupDoctor }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/test/OnboardingSkill.test.ts:1`: `{ PracticeCapability, PracticeProvider }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/test/Probes.test.ts:1`: `{ ProbeMissing, ProbeResult, ProbeSatisfied, SetupRequirement, SetupRequirementId, }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/test/Probes.test.ts:8`: `{ makeSetupApprovals, SetupApprovals, SetupDoctor, SetupProbes, SetupProbeUnavailable, SetupRepairFailed, SetupRepairRefused, }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/test/ProfileStore.test.ts:1`: `{ SetupDoctor }` from `@beep/law-practice-use-cases/PracticeSetup`.

- `apps/practice-gateway/test/Requirements.test.ts:1`: `{ CapabilityDeclined, CapabilitySupported, ItLimits, PracticeProfile, Remediation, SetupRequirementId, }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/test/SetupTools.test.ts:1`: `{ AutomaticRemediation, CapabilityChoice, CheckBlocked, CheckProbed, HumanRemediation, ItLimits, PendingHumanStep, ProbeMissing, ProbeSatisfied, SetupReport, SetupRequirementId, }` from `@beep/law-practice-domain`.

- `apps/practice-gateway/test/fixtures.ts:1`: `{ CapabilityGap, CapabilitySupported, ItLimits, PracticeProfile }` from `@beep/law-practice-domain`.

#### practice-identify

- `apps/practice-identify/src/PracticeIdentify.config.ts:11`: `type { IdentificationError }` from `@beep/law-practice-use-cases/DocumentIdentification`.

- `apps/practice-identify/src/runtime/Layer.ts:6`: `{ ContactCardSourceFile, ContactFilesConfig, ContactFilesLocation, DocumentExtractionSourceFile, ExtractionBatchesConfig, ExtractionBatchesLocation, UsptoRecordLookupLive, }` from `@beep/law-practice-server/DocumentIdentification`.

- `apps/practice-identify/src/runtime/Layer.ts:15`: `{ buildClientDocketPairs, buildClientIndex, Contact, ContactCardSource, ContactProjection, DocumentExtractionSource, EvaluationReport, evaluateHoldOut, fitTokenFilter, IdentificationDocument, IdentificationError, IdentificationIndex, IndexEvidence, linkContacts, normaliseContacts, projectContacts, ResolutionRecord, ResolverContext, resolve, TrainingDocument, UsptoLookupResult, UsptoQuery, UsptoRecordLookup, }` from `@beep/law-practice-use-cases/DocumentIdentification`.

- `apps/practice-identify/test/PracticeIdentify.runtime.test.ts:1`: `* as I` from `@beep/law-practice-use-cases/DocumentIdentification`.

#### practice-kg-mcp

- `apps/practice-kg-mcp/src/bin.ts:12`: `{ loadPracticeKgBundleContext, PracticeKgHostError }` from `@beep/law-practice-server/PracticeKgHost`.

- `apps/practice-kg-mcp/src/build.ts:9`: `{ buildPracticeKgBundle, PracticeKgOptions, PracticeKgRunLabel }` from `@beep/law-practice-server`.

- `apps/practice-kg-mcp/src/claims.ts:11`: `{ LawPracticeServerLive, PracticeKgClaimsCarryWrite, PracticeKgClaimsOptions, readPracticeKgClaimsCarry, runPracticeKgClaimsBatch, writePracticeKgClaimsCarry, }` from `@beep/law-practice-server`.

- `apps/practice-kg-mcp/src/claims.ts:19`: `{ makePracticeKgPgliteLayer }` from `@beep/law-practice-server/PracticeKgHost`.

- `apps/practice-kg-mcp/src/package.ts:10`: `{ PracticeKgToolkit }` from `@beep/law-practice-server`.

- `apps/practice-kg-mcp/src/runtime/Host.ts:8`: `{ makePracticeKgServerLayer, PracticeKgMcpServerConfig }` from `@beep/law-practice-server`.

- `apps/practice-kg-mcp/src/runtime/Host.ts:9`: `{ makePracticeKgHostResourcesLayer }` from `@beep/law-practice-server/PracticeKgHost`.

- `apps/practice-kg-mcp/src/runtime/Host.ts:13`: `type { PracticeKgBundleContext }` from `@beep/law-practice-server`.

- `apps/practice-kg-mcp/src/runtime/Layer.ts:8`: `{ PracticeKgProjectionsLive }` from `@beep/law-practice-server`.

- `apps/practice-kg-mcp/src/runtime/Layer.ts:9`: `{ makePracticeKgPgliteLayer }` from `@beep/law-practice-server/PracticeKgHost`.

- `apps/practice-kg-mcp/src/runtime/SelfCheck.ts:9`: `{ makePracticeKgSelfCheckRefusal, PracticeKgSelfCheckRefusal, PracticeKgSelfCheckReport, runPracticeKgSelfCheck, }` from `@beep/law-practice-server/PracticeKgHost`.

- `apps/practice-kg-mcp/src/runtime/SelfCheck.ts:21`: `type { PracticeKgHostError }` from `@beep/law-practice-server/PracticeKgHost`.

- `apps/practice-kg-mcp/src/smoke.ts:12`: `{ buildPracticeKgBundle, PracticeKgOptions, PracticeKgToolkit }` from `@beep/law-practice-server`.

- `apps/practice-kg-mcp/src/smoke.ts:13`: `{ loadPracticeKgBundleContext, PracticeKgSelfCheckReport }` from `@beep/law-practice-server/PracticeKgHost`.

- `apps/practice-kg-mcp/src/verify.ts:12`: `{ diffPracticeKgMatterTables, PracticeKgMatterTablesComparison, PracticeKgProjectionError, readPracticeKgMatterTables, verifyPracticeKgBundle, }` from `@beep/law-practice-server`.

- `apps/practice-kg-mcp/src/verify.ts:19`: `{ makePracticeKgPgliteLayer }` from `@beep/law-practice-server/PracticeKgHost`.

- `apps/practice-kg-mcp/src/verify.ts:29`: `type { PracticeKgMatterTables }` from `@beep/law-practice-server`.

- `apps/practice-kg-mcp/test/Host.test.ts:3`: `{ PracticeKgBundle, PracticeKgBundleManifest, PracticeKgCounts, PracticeKgFailureReasonKey, PracticeKgSchemaVersions, PracticeKgSourceRuns, PracticeKgToolFailureReason, PracticeKgToolkit, }` from `@beep/law-practice-server`.

- `apps/practice-kg-mcp/test/Host.test.ts:13`: `{ loadPracticeKgBundleContext, PracticeKgHostError, PracticeKgSelfCheckRefusal, PracticeKgSelfCheckReport, }` from `@beep/law-practice-server/PracticeKgHost`.

- `apps/practice-kg-mcp/test/StrictTier.toolkit.test.ts:1`: `{ PracticeKgFailureReasonKey, PracticeKgToolFailureReason, PracticeKgToolkit }` from `@beep/law-practice-server`.

#### practice-m365-contacts

- `apps/practice-m365-contacts/src/Contacts.plan.ts:12`: `type { Contact }` from `@beep/law-practice-use-cases/DocumentIdentification`.

- `apps/practice-m365-contacts/src/Contacts.schemas.ts:7`: `{ Contact }` from `@beep/law-practice-use-cases/DocumentIdentification`.

- `apps/practice-m365-contacts/src/Contacts.service.ts:32`: `type { Contact }` from `@beep/law-practice-use-cases/DocumentIdentification`.

- `apps/practice-m365-contacts/src/Contacts.source.ts:6`: `{ parseOutlookCsv, parseVcards }` from `@beep/law-practice-server/DocumentIdentification`.

- `apps/practice-m365-contacts/src/Contacts.source.ts:7`: `{ normaliseContacts }` from `@beep/law-practice-use-cases/DocumentIdentification`.

- `apps/practice-m365-contacts/test/Contacts.test.ts:1`: `{ normaliseContacts, RawContactCard }` from `@beep/law-practice-use-cases/DocumentIdentification`.

- `apps/practice-m365-contacts/test/Contacts.test.ts:32`: `type { Contact }` from `@beep/law-practice-use-cases/DocumentIdentification`.

#### practice-mail-tagging

- `apps/practice-mail-tagging/src/PracticeMailTagging.command.ts:9`: `{ TaggingRunId }` from `@beep/law-practice-domain/values/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.command.ts:10`: `{ RunMailTaggingRequest, UndoMailTaggingRequest }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.command.ts:29`: `type { TaggingMode, TaggingRunReport }` from `@beep/law-practice-domain/values/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.command.ts:30`: `type { BackfillCheckpointStore, FilingLedger, TagLedger }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.config.ts:10`: `{ MatterContactEvidence }` from `@beep/law-practice-server/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.errors.ts:9`: `{ MailTaggingPortFailure }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.errors.ts:16`: `type { MailTaggingPortError, MailTaggingStateError }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.passes.ts:10`: `{ TaggingRunId }` from `@beep/law-practice-domain/values/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.passes.ts:11`: `{ MailTaggingJob, MailTaggingUndo, RunMailTaggingRequest, UndoMailTaggingRequest, }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.passes.ts:26`: `type { TaggingRunReport, TaggingUndoReport }` from `@beep/law-practice-domain/values/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.report.ts:10`: `{ FilingLedgerRecord, TaggingRunReport, TaggingUndoReport, TagLedgerRecord, }` from `@beep/law-practice-domain/values/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.report.ts:16`: `{ activeTagEntries, BackfillCheckpointStore, completedFilings, FilingLedger, pendingFilingIntents, TagLedger, }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.report.ts:34`: `type { MailTaggingStateError }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/src/runtime/Layer.ts:12`: `{ MailTaggingServiceConfig, MailTaggingServiceLive, MailTaggingStateConfig, MailTaggingStateFile, MailTaggingStateLocation, mailTaggingServiceConfigLayer, }` from `@beep/law-practice-server/MailTagging`.

- `apps/practice-mail-tagging/src/runtime/Layer.ts:35`: `type { TaggingRunId }` from `@beep/law-practice-domain/values/MailTagging`.

- `apps/practice-mail-tagging/src/runtime/Layer.ts:36`: `type { BackfillCheckpointStore, FilingLedger, TagLedger }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/test/PracticeMailTagging.command.test.ts:6`: `{ TaggingRunReport, TaggingUndoReport }` from `@beep/law-practice-domain/values/MailTagging`.

- `apps/practice-mail-tagging/test/PracticeMailTagging.command.test.ts:7`: `{ MailTaggingPortError }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/test/PracticeMailTagging.errors.test.ts:6`: `{ MailTaggingPortError, MailTaggingStateError }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/test/PracticeMailTagging.fixture.ts:8`: `{ emptyTaggingRunReport, MailEnvelope, MailMessageId, MatterIndex, }` from `@beep/law-practice-domain/values/MailTagging`.

- `apps/practice-mail-tagging/test/PracticeMailTagging.fixture.ts:14`: `{ MailTaggingJobLive, MailTaggingStateConfig, MailTaggingStateFile, MailTaggingStateLocation, MailTaggingUndoLive, }` from `@beep/law-practice-server/MailTagging`.

- `apps/practice-mail-tagging/test/PracticeMailTagging.fixture.ts:21`: `{ AttachmentFiler, AttachmentFilerShape, Mailbox, MailboxShape, MailPage, MailTaggingPortError, MatterDirectory, MatterDirectoryShape, }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/test/PracticeMailTagging.lock.test.ts:7`: `{ MailTaggingPortError }` from `@beep/law-practice-use-cases/MailTagging`.

- `apps/practice-mail-tagging/test/runtime.Layer.test.ts:9`: `{ TaggingRunId }` from `@beep/law-practice-domain/values/MailTagging`.

- `apps/practice-mail-tagging/test/runtime.Layer.test.ts:10`: `{ RunMailTaggingRequest, TagLedger }` from `@beep/law-practice-use-cases/MailTagging`.

#### practice-review-hub

- `apps/practice-review-hub/src/Config.ts:9`: `{ NoticeClaudeFolder }` from `@beep/law-practice-server/NoticeMailbox`.

- `apps/practice-review-hub/src/Notice.ts:9`: `{ ReviewItem }` from `@beep/law-practice-domain`.

- `apps/practice-review-hub/src/Notice.ts:10`: `{ docketDayInZone }` from `@beep/law-practice-server/DocketIntake`.

- `apps/practice-review-hub/src/Notice.ts:11`: `{ makeNoticeMailboxLayer, NoticeClaudeLink, NoticeMailboxConfig }` from `@beep/law-practice-server/NoticeMailbox`.

- `apps/practice-review-hub/src/Notice.ts:12`: `{ makeReviewFilesLayer, ReviewFilesConfig }` from `@beep/law-practice-server/ReviewFiles`.

- `apps/practice-review-hub/src/Notice.ts:13`: `{ DailyNotice, DailyNoticeLive, DailyNoticeOutcome }` from `@beep/law-practice-use-cases/DailyNotice`.

- `apps/practice-review-hub/src/Notice.ts:14`: `{ DigestSelection, QuestionQueue, QuestionQueueLive }` from `@beep/law-practice-use-cases/QuestionQueue`.

- `apps/practice-review-hub/src/Notice.ts:15`: `{ ReviewItemStore }` from `@beep/law-practice-use-cases/ReviewItemStore`.

- `apps/practice-review-hub/src/Notice.ts:23`: `type { NoticeClaudeFolder }` from `@beep/law-practice-server/NoticeMailbox`.

- `apps/practice-review-hub/src/runtime/Layer.ts:9`: `{ makeReviewFilesLayer, ReviewFilesConfig }` from `@beep/law-practice-server/ReviewFiles`.

- `apps/practice-review-hub/src/runtime/Layer.ts:10`: `{ QuestionQueueLive }` from `@beep/law-practice-use-cases/QuestionQueue`.

- `apps/practice-review-hub/src/runtime/Layer.ts:11`: `{ ReviewHub, ReviewHubLive, ReviewHubToolkit }` from `@beep/law-practice-use-cases/ReviewHub`.

- `apps/practice-review-hub/src/runtime/Layer.ts:12`: `{ ReviewQueueLive }` from `@beep/law-practice-use-cases/ReviewQueue`.

- `apps/practice-review-hub/test/Hub.test.ts:7`: `{ QuestionOption }` from `@beep/law-practice-domain/values/Question`.

- `apps/practice-review-hub/test/Hub.test.ts:8`: `{ ReviewItem }` from `@beep/law-practice-domain/values/ReviewItem`.

- `apps/practice-review-hub/test/Hub.test.ts:9`: `{ makeReviewFilesLayer, ReviewFilesConfig }` from `@beep/law-practice-server/ReviewFiles`.

- `apps/practice-review-hub/test/Hub.test.ts:10`: `{ OpenItems, ReviewHubToolError }` from `@beep/law-practice-use-cases/ReviewHub`.

- `apps/practice-review-hub/test/Hub.test.ts:11`: `{ ReviewItemStore }` from `@beep/law-practice-use-cases/ReviewItemStore`.

- `apps/practice-review-hub/test/Notice.test.ts:7`: `{ QuestionOption }` from `@beep/law-practice-domain/values/Question`.

- `apps/practice-review-hub/test/Notice.test.ts:8`: `{ ReviewItem }` from `@beep/law-practice-domain/values/ReviewItem`.

- `apps/practice-review-hub/test/Notice.test.ts:9`: `{ NoticeClaudeFolder }` from `@beep/law-practice-server/NoticeMailbox`.

- `apps/practice-review-hub/test/Notice.test.ts:10`: `{ QuestionQueue, RecordAnswerInput }` from `@beep/law-practice-use-cases/QuestionQueue`.

- `apps/practice-review-hub/test/Notice.test.ts:11`: `{ ReviewItemStore }` from `@beep/law-practice-use-cases/ReviewItemStore`.

## 2. Legal vocabulary as schemas

### Principal concepts and standards grounding

All listed `ProductEntity` models also carry the shared identity/audit envelope. The spike helper enumerates the required id, organization, public id, source, version, timestamp and principal fields (`packages/law-practice/use-cases/src/internal/spikeEntity.ts:108`). Entity-specific fields below are additional fields.

| Concept | Current shape and definition | Grounding assessment |
| --- | --- | --- |
| Legal party | `LegalPartyReference`: displayName, PartyKind, reference, PartyId. `PartyReference`: kind/key. `PartyKind`: natural-person / juristic-person; PartyLikeKind: legal_client / legal_contact | Repo-defined adapters to existing records, not an imported LKIF/AKN party class. `packages/law-practice/domain/src/entities/LegalPartyReference/LegalPartyReference.model.ts:54`; `packages/law-practice/domain/src/entities/LegalPartyReference/LegalPartyReference.values.ts:15`; `packages/law-practice/domain/src/values/PartyKind/PartyKind.model.ts:12` |
| Client/contact | LegalClient(displayName, fixtureKey, status=active_client); LegalContact(displayName, fixtureKey, legalClientFixtureKey, role=founder) | Explicit proof-fixture vocabulary. `packages/law-practice/domain/src/entities/LegalClient/LegalClient.model.ts:48`; `packages/law-practice/domain/src/entities/LegalClient/LegalClient.values.ts:12`; `packages/law-practice/domain/src/entities/LegalContact/LegalContact.model.ts:49`; `packages/law-practice/domain/src/entities/LegalContact/LegalContact.values.ts:12` |
| Legal role | name, player:PartyId, admittedPlayerKinds, sourceNorm | Norm-prescribed role recorded in a relator, not proof that the player is admitted/authorized. `packages/law-practice/domain/src/values/LegalRole/LegalRole.model.ts:85`, `packages/law-practice/domain/src/values/LegalRole/LegalRole.model.ts:110` |
| Matter | displayName, fixtureKey, legalClientFixtureKey, matterType=patent_application | Repo-defined prosecution entity. `packages/law-practice/domain/src/entities/Matter/Matter.model.ts:49`; `packages/law-practice/domain/src/entities/Matter/Matter.values.ts:12` |
| KG matter lookup | MatterUnique(applications, client?, clientName?, dockets, familyKey, matchedDockets, patents, verified); Ambiguous(familyKeys), Suggested(familyKeys), NotFound variants | Distinct record family from Matter entity, grounded in catalog/register membership rather than an external legal ontology. `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:414`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:516` |
| Patent asset / office action | PatentAsset(fixtureKey, matterFixtureKey, status=pre_filing, title); OfficeAction(applicationNumber, fixtureKey, matterFixtureKey, patentAssetFixtureKey) | Repo proof entities; OfficeAction describes itself as USPTO. `packages/law-practice/domain/src/entities/PatentAsset/PatentAsset.model.ts:49`; `packages/law-practice/domain/src/entities/PatentAsset/PatentAsset.values.ts:12`; `packages/law-practice/domain/src/entities/OfficeAction/OfficeAction.model.ts:53` |
| Filing and docket | No general Filing or DocketEvent domain entity was found in the law domain model inventory. Filing-specific concepts include CitingApplicationIdentity, IdsSubmissionFact and PatentCitationEvent; docket appears as KG node kinds, lookup strings, tracked-date rows and calendar entries | Absence is a scoped source-search result, not a repository-wide proof of nonexistence. Positive sites: `packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:39`; `packages/law-practice/domain/src/entities/IdsSubmissionFact/IdsSubmissionFact.model.ts:68`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:644` |
| Deadline | DocketResponsePeriod(amount, unit:days/months), DocketDueDate(basis, computed?, date, stated?), candidates(stated?, computed?), reminder rungs(date,daysBefore), ladder(rungs,truncated) | Repo date policy. Basis literals stated/computed/agreed/earlier-of-differing. No general jurisdictional rules engine is encoded by these shapes. `packages/law-practice/domain/src/values/DocketDeadline/DocketDeadline.model.ts:53`, `packages/law-practice/domain/src/values/DocketDeadline/DocketDeadline.model.ts:92`, `packages/law-practice/domain/src/values/DocketDeadline/DocketDeadline.model.ts:160`, `packages/law-practice/domain/src/values/DocketDeadline/DocketDeadline.model.ts:205`, `packages/law-practice/domain/src/values/DocketDeadline/DocketDeadline.model.ts:234`, `packages/law-practice/domain/src/values/DocketDeadline/DocketDeadline.model.ts:350`, `packages/law-practice/domain/src/values/DocketDeadline/DocketDeadline.model.ts:380` |
| Calendar event | DocketCalendarEntry(bodyText,category,date,key,kind,subject,tentative), DocketWrittenEntry(eventId,webLink?); kind due/reminder/needs-review/digest; categories unverified/needs review/reminder/digest/verified/entered | Outlook integration vocabulary minted locally. `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:599`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:644`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:672`; `packages/law-practice/domain/src/values/DocketDeadline/DocketDeadline.model.ts:462` |
| Persisted patent Claim | claimNumber, fixtureKey, independent:boolean, patentAssetFixtureKey, text | Coarse repo prosecution entity. `packages/law-practice/domain/src/entities/Claim/Claim.model.ts:55` |
| Structured PatentClaim | Independent/dependent tagged union; claimNumber, claimText, preamble?, transition?, body; dependent has nonempty claimReferences; collection checks consecutive numbering, existing earlier parents and acyclicity | Explicit alignment to WIPO ST.96 ClaimNumber/ClaimText/ClaimReference; USPTO MPEP and EPO guidelines linked. `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:116`, `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:162`, `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:168`, `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:435` |
| Application document | ordered sections(role,heading,content,sourceStart,sourceEnd), normalized sourceText and structured claims | Section order explicitly tied to 37 CFR 1.77(b). `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:38`, `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:43`, `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:474`, `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:595`, `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:667` |
| Claim elements | ClaimElement trees/edges, clause roles, lexical evidence, antecedent findings, input/inspection records and source plans | Law-owned deterministic interpretation layer, not an NLP Entity alias. Full symbol/field index follows. `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.model.ts:1`; `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimSelfCheck.service.ts:45` |
| Legal claim/right | HohfeldPosition(content,kind), eight kinds claim/duty/privilege/noRight/power/liability/immunity/disability; LegalPositionRelator(assertingInterpreter,bearer,counterparty,content,grounding,positionKind,scope,sourceNorm) | Hohfeldian and explicit interpretation. This “claim” is a right against a counterparty, not a patent claim or an epistemic assertion. `packages/law-practice/domain/src/values/HohfeldPositionKind/HohfeldPositionKind.model.ts:13`; `packages/law-practice/domain/src/values/HohfeldPosition/HohfeldPosition.model.ts:81`; `packages/law-practice/domain/src/entities/LegalPositionRelator/LegalPositionRelator.model.ts:74` |
| Norm reference | SourceNormRef(designation verbatim, unparsed); NormSourceReference(norm,fragment?) | FLINT donor acknowledged for interpretation grounding; no norm lookup/validity authority follows from text. `packages/law-practice/domain/src/values/SourceNormRef/SourceNormRef.model.ts:26`, `packages/law-practice/domain/src/values/SourceNormRef/SourceNormRef.model.ts:78`; `packages/law-practice/domain/src/values/NormSourceReference/NormSourceReference.model.ts:10`, `packages/law-practice/domain/src/values/NormSourceReference/NormSourceReference.model.ts:106` |
| Inventor/applicant/assignee | PatentAssignee(name,location?); metadata inventors?:NonEmptyString[]; UsptoRecordFacts also has firstApplicant?:NonEmptyString; Applicant is an actor label in PatentCitationActor(Examiner/Applicant/ThirdParty), not a distinct Applicant party entity | ST-number identity fields coexist with string-valued person names. `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:156`, `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:298`, `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:313`; `packages/law-practice/use-cases/src/DocumentIdentification/Identification.schemas.ts:924`; `packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.values.ts:14` |
| Classification | PatentClassifications(ipc:NonEmptyString[],cpc:NonEmptyString[]) defaults both empty; optional IPC/CPC arrays also in PatentMetadata | Classification systems are named but symbols are unversioned strings, not validated taxonomy entities. No Nice/Locarno schema was found in the law-domain inventory. `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:321`, `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:329`, `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:668` |
| Jurisdiction / office | OfficeCode full ST.3 domain including XX; PatentOfficeCode narrowed to US/EP/WO; PatentOffice.Metadata is an empty struct; LegalScopeContext territorial is one of five recorded axes alongside material/subjective/temporal/quantitative | ST.3 grounding is explicit for OfficeCode, while territorial scope is recorded text. PatentOffice comment mentions ST.16/logo/flag metadata but has no fields. `packages/law-practice/domain/src/values/OfficeCode/OfficeCode.model.ts:19`, `packages/law-practice/domain/src/values/OfficeCode/OfficeCode.model.ts:38`; `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:360`; `packages/law-practice/domain/src/values/PatentOffice/PatentOffice.model.ts:15`, `packages/law-practice/domain/src/values/PatentOffice/PatentOffice.model.ts:31`; `packages/law-practice/domain/src/values/LegalScopeContext/LegalScopeContext.model.ts:104` |
| Court / case | CourtId preserves pinned courts-db identifiers; known/unmapped CitationCourt variants; case citation metadata includes optional plaintiff, defendant, caseName, court and date-related fields | Free Law Project courts/reporters vocabulary, not a general litigation Case entity. `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.model.ts:16`; `packages/law-practice/domain/src/values/Citation/Citation.case.ts:29`, `packages/law-practice/domain/src/values/Citation/Citation.case.ts:51`, `packages/law-practice/domain/src/values/Citation/Citation.case.ts:159` |
| Citation/authority | Citation tagged forms case, shortFormCase, id, supra, reference, unknown, law, journal; FullCitation/ShortFormCitation unions. CitationAuthority(id,representative?); CitationDocument(source,engineArtifact,authorities,resolutions,groups,memberLists,detachedCitations,mentions) | Adapted eyecite 2.7.6 canonical primitives. Structured Bluebook view supports a declared U.S. Reports profile, not all of Bluebook. `packages/law-practice/domain/src/values/Citation/Citation.resource.ts:2`; `packages/law-practice/domain/src/values/Citation/Citation.models.ts:31`; `packages/law-practice/domain/src/values/Citation/Citation.bluebook.ts:2`; `packages/law-practice/domain/src/values/Citation/Citation.document.ts:41` |
| Citation occurrence/evidence | CitationMention(id,citation,engineArtifact,signal?,warnings,evidenceConfidence?,anchor:VerifiedTextAnchor,component anchors,footnote?); serializable receipt substitutes verification receipts and a schemaVersion | Occurrence and resource identity are intentionally separated; source proof is reused from provenance. `packages/law-practice/domain/src/values/Citation/Citation.mention.ts:150`, `packages/law-practice/domain/src/values/Citation/Citation.mention.ts:168`; `packages/law-practice/domain/src/values/Citation/Citation.identity.ts:35`, `packages/law-practice/domain/src/values/Citation/Citation.identity.ts:73` |
| Patent-reference event and candor | PatentCitationEvent(actor,citingApplication,discovery,grounding,observedAt,possibleDuplicateOf?,quarantine?,reference,supersedes?); CandorDisposition(citingApplication,decidedAt,disposes,lifecycle,litigationFrameJudgment?,rule56Judgment?,supersedes?) | Source/version-bound observations and attorney judgment remain separate. Duty-of-candor motivation is explicit in the goal; no automated legal materiality judgment is implied. `packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.model.ts:70`; `packages/law-practice/domain/src/entities/CandorDisposition/CandorDisposition.model.ts:63`; `goals/patent-citation-candor-gate/README.md:11` |

No Akoma Ntoso, LKIF or LegalRuleML grounding import/comment was found in the scanned law-domain sources. The appendix records actual grounding comments and URLs; similarity to those standards should not be asserted from names alone. ST.96 alignment is explicit and local to the patent-document model; it is not evidence that every law entity conforms to ST.96.

### Expanded schema index

_Elided in the repository copy: 3,700 `path:line` schema excerpts (lines 435-8240 of the original) that reproduce source already in the tree. The full report stays in the OpenResearch artifacts directory (`text-knowledge-rebuild/research/reader-a-law-practice.md`)._

## 3. Consumption of foundation modeling

### What is directly consumed

The exhaustive import inventory below scans actual import declarations, removes block comments (so documentation examples are not counted), includes tests/config and source, and retains file/line, module subpath and imported symbols. Type-only imports remain visible. The app set is discovered from direct imports of the four law-practice package names. This is direct consumption; transitive use through shared-domain, epistemic-domain, party or another package is not mistaken for a direct foundation import.

The principal semantic dependency is provenance, especially `TextAnchor`, `SourceTextIdentity`, `VerifiedSourceText`, `VerifiedTextAnchor`, their verification functions and receipt schemas (`packages/law-practice/domain/src/values/Citation/Citation.mention.ts:7`; `packages/law-practice/server/src/internal/Citation/CanonicalSource.ts:11`; `packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.service.ts:16`). LangExtract supplies aligned extractions and extraction request/target contracts (`packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:22`; `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:21`).

Direct `@beep/nlp` production use is a `DocumentId` in the office-action request (`packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:23`). `@beep/nlp-processing` provides `Tokenization` and `TokenizationError` for claim inspection (`packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimInspection.lexical.ts:21`). Direct `@beep/epistemics` use supplies disposition and gate-violation vocabulary to the verdict projector (`packages/law-practice/use-cases/src/VerdictProjector/VerdictProjector.schemas.ts:9`). The office-action path instead uses the separate product `@beep/epistemic-*` slice (`packages/law-practice/use-cases/package.json:73`; `packages/law-practice/server/package.json:74`).

No direct `@beep/rdf` or `@beep/ontology` import was found in this law-practice/app scan. Inference: the practice KG is currently a locally typed relational graph projection, not an RDF-native product model merely because it has IRI-named fields. Its SQL node/edge tables and schema strings are positive evidence (`packages/law-practice/server/src/PracticeKg.schemas.ts:329`; `packages/law-practice/server/src/PracticeKg.projections.ts:245`). Identity is extensively used for package-scoped annotation/service identities; that must not be read as every business identifier being an identity-composer IRI. The graph builder does use the identity composer for graph IRIs (`packages/law-practice/server/src/PracticeKg.projections.ts:285`).

### Locally defined equivalents and adapters

- `SourceRef(boxFileId,page?,quote,crop?)` and `TextQuote` are a Box/page review citation model, distinct from an exact text manifestation proof (`packages/law-practice/domain/src/values/SourceRef/SourceRef.model.ts:226`; `packages/law-practice/domain/src/values/SourceRef/TextQuote.model.ts:39`).
- Docket `citedText`, source document bytes/text, `ReviewSourceText`, deterministic checks and `ReviewEvidence` re-declare a workflow-specific evidence protocol with no source digests or verified offset capabilities in those shapes (`packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:167`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:219`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:294`; `packages/law-practice/use-cases/src/DocketIntake/DocketReview.schemas.ts:365`, `packages/law-practice/use-cases/src/DocketIntake/DocketReview.schemas.ts:391`).
- `SourceQuote` is a local tuple `[startChar,quote]`; candidate evidence conversion fixes confidence to 1 (`packages/law-practice/use-cases/src/internal/claimEvidence.ts:41`, `packages/law-practice/use-cases/src/internal/claimEvidence.ts:262`, `packages/law-practice/use-cases/src/internal/claimEvidence.ts:277`). Office-action conversion fixes it to 0.9 (`packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:90`).
- KG node/edge kinds, provenance kinds, provenanceRef and epistemic status are locally closed literals/strings (`packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:39`; `packages/law-practice/domain/src/values/KgEdgePredicate/KgEdgePredicate.model.ts:43`; `packages/law-practice/domain/src/values/PracticeKgProvenanceKind/PracticeKgProvenanceKind.model.ts:42`; `packages/law-practice/domain/src/values/PracticeKgEpistemicStatus/PracticeKgEpistemicStatus.model.ts:42`; `packages/law-practice/server/src/PracticeKg.schemas.ts:379`).
- Applicant/examiner/third-party are source-attributed citation actors, whereas extractor/critic are review sides, runtime `SystemPrincipal` is an audit principal and `LegalRole.player` is a PartyId. These are different actor meanings rather than interchangeable agents (`packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.values.ts:14`; `packages/law-practice/use-cases/src/DocketIntake/DocketReview.schemas.ts:179`; `packages/law-practice/use-cases/src/internal/spikeEntity.ts:32`; `packages/law-practice/domain/src/values/LegalRole/LegalRole.model.ts:118`).

### Exhaustive direct-import appendix

#### @beep/identity (546 direct import declarations)

- `apps/docket-intake/src/Backfill.ts:10`: `{ $DocketIntakeId }` from `@beep/identity/packages`.

- `apps/docket-intake/src/Config.ts:8`: `{ $DocketIntakeId }` from `@beep/identity/packages`.

- `apps/docket-intake/src/Cycle.ts:8`: `{ $DocketIntakeId }` from `@beep/identity/packages`.

- `apps/docket-intake/src/Digest.ts:8`: `{ $DocketIntakeId }` from `@beep/identity/packages`.

- `apps/docket-intake/src/DryRun.ts:10`: `{ $DocketIntakeId }` from `@beep/identity/packages`.

- `apps/docket-intake/src/Errors.ts:8`: `{ $DocketIntakeId }` from `@beep/identity/packages`.

- `apps/docket-intake/src/Questions.ts:10`: `{ $DocketIntakeId }` from `@beep/identity/packages`.

- `apps/docket-intake/src/Smoke.ts:9`: `{ $DocketIntakeId }` from `@beep/identity/packages`.

- `apps/docket-intake/src/Undo.ts:9`: `{ $DocketIntakeId }` from `@beep/identity/packages`.

- `apps/practice-claude-mod/src/PracticeMod.host.ts:9`: `{ $PracticeClaudeModId }` from `@beep/identity/packages`.

- `apps/practice-claude-mod/src/PracticeMod.matters.ts:6`: `{ $PracticeClaudeModId }` from `@beep/identity/packages`.

- `apps/practice-claude-mod/src/PracticeMod.phrases.ts:9`: `{ $PracticeClaudeModId }` from `@beep/identity/packages`.

- `apps/practice-claude-mod/src/PracticeMod.timers.ts:6`: `{ $PracticeClaudeModId }` from `@beep/identity/packages`.

- `apps/practice-claude-mod/src/PracticeMod.values.ts:9`: `{ $PracticeClaudeModId }` from `@beep/identity/packages`.

- `apps/practice-claude-mod/src/PracticeMod.verdicts.ts:9`: `{ $PracticeClaudeModId }` from `@beep/identity/packages`.

- `apps/practice-claude-mod/src/build-plugin.ts:11`: `{ $PracticeClaudeModId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/Approvals.ts:10`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/BoxDriveTools.ts:19`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/GatewaySettings.ts:10`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/M365SignIn.ts:10`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/OnboardingGuide.ts:10`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/PracticeGateway.errors.ts:8`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/PracticeKgProvider.ts:11`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/ProfileStore.ts:10`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/Requirements.ts:9`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/SelfCheck.ts:9`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/SetupTools.ts:9`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/SystemBrowser.ts:8`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-gateway/src/WindowsHost.ts:10`: `{ $PracticeGatewayId }` from `@beep/identity/packages`.

- `apps/practice-identify/src/PracticeIdentify.config.ts:6`: `{ $PracticeIdentifyId }` from `@beep/identity/packages`.

- `apps/practice-kg-mcp/src/PracticeKgMcp.errors.ts:8`: `{ $PracticeKgMcpId }` from `@beep/identity/packages`.

- `apps/practice-kg-mcp/src/runtime/PrivacyReceipt.ts:19`: `{ $PracticeKgMcpId }` from `@beep/identity/packages`.

- `apps/practice-kg-mcp/src/runtime/ProcessMetrics.ts:15`: `{ $PracticeKgMcpId }` from `@beep/identity/packages`.

- `apps/practice-kg-mcp/src/runtime/TelemetryCheck.ts:10`: `{ $PracticeKgMcpId }` from `@beep/identity/packages`.

- `apps/practice-kg-mcp/src/runtime/TelemetryKey.ts:19`: `{ $PracticeKgMcpId }` from `@beep/identity/packages`.

- `apps/practice-kg-mcp/src/smoke.ts:11`: `{ $PracticeKgMcpId }` from `@beep/identity/packages`.

- `apps/practice-kg-mcp/src/telemetry/PracticeKgTelemetry.instruments.ts:18`: `{ $PracticeKgMcpId }` from `@beep/identity/packages`.

- `apps/practice-kg-mcp/test/Host.test.ts:2`: `{ $PracticeKgMcpId }` from `@beep/identity/packages`.

- `apps/practice-m365-contacts/src/Contacts.mailbox.ts:5`: `{ $PracticeM365ContactsId }` from `@beep/identity/packages`.

- `apps/practice-m365-contacts/src/Contacts.schemas.ts:6`: `{ $PracticeM365ContactsId }` from `@beep/identity/packages`.

- `apps/practice-m365-contacts/src/Contacts.service.ts:5`: `{ $PracticeM365ContactsId }` from `@beep/identity/packages`.

- `apps/practice-m365-contacts/src/Contacts.source.ts:5`: `{ $PracticeM365ContactsId }` from `@beep/identity/packages`.

- `apps/practice-m365-contacts/src/Contacts.state.ts:5`: `{ $PracticeM365ContactsId }` from `@beep/identity/packages`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.config.ts:9`: `{ $PracticeMailTaggingId }` from `@beep/identity/packages`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.errors.ts:8`: `{ $PracticeMailTaggingId }` from `@beep/identity/packages`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.lock.ts:8`: `{ $PracticeMailTaggingId }` from `@beep/identity/packages`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.passes.ts:9`: `{ $PracticeMailTaggingId }` from `@beep/identity/packages`.

- `apps/practice-mail-tagging/src/PracticeMailTagging.report.ts:9`: `{ $PracticeMailTaggingId }` from `@beep/identity/packages`.

- `apps/practice-mail-tagging/test/PracticeMailTagging.fixture.ts:7`: `{ $PracticeMailTaggingId }` from `@beep/identity/packages`.

- `apps/practice-review-hub/src/Config.ts:8`: `{ $PracticeReviewHubId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/ActFrame/ActFrame.model.ts:23`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/ActFrame/ActFrame.values.ts:25`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/CandorDisposition/CandorDisposition.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/CandorDisposition/CandorDisposition.values.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/Claim/Claim.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/CorrectionDelta/CorrectionDelta.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/CorrectionDelta/CorrectionDelta.values.ts:20`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/Distinction/Distinction.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/Distinction/Distinction.values.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/IdsSubmissionFact/IdsSubmissionFact.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/IdsSubmissionFact/IdsSubmissionFact.values.ts:13`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/LawPracticeEntity.fields.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/LegalClient/LegalClient.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/LegalClient/LegalClient.values.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/LegalContact/LegalContact.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/LegalContact/LegalContact.values.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/LegalOppositionCandidate/LegalOppositionCandidate.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/LegalOppositionCandidate/LegalOppositionCandidate.values.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/LegalPartyReference/LegalPartyReference.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/LegalPartyReference/LegalPartyReference.values.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/LegalPositionRelator/LegalPositionRelator.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/LegalPositionRelator/LegalPositionRelator.values.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/Matter/Matter.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/Matter/Matter.values.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/OfficeAction/OfficeAction.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/PatentAsset/PatentAsset.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/PatentAsset/PatentAsset.values.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.values.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/PowerExercise/PowerExercise.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/PowerExercise/PowerExercise.values.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/Rejection/Rejection.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/entities/Rejection/Rejection.values.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/internal/PosInt.ts:16`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ActFrameElementRef/ActFrameElementRef.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/AnswerRow/AnswerRow.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ApplicationNumber/ApplicationNumber.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/CalendarDate/CalendarDate.model.ts:18`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Citation/Citation.bluebook.ts:13`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Citation/Citation.case.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Citation/Citation.document.ts:6`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Citation/Citation.identity.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Citation/Citation.journal.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Citation/Citation.law.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Citation/Citation.membership.ts:6`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Citation/Citation.mention.ts:6`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Citation/Citation.models.ts:6`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Citation/Citation.resolution.ts:6`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Citation/Citation.resource.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/CitationSignal/CitationSignal.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity`.

- `packages/law-practice/domain/src/values/CitingApplicationIdentity/CitingApplicationIdentity.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ClaimElement/AntecedentFinding.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimClauseRole.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.behavior.ts:17`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.edge.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.errors.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.input.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.inspection.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.tree.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimLexicalEvidence.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ConstitutionOutcome/ConstitutionOutcome.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/DocStructure/DocStructure.behavior.ts:6`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/DocStructure/DocStructure.model.ts:6`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/DocketDeadline/DocketDeadline.model.ts:15`: `{ $LawPracticeDomainId }` from `@beep/identity`.

- `packages/law-practice/domain/src/values/HistorySignal/HistorySignal.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity`.

- `packages/law-practice/domain/src/values/HohfeldPosition/HohfeldPosition.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/HohfeldPositionKind/HohfeldPositionKind.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/KgAttributionSource/KgAttributionSource.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/KgEdgePredicate/KgEdgePredicate.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/KindCode/KindCode.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/LegalActContent/LegalActContent.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/LegalOppositionCandidateInput/LegalOppositionCandidateInput.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/LegalRole/LegalRole.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/LegalScopeContext/LegalScopeContext.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/LegalVerdictFamily/LegalVerdictFamily.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/MailTagging/MailTagging.ids.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/MailTagging/MailTagging.ledger.model.ts:10`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/MailTagging/MailTagging.matching.model.ts:10`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/MailTagging/MailTagging.report.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/MailTagging/MailTagging.taxonomy.model.ts:10`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/NormSourceReference/NormSourceReference.model.ts:20`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ObservationVersionRef/ObservationVersionRef.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/OfficeCode/OfficeCode.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/PartyKind/PartyKind.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/PatentNumber/PatentNumber.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/PatentOffice/PatentOffice.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity`.

- `packages/law-practice/domain/src/values/PermissionStatus/PermissionStatus.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/PracticeKgEpistemicStatus/PracticeKgEpistemicStatus.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/PracticeKgProvenanceKind/PracticeKgProvenanceKind.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/PracticeProfile/PracticeProfile.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/PriorityBasis/PriorityBasis.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/Question/Question.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/ReviewItem/ReviewItem.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/SeniorityTier/SeniorityTier.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity`.

- `packages/law-practice/domain/src/values/SetupRequirement/SetupRequirement.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/SourceNormRef/SourceNormRef.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/SourceRef/SourceRef.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/src/values/SourceRef/TextQuote.model.ts:7`: `{ $LawPracticeDomainId }` from `@beep/identity`.

- `packages/law-practice/domain/src/values/StructuredDate/StructuredDate.model.ts:9`: `{ $LawPracticeDomainId }` from `@beep/identity`.

- `packages/law-practice/domain/src/values/VerdictRow/VerdictRow.model.ts:8`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/domain/test/ClaimElement.policy-work.test.ts:1`: `{ $LawPracticeDomainId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/CandorPromotionGate/CandorPromotionGate.ports.ts:10`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/CitationEngine/CitationEngine.layer.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/DocketIntake/DocketIntake.agents.ts:17`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/DocketIntake/DocketIntake.graph.ts:15`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/DocketIntake/DocketIntake.journal.ts:10`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/DocketIntake/DocketIntake.matters.ts:11`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/DocketIntake/DocketIntake.store.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/DocketIntake/DocketIntake.trackedDates.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/DocketIntake/DocketIntake.undo.ts:10`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/DocumentIdentification/Identification.contacts.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/DocumentIdentification/Identification.extraction.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/MailTagging/MailTagging.correspondents.ts:11`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/MailTagging/MailTagging.folders.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/MailTagging/MailTagging.known.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/MailTagging/MailTagging.mailbox.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/MailTagging/MailTagging.matters.ts:11`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/MailTagging/MailTagging.metering.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/MailTagging/MailTagging.service.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/MailTagging/MailTagging.state.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/NoticeMailbox/NoticeMailbox.layer.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PartyContactSource/PartyContactSource.layer.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.claims.ts:21`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.compare.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.contacts.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.correspondents.ts:11`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.errors.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.families.ts:10`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.fts.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.host.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.mail-index.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.matters.ts:10`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.projections.ts:9`: `{ $I as $BeepId, $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.references.ts:10`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.register.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.rows.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.schemas.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKg.verify.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKgHost/PracticeKgHost.errors.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/PracticeKgHost/PracticeKgHost.selfCheck.ts:10`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/QuestionCalendar/QuestionCalendar.layer.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/ReviewFiles/ReviewFiles.layer.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/Tools.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/UsptoClaims/UsptoClaims.layer.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/Admission.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/AnnotationCallback.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/AnnotationEntry.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/AnnotationFailure.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/AnnotationSpan.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/AnnotationStyle.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/AnnotationTemplate.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/Asset.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/AuthorityIdentity.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/BuiltinCleaners.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/BuiltinDiff.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ByteFrames.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CallbackObservations.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CallbackResource.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CallbackRuntimeIndex.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CallbackSession.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CanonicalSource.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CaseMetadata.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CaseName.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CaseNamePredicates.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CaseNameProcess.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CaseNameScan.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CaseNameSelection.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CaseResourceHash.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CleanerPipeline.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CleanerRegistry.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CleanerTextIdentity.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CleanerValues.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ContextMatcher.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/CourtLookup.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/DefaultCallbacks.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/DefaultConfiguration.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/DiffKernel.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/DiffSteps.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/DiffWorker.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/DiffWorkerProgram.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/DiffWorkerProtocol.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/DiffWorkerRpc.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/Document.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/DocumentCleanerProtocols.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/DocumentExtraction.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/Dump.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/EditionInference.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/EngineArtifact.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/EngineFailure.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ExtractionContext.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ExtractionEntry.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ExtractionLoop.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ExtractionSelection.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ExtractionShortcut.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ExtractorOrdering.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ExtractorRecipes.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ExtractorSelection.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/FrozenEditions.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/FullExtraction.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/GeneratedReferences.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HelperConfigurations.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HostResources.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HtmlCaseName.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HtmlCompletion.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HtmlDiscovery.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HtmlGeometryPreparation.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HtmlInput.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HtmlKernel.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HtmlTagGeometry.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HtmlWorker.ts:10`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HtmlWorkerProgram.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HtmlWorkerProtocol.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/HtmlWorkerRpc.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/InputDocument.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/JournalMetadata.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/LawMetadata.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/LiteralCleaners.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/MarkupWorker.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/Mention.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/MentionIdentity.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/MetadataComposition.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/MetadataStrings.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/MetadataValues.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/MetadataYear.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/NativeAdmission.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/NativeJson.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/NativeProcess.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/NativeWasm.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/OccurrenceProjection.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ParserCatalog.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PinExtraction.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PortFailure.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PostCaseMetadata.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PreCaseMetadata.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PublicationResourceHash.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PythonCase.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PythonCaseData.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PythonCharacterData.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PythonCharacters.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PythonHash.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PythonInteger.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PythonRegexData.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PythonRepr.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PythonTextData.ts:9`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/PythonUnicode.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ReferenceNames.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ReferencePatterns.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ReferenceTokenExtraction.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexAlphabet.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexDescriptors.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexEngine.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexInput.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexPointSets.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexPolicy.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexProgram.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexResult.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexTranslator.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexV0Data.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexWorkerProtocol.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RegexWorkerRpc.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/Rendering.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ResolutionEditions.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ResolutionInput.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/Resolve.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ResolverOperation.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ResolverText.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ResourceComponents.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ResourceCorrection.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ResourceIdentity.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/ResourceObjects.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RuntimeDictionary.ts:10`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/RuntimeHashEncoding.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SemanticExtraction.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SemanticProjection.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SemanticVocabulary.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SessionDescriptors.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SessionDocument.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/Snapshot.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SourceAnnotation.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SourceDocument.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SourceEvidence.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SourceExtraction.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SourceRequest.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SourceResolution.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/SpanOffsets.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/StopWords.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/TextBudget.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/TextCapacity.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/TokenAssembly.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/TokenCapture.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/TokenContext.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/TokenDispatch.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/TokenEditions.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/TokenObjects.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/TokenText.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/TokenizedExtraction.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/Tokenizer.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/TokenizerCatalog.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/VerifiedExtraction.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/XmlBalanceKernel.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/XmlWorker.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/XmlWorkerProtocol.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/Citation/XmlWorkerRpc.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/src/internal/PosInt.ts:16`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationAnnotationAssembly.test.ts:1`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationAnnotationCallback.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationAnnotationEntry.test.ts:1`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationAnnotationReplay.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationAnnotationSkip.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationAnnotationStyle.test.ts:1`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationAnnotationTemplate.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationAnnotationWrap.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationBuiltinDiff.fixtures.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCallbackMutations.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCallbackSession.fixtures.ts:8`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCanonicalAnnotation.fixtures.ts:6`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCanonicalTokenizer.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCaseMetadata.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCaseName.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCaseNamePredicates.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCaseNameProcess.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCaseNameScan.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCaseNameSelection.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCleanerCustomReplay.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCleanerNamedReplay.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCleanerSource.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationContextMatcher.fixtures.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationCourtLookup.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationDictionaryReentrancy.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationDiffCorpus.fixtures.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationEditionInference.fixtures.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationExtractionLoop.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationExtractionSelection.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationExtractionShortcut.test.ts:1`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationExtractorRecipes.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationExtractorSelection.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationFullExtraction.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationFullLawMetadata.fixtures.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationGeneratedReferences.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationHtmlCaseName.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationHtmlDiscovery.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationInputDocument.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationJournalMetadata.fixtures.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationLawMetadata.fixtures.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationMetadataStrings.fixtures.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationMetadataYear.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationModelMutation.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationNativeSlices.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationNativeSpawner.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationPinExtraction.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationPostCaseMetadata.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationPreCaseMetadata.fixtures.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationPriorFulls.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationPythonCase.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationReferenceNames.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationReferencePatterns.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationReferenceToken.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexAlphabet.test.ts:1`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexBoundaries.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexCaptureReuse.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexCaseFlags.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexCharacters.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexEngine.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexInput.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexLookahead.fixtures.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexNullable.fixtures.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexOperation.test.ts:1`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexResult.test.ts:1`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexVerbose.fixtures.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRegexWorker.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRendering.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationResolve.fixtures.ts:1`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationResourceCorrection.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationResourceObjects.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRuntimeDictionary.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationRuntimeSet.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationSpanOffsets.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationStopWords.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationTokenAssembly.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationTokenContext.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationTokenDispatch.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationTokenEditions.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationTokenObjects.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationTokenSeed.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationTokenText.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationTokenizer.fixtures.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationUnicodeDictionary.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/CitationXmlBalanceKernel.fixtures.ts:4`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/MailTagging.layers.test.ts:7`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/evaluation/Structural.ts:5`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/evaluation/iprally-smoke.main.ts:3`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/integration/CitationExtractorSelection.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/integration/CitationHtmlUnicode.test.ts:1`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/server/test/integration/CitationRegexTranslator.test.ts:2`: `{ $LawPracticeServerId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.errors.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.ports.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.service.ts:14`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.values.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CandorRecord/CandorRecord.ports.ts:11`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.annotation.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.cleaner.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.errors.ts:5`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.evidence.ts:5`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.input.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.limits.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.operations.ts:5`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.report.ts:5`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.result.ts:5`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.runtime.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.safety.ts:6`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.service.ts:5`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.tokenizer.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimInspection.errors.ts:6`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimInspection.lexical.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimInspection.pages.ts:6`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimInspection.schemas.ts:6`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimInspection.service.ts:6`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimSelfCheck.errors.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimSelfCheck.ports.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimSelfCheck.schemas.ts:11`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimSelfCheck.service.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ClaimSelfCheck.tools.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DailyNotice/DailyNotice.errors.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DailyNotice/DailyNotice.ports.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DailyNotice/DailyNotice.schemas.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.ports.ts:10`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:10`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:19`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DocketIntake/DocketQuestions.schemas.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DocketIntake/DocketQuestions.service.ts:10`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:15`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DocketIntake/DocketReview.schemas.ts:10`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DocumentIdentification/Identification.ports.ts:6`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/DocumentIdentification/Identification.schemas.ts:6`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.errors.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:20`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/LegalPositionRecord/LegalPositionRecord.ports.ts:11`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/LegalPositionRecord/LegalPositionRecord.values.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.errors.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.ports.ts:10`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.values.ts:10`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/MailTagging/MailTagging.errors.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/MailTagging/MailTagging.ports.ts:10`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/MailTagging/MailTagging.tagger.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/MailTagging/MailTagging.values.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionExtractionLabel.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.ports.ts:16`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.errors.ts:6`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.ports.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.service.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/PatentClaimCandidate/PatentClaimCandidate.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/PracticeKg.correspondent-lookup.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/PracticeKg.matter-lookup.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/PracticeKg.tools.ts:13`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/PracticeSetup/PracticeSetup.policy.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/PracticeSetup/PracticeSetup.ports.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/PracticeSetup/PracticeSetup.service.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/QuestionQueue/QuestionQueue.errors.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/QuestionQueue/QuestionQueue.ports.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/QuestionQueue/QuestionQueue.schemas.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/QuestionWrites/QuestionWrites.errors.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/QuestionWrites/QuestionWrites.ports.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/QuestionWrites/QuestionWrites.schemas.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ReviewHub/ReviewHub.errors.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ReviewHub/ReviewHub.ports.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ReviewHub/ReviewHub.schemas.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ReviewItemStore/ReviewItemStore.errors.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ReviewItemStore/ReviewItemStore.ports.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ReviewQueue/ReviewQueue.errors.ts:8`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/ReviewQueue/ReviewQueue.ports.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/VerdictProjector/VerdictProjector.ports.ts:9`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/VerdictProjector/VerdictProjector.schemas.ts:11`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/PosInt.ts:16`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/citationDivergences.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/citationOracleAssertions.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/citationOracleDiscovery.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/citationOracleJson.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/citationOracleLedgers.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/citationOracleOperations.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/citationOracleVocabularyMapping.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/citationRegexBenchmarks.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/citationSupplementalExtraction.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/citationSupplementalText.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/citationTypescriptDonors.ts:7`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/claimEvidence.ts:15`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/effectOutput.ts:11`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

- `packages/law-practice/use-cases/src/internal/spikeEntity.ts:24`: `{ $LawPracticeUseCasesId }` from `@beep/identity`.

- `packages/law-practice/use-cases/test/MailTagging.fixture.ts:6`: `{ $LawPracticeUseCasesId }` from `@beep/identity/packages`.

#### @beep/rdf (0 direct import declarations)

No direct import declaration found in the scoped files.

#### @beep/provenance (130 direct import declarations)

- `packages/law-practice/domain/src/entities/Distinction/Distinction.model.ts:8`: `{ TextAnchor }` from `@beep/provenance`.

- `packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.model.ts:8`: `{ TextAnchorVerificationReceipt }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/domain/src/internal/officeActionFixture.ts:10`: `{ SourceTextDigest, SourceTextExtractor, SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/domain/src/internal/officeActionFixture.ts:11`: `{ VerifySourceTextIdentityInput, verifySourceTextIdentity }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/domain/src/internal/officeActionFixture.ts:18`: `type { VerifiedSourceText, VerifiedTextAnchorError }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/domain/src/values/Citation/Citation.document.ts:7`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/domain/src/values/Citation/Citation.mention.ts:7`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/domain/src/values/Citation/Citation.mention.ts:8`: `{ TextAnchorVerificationReceipt, VerifiedTextAnchor }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimClauseRole.behavior.ts:8`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimClauseRole.model.ts:8`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimClauseRole.projection.ts:33`: `type { TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimClauseRole.sourceQuery.ts:10`: `type { TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimClauseRole.structure.ts:7`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.behavior.ts:18`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.edge.model.ts:9`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.model.ts:9`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.tree.model.ts:9`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/ClaimElement/ClaimLexicalEvidence.model.ts:8`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/DocStructure/DocStructure.behavior.ts:7`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/DocStructure/DocStructure.model.ts:7`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/domain/src/values/DocStructure/DocStructure.model.ts:8`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/src/values/DocStructure/DocStructure.model.ts:9`: `{ VerifiedTextAnchor }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/domain/src/values/ObservationVersionRef/ObservationVersionRef.model.ts:10`: `{ SourceTextDigest }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.transition.ts:7`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/CitationDocument.test.ts:28`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/CitationDocument.test.ts:29`: `{ toTextAnchorVerificationReceipt, VerifyTextAnchorAgainstVerifiedSourceInput, verifyTextAnchorAgainstVerifiedSource, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.citation-proof.test.ts:15`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.clause-evidence.test.ts:13`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.coordinator-copula.test.ts:9`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.dotted-labels.test.ts:14`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.each-direct-modifier.test.ts:24`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.finite-private-routes.test.ts:10`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.finite-proof.test.ts:12`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.intrinsic-noun.test.ts:13`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.ownership-boundary.test.ts:9`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.preamble-ownership.test.ts:25`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.proof-integrity.test.ts:9`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.qualified-end-integrity.test.ts:10`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.raw-transition.test.ts:13`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.recurrence-admission.test.ts:12`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.recurrence.test.ts:15`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.registry-projection.test.ts:12`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.right-parenthesis-labels.test.ts:23`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.right-parenthesis-work-cache.test.ts:13`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.source-projection.test.ts:15`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/ClaimElement.verbal-proof.test.ts:12`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/DocStructure.test.ts:12`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/DocStructure.test.ts:13`: `{ VerifyTextAnchorAgainstVerifiedSourceInput, verifyTextAnchorAgainstVerifiedSource, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/domain/test/claimElementFixtures.ts:21`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/helpers/ClaimElementFiniteConformance.ts:3`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/helpers/ClaimElementFiniteSource.ts:10`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/domain/test/helpers/ClaimElementRoleInspection.ts:11`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/server/src/OfficeActionStructure/OfficeActionStructure.layer.ts:18`: `{ toTextAnchorVerificationReceipt, VerifiedTextAnchorError, VerifySourceTextIdentityInput, verifySourceTextIdentity, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/OfficeActionStructure/OfficeActionStructure.repo.ts:13`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/src/internal/Citation/CallbackSession.ts:22`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/src/internal/Citation/CanonicalSource.ts:10`: `{ SourceTextDigest, SourceTextExtractor, SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/src/internal/Citation/CanonicalSource.ts:11`: `{ VerifiedSourceText, VerifySourceTextIdentityInput, verifySourceTextIdentity, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/Document.ts:18`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/src/internal/Citation/Document.ts:19`: `{ toTextAnchorVerificationReceipt, VerifySourceTextIdentityInput, verifySourceTextIdentity, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/Mention.ts:17`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/src/internal/Citation/Mention.ts:18`: `{ toTextAnchorVerificationReceipt, VerifiedSourceText, VerifySourceTextIdentityInput, VerifyTextAnchorAgainstVerifiedSourceInput, verifySourceTextIdentity, verifyTextAnchorAgainstVerifiedSource, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/Mention.ts:35`: `type { TextAnchorVerificationReceipt }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/MentionIdentity.ts:10`: `{ VerifiedTextAnchor }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/OccurrenceProjection.ts:18`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/server/src/internal/Citation/OccurrenceProjection.ts:19`: `{ VerifiedSourceText, VerifyTextAnchorAgainstVerifiedSourceInput, verifyTextAnchorAgainstVerifiedSource, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/OccurrenceProjection.ts:45`: `type { VerifiedTextAnchor }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/ResolutionInput.ts:10`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/src/internal/Citation/ResolutionInput.ts:11`: `{ VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/ResolverOperation.ts:7`: `{ VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/SessionDocument.ts:19`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/src/internal/Citation/SourceAnnotation.ts:14`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/src/internal/Citation/SourceAnnotation.ts:34`: `type { VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/SourceEvidence.ts:12`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/src/internal/Citation/SourceEvidence.ts:13`: `{ VerifySourceTextIdentityInput, verifySourceTextIdentity }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/SourceEvidence.ts:21`: `type { VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/SourceRequest.ts:15`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/src/internal/Citation/SourceRequest.ts:16`: `{ VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/SourceResolution.ts:30`: `type { VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/src/internal/Citation/VerifiedExtraction.ts:6`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/src/internal/Citation/VerifiedExtraction.ts:7`: `{ VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationBuiltinDiff.test.ts:11`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/CitationCanonicalAnnotation.test.ts:13`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/CitationDocumentPersistence.test.ts:35`: `{ SourceTextDigest, SourceTextExtractor, SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/CitationDocumentPersistence.test.ts:36`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/server/test/CitationDocumentPersistence.test.ts:37`: `{ TextAnchorVerificationReceipt, VerifySourceTextIdentityInput, VerifyTextAnchorInput, verifySourceTextIdentity, verifyTextAnchor, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationEngineCorpus.fixtures.ts:7`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/CitationEngineCorpus.fixtures.ts:21`: `type { VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationEngineResolution.test.ts:22`: `type { VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationMention.test.ts:16`: `{ SourceTextDigest, SourceTextExtractor, SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/CitationMention.test.ts:17`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/server/test/CitationMention.test.ts:18`: `{ VerifiedTextAnchor, VerifyTextAnchorInput, verifyTextAnchor }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationMentionIdentity.test.ts:6`: `{ SourceTextDigest, SourceTextExtractor, SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/CitationMentionIdentity.test.ts:7`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/server/test/CitationMentionIdentity.test.ts:8`: `{ TextAnchorVerificationReceipt, toTextAnchorVerificationReceipt, VerifyTextAnchorInput, verifyTextAnchor, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationOccurrenceProjection.fixtures.ts:6`: `{ SourceTextDigest, SourceTextExtractor, SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/CitationOccurrenceProjection.fixtures.ts:7`: `{ VerifiedSourceText, VerifySourceTextIdentityInput, verifySourceTextIdentity, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationPairedSource.fixtures.ts:9`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/CitationPairedSource.fixtures.ts:20`: `type { VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationResolve.fixtures.ts:6`: `{ SourceTextDigest, SourceTextExtractor, SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/CitationResolve.fixtures.ts:7`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/server/test/CitationResolve.fixtures.ts:8`: `{ VerifySourceTextIdentityInput, VerifyTextAnchorAgainstVerifiedSourceInput, verifySourceTextIdentity, verifyTextAnchorAgainstVerifiedSource, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationSourceAnnotation.test.ts:14`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/CitationSourceAnnotation.test.ts:15`: `{ VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationSourceDocument.test.ts:9`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/CitationSourceEvidence.test.ts:6`: `{ VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationSourceRequest.test.ts:5`: `{ VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/CitationVerifiedExtraction.fixtures.ts:10`: `{ VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/ClaimElement.reference.test.ts:16`: `type { TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/server/test/ClaimInspection.projection-fixtures.test.ts:1`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/server/test/OfficeActionStructure.test.ts:18`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/server/test/OfficeActionStructure.test.ts:19`: `{ VerifySourceTextIdentityInput }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/server/test/evaluation/Structural.ts:15`: `type { TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.service.ts:16`: `{ VerifyTextAnchorInput, verifyTextAnchor }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.evidence.ts:7`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.evidence.ts:8`: `{ VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.input.ts:9`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.result.ts:7`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.result.ts:8`: `{ VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimInspection.lexical.ts:22`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:25`: `{ TextAnchor }` from `@beep/provenance`.

- `packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.ports.ts:16`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.ports.ts:17`: `{ TextAnchorVerificationReceipt, VerifiedSourceText, VerifiedTextAnchorErrorReason, VerifySourceTextIdentityInput, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.ports.ts:27`: `type { VerifiedTextAnchorError }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.service.ts:16`: `{ TextAnchor }` from `@beep/provenance/TextAnchor`.

- `packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.service.ts:17`: `{ VerifiedTextAnchorError, VerifyTextAnchorAgainstVerifiedSourceInput, verifyTextAnchorAgainstVerifiedSource, }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/use-cases/test/CandorPolicy.test.ts:24`: `{ SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/use-cases/test/CitationEngineInput.test.ts:20`: `{ SourceTextDigest, SourceTextExtractor, SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/use-cases/test/CitationEngineInput.test.ts:21`: `{ VerifiedSourceText }` from `@beep/provenance/VerifiedTextAnchor`.

- `packages/law-practice/use-cases/test/OfficeActionStructure.test.ts:16`: `{ SourceTextExtractor, SourceTextIdentity }` from `@beep/provenance/SourceTextIdentity`.

- `packages/law-practice/use-cases/test/OfficeActionStructure.test.ts:17`: `{ VerifySourceTextIdentityInput, verifySourceTextIdentity }` from `@beep/provenance/VerifiedTextAnchor`.

#### @beep/epistemics (2 direct import declarations)

- `packages/law-practice/use-cases/src/VerdictProjector/VerdictProjector.schemas.ts:9`: `{ ClaimDispositionStatus }` from `@beep/epistemics/ClaimDispositionStatus`.

- `packages/law-practice/use-cases/src/VerdictProjector/VerdictProjector.schemas.ts:10`: `{ ClaimGateViolation }` from `@beep/epistemics/ClaimGate`.

#### @beep/ontology (0 direct import declarations)

No direct import declaration found in the scoped files.

#### @beep/nlp (3 direct import declarations)

- `packages/law-practice/server/test/LawPracticeServer.test.ts:11`: `{ DocumentId }` from `@beep/nlp/Core`.

- `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:23`: `{ DocumentId }` from `@beep/nlp/Core`.

- `packages/law-practice/use-cases/test/ClaimInspection.lexical.test.ts:13`: `{ CharPosition, Token, TokenIndex }` from `@beep/nlp/Core/Token`.

#### @beep/langextract (22 direct import declarations)

- `packages/law-practice/server/src/Layer.ts:22`: `{ layer as LangExtractLayer, LangExtractService, remoteExtractionPolicyFromConfig, }` from `@beep/langextract/Service`.

- `packages/law-practice/server/src/OfficeActionStructure/OfficeActionStructure.layer.ts:6`: `{ GroundedExtraction }` from `@beep/langextract/Extraction`.

- `packages/law-practice/server/src/PracticeKg.claims.ts:22`: `{ LangExtractError }` from `@beep/langextract/Extraction`.

- `packages/law-practice/server/src/internal/Citation/OccurrenceProjection.ts:5`: `{ convertTextOffsetRange, TextOffsetRange }` from `@beep/langextract/VerifiedSpan`.

- `packages/law-practice/server/test/CitationRegexInput.test.ts:3`: `{ convertTextOffsetRange, TextOffsetRange }` from `@beep/langextract/VerifiedSpan`.

- `packages/law-practice/server/test/LawPracticeServer.test.ts:1`: `{ LangExtractRequest }` from `@beep/langextract/Extraction`.

- `packages/law-practice/server/test/LawPracticeServer.test.ts:2`: `{ layer as LangExtractLayer, LangExtractService, remoteExtractionPolicyFromConfig, }` from `@beep/langextract/Service`.

- `packages/law-practice/server/test/OfficeActionStructure.test.ts:1`: `{ GroundedExtraction }` from `@beep/langextract/Extraction`.

- `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.errors.ts:10`: `{ AlignmentStatus }` from `@beep/langextract/Extraction`.

- `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:25`: `type { GroundedExtraction }` from `@beep/langextract/Extraction`.

- `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:22`: `{ AlignedStatus }` from `@beep/langextract/Alignment`.

- `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:23`: `{ GroundedExtraction }` from `@beep/langextract/Extraction`.

- `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.candidates.ts:8`: `{ ExtractionCandidate }` from `@beep/langextract/Extraction`.

- `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.ports.ts:17`: `{ LangExtractError }` from `@beep/langextract/Extraction`.

- `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:21`: `{ LangExtractRequest }` from `@beep/langextract/Extraction`.

- `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:22`: `{ ExtractionTarget }` from `@beep/langextract/Target`.

- `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:33`: `type { LangExtractError, LangExtractResult }` from `@beep/langextract/Extraction`.

- `packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.ports.ts:8`: `{ GroundedExtraction }` from `@beep/langextract/Extraction`.

- `packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.service.ts:8`: `{ GroundedExtraction }` from `@beep/langextract/Extraction`.

- `packages/law-practice/use-cases/test/CitationEngineLimits.test.ts:1`: `{ MAX_SOURCE_TEXT_LENGTH }` from `@beep/langextract/VerifiedSpan`.

- `packages/law-practice/use-cases/test/CitationPrerequisites.test.ts:2`: `{ convertTextOffsetRange, locateRawText, MAX_SOURCE_TEXT_LENGTH, TextOffsetRange, VERIFIED_SPAN_NORMALIZATION_VERSION, }` from `@beep/langextract/VerifiedSpan`.

- `packages/law-practice/use-cases/test/OfficeActionStructure.test.ts:1`: `{ GroundedExtraction }` from `@beep/langextract/Extraction`.

#### @beep/nlp-processing (2 direct import declarations)

- `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimInspection.lexical.ts:21`: `{ Tokenization, TokenizationError }` from `@beep/nlp-processing/Core/Tokenization`.

- `packages/law-practice/use-cases/test/ClaimInspection.lexical.test.ts:14`: `{ Tokenization, TokenizationError }` from `@beep/nlp-processing/Core/Tokenization`.

## 4. Traced flows and information preservation

### 4.1 Citation extraction, occurrence verification and resolution

The literal lane spellings `ci-citation-*` and `archive-citations` did not appear in the inspected source/README searches. The code they point toward is the private `server/src/internal/Citation` implementation and the citation goal family. This assessment traces checked-out code rather than guessing the content of an uninspected lane. `claim-check-performance` is an actual checked-out goal (`goals/claim-check-performance/README.md:1`).

| Hop | Input → output | Preservation, re-minting and limits |
| --- | --- | --- |
| Source boundary | Raw single or paired source data → `CitationPreparedSourceRequest` containing genuine `VerifiedSourceText`, role and captured extraction options | Captures each plain/markup source independently and checks policy before extraction. Decoding `SourceTextIdentity` alone does not issue source authority. `packages/law-practice/server/src/internal/Citation/SourceRequest.ts:36`; `packages/law-practice/server/src/internal/Citation/SourceExtraction.ts:44` |
| Primitive extraction | Verified text → raw owned document/tokenizer result → `CitationSemanticExtractionResult{raw,citations,reservedUnits}` | Internal native/Python-compatible text operations, frozen editions, budget and configuration remain explicit. No verified occurrence is implied by a semantic citation. `packages/law-practice/server/src/internal/Citation/SemanticExtraction.ts:53`, `packages/law-practice/server/src/internal/Citation/SemanticExtraction.ts:74`, `packages/law-practice/server/src/internal/Citation/SemanticExtraction.ts:91`; `packages/law-practice/server/src/internal/Citation/ExtractionEntry.ts:1` |
| Canonical manifestation | Parent verified text + actual native tokenizer output + engine artifact + named modes → unchanged/derived source evidence | Unchanged text retains parent identity. Changed text gets a new textDigest and extractor version derived from ordered parent/engine/modes/output commitments; parent locator/artifact identity is retained. `packages/law-practice/server/src/internal/Citation/CanonicalSource.ts:72`, `packages/law-practice/server/src/internal/Citation/CanonicalSource.ts:91`, `packages/law-practice/server/src/internal/Citation/CanonicalSource.ts:157`, `packages/law-practice/server/src/internal/Citation/CanonicalSource.ts:163` |
| Offset conversion and proof | Native citation range tagged `unicode-code-point` → exact anchor against verified source | Uses the provenance verifier after explicit range conversion. Invalid main spans enter `unverified`; invalid components enter separate diagnostics. This avoids quietly treating Python code-point offsets as JavaScript UTF-16 offsets. `packages/law-practice/server/src/internal/Citation/OccurrenceProjection.ts:193`, `packages/law-practice/server/src/internal/Citation/OccurrenceProjection.ts:208`, `packages/law-practice/server/src/internal/Citation/OccurrenceProjection.ts:301` |
| Mention issuance | semantic citation + verified anchor + engine + component/footnote evidence → `CitationMention` | `cm1:` hash binds every source-identity field, engine, semantic kind, UTF-16 range and quote. Model order/grouping do not enter identity. Initial evidenceConfidence is absent, not fabricated. `packages/law-practice/server/src/internal/Citation/MentionIdentity.ts:111`, `packages/law-practice/server/src/internal/Citation/MentionIdentity.ts:124`; `packages/law-practice/server/src/internal/Citation/OccurrenceProjection.ts:288` |
| Registered resolution | verified source + issued mentions + trusted frozen edition bindings → session descriptors, `CitationDocument`, receipt and exact resource bindings | Default callback resolution occurs in a fresh operation; unknown/ambiguous/unresolved meanings stay data. This path resolves citation resources and short-form references within its contract. It does not itself demonstrate that an external authority exists or that a quoted proposition is legally supported. `packages/law-practice/server/src/internal/Citation/RegisteredResolver.ts:31`; `packages/law-practice/server/src/internal/Citation/SourceDocument.ts:73`; `packages/law-practice/domain/src/values/Citation/Citation.resolution.ts:24` |
| Authority key | FullCitation + selected trusted edition + mentionId → `ca1:` resource identity | Case equality uses volume/page/corrected reporter, intentionally excludes dates/names/extra components; explicit null-page cases stay occurrence-specific. Law/journal keys preserve all components and edition multiplicity. This is deliberate identity projection, not full semantic identity. `packages/law-practice/server/src/internal/Citation/AuthorityIdentity.ts:126`, `packages/law-practice/server/src/internal/Citation/AuthorityIdentity.ts:155`, `packages/law-practice/server/src/internal/Citation/AuthorityIdentity.ts:169` |
| Result / persistence boundary | Connected extraction→resolution → `CitationExtractedDocumentResult` with output, source inputs, semantic citations, document, diagnostics, report and receipt | Work duration is in the report rather than semantic values. Source text and citation payloads are excluded from report diagnostics contract. Serialization loses the runtime capability; restore must rehash source, reverify anchors, check engine and recompute mention ID. `packages/law-practice/server/src/internal/Citation/SourceDocument.ts:40`, `packages/law-practice/server/src/internal/Citation/SourceDocument.ts:92`; `packages/law-practice/server/src/internal/Citation/Mention.ts:215`, `packages/law-practice/server/src/internal/Citation/Mention.ts:245` |

No human/LLM agent identity appears in the mention identity preimage; source extractor and engine artifact are present (`packages/law-practice/server/src/internal/Citation/MentionIdentity.ts:128`). Inference: occurrence identity and responsibility for producing/approving a legal assertion need separate joins. Do not add changing reviewer metadata to an occurrence digest to compensate.

The public guard remains a separate product need. The citation-grounding exploration demands that every citation resolve to a real authority and carry a verbatim-verified span before emission, and explicitly gates reopening on the two precursor goals (`explorations/citation-grounding-hallucination-guard/README.md:14`, `explorations/citation-grounding-hallucination-guard/README.md:22`). The current use-cases README still calls out incomplete complete-engine integration (`packages/law-practice/use-cases/README.md:30`, `packages/law-practice/use-cases/README.md:60`). Inference: a private extraction/resolution composition is necessary but insufficient evidence of an end-to-end ground-before-cite legal-answer guard.

#### Patent claim checking is a related, separate flow

`ClaimSelfCheck` runs claim decomposition and antecedent-basis policy, returns advisory findings and a list of undecomposed claims, and can fetch public USPTO claims through `UsptoClaims`; it does not block a draft (`packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimSelfCheck.service.ts:45`, `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimSelfCheck.service.ts:73`, `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimSelfCheck.service.ts:89`). Claim inspection also consumes NLP tokenization and law-owned lexical identity/work accounting (`packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimInspection.lexical.ts:21`, `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimInspection.lexical.ts:37`). Mapping those findings into `CandidateClaim`/`Evidence` goes through local `SourceQuote` alignment and sets evidence confidence to 1 (`packages/law-practice/use-cases/src/internal/claimEvidence.ts:41`, `packages/law-practice/use-cases/src/internal/claimEvidence.ts:262`, `packages/law-practice/use-cases/src/internal/claimEvidence.ts:277`). That value describes a construction convention; it is not evidence of calibrated certainty about patent validity or legal indefiniteness.

### 4.2 Office-action `IrToLaw`

| Hop | Types | What survives / changes |
| --- | --- | --- |
| Review input | `OfficeActionReviewInput` includes SourceArtifact and operationId; `ProcessFileOperation` → ProcessFileResult | File processing has artifact/digest identity. The mapper extracts only text from extracted output; archive/skipped/text-absent outputs fail typed. `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:106`, `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:119`, `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:246` |
| Language extraction | extracted string → `LangExtractRequest{documentId,targets,text}` → LangExtractResult.extractions | DocumentId is re-minted from operationId. Request construction does not forward sourceDigest/textDigest/extractor identity. `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:137` |
| IR boundary | `ReadonlyArray<GroundedExtraction>` → `LawEntities` | The actual port uses GroundedExtraction and explains its choice by claiming AnnotatedDocument lacks span-bearing Mention objects. That rationale is stale: current AnnotatedDocument includes mentions:S.Array(Mention), and Mention includes span/text/provenance. The mapper does not consume this newer envelope. `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:6`; `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:390`, `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:514` |
| Required labels | first aligned office_action, claim, rejection_reference, distinction | Missing or unaligned labels fail typed before entity decoding. Additional matching extractions are not represented by the fixed five-entity result. `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:67`, `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:106` |
| Law entities | one Claim, Distinction, OfficeAction, PriorArtReference, Rejection | Fixed fixture keys and ids; Claim 1 independent; prior-art document number `US 0,000,000 B2`; §102 ground; office_action extraction text becomes applicationNumber. Only distinction retains `TextAnchor{startChar,endChar,quote}`. No SourceTextIdentity, verified capability, extraction confidence, full mention collection or producer identity is carried into the fixed bundle. `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:89`, `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:101`, `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:118` |
| Audit | entity type + integer → ProductEntity envelope | Synthetic orgId=1, Runtime/System principal, timestamps based on id, rowVersion=1 and schemaVersion=0.0.0. Comment explicitly requires generator/Clock/request context in production. `packages/law-practice/use-cases/src/internal/spikeEntity.ts:12`, `packages/law-practice/use-cases/src/internal/spikeEntity.ts:68` |
| Epistemic projection | law → CandidateClaim(snapshot claimText/distinction, lifecycle candidate) + Evidence(span, artifactFixtureKey, spanFixtureKey) → gate.evaluate → transition.advance → projectClaims | Fixed evidence confidence=0.9, fixture-key linkage, no verification receipt. A well-formed span admits the candidate in this loop; admission must not be described as legal verification. `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:78`, `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:90`, `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:270` |

The README still describes NLP Handoff IR as the port input (`packages/law-practice/use-cases/README.md:4`), while the actual port uses GroundedExtraction and carries an outdated explanation (`packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:6`). Current NLP AnnotatedDocument does contain mention objects (`packages/foundation/modeling/nlp/src/Handoff/Contract.ts:514`). Inference: reassess the live IR and its source-proof guarantees before redesigning around the old comment. Mention inclusion is repaired; a SourceTextIdentity/VerifiedTextAnchor evidence closure is a separate requirement, since current Mention carries generic Provenance/span/text (`packages/foundation/modeling/nlp/src/Handoff/Contract.ts:390`).

A newer parallel office-action structure path already uses `VerifiedSourceText` and independently verifies finality/period anchors before producing candidates (`packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.service.ts:88`). Inference: preserve and generalize this stronger path rather than treating the spike as the final product contract.

### 4.3 Docket intake

| Hop | Types and operations | Information kept / reduced |
| --- | --- | --- |
| App wiring | Graph app-only mailbox/calendar + LanguageModel agents + file store/journal + optional KG/tracked dates/question publisher | Runtime chooses a real KG lookup when configured and an explicit unavailable layer otherwise. Contrary to the server README, the KG adapter exists. `apps/docket-intake/src/runtime/Layer.ts:62`, `apps/docket-intake/src/runtime/Layer.ts:89`, `apps/docket-intake/src/runtime/Layer.ts:114`; `packages/law-practice/server/src/DocketIntake/DocketIntake.matters.ts:609` |
| Mail ingress | Graph → DocketMessage + DocketAttachmentRef[] → DocketSourceDocument(bytes,contentType,name?,text?) | Carries provider, RFC message, thread, receipt time/local day and folder ids, but the document schema has no artifact digest/extractor identity or stable attachment identity field. `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:129`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:167` |
| Extraction | message → ParalegalEntry tagged no-item/entry | Entry carries stated date, mail date, response period, matter references, rationale/title/citedText. No exact offset or source-version identity. `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:190`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:219` |
| Independent review | source documents + entry → SecretaryReview; generated through LanguageModel.generateObject | Secretary gets PDF parts and records readFromSourceDocument. Provider failure/rejection/timeout is translated; model refusal can trigger fallback processing. Reviewer is a role in the port, not a persisted producer activity identity in ReviewRound. `packages/law-practice/server/src/DocketIntake/DocketIntake.agents.ts:493`, `packages/law-practice/server/src/DocketIntake/DocketIntake.agents.ts:523`, `packages/law-practice/server/src/DocketIntake/DocketIntake.agents.ts:561`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:294`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:362` |
| Review rounds | readings + source text → checks, field agreement, material critic findings, score → revision loop → ReviewVerdict | Source text collapses whitespace and uses passage membership; missing document text makes cited-span-exists pass as unverifiable. Confidence score is explicitly `0.5*M + 0.5*A`, alongside a deterministic gate; extractor self-confidence is recorded but never scored. These are workflow scores, not calibrated probabilities. `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:271`, `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:280`, `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:476`, `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:721`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:362` |
| Matter/date resolution | MatterLookupResult + optional TrackedDate[] + DocketDueDateCandidates → dated or needs-review outcome | Lookup retains unique/ambiguous/suggested/missing distinction; dates keep stated/computed candidates and earlier-of-differing basis. The code records review/folder/missing-source flags. `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:414`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:516`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:828`; `packages/law-practice/domain/src/values/DocketDeadline/DocketDeadline.model.ts:291`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:859` |
| Idempotent calendar writes | DocketCalendarEntry → DocketWrittenEntry; due plus reminder ladder or needs-review | Key hashes mailbox + thread/date or message identity + kind + discriminator, truncates hex and prefixes docket:. This is a workflow write key, not source evidence identity. Calendar payload is human-readable text/date/category; source proof is not a typed part of its schema. `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:337`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:351`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:371`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:922`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:644` |
| Persistence / review hub | DocketLedgerRecord/outcome/review rounds → file state; needs-review → question; daily outcomes → DocketDigest | Completed rounds are reused, not regenerated. State holds cursor/digestedThrough/ledger. Settled records may be dropped after they are outside the mailbox listing window and already digested, so this is operational state rather than an immutable evidentiary archive. `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:1357`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:1522`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:1550`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:1091`; `apps/docket-intake/src/runtime/Layer.ts:74` |

Inference: docket intake needs the provenance package's distinction between asserted quote, source-verifiable quote and checked capability. A boolean named “passed” currently also includes “could not verify because attachment text is absent”; the UI's tentative/needs-review workflow reduces the practical impact but does not repair the epistemic meaning (`packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:280`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:652`).

## 5. Naming and semantic drift

| Concept / names | Different current meanings/shapes | Rebuild implication (inference) |
| --- | --- | --- |
| Party / Entity / Agent / Principal | LegalPartyReference has PartyId/person kind/legacy reference; NLP Entity has mention references; citation actor is Examiner/Applicant/ThirdParty; spike audit principal is Runtime/System | Keep legal personhood, discourse entity, execution actor and audit principal separate; add explicit mappings. `packages/law-practice/domain/src/entities/LegalPartyReference/LegalPartyReference.model.ts:54`; `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:427`; `packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.values.ts:14`; `packages/law-practice/use-cases/src/internal/spikeEntity.ts:32` |
| Claim / PatentClaim / CandidateClaim / Hohfeld claim / generic claim envelope | Persisted coarse patent Claim; structured patent text/dependency union; epistemic product candidate with snapshot/lifecycle; legal right correlated with duty; foundation proposition/assertion/version envelope | Qualify APIs and schemas by semantic kind; never use one unqualified Claim to imply all five. `packages/law-practice/domain/src/entities/Claim/Claim.model.ts:55`; `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:168`; `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:78`; `packages/law-practice/domain/src/values/HohfeldPosition/HohfeldPosition.model.ts:14`; `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:276` |
| Evidence / Mention / TextAnchor / EvidenceSpan / SourceRef / ReviewEvidence | Mention is an occurrence with a source proof; TextAnchor is quote/offset geometry; EvidenceSpan adds confidence; product Evidence adds entity linkage; Box SourceRef uses file/page/quote/crop; ReviewEvidence is checks/agreement/findings | Build explicit evidence projections that declare what they discard. `packages/law-practice/domain/src/values/Citation/Citation.mention.ts:150`; `packages/foundation/modeling/provenance/src/TextAnchor.ts:51`; `packages/foundation/modeling/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:107`; `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:90`; `packages/law-practice/domain/src/values/SourceRef/SourceRef.model.ts:226`; `packages/law-practice/use-cases/src/DocketIntake/DocketReview.schemas.ts:391` |
| Verified / accepted / shape_valid / verified matter | VerifiedTextAnchor is issued source capability; accepted docket round is a threshold/gate result; office-action lifecycle advances on span shape; MatterUnique.verified is matter record provenance | Represent verification target and method in the type, not an undifferentiated verified bit. `packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:354`; `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:721`; `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:273`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:423` |
| Confidence / score / evidenceConfidence / signals | Office-action 0.9 constant; aligned claim evidence 1; citation confidence optional; docket computed agreement/material-finding score; generic epistemics separates trust, asserted confidence, extractor confidence, validator and reviewer signals | Preserve measurement origin/calibration/absence rather than converting all to UnitInterval. `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:95`; `packages/law-practice/use-cases/src/internal/claimEvidence.ts:277`; `packages/law-practice/domain/src/values/Citation/Citation.mention.ts:156`; `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:476`; `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:311` |
| Source / sourceRef / provenanceRef / artifactFixtureKey | SourceTextIdentity binds scope/source/locator/artifact digest/text digest/extractor/normalization; KG provenanceRef is a nonempty string; product evidence refers to fixture keys; Box ref is provider file id | Identity needs explicit kind/version and an evidence closure, not a generic string crosswalk. `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:125`; `packages/law-practice/server/src/PracticeKg.schemas.ts:340`; `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:93`; `packages/law-practice/domain/src/values/SourceRef/SourceRef.model.ts:228` |
| Matter / docket / family / application / patent | Matter is a client-owned entity with fixture keys; operational lookup groups family/dockets/apps/patents; graph has distinct node kinds; dated calendar identity is thread/date | Preserve distinct aggregation and authority boundaries. `packages/law-practice/domain/src/entities/Matter/Matter.model.ts:49`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:414`; `packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:39`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:354` |
| Citation / authority / PatentCitationEvent / SourceNormRef | Citation is parsed text form; authority is document-local resource identity; patent event is one source-versioned observation; norm designation is verbatim text | A resolved parser resource is not a legally applicable norm or an attorney-approved citation. `packages/law-practice/domain/src/values/Citation/Citation.document.ts:41`; `packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.model.ts:70`; `packages/law-practice/domain/src/values/SourceNormRef/SourceNormRef.model.ts:26` |
| Graph edge / legal relation | KG edge is subjectIri/predicate/objectIri plus provenance/status; LegalPositionRelator includes norm, interpreter, bearer/counterparty roles, content and scope | Keep relational projection edges separate from norm-dependent legal relations. `packages/law-practice/server/src/PracticeKg.schemas.ts:379`; `packages/law-practice/domain/src/entities/LegalPositionRelator/LegalPositionRelator.model.ts:74` |
| NLP Handoff / `IrToLaw` | README advertises generic HandoffIR; actual port consumes GroundedExtraction; its rationale says AnnotatedDocument omits mentions, but current AnnotatedDocument includes them | Reconcile current contracts before judging whether the IR is sufficient; mention inclusion and source-proof issuance are distinct. `packages/law-practice/use-cases/README.md:4`; `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:6`; `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:390`, `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:514` |

## 6. Related goal and exploration headers

Selection is based on slug or the first Markdown title containing law, docket, citation, claim, patent, party, authority, verification, semantica, knowledge, ontology or nlp (case insensitive). Only README headers/opening purpose paragraphs are used here. Historical title/status statements are reproduced as repository state, not revalidated completion claims. Some selected entries concern agent/CI verification rather than legal verification; keeping them visible avoids conflating the two.

| Packet | Header status | One-line purpose from opening header text | Evidence |
| --- | --- | --- | --- |
| `explorations/auto-ontology-comparison`: Auto Ontology and Beep knowledge-stack comparison | Stage: `research`; Status: `parked` | Retain Beep's architecture and test specific integration hypotheses before adopting NVIDIA Auto Ontology or committing to an Ossie bridge. The research deliverable is complete under the reduced two-assessment scope. Experiments remain unstarted. This packet is parked because the authorized deliverable is research and experiment planning; implementation is a separate admission decision. | `explorations/auto-ontology-comparison/README.md:1`, `explorations/auto-ontology-comparison/README.md:6`, `explorations/auto-ontology-comparison/README.md:7`, `explorations/auto-ontology-comparison/README.md:14` |
| `explorations/beep-ci-operational-ontology`: Beep CI Operational Ontology | Stage: `graduate`; Status: `graduated` | A question about the three cheapest yeet levers refused to stay small: we don't know the levers, and picking them by hand misses the principle. Instead: formalize the repo's verification & backpressure semantics into a reasoned T-Box whose runtime projection over live instance data computes the fastest pipeline for ONE KPI — fleet-aggregated time-to-certainty per verification episode (agent writes code → agent kno... | `explorations/beep-ci-operational-ontology/README.md:1`, `explorations/beep-ci-operational-ontology/README.md:6`, `explorations/beep-ci-operational-ontology/README.md:7`, `explorations/beep-ci-operational-ontology/README.md:14` |
| `explorations/citation-grounding-hallucination-guard`: Citation Grounding & Hallucination Guard | Stage: `graduate`; Status: `graduated` | Legal/IP answers must never cite from memory: an eyecite-style citation parser emits exact char spans, every citation must resolve to a real authority and carry a verbatim-verified grounding span before it may be emitted, and that ground-before-cite contract is the hallucination guard the legal runtime hangs everything else on. | `explorations/citation-grounding-hallucination-guard/README.md:1`, `explorations/citation-grounding-hallucination-guard/README.md:6`, `explorations/citation-grounding-hallucination-guard/README.md:7`, `explorations/citation-grounding-hallucination-guard/README.md:14` |
| `explorations/claim-element-graph`: Claim Element Graph | Stage: `graduate`; Status: `graduated` | IPRally's invention-graph paper ([arXiv 2610.01553](https://arxiv.org/abs/2610.01553)) made a gap visible. beep-effect models a patent claim's number, dependency, preamble and transition, but its `body` is one opaque string. Three pieces of work already assume a claim-element layer that does not exist: - the drafting ledger's ordered `ClaimLimitationSupportSet` - `Distinction.missing_limitation`, which is free tex... | `explorations/claim-element-graph/README.md:1`, `explorations/claim-element-graph/README.md:6`, `explorations/claim-element-graph/README.md:7`, `explorations/claim-element-graph/README.md:14` |
| `explorations/claude-mods-law-practice`: Claude Code Mods for the Law Practice | Stage: `graduate`; Status: `graduated` | Claude Code mods (plugins that run code inside Claude Code: redraw rows, add bands, commands and controls, guard tool calls) might turn the attorney's Claude Code sessions into a lawyer-facing workbench on top of the firm's practice knowledge graph. Origin: the Notion board items "Explore claude mods for law-practice use-case" and "Add claude-for-legal to dads claude setup". | `explorations/claude-mods-law-practice/README.md:1`, `explorations/claude-mods-law-practice/README.md:6`, `explorations/claude-mods-law-practice/README.md:7`, `explorations/claude-mods-law-practice/README.md:14` |
| `explorations/effect-ontology-harvest`: effect-ontology @core-v2 Harvest | Stage: `align`; Status: `parked` | effect-ontology's `packages/@core-v2` (MIT, Effect v3, ~231 modules) is a mature knowledge-extraction framework full of patterns, data types, and infrastructure worth harvesting — not wholesale-porting — into beep-effect: map each valuable piece to a beep home (foundation modeling/capability, driver, slice, or design-reference against existing substrate), ranked by relevance to active goals. | `explorations/effect-ontology-harvest/README.md:1`, `explorations/effect-ontology-harvest/README.md:6`, `explorations/effect-ontology-harvest/README.md:7`, `explorations/effect-ontology-harvest/README.md:16` |
| `explorations/execution-authority-home`: Execution Authority Home | Stage: `graduate`; Status: `graduated` | Agent execution authority (grants, verdicts, the hash-chained execution ledger and its config) still lives in the epistemic slice three weeks after the 2026-10-21 architecture decision called it misfiled. Find it a real home before the epistemic slice's own direction is grilled. | `explorations/execution-authority-home/README.md:1`, `explorations/execution-authority-home/README.md:6`, `explorations/execution-authority-home/README.md:7`, `explorations/execution-authority-home/README.md:14` |
| `explorations/graph-3d-navigation`: Graph 3D Navigation — InfraNodus-style 3D knowledge-graph view | Stage: `graduate`; Status: `graduated` | InfraNodus's 3D graph view navigates large graphs far better than our flat 2D workbench view — proportional, distance-faded labels solve the label-overlap problem. Reverse-engineer the style (clean-room, reference-only) and graduate a goal that ships an InfraNodus-grade React 3D graph component on our cosmos/ontology rendering stack. | `explorations/graph-3d-navigation/README.md:1`, `explorations/graph-3d-navigation/README.md:6`, `explorations/graph-3d-navigation/README.md:7`, `explorations/graph-3d-navigation/README.md:14` |
| `explorations/harness-the-harness`: Harness the Harness: Claude Code for Lawyers Without the Setup | Stage: `graduate`; Status: `graduated` | The developer stack gives Claude real leverage, but it took a dozen-plus MCP servers, a proxy, a secret manager, toolchains and dozens of permission rules to get there. Wrap Claude Code so a lawyer gets the same capability on a Windows workstation without any of that: an onboarding agent that interviews the practice and provisions it, one gateway MCP, and a harness that owns Claude Code's extension points. Origin:... | `explorations/harness-the-harness/README.md:1`, `explorations/harness-the-harness/README.md:6`, `explorations/harness-the-harness/README.md:7`, `explorations/harness-the-harness/README.md:14` |
| `explorations/harvey-lab-firm-knowledge`: Harvey LAB Firm-Knowledge Mining | Stage: `graduate`; Status: `graduated` | Harvey + Engram open-sourced a synthetic law firm (Calderwood & Harkness: 266 matters, ~9.3k Office files, ~100M tokens, 250 graded retrieval/reasoning tasks) inside the MIT-licensed harvey-labs LAB repo. Mine it for patterns beep can leverage: a graded testbed for the knowledge-engine bet, schema-first synthetic corpus generation for confidentiality-safe OIP evals, portable eval methodology, and a legal-DMS task ... | `explorations/harvey-lab-firm-knowledge/README.md:1`, `explorations/harvey-lab-firm-knowledge/README.md:6`, `explorations/harvey-lab-firm-knowledge/README.md:7`, `explorations/harvey-lab-firm-knowledge/README.md:14` |
| `explorations/knowledge-endgame`: Knowledge Endgame | Stage: `capture`; Status: `parked` | A two-session synthesis over the operator's KNOWLEDGE_ENDGAME scratch note: ten Grok research lanes plus adversarial verification converged on a four-part thesis — the join layer over five ratified laws; practice-as-repo with ontologies as the type system that makes non-code work lintable; agents as FDEs via dereferenceable know-how; clone-and-go distribution with the forge disaggregated — plus a training-data fly... | `explorations/knowledge-endgame/README.md:1`, `explorations/knowledge-endgame/README.md:6`, `explorations/knowledge-endgame/README.md:7`, `explorations/knowledge-endgame/README.md:14` |
| `explorations/knowledge-workspace`: Knowledge Workspace | Stage: `capture`; Status: `parked` | Re-capture the living product vision for an event-journal-backed knowledge workspace without retaining obsolete package, app, or API anchors. | `explorations/knowledge-workspace/README.md:1`, `explorations/knowledge-workspace/README.md:6`, `explorations/knowledge-workspace/README.md:7`, `explorations/knowledge-workspace/README.md:14` |
| `explorations/legal-ontology-landscape`: Legal Ontology Landscape | Stage: `graduate`; Status: `graduated` | Ground the repo's legal semantics in reusable ontology and taxonomy capabilities without coupling intake, IP-law graph work, or future trademark docketing to a premature graph store or domain-entity model. | `explorations/legal-ontology-landscape/README.md:1`, `explorations/legal-ontology-landscape/README.md:6`, `explorations/legal-ontology-landscape/README.md:7`, `explorations/legal-ontology-landscape/README.md:14` |
| `explorations/legal-patent-kg-deepening`: Legal & Patent KG Deepening | Stage: `graduate`; Status: `graduated` | Extract the gold from a second hand-curated research corpus (~120 papers, ~24 repos, 15 seed URLs) on legal/patent ontologies, knowledge graphs, legal GraphRAG, and patent LLM tooling — wave 2 of the strand [`legal-ontology-landscape`](../legal-ontology-landscape/README.md) opened, building on its graduated findings without re-litigating them. | `explorations/legal-patent-kg-deepening/README.md:1`, `explorations/legal-patent-kg-deepening/README.md:6`, `explorations/legal-patent-kg-deepening/README.md:7`, `explorations/legal-patent-kg-deepening/README.md:14` |
| `explorations/lynx-lkg-ontology-grounding`: Lynx LKG Ontology Grounding | Stage: `graduate`; Status: `graduated` | The Lynx project (H2020) published a Legal Knowledge Graph ontology and a curated list of reference ontologies for legal-domain KGs; only a one-line citation of it exists in the graduated `legal-ontology-landscape` packet. Deep-dive the LKG ontology and the reference-ontologies list and decide what is valuable for beep-effect's semantic/KG work. | `explorations/lynx-lkg-ontology-grounding/README.md:1`, `explorations/lynx-lkg-ontology-grounding/README.md:6`, `explorations/lynx-lkg-ontology-grounding/README.md:7`, `explorations/lynx-lkg-ontology-grounding/README.md:14` |
| `explorations/ontology-agent-surface`: Ontology Agent Surface | Stage: `graduate`; Status: `graduated` | The ontology-workbench packet (completed-retained) built agent-ready plumbing on purpose — SPEC 13–16: partitioned session graphs, schema-typed worker protocol, real batch deltas, query safeguards — and named an agent/MCP tool surface as its explicit follow-up. This exploration crystallizes that surface, folding in the workbench retrospective's hardening pre-work and architecture consolidations. | `explorations/ontology-agent-surface/README.md:1`, `explorations/ontology-agent-surface/README.md:6`, `explorations/ontology-agent-surface/README.md:7`, `explorations/ontology-agent-surface/README.md:14` |
| `explorations/ontology-curation-governance`: Ontology Curation Governance | Stage: `capture`; Status: `parked` | Give ontology curation a consequence-visible review protocol: accept/decline/exclude/quarantine operations with immutable plans and rollback, plus a hard rule that generated DELETE/INSERT never executes directly. Review-order optimization and consequence previews are useful without granting the machine truth authority. Two high-priority wave-2 findings converge here (review governance; generated-change quarantine). | `explorations/ontology-curation-governance/README.md:1`, `explorations/ontology-curation-governance/README.md:6`, `explorations/ontology-curation-governance/README.md:7`, `explorations/ontology-curation-governance/README.md:14` |
| `explorations/ontology-lifecycle-qa`: Ontology Lifecycle QA | Stage: `capture`; Status: `parked` | Version induced shapes and show triple-level witnesses for every shape decision; shape support/confidence can represent errors, incompleteness, or legitimate exceptions, and only witnesses let a human tell which. Forbid direct execution of generated DELETE/INSERT against the ontology store. | `explorations/ontology-lifecycle-qa/README.md:1`, `explorations/ontology-lifecycle-qa/README.md:6`, `explorations/ontology-lifecycle-qa/README.md:7`, `explorations/ontology-lifecycle-qa/README.md:14` |
| `explorations/openclaw-deployment-platform`: Effect-native OpenClaw Deployment Platform | Stage: `graduate`; Status: `graduated` | Deploy a professional OpenClaw agent on the workstation through a TypeScript-native Pulumi + Effect stack in this repo — then use what the greenfield build proves to migrate dankserver's ~4790-line imperative Ansible openclaw role onto the same declarative platform. | `explorations/openclaw-deployment-platform/README.md:1`, `explorations/openclaw-deployment-platform/README.md:6`, `explorations/openclaw-deployment-platform/README.md:7`, `explorations/openclaw-deployment-platform/README.md:18` |
| `explorations/patent-citation-candor-gate`: Patent Citation Candor Gate | Stage: `graduate`; Status: `graduated` | Every patent-reference occurrence becomes a source-versioned, evidence-grounded `PatentCitationEvent`, and filing promotion stays blocked until every current AI-discovered event carries an attorney-owned `CandorDisposition` — converting the duty of candor from an ambient risk into an explicit, auditable gate. First wedge of the signed-off [`legal-patent-kg-deepening`](../legal-patent-kg-deepening/README.md) routin... | `explorations/patent-citation-candor-gate/README.md:1`, `explorations/patent-citation-candor-gate/README.md:6`, `explorations/patent-citation-candor-gate/README.md:7`, `explorations/patent-citation-candor-gate/README.md:19` |
| `explorations/patent-drafting-episode-ledger`: Patent Drafting Episode Ledger | Stage: `graduate`; Status: `graduated` | Make patent drafting a schema-fixed, law-owned product record: an append-only `DraftingEpisode` aggregate with a closed event union and pure state-machine fold (outline, retrieval, chunk generation, limitation support, deterministic validation, bounded retry, correction delta, attorney disposition), whose first rung is the `ClaimLimitationSupportSet` promotion gate — a submachine of the episode state machine shari... | `explorations/patent-drafting-episode-ledger/README.md:1`, `explorations/patent-drafting-episode-ledger/README.md:6`, `explorations/patent-drafting-episode-ledger/README.md:7`, `explorations/patent-drafting-episode-ledger/README.md:14` |
| `explorations/patent-drawing-pipeline`: Patent Drawing Pipeline | Stage: `graduate`; Status: `graduated` | A partner emailed a design-patent drawing request (eight named views of a flat-pack sheet-panel furniture article, with photos, a sketch sheet, and a provisional description) and asked whether Claude could produce USPTO-compliant figures. The itch: make that a repeatable repo feature (spec-as-code → one solid → hidden-line views → shading → compliant sheets → validator → attorney sign-off) instead of a one-off. | `explorations/patent-drawing-pipeline/README.md:1`, `explorations/patent-drawing-pipeline/README.md:6`, `explorations/patent-drawing-pipeline/README.md:7`, `explorations/patent-drawing-pipeline/README.md:14` |
| `explorations/research-library-ontology`: Research Library Ontology and Gated 2-Hop Intake | Stage: `graduate`; Status: `graduated` | A second research aggregation (Nov 2026: nightly reports, VidBee video bundles, a private DM archive, three papers, a bare link list, plus Box holdings) needs the same treatment the October corpus got in [research-corpus-synthesis](../research-corpus-synthesis/README.md): compile the unique source set, acquire and enrich it, then mine it for alpha relevant to beep-effect. This time the library should be ontology-f... | `explorations/research-library-ontology/README.md:1`, `explorations/research-library-ontology/README.md:6`, `explorations/research-library-ontology/README.md:7`, `explorations/research-library-ontology/README.md:14` |
| `explorations/semantica-lab`: Semantica Port Atlas & Lab | Stage: `graduate`; Status: `graduated` | Benjamin deployed the Semantica KG framework (Python, 27 modules) locally, found it valuable and buggy in equal measure, and built a Notion atlas to map it — toward a future apps/labs/semantica Tauri lab that ports the best ideas schema-first, improves them with beep-effect capabilities, and opens a neuro-symbolic reasoning work stream. | `explorations/semantica-lab/README.md:1`, `explorations/semantica-lab/README.md:6`, `explorations/semantica-lab/README.md:7`, `explorations/semantica-lab/README.md:22` |
| `explorations/solo-firm-docketing`: Solo-Firm IP Docketing | Stage: `graduate`; Status: `graduated` | Tom's solo IP practice cannot miss a deadline — office-action response periods, filing windows, patent maintenance/annuity fees, and court orders, some of them *years* out, where a miss is malpractice. The product promises "it never misses the deadline" yet its doctrine says it does not *replace* docketing. This packet lands on how we deal with docketing: handroll, integrate a paid solution with a good API/MCP/SDK... | `explorations/solo-firm-docketing/README.md:1`, `explorations/solo-firm-docketing/README.md:6`, `explorations/solo-firm-docketing/README.md:7`, `explorations/solo-firm-docketing/README.md:14` |
| `explorations/uspto-patent-driver-depth`: USPTO Patent Driver Depth | Stage: `graduate`; Status: `graduated` | The graduated patent-docketing spine needs official USPTO depth from the hand-rolled `@beep/uspto` driver: first a known-application, provenance-bearing prosecution observation, then a separately sequenced `PTMNFEE2` maintenance-fee snapshot ingest. Extend the existing driver and shipped USPTO MCP host in place; keep legal interpretation and reliability orchestration in their owning goals. | `explorations/uspto-patent-driver-depth/README.md:1`, `explorations/uspto-patent-driver-depth/README.md:6`, `explorations/uspto-patent-driver-depth/README.md:7`, `explorations/uspto-patent-driver-depth/README.md:14` |
| `explorations/verification-route`: Verification Route | Stage: `graduate`; Status: `graduated` | Given a change, compute which checks its kind can affect, propagate over the dependency graph, and run only those, cheapest first, until the thread returns to its source. The yoyo's route function, stated small: a total change taxonomy, a footprint per lane, two graphs, five axioms, and a replay over merged PRs as the acceptance instrument instead of a measurement window. | `explorations/verification-route/README.md:1`, `explorations/verification-route/README.md:6`, `explorations/verification-route/README.md:7`, `explorations/verification-route/README.md:14` |
| `goals/agent-execution-authority`: Agent Execution Authority | Lifecycle: `completed-retained` | Default-deny authority boundary over the MCP agent surface, with a hash-chained append-only record of every decision and outcome. | `goals/agent-execution-authority/README.md:1`, `goals/agent-execution-authority/README.md:5`, `goals/agent-execution-authority/README.md:12` |
| `goals/agentic-cad-patent-tooling`: Agentic CAD — Patent Tooling | Lifecycle: `active` | Not "generate patent figures." The illustrator market is already cheap ($28–39/sheet offshore, $100–125/sheet US, 2–5 days, unlimited revisions), so replacing the illustrator can never repay a build. The unmet need is the **graph** — `{disclosure, claims, parts, numerals, views, sheets}` with provenance — which every commercial vendor keeps locked inside its own workspace and none expose to an agent. | `goals/agentic-cad-patent-tooling/README.md:1`, `goals/agentic-cad-patent-tooling/README.md:3`, `goals/agentic-cad-patent-tooling/README.md:12` |
| `goals/agentic-governance-laws`: Agentic Governance Laws | Lifecycle: `active` | Give three repo-wide governance laws an owner with enforcement: a minting process cannot raise its own ceiling; every capped walk declares per-edge lifetime caps and records why it stopped; every law scanner asserts its own scan matched something. Laws without an owner stay prose — the caps and non-vacuity laws land as scanners with violating fixtures, never prose alone. | `goals/agentic-governance-laws/README.md:1`, `goals/agentic-governance-laws/README.md:5`, `goals/agentic-governance-laws/README.md:11` |
| `goals/attributed-multi-claim-span`: Attributed Multi-Claim Span | Lifecycle: `paused` | Ship attributed, supersedable multi-claim annotations over the TextAnchor/EvidenceSpan seam and prove the LangExtract-to-ClaimGate loop, including the ratified lexicog competency question. | `goals/attributed-multi-claim-span/README.md:1`, `goals/attributed-multi-claim-span/README.md:5`, `goals/attributed-multi-claim-span/README.md:11` |
| `goals/ciops-ontology-pipeline`: CI-Ops Ontology Pipeline | Lifecycle: `completed-retained` | Operate the ratified CI operational ontology as a pipeline: project live admission and wave-order data through the S7 engine, hold CQ regression green, ratify auditor run 4, and state the fleet time-to-certainty verdict. | `goals/ciops-ontology-pipeline/README.md:1`, `goals/ciops-ontology-pipeline/README.md:5`, `goals/ciops-ontology-pipeline/README.md:12` |
| `goals/citation-extraction-engine`: Citation Extraction Engine | Lifecycle: `active` | Approved safety exception (2026-10-29): native HTML parser resource exhaustion | `goals/citation-extraction-engine/README.md:1`, `goals/citation-extraction-engine/README.md:5`, `goals/citation-extraction-engine/README.md:7` |
| `goals/citation-verified-span-substrate`: Citation Verified Span Substrate | Lifecycle: `completed-retained` | Deliver generic matter-scoped verified TextAnchor construction with canonical UTF-16 raw offsets, deterministic locator mapping, straddle, and fail-closed source-drift behavior. | `goals/citation-verified-span-substrate/README.md:1`, `goals/citation-verified-span-substrate/README.md:5`, `goals/citation-verified-span-substrate/README.md:12` |
| `goals/claim-check-performance`: Claim Checker Measurable Usefulness | Lifecycle: `active` | A performance-focused follow-up to claim-element-antecedent-check. The old | `goals/claim-check-performance/README.md:1`, `goals/claim-check-performance/README.md:5`, `goals/claim-check-performance/README.md:7` |
| `goals/claim-element-antecedent-check`: Claim Element Antecedent Check | Lifecycle: `completed-retained` | Give every patent claim a span-anchored element tree and run an advisory §112(b) antecedent-basis and dependency self-check over it. The tree, the pure decomposer and the checker live in `@beep/law-practice-domain`; the `ClaimSelfCheck` service lives in `@beep/law-practice-use-cases`. Findings reach the attorney as `claim-finding` review items, and the checker is measured on public USPTO claims with a strict struc... | `goals/claim-element-antecedent-check/README.md:1`, `goals/claim-element-antecedent-check/README.md:5`, `goals/claim-element-antecedent-check/README.md:11` |
| `goals/epistemic-claim-lifecycle-gate`: Epistemic Claim Lifecycle Gate | Lifecycle: `completed-retained` | Make the epistemic boundary reusable and product-agnostic: graduate the epistemic slice from domain-only to minimum-viable (domain + use-cases + server) by shipping the full `ClaimLifecycle` state machine (`candidate -> shape_valid -> consistency_checked -> admitted`), the SHACL-gate mechanism, the projection-as-pure-function (in-memory, rebuilt from authority), and the ported v3 `EvidenceSpan` char-offset primiti... | `goals/epistemic-claim-lifecycle-gate/README.md:1`, `goals/epistemic-claim-lifecycle-gate/README.md:5`, `goals/epistemic-claim-lifecycle-gate/README.md:11` |
| `goals/execution-authority-slice`: Execution Authority Slice | Lifecycle: `active` | Give agent execution authority its own slice, then link each ontology Session change to the decision that authorized it. Graduated from [`explorations/execution-authority-home`](../../explorations/execution-authority-home/README.md). | `goals/execution-authority-slice/README.md:1`, `goals/execution-authority-slice/README.md:5`, `goals/execution-authority-slice/README.md:11` |
| `goals/knowledge-freshness-audit`: Repository freshness audit | Lifecycle: `active` | Account for repository knowledge, verify its claims against explicit sources, reconcile remote-derived skills without losing local adaptations, and prove targeted repairs. This campaign extends the semantic coverage of [knowledge-surface-automation](../knowledge-surface-automation/SPEC.md) and inherits that initiative's ratified decisions. Its broader graph, bootstrap, warehouse, and scheduling roadmap remains wit... | `goals/knowledge-freshness-audit/README.md:1`, `goals/knowledge-freshness-audit/README.md:5`, `goals/knowledge-freshness-audit/README.md:15` |
| `goals/knowledge-surface-automation`: Knowledge-Surface Audit & Automation | Lifecycle: `completed-retained` (closed 2026-10-16; reflection | Turn the agent-facing knowledge surfaces — `goals/`, `explorations/`, `.claude/skills/`, `.agents/skills/`, `docs/`, `CLAUDE.md` / `AGENTS.md`, and the `.claude` / `.agents` / `.codex` trees — into audited, gated, self-proving infrastructure: permanent new-violation gates, not a one-time cleanup. | `goals/knowledge-surface-automation/README.md:1`, `goals/knowledge-surface-automation/README.md:5`, `goals/knowledge-surface-automation/README.md:12` |
| `goals/law-doc-structure-oa-slice`: Law Document Structure Office-Action Slice | Lifecycle: `completed-retained` | Deliver versioned, deterministic recognition of the paired office-action finality declaration and shortened-statutory-period block as exact verified, schema-backed candidates at the patent-docketing intake seam. | `goals/law-doc-structure-oa-slice/README.md:1`, `goals/law-doc-structure-oa-slice/README.md:5`, `goals/law-doc-structure-oa-slice/README.md:11` |
| `goals/law-docketing-patent-spine`: Law Docketing Patent Spine | Lifecycle: `active` | Deliver the US Patent Office-Action Approval Spine: official patent evidence becomes an attorney-approved, durably reconciled deadline candidate and a one-way Outlook reminder, without making the product the docket of record. | `goals/law-docketing-patent-spine/README.md:1`, `goals/law-docketing-patent-spine/README.md:5`, `goals/law-docketing-patent-spine/README.md:11` |
| `goals/law-docketing-reliability`: Law Docketing Reliability | Lifecycle: `active` | Prove years-out reminders cannot fail silently through escalation, acknowledgment, bounded recovery, and an independent dead-man path that alerts with the desktop off. | `goals/law-docketing-reliability/README.md:1`, `goals/law-docketing-reliability/README.md:5`, `goals/law-docketing-reliability/README.md:11` |
| `goals/law-practice-office-action-extraction-rung`: Law-Practice Office-Action Extraction Rung | Lifecycle: `completed-retained` (2026-06-18) | Graduate the law-practice office-action loop beyond the rung-0 fixed candidate list by invoking the provider-neutral `@beep/langextract` service, preserving span-grounded `GroundedExtraction[]`, and adding enough adverse extraction cases to make the next doctrine breadth slice safe. | `goals/law-practice-office-action-extraction-rung/README.md:1`, `goals/law-practice-office-action-extraction-rung/README.md:5`, `goals/law-practice-office-action-extraction-rung/README.md:11` |
| `goals/law-practice-office-action-spike`: Law-Practice Office-Action Spike | Lifecycle: `completed-retained` (2026-06-18) | Graduate the `law-practice` slice from domain-only to minimum-viable (domain + use-cases + server): add the IP-law vertical (OfficeAction / Claim / Rejection §101-§102-§103-§112 / PriorArt / Distinction) as bespoke Effect-Schema, the IR→law-entity mapping, and wire the rung-0 office-action review loop end-to-end on **one** fixture office action with a trivial view. Depends on `epistemic-claim-lifecycle-gate` (comp... | `goals/law-practice-office-action-spike/README.md:1`, `goals/law-practice-office-action-spike/README.md:5`, `goals/law-practice-office-action-spike/README.md:11` |
| `goals/law-time-capture-spine`: Law Time Capture Spine | Lifecycle: `active` | Deliver the Slice 1 manual time-capture spine from a visible timer through matter/task association, evidence-bounded candidate narrative, attorney review, approval history, and vendor-neutral CSV/prebill preview without making Beep the billing system of record. | `goals/law-time-capture-spine/README.md:1`, `goals/law-time-capture-spine/README.md:5`, `goals/law-time-capture-spine/README.md:11` |
| `goals/lejeune-demo-corpus-and-ontology`: LeJeune Demo Corpus and Ontology | Lifecycle: `active` (P0-P3 complete; `completed-retained` proposed by the final PR) | Build the deterministic machine-local bundle that turns public material and synthetic Office fixtures into exact source spans, the frozen fastener ontology, cited rule results, and local PGlite, DuckDB, and bounded Oxigraph projections. | `goals/lejeune-demo-corpus-and-ontology/README.md:1`, `goals/lejeune-demo-corpus-and-ontology/README.md:5`, `goals/lejeune-demo-corpus-and-ontology/README.md:11` |
| `goals/lejeune-knowledge-desk-lab`: LeJeune Knowledge Desk Lab | Lifecycle: `paused` (authored-but-not-started; day 1 starts on Benjamin's signal) | Build a disposable, offline-capable customer-demo lab that runs the fixed 30-minute LeJeune story from fragmented RFQ evidence to a reviewed quote, cited RFI, reviewed veteran correction, and approval-gated non-executing supplier PO receipt. | `goals/lejeune-knowledge-desk-lab/README.md:1`, `goals/lejeune-knowledge-desk-lab/README.md:5`, `goals/lejeune-knowledge-desk-lab/README.md:11` |
| `goals/lint-policy-oxlint-type-aware`: Deprecated-API law lane on oxlint type-aware | Lifecycle: `completed-retained`. Parent: [lint-policy-single-digit](../lint-policy-single-digit/README.md). | **GO: hosted cold scan 71s wall, within the <=150s gate.** The initial | `goals/lint-policy-oxlint-type-aware/README.md:1`, `goals/lint-policy-oxlint-type-aware/README.md:3`, `goals/lint-policy-oxlint-type-aware/README.md:5` |
| `goals/nlp-adjunct-port`: NLP Adjunct Port & MCP Toolkit Expansion | Lifecycle: `completed-retained`; Status: **DONE** (see `ops/manifest.json`) | On-demand reflection: | `goals/nlp-adjunct-port/README.md:1`, `goals/nlp-adjunct-port/README.md:3`, `goals/nlp-adjunct-port/README.md:5`, `goals/nlp-adjunct-port/README.md:7` |
| `goals/ontology-agent-surface`: Ontology Agent Surface | Lifecycle: `completed-retained` | Expose the ontology workbench to agents through a curated, task-oriented MCP toolkit on the professional-desktop sidecar: stateless over saved Turtle files, CAS-safe, authenticated, gated, attributed, budgeted, and proven against the real ontology engine stack. | `goals/ontology-agent-surface/README.md:1`, `goals/ontology-agent-surface/README.md:5`, `goals/ontology-agent-surface/README.md:11` |
| `goals/ontology-interop-roadmap`: Ontology Interop Roadmap | Lifecycle: `completed-retained` | This packet plans the next ontology interop phase after [`goals/ontology-modeling-foundation`](../ontology-modeling-foundation) (now superseded/reference-only). Authoring-surface caveat: wherever this packet's research treats `Ontology.create(...)` helpers as current surface, read them as dead prior art — the authoring API is replaced by composer-derived `$I.key` / `$I.class` / `$I.ontology` per [`explorations/ide... | `goals/ontology-interop-roadmap/README.md:1`, `goals/ontology-interop-roadmap/README.md:5`, `goals/ontology-interop-roadmap/README.md:20` |
| `goals/ontology-sidecar-stateless-identity`: Ontology Sidecar Stateless Identity | Lifecycle: `active` | Move the desktop ontology MCP sidecar (`apps/professional-desktop/server/OntologyMcpTransport.ts`) to `[McpProtocol.v2026_07_28]` with `GovernedTierGate` keyed on a server-side digest of the per-launch bearer the sidecar already verifies ("a run is a sidecar launch"), the integration harness on the 2026 wire through `@beep/mcp-kit/client`, and the Origin allow-list owned by `OntologyMcpServerConfig` with one Origi... | `goals/ontology-sidecar-stateless-identity/README.md:1`, `goals/ontology-sidecar-stateless-identity/README.md:5`, `goals/ontology-sidecar-stateless-identity/README.md:11` |
| `goals/ontology-workbench`: Ontology Workbench | Lifecycle: `completed-retained` | Ship a fully featured ontology explorer, editor, and visualizer in `apps/professional-desktop`, delivered as a new `ontology` vertical slice with files-as-truth Turtle persistence, a typed change-operation edit model, GPU-scale graph exploration (cosmos.gl), SPARQL querying (Oxigraph), bounded domain-native inference, and a SHACL validation lane with verified repairs. | `goals/ontology-workbench/README.md:1`, `goals/ontology-workbench/README.md:5`, `goals/ontology-workbench/README.md:11` |
| `goals/ontology-workbench-migration`: Ontology Workbench Migration | Lifecycle: `completed-retained` | Migrate the Ontology workbench monolith into nine fine-grained dock panels — the first workspace-substrate step-4 surface migration — and land the four dock capability residuals folded in by the 2026-07-17 grill: per-panel min/max constraints, tab-overflow dropdown, drop-indicator split quadrants, and a StrictMode-safe tree host. | `goals/ontology-workbench-migration/README.md:1`, `goals/ontology-workbench-migration/README.md:5`, `goals/ontology-workbench-migration/README.md:11` |
| `goals/openclaw-workstation-agent`: OpenClaw Workstation Agent | Lifecycle: `active` | Deploy a legal-focused OpenClaw agent on the Linux workstation as immutable, generation-based, Pulumi+Effect-managed infrastructure — prototype gauntlet first, then driver, then live agent. This platform is how new OpenClaw instances get deployed; the workstation is the first target (dankserver is never migrated — GATE C decision in the source exploration). | `goals/openclaw-workstation-agent/README.md:1`, `goals/openclaw-workstation-agent/README.md:5`, `goals/openclaw-workstation-agent/README.md:11` |
| `goals/party-slice`: Party Slice | Lifecycle: `completed-retained` | Graduate the scratchpad party model into a domain-agnostic packages/party slice (domain, use-cases, server) on @beep/epistemics | `goals/party-slice/README.md:1`, `goals/party-slice/README.md:5`, `goals/party-slice/README.md:11` |
| `goals/patent-citation-candor-gate`: Patent Citation Candor Gate | Lifecycle: `completed-retained` | Make every AI-discovered patent-reference occurrence a source-versioned, evidence-grounded `PatentCitationEvent`, and block filing promotion until each current one carries an attorney `CandorDisposition` bound to its exact observation version — converting the duty of candor (37 CFR 1.56) from an ambient risk into an explicit, auditable, fail-closed gate that never computes legal judgment. | `goals/patent-citation-candor-gate/README.md:1`, `goals/patent-citation-candor-gate/README.md:5`, `goals/patent-citation-candor-gate/README.md:11` |
| `goals/patent-document-schema`: Patent Document Schema | Lifecycle: `completed-retained` | Ship schema-first patent-application section and claim structure in `@beep/law-practice-domain`, consumed first by the practice-KG claims batch. | `goals/patent-document-schema/README.md:1`, `goals/patent-document-schema/README.md:5`, `goals/patent-document-schema/README.md:11` |
| `goals/patent-drafting-episode-ledger`: Patent Drafting Episode Ledger | Lifecycle: `paused` | Ship the law-owned append-only DraftingEpisode, replay fold, support-set promotion gate, seven-field answer annex, and rebuildable projection/fallback proof. | `goals/patent-drafting-episode-ledger/README.md:1`, `goals/patent-drafting-episode-ledger/README.md:5`, `goals/patent-drafting-episode-ledger/README.md:11` |
| `goals/practice-docket-intake`: Practice Docket Intake | Lifecycle: `completed-retained` | Watch the solo attorney's Outlook mailbox from the operator's workstation, classify each new message as a docket item or not, have a second agent recompute the due date from the source document, and write tentative `Docket - unverified` calendar entries with a 30/14/7/1-day reminder ladder for the attorney to confirm. Outlook stays the system of record. | `goals/practice-docket-intake/README.md:1`, `goals/practice-docket-intake/README.md:5`, `goals/practice-docket-intake/README.md:11` |
| `goals/provenance-shared-claim-kernel`: Provenance & Shared Claim Kernel | Lifecycle: `completed-retained` | Make the `epistemic` boundary consumable by a second vertical (`law-practice`) without breaking slice isolation. Route the cross-slice coupling to its correct homes: domain-agnostic **substrate** → `foundation/modeling` (`@beep/schema` `UnitInterval`, new `@beep/provenance` `TextAnchor`); minimum **product vocabulary** → `shared/domain` (`ClaimLifecycle`); the **mechanism** (gate/projection services + live Layers)... | `goals/provenance-shared-claim-kernel/README.md:1`, `goals/provenance-shared-claim-kernel/README.md:5`, `goals/provenance-shared-claim-kernel/README.md:11` |
| `goals/recorded-qa-acceptance`: Recorded QA Acceptance — dock-react gesture verification | Lifecycle: completed-retained | Campaign charter. End-to-end acceptance of the UI Verification System | `goals/recorded-qa-acceptance/README.md:1`, `goals/recorded-qa-acceptance/README.md:8`, `goals/recorded-qa-acceptance/README.md:10` |
| `goals/research-library-ontology-core`: Research library ontology core | Lifecycle: `completed-retained` | Make the research library ontology-first: named S.Class models with PROV-O/CiTO/FaBiO/SKOS/DCAT annotations, a Context.Service topology, generated Turtle T-Box and SHACL shapes through the @beep/ontology fold, SHACL-validated catalog, SPARQL-backed views. | `goals/research-library-ontology-core/README.md:1`, `goals/research-library-ontology-core/README.md:5`, `goals/research-library-ontology-core/README.md:11` |
| `goals/semantica-atlas-sync`: Semantica Atlas Sync | Lifecycle: `active` | Write the ratified positive `Verdict` and `Beep counterpart` values into the Notion `@beep/semantica` atlas from a schema-validated verdicts file (`atlas-verdicts/v1`) through the P5 method — render, diff against a live 33-catalog read, one canary write, apply, SQL read-back — on exactly the rows the file lists and with zero Notion schema. The IR facts lane stays a gated P2 on semantica 0.6.7+. | `goals/semantica-atlas-sync/README.md:1`, `goals/semantica-atlas-sync/README.md:5`, `goals/semantica-atlas-sync/README.md:11` |
| `goals/semantica-canary`: Semantica Canary | Lifecycle: `completed-retained` | Scaffold the headless-first Tauri lab at the future apps/labs/semantica and run the staged canary C0 → C1 → C2 over F1 + W1 under the probe breaker (S1), emitting replay-identical `EvalReport`s; each passing stage flips its families from park-pending-canary to a verdict (B1). | `goals/semantica-canary/README.md:1`, `goals/semantica-canary/README.md:5`, `goals/semantica-canary/README.md:11` |
| `goals/semantica-reasoning-spike`: Semantica Reasoning Spike | Lifecycle: `active` | Dated NET-NEW reasoning spike: P1 builds the `G-entailment/rules` fixture (`g-entailment-rules/v1`: twenty cases in five classes under the restricted EYE pins, no negation class), then P2–P4 run the `/adhd` probes — proof-ledger kernel, budget-certified rules, evidence-graph workspace — as kill criteria ablated against EYE, with the v3 `rete` salvage entering at P3 once the archive is located; one S1 candidate. | `goals/semantica-reasoning-spike/README.md:1`, `goals/semantica-reasoning-spike/README.md:5`, `goals/semantica-reasoning-spike/README.md:11` |
| `goals/semantica-storage-inversion`: Semantica Storage Inversion | Lifecycle: `active` | Spike the storage semantics D16 needs before it can bind: `Invalidated` retraction with derived reach, `Redacted` document erasure with a ledger-computed closure and an atomic purge protocol, `Compacted` trust-root snapshots and checkpoint continuity in chain order — proven by probes P-S0..3 on the offline-regenerated C2 ledger as one S1 candidate. | `goals/semantica-storage-inversion/README.md:1`, `goals/semantica-storage-inversion/README.md:5`, `goals/semantica-storage-inversion/README.md:11` |
| `goals/trustgraph-doc-ontology`: TrustGraph Documentation Ontology | Lifecycle: `reference` | This initiative turns the documentation-memory exploration into runnable artifacts for the repository's documentation domain. | `goals/trustgraph-doc-ontology/README.md:1`, `goals/trustgraph-doc-ontology/README.md:5`, `goals/trustgraph-doc-ontology/README.md:11` |
| `goals/verification-route`: Verification Route | Lifecycle: `completed-retained` | Given a change, run only the checks its kind can affect, cheapest first, and prove it by replay over merged PRs instead of a measurement window: a total footprint record per lane, `classify` and `route` in repo-cli, the loss census, final-check shadow then enforced, hosted `skip-satisfied` per lane. Graduated 2026-10-28 from [`explorations/verification-route`](../../explorations/verification-route/README.md) (BRIE... | `goals/verification-route/README.md:1`, `goals/verification-route/README.md:5`, `goals/verification-route/README.md:11` |

## 7. What the law product needs from the foundation

Ranked requirements below are inferences from the observed consumers, not a claim that the repository has adopted a new design.

1. **Inference: a versioned source-and-anchor kernel with explicit proof issuance and re-verification.** Every legal observation should distinguish raw quote geometry, a serialized receipt and a checked runtime capability. Preserve artifact digest, text digest, extractor, normalization and source scope through every adapter. The citation implementation already demonstrates the contract; docket input and the office-action spike do not carry it end to end (`packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:125`; `packages/law-practice/server/src/internal/Citation/Mention.ts:215`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:167`; `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:89`).

2. **Inference: typed epistemic states that keep unverified, unverifiable, refuted, structurally conforming and legally reviewed distinct.** A docket check must be able to report unknown rather than pass because attachment text is absent; source verification must remain distinct from legal applicability. Evidence: the deliberate unverifiable pass and the span-only office-action gate (`packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:280`; `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:273`).

3. **Inference: separate occurrence, document/resource, proposition/assertion and human decision identities with explicit joins.** Preserve citation cm1 vs ca1, exact patent-observation versions and attorney dispositions; replace synthetic audit envelopes at the production boundary. Evidence: the occurrence preimage, resource projection, source-bound disposition and spike disclaimer (`packages/law-practice/server/src/internal/Citation/MentionIdentity.ts:124`; `packages/law-practice/server/src/internal/Citation/AuthorityIdentity.ts:155`; `packages/law-practice/domain/src/entities/CandorDisposition/CandorDisposition.model.ts:71`; `packages/law-practice/use-cases/src/internal/spikeEntity.ts:12`).

4. **Inference: evidence-complete intermediate representations with declared, testable information loss.** An extraction-to-domain mapping should carry the document manifestation and occurrence closure, support multiplicity and describe fields intentionally projected away. The current consumer uses a fixed five-entity mapping and an outdated rationale for bypassing AnnotatedDocument, which now includes mentions. This establishes integration drift; it does not prove the current IR lacks mentions (`packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:6`; `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:514`; `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:67`, `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:101`). Proposed laws: source identity preservation, anchor round-trip, idempotent normalization, explicit lossy projection and no fabricated certainty.

5. **Inference: independent evidence-signal channels, with origin, calibration and meaningful absence.** Extraction alignment, model confidence, source trust, reviewer disposition and computed workflow score should not collapse to one number. Existing generic epistemics already separates several channels; law has 0.9/1 constants and a deterministic score (`packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:94`, `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:311`; `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:95`; `packages/law-practice/use-cases/src/internal/claimEvidence.ts:277`; `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:476`).

6. **Inference: explicit legal-person, role, act, norm, scope and interpretation contracts, owned by the legal domain.** The foundation should supply identity, provenance and proposition mechanisms without replacing law-owned semantics with generic Entity/Agent labels. Relators already model interpreter responsibility and norm-scoped roles, while inventor/assignee metadata still uses strings (`packages/law-practice/domain/src/entities/LegalPositionRelator/LegalPositionRelator.model.ts:74`; `packages/law-practice/domain/src/values/LegalRole/LegalRole.model.ts:110`; `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:156`, `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:313`). Proposed tests should assert Hohfeld derivation laws and scope/role preservation, not legal truth from a well-formed record.

7. **Inference: temporal and supersession semantics that retain the evidentiary record across review and correction.** Operational cursors and disposable KG bundles should project a durable source-versioned legal history when a product requires auditability. Patent observations/dispositions already expose supersession, while docket state deliberately prunes settled/digested records (`packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.model.ts:101`; `packages/law-practice/domain/src/entities/CandorDisposition/CandorDisposition.model.ts:89`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:1522`; `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:343`).

8. **Inference: law-owned, versioned standards adapters with validated vocabularies and declared coverage.** Preserve exact ST.3/ST.6/ST.13/ST.16 identity and ST.96 claim distinctions, court/reporter vocabulary lineage, and the declared Bluebook profile. IPC/CPC need typed/versioned taxonomy references if reasoning or interoperability depends on them. Evidence: explicit standards comments versus unconstrained classification strings and empty PatentOffice metadata (`packages/law-practice/domain/src/values/OfficeCode/OfficeCode.model.ts:19`; `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts:162`; `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.model.ts:16`; `packages/law-practice/domain/src/values/Citation/Citation.bluebook.ts:2`; `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:668`; `packages/law-practice/domain/src/values/PatentOffice/PatentOffice.model.ts:31`).

9. **Inference: typed graph projections whose edges preserve provenance, epistemic status and legal distinctions without mandating a storage engine.** The current PGlite/DuckDB graph and richer legal relators need lawful mappings; RDF/ontology export should preserve semantics rather than relabel string triples as formal legal axioms. Evidence: local KgEdgePredicate/status/provenance vocabularies, composer-issued graph IRIs and relational row schemas (`packages/law-practice/domain/src/values/KgEdgePredicate/KgEdgePredicate.model.ts:43`; `packages/law-practice/server/src/PracticeKg.projections.ts:285`; `packages/law-practice/server/src/PracticeKg.schemas.ts:379`; `packages/law-practice/domain/src/entities/LegalPositionRelator/LegalPositionRelator.model.ts:74`). Proposed laws: projection determinism, referential integrity, provenance preservation and explicit aggregation loss.

10. **Inference: resource-bounded, replayable transformations with application-owned effects and honest public contracts.** Keep semantic computations separate from provider credentials, timing, budgets and write idempotency. Citation code already captures operation dependencies/limits and reports duration separately; docket writes use independent idempotency keys and persisted review rounds. README/export claims must match the implementations consumers can actually call (`packages/law-practice/server/src/internal/Citation/SourceExtraction.ts:100`, `packages/law-practice/server/src/internal/Citation/SourceExtraction.ts:125`; `packages/law-practice/server/src/internal/Citation/SourceDocument.ts:111`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:337`, `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:1357`; `packages/law-practice/use-cases/README.md:12`; `packages/law-practice/use-cases/src/DocketIntake/DocketIntake.service.ts:1616`). Proposed laws: no duplicate external write on replay, stable semantic result under repeated execution, deterministic failure classification, and bounded work independent of caller-controlled text.
