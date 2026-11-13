# Slice A2: request-scoped invocation binding

Recorded 2026-11-13 on `feat/citation-invocation-binding` in lane
`beep-effect-worktrees/citation-install-once-a2`.

## Contract and process boundary

`Invocation.ts` defines the policy schema before the service. The only production
constructor, `openCitationInvocation`, admits the public operation, applies its
boundary-selected stage deadline placement, opens a request Scope, constructs its budget, and provides
the service. The four engine methods and extractor remain closed (`R = never`).
Children still install per request. No configuration ownership, output, worker
entrypoint, wire protocol, physical process retirement, lease, or limit value
changes are made. Stage-owner finalizer timing differs from main as explicitly
recorded in Review round 1 below.

The initial stop remains recorded in `2026-11-13-a2-binding-stop.md`. The operator's
ruling is recorded in `decisions/2026-11-13-a2-worker-input-stop.md` and the design's
section 3.1 amendment. Shared constructors take an explicit generic reservation;
parent callers use `reserveCitationInvocationText`, worker and pattern callers use
`citationUnaccountedText`. The worker owns no invocation. The reservation remains
before the allocation and before the optional native grant. The `lane`, `regex`,
and `receipt` fields remain in the separate worker-v3 goal, as recorded in
`decisions/2026-11-13-a2-invocation-fields.md`.

The runtime import closure was traced from all ten Citation `*.entry.ts` roots
(Bun and Node Diff, Html, Recognizer, Regex, and Xml). Type-only imports do not load
modules. Among changed production modules, the classification is:

- Shared with an entrypoint: `NativeProcess.ts`, `PythonUnicode.ts`, `RegexAlphabet.ts`, `RegexDescriptors.ts`, `RegexInput.ts`, `RegexPolicy.ts`, `RegexProgram.ts`, `RegexWorkerEvaluation.ts`, `RegexWorkerProtocol.ts`.

- Parent only: `Admission.ts`, `AnnotationEntry.ts`, `AnnotationSpan.ts`, `BuiltinDump.ts`, `CaseMetadata.ts`, `CaseNameProcess.ts`, `CaseNameScan.ts`, `CleanerOperation.ts`, `CleanerPipeline.ts`, `ContextMatcher.ts`, `CourtLookup.ts`, `DiffWorker.ts`, `Dump.ts`, `ExtractionChildren.ts`, `ExtractionLoop.ts`, `ExtractionSelection.ts`, `GeneratedReferences.ts`, `HtmlCaseName.ts`, `HtmlGeometryPreparation.ts`, `HtmlTagGeometry.ts`, `Invocation.ts`, `JournalMetadata.ts`, `LawMetadata.ts`, `MarkupWorker.ts`, `MetadataComposition.ts`, `MetadataStrings.ts`, `MetadataYear.ts`, `NativeRendering.ts`, `PinExtraction.ts`, `PostCaseMetadata.ts`, `PreCaseMetadata.ts`, `PythonRepr.ts`, `ReferenceNames.ts`, `ReferenceTokenExtraction.ts`, `RegexWorker.ts`, `Rendering.ts`, `ResourceCorrection.ts`, `SemanticExtraction.ts`, `SourceCleaning.ts`, `SourceResolution.ts`, `StopWords.ts`, `TextBudget.ts`, `TokenContext.ts`, `TokenizedExtraction.ts`, `Tokenizer.ts`, `TokenizerCatalog.ts`, `XmlWorker.ts`.

Shared `RegexInput` and job preparation in `RegexWorkerProtocol` retain generic
reservation requirements. `PythonUnicode` allocation callbacks and the native
use callback propagate those requirements without changing runtime behavior.
`RegexAlphabet`, `RegexDescriptors`, `RegexProgram`, and `RegexWorkerEvaluation`
make their non-charging explicit. `RegexPolicy` only propagates Effect requirements.
`Invocation.ts` is absent from the runtime worker closure.

## Design section 3.1 site coverage

Every site in both design lists changed; no listed site is omitted.

| Budget site | Change |
| --- | --- |
| `RegexInput.ts:209` | Explicit reservation argument; parent call-time service callback and explicit worker/pattern no-op. |
| `TokenContext.ts:130` | Invocation reservation callback. |
| `ExtractionSelection.ts:165` | Invocation budget at call time. |
| `DiffWorker.ts:82` | Invocation reservation callback. |
| `XmlWorker.ts:52` | Invocation reservation callback. |
| `MetadataComposition.ts:209` | Invocation budget and Scope; no fresh per-stage ledger, enclosing guard, admission or nested deadline. |
| `Rendering.ts:185` | Invocation budget at call time. |
| `PythonRepr.ts:131` | Invocation budget at call time. |
| `ResourceCorrection.ts:117` | Invocation budget at call time. |
| `NativeRendering.ts:21` | Invocation budget at call time. |
| `CourtLookup.ts:98` | Invocation budget at call time. |

| Admission sites (design line references) | Change |
| --- | --- |
| `Tokenizer.ts:165,277` | Remove captured admission and nested run. |
| `ExtractionLoop.ts:239,248` | Remove nested admission/timing wrapper. |
| `ExtractionSelection.ts:163,269` | Remove captured admission and nested run. |
| `ReferenceTokenExtraction.ts:322` | Remove nested run. |
| `PreCaseMetadata.ts:163` | Remove nested run. |
| `PostCaseMetadata.ts:206` | Remove nested run. |
| `PinExtraction.ts:138` | Remove nested run. |
| `CaseMetadata.ts:300` | Remove nested run. |
| `LawMetadata.ts:224,275` | Remove both nested runs. |
| `JournalMetadata.ts:179` | Remove nested run. |
| `AnnotationEntry.ts:128` | Remove child admission view. |

Also removed the CleanerPipeline reservation capture, the shared metadata-stage
wrapper, and private SourceCleaning/SourceResolution admission in favor of the
public engine boundary. `captureCitationTextReservation` and
`captureCitationOperationChildren` no longer exist. Stage installs and engine
invocation bodies receive no operation-admission service. The GritQL rule
`no-citation-optional-invocation` is registered in the lint-rules package and scoped
by Biome to the Citation directory; both forbidden lookup forms have regression
fixtures. The source ripgrep acceptance query returns no matches.

## Before/after counts

Before is the A1 baseline from #3253 and the inherited probe replay; after is the
A2 replay of `CitationCanonicalFullSpan.test.ts`. Each cell applies to **both**
before and after. The `citationCanonicalFullSpanWork` table and its test file are
unchanged.

| Call | Metadata installs before = after | Detaches before = after | Tokenizer builds before = after | Regex constructions before = after | Evaluations before = after | Processes before = after |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 14 | 8 | 1 | 15 | 70 | 70 |
| 2 | 14 | 8 | 1 | 3 | 15 | 15 |
| 3 | 14 | 8 | 1 | 3 | 15 | 15 |
| 4 | 14 | 8 | 1 | 3 | 24 | 24 |
| 5 | 14 | 8 | 1 | 5 | 19 | 19 |
| 6 | 14 | 8 | 1 | 5 | 15 | 15 |
| 7 | 14 | 8 | 1 | 8 | 65 | 65 |
| 8 | 14 | 8 | 1 | 8 | 38 | 38 |
| 9 | 14 | 8 | 1 | 3 | 15 | 15 |
| 10 | 14 | 8 | 1 | 3 | 15 | 15 |
| **Total** | **140** | **80** | **10** | **56** | **291** | **291** |

Node call 1 also matches Bun call 1. The inherited replay passed 11 tests in
188.89 s; the final A2 replay passed 11 tests in 79.86 s. Wall time is informational.

## Fixture changes and proof boundary

One shared direct-stage helper opens the real invocation constructor. Standalone
methods retain their installed policy, Clock and explicitly supplied admission
owner. Tests with several requests use an untimed scaffold so its deadline does
not incorrectly cover the entire test. Shared-ledger tests explicitly open one
request; diagnostic observations follow that actual ledger. The fixture policy
is snapshotted so mutation tests continue to test the installed policy. See
`decisions/2026-11-13-a2-direct-stage-fixtures.md`.

The five install-guard fixture families and all `EnclosingRefusal` assertions
were removed. Tests continue to prove call-time capacity refusal, reservation
order, shared parent accounting, public admission/queue/deadline behavior, and
native quarantine/late confirmation. The DiffWorker quarantine test now observes
the enclosing operation deadline while retaining its native ownership assertions.
The HTML integration fixture opens an invocation around its direct pipeline;
its full replay is left to hosted CI.

The operator explicitly chose quick law-practice verification plus separate
docgen and file-by-file tests. The full law-practice audit was **not run locally**
because it runs the entire suite, conflicting with the shared-host file-by-file
rule. Hosted CI is the proof for that full audit and the integration cohort.
The lint-rules audit is small and receives full package verification.
See `decisions/2026-11-13-keep-the-full-law-practice-audit-on-hosted-ci.md`.

The inherited recovery patch `.a2-inherited.patch` is deleted before staging.
Only reviewed named source, tests, lint configuration, and goal/design files are
staged; local scratch scripts and logs are excluded.

## Checks

The first publication attempt stopped before committing at the stale identity-profile
hook. The canonical profile writer regenerated `biome.identity.jsonc`; the hook
also refreshed the law-practice schema and instrumentation catalogs. These
projections were reviewed and staged by name before retrying publication.
The subsequent collected gates found stale schema-first inventory locations,
108 EV003 judgments on the two request-scoped fixture wrappers, and duplicated
clean/resolve Scope wrappers. Schema inventory was regenerated without new
schema exceptions. The EV003 judgments were reviewed and given explicit owned
exceptions: sharing one request in `it.layer` changes admission, budget and
cleanup semantics. See `decisions/2026-11-13-keep-direct-invocation-fixtures-scoped-to-each-request.md`.
The redundant clean/resolve Scopes were removed in favor of the invocation's
Scope and the existing `Effect.fn` generator form. Both affected tests, quick
package verification, separate docgen and the Fallow audit pass after that fix.
Fallow reports zero introduced blocking findings; test-clone advisories remain
nonblocking under the existing pilot policy.

| Command | Result |
| --- | --- |
| `bunx turbo run build --filter="@beep/law-practice-server^..."` | Pass; 57 successful tasks, 56 cached. |
| `bunx --bun vitest run test/CitationCanonicalFullSpan.test.ts` (server package) | Pass; 11 tests, 79.86 s, unchanged A1 table. |
| `bun run beep quality package-verify @beep/law-practice-server --quick` | Pass; lint and source/test checks. |
| `bun run docgen:local` | Pass; server plus two selected dependents. |
| `bun run beep quality package-verify @beep/lint-rules` | Pass; full lint, audit and docgen. |
| `bun run beep lint policy-fingerprint` | Current, including after identity-profile regeneration; no reseal needed. |
| `bun run beep cache profile --write` followed by `bun run beep cache profile` | Regenerated the identity profile after the scoped Biome override; current. |
| `bun run beep cache audit` | Zero blocking findings; unrelated existing `turbo.json` source-drift review. |
| Optional lookup and deleted-helper source queries | No matches. |
| `git diff --check` | Pass. |

These initial-head receipts cover the listed files, not the whole citation suite.
The omitted dependent files and their regressions are recorded in Review round 1.

The 77 changed tracked citation unit/replay test files, the new invocation file,
and nine supporting test files were each invoked separately from the server
package with `bunx --bun vitest run <one file>`. All pass. No whole law-practice
suite was invoked. Admission checked the five-minute load before each file;
observed loads remained below 128. Per-file receipts follow (retries replace
introduced fixture failures; there are no outstanding local test failures).

| File under `packages/law-practice/server/test/` | Result |
| --- | --- |
| `CitationAnnotationAssembly.test.ts` | Pass |
| `CitationAnnotationCallback.test.ts` | Pass |
| `CitationAnnotationCallbackBoundary.test.ts` | Pass |
| `CitationAnnotationEntry.test.ts` | Pass |
| `CitationAnnotationEntryCoverage.test.ts` | Pass |
| `CitationAnnotationSkip.test.ts` | Pass |
| `CitationAnnotationWrap.test.ts` | Pass |
| `CitationBuiltinCleaners.test.ts` | Pass |
| `CitationBuiltinDiff.test.ts` | Pass |
| `CitationCanonicalDump.test.ts` | Pass |
| `CitationCanonicalExtraction.test.ts` | Pass |
| `CitationCanonicalFullRendering.test.ts` | Pass |
| `CitationCanonicalPageCorrection.test.ts` | Pass |
| `CitationCanonicalRanges.test.ts` | Pass |
| `CitationCaseMetadata.test.ts` | Pass |
| `CitationCaseName.test.ts` | Pass |
| `CitationCaseNameCoverage.test.ts` | Pass |
| `CitationCaseNameProcess.test.ts` | Pass |
| `CitationCaseNameScan.test.ts` | Pass |
| `CitationCaseNameSelection.test.ts` | Pass |
| `CitationCleanerCustomCorpus.test.ts` | Pass |
| `CitationCleanerOperation.test.ts` | Pass |
| `CitationCleanerOwnedInput.test.ts` | Pass |
| `CitationCleanerParentBudget.test.ts` | Pass |
| `CitationCleanerPipeline.test.ts` | Pass |
| `CitationCleanerPipelineCoverage.test.ts` | Pass |
| `CitationContextMatcher.test.ts` | Pass |
| `CitationCourtLookup.test.ts` | Pass |
| `CitationDiffWorker.test.ts` | Pass |
| `CitationDocumentCleanerProtocols.test.ts` | Pass |
| `CitationDocumentExtraction.test.ts` | Pass |
| `CitationDocumentExtractionCoverage.test.ts` | Pass |
| `CitationDocumentServices.test.ts` | Pass |
| `CitationDump.test.ts` | Pass |
| `CitationDumpCoverage.test.ts` | Pass |
| `CitationExtractionEntryCoverage.test.ts` | Pass |
| `CitationExtractionReport.test.ts` | Pass |
| `CitationFullExtractionCoverage.test.ts` | Pass |
| `CitationFullLawMetadata.test.ts` | Pass |
| `CitationGeneratedReferences.test.ts` | Pass |
| `CitationHtmlCleanerStage.test.ts` | Pass |
| `CitationHtmlDiscoveryCoverage.test.ts` | Pass |
| `CitationHtmlGeometryPreparation.test.ts` | Pass |
| `CitationInputDocument.test.ts` | Pass |
| `CitationInputDocumentCoverage.test.ts` | Pass |
| `CitationInvocation.test.ts` | Pass |
| `CitationJournalMetadata.test.ts` | Pass |
| `CitationLawMetadata.test.ts` | Pass |
| `CitationLiteralUnicodeComposition.test.ts` | Pass |
| `CitationMetadataYear.test.ts` | Pass |
| `CitationNativeSlices.test.ts` | Pass |
| `CitationOccurrenceProjectionCoverage.test.ts` | Pass |
| `CitationPairedSource.test.ts` | Pass |
| `CitationPinExtraction.test.ts` | Pass |
| `CitationPostCaseMetadata.test.ts` | Pass |
| `CitationPreCaseMetadata.test.ts` | Pass |
| `CitationPythonRepr.test.ts` | Pass |
| `CitationPythonReprCoverage.test.ts` | Pass |
| `CitationReferenceNames.test.ts` | Pass |
| `CitationReferencePatterns.test.ts` | Pass |
| `CitationReferencePatternsCoverage.test.ts` | Pass |
| `CitationReferenceTokenExtractionCoverage.test.ts` | Pass |
| `CitationRegexInput.test.ts` | Pass |
| `CitationRegexInputCoverage.test.ts` | Pass |
| `CitationRegexOperation.test.ts` | Pass |
| `CitationRegexProgram.test.ts` | Pass |
| `CitationRegexWorker.test.ts` | Pass |
| `CitationRegexWorkerProtocol.test.ts` | Pass |
| `CitationRendering.test.ts` | Pass |
| `CitationRenderingOperation.test.ts` | Pass |
| `CitationResolverBoundary.test.ts` | Pass |
| `CitationResourceCorrection.test.ts` | Pass |
| `CitationSemanticExtraction.test.ts` | Pass |
| `CitationSemanticProjection.test.ts` | Pass |
| `CitationSemanticProjectionCoverage.test.ts` | Pass |
| `CitationSourceAnnotation.test.ts` | Pass |
| `CitationSourceAnnotationTiming.test.ts` | Pass |
| `CitationSourceCleaning.test.ts` | Pass |
| `CitationSourceDocument.test.ts` | Pass |
| `CitationSpanOffsets.test.ts` | Pass |
| `CitationTextBudget.test.ts` | Pass |
| `CitationTextNativeOrder.test.ts` | Pass |
| `CitationTokenCapture.test.ts` | Pass |
| `CitationTokenContext.test.ts` | Pass |
| `CitationTokenizedExtractionCoverage.test.ts` | Pass |
| `CitationTokenizer.test.ts` | Pass |
| `CitationVerifiedExtraction.test.ts` | Pass |

## Review round 1

Reviewed head: `99bb436ca0fcb765bc20e979ec89b13203387724`.
All source and fixture fixes below are in commit `912a6a96fd2e3cffd98ce42a52202fa39936cfce`
(`fix(citation): preserve deadline and invocation boundary contracts`).
The evidence update is a separate local commit in the same publication push.

Before final checks, `origin/main` was merged with merge commit
`e3a5cdcb37a2d17c007e7aeeb0b55b6dc9e6c94b`, including #3226, #3250 and #3258.
The first merge included main through `3adc7cabc201` (#3258).
Main then advanced with #3248; merge commit
`69fa347ffafbd4be155db43c2cb4ef4d9cb1a030` adds
`8b405079b69466e27babc5dff27c06292a8cc4e2` before publication.
That second merge changed goal tooling and skills but no Citation source or tests.
Full-span, quick package verification, full lint-rules verification, docgen,
skills update/check, policy fingerprint and semantic delta were rerun after it.
There were no generated-file conflicts. Repository writers regenerated schema,
instrumentation and Effect/Vitest inventories and pruned the shard plan.
The merge brought skill changes; `bun run beep skills update` and
`bun run beep skills update --check` both report current. The 503-line Yeet skill
length notice is advisory, not a lock failure.

| Review item | Fix in the commit above | Proof |
| --- | --- | --- |
| 1: stage deadline placement | Schema-backed `CitationInvocationDeadlineStarts` and required `deadlineStarts` policy field. Engine calls use `before-admission`; extractor uses `after-admission`. Scope remains inside admission in both cases. Section 3.1 and its amendment now state both orders. | Four engine cases in `CitationEngineLayer.test.ts` cover Bun and Node, queued refusal and 800 ms queue + 9500 ms work under a 10 s stage deadline. The mirrored extractor case stays pending at 10 s total and reaches the controlled source-evidence refusal at 10.3 s. Every new case proves zero native children. |
| 2: duplicate boundary logs | Engine extract and annotate outer handlers catch only `CitationAdmissionFailure`; existing inner normalizers handle other refusals once. | Closed public source/test typecheck; engine and extractor controls pass. |
| 3: Scope ownership | Record the intentional finalizer-lifetime difference: metadata prepares share the request Scope rather than closing a per-stage Scope. Native processes still retire and acknowledge physical exit per job. Owner finalizers run at request end, before permit release. | Scope decision with reversal `Restore per-stage Effect.scoped around prepare(request)`; no claim of strict Scope neutrality. |
| 4: optional-lookup law | Forbid all three authority names in bare/member-qualified `serviceOption` and `getOption` forms. Summary explicitly states named-import aliases need semantic linting. | 12 invalid pattern fixtures, valid native-admission controls; full lint-rules package verification passes. The test-only optional invocation read remains necessary for standalone versus explicitly shared-ledger fixture calls. |
| 5a: cleanup refusal | Fixture invocation deadline is 1601 ms while the worker deadline is 800 ms; restore the original `cleanupDeadline` assertion. | All 14 DiffWorker tests pass, retaining quarantine, held capacity and late-confirmation assertions. |
| 5b: cumulative budgets | Law and Journal pre-reserve four units in the actual invocation budget and retain exact spent value 36. Case compares a precharged invocation against the one-unit-short refusal and proves the exact amount left. | Law, FullLaw, Journal and Case tests pass. The controlled Case budget fixture uses its installed manual Clock. |
| 5c: dead cleaner adapter | Live source search found no production caller. Delete the unused private adapter and its test; retain the separately implemented replay helper. | Pruned shard plan and instrumentation catalog; genuine public engine admission proof replaces fixture-only active/queued claims. |
| 6: cleanup | Move BuiltinDump type import below its package header; delete empty AnnotationEntry context/provide; remove unused metadata-operation argument and update every caller; use reference-verified `CitationInvocation.useSync` in NativeRendering. | Quick source/test verification and docgen pass. |

Decisions for these calls are in `decisions/2026-11-13-preserve-boundary-specific-deadline-placement-around-admission.md`,
`decisions/2026-11-13-keep-stage-finalizers-in-the-request-scope.md`,
`decisions/2026-11-13-delete-the-unused-cleaner-operation-adapter.md`,
`decisions/2026-11-13-keep-direct-stage-lifetime-and-clock-fixtures-aligned-with-their-owners.md`
and `decisions/2026-11-13-advance-virtual-time-to-prove-the-two-admission-deadline-contracts.md`.
The latter records the reviewed virtual-subject sleep and stepwise TestClock
judgments; no detector policy or production limit was weakened.

### Hosted regression attribution and reproduction

Logs were read through the REST job-log endpoint, for example
`gh api --allow-escape-sequences repos/beep-effect/beep-effect/actions/jobs/131868486803/logs`.
The initial individual reproductions used `bunx vitest run <file>` from the
server package. Integration files belong to the `native-wallclock` project in
`packages/law-practice/server/vitest.config.ts`; no separate integration config
is needed. Subsequent complete verification used Bun's runner form
`bunx --bun vitest run <one file>` (plus `--project native-wallclock` for integration).

| File / hosted job | Hosted failure | Root cause and fix | Why the earlier receipts missed it |
| --- | --- | --- | --- |
| `CitationExtractionLoop.test.ts`, law-practice-1, job 131868486803 | Both Bun and Node cases 0–2 fail because `Effect.flip` receives a successful result with `reservedUnits: 2216` where the tight-budget refusal was expected. Local reproduction: 2 failed, 13 passed. | Row 2 created a tight legacy budget at installation, but its fixture binding opened a full-sized invocation. Bind that control with the same tight policy used by the stage. All original model identity/state/selection and refusal expectations remain unchanged. | The initial selector used changed `.test.ts` paths; only this file's `.fixtures.ts` had changed. It was absent from the 87-file receipt set, not a hosted-only failure. Final isolated run: 15 passed. |
| `integration/CitationRegexTranslator.test.ts`, lps-int-11, job 131868486648 | Full and smoke tests report `{"outcome":"failure","phase":"program","instance":0}`; child exit 1 where 0 was expected. The same failure reproduces locally in both tests. | The standalone qualification child in the prior citation goal still used the old RegexInput signature: pattern role occupied the reservation argument and source reservation was missing. Pass explicit `citationUnaccountedText` on both constructors, retaining the pattern role as the third argument. No translator output expectation changed. | The full integration cohort was left to hosted CI, and the JavaScript qualification child was outside the TypeScript worker-entrypoint closure checked initially. It was absent from the earlier receipt set. Final isolated run: 2 passed, 155.28 s. |
| `integration/CitationRegexTranslatorNode.test.ts`, lps-int-14, job 131868486564 | Both Node full and smoke tests show the same program-phase child exit failure. This is the Node twin, not another run of the Bun file. | Same shared qualification-child fix. | Same coverage gap. Final isolated Node run: 2 passed, 140.76 s. |
| `CitationXmlWorker.test.ts`, law-practice-6, job 131868486782 | `Unknown Error: true` from flipping a successful balance operation instead of a budget refusal. | Pre-reserve the actual invocation budget, preserve the uncharged legacy replacement-ledger assertion and zero-spawn assertion. | Its fixture changed but its test file was not in the original changed-test selector. Final isolated run: 3 passed. |
| `CitationHtmlCaseName.test.ts`, law-practice-8, job 131868486851 | Budget control returns a successful patch with `reservedUnits: 219`; lifetime control receives `invalid-input` instead of `closed`. | Use the invocation budget. For lifetime, prepare valid geometry before closing the installed owner, retain the `closed` refusal and prove no additional child starts. The old null request exercised the removed nested admission before input decoding; the private stage now relies on outer admission. | Fixture-only changes were omitted from the earlier file selector. Final isolated run: 3 passed. No identity/state output expectation was changed. |
| `vitest-shards-plan.test.ts`, law-practice-8, same job | The derived wall-clock list omits eight suites present in the declared list. | Define the untimed invocation scaffold clock beside clock infrastructure in the native-spawner fixture, while independently bound methods still restore their real captured Clock. Explicit TestClock Layer in the pure invocation test makes its lack of native work clear. The shard classifier and its expected list are unchanged. | Neither the config-control test nor the full dependent-fixture closure was selected initially. Final isolated run: 2 passed. |

The old hand-back's 78 changed-file / 87 focused-file counts describe its listed
receipts, not coverage of all dependent tests. This round closes the observed
selection gaps. No original corpus identity, returned-state, translator or
extraction-output expectation was edited. The DiffWorker limit assertion is
restored to its original value. The HtmlCaseName lifetime fixture now targets a
valid request and the actual installed native owner, as explained in its decision.

### Round-1 verification

The round ran the following server files individually; all passed on the final
version of their fixtures:

| File under `packages/law-practice/server/` | Result |
| --- | --- |
| `test/CitationCanonicalFullSpan.test.ts` | Pass |
| `test/CitationCaseMetadata.test.ts` | Pass |
| `test/CitationDiffWorker.test.ts` | Pass |
| `test/CitationEngineLayer.test.ts` | Pass |
| `test/CitationExtractionLoop.test.ts` | Pass |
| `test/CitationExtractorControls.test.ts` | Pass |
| `test/CitationFullLawMetadata.test.ts` | Pass |
| `test/CitationHtmlCaseName.test.ts` | Pass |
| `test/CitationInvocation.test.ts` | Pass |
| `test/CitationJournalMetadata.test.ts` | Pass |
| `test/CitationLawMetadata.test.ts` | Pass |
| `test/CitationXmlWorker.test.ts` | Pass |
| `test/integration/CitationHtmlUnicode.test.ts` | Pass |
| `test/integration/CitationRegexTranslator.test.ts` | Pass |
| `test/integration/CitationRegexTranslatorNode.test.ts` | Pass |
| `test/vitest-shards-plan.test.ts` | Pass |

- `CitationCanonicalFullSpan.test.ts`: 11 passed in 94.54 s after the second main merge; every original A1
  count row is unchanged (totals 140 / 80 / 10 / 56 / 291 / 291).
- `quality package-verify @beep/law-practice-server --quick`: lint and source/test
  checks pass, with upstream builds completed first.
- `quality package-verify @beep/lint-rules`: full lint, audit and docgen pass.
- `docgen:local`: server and selected dependents pass.
- Policy fingerprint: current, no reseal required.
- Fallow audit: pass, zero introduced blocking findings.
- Skills update and check: current after the main merge.
- `knowledge semantic-delta --base origin/main`: pass on the committed fix;
  zero introduced findings (194 unchanged inherited findings after the second main merge).

The full law-practice audit is still not run locally because it invokes the whole
suite, contrary to the operator's file-by-file shared-host rule. The newly affected
integration files above were run individually; hosted CI remains authoritative for
the full suite. The PR remains a draft; no ready, merge or watch is performed.
