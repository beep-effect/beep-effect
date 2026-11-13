# Slice A2: request-scoped invocation binding

Recorded 2026-11-13 on `feat/citation-invocation-binding` in lane
`beep-effect-worktrees/citation-install-once-a2`.

## Contract and process boundary

`Invocation.ts` defines the policy schema before the service. The only production
constructor, `openCitationInvocation`, admits the public operation, applies its
outer stage deadline, opens a request Scope, constructs its budget, and provides
the service. The four engine methods and extractor remain closed (`R = never`).
Children still install per request. No configuration ownership, output, worker
entrypoint, protocol, process lifecycle, lease, or limit value changes are made.

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
