# B1: invocation native lanes and cleaner-boundary yield

Status: in review as PR #3336, published by the owner. The initial receipts below
precede publication; current hosted repairs are recorded in Hosted round 1.
Branch: `feat/citation-native-lane`. Base: `0e2b4c42e6d` (A4).
No push by this implementation session, rebase, stash operation, whole-package
suite or coverage run.

`C/` below means `packages/law-practice/server/src/internal/Citation/`.
Policy v2 is recorded as breaking in the packet. This private workspace takes no
changeset; the temporary changeset was removed by owner commit `7f6718a75ec`
(see decision `2026-11-14-record-policy-v2-as-breaking-in-the-packet-the-private-workspace-takes-no-changeset.md`).
The implementation follows both owner rulings; neither historical stop remains.

## Count gate

The same `CitationCanonicalFullSpan` fixture asserts every row on every call.
Two complete file runs passed 12/12, including the ten-call Bun cohort, the Node
first-call parity leg and construction. Their file wall times were 61.72 s and
64.59 s. The latter run began at 23:23:03 local; load sampled immediately after
launch was 20.27 / 22.31 / 18.30 (1/5/15 minutes). The first run's launch load was
not sampled; the nearest recorded post-run observation was 12.88 / 12.07 / 13.96.
These wall times include the Node parity leg and are not ten-call cohort times.

A4's historical round-3 record reports a 36.5 s ten-call Bun cohort at starting
load 15.2 / 33.5 / 41.8 and ending load 10.1 / 28.9 / 39.7. That is retained
historical evidence, not a fresh baseline timing. The scopes and loads differ;
no latency improvement is claimed. Counts are the acceptance gate.

| Per ten plain-text Bun calls | A4 | B1, both replays |
| --- | --- | --- |
| Regex evaluations | 291 | 291 |
| Child processes | 291 | 291 |
| Metadata-operation installs | 0 | 0 |
| Configuration detaches | 0 | 0 |
| Tokenizer builds | 0 | 0 |
| Evaluator installs | 0 | 0 |
| Native physical owners | 10 regex owners | 10 lane owners |
| Successful lane unit acquisitions | no lane | 10 |
| Diff/Xml worker constructions | 0 | 0 |

| Construction count | A4 | B1, both replays |
| --- | --- | --- |
| Metadata-operation installs | 16 | 16 |
| Configuration detaches | 1 | 1 |
| Tokenizer builds | 1 | 1 |
| Evaluator installs | 26 | 26 |
| Child processes / regex evaluations | 0 / 0 | 0 / 0 |
| Native physical owners | 1 | 1 |
| Successful lane unit acquisitions | no lane | 0 |
| Diff/Xml worker constructions | 0 | 0 |

The new probe column counts successful unit claims, including reacquisitions
following yields. `nativeProcessOwners` still counts physical owner construction;
on plain-text calls its one owner is now the lane's. Per-job wrappers do not
count as physical owners. The construction owner is still the standalone HTML
cleaner's owner. The Node parity call retains 70 children and acquires one lane.

The direct markup annotation proof also uses the probe: each request starts
three children (regex placeholder, Diff, Xml), constructs one physical lane owner
and two preparation workers, and acquires one unit. Two concurrent requests
start six children, construct two physical owners, and acquire two lane units.
The observed maximum alive is respectively one and two. Before-markup owner
counts were not replayed, so no measured before-markup timing/count is claimed.

## Six lane rules and real-process proof

| Rule | Implementation | Proof |
| --- | --- | --- |
| Lazy unit, held to Scope close except cleaner yield | `C/Invocation.ts` constructs the lane in the request Scope; `C/NativeLane.ts` caches the physical owner lazily and claims a total unit only on start. | Empty lane uses zero; handover/yield test observes acquired true then false and lifetime units 1 then 2. |
| One live occupant | Serialized start calls confirmed retirement before the next OS spawn. | Real regex/Diff/Xml annotation has max-alive 1 under 1/1; handover of real children also has max-alive 1. |
| Release only after confirmation, otherwise quarantine | The unchanged NativeProcess retirement binding confirms death before notification/release; failed lane retirement is terminal. | Unconfirmed yield retains active=1 and quarantine=1, never calls the cleaner; acknowledgement returns capacity but both start and yield still refuse. |
| Uninterruptible ownership and pre-spawn finalizer | Lane Scope finalizer is installed before any claim; acquisition/start is masked, with unused-unit release on failed start. | Real blocker quarantines between acquire/start: snapshot returns to blocker baseline, then zero. Synchronous interruption between acquire/spawn observes interrupted Exit, no second spawn, and zero leaked capacity. |
| Bound and no inter-operation lane wait | Native admission total ceiling is concurrentOperations; one unit per admitted operation and policy-v2 cross-field check. | Actual markup requests complete under 1/1 and concurrently under 2/2, max alive 1 and 2, started equals confirmed. |
| Yield to the closed cleaner boundary | `CleanerPipeline` invokes the port through lane.yieldTo; HTML passes the named standalone starter explicitly. | Engine HTML clean, direct host invocation, and deliberately reversed regex-then-HTML each complete under 1/1. Actual admission calls observe max active=1 and four successful claims for the four real children. Concurrent and same-fiber nested yields serialize, including caller transactions. |

The reversed order is a direct-stage proof, not a built-in engine order. Normal
HTML cleaning precedes the first lane acquisition, so its yield acquires nothing
and adds no refusal or reordered work. Public cleaner contracts are unchanged.

All new proof files pass with both Bun and Node parent runners. Each file runs
both real Bun and Node child-runtime legs. Native liveness observations check the
actual OS process, not a fake spawner. For unconfirmed retirement, started and
confirmed intentionally differ during quarantine; after explicit late OS death
acknowledgement the proof observes equality and zero stranded capacity.

## Ownership and compatibility

- `regexOwner` retains the protocol-v2 adapter and spawner/Clock identity guard,
  not a physical owner or separate lease. Every regex evaluation still spawns
  and confirms one child. No v3 messages, loop or process reuse were introduced.
- Diff and Xml preparation remain per request. Diff accepts starter and text
  reservation explicitly. Neither Diff nor Markup looks up Invocation or native
  admission. Xml passes invocation.lane.start; HTML passes the named standalone.
- Markup private semaphores, queue/refusal checks and timers remain. Hoisting
  their mutable state is unnecessary for B1 and the closed HTML port still
  needs its queue. Exact confirmation notifications settle these slots even
  after a failed job's late acknowledgement or owner-Scope retirement.
- NativeProcess.ts is unchanged: parent SIGKILL, isRunning re-check, child Scope
  close, then confirmed release, or quarantine. Recognizer keeps its lease.
- `regexActive` remains the legacy regex-lease subset. Lanes reserve total active
  units; their occupant kinds and lifetime acquisitions are lane diagnostics.

## Verification receipts

Frozen install and prerequisite Turbo build passed earlier in this worktree
(57 successful build tasks). Both quick package verifications pass, including
source and test typechecks. Both package law checks pass (only existing advisory
terse-effect findings), root Oxlint passes, local docgen passes, and Fallow audit
against origin/main has zero introduced findings. The full Effect Vitest scan
passes after adding explicit resource-hook deadlines to the three new test
layers; generated inventory churn is restored with no new baseline exceptions.
Biome and whitespace checks pass. Final gate results are also in the checkpoint.

Each focused file ran in its own process under nice. The per-file cap was 285 s;
no load admission exceeded the five-minute load cap of 128. The longest focused
file was EngineLayer at about 125 s. Final results:

| File under server/test | Tests | Vitest file duration |
| --- | --- | --- |
| `CitationNativeProcess.test.ts` | 4 passed | 1.72 s |
| `CitationNativeProcessCoverage.test.ts` | 3 passed | 1.48 s |
| `CitationNativeAdmission.test.ts` | 13 passed | 1.57 s |
| `CitationNativeAdmissionCoverage.test.ts` | 2 passed | 1.54 s |
| `CitationAdmission.test.ts` | 7 passed | 1.52 s |
| `CitationNativeRpc.test.ts` | 6 passed | 0.355 s |
| `CitationRegexWorker.test.ts` | 18 passed | 3.39 s |
| `CitationRegexWorkerProtocol.test.ts` | 14 passed | 1.57 s |
| `CitationDiffWorker.test.ts` | 14 passed | 2.61 s |
| `CitationDiffWorker.input-admission.test.ts` | 1 passed | 1.64 s |
| `CitationDiffWorkerProtocol.test.ts` | 4 passed | 1.59 s |
| `CitationXmlWorker.test.ts` | 3 passed | 4.59 s |
| `CitationXmlWorkerProtocol.test.ts` | 2 passed | 1.69 s |
| `CitationHtmlWorker.test.ts` | 11 passed | 3.53 s |
| `CitationHtmlWorkerCoverage.test.ts` | 2 passed | 1.59 s |
| `CitationHtmlWorkerCorpus.test.ts` | 3 passed | 55.06 s |
| `CitationHtmlWorkerProgram.test.ts` | 5 passed | 1.61 s |
| `CitationHtmlWorkerProtocol.test.ts` | 6 passed | 1.79 s |
| `CitationHtmlWorkerRpc.test.ts` | 3 passed | 1.53 s |
| `CitationHtmlGeometryPreparation.test.ts` | 3 passed | 3.17 s |
| `CitationBuiltinCleaners.test.ts` | 2 passed | 2.68 s |
| `CitationAnnotationAssembly.test.ts` | 5 passed | 6.06 s |
| `CitationAnnotationCallback.test.ts` | 2 passed | 16.84 s |
| `CitationAnnotationCallbackBoundary.test.ts` | 2 passed | 1.83 s |
| `CitationAnnotationEntry.test.ts` | 5 passed | 5.18 s |
| `CitationAnnotationEntryCoverage.test.ts` | 2 passed | 2.73 s |
| `CitationAnnotationFailure.test.ts` | 2 passed | 2.06 s |
| `CitationAnnotationSkip.test.ts` | 1 passed | 9.97 s |
| `CitationAnnotationStyle.test.ts` | 2 passed | 2.63 s |
| `CitationAnnotationTemplate.test.ts` | 2 passed | 2.08 s |
| `CitationAnnotationWrap.test.ts` | 3 passed | 7.04 s |
| `CitationInvocation.test.ts` | 4 passed | 1.37 s |
| `CitationEngineLayer.test.ts` | 15 passed | 123.46 s |
| `CitationNativeLane.test.ts` | 10 passed | 2.69 s |
| `CitationNativeLaneComposition.test.ts` | 4 passed | 4.54 s |
| `CitationNativeLaneCleaner.test.ts` | 2 passed | 15.38 s |

Additional files/runners:

| File / runner | Result |
| --- | --- |
| `CitationCanonicalFullSpan.test.ts`, Bun parent | 12/12 twice, 61.72 s and 64.59 s |
| `CitationCleanerPipeline.test.ts`, Bun parent | 17/17, 7.18 s |
| `CitationBuiltinCleaners.test.ts`, post-yield-lock rerun | 2/2, 10.46 s |
| `integration/CitationHtmlUnicode.test.ts`, Bun parent | 1/1, 58.15 s |
| `integration/CitationDiffWorker.test.ts`, Bun parent | 2/2, 100.35 s |
| `CitationNativeLane.test.ts`, Node parent | 10/10; real Bun and Node children |
| `CitationNativeLaneComposition.test.ts`, Node parent | 4/4, 5.25 s; counted markup probe |
| `CitationNativeLaneCleaner.test.ts`, Node parent | 2/2, 24.89 s |
| `CitationEngineLimits.test.ts`, accepted schema commit | 7/7 on Bun and Node; unchanged in this continuation |

Initial failures were attributed and fixed, not hidden: a legacy 2/1 corpus
policy became coherent 2/2; direct annotation fixtures now open invocations with
the installation's actual spawner/admission; release assertions run after the
invocation closes rather than while its unit is intentionally held. Exact child
counts are retained. Late acknowledgement tests exposed private-slot settlement,
which is now driven by the exact confirmed-retirement notification. Fallow
findings were fixed by sharing lease translation, a local record-removal helper,
and separating the native unit claim from process start. No suppression was added.

Not run: the whole law-practice suite, whole-package coverage/full package-verify,
the five large serial replays, hosted CI, or remote-worker timing. The brief
requires bounded file-level checks and quick package verification on this shared
host. B2/B3 and publication remain with the owner; no production/hosted acceptance
is implied by these local proofs.

## Hosted round 1

PR #3336 at `7f6718a75ec` exposed missed fixture and runtime-identity paths.
The fixes keep every expected child count and refusal assertion.

- HTML bytes: its two-operation policy retained only one regex slot. Set both
  ceilings to two, satisfying policy v2 without changing production limits.
- Tokenizer larger-budget invocation: the caller opened its invocation outside
  the fixture spawner/Clock. Supply both. The fixture operation admission also
  captured the old Clock before the manual Clock existed; create admission under
  the same manual Clock used by the stage and lane.
- Full-law metadata, including the 768-row integration replay: the raw stage
  reused an enclosing generic invocation instead of opening one with its observed
  spawner and fixed calendar Clock. Bind apply through the existing explicit test
  adapter. Create metadata operation admission after the fixed calendar Clock,
  so it cannot replace that Clock with the pre-calendar Clock inside its body.
- Shared text budget: install the observed runtime before opening the explicit
  24-unit invocation and provide its Context to that invocation. All budget and
  1/1 exit assertions remain. Check capacity return after invocation Scope closes,
  because the lane retains its unit during the request.
- HTML case-name lifetime: source attempted the removed worker path and returned
  spawn-failed after installation Scope closure. Retain an explicit installation
  closed flag and return the base closed refusal before runtime comparison.
- Review A: compare every evaluator (including the first) with the lane captured
  spawner/Clock using matchesRuntime. Cache only the adapter; remove dead provides
  around Effect.succeed and stale comments. Extend the zero-spawn mismatch proof
  to first/later evaluators and a differing Clock.
- Review B: move inline import types into top-level type imports.

Focused reruns: HTML bytes 2/2; tokenizer 11/11; full-law unit 2/2; text budget
6/6; HTML case-name 3/3; regex worker 18/18. The requested integration file passes
1/1 (all 768 observations and its original 936/936 process receipt) in 133.29 s
under the package integration project. No other integration cohort is launched.

The service search found 67 provider files. The unit audit follows provider
fixtures to consumers, excludes platform-layer-only imports, and runs each file
in a separate nice-19 process with a 285-second cap. CanonicalFullSpan is reserved
for the final run after checks. Final per-file results are appended below.

### Provider audit follow-through

At owner head b749cd91e7e, after reverting the three out-of-scope parent-runtime
edits, the historical provider audit has 165 green unit files containing 740
passing tests.
Three files are red under the Node parent: six passing and 26 failing tests
across those files. That historical 168-file inventory contains 772 tests at the owner head; current-wave additions are recorded separately below. It uses the requested `nice -n 19 bunx vitest run <file>`
command, whose Vitest parent is Node; each file retains its own Bun/Node child
runtime matrix. No file ran concurrently with another test file. Each process had
a 285-second cap, and every launch's five-minute load was below 128.

Additional failures found by this audit were fixed as follows:

- Annotation assembly: pass the installed limits to the outer invocation so the
  existing fixture binding opens it in the stage's spawner/Clock Context. The
  twelve-child assertion is unchanged.
- Case metadata: its fixed calendar Clock was installed after operation admission
  had captured the manual Clock. Recreate operation admission under the fixed
  Clock and provide that same Context to the explicit enclosing-budget invocation.
  Preserve all eighteen-child receipts, calendar outputs and budget assertions.
- Journal/law metadata: explicit outer-budget invocations now receive the installed
  stage Context. The standalone full-law input fixture also uses the existing
  stage binding; raw apply must not inherit the generic outer scaffold invocation.
- Native-lane composition/reservation proofs: construct operation admission in the
  same controlled Clock Context as the lane and evaluator. Preserve all contention,
  timer, quarantine and confirmed-exit assertions; both files pass unchanged counts.
- Owner review reverted three out-of-scope test edits (configuration ownership, extractor
  controls, six-form projection) and a copied six-form oracle file. Those tests read
  `Bun.version` and fail under a Node parent runner; the owner reports them green on
  hosted CI. These tests remain unchanged from the owner-selected base.

The first audit had six red files (annotation assembly, case metadata,
configuration ownership, extractor controls, journal metadata and law metadata).
The retained annotation, case, journal and law metadata repairs pass. The three
reverted parent-runtime edits are not claimed as passing under Node: configuration
ownership is 5/6, extractor controls 0/24 and six-form projection 1/2. Each failure
occurs at the installation schema boundary where Bun.version is absent from the
Node shim. Their rows below record the fresh Node-parent failures after the revert;
the other rows retain the successful receipts from the earlier audit.

### Per-file audit receipts

| File (under server/) | Passed / total | File wall time |
| --- | ---: | ---: |
| `test/CitationAdmission.test.ts` | 7/7 | 2.25 s |
| `test/CitationAnnotationAssembly.test.ts` | 5/5 | 8.11 s |
| `test/CitationAnnotationCallback.test.ts` | 2/2 | 14.28 s |
| `test/CitationAnnotationCallbackBoundary.test.ts` | 2/2 | 2.32 s |
| `test/CitationAnnotationEntry.test.ts` | 5/5 | 5.15 s |
| `test/CitationAnnotationEntryCoverage.test.ts` | 2/2 | 3.34 s |
| `test/CitationAnnotationSkip.test.ts` | 1/1 | 10.56 s |
| `test/CitationAnnotationWrap.test.ts` | 3/3 | 7.04 s |
| `test/CitationBuiltinCleaners.test.ts` | 2/2 | 4.26 s |
| `test/CitationBuiltinDiff.test.ts` | 6/6 | 21.06 s |
| `test/CitationCanonicalAnnotation.test.ts` | 2/2 | 33.59 s |
| `test/CitationCanonicalAnnotationWorkflow.test.ts` | 1/1 | 37.91 s |
| `test/CitationCanonicalCourts.test.ts` | 1/1 | 41.67 s |
| `test/CitationCanonicalDefaultFactory.test.ts` | 2/2 | 4.38 s |
| `test/CitationCanonicalDump.test.ts` | 2/2 | 29.71 s |
| `test/CitationCanonicalExtraction.test.ts` | 7/7 | 43.17 s |
| `test/CitationCanonicalExtractionRanges.test.ts` | 6/6 | 2.76 s |
| `test/CitationCanonicalFullRendering.test.ts` | 2/2 | 23.33 s |
| `test/CitationCanonicalLongDiff.test.ts` | 2/2 | 17.83 s |
| `test/CitationCanonicalMissingConversion.test.ts` | 2/2 | 13.46 s |
| `test/CitationCanonicalPageCorrection.test.ts` | 2/2 | 27.14 s |
| `test/CitationCanonicalParsedEquality.test.ts` | 2/2 | 23.92 s |
| `test/CitationCanonicalParserOperations.test.ts` | 1/1 | 22.49 s |
| `test/CitationCanonicalPinSpan.test.ts` | 2/2 | 40.40 s |
| `test/CitationCanonicalRanges.test.ts` | 2/2 | 19.92 s |
| `test/CitationCanonicalReferenceMarkup.test.ts` | 2/2 | 25.03 s |
| `test/CitationCanonicalRemainingExtraction.test.ts` | 1/1 | 34.61 s |
| `test/CitationCanonicalResourceComparison.test.ts` | 1/1 | 4.23 s |
| `test/CitationCanonicalSource.test.ts` | 1/1 | 3.62 s |
| `test/CitationCanonicalSourceCoverage.test.ts` | 2/2 | 3.43 s |
| `test/CitationCapturedCleanerPlan.test.ts` | 2/2 | 25.90 s |
| `test/CitationCaseMetadata.test.ts` | 2/2 | 36.24 s |
| `test/CitationCaseName.test.ts` | 2/2 | 11.90 s |
| `test/CitationCaseNameCoverage.test.ts` | 2/2 | 3.14 s |
| `test/CitationCaseNameProcess.test.ts` | 5/5 | 17.36 s |
| `test/CitationCaseNameScan.test.ts` | 4/4 | 26.23 s |
| `test/CitationCaseNameSelection.test.ts` | 1/1 | 13.69 s |
| `test/CitationCleanerCustomCorpus.test.ts` | 3/3 | 6.89 s |
| `test/CitationCleanerNamedCorpus.test.ts` | 1/1 | 5.44 s |
| `test/CitationCleanerOwnedInput.test.ts` | 4/4 | 3.88 s |
| `test/CitationCleanerParentBudget.test.ts` | 5/5 | 7.39 s |
| `test/CitationCleanerPipeline.test.ts` | 18/18 | 4.72 s |
| `test/CitationCleanerPipelineCoverage.test.ts` | 6/6 | 5.11 s |
| `test/CitationCleanerRegistry.test.ts` | 12/12 | 5.20 s |
| `test/CitationCleanerUnicodeValues.test.ts` | 7/7 | 5.60 s |
| `test/CitationCleanerValues.test.ts` | 8/8 | 3.53 s |
| `test/CitationConfigurationOwnership.test.ts` | 5/6; Node-parent red (`Bun.version`); hosted green per owner | 17.97 s |
| `test/CitationContextMatcher.test.ts` | 2/2 | 7.57 s |
| `test/CitationCourtLookup.test.ts` | 8/8 | 13.75 s |
| `test/CitationDefaultConfiguration.test.ts` | 3/3 | 10.93 s |
| `test/CitationDiffWorker.input-admission.test.ts` | 1/1 | 2.44 s |
| `test/CitationDiffWorker.test.ts` | 14/14 | 3.73 s |
| `test/CitationDocumentCleanerProtocols.test.ts` | 10/10 | 3.30 s |
| `test/CitationDocumentExtraction.test.ts` | 1/1 | 33.40 s |
| `test/CitationDocumentExtractionCoverage.test.ts` | 1/1 | 7.93 s |
| `test/CitationDocumentServices.test.ts` | 1/1 | 5.27 s |
| `test/CitationDump.test.ts` | 9/9 | 5.93 s |
| `test/CitationDumpCoverage.test.ts` | 4/4 | 2.93 s |
| `test/CitationEditionInference.test.ts` | 3/3 | 2.96 s |
| `test/CitationEngineBoundaryRefusal.test.ts` | 2/2 | 15.83 s |
| `test/CitationEngineCorpus.test.ts` | 1/1 | 36.08 s |
| `test/CitationEngineLayer.test.ts` | 15/15 | 98.99 s |
| `test/CitationEngineResolution.test.ts` | 2/2 | 16.75 s |
| `test/CitationExtractionEntry.test.ts` | 1/1 | 21.87 s |
| `test/CitationExtractionEntryCoverage.test.ts` | 2/2 | 9.23 s |
| `test/CitationExtractionLoop.test.ts` | 15/15 | 86.37 s |
| `test/CitationExtractionReport.test.ts` | 1/1 | 7.75 s |
| `test/CitationExtractionSelection.test.ts` | 1/1 | 2.57 s |
| `test/CitationExtractorControls.test.ts` | 0/24; Node-parent red (`Bun.version`); hosted green per owner | 4.35 s |
| `test/CitationExtractorSelection.test.ts` | 5/5 | 2.14 s |
| `test/CitationFullExtraction.test.ts` | 2/2 | 13.37 s |
| `test/CitationFullExtractionCoverage.test.ts` | 1/1 | 2.65 s |
| `test/CitationFullLawMetadata.test.ts` | 2/2 | 4.43 s |
| `test/CitationGeneratedReferences.test.ts` | 2/2 | 23.40 s |
| `test/CitationHelperConfigurations.test.ts` | 3/3 | 3.02 s |
| `test/CitationHtmlBytes.test.ts` | 2/2 | 28.84 s |
| `test/CitationHtmlCaseName.test.ts` | 3/3 | 9.62 s |
| `test/CitationHtmlCleanerStage.test.ts` | 3/3 | 3.72 s |
| `test/CitationHtmlDiscovery.test.ts` | 2/2 | 6.96 s |
| `test/CitationHtmlDiscoveryCoverage.test.ts` | 2/2 | 2.46 s |
| `test/CitationHtmlGeometryPreparation.test.ts` | 3/3 | 3.75 s |
| `test/CitationHtmlInput.test.ts` | 9/9 | 2.50 s |
| `test/CitationHtmlNativeInput.test.ts` | 5/5 | 2.83 s |
| `test/CitationHtmlWorker.test.ts` | 11/11 | 3.80 s |
| `test/CitationHtmlWorkerCorpus.test.ts` | 3/3 | 41.26 s |
| `test/CitationHtmlWorkerCoverage.test.ts` | 2/2 | 2.04 s |
| `test/CitationInputDocument.test.ts` | 1/1 | 4.67 s |
| `test/CitationInputDocumentCoverage.test.ts` | 2/2 | 8.00 s |
| `test/CitationInvocation.test.ts` | 4/4 | 1.99 s |
| `test/CitationJournalMetadata.test.ts` | 4/4 | 6.70 s |
| `test/CitationLawMetadata.test.ts` | 6/6 | 5.48 s |
| `test/CitationLiteralCleaners.test.ts` | 8/8 | 2.46 s |
| `test/CitationLiteralUnicodeComposition.test.ts` | 4/4 | 5.83 s |
| `test/CitationMetadataStrings.test.ts` | 3/3 | 5.40 s |
| `test/CitationMetadataYear.test.ts` | 5/5 | 2.65 s |
| `test/CitationNativeAdmission.test.ts` | 13/13 | 1.98 s |
| `test/CitationNativeLane.test.ts` | 16/16 | 2.37 s |
| `test/CitationNativeLaneCleaner.test.ts` | 2/2 | 13.95 s |
| `test/CitationNativeLaneComposition.test.ts` | 4/4 | 4.72 s |
| `test/CitationNativeLaneReservation.test.ts` | 32/32 | 4.34 s |
| `test/CitationNativeLaneTransfer.test.ts` | 4/4 | 2.34 s |
| `test/CitationNativeProcess.test.ts` | 4/4 | 2.32 s |
| `test/CitationNativeProcessCoverage.test.ts` | 3/3 | 2.02 s |
| `test/CitationNativeSlices.test.ts` | 3/3 | 2.11 s |
| `test/CitationNativeSocket.test.ts` | 12/12 | 2.66 s |
| `test/CitationOccurrenceProjectionCoverage.test.ts` | 4/4 | 2.74 s |
| `test/CitationPairedSource.test.ts` | 2/2 | 30.44 s |
| `test/CitationParserCatalog.test.ts` | 2/2 | 4.63 s |
| `test/CitationPinExtraction.test.ts` | 4/4 | 5.96 s |
| `test/CitationPostCaseMetadata.test.ts` | 5/5 | 8.65 s |
| `test/CitationPreCaseMetadata.test.ts` | 4/4 | 4.83 s |
| `test/CitationPythonCase.test.ts` | 4/4 | 2.22 s |
| `test/CitationPythonCaseCoverage.test.ts` | 2/2 | 2.03 s |
| `test/CitationPythonHash.test.ts` | 4/4 | 2.47 s |
| `test/CitationPythonRepr.test.ts` | 5/5 | 3.35 s |
| `test/CitationPythonReprCoverage.test.ts` | 2/2 | 2.11 s |
| `test/CitationPythonUnicode.test.ts` | 7/7 | 2.74 s |
| `test/CitationRecognizerWorker.test.ts` | 12/12 | 5.36 s |
| `test/CitationReferenceNames.test.ts` | 1/1 | 2.32 s |
| `test/CitationReferencePatterns.test.ts` | 1/1 | 5.25 s |
| `test/CitationReferencePatternsCoverage.test.ts` | 4/4 | 2.43 s |
| `test/CitationReferenceToken.test.ts` | 2/2 | 14.52 s |
| `test/CitationReferenceTokenExtractionCoverage.test.ts` | 3/3 | 4.40 s |
| `test/CitationRegexAlphabet.test.ts` | 8/8 | 2.14 s |
| `test/CitationRegexBoundaries.test.ts` | 2/2 | 10.25 s |
| `test/CitationRegexCaptureReuse.test.ts` | 2/2 | 9.99 s |
| `test/CitationRegexCaseFlags.test.ts` | 2/2 | 7.35 s |
| `test/CitationRegexDescriptors.test.ts` | 8/8 | 2.05 s |
| `test/CitationRegexEngine.test.ts` | 4/4 | 3.69 s |
| `test/CitationRegexInput.test.ts` | 11/11 | 2.24 s |
| `test/CitationRegexLookahead.test.ts` | 2/2 | 5.90 s |
| `test/CitationRegexNullable.test.ts` | 2/2 | 3.77 s |
| `test/CitationRegexOperation.test.ts` | 3/3 | 2.29 s |
| `test/CitationRegexProgram.test.ts` | 14/14 | 2.24 s |
| `test/CitationRegexResult.test.ts` | 13/13 | 2.12 s |
| `test/CitationRegexVerbose.test.ts` | 3/3 | 7.16 s |
| `test/CitationRegexWorker.test.ts` | 19/19 | 3.82 s |
| `test/CitationRegexWorkerProtocol.test.ts` | 14/14 | 2.17 s |
| `test/CitationRendering.test.ts` | 5/5 | 18.77 s |
| `test/CitationRenderingOperation.test.ts` | 1/1 | 2.42 s |
| `test/CitationReplayBudget.test.ts` | 3/3 | 2.14 s |
| `test/CitationResolverBoundary.test.ts` | 6/6 | 3.28 s |
| `test/CitationResourceCorrection.test.ts` | 9/9 | 7.82 s |
| `test/CitationSemanticExtraction.test.ts` | 1/1 | 34.04 s |
| `test/CitationSemanticProjection.test.ts` | 6/6 | 2.80 s |
| `test/CitationSemanticProjectionCoverage.test.ts` | 3/3 | 2.52 s |
| `test/CitationShortMissingPage.test.ts` | 3/3 | 21.23 s |
| `test/CitationSixFormProjection.test.ts` | 1/2; Node-parent red (`Bun.version`); hosted green per owner | 7.06 s |
| `test/CitationSixFormProjectionControls.test.ts` | 7/7 | 2.63 s |
| `test/CitationSourceAnnotation.test.ts` | 6/6 | 4.82 s |
| `test/CitationSourceAnnotationTiming.test.ts` | 2/2 | 3.02 s |
| `test/CitationSourceCleaning.test.ts` | 3/3 | 2.81 s |
| `test/CitationSourceDocument.test.ts` | 4/4 | 23.10 s |
| `test/CitationSourceEvidence.test.ts` | 3/3 | 3.52 s |
| `test/CitationSourceRequest.test.ts` | 10/10 | 3.23 s |
| `test/CitationSpanOffsets.test.ts` | 5/5 | 2.86 s |
| `test/CitationStopWords.test.ts` | 3/3 | 13.96 s |
| `test/CitationTextBudget.test.ts` | 6/6 | 4.49 s |
| `test/CitationTokenContext.test.ts` | 3/3 | 5.80 s |
| `test/CitationTokenObjects.test.ts` | 3/3 | 2.68 s |
| `test/CitationTokenText.test.ts` | 4/4 | 2.84 s |
| `test/CitationTokenizedExtraction.test.ts` | 1/1 | 35.91 s |
| `test/CitationTokenizedExtractionCoverage.test.ts` | 1/1 | 5.39 s |
| `test/CitationTokenizer.test.ts` | 11/11 | 3.87 s |
| `test/CitationTokenizerCatalog.test.ts` | 3/3 | 7.04 s |
| `test/CitationVerifiedExtraction.test.ts` | 1/1 | 39.26 s |
| `test/CitationXmlWorker.test.ts` | 3/3 | 7.01 s |
| `test/vitest-shards-plan.test.ts` | 2/2 | 4.41 s |

The separately requested `test/integration/CitationFullLawMetadata.test.ts`
passes 1/1 (768 observations, original 936 spawned / 936 confirmed), 133.29 s
Vitest wall time, with the package's integration/native-wallclock project config.
No other integration file was launched in this hosted repair round.

### Required local gates

| Check | Result |
| --- | --- |
| Server `bun run check` | Pass: source declarations and test typecheck |
| Server quick package verification | Pass: lint 0.6 s, check 2.9 s |
| Server `lint:laws` | Pass; three existing terse-effect advisories, no enforced findings |
| Exact fallow audit against origin/main | Pass, zero introduced blocking findings; 15 inherited findings excluded, 19 clone groups advisory |
| Effect Vitest | Pass: 3,927 files, 639 findings, introduced 0 / resolved 1 |
| Schema-first | Pass: live/tracked 282/282, missing 0 / stale 0; no inventory changes |
| Biome | Pass: 13 final touched source/test/data files; package lint covers the complete package |
| Decisions projection | Pass, invalid 0 / drift 0 |
| Additional root oxlint and local docgen | Pass |

An import-order error introduced during fixture repair was corrected before the
successful quick verification. The schema-first inventory did not grow. An accidentally started root check was cancelled; the
requested server-only check completed successfully. No test process was
cancelled or left running.

No whole-package suite, whole-package coverage or other integration cohort was
run. Hosted CI was read for attribution but has not been rerun or represented as
green. The owner publishes the local commits and answers/resolves remote review
threads. No push, PR mutation, rebase or stash operation was performed here.

### Final count gate (last test process)

CitationCanonicalFullSpan passes 12/12 in 67.29 s process wall time. Starting
load (1/5/15 minutes) was 10.92 / 12.20 / 11.36. The existing fixture asserts
all rows, including the construction row and the Node first-call parity leg.

| Count | Published B1 head | Hosted repair head |
| --- | ---: | ---: |
| Regex children, ten plain-text calls | 291 | 291 |
| Native lane unit claims, ten calls | 10 | 10 |
| Construction metadata installs | 16 | 16 |
| Construction configuration detaches | 1 | 1 |
| Construction tokenizer builds | 1 | 1 |
| Construction evaluator installs | 26 | 26 |
| Construction native owners / lane claims / children | 1 / 0 / 0 | 1 / 0 / 0 |

Corrected after the owner revert: 170 distinct files in this inventory, 759
passing / 26 Node-parent failures out of 785 tests. The 165 green audit files
contain 740 tests; the three red files contain six passes / 26 failures. The
integration file adds one pass and the canonical file twelve passes. Hosted
green status for the three reverted files is the owner’s reported result, not
a claim that their Node-parent runs pass.
All test processes completed before commit/report. Local commits are for owner
publication; PR #3336 remains at its previously published head until then.


## Review follow-through after owner head b749cd91e7e

The owner published the earlier repair wave, reverted three parent-runtime-only
test edits and removed the copied six-form data/decision. Those files remain
untouched in this round. The owner also restored the original HTML bytes producer
recovery comment for the goal-data consumer census. Existing goal-path references
are retained; this round adds no test reference to goal data.

### Record-local quarantine

Markup reap took a snapshot of records, then reset the entire quarantine count.
A record registered after that snapshot could lose its quarantine without
confirmation and later decrement the count below zero. Remove the aggregate reset.
NativeProcess's confirmed retirement rechecks isRunning, closes the child Scope
and runs binding.release. The standalone release then drains notification.confirm's
listeners once. Markup's callback forgets that exact record and decrements only
if its uncertain flag was set by that job's failed retirement. If acknowledgement
wins first, the failed-retirement path does not increment. Otherwise exactly one
increment is matched by one notification decrement. A successful reap therefore
clears each captured record through its callback; no aggregate reset is needed.

The direct markup-supervisor fixture uses real children and captures A in reap,
pausing that retirement before
B starts. B's cleanup deadline expires while its SIGKILL acknowledgement is held.
After A confirms, quarantine remains one and starts are refused. B's late
confirmation returns the count to zero; repeated reap remains zero, admission
returns to baseline and spawned equals confirmed (2/2). Both Bun and Node child
legs fail with the old reset restored (observed quarantine 0, expected 1), then
pass with the fix. The final full HtmlWorker file rerun is listed below.

### Deterministic request overlap

Composition now gates its first two observing-spawner returns on a Deferred.
Each child is physically spawned before the barrier; neither request proceeds
until both children exist. The exact peak assertion remains two for two requests
and one for a single request. The other peak-two lane proof already waits for
both live child bodies at a Deferred; the remaining exact peaks are serial ones.
No production scheduling or admission rule changes.

### Corrected provider audit

Fresh Node-parent reruns reproduce configuration ownership 5 passed / 1 failed,
extractor controls 0 passed / 24 failed and six-form projection 1 passed / 1 failed.
All failures occur constructing CitationExtractorConfiguration with Bun.version;
the Node test shim has no version field. The six-form Node child leg passes.
The historical table above is corrected to 165 green files / 740 tests, plus
three red files with six passes / 26 failures. Hosted green status for those
three files was supplied by the owner; fresh Bun-parent runs also pass 6/6, 24/24 and 2/2 respectively (17.37 s, 4.03 s and 5.65 s process wall time).

The hosted repo-cli failure was the census assertion requiring the restored HTML
bytes goal reference. Test Unit and Heavy Coverage Regression failed their
upstream-unit gates. Their logs were read and their inbox rows attributed to the
owner's restoring commit b749cd91e7e, rather than presented as new coverage data.


### Coverage repair wave (owner extension)

Hosted job [132419052799](https://github.com/beep-effect/beep-effect/actions/runs/43584788170/job/132419052799)
measured head b749cd91e7e72065104d5f7c60d2b34157ebbdd4. Its complete
regression list names CleanerPipeline, DiffWorker, HtmlWorker, MarkupWorker,
NativeProcess and RegexWorker. NativeLane is the only new production source file
relative to origin/main and was also below 100%; it is included here.

All new measurements run one test file per process with --coverage and explicit
source includes. No whole-package coverage or baseline edit is used. Each test
has observable output, refusal, lifecycle or counter assertions. Single-file
reports are partial by design. The following combined rows merge the eight
hosted law-practice artifacts with those reports using Istanbul coverage maps
for unchanged sources. MarkupWorker changed by deleting the reset; its combined
row instead uses only current-source single-file HtmlWorker, XmlWorker and
MarkupWorkerCoverage reports. This is an artifact union, not a newly measured
whole-suite result and not a claim that hosted CI has rerun on the local commit.

The coverage command is nice -n 19 bunx vitest run test/<File>.test.ts --coverage
--coverage.include=src/internal/Citation/<Source>.ts --coverage.reporter=json
--coverage.reporter=text, with a separate reports directory for each run.
NativeLaneCoverage includes NativeLane and NativeProcess; HtmlWorker includes
HtmlWorker and MarkupWorker; XmlWorker includes MarkupWorker. The remaining
coverage test names map directly to the source rows in the path table below.

Percentages below are lines / statements / branches / functions:

| Source | Hosted job | Artifact union after tests |
| --- | --- | --- |
| CleanerPipeline | 99.30 / 99.37 / 100 / 97.91 | 100 / 100 / 100 / 100 |
| DiffWorker | 93.50 / 89.65 / 66.66 / 80.55 | 97.40 / 95.40 / 100 / 88.88 |
| HtmlWorker | 98.03 / 98.24 / 100 / 95.23 | 100 / 100 / 100 / 100 |
| MarkupWorker | 93.58 / 93.33 / 83.33 / 93.93 | 100 / 100 / 100 / 100 |
| NativeProcess | 100 / 99.21 / 97.29 / 100 | 100 / 100 / 100 / 100 |
| RegexWorker | 93.10 / 91.93 / 73.33 / 85.18 | 98.27 / 98.38 / 100 / 96.29 |
| NativeLane (new source) | 97.74 / 94.59 / 82 / 90.69 | 99.24 / 99.32 / 100 / 97.67 |

Every reported regression floor is cleared by this union. Six invariant guard
sites remain uncovered and are retained below. No typed refusal was converted
to a defect; no guard, coverage baseline, default-parameter coverage trick or
ignore directive was added/removed for coverage. The two intentional defect
fixtures exercise the existing onRetired callback and lease-release defect
boundaries with real children; they do not convert any typed refusal to a defect.

### Each originally uncovered path

Line numbers refer to the hosted source, except the removed Markup reset and
following lines, which are identified explicitly. Test names below are exact
unless a runtime substitution is shown.

| Source and path | Test and observable proof |
| --- | --- |
| CleanerPipeline:239 lane-failure translation | CitationCleanerPipelineCoverage: maps a closed lane yield to a cleaner runtime refusal without invoking the host; runtime-failed, zero host calls, work closed with zero text |
| DiffWorker:62 Boolean decode refusal | Retained typed-input guard; see guard table |
| DiffWorker:91 closed installation | CitationDiffLaneCoverage: refuses a closed diff installation before reservation or spawn; closed, zero claims/spawns |
| DiffWorker:100 failed-record duplicate branch; :103 lane-error translation; :118 nonempty reap | CitationDiffLaneCoverage: retries an unconfirmed real diff retirement without duplicating its quarantine; two failed retires leave one failed record, retry confirms 1/1 and clears it |
| DiffWorker:115 child-error translation | CitationDiffLaneCoverage: translates a failed OS spawn through the exact child record; spawn-failed, no live record or unit |
| DiffWorker:123 asset URL refusal | CitationDiffLaneCoverage: maps a kernel URL refusal before constructing an evaluator; invalid-runtime, one path lookup, zero spawns |
| DiffWorker:129 Unicode deadline branch | CitationDiffLaneCoverage: translates the inner Unicode deadline while the enclosing timer is held; extractDeadline, at least two timer requests, zero spawns. An isolated test-name run confirms branch hits [1, 0] at :129 |
| DiffWorker:131 Unicode input ceiling branch | CitationDiffLaneCoverage: refuses diffInputUtf16 before reserving or starting a child; uncharged budget, zero claims/spawns |
| DiffWorker:148 lane-failure arm | CitationDiffLaneCoverage: translates a lane closed between reservation and spawn; actual closed lane, unit returned, zero children |
| DiffWorker:148 safety-refusal arm | CitationDiffLaneCoverage: preserves a start-time queue refusal after an intervening cleaner yield; real external child and full shared queue, queuedOperations, blocker confirmed 1/1 |
| DiffWorker:153 duplicate-transfer callback | Retained private-operation guard; see guard table |
| DiffWorker:179-180 aggregate text ceiling | CitationDiffLaneCoverage: refuses producedTextUtf16 before reserving or starting a child; zero charge/claim/spawn |
| DiffWorker:198-199 missing prepared values | Retained successful-preparation invariants; see guard table |
| HtmlWorker:169 public reap | CitationHtmlWorker: executes the real bundled kernel and acknowledges cleanup before returning; reap is called before the existing zero-state assertion and independent PID checks |
| MarkupWorker:85-92 reap loop, including forget | CitationHtmlWorker: keeps a concurrent bun/node quarantine when reap confirms an earlier record; real A/B race, count remains one, then zero, 2/2 exits. The blanket reset at old :92 is removed as the reviewed defect |
| MarkupWorker:89 both error arms | CitationMarkupWorkerCoverage: preserves a live bun/node record when reap receives a lane/deadline refusal; exact translated tag, live record retained, then actual 1/1 confirmed cleanup |
| MarkupWorker:171 acknowledged retirement branch (now :170) and :176 lane error arm (now :175) | CitationMarkupWorkerCoverage: does not quarantine an already acknowledged bun/node retirement error; actual retirement completes before injected adapter error, count stays zero, 1/1 exits |
| MarkupWorker:136 start lane-failure arm (now :135) | CitationMarkupWorkerCoverage: translates a closed standalone starter and releases the untransferred private slot; closed, active/processes/quarantine all zero |
| MarkupWorker:136 start safety arm (now :135) | CitationMarkupWorkerCoverage: returns its private slot when shared admission refuses the standalone start queue; real blocker, queuedOperations, private active zero, actual blocker 1/1 |
| MarkupWorker:55 annotate deadline choice | CitationXmlWorker real Bun/Node balance and cleanup cases, measured separately against MarkupWorker |
| NativeProcess:230 physical-owner quarantine refusal | CitationNativeLaneCoverage: refuses a quarantined bun/node physical owner until a retry confirms the exact child; unconfirmed retirement, no replacement, confirmed 1/1 retry and baseline capacity |
| RegexWorker:93 ensureOpen error mapping | CitationRegexLaneCoverage: translates a lane closed before evaluation without spawning; actual closed Scope, worker closed refusal |
| RegexWorker:97 lane-failure arm | CitationRegexLaneCoverage: translates a lane closed after reservation without spawning; reserved unit returned before actual closed start |
| RegexWorker:97 safety-refusal arm | CitationRegexLaneCoverage: preserves a regex start-time queue refusal after an intervening cleaner yield; real blocker and full queue, queuedOperations, confirmed 1/1 blocker |
| RegexWorker:106 retirement lane-error arm | CitationRegexLaneCoverage: translates an unconfirmed real regex retirement and settles it on Scope retry; cleanup-unconfirmed, quarantine retained, actual child confirmed 1/1 on retry |
| RegexWorker:110 child-error mapping | CitationRegexLaneCoverage: translates an actual failed OS spawn and confirms the empty process record; spawn-failed, started/confirmed 0/0, capacity baseline |
| RegexWorker:132 duplicate-transfer callback | Retained private-operation guard; see guard table |
| RegexWorker:137 installed match ceiling | CitationRegexLaneCoverage: refuses an absolute-schema-valid match quota above the installed policy before reservation; patternMatches refusal, zero claims/spawns |
| NativeLane:107 late retirement subscriber | CitationNativeLaneCoverage: settles a failed OS spawn and immediately notifies a late retirement subscriber once; callback fires once after confirmation and repeated retire cannot repeat it |
| NativeLane:132 owner failure factory; :220/:235 failed-spawn arms | Same failed-OS-spawn lane test; real missing executable produces failed child Exit with no started/confirmed inflation |
| NativeLane:188 closed admission after acquisition | CitationNativeLaneCoverage: returns the unit if admission closes immediately after a successful claim; actual admission Scope closes, successful claim count one, active zero |
| NativeLane:191 missing private permit | Retained lock-protected invariant; see guard table |
| NativeLane:195/:257/:279 closed entries | CitationNativeLaneCoverage: refuses every lane entry after its Scope closes without acquiring or spawning; start/reserve/ensureOpen/yield all refuse closed, zero claims/spawns |
| NativeLane:218 duplicate-confirmation and :224 absent-permit guards | CitationNativeLaneCoverage: does not double-count confirmation or release an absent permit when a retirement listener defects; actual child confirms before listener defect, retry runs binding release again, started/confirmed remain 1/1 and callback once |
| NativeLane:231 cleanup-defect handler | CitationNativeLaneCoverage: preserves interruption when returning an unspawned claim encounters a release defect; actual seeded child 1/1, second claim interrupted before spawn, Exit retains interruption without the cleanup defect, Scope retry settles capacity |
| NativeLane:366 standalone failed-transfer release | CitationNativeLaneCoverage: releases a standalone claim when its physical owner closes before spawn; actual owner Scope closes after admission claim, closed refusal, zero child births and active zero |

### Retained unreachable typed guards

These are not deleted or forced through unsound input casts. Each listed site
has zero statement/function hits in the artifact union. All branch metrics are
100%; these residuals affect only the line/statement/function rows shown above.

| Guard | Why current typed callers cannot reach it |
| --- | --- |
| DiffWorker:62 Boolean-decode mapper | makeCitationDiffWorker's useDmp parameter is Boolean; all internal typed callers supply a Boolean or omit it. The runtime boundary guard is retained for untyped/unsound callers |
| DiffWorker:153 invalid transfer callback | The private evaluator's preflight calls operation.acquire once at :182 and operation.start once at :209, in that order. The invalid callback handles repeated acquire/start or a start without its permit; that operation object does not escape the private task |
| DiffWorker:198 missing after-value mapper | Successful inner fromStorageReserved always runs the :187-190 tap assigning after. Failures short-circuit before :198. PythonUnicode:509-522 runs its reservation callback and receiving validation before returning success |
| DiffWorker:199 missing measured-layout mapper | Success through the same preparation assigns measured at :183 after operation.acquire. Any earlier callback/refusal fails the task, so :199 cannot observe None after successful preparation |
| RegexWorker:132 invalid transfer callback | The private job task supplies operation.acquire only as the preparation callback (:143) and calls operation.start once (:156). RegexWorkerProtocol:229 invokes beforeAllocate once after successful preflight; neither operation capability escapes to a caller |
| NativeLane:191 missing permit mapper | Under the lane lock, acquire assigns Some at :181 when absent. The only intervening release is the bad admission-status path, which returns a failure at :188. No other fiber can clear the private permit before :190 |

The remaining source rows are DiffWorker 97.40 / 95.40 / 100 / 88.88,
RegexWorker 98.27 / 98.38 / 100 / 96.29, and new NativeLane
99.24 / 99.32 / 100 / 97.67. They are reported to the owner as retained guard
coverage, rather than hidden with ignores, weakened guards or a baseline edit.

### Current-wave per-file receipts

All tables name individual test-file processes. Source coverage was enabled only
for the marked single-file runs. Times are process wall times unless marked V
(Vitest wall time). No test file overlapped another test file.

| Node-parent server file | Passed / total | Seconds |
| --- | ---: | ---: |
| `test/CitationAnnotationAssembly.test.ts` | 5/5 | 7.52 |
| `test/CitationAnnotationCallback.test.ts` | 2/2 | 14.70 |
| `test/CitationAnnotationCallbackBoundary.test.ts` | 2/2 | 3.12 |
| `test/CitationAnnotationEntry.test.ts` | 5/5 | 5.77 |
| `test/CitationAnnotationEntryCoverage.test.ts` | 2/2 | 3.28 |
| `test/CitationAnnotationFailure.test.ts` | 2/2 | 2.41 |
| `test/CitationAnnotationSkip.test.ts` | 1/1 | 11.47 |
| `test/CitationAnnotationStyle.test.ts` | 2/2 | 5.90 |
| `test/CitationAnnotationTemplate.test.ts` | 2/2 | 3.29 |
| `test/CitationAnnotationWrap.test.ts` | 3/3 | 9.14 |
| `test/CitationBuiltinCleaners.test.ts` | 2/2 | 5.47 |
| `test/CitationBuiltinDiff.test.ts` | 6/6 | 23.24 |
| `test/CitationCanonicalAnnotation.test.ts` | 2/2 | 26.83 |
| `test/CitationCanonicalAnnotationWorkflow.test.ts` | 1/1 | 32.99 |
| `test/CitationCanonicalCourts.test.ts` | 1/1 | 32.31 |
| `test/CitationCanonicalExtraction.test.ts` | 7/7 | 45.62 |
| `test/CitationCanonicalExtractionRanges.test.ts` | 6/6 | 3.14 |
| `test/CitationCanonicalFullRendering.test.ts` | 2/2 | 24.85 |
| `test/CitationCanonicalLongDiff.test.ts` | 2/2 | 19.77 |
| `test/CitationCanonicalMissingConversion.test.ts` | 2/2 | 13.76 |
| `test/CitationCanonicalPageCorrection.test.ts` | 2/2 | 27.05 |
| `test/CitationCanonicalParsedEquality.test.ts` | 2/2 | 23.44 |
| `test/CitationCanonicalParserOperations.test.ts` | 1/1 | 20.78 |
| `test/CitationCanonicalPinSpan.test.ts` | 2/2 | 37.84 |
| `test/CitationCanonicalRanges.test.ts` | 2/2 | 20.61 |
| `test/CitationCanonicalReferenceMarkup.test.ts` | 2/2 | 26.39 |
| `test/CitationCanonicalRemainingExtraction.test.ts` | 1/1 | 27.39 |
| `test/CitationCapturedCleanerPlan.test.ts` | 2/2 | 19.89 |
| `test/CitationCleanerCustomCorpus.test.ts` | 3/3 | 7.18 |
| `test/CitationCleanerNamedCorpus.test.ts` | 1/1 | 5.90 |
| `test/CitationCleanerOwnedInput.test.ts` | 4/4 | 2.82 |
| `test/CitationCleanerParentBudget.test.ts` | 5/5 | 2.80 |
| `test/CitationCleanerPipeline.test.ts` | 18/18 | 2.81 |
| `test/CitationCleanerPipelineCoverage.test.ts` | 7/7 | 3.48 V, coverage |
| `test/CitationCleanerRegistry.test.ts` | 12/12 | 3.37 |
| `test/CitationCleanerUnicodeValues.test.ts` | 7/7 | 3.23 |
| `test/CitationCleanerValues.test.ts` | 8/8 | 2.90 |
| `test/CitationDiffLaneCoverage.test.ts` | 9/9 | 4.05 V, coverage |
| `test/CitationDocumentCleanerProtocols.test.ts` | 10/10 | 3.25 |
| `test/CitationEngineBoundaryRefusal.test.ts` | 2/2 | 14.90 |
| `test/CitationEngineCorpus.test.ts` | 1/1 | 35.82 |
| `test/CitationEngineLayer.test.ts` | 15/15 | 101.14 |
| `test/CitationEngineResolution.test.ts` | 2/2 | 20.29 |
| `test/CitationHtmlBytes.test.ts` | 2/2 | 32.73 |
| `test/CitationHtmlCaseName.test.ts` | 3/3 | 10.87 |
| `test/CitationHtmlCleanerStage.test.ts` | 3/3 | 3.96 |
| `test/CitationHtmlCompletion.test.ts` | 3/3 | 2.28 |
| `test/CitationHtmlDiscovery.test.ts` | 2/2 | 8.35 |
| `test/CitationHtmlDiscoveryCoverage.test.ts` | 2/2 | 2.90 |
| `test/CitationHtmlGeometryPreparation.test.ts` | 3/3 | 4.43 |
| `test/CitationHtmlInput.test.ts` | 9/9 | 3.59 |
| `test/CitationHtmlKernel.test.ts` | 18/18 | 3.38 |
| `test/CitationHtmlNativeInput.test.ts` | 5/5 | 3.34 |
| `test/CitationHtmlWorker.test.ts` | 13/13 | 4.34 V, coverage |
| `test/CitationHtmlWorkerCorpus.test.ts` | 3/3 | 44.48 |
| `test/CitationHtmlWorkerCoverage.test.ts` | 2/2 | 2.40 |
| `test/CitationHtmlWorkerProgram.test.ts` | 5/5 | 2.50 |
| `test/CitationHtmlWorkerProtocol.test.ts` | 6/6 | 2.65 |
| `test/CitationHtmlWorkerRpc.test.ts` | 3/3 | 2.26 |
| `test/CitationInputDocument.test.ts` | 1/1 | 5.13 |
| `test/CitationInputDocumentCoverage.test.ts` | 2/2 | 8.84 |
| `test/CitationLiteralUnicodeComposition.test.ts` | 4/4 | 6.32 |
| `test/CitationMarkupWorkerCoverage.test.ts` | 8/8 | 3.02 V, coverage |
| `test/CitationNativeLane.test.ts` | 16/16 | 3.35 |
| `test/CitationNativeLaneCleaner.test.ts` | 2/2 | 15.09 |
| `test/CitationNativeLaneComposition.test.ts` | 4/4 | 5.17 |
| `test/CitationNativeLaneCoverage.test.ts` | 8/8 | 2.88 V, coverage |
| `test/CitationNativeLaneReservation.test.ts` | 32/32 | 4.74 |
| `test/CitationNativeLaneTransfer.test.ts` | 4/4 | 2.63 |
| `test/CitationRegexLaneCoverage.test.ts` | 6/6 | 3.11 V, coverage |
| `test/CitationShortMissingPage.test.ts` | 3/3 | 22.29 |
| `test/CitationSourceAnnotation.test.ts` | 6/6 | 5.46 |
| `test/CitationSourceAnnotationTiming.test.ts` | 2/2 | 3.09 |
| `test/CitationSourceCleaning.test.ts` | 3/3 | 3.57 |
| `test/CitationVerifiedExtraction.test.ts` | 1/1 | 36.07 |
| `test/CitationXmlBalanceKernel.test.ts` | 2/2 | 2.74 |
| `test/CitationXmlBalanceKernelCoverage.test.ts` | 3/3 | 2.51 |
| `test/CitationXmlWorker.test.ts` | 3/3 | 5.92 V, coverage |
| `test/CitationXmlWorkerProtocol.test.ts` | 2/2 | 2.25 |

The Node-parent consumer/current-coverage cohort passes 79 files / 369
tests. This includes the two new real-process reap regressions and every original
markup/HTML/Xml/annotation-entry consumer selected by the direct factory/fixture
import closure, plus cleaner and input-document callers.

| Touched file, Bun parent | Passed / total | Process seconds |
| --- | ---: | ---: |
| `test/CitationNativeLaneCoverage.test.ts` | 8/8 | 2.16 |
| `test/CitationMarkupWorkerCoverage.test.ts` | 8/8 | 3.04 |
| `test/CitationRegexLaneCoverage.test.ts` | 6/6 | 2.65 |
| `test/CitationDiffLaneCoverage.test.ts` | 9/9 | 2.20 |
| `test/CitationCleanerPipelineCoverage.test.ts` | 7/7 | 3.83 |
| `test/CitationHtmlWorker.test.ts` | 13/13 | 5.15 |
| `test/CitationNativeLaneComposition.test.ts` | 4/4 | 4.84 |

These 55 Bun-parent cases are parity reruns of the touched tests, not
additional distinct test definitions.

| Unchanged owner-reverted file | Node parent | Bun parent |
| --- | --- | --- |
| CitationConfigurationOwnership | 5 passed / 1 failed, 17.97 s | 6/6, 17.37 s |
| CitationExtractorControls | 0 passed / 24 failed, 4.35 s | 24/24, 4.03 s |
| CitationSixFormProjection | 1 passed / 1 failed, 7.06 s | 2/2, 5.65 s |

The Node failures remain exactly the Bun.version schema-construction failures;
no edits to these files or their old goal reference were made. Fresh Bun-parent
proofs establish the difference locally, in addition to the owner's hosted report.

| Additional file | Result |
| --- | --- |
| packages/tooling/tool/cli/test/goal-data-consumer-census.test.ts | 4/4, 6.54 s Vitest; restored producer reference retained exactly |
| test/CitationCanonicalFullSpan.test.ts (last test process) | 12/12, 65.22 s process / 64.70 s Vitest; starting load 10.12 / 12.81 / 13.97 |

This round ran 84 distinct test files. The current successful cohorts contain
417 distinct test definitions (369 consumer/coverage, 32 unchanged files on Bun,
4 census, 12 final canonical), with the seven touched files also passing all 55
cases on the Bun parent. The three unchanged Node-parent runs remain explicitly
red: six passes / 26 failures. No claim of universal Node-parent success is made.

The new A/B regression was also run with the old blanket reset restored: both
real-runtime cases failed at quarantine 0 versus expected 1. The source fix was
restored before all final runs. Initial coverage-fixture failures were diagnosed:
a forkChild waiter died with its preparation timer fiber and removed contention;
forkScoped retains it until explicit cleanup. The first cooperative Unicode
timer is released after yielding once while subsequent enclosing timers remain
held; the isolated deadline test has the expected [1, 0] branch hits at Diff:129.
No production timer or refusal was changed to make those fixtures pass.

### Final verification and counts

| Gate | Result |
| --- | --- |
| Server bun run check | Pass: source declarations and test typecheck |
| Server package-verify --quick | Pass: lint 0.6 s / check 3.2 s |
| Server lint:laws | Pass; existing terse-effect advisories only, zero enforced findings |
| Root oxlint on all nine touched source/test/fixture files | Pass |
| Biome on those files and the inventory | Pass: ten files, no changes |
| Fallow audit against origin/main | Pass; zero introduced blocking findings, 19 clone groups advisory / 15 inherited findings excluded |
| Effect Vitest full scan | Pass: 3,932 files, 640 findings, introduced 0 / resolved 1 |
| Schema-first | Pass: no missing/stale entries or inventory changes |
| Local docgen | Pass |
| Decisions write | Pass; invalid 0 / drift 0 |

Effect Vitest's new hook-budget and opaque-platform findings were fixed in code.
One EV003 cleaner fixture is a reviewed exception under the existing per-request
invocation policy: its open request budget and independently closed lane Scope
cannot share a Layer lifetime. Only that touched test's rows changed; all other
inventory rows were compared against HEAD and are unchanged.

The final count gate still asserts 291 regex children and ten lane claims across
ten plain-text calls. Construction remains installs 16, detaches 1, tokenizer
builds 1, evaluators 26, native owners 1, lane claims 0 and child starts 0.
The coverage regression baseline is unchanged. No whole-package suite/coverage
or additional integration cohort was run; the requested consumer files were
run separately, with each heavy process capped at 285 seconds. Hosted CI was
read for attribution and artifacts; it has not rerun on these unpublished edits.
The owner publishes the local commit and handles remote review resolution.
