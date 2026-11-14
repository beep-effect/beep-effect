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

The transitive provider audit covers 168 individual unit files, 772 passing
tests. It uses the requested `nice -n 19 bunx vitest run <file>`
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
  `Bun.version` and fail only under a Node parent runner; hosted CI runs them green, so
  they are environment-only here and are unchanged from the base.

The first audit had six red files (annotation assembly, case metadata,
configuration ownership, extractor controls, journal metadata and law metadata).
All six pass their individual reruns. Configuration ownership and extractor controls are red only under the Node
parent runner (see the owner note above). The table records the latest successful run
of every audited file; it does not hide these earlier failures.

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
| `test/CitationConfigurationOwnership.test.ts` | 6/6 | 18.09 s |
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
| `test/CitationExtractorControls.test.ts` | 24/24 | 4.99 s |
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
| `test/CitationSixFormProjection.test.ts` | 2/2 | 6.07 s |
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

Together: 170 distinct test files, 785/785 tests (168 audit files / 772 tests,
one integration file / one test, and the final canonical file / twelve tests).
All test processes completed before commit/report. Local commits are for owner
publication; PR #3336 remains at its previously published head until then.
