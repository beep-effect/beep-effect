# P4 map: stored bytes and acceptance consumers

Read-only measurement at 71242e1de7b. Source formats only; no private live data was read.

## Evidence bytes

packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts:64 declares span as EvidenceSpan. Table derives from the entity at packages/epistemic/tables/src/entities/Evidence/Evidence.table.ts:26. Evidence.converters.ts:101-125 declares the loose legacy confidence/endChar/quote/startChar shape; :126-152 tries strict current decoding, then derives endChar from startChar plus UTF-16 quote length. Its :140 fallback can return a still-loose legacy value. It is not a verified receipt. EvidenceVerification association compares anchors at tables/src/entities/EvidenceVerification/EvidenceVerification.converters.ts:77. ContradictionTriage.repo.ts:645 repeats that comparison; its :619-620 SQL filters stored span.startChar and quote. Both old and new rows must remain queryable.

## Claim bytes and sidecars

packages/tooling/tool/cli/src/commands/Kb/Kb.service.ts:289 reads claims.jsonl, KbGraph.service.ts:217 copies claims/assertions/registry. Holds/Holds.service.ts:146 names claims.jsonl, :173 reads and :210 encodes append rows. Holds.schemas.ts:524 tags probe runs hold-probe-run/v1. Old version ids, assertion ids, review basis digests, probe references and closed knowledge intervals must remain resolvable. Party ledger is an in-memory port at packages/party/use-cases/src/values/Ledger/Ledger.ports.ts:61-65, implemented in party/server/src/values/Ledger/Ledger.memory.ts. A persisted ClaimVersion table is not established by that port.

## Receipts, attempts and model caches

packages/law-practice/server/src/OfficeActionStructure/OfficeActionStructure.repo.ts:87-118 reads and appends complete JSONL attempts. P3's frozen v1-to-v2 readers stay in force. Citation receipt versions are frozen at server/src/internal/Citation/ReceiptRead.ts:109-117. Verification manifestation keys seal the old payload (epistemic/tables/src/entities/EvidenceVerification/EvidenceVerification.converters.ts:55-69); changing an in-memory span must not change them. Semantica EvidenceClaim stores confidence and receipt at apps/labs/semantica/src/schema/Evidence.ts:418-422; its :478 check compares body anchor with receipt. Provider readings stay optional confidence numbers; stored batch/checkpoint readers must transform scalar confidence to a signal without rewriting provider cache bytes.

## Acceptance consumers

DocketReview.policy.ts:283-287 in packages/law-practice/use-cases/src/DocketIntake passes unavailable attached text. Extractor, critic and quoted-field checks call it at :330, :370 and :576; :388 gates on passed. Unknown must survive explanation at :763-791 and tentative urgent routing, rather than becoming a failed fact. OfficeActionReview/OfficeActionReview.service.ts:107 hardcodes 0.9. ExtractorLive.ts:300 and :833 in semantica hardcode 1. The nanopub target is standards/architecture/16-knowledge-stack.md:315-316. The two-claims proof must retain claim-local accepted/rejected evidence, rather than occurrence-only deduplication: epistemics/src/ClaimEvidenceReview/ClaimEvidenceReview.model.ts:155-200.

## Stored-name search

Command: `rg -n 'epistemic_evidence|claim_version|claimVersion|Nanopub|nanopub' packages/_internal/db-admin/drizzle packages/foundation/modeling/rdf/src packages/epistemic/tables/src --glob '*.ts' --glob '*.tsx'`. Measured 4 lexical lines / 1 files, including imports and examples.

| File:first line | Matching lines |
| --- | ---: |
| packages/epistemic/tables/src/entities/Evidence/Evidence.converters.ts:39 | 4 |

## All derived stored-format and quote/check consumers

Command: `rg -n 'KbClaim|HoldClaimVersion|DeterministicCheck|SourceQuote|TextQuote' packages/tooling/tool/cli/src/commands/Kb packages/tooling/tool/cli/src/commands/Holds packages/law-practice apps/labs/semantica/src --glob '*.ts' --glob '*.tsx'`. Measured 174 lexical lines / 18 files, including imports and examples.

| File:first line | Matching lines |
| --- | ---: |
| packages/law-practice/domain/src/values/SourceRef/SourceRef.model.ts:16 | 7 |
| packages/law-practice/domain/src/values/SourceRef/TextQuote.model.ts:15 | 14 |
| packages/law-practice/domain/src/values/SourceRef/index.ts:27 | 1 |
| packages/law-practice/domain/test/SourceRefQuote.test.ts:1 | 9 |
| packages/law-practice/use-cases/src/ClaimSelfCheck.tools.ts:8 | 2 |
| packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:19 | 2 |
| packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:33 | 25 |
| packages/law-practice/use-cases/src/DocketIntake/DocketReview.schemas.ts:131 | 15 |
| packages/law-practice/use-cases/src/internal/claimEvidence.ts:41 | 10 |
| packages/law-practice/use-cases/test/DocketReview.policy.test.ts:14 | 12 |
| packages/tooling/tool/cli/src/commands/Holds/Holds.inventory.ts:16 | 12 |
| packages/tooling/tool/cli/src/commands/Holds/Holds.program.ts:33 | 15 |
| packages/tooling/tool/cli/src/commands/Holds/Holds.schemas.ts:426 | 5 |
| packages/tooling/tool/cli/src/commands/Holds/Holds.service.ts:26 | 10 |
| packages/tooling/tool/cli/src/commands/Kb/Kb.projection.ts:14 | 8 |
| packages/tooling/tool/cli/src/commands/Kb/Kb.schemas.ts:103 | 7 |
| packages/tooling/tool/cli/src/commands/Kb/Kb.service.ts:24 | 18 |
| packages/tooling/tool/cli/src/commands/Kb/KbGraph.service.ts:34 | 2 |

## Test existence

Command: `rg --files packages apps --glob '*.test.ts'`, exact basename comparison.

| File | Exists at |
| --- | --- |
| ClaimLog.laws.test.ts | Absent |
| Admission.laws.test.ts | Absent |
| ClaimCore.derivation.laws.test.ts | Absent |
| Retraction.laws.test.ts | Absent |
| LogicalKey.laws.test.ts | Absent |
| Assessments.laws.test.ts | Absent |
| Signals.absent.test.ts | Absent |
| OfficeActionReview.signals.test.ts | Absent |
| Extractor.signals.test.ts | Absent |
| DocketReview.unavailable-document-text.test.ts | Absent |
| NanopubAdapter.test.ts | Absent |
| ClaimGate.two-claims-one-occurrence.test.ts | Absent |
| OfficeActionReview.flow.test.ts | packages/law-practice/use-cases/test/OfficeActionReview.flow.test.ts |
| LawPracticeServer.test.ts | packages/law-practice/server/test/LawPracticeServer.test.ts |
| OfficeActionStructure.test.ts | packages/law-practice/use-cases/test/OfficeActionStructure.test.ts; packages/law-practice/server/test/OfficeActionStructure.test.ts |
| OfficeActionFixtures.test.ts | packages/law-practice/use-cases/test/OfficeActionFixtures.test.ts |

## Open questions

1. What does a legacy row become when source identity, authority or generation is absent?
2. How do old supersedes and external references resolve without changing their bytes?
3. Can malformed legacy spans become positions without being accepted as proof?
4. How are unknown docket checks explained and retained on urgent tentative entries?
5. Does nanopub round-trip all RDF or only a declared profile?
6. Which archived receipts and attempts change, and how do old basis digests remain valid?
7. Where do SourceQuote, SourceRef and the deferred TextQuote migration land?

## Review correction: semantica persists full evidence payloads

`rg -n 'decodePayload|ensureStoredDigest|CREATE TABLE|encodePayload' apps/labs/semantica/src/layers/LedgerLive.ts` located the physical claims/batches tables at :97-98, batch/claim payload writes at :163 and :184, and nested ExtractOutcome read at :226. schema/Evidence.ts:424-431 excludes confidence from ClaimIdPreimage; :579-584 excludes it from BatchIdPreimage. Changing confidence therefore changes stored payload digests without necessarily changing either id. P4 needs a frozen reader for both claims and nested batch payloads, raw-digest verification before transformation, and explicit immutable replay handling. Old scalar 1 may be fabricated; retain its raw metadata and use Absent legacy-unknown unless the frozen provider response proves it was supplied. apps/labs/semantica/src/schema/ProviderCache.ts:46 names provider-cache/v1 and retains raw response bytes.

SQL-byte preservation evidence: packages/_internal/db-admin/drizzle/20260813143745_baseline-functions/migration.sql:47 declares epistemic_claim_disposition_bounded with active/rejected/superseded. P4 keeps this constraint and its literals.

## Independent review: full quote carrier closure

Remeasured at 732979d5b84 with whole-symbol matching to exclude NormSourceReference. Command:

```sh
rg -n '\b(KbClaim|HoldClaimVersion|DeterministicCheck|SourceQuote|TextQuote|SourceRef|ReviewItem|QuestionFact)\b' packages/tooling/tool/cli/src/commands/Kb packages/tooling/tool/cli/src/commands/Holds packages/law-practice apps/labs/semantica/src --glob '*.ts' --glob '*.tsx'
```

Measured 315 lexical lines in 47 files. This extended inventory supersedes the
174-line / 18-file quote/check inventory for migration closure; counts include examples and imports.

| File:first line | Matching lines |
| --- | ---: |
| packages/law-practice/domain/src/values/AnswerRow/AnswerRow.model.ts:15 | 1 |
| packages/law-practice/domain/src/values/Question/Question.model.ts:14 | 14 |
| packages/law-practice/domain/src/values/ReviewItem/ReviewItem.model.ts:13 | 21 |
| packages/law-practice/domain/src/values/ReviewItem/index.ts:2 | 5 |
| packages/law-practice/domain/src/values/SourceRef/SourceRef.model.ts:16 | 17 |
| packages/law-practice/domain/src/values/SourceRef/TextQuote.model.ts:27 | 12 |
| packages/law-practice/domain/src/values/SourceRef/index.ts:2 | 6 |
| packages/law-practice/domain/src/values/VerdictRow/VerdictRow.model.ts:13 | 1 |
| packages/law-practice/domain/src/values/index.ts:374 | 4 |
| packages/law-practice/domain/test/QuestionLoop.test.ts:4 | 9 |
| packages/law-practice/domain/test/ReviewVerdict.test.ts:1 | 14 |
| packages/law-practice/domain/test/SourceRefQuote.test.ts:1 | 12 |
| packages/law-practice/server/src/ReviewFiles/ReviewFiles.layer.ts:10 | 4 |
| packages/law-practice/server/test/NoticeMailbox.test.ts:8 | 2 |
| packages/law-practice/server/test/ReviewFiles.test.ts:7 | 2 |
| packages/law-practice/use-cases/src/ClaimSelfCheck.tools.ts:8 | 7 |
| packages/law-practice/use-cases/src/DocketIntake/DocketIntake.schemas.ts:19 | 2 |
| packages/law-practice/use-cases/src/DocketIntake/DocketQuestions.schemas.ts:10 | 2 |
| packages/law-practice/use-cases/src/DocketIntake/DocketQuestions.service.ts:11 | 9 |
| packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:33 | 19 |
| packages/law-practice/use-cases/src/DocketIntake/DocketReview.schemas.ts:216 | 6 |
| packages/law-practice/use-cases/src/QuestionQueue/QuestionQueue.schemas.ts:10 | 4 |
| packages/law-practice/use-cases/src/QuestionQueue/QuestionQueue.service.ts:114 | 2 |
| packages/law-practice/use-cases/src/ReviewHub/ReviewHub.schemas.ts:10 | 2 |
| packages/law-practice/use-cases/src/ReviewHub/ReviewHub.service.ts:9 | 4 |
| packages/law-practice/use-cases/src/ReviewItemStore/ReviewItemStore.ports.ts:12 | 8 |
| packages/law-practice/use-cases/src/ReviewQueue/ReviewQueue.ports.ts:14 | 2 |
| packages/law-practice/use-cases/src/ReviewQueue/ReviewQueue.service.ts:8 | 3 |
| packages/law-practice/use-cases/src/VerdictProjector/VerdictProjector.ports.ts:11 | 4 |
| packages/law-practice/use-cases/src/VerdictProjector/VerdictProjector.service.ts:9 | 4 |
| packages/law-practice/use-cases/src/internal/claimEvidence.ts:41 | 10 |
| packages/law-practice/use-cases/src/internal/logMemory.ts:18 | 5 |
| packages/law-practice/use-cases/test/ClaimSelfCheck.test.ts:10 | 2 |
| packages/law-practice/use-cases/test/DailyNotice.test.ts:7 | 2 |
| packages/law-practice/use-cases/test/DocketQuestions.test.ts:9 | 3 |
| packages/law-practice/use-cases/test/DocketReview.policy.test.ts:14 | 4 |
| packages/law-practice/use-cases/test/QuestionLoop.slice.test.ts:8 | 2 |
| packages/law-practice/use-cases/test/ReviewHub.test.ts:7 | 3 |
| packages/law-practice/use-cases/test/ReviewVerdict.roundtrip.test.ts:8 | 5 |
| packages/tooling/tool/cli/src/commands/Holds/Holds.inventory.ts:16 | 12 |
| packages/tooling/tool/cli/src/commands/Holds/Holds.program.ts:33 | 15 |
| packages/tooling/tool/cli/src/commands/Holds/Holds.schemas.ts:426 | 5 |
| packages/tooling/tool/cli/src/commands/Holds/Holds.service.ts:26 | 8 |
| packages/tooling/tool/cli/src/commands/Kb/Kb.projection.ts:14 | 8 |
| packages/tooling/tool/cli/src/commands/Kb/Kb.schemas.ts:85 | 12 |
| packages/tooling/tool/cli/src/commands/Kb/Kb.service.ts:24 | 15 |
| packages/tooling/tool/cli/src/commands/Kb/KbGraph.service.ts:34 | 2 |

ReviewItem.model.ts:106 stores SourceRef arrays and :125 nests QuestionFact;
Question/Question.model.ts:312 adds another SourceRef array, and
DocketIntake/DocketQuestions.schemas.ts:96 is a further sourceRefs boundary.
ReviewFiles/ReviewFiles.layer.ts:86-90 decodes items.jsonl directly with ReviewItem.
The format is therefore persisted, not an in-memory quote-only change. Freeze old direct and nested
rows, preserve empty exact as LegacyQuoteUnresolved in LegacyReviewItemImported, and recursively
project through a private versioned reader. Commit 1 freezes bytes; commit 7 changes the reader and
writer together with ReviewFiles.test.ts reopen, mixed-version and no-op replay tests. Domain
ReviewVerdict, QuestionLoop and SourceRefQuote tests must be rewritten for the declared v2 encoding.
No fixture or migration implementation is claimed by this map.
