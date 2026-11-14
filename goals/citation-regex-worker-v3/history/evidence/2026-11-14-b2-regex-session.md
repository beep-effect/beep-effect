# B2 regex session evidence

The earlier receipts below are retained as history. The latest verification is
[Review round 4](#review-round-4): all 277 Citation files, 1,323 passing tests,
zero failures or skips and 25 distinct single-file coverage measurements.
NativeLane, NativeProcess and all four session files reach 100% on every metric.

B2 is implemented on `feat/citation-regex-session` in
`~/YeeBois/projects/beep-effect-worktrees/citation-regex-session`.
Both design stops are resolved. The real-process proofs and count gate pass.
Verification ran every eligible Citation test file serially: **263 files,
254 passing files, 1145 passing tests and 23 failing tests across nine files**.
The remaining failures are captured-runtime fixture refusals described below;
they are not recorded as a green branch. No B1 merge, rebase, push or PR opening
was performed. B2 is in review, with B1 fixture alignment still required.

## Count gate and wall time

`CitationCanonicalFullSpan.test.ts` ran last, after all other files and reruns,
and passed **12/12**. Each of its ten Bun calls asserts its entire work-count row;
only the regex-process column was changed. Construction asserts its entire
unchanged row. The first call also passes on Node.

| Per ten plain-text Bun calls | B1 baseline | B2 measured |
| --- | ---: | ---: |
| Regex child processes | 291 | **10** |
| Regex evaluations | 291 | **291** |
| Metadata-operation installs | 0 | 0 |
| Configuration detaches | 0 | 0 |
| Tokenizer builds | 0 | 0 |
| Regex evaluator constructions | 0 | 0 |
| Descriptor bindings | 4 | 4 |
| Physical native owners | 10 | 10 |
| Native lane acquisitions | 10 | 10 |
| Diff/Xml worker constructions | 0 | 0 |
| FullSpan file wall seconds, including construction and Node parity | 58.86, recorded B1 receipt | **34.81**, measured B2 |

| Engine construction | B1 baseline | B2 measured |
| --- | ---: | ---: |
| Metadata-operation installs | 16 | 16 |
| Configuration detaches | 1 | 1 |
| Tokenizer builds | 1 | 1 |
| Regex evaluator constructions | 26 | 26 |
| Regex evaluations | 0 | 0 |
| Regex child processes | 0 | 0 |
| Descriptor bindings | 0 | 0 |
| Physical native owners | 1 | 1 |
| Native lane acquisitions | 0 | 0 |
| Diff/Xml worker constructions | 0 | 0 |

| Call | Evaluations, unchanged | B1 regex children | B2 regex children |
| --- | ---: | ---: | ---: |
| 1 | 70 | 70 | 1 |
| 2 | 15 | 15 | 1 |
| 3 | 15 | 15 | 1 |
| 4 | 24 | 24 | 1 |
| 5 | 19 | 19 | 1 |
| 6 | 15 | 15 | 1 |
| 7 | 65 | 65 | 1 |
| 8 | 38 | 38 | 1 |
| 9 | 15 | 15 | 1 |
| 10 | 15 | 15 | 1 |
| Total | 291 | 291 | 10 |

The B2 `/usr/bin/time` wall receipt is 34.81 seconds; vitest reports 34.36
seconds. Launch load was 9.64 / 10.17 / 10.95. B1's recorded launch load was
24.72 / 19.30 / 18.52. These are full-file timings, not isolated ten-call timings
or a latency comparison under matched load. Wall time gates nothing. No other
count column moved.

## Implementation and resolved stops

Both design stops are resolved. Owner ruling `3195ce21182` sets v3 job depth to
4 under the shared guard's unchanged root-inclusive count. V2 stays at depth 1.
Owner ruling `7f49115d725` requires the parent-selected engine on every job;
startup carries limits only. Both rulings are implemented, including strict
schema decoding after structural preflight, the finite flat/descriptor/profile/
capture-name property ceiling, and capture-name length checks against the
selected processMessageBytes ceiling before payload allocation. The exact frame
preflight includes engine, descriptor, names and sequence.

`CitationRegexSession` is a schema-backed Context.Service owned by each
invocation Scope. All regex evaluators dispatch through it. It starts lazily on
the invocation's native lane, with that lane's captured spawner and Clock.
A mismatch refuses invalid-runtime. A semaphore serializes sequence selection,
trusted preparation and dispatch; binding precedes preparation. The trusted
preparation callback gives the exact sequence to preflight before allocation.
The RPC request id equals that sequence.

The child consumes continuous LF frames with endOnDone:false. Its startup has
only limits; each job carries its engine and descriptor. Each job constructs a
fresh evaluation program. No compiled program, engine selection or cache is
retained between jobs. The parent owns one stdout reader in the physical child
Scope and a capacity-one reply queue. The idle reader's retirement supervisor
lives in the invocation Scope, outside the physical Scope, to avoid joining
itself while closing that Scope.

Startup and job timers are separate sleeps of regexDeadline. The job timer
includes RPC registration, frame write, Started and terminal result delivery.
Deadline, interruption and protocol failures poison the session, retire through
the existing parent-owned SIGKILL/isRunning/Scope-close path, and await confirmed
death before returning. A subsequent call also awaits pending idle retirement
before returning its closed failure. Quarantine on unconfirmed death is retained.
No poisoned session respawns. Intentional native-lane handover marks the idle
session absent before retirement; a later regex job may start a new physical
child after that handover. Public extraction shapes and limit values are unchanged.

V2 protocol, RPC, worker evaluation/program and tests remain. V2 and v3 share
layout preparation and exact framing. The byte reader's new continuous mode
preserves the old exact-count/EOF behavior for v2 and other workers. Native lane
exposure of its physical Scope, captured runtime services and pre-retirement
callback supports one reader and distinguishes expected handover from unexpected
EOF; the retirement implementation remains shared with Diff and Xml.

The sleep-counting test Clock retains every matching sleep and exposes indexed
triggerSleep. The catastrophic test releases sleep 1 (job), separately from sleep
0 (startup). Legacy trigger selects the first still-active sleep, ignoring
cancelled installation timers. The HTML two-operation total-deadline fixture now
triggers its two indexed sleeps explicitly. No production timer was changed.

## Real-process proofs

All names below occur in CitationRegexSession.test.ts, instantiated for bun and
node. The hostile fixtures spawn real OS children through the platform spawner;
the successful reuse/mixed-engine cases use the production bundled program.
Each failure proof asserts observed spawned=confirmed=1 and lane
started=confirmed=1 before returning, rather than relying only on Scope teardown.

| Obligation | Test name, with runtime placeholder | Bun | Node |
| --- | --- | --- | --- |
| Catastrophic regex, responsive parent, deadline and death before return | expires only the {runtime} job timer during a catastrophic regex and confirms death before return | Pass | Pass |
| Later job fails closed without spawning | fails closed without a {runtime} respawn after a killed job | Pass | Pass |
| Wrong sequence | kills and confirms {runtime} on wrong-sequence | Pass | Pass |
| Early-exit EOF | kills and confirms {runtime} on eof | Pass | Pass |
| Oversize frame | kills and confirms {runtime} on oversize | Pass | Pass |
| Frame while idle | kills and confirms {runtime} on a frame while idle | Pass | Pass |
| Sent interruption | confirms {runtime} death before acknowledging interruption during sent | Pass | Pass |
| Running interruption | confirms {runtime} death before acknowledging interruption during running | Pass | Pass |
| EOF while the child remains alive | SIGKILLs a live {runtime} child after stdout EOF and confirms death before return | Pass | Pass |
| Parent-selected engine changes in one process | runs python-re then python-regex-v0 in one {runtime} process | Pass | Pass |
| Invalid engine is a protocol deviation | kills a real {runtime} worker on a schema-invalid job engine | Pass | Pass |

The live EOF regression closes every duplicate fd referencing stdout's pipe
(including Bun's duplicates), writes an entered marker and stays alive. The
parent independently observes exactly one SIGKILL while isRunning is true and
confirmed death before evaluate returns. The early-exit case remains too. This
closes the earlier evidence gap; an already-exited child alone is no longer the
EOF proof. The catastrophic child intentionally bypasses the accepted compiler
to exercise containment, with a separate parent heartbeat before manual timer
expiry; this grants no new pattern-family approval.

The engine-switch regression executes a python-re job followed by the
python-regex-v0 pattern a(?i)b in one physical process. Parent python-re rejects
that second pattern as unsupported-syntax; regex-v0 matches aB. Both child
runtimes prove one spawn and one confirmed retirement. The protocol tests also
accept names at depth 4, refuse depth 5 before base64 payload allocation, enforce
name/frame size and reject unknown fields after preflight. No tests were deleted.

## Spawn-count assertions rewritten

These expectations now count invocation processes, retaining exact evaluation
counts and successful output assertions. No expectation was widened to a range.
The raw oracle call totals are still asserted where the corpus records them.

| Fixture / assertion | Before | After |
| --- | --- | --- |
| AnnotationWrap replay | 24 | 1 |
| CaseName smoke / ordinary budget | 72 / 9 | 7 / 1 |
| CaseName tight budget | bounded range | exact 1 |
| CaseNameProcess smoke / repeated budget / tight budget | 115 / 6 / 3 | 14 / 2 / 1 |
| CaseNameScan smoke / tight budget / installed-pattern lifetime | 198 / 3 / 4 | 36 / 1 / 1 |
| CaseNameSelection smoke | 91 | 35, including unchanged four geometry children per markup row |
| FullExtraction | 91 | 15 |
| GeneratedReferences | 173 | 146, including unchanged geometry |
| HtmlDiscovery smoke / owned-configuration replay | 46 / 2 | 23 / 1 |
| LawMetadata smoke | 17 | 14 |
| JournalMetadata | sum of evaluations | exact number of selected rows with a regex call |
| PinExtraction smoke | 26 | 21 |
| PostCaseMetadata smoke | 36 | 28 |
| ReferenceToken | 94 | 29 |
| StopWords smoke / repeated budget / tight budget | 84 / 6 / 3 | 28 / 2 / 1 |
| ExtractionLoop | greater than row count; self-referential release count | exact sum of nonempty-token invocation rows + four geometry children per markup row + the one tight-budget invocation |
| ExtractionLoop malformed input | release count derived from observation | exact 0 |
| NativeLaneCleaner successful regex before handover | already retired | started 1, confirmed 0, occupied true; after handover confirmed 1, occupied false |
| CanonicalFullSpan | 291 across ten calls | 10, one for each call |

ExtractionLoop's tight-budget assertion is exact before.spawned+1. Its geometry
counts remain four per markup preparation. NativeLaneCleaner's final total and
admission release checks are unchanged. ConfigurationOwnership and
SixFormProjection used Bun.version under the Node vitest runner, which is
undefined there; they now use the existing explicit synthetic engine-build
fixture runtime identity for these configuration tests.

CaseMetadata's expected replay count now uses one process per row with regex
work plus its unchanged four geometry children. TokenizerCatalog's single-call
expectation is 11 to 1; integration/CanonicalTokenizer's 17 selected-call rows
are 192 to 17. Those three tests still refuse at their runtime fixture boundary,
before reaching the rewritten count assertion; these expected counts are not
claimed as measured acceptance.

## Remaining runtime-fixture failures

All nine files fail at `Citation.checkRegexSessionRuntime`
(`RegexWorker.ts:64`, `RegexSession.ts:274-276`), or at a control assertion
expecting a later safety refusal that instead receives that invalid-runtime
failure. The guard compares the evaluator's captured Clock/spawner to the lane's
captured Clock/spawner. It remains strict. No real-process proof fails.

| File | Passed | Failed | Attribution / evidence |
| --- | ---: | ---: | --- |
| CitationAnnotationAssembly.test.ts | 4 | 1 | Implicit-map control opens withCitationTestInvocation without a policy at line 193, under setup.provided at line 234. The helper selects the scaffold Clock for the lane (Invocation.fixtures.ts:75-76) but provides callerClock to the body (line 92); the evaluator is installed under setup.provided at line 226. Thus the lane and evaluator have different Clock objects, while the spawner is the same. This is a B1 fixture-authority mismatch, left for B1 as instructed. |
| CitationCaseMetadata.test.ts | 0 | 2 | Runtime guard rejects replay and outer-budget paths. The budget control uses outer.setup.timer.clock at CaseMetadata.fixtures.ts:268, while the installed stage uses the distinct wall-time wrapper at lines 146-154. The additional replay refusal is recorded at the same guard; its nested identity split was not independently narrowed further. |
| CitationJournalMetadata.test.ts | 2 | 2 | Replay and budget receive invalid-runtime, the latter before producedTextUtf16. The fixture installs under makeCitationMetadataTestContext's wall Clock, and opens a separate explicit outer request in the budget control. The exact differing service in the replay path was not independently isolated beyond the guard. |
| CitationLawMetadata.test.ts | 4 | 2 | Full-law input and outer-budget controls receive invalid-runtime; the count-corrected ordinary replay passes. These use the explicit fixture invocation paths, rather than the runtime context captured by the installed evaluator. |
| CitationNativeLaneComposition.test.ts | 0 | 4 | All runtime/concurrency variants fail at the HtmlDiscovery placeholder evaluator's runtime guard. The fixture's enclosing lane and installed private stage do not share runtime authority; the differing service was not independently isolated beyond the guard. Existing three-child interleave assertions were retained. |
| CitationNativeLaneReservation.test.ts | 24 | 8 | All regex queue-full/expiry/quarantine/job-deadline variants are blocked by invalid-runtime; marker/admission wait controls consequently hit their watchdogs. The evaluator captures clock at lines 170-194; the enclosing invocation substitutes enclosureClock at lines 208-219. Diff/Xml variants pass. |
| CitationTokenizerCatalog.test.ts | 2 | 1 | Its real-citation control reaches the guard via the B1-reserved CitationTokenizer.fixtures.ts setup. Tokenizer maps the refusal to stage-failed. The new exact process count is not reached. |
| integration/CitationCanonicalTokenizer.test.ts | 0 | 2 | Both runtimes reach the same reserved tokenizer fixture guard and mapped stage-failed refusal. The new 17-process expectation is not reached. |
| integration/CitationJournalMetadata.test.ts | 0 | 1 | Complete replay reaches the same ContextMatcher runtime guard as its unit fixture. |

The six owner-reserved B1 test files and their fixture fixes were not edited.
The additional fixture-authority failures above are reported for that alignment;
this receipt does not claim that B1's pending fix has landed or that it resolves
every additional nested context. No guard was bypassed to obtain a green test.
The original eight canonical replay failures caused by startup-only engine
selection are resolved; their full replay files pass in this serial run.

## Checks

| Command | Result |
| --- | --- |
| Server bun run check | Pass: source declaration check and test typecheck |
| bun run beep quality package-verify @beep/law-practice-server --quick | Pass: final lint 0.7 s, check 3.5 s |
| Server bun run lint:laws | Pass; three pre-existing terse-effect advisories in PracticeKg.matters, UsptoClaims and ResolverText |
| bunx fallow audit --config .fallowrc.jsonc --base origin/feat/citation-native-lane | Pass: zero introduced dead code, complexity, duplication, styling or diff-risk; 33 inherited duplicate groups |
| bun run docgen:local | Pass: five successful package tasks, 20.561 s |
| bun run beep lint effect-vitest | Pass: 3929 files, introduced=0, resolved=0 |
| bun run beep lint schema-first | Pass; no inventory growth accepted and no --write used |
| Root lint:oxlint on every touched TS/TSX/MJS source/test file | Pass |
| Biome on touched tests and the MJS child | Pass, including commit hooks |
| git diff --check | Pass |
| Commit hooks | Pass: leak scan, Biome, typos, schema catalog and commitlint; source commits also regenerated instrumentation catalogs |

Effect APIs were checked against `.repos/effect`. No inline Schema compiler was
introduced inside a function. Fallow's initial two new clone groups from the
repeated count expressions were eliminated by naming the count before the
release assertion; the final introduced count is zero. No lint suppression,
safety-ceiling change, output change or pattern-family expansion was added.

## Serial file receipts

Inventory: 270 Citation test files. The requested seven exclusions leave 263
files, including the final FullSpan gate. There were 285 serial file runs before
that gate (262 initial files plus 23 focused reruns), then FullSpan last: 286
runs total. Each command was `nice -n 19 bunx vitest run test/<File>.test.ts`
from packages/law-practice/server, with the mise shim PATH. The table records
the final result per file, not a sum that double-counts reruns. Earlier failures
from stale count/timer expectations are retained in the change explanation
above. Local raw logs and the ordered run TSV remain under ignored `.beep/`.

| File | Passed | Failed | Final wall seconds |
| --- | ---: | ---: | ---: |
| `test/CitationAdmission.test.ts` | 7 | 0 | 3 |
| `test/CitationAnnotationAssembly.test.ts` | 4 | 1 | 4 |
| `test/CitationAnnotationCallback.test.ts` | 2 | 0 | 15 |
| `test/CitationAnnotationCallbackBoundary.test.ts` | 2 | 0 | 3 |
| `test/CitationAnnotationEntry.test.ts` | 5 | 0 | 7 |
| `test/CitationAnnotationEntryCoverage.test.ts` | 2 | 0 | 3 |
| `test/CitationAnnotationFailure.test.ts` | 2 | 0 | 3 |
| `test/CitationAnnotationSkip.test.ts` | 1 | 0 | 12 |
| `test/CitationAnnotationStyle.test.ts` | 2 | 0 | 4 |
| `test/CitationAnnotationTemplate.test.ts` | 2 | 0 | 3 |
| `test/CitationAnnotationWrap.test.ts` | 3 | 0 | 9 |
| `test/CitationAssetCoverage.test.ts` | 3 | 0 | 1 |
| `test/CitationAuthorityIdentity.test.ts` | 7 | 0 | 2 |
| `test/CitationBuiltinCleaners.test.ts` | 2 | 0 | 5 |
| `test/CitationBuiltinDiff.test.ts` | 6 | 0 | 38 |
| `test/CitationCallbackMutations.test.ts` | 2 | 0 | 3 |
| `test/CitationCallbackRuntimeIndex.test.ts` | 5 | 0 | 4 |
| `test/CitationCallbackSession.test.ts` | 16 | 0 | 3 |
| `test/CitationCallbackSessionCoverage.test.ts` | 5 | 0 | 3 |
| `test/CitationCanonicalAnnotation.test.ts` | 2 | 0 | 47 |
| `test/CitationCanonicalAnnotationWorkflow.test.ts` | 1 | 0 | 22 |
| `test/CitationCanonicalCourts.test.ts` | 1 | 0 | 17 |
| `test/CitationCanonicalDefaultFactory.test.ts` | 2 | 0 | 5 |
| `test/CitationCanonicalDump.test.ts` | 2 | 0 | 26 |
| `test/CitationCanonicalEditionYears.test.ts` | 1 | 0 | 3 |
| `test/CitationCanonicalExtraction.test.ts` | 7 | 0 | 54 |
| `test/CitationCanonicalExtractionRanges.test.ts` | 6 | 0 | 5 |
| `test/CitationCanonicalFullRendering.test.ts` | 2 | 0 | 18 |
| `test/CitationCanonicalFullSpan.test.ts` | 12 | 0 | 34.81 |
| `test/CitationCanonicalLongDiff.test.ts` | 2 | 0 | 29 |
| `test/CitationCanonicalMissingConversion.test.ts` | 2 | 0 | 14 |
| `test/CitationCanonicalPageCorrection.test.ts` | 2 | 0 | 19 |
| `test/CitationCanonicalParsedEquality.test.ts` | 2 | 0 | 18 |
| `test/CitationCanonicalParserOperations.test.ts` | 1 | 0 | 12 |
| `test/CitationCanonicalPinSpan.test.ts` | 2 | 0 | 22 |
| `test/CitationCanonicalRanges.test.ts` | 2 | 0 | 16 |
| `test/CitationCanonicalReferenceMarkup.test.ts` | 2 | 0 | 19 |
| `test/CitationCanonicalRemainingExtraction.test.ts` | 1 | 0 | 14 |
| `test/CitationCanonicalResourceComparison.test.ts` | 1 | 0 | 4 |
| `test/CitationCanonicalSource.test.ts` | 1 | 0 | 2 |
| `test/CitationCanonicalSourceCoverage.test.ts` | 2 | 0 | 3 |
| `test/CitationCanonicalStyle.test.ts` | 1 | 0 | 3 |
| `test/CitationCapturedCleanerPlan.test.ts` | 2 | 0 | 20 |
| `test/CitationCaseMetadata.test.ts` | 0 | 2 | 3 |
| `test/CitationCaseName.test.ts` | 2 | 0 | 4 |
| `test/CitationCaseNameCoverage.test.ts` | 2 | 0 | 4 |
| `test/CitationCaseNamePredicates.test.ts` | 4 | 0 | 4 |
| `test/CitationCaseNameProcess.test.ts` | 5 | 0 | 6 |
| `test/CitationCaseNameScan.test.ts` | 4 | 0 | 9 |
| `test/CitationCaseNameSelection.test.ts` | 1 | 0 | 7 |
| `test/CitationCaseResourceHash.test.ts` | 4 | 0 | 4 |
| `test/CitationCleanerCustomCorpus.test.ts` | 3 | 0 | 9 |
| `test/CitationCleanerNamedCorpus.test.ts` | 1 | 0 | 8 |
| `test/CitationCleanerOwnedInput.test.ts` | 4 | 0 | 4 |
| `test/CitationCleanerParentBudget.test.ts` | 5 | 0 | 4 |
| `test/CitationCleanerPipeline.test.ts` | 18 | 0 | 4 |
| `test/CitationCleanerPipelineCoverage.test.ts` | 6 | 0 | 4 |
| `test/CitationCleanerRegistry.test.ts` | 12 | 0 | 3 |
| `test/CitationCleanerUnicodeValues.test.ts` | 7 | 0 | 5 |
| `test/CitationCleanerValues.test.ts` | 8 | 0 | 3 |
| `test/CitationConfigurationOwnership.test.ts` | 6 | 0 | 20 |
| `test/CitationContextMatcher.test.ts` | 2 | 0 | 8 |
| `test/CitationCourtLookup.test.ts` | 8 | 0 | 14 |
| `test/CitationDefaultCallbacks.test.ts` | 10 | 0 | 8 |
| `test/CitationDefaultConfiguration.test.ts` | 3 | 0 | 15 |
| `test/CitationDictionaryReentrancy.test.ts` | 2 | 0 | 2 |
| `test/CitationDiffKernel.test.ts` | 13 | 0 | 3 |
| `test/CitationDiffKernelCoverage.test.ts` | 1 | 0 | 2 |
| `test/CitationDiffStepsCoverage.test.ts` | 3 | 0 | 3 |
| `test/CitationDiffWorker.input-admission.test.ts` | 1 | 0 | 2 |
| `test/CitationDiffWorker.test.ts` | 14 | 0 | 4 |
| `test/CitationDiffWorkerProtocol.test.ts` | 4 | 0 | 4 |
| `test/CitationDocumentCleanerProtocols.test.ts` | 10 | 0 | 4 |
| `test/CitationDocumentExtraction.test.ts` | 1 | 0 | 17 |
| `test/CitationDocumentExtractionCoverage.test.ts` | 1 | 0 | 7 |
| `test/CitationDocumentPersistence.test.ts` | 18 | 0 | 2 |
| `test/CitationDocumentServices.test.ts` | 1 | 0 | 3 |
| `test/CitationDump.test.ts` | 9 | 0 | 5 |
| `test/CitationDumpCoverage.test.ts` | 4 | 0 | 3 |
| `test/CitationEditionInference.test.ts` | 3 | 0 | 3 |
| `test/CitationEngineArtifact.test.ts` | 3 | 0 | 2 |
| `test/CitationEngineBoundaryRefusal.test.ts` | 2 | 0 | 24 |
| `test/CitationEngineCorpus.test.ts` | 1 | 0 | 26 |
| `test/CitationEngineFailure.test.ts` | 2 | 0 | 3 |
| `test/CitationEngineLayer.test.ts` | 15 | 0 | 146 |
| `test/CitationEngineResolution.test.ts` | 2 | 0 | 35 |
| `test/CitationExtractionContext.test.ts` | 2 | 0 | 2 |
| `test/CitationExtractionEntry.test.ts` | 1 | 0 | 11 |
| `test/CitationExtractionEntryCoverage.test.ts` | 2 | 0 | 11 |
| `test/CitationExtractionLoop.test.ts` | 15 | 0 | 28 |
| `test/CitationExtractionReport.test.ts` | 1 | 0 | 11 |
| `test/CitationExtractionSelection.test.ts` | 1 | 0 | 2 |
| `test/CitationExtractionShortcut.test.ts` | 1 | 0 | 3 |
| `test/CitationExtractorOrdering.test.ts` | 2 | 0 | 2 |
| `test/CitationExtractorRecipes.test.ts` | 2 | 0 | 3 |
| `test/CitationExtractorSelection.test.ts` | 5 | 0 | 3 |
| `test/CitationFrozenEditions.test.ts` | 6 | 0 | 3 |
| `test/CitationFullExtraction.test.ts` | 2 | 0 | 6 |
| `test/CitationFullExtractionCoverage.test.ts` | 1 | 0 | 3 |
| `test/CitationGeneratedReferences.test.ts` | 2 | 0 | 26 |
| `test/CitationHelperConfigurations.test.ts` | 3 | 0 | 3 |
| `test/CitationHostResources.test.ts` | 8 | 0 | 4 |
| `test/CitationHtmlCleanerStage.test.ts` | 3 | 0 | 4 |
| `test/CitationHtmlCompletion.test.ts` | 3 | 0 | 2 |
| `test/CitationHtmlDiscovery.test.ts` | 2 | 0 | 5 |
| `test/CitationHtmlDiscoveryCoverage.test.ts` | 2 | 0 | 2 |
| `test/CitationHtmlGeometryPreparation.test.ts` | 3 | 0 | 4 |
| `test/CitationHtmlInput.test.ts` | 9 | 0 | 3 |
| `test/CitationHtmlKernel.test.ts` | 18 | 0 | 8 |
| `test/CitationHtmlNativeInput.test.ts` | 5 | 0 | 3 |
| `test/CitationHtmlWorker.test.ts` | 11 | 0 | 4 |
| `test/CitationHtmlWorkerCorpus.test.ts` | 3 | 0 | 42 |
| `test/CitationHtmlWorkerCoverage.test.ts` | 2 | 0 | 2 |
| `test/CitationHtmlWorkerProgram.test.ts` | 5 | 0 | 2 |
| `test/CitationHtmlWorkerProtocol.test.ts` | 6 | 0 | 2 |
| `test/CitationHtmlWorkerRpc.test.ts` | 3 | 0 | 2 |
| `test/CitationInputDocument.test.ts` | 1 | 0 | 5 |
| `test/CitationInputDocumentCoverage.test.ts` | 2 | 0 | 9 |
| `test/CitationInvocation.test.ts` | 4 | 0 | 2 |
| `test/CitationJournalMetadata.test.ts` | 2 | 2 | 4 |
| `test/CitationLawMetadata.test.ts` | 4 | 2 | 5 |
| `test/CitationLiteralCleaners.test.ts` | 8 | 0 | 3 |
| `test/CitationLiteralUnicodeComposition.test.ts` | 4 | 0 | 5 |
| `test/CitationMention.test.ts` | 13 | 0 | 2 |
| `test/CitationMentionIdentity.test.ts` | 7 | 0 | 2 |
| `test/CitationMetadataStrings.test.ts` | 3 | 0 | 5 |
| `test/CitationMetadataYear.test.ts` | 5 | 0 | 3 |
| `test/CitationMixedResourceObjects.test.ts` | 2 | 0 | 3 |
| `test/CitationModelMutation.test.ts` | 2 | 0 | 2 |
| `test/CitationNativeAdmission.test.ts` | 13 | 0 | 3 |
| `test/CitationNativeAdmissionCoverage.test.ts` | 2 | 0 | 2 |
| `test/CitationNativeLane.test.ts` | 16 | 0 | 3 |
| `test/CitationNativeLaneCleaner.test.ts` | 2 | 0 | 20 |
| `test/CitationNativeLaneComposition.test.ts` | 0 | 4 | 3 |
| `test/CitationNativeLaneReservation.test.ts` | 24 | 8 | 84 |
| `test/CitationNativeLaneTransfer.test.ts` | 4 | 0 | 2 |
| `test/CitationNativeProcess.test.ts` | 4 | 0 | 2 |
| `test/CitationNativeProcessCoverage.test.ts` | 3 | 0 | 2 |
| `test/CitationNativeRpc.test.ts` | 6 | 0 | 1 |
| `test/CitationNativeSlices.test.ts` | 3 | 0 | 3 |
| `test/CitationNativeSocket.test.ts` | 12 | 0 | 2 |
| `test/CitationOccurrenceProjectionCoverage.test.ts` | 4 | 0 | 3 |
| `test/CitationPairedSource.test.ts` | 2 | 0 | 24 |
| `test/CitationParserCatalog.test.ts` | 2 | 0 | 7 |
| `test/CitationPinExtraction.test.ts` | 4 | 0 | 5 |
| `test/CitationPortFailure.test.ts` | 2 | 0 | 3 |
| `test/CitationPostCaseMetadata.test.ts` | 5 | 0 | 9 |
| `test/CitationPreCaseMetadata.test.ts` | 4 | 0 | 5 |
| `test/CitationPriorFulls.test.ts` | 2 | 0 | 2 |
| `test/CitationPublicationResourceHash.test.ts` | 5 | 0 | 1 |
| `test/CitationPythonCase.test.ts` | 4 | 0 | 3 |
| `test/CitationPythonCaseCoverage.test.ts` | 2 | 0 | 2 |
| `test/CitationPythonHash.test.ts` | 4 | 0 | 2 |
| `test/CitationPythonRepr.test.ts` | 5 | 0 | 3 |
| `test/CitationPythonReprCoverage.test.ts` | 2 | 0 | 3 |
| `test/CitationPythonUnicode.test.ts` | 7 | 0 | 3 |
| `test/CitationPythonUnicodeCoverage.test.ts` | 3 | 0 | 2 |
| `test/CitationRecognizerProgram.test.ts` | 3 | 0 | 2 |
| `test/CitationRecognizerWorker.test.ts` | 12 | 0 | 5 |
| `test/CitationReferenceNames.test.ts` | 1 | 0 | 4 |
| `test/CitationReferencePatterns.test.ts` | 1 | 0 | 6 |
| `test/CitationReferencePatternsCoverage.test.ts` | 4 | 0 | 3 |
| `test/CitationReferenceToken.test.ts` | 2 | 0 | 9 |
| `test/CitationReferenceTokenExtractionCoverage.test.ts` | 3 | 0 | 4 |
| `test/CitationRegexAlphabet.test.ts` | 8 | 0 | 2 |
| `test/CitationRegexBoundaries.test.ts` | 2 | 0 | 10 |
| `test/CitationRegexCaptureReuse.test.ts` | 2 | 0 | 10 |
| `test/CitationRegexCaseFlags.test.ts` | 2 | 0 | 8 |
| `test/CitationRegexCharacters.test.ts` | 2 | 0 | 1 |
| `test/CitationRegexDescriptors.test.ts` | 8 | 0 | 2 |
| `test/CitationRegexEngine.test.ts` | 4 | 0 | 4 |
| `test/CitationRegexInput.test.ts` | 11 | 0 | 2 |
| `test/CitationRegexInputCoverage.test.ts` | 2 | 0 | 2 |
| `test/CitationRegexLookahead.test.ts` | 2 | 0 | 6 |
| `test/CitationRegexNullable.test.ts` | 2 | 0 | 4 |
| `test/CitationRegexOperation.test.ts` | 3 | 0 | 2 |
| `test/CitationRegexPolicyCoverage.test.ts` | 2 | 0 | 2 |
| `test/CitationRegexProgram.test.ts` | 14 | 0 | 2 |
| `test/CitationRegexResult.test.ts` | 13 | 0 | 2 |
| `test/CitationRegexSession.test.ts` | 24 | 0 | 3 |
| `test/CitationRegexSessionProtocol.test.ts` | 4 | 0 | 2 |
| `test/CitationRegexTranslator.test.ts` | 7 | 0 | 2 |
| `test/CitationRegexVerbose.test.ts` | 3 | 0 | 8 |
| `test/CitationRegexWorker.test.ts` | 19 | 0 | 4 |
| `test/CitationRegexWorkerProtocol.test.ts` | 14 | 0 | 3 |
| `test/CitationRendering.test.ts` | 5 | 0 | 19 |
| `test/CitationRenderingOperation.test.ts` | 1 | 0 | 2 |
| `test/CitationReplayBudget.test.ts` | 3 | 0 | 2 |
| `test/CitationResolutionLimit.test.ts` | 2 | 0 | 3 |
| `test/CitationResolve.test.ts` | 10 | 0 | 2 |
| `test/CitationResolverBoundary.test.ts` | 6 | 0 | 4 |
| `test/CitationResolverText.test.ts` | 4 | 0 | 1 |
| `test/CitationResourceCorrection.test.ts` | 9 | 0 | 8 |
| `test/CitationResourceIdentity.test.ts` | 5 | 0 | 2 |
| `test/CitationResourceObjects.test.ts` | 3 | 0 | 2 |
| `test/CitationRuntimeDictionary.test.ts` | 4 | 0 | 2 |
| `test/CitationRuntimeDictionaryCoverage.test.ts` | 2 | 0 | 2 |
| `test/CitationRuntimeSet.test.ts` | 6 | 0 | 2 |
| `test/CitationSemanticExtraction.test.ts` | 1 | 0 | 16 |
| `test/CitationSemanticProjection.test.ts` | 6 | 0 | 3 |
| `test/CitationSemanticProjectionCoverage.test.ts` | 3 | 0 | 2 |
| `test/CitationSessionDescriptors.test.ts` | 3 | 0 | 3 |
| `test/CitationShortMissingPage.test.ts` | 3 | 0 | 27 |
| `test/CitationSixFormArtifact.test.ts` | 4 | 0 | 2 |
| `test/CitationSixFormProjection.test.ts` | 2 | 0 | 7 |
| `test/CitationSixFormProjectionControls.test.ts` | 7 | 0 | 3 |
| `test/CitationSixFormResolution.test.ts` | 9 | 0 | 7 |
| `test/CitationSourceAnnotation.test.ts` | 6 | 0 | 10 |
| `test/CitationSourceAnnotationTiming.test.ts` | 2 | 0 | 4 |
| `test/CitationSourceCleaning.test.ts` | 3 | 0 | 3 |
| `test/CitationSourceDocument.test.ts` | 4 | 0 | 15 |
| `test/CitationSourceEvidence.test.ts` | 3 | 0 | 3 |
| `test/CitationSourceRequest.test.ts` | 10 | 0 | 3 |
| `test/CitationSpanOffsets.test.ts` | 5 | 0 | 5 |
| `test/CitationStopWords.test.ts` | 3 | 0 | 8 |
| `test/CitationTableCapacity.test.ts` | 2 | 0 | 2 |
| `test/CitationTextCapacity.test.ts` | 4 | 0 | 3 |
| `test/CitationTextNativeOrder.test.ts` | 1 | 0 | 2 |
| `test/CitationTokenAssembly.test.ts` | 2 | 0 | 3 |
| `test/CitationTokenCapture.test.ts` | 3 | 0 | 3 |
| `test/CitationTokenContext.test.ts` | 3 | 0 | 4 |
| `test/CitationTokenDispatch.test.ts` | 3 | 0 | 3 |
| `test/CitationTokenEditions.test.ts` | 3 | 0 | 2 |
| `test/CitationTokenEquality.test.ts` | 2 | 0 | 3 |
| `test/CitationTokenObjects.test.ts` | 3 | 0 | 2 |
| `test/CitationTokenText.test.ts` | 4 | 0 | 2 |
| `test/CitationTokenizedExtraction.test.ts` | 1 | 0 | 12 |
| `test/CitationTokenizedExtractionCoverage.test.ts` | 1 | 0 | 5 |
| `test/CitationTokenizerCatalog.test.ts` | 2 | 1 | 5 |
| `test/CitationUnicodeDictionary.test.ts` | 4 | 0 | 2 |
| `test/CitationVerifiedExtraction.test.ts` | 1 | 0 | 18 |
| `test/CitationXmlBalanceKernel.test.ts` | 2 | 0 | 3 |
| `test/CitationXmlBalanceKernelCoverage.test.ts` | 3 | 0 | 2 |
| `test/CitationXmlWorker.test.ts` | 3 | 0 | 6 |
| `test/CitationXmlWorkerProtocol.test.ts` | 2 | 0 | 3 |
| `test/integration/CitationCanonicalAnnotationWorkflow.test.ts` | 4 | 0 | 61 |
| `test/integration/CitationCanonicalCourts.test.ts` | 3 | 0 | 58 |
| `test/integration/CitationCanonicalExtraction.test.ts` | 4 | 0 | 52 |
| `test/integration/CitationCanonicalExtractionRange2.test.ts` | 4 | 0 | 52 |
| `test/integration/CitationCanonicalExtractionRange3.test.ts` | 4 | 0 | 44 |
| `test/integration/CitationCanonicalExtractionRange4.test.ts` | 4 | 0 | 38 |
| `test/integration/CitationCanonicalExtractionRange5.test.ts` | 4 | 0 | 47 |
| `test/integration/CitationCanonicalExtractionRange6.test.ts` | 2 | 0 | 31 |
| `test/integration/CitationCanonicalParserOperations.test.ts` | 4 | 0 | 40 |
| `test/integration/CitationCanonicalParserOperationsRange2.test.ts` | 4 | 0 | 39 |
| `test/integration/CitationCanonicalReferenceMarkup.test.ts` | 2 | 0 | 21 |
| `test/integration/CitationCanonicalRemainingExtraction.test.ts` | 4 | 0 | 45 |
| `test/integration/CitationCanonicalRemainingExtractionRange2.test.ts` | 3 | 0 | 36 |
| `test/integration/CitationCanonicalTokenizer.test.ts` | 0 | 2 | 5 |
| `test/integration/CitationCleanerNamedHtml.test.ts` | 1 | 0 | 52 |
| `test/integration/CitationCleanerNativeCustom.test.ts` | 1 | 0 | 4 |
| `test/integration/CitationDiffWorker.test.ts` | 2 | 0 | 97 |
| `test/integration/CitationEditionInference.test.ts` | 1 | 0 | 4 |
| `test/integration/CitationEngineCorpus.test.ts` | 2 | 0 | 53 |
| `test/integration/CitationExtractorSelection.test.ts` | 1 | 0 | 5 |
| `test/integration/CitationHtmlUnicode.test.ts` | 1 | 0 | 54 |
| `test/integration/CitationInputDocument.test.ts` | 2 | 0 | 10 |
| `test/integration/CitationJournalMetadata.test.ts` | 0 | 1 | 2 |
| `test/integration/CitationRegexBoundaries.test.ts` | 16 | 0 | 111 |
| `test/integration/CitationRegexCaseFlags.test.ts` | 16 | 0 | 187 |
| `test/integration/CitationRegexTranslator.test.ts` | 2 | 0 | 127 |
| `test/integration/CitationRegexTranslatorNode.test.ts` | 2 | 0 | 127 |
| `test/integration/CitationVerifiedExtraction.test.ts` | 1 | 0 | 32 |

## Not run and behavior changes

Excluded as instructed: CitationHtmlBytes.test.ts, CitationTokenizer.test.ts,
CitationFullLawMetadata.test.ts, integration/CitationFullLawMetadata.test.ts,
CitationTextBudget.test.ts and CitationHtmlCaseName.test.ts (B1-owned), plus
CitationExtractorControls.test.ts (Bun.version under this runner). No whole
law-practice suite in parallel, coverage, hosted CI, new remote timing run,
push, PR opening, merge, rebase or stash was performed.

Successful regex evaluation leaves a bounded idle invocation child instead of
retiring a child after each evaluation. Bounded captures can be consumed while
that child is idle. Invocation closure and native-lane handover retire it;
unsuccessful job/reader waits retire and poison it. Those are the intentional
lifetime/count changes; extraction output and public CitationEngine shape do
not change. Exact spawn assertions that failed now were rewritten in B2 rather
than deferred to B3. V2 deletion and shard timing re-recording remain B3 work.

The implementation interpretations are stated above: a trusted preparation
callback assigns/preflights the serialized sequence under the semaphore;
the lane exposes its captured services/physical Scope and a handover callback;
the reader supervisor is invocation-scoped to avoid self-join; continuous
framing is an added mode preserving exact-count callers; legacy manual-trigger
selection ignores cancelled sleeps. The two protocol departures from design
rev 2 are precisely the owner's depth-4 and per-job-engine rulings. No further
design conflict was encountered.

## Review round 1

Implementation commits: `4c11b6b65b5` and `8c8f819ed1f`.

Independent review of `608c232c61e` accepted two BLOCKERs, one MAJOR and one
MINOR. This section supersedes the initial receipt's claims about preparation
allocation order and interruption/handover coverage. The initial tests did not
cover those gaps. The nine fixture-mismatch files were not edited in this round.
No push, merge, rebase or subagent was used.

### Reproduction and base attribution

The four supplied probes in `~/.cache/beep/b2-review/` were read and executed
before implementation. The allocation probe refused the 700-byte ASCII source
at processMessageBytes=1024 but had already allocated two 17-entry Uint32Array
pattern maps and a two-entry compiler array. The preparation-interruption probe
returned with one live unconfirmed child, then successfully reused it. Both the
Diff-start and cleaner-yield probes returned invalid-frame and killed a healthy
session after an expected retirement reset its sequence during preparation.

Base attribution was established from the actual refs, rather than assumed:

- `origin/main` at `01bc82b91ae9aaf13ab2e679da0281e9e9985341` calls
  preparation.prepare at RegexWorker.ts:118 before registry.bind at line 119.
- B1 (`origin/feat/citation-native-lane`) at
  `b749cd91e7e72065104d5f7c60d2b34157ebbdd4` calls preparation.prepare at
  RegexWorker.ts:138 before registry.bind at line 146.
- Both refs' RegexWorkerProtocol.ts:207-229 run the exact v2 preflight in the
  nested layout callbacks before either receiving capture/map is allocated.

Thus neither base allocated the pattern map before its own job preflight; B2
introduced the reversal while moving descriptor binding before v3 preparation.
This is static source attribution, not a separately executed base benchmark.
The fix keeps the design's stronger descriptor/engine/sequence-bearing exact
preflight, rather than reverting to the smaller v2 envelope.

The weak depth witness was also checked with maximumDepth=5: structural
preflight succeeds, yet the original invalid names/base64 input still fails
schema decoding. That demonstrates why the former invalid-frame assertion
could pass with the intended depth-4 protection missing.

### Findings, fixes and committed regressions

| Finding | Cause and fix | Regression name (each runtime placeholder is bun and node) |
| --- | --- | --- |
| BLOCKER: frame refusal after pattern allocation | registry.bind captured/projected the pattern and compiled before v3 preflight. The installed evaluator now selects the descriptor from bounded borrowed native words, enters serialized preparation, and checks the complete descriptor/engine/sequence/pattern/source frame before receiving payload/map allocation or lane reservation. It verifies the immutable captured fingerprint and compiler profile afterward. Standalone v2 bind keeps capture-before-fingerprint ordering. | preflights the installed {runtime} evaluator before pattern maps or compilation |
| BLOCKER: preparation interruption leaves reusable child | Cleanup was conditional on jobs increasing, so preparation was outside retirement. All preparation exits now pass through the same masked settlement as dispatch; interruption poisons, awaits confirmed retirement and returns the lease before acknowledgment, even without a child. | poisons {runtime} on preparation interruption with an idle child; poisons {runtime} on preparation interruption with no child |
| MAJOR: expected handover invalidates pending transport/sequence | The session mutex did not exclude lane retirement. lane.withUse now holds the lane's existing handover semaphore across sequence selection, preparation and dispatch, passing trusted already-locked start/reserve/release capabilities into timer fibers. Diff/cleaner handover waits for the evaluation to finish. | serializes {runtime} preparation against diff handover; serializes {runtime} preparation against cleaner handover |
| MINOR: depth test has independent schema/base64 failures | The witness now uses valid JSON/base64 at depth five accepted by its generic proof codec, a direct guard with distinct depth-exceeded failure, a passing depth-four parse control, and a JSON.parse spy. Neither the shared decoder nor the production v3 decoder reaches JSON/schema/base64 decoding on that depth-five input. | refuses depth five in structural preflight before base64 payload allocation |

The installed preflight regression observes the real global Uint32Array
constructor only around evaluate, restoring it in a finalizer. The reviewed
pattern `(?P<maybe>a)?(b)`, its names descriptor, 700 ASCII bytes and a 1024-byte
frame ceiling now refuse with zero map/compiler-array allocations, zero lane
acquisitions and zero spawns. The supplied original probe independently now
reports `receiving map allocations before refusal []`.

Descriptor selection still authenticates the bounded borrowed native words with
SHA-256; the width-prefixed fingerprint scratch buffer is not a receiving
Unicode payload/projection/map. Receiving capture and compilation follow exact
frame preflight. A second fingerprint on the immutable captured pattern rejects
caller mutation during the first asynchronous digest. The extra regression
`rechecks {runtime} captured pattern identity after descriptor selection awaits`
uses Deferred barriers and requires unknown-pattern with no spawned child.
The existing standalone descriptor ownership test remains intact.

For preparation interruption before any child exists, the implemented behavior
is permanent poisoning, not a reset to absent: it returns any already-reserved
lane unit and later jobs refuse without spawning. The no-child regression
reserves a unit before the preparation barrier, so it proves the stronger
no-stranded-unit case. This follows the never-respawn-after-interruption rule.
For an idle child, the same regression observes a real SIGKILL and PID removal
before Fiber.interrupt returns. The original supplied interruption probe now
reports confirmed=1, acquired=false and state=killed before its later refusal.

The chosen handover rule makes an in-progress evaluation finish before expected
retirement. A fiber-reentrant lock was rejected during implementation because
preparation timers fork fibers; reacquiring it in those fibers deadlocked. The
explicit already-locked capabilities avoid that reacquisition. yieldTo holds
the handover lock only for entry/exit, never for the cleaner body, so nested
cleaner plans can still fork. Both handover regressions hold preparation behind
a Deferred, start a concurrent handover, assert the child is still idle and
unretired, release preparation and require a successful result. After handover,
the session is absent; the next job starts a fresh child with sequence zero.
This is expected handover, the legitimate new spawn allowed by the lane
contract, not respawn after a fault. Diff interleave confirms 3 children and
one lane acquisition; cleaner yield confirms 2 children and two acquisitions.
Plain-text calls have no such handover, so their count target stays 10.

### Remaining await coverage

`confirms {runtime} retirement on interruption during {stage} await` covers
spawn acknowledgment, startup before Ready, request write, result read and
retirement itself. The real child/spawner streams and kill are wrapped with
Deferred barriers; no fake process is substituted. Result-read testing observes
Running, releases a child-side result barrier and interrupts while the one
stdout reader is paused on the terminal frame. Spawn and retirement tests prove
interruption acknowledgment waits while ownership/kill acknowledgment is still
held, with native capacity still active, then release that barrier.

`poisons {runtime} when interrupted waiting for evaluation serialization` covers
the session mutex wait. The original Sent and Running interruption tests remain.
Every new interruption case asserts started=confirmed, no occupied/acquired
lane, admission active/queued/quarantined=0, one observed live SIGKILL when a
child exists, and absent `/proc/<pid>` before interruption acknowledgment.
They directly count the real lease's release calls: exactly one before
acknowledgment and still one after Scope closure. Later evaluation must refuse
without a spawn or another lane acquisition. The no-child case has zero
starts/confirmed and still exactly one returned pre-reserved lease.

### Round 1 checks

These receipts use implementation head `8c8f819ed1f` (or its identical staged
source tree immediately before committing). Settlement preserves typed
retirement failures and the existing quarantine path; no typed cleanup refusal
was converted to orDie/getOrThrow or hidden by a safety suppression.

| Command | Result |
| --- | --- |
| Server bun run check | Pass: declaration emit/check and test typecheck |
| bun run beep quality package-verify @beep/law-practice-server --quick | Pass: lint 0.8 s, check 6.8 s |
| Server bun run lint:laws | Pass; the same three inherited terse-effect advisories |
| bunx fallow audit --config .fallowrc.jsonc --base origin/feat/citation-native-lane | Pass on 8c8f819ed1f: zero introduced dead code, complexity, duplication, styling or diff-risk; 33 inherited duplicate groups |
| bun run docgen:local | Pass: five successful tasks, 24.285 s |
| bun run beep lint effect-vitest | Pass: 3929 files, introduced=0, resolved=0 |
| bun run beep lint schema-first | Pass; no inventory growth accepted and no --write |
| Root lint:oxlint on the four changed source files, two test files and MJS child | Pass |
| Biome and commit hooks | Pass; the MJS child is formatted and instrumentation catalogs are generated by hooks |
| git diff --check | Pass |

Initial local check findings were repaired: the failure-only finalizer needed
an Exit/mask settlement to preserve typed retirement errors under Effect v4;
shared settlement removed a new clone; test registration was split with the
Array helper to remove new complexity; vi imports come from @effect/vitest;
and the transaction callback uses Effect.fnUntraced. None was waived and no
inventory baseline was enlarged. The exploratory fiber-reentrant-lock test run
was interrupted after exposing the timer-fiber deadlock; it is not a proof
receipt. The corrected final session file passed all 48 tests in the serial run.
The package check inbox row was acknowledged with fix commit `4c11b6b65b5`.

### Round 1 count gate and final file receipts

CitationCanonicalFullSpan.test.ts ran last and passed 12/12, after all other
files and final-implementation reruns. Its ten Bun rows still assert every
column, construction still asserts its full unchanged row, and Node parity
still passes. No count assertion was changed in this review round.

| Count | B1 per ten calls | Reviewed B2 per ten | Round 1 fixed per ten | Construction before / after review |
| --- | ---: | ---: | ---: | ---: |
| Regex child processes | 291 | 10 | **10** | 0 / 0 |
| Regex evaluations | 291 | 291 | **291** | 0 / 0 |
| Metadata-operation installs | 0 | 0 | 0 | 16 / 16 |
| Configuration detaches | 0 | 0 | 0 | 1 / 1 |
| Tokenizer builds | 0 | 0 | 0 | 1 / 1 |
| Regex evaluator constructions | 0 | 0 | 0 | 26 / 26 |
| Descriptor bindings | 4 | 4 | 4 | 0 / 0 |
| Physical native owners | 10 | 10 | 10 | 1 / 1 |
| Native lane acquisitions | 10 | 10 | 10 | 0 / 0 |
| Diff/Xml worker constructions | 0 | 0 | 0 | 0 / 0 |

Round 1 full-file wall time was **38.18 seconds** (vitest 36.73 seconds),
including construction and Node parity, at launch load **10.39 / 15.47 / 15.57**.
The reviewed B2 receipt was 34.81 seconds; B1's recorded receipt was 58.86.
These are different loaded-host runs, not a latency comparison; timing gates
nothing. The eight original real-process obligations still pass on both child
runtimes. Final focused file totals: session **48/48**, session protocol **4/4**,
descriptors **8/8**, retained v2 worker **19/19** and v2 protocol **14/14**.

The selected scope is every server Citation test in the transitive import
closure of RegexWorker, RegexDescriptors, RegexSession, RegexSessionProtocol or
NativeLane, plus the explicit FullSpan gate. The import walk included server
aliases, relative imports/re-exports and type dependencies, so it conservatively
includes callers beyond direct evaluator/lane imports. Standing B1 and runner
exclusions were retained. There were **195 initial file runs, 75 reruns for
files started before the final implementation commit, then FullSpan last**:
**271 file runs, 196 unique files, 187 passing files, 808 passing tests and 23
failing tests across the same nine fixture-authority files**. Every selected
file has a receipt for the final implementation. The table below records the
last result per file without double-counting reruns. All commands used nice -n
19 and ran one file at a time. Ordered manifests, logs and raw TSV remain in the
ignored .beep directory.

The nine unchanged red files retain the same counts and runtime-guard failure
paths listed earlier: AnnotationAssembly 4/1, CaseMetadata 0/2,
JournalMetadata 2/2, LawMetadata 4/2, NativeLaneComposition 0/4,
NativeLaneReservation 24/8, TokenizerCatalog 2/1, integration/CanonicalTokenizer
0/2 and integration/JournalMetadata 0/1 (passed/failed). No fixture was edited to
bypass the captured Clock/spawner identity guard. This remains a locally
verified review handoff with B1 alignment pending, not a green branch or hosted
acceptance claim.

| File | Passed | Failed | Skipped | Final wall seconds |
| --- | ---: | ---: | ---: | ---: |
| `test/CitationAnnotationAssembly.test.ts` | 4 | 1 | 0 | 4 |
| `test/CitationAnnotationCallback.test.ts` | 2 | 0 | 0 | 16 |
| `test/CitationAnnotationCallbackBoundary.test.ts` | 2 | 0 | 0 | 2 |
| `test/CitationAnnotationEntry.test.ts` | 5 | 0 | 0 | 6 |
| `test/CitationAnnotationEntryCoverage.test.ts` | 2 | 0 | 0 | 4 |
| `test/CitationAnnotationFailure.test.ts` | 2 | 0 | 0 | 2 |
| `test/CitationAnnotationSkip.test.ts` | 1 | 0 | 0 | 10 |
| `test/CitationAnnotationStyle.test.ts` | 2 | 0 | 0 | 3 |
| `test/CitationAnnotationTemplate.test.ts` | 2 | 0 | 0 | 2 |
| `test/CitationAnnotationWrap.test.ts` | 3 | 0 | 0 | 8 |
| `test/CitationBuiltinCleaners.test.ts` | 2 | 0 | 0 | 4 |
| `test/CitationBuiltinDiff.test.ts` | 6 | 0 | 0 | 31 |
| `test/CitationCallbackRuntimeIndex.test.ts` | 5 | 0 | 0 | 4 |
| `test/CitationCallbackSession.test.ts` | 16 | 0 | 0 | 3 |
| `test/CitationCanonicalAnnotation.test.ts` | 2 | 0 | 0 | 47 |
| `test/CitationCanonicalAnnotationWorkflow.test.ts` | 1 | 0 | 0 | 22 |
| `test/CitationCanonicalCourts.test.ts` | 1 | 0 | 0 | 16 |
| `test/CitationCanonicalDefaultFactory.test.ts` | 2 | 0 | 0 | 4 |
| `test/CitationCanonicalDump.test.ts` | 2 | 0 | 0 | 22 |
| `test/CitationCanonicalEditionYears.test.ts` | 1 | 0 | 0 | 3 |
| `test/CitationCanonicalExtraction.test.ts` | 7 | 0 | 0 | 49 |
| `test/CitationCanonicalExtractionRanges.test.ts` | 6 | 0 | 0 | 4 |
| `test/CitationCanonicalFullRendering.test.ts` | 2 | 0 | 0 | 19 |
| `test/CitationCanonicalFullSpan.test.ts` | 12 | 0 | 0 | 38.18 |
| `test/CitationCanonicalLongDiff.test.ts` | 2 | 0 | 0 | 30 |
| `test/CitationCanonicalMissingConversion.test.ts` | 2 | 0 | 0 | 18 |
| `test/CitationCanonicalPageCorrection.test.ts` | 2 | 0 | 0 | 34 |
| `test/CitationCanonicalParsedEquality.test.ts` | 2 | 0 | 0 | 22 |
| `test/CitationCanonicalParserOperations.test.ts` | 1 | 0 | 0 | 14 |
| `test/CitationCanonicalPinSpan.test.ts` | 2 | 0 | 0 | 23 |
| `test/CitationCanonicalRanges.test.ts` | 2 | 0 | 0 | 18 |
| `test/CitationCanonicalReferenceMarkup.test.ts` | 2 | 0 | 0 | 20 |
| `test/CitationCanonicalRemainingExtraction.test.ts` | 1 | 0 | 0 | 18 |
| `test/CitationCanonicalResourceComparison.test.ts` | 1 | 0 | 0 | 5 |
| `test/CitationCanonicalSource.test.ts` | 1 | 0 | 0 | 4 |
| `test/CitationCanonicalSourceCoverage.test.ts` | 2 | 0 | 0 | 4 |
| `test/CitationCanonicalStyle.test.ts` | 1 | 0 | 0 | 3 |
| `test/CitationCapturedCleanerPlan.test.ts` | 2 | 0 | 0 | 22 |
| `test/CitationCaseMetadata.test.ts` | 0 | 2 | 0 | 3 |
| `test/CitationCaseName.test.ts` | 2 | 0 | 0 | 5 |
| `test/CitationCaseNameCoverage.test.ts` | 2 | 0 | 0 | 3 |
| `test/CitationCaseNamePredicates.test.ts` | 4 | 0 | 0 | 4 |
| `test/CitationCaseNameProcess.test.ts` | 5 | 0 | 0 | 8 |
| `test/CitationCaseNameScan.test.ts` | 4 | 0 | 0 | 10 |
| `test/CitationCaseNameSelection.test.ts` | 1 | 0 | 0 | 10 |
| `test/CitationCleanerCustomCorpus.test.ts` | 3 | 0 | 0 | 6 |
| `test/CitationCleanerNamedCorpus.test.ts` | 1 | 0 | 0 | 5 |
| `test/CitationCleanerOwnedInput.test.ts` | 4 | 0 | 0 | 2 |
| `test/CitationCleanerParentBudget.test.ts` | 5 | 0 | 0 | 3 |
| `test/CitationCleanerPipeline.test.ts` | 18 | 0 | 0 | 3 |
| `test/CitationCleanerPipelineCoverage.test.ts` | 6 | 0 | 0 | 3 |
| `test/CitationCleanerRegistry.test.ts` | 12 | 0 | 0 | 3 |
| `test/CitationConfigurationOwnership.test.ts` | 6 | 0 | 0 | 19 |
| `test/CitationContextMatcher.test.ts` | 2 | 0 | 0 | 8 |
| `test/CitationCourtLookup.test.ts` | 8 | 0 | 0 | 13 |
| `test/CitationDefaultCallbacks.test.ts` | 10 | 0 | 0 | 4 |
| `test/CitationDefaultConfiguration.test.ts` | 3 | 0 | 0 | 15 |
| `test/CitationDiffKernel.test.ts` | 13 | 0 | 0 | 3 |
| `test/CitationDiffWorker.input-admission.test.ts` | 1 | 0 | 0 | 3 |
| `test/CitationDiffWorker.test.ts` | 14 | 0 | 0 | 5 |
| `test/CitationDocumentCleanerProtocols.test.ts` | 10 | 0 | 0 | 4 |
| `test/CitationDocumentExtraction.test.ts` | 1 | 0 | 0 | 13 |
| `test/CitationDocumentExtractionCoverage.test.ts` | 1 | 0 | 0 | 10 |
| `test/CitationDocumentServices.test.ts` | 1 | 0 | 0 | 6 |
| `test/CitationDump.test.ts` | 9 | 0 | 0 | 5 |
| `test/CitationDumpCoverage.test.ts` | 4 | 0 | 0 | 2 |
| `test/CitationEditionInference.test.ts` | 3 | 0 | 0 | 4 |
| `test/CitationEngineArtifact.test.ts` | 3 | 0 | 0 | 4 |
| `test/CitationEngineBoundaryRefusal.test.ts` | 2 | 0 | 0 | 27 |
| `test/CitationEngineCorpus.test.ts` | 1 | 0 | 0 | 24 |
| `test/CitationEngineFailure.test.ts` | 2 | 0 | 0 | 4 |
| `test/CitationEngineLayer.test.ts` | 15 | 0 | 0 | 161 |
| `test/CitationEngineResolution.test.ts` | 2 | 0 | 0 | 26 |
| `test/CitationExtractionContext.test.ts` | 2 | 0 | 0 | 3 |
| `test/CitationExtractionEntry.test.ts` | 1 | 0 | 0 | 12 |
| `test/CitationExtractionEntryCoverage.test.ts` | 2 | 0 | 0 | 12 |
| `test/CitationExtractionLoop.test.ts` | 15 | 0 | 0 | 32 |
| `test/CitationExtractionReport.test.ts` | 1 | 0 | 0 | 11 |
| `test/CitationExtractionSelection.test.ts` | 1 | 0 | 0 | 2 |
| `test/CitationExtractionShortcut.test.ts` | 1 | 0 | 0 | 3 |
| `test/CitationExtractorOrdering.test.ts` | 2 | 0 | 0 | 3 |
| `test/CitationExtractorRecipes.test.ts` | 2 | 0 | 0 | 2 |
| `test/CitationExtractorSelection.test.ts` | 5 | 0 | 0 | 3 |
| `test/CitationFrozenEditions.test.ts` | 6 | 0 | 0 | 3 |
| `test/CitationFullExtraction.test.ts` | 2 | 0 | 0 | 10 |
| `test/CitationFullExtractionCoverage.test.ts` | 1 | 0 | 0 | 9 |
| `test/CitationGeneratedReferences.test.ts` | 2 | 0 | 0 | 32 |
| `test/CitationHelperConfigurations.test.ts` | 3 | 0 | 0 | 10 |
| `test/CitationHostResources.test.ts` | 8 | 0 | 0 | 5 |
| `test/CitationHtmlCleanerStage.test.ts` | 3 | 0 | 0 | 5 |
| `test/CitationHtmlDiscovery.test.ts` | 2 | 0 | 0 | 6 |
| `test/CitationHtmlDiscoveryCoverage.test.ts` | 2 | 0 | 0 | 3 |
| `test/CitationHtmlGeometryPreparation.test.ts` | 3 | 0 | 0 | 5 |
| `test/CitationHtmlNativeInput.test.ts` | 5 | 0 | 0 | 3 |
| `test/CitationHtmlWorker.test.ts` | 11 | 0 | 0 | 4 |
| `test/CitationHtmlWorkerCorpus.test.ts` | 3 | 0 | 0 | 47 |
| `test/CitationHtmlWorkerCoverage.test.ts` | 2 | 0 | 0 | 7 |
| `test/CitationInputDocument.test.ts` | 1 | 0 | 0 | 9 |
| `test/CitationInputDocumentCoverage.test.ts` | 2 | 0 | 0 | 13 |
| `test/CitationInvocation.test.ts` | 4 | 0 | 0 | 4 |
| `test/CitationJournalMetadata.test.ts` | 2 | 2 | 0 | 7 |
| `test/CitationLawMetadata.test.ts` | 4 | 2 | 0 | 6 |
| `test/CitationLiteralUnicodeComposition.test.ts` | 4 | 0 | 0 | 7 |
| `test/CitationMetadataStrings.test.ts` | 3 | 0 | 0 | 6 |
| `test/CitationMetadataYear.test.ts` | 5 | 0 | 0 | 4 |
| `test/CitationMixedResourceObjects.test.ts` | 2 | 0 | 0 | 3 |
| `test/CitationNativeLane.test.ts` | 16 | 0 | 0 | 4 |
| `test/CitationNativeLaneCleaner.test.ts` | 2 | 0 | 0 | 24 |
| `test/CitationNativeLaneComposition.test.ts` | 0 | 4 | 0 | 5 |
| `test/CitationNativeLaneReservation.test.ts` | 24 | 8 | 0 | 84 |
| `test/CitationNativeLaneTransfer.test.ts` | 4 | 0 | 0 | 3 |
| `test/CitationOccurrenceProjectionCoverage.test.ts` | 4 | 0 | 0 | 2 |
| `test/CitationPairedSource.test.ts` | 2 | 0 | 0 | 26 |
| `test/CitationParserCatalog.test.ts` | 2 | 0 | 0 | 7 |
| `test/CitationPinExtraction.test.ts` | 4 | 0 | 0 | 6 |
| `test/CitationPostCaseMetadata.test.ts` | 5 | 0 | 0 | 9 |
| `test/CitationPreCaseMetadata.test.ts` | 4 | 0 | 0 | 5 |
| `test/CitationPythonRepr.test.ts` | 5 | 0 | 0 | 4 |
| `test/CitationPythonReprCoverage.test.ts` | 2 | 0 | 0 | 2 |
| `test/CitationReferenceNames.test.ts` | 1 | 0 | 0 | 3 |
| `test/CitationReferencePatterns.test.ts` | 1 | 0 | 0 | 6 |
| `test/CitationReferencePatternsCoverage.test.ts` | 4 | 0 | 0 | 4 |
| `test/CitationReferenceToken.test.ts` | 2 | 0 | 0 | 9 |
| `test/CitationReferenceTokenExtractionCoverage.test.ts` | 3 | 0 | 0 | 4 |
| `test/CitationRegexBoundaries.test.ts` | 2 | 0 | 0 | 12 |
| `test/CitationRegexCaptureReuse.test.ts` | 2 | 0 | 0 | 13 |
| `test/CitationRegexCaseFlags.test.ts` | 2 | 0 | 0 | 8 |
| `test/CitationRegexDescriptors.test.ts` | 8 | 0 | 0 | 3 |
| `test/CitationRegexEngine.test.ts` | 4 | 0 | 0 | 5 |
| `test/CitationRegexLookahead.test.ts` | 2 | 0 | 0 | 7 |
| `test/CitationRegexNullable.test.ts` | 2 | 0 | 0 | 4 |
| `test/CitationRegexOperation.test.ts` | 3 | 0 | 0 | 3 |
| `test/CitationRegexSession.test.ts` | 48 | 0 | 0 | 9 |
| `test/CitationRegexSessionProtocol.test.ts` | 4 | 0 | 0 | 3 |
| `test/CitationRegexVerbose.test.ts` | 3 | 0 | 0 | 9 |
| `test/CitationRegexWorker.test.ts` | 19 | 0 | 0 | 5 |
| `test/CitationRegexWorkerProtocol.test.ts` | 14 | 0 | 0 | 3 |
| `test/CitationRendering.test.ts` | 5 | 0 | 0 | 25 |
| `test/CitationRenderingOperation.test.ts` | 1 | 0 | 0 | 3 |
| `test/CitationResolverBoundary.test.ts` | 6 | 0 | 0 | 4 |
| `test/CitationResourceCorrection.test.ts` | 9 | 0 | 0 | 11 |
| `test/CitationSemanticExtraction.test.ts` | 1 | 0 | 0 | 26 |
| `test/CitationSemanticProjection.test.ts` | 6 | 0 | 0 | 6 |
| `test/CitationSemanticProjectionCoverage.test.ts` | 3 | 0 | 0 | 5 |
| `test/CitationSessionDescriptors.test.ts` | 3 | 0 | 0 | 5 |
| `test/CitationShortMissingPage.test.ts` | 3 | 0 | 0 | 34 |
| `test/CitationSixFormProjection.test.ts` | 2 | 0 | 0 | 8 |
| `test/CitationSixFormProjectionControls.test.ts` | 7 | 0 | 0 | 2 |
| `test/CitationSourceAnnotation.test.ts` | 6 | 0 | 0 | 6 |
| `test/CitationSourceAnnotationTiming.test.ts` | 2 | 0 | 0 | 3 |
| `test/CitationSourceCleaning.test.ts` | 3 | 0 | 0 | 3 |
| `test/CitationSourceDocument.test.ts` | 4 | 0 | 0 | 16 |
| `test/CitationSourceEvidence.test.ts` | 3 | 0 | 0 | 3 |
| `test/CitationSourceRequest.test.ts` | 10 | 0 | 0 | 3 |
| `test/CitationSpanOffsets.test.ts` | 5 | 0 | 0 | 2 |
| `test/CitationStopWords.test.ts` | 3 | 0 | 0 | 8 |
| `test/CitationTokenAssembly.test.ts` | 2 | 0 | 0 | 2 |
| `test/CitationTokenCapture.test.ts` | 3 | 0 | 0 | 3 |
| `test/CitationTokenContext.test.ts` | 3 | 0 | 0 | 4 |
| `test/CitationTokenDispatch.test.ts` | 3 | 0 | 0 | 3 |
| `test/CitationTokenEditions.test.ts` | 3 | 0 | 0 | 3 |
| `test/CitationTokenEquality.test.ts` | 2 | 0 | 0 | 3 |
| `test/CitationTokenObjects.test.ts` | 3 | 0 | 0 | 2 |
| `test/CitationTokenText.test.ts` | 4 | 0 | 0 | 5 |
| `test/CitationTokenizedExtraction.test.ts` | 1 | 0 | 0 | 14 |
| `test/CitationTokenizedExtractionCoverage.test.ts` | 1 | 0 | 0 | 7 |
| `test/CitationTokenizerCatalog.test.ts` | 2 | 1 | 0 | 6 |
| `test/CitationVerifiedExtraction.test.ts` | 1 | 0 | 0 | 21 |
| `test/CitationXmlBalanceKernel.test.ts` | 2 | 0 | 0 | 3 |
| `test/CitationXmlBalanceKernelCoverage.test.ts` | 3 | 0 | 0 | 2 |
| `test/CitationXmlWorker.test.ts` | 3 | 0 | 0 | 7 |
| `test/integration/CitationCanonicalAnnotationWorkflow.test.ts` | 4 | 0 | 0 | 52 |
| `test/integration/CitationCanonicalCourts.test.ts` | 3 | 0 | 0 | 42 |
| `test/integration/CitationCanonicalExtraction.test.ts` | 4 | 0 | 0 | 42 |
| `test/integration/CitationCanonicalExtractionRange2.test.ts` | 4 | 0 | 0 | 49 |
| `test/integration/CitationCanonicalExtractionRange3.test.ts` | 4 | 0 | 0 | 49 |
| `test/integration/CitationCanonicalExtractionRange4.test.ts` | 4 | 0 | 0 | 42 |
| `test/integration/CitationCanonicalExtractionRange5.test.ts` | 4 | 0 | 0 | 62 |
| `test/integration/CitationCanonicalExtractionRange6.test.ts` | 2 | 0 | 0 | 29 |
| `test/integration/CitationCanonicalParserOperations.test.ts` | 4 | 0 | 0 | 41 |
| `test/integration/CitationCanonicalParserOperationsRange2.test.ts` | 4 | 0 | 0 | 42 |
| `test/integration/CitationCanonicalReferenceMarkup.test.ts` | 2 | 0 | 0 | 25 |
| `test/integration/CitationCanonicalRemainingExtraction.test.ts` | 4 | 0 | 0 | 44 |
| `test/integration/CitationCanonicalRemainingExtractionRange2.test.ts` | 3 | 0 | 0 | 35 |
| `test/integration/CitationCanonicalTokenizer.test.ts` | 0 | 2 | 0 | 5 |
| `test/integration/CitationCleanerNamedHtml.test.ts` | 1 | 0 | 0 | 54 |
| `test/integration/CitationCleanerNativeCustom.test.ts` | 1 | 0 | 0 | 9 |
| `test/integration/CitationDiffWorker.test.ts` | 2 | 0 | 0 | 95 |
| `test/integration/CitationEditionInference.test.ts` | 1 | 0 | 0 | 4 |
| `test/integration/CitationEngineCorpus.test.ts` | 2 | 0 | 0 | 48 |
| `test/integration/CitationHtmlUnicode.test.ts` | 1 | 0 | 0 | 61 |
| `test/integration/CitationInputDocument.test.ts` | 2 | 0 | 0 | 11 |
| `test/integration/CitationJournalMetadata.test.ts` | 0 | 1 | 0 | 3 |
| `test/integration/CitationRegexBoundaries.test.ts` | 16 | 0 | 0 | 111 |
| `test/integration/CitationRegexCaseFlags.test.ts` | 16 | 0 | 0 | 197 |
| `test/integration/CitationVerifiedExtraction.test.ts` | 1 | 0 | 0 | 36 |

### Round 1 scope exclusions and interpretation

Not rerun this round: the six standing B1-reserved files and
CitationExtractorControls, plus 67 other Citation files outside the changed
import closure (pure schemas, input/compiler kernels and unrelated services).
Their earlier full-directory receipts are retained above. Explicit inventory:

- `test/CitationAdmission.test.ts`
- `test/CitationAssetCoverage.test.ts`
- `test/CitationAuthorityIdentity.test.ts`
- `test/CitationCallbackMutations.test.ts`
- `test/CitationCallbackSessionCoverage.test.ts`
- `test/CitationCaseResourceHash.test.ts`
- `test/CitationCleanerUnicodeValues.test.ts`
- `test/CitationCleanerValues.test.ts`
- `test/CitationDictionaryReentrancy.test.ts`
- `test/CitationDiffKernelCoverage.test.ts`
- `test/CitationDiffStepsCoverage.test.ts`
- `test/CitationDiffWorkerProtocol.test.ts`
- `test/CitationDocumentPersistence.test.ts`
- `test/CitationExtractorControls.test.ts`
- `test/CitationFullLawMetadata.test.ts`
- `test/CitationHtmlBytes.test.ts`
- `test/CitationHtmlCaseName.test.ts`
- `test/CitationHtmlCompletion.test.ts`
- `test/CitationHtmlInput.test.ts`
- `test/CitationHtmlKernel.test.ts`
- `test/CitationHtmlWorkerProgram.test.ts`
- `test/CitationHtmlWorkerProtocol.test.ts`
- `test/CitationHtmlWorkerRpc.test.ts`
- `test/CitationLiteralCleaners.test.ts`
- `test/CitationMention.test.ts`
- `test/CitationMentionIdentity.test.ts`
- `test/CitationModelMutation.test.ts`
- `test/CitationNativeAdmission.test.ts`
- `test/CitationNativeAdmissionCoverage.test.ts`
- `test/CitationNativeProcess.test.ts`
- `test/CitationNativeProcessCoverage.test.ts`
- `test/CitationNativeRpc.test.ts`
- `test/CitationNativeSlices.test.ts`
- `test/CitationNativeSocket.test.ts`
- `test/CitationPortFailure.test.ts`
- `test/CitationPriorFulls.test.ts`
- `test/CitationPublicationResourceHash.test.ts`
- `test/CitationPythonCase.test.ts`
- `test/CitationPythonCaseCoverage.test.ts`
- `test/CitationPythonHash.test.ts`
- `test/CitationPythonUnicode.test.ts`
- `test/CitationPythonUnicodeCoverage.test.ts`
- `test/CitationRecognizerProgram.test.ts`
- `test/CitationRecognizerWorker.test.ts`
- `test/CitationRegexAlphabet.test.ts`
- `test/CitationRegexCharacters.test.ts`
- `test/CitationRegexInput.test.ts`
- `test/CitationRegexInputCoverage.test.ts`
- `test/CitationRegexPolicyCoverage.test.ts`
- `test/CitationRegexProgram.test.ts`
- `test/CitationRegexResult.test.ts`
- `test/CitationRegexTranslator.test.ts`
- `test/CitationReplayBudget.test.ts`
- `test/CitationResolutionLimit.test.ts`
- `test/CitationResolve.test.ts`
- `test/CitationResolverText.test.ts`
- `test/CitationResourceIdentity.test.ts`
- `test/CitationResourceObjects.test.ts`
- `test/CitationRuntimeDictionary.test.ts`
- `test/CitationRuntimeDictionaryCoverage.test.ts`
- `test/CitationRuntimeSet.test.ts`
- `test/CitationSixFormArtifact.test.ts`
- `test/CitationSixFormResolution.test.ts`
- `test/CitationTableCapacity.test.ts`
- `test/CitationTextBudget.test.ts`
- `test/CitationTextCapacity.test.ts`
- `test/CitationTextNativeOrder.test.ts`
- `test/CitationTokenizer.test.ts`
- `test/CitationUnicodeDictionary.test.ts`
- `test/CitationXmlWorkerProtocol.test.ts`
- `test/integration/CitationExtractorSelection.test.ts`
- `test/integration/CitationFullLawMetadata.test.ts`
- `test/integration/CitationRegexTranslator.test.ts`
- `test/integration/CitationRegexTranslatorNode.test.ts`

No coverage, parallel whole-suite run, hosted CI, push, PR opening, merge,
rebase, stash or subagent was used. No safety ceiling, strict wire decoder,
fingerprint/profile guard, extraction output or public CitationEngine shape was
relaxed or changed. V2 remains in the tree. The only new lifetime behavior is
the accepted review requirement: preparation interruption poisons and confirms
retirement (including a reserved unit without a child), and expected handover
waits for active evaluation before resetting to absent. The already-locked lane
capabilities and immutable fingerprint recheck are the implementation choices
explained above. No further conflict with the design was encountered.

The round 1 checkpoint is
`decisions/2026-11-14-review-round-1-closes-preflight-and-session-lifetime-findings.md`.
The final decisions projection reports packets=1, decisions=20, invalid=0 and
drift_remaining=0. PLAN keeps B2 in review. The final checkout inbox is readable
and has no unacknowledged entries.

## B1 merge and green run

This receipt supersedes the earlier red fixture receipts. The owner-requested
merge of B1 head `b9089f34c6b` completed as `078eb202de8`. The three conflicts
were resolved in PLAN, Invocation and RegexWorker; the checkpoint projection was
regenerated with the goal decisions writer. Both sides' hand-written plan rows
and decision files survive. No other merge, rebase, push or PR opening occurred.

### Runtime authority and installation lifetime

The installed evaluator checks its installation-closed flag first, then compares
its captured spawner and Clock to the invocation lane with `matchesRuntime` on
every evaluation, including the first. It returns `closed` before any identity
comparison after installation closure, and `invalid-runtime` for a live
installation with either identity mismatched, with zero spawns. The B1 worker
tests exercise the installed v3 session evaluator; the closure test additionally
closes a separate installation Scope whose evaluator would otherwise mismatch.
The session itself uses the lane's spawner and Clock. Invocation carries its
session directly, without the old regex-owner runtime fields or dead service
provisions. B1's Markup reap and direct lease-claim changes remain intact.

B1 supplied the fixture authority corrections. Remaining edits to the previously
red files change exact process counts or the expected state of a live session;
they do not weaken identity checks or output assertions. AnnotationAssembly's
reported Clock mismatch is resolved by the merged B1 fixture alignment.

### Spawn-count assertions rewritten after the merge

| Fixture or assertion | Previous expectation | Session expectation |
| --- | --- | --- |
| CaseMetadata regular and tight-budget assertions | 18 children each | Exactly 1 child each |
| Tokenizer | 7 started and confirmed | Exactly 3 started and confirmed |
| FullLawMetadata | Sum of evaluation calls; unit row total 14 | One child for each row with calls; unit row total 11 |
| FullLawMetadata integration | 936 evaluation calls over 768 rows | Exactly 768 children, one per nonempty-call row |
| HtmlCaseName | Four geometry children per row plus three per cleaner call and one per regex call; unit total 72 | Four geometry children per row plus one regex child per row using a cleaner or regex operation; unit total 51 |
| TextBudget inside an open invocation | Started 1, already confirmed 1 | Exactly started 1, confirmed 0; immediately after invocation close, exactly 1 and 1 |
| NativeLaneReservation regex job deadline | Acquired true after confirmed retirement | Acquired false; unitsAcquired 1, started 1 and confirmed 1 remain exact |

The existing extraction results, evaluation counts, descriptor fingerprints,
resource limits and byte ceilings stay asserted. No count was widened to a range.
The original B2 and review-round-one spawn-count rewrites remain documented above.

### Coverage-driven regressions and retained guards

Coverage was collected one test file and one explicitly included source file at
a time, using the Bun parent and Istanbul provider used by hosted Unit shards.
The table below is the union of those per-test reports; it is local reproduction
of the hosted coverage topology, not a claim that hosted CI ran this local head.
The sleep-counting Clock remains a test fixture, not a new production source file.

New session regressions cover typed child Failure, a stale prepared sequence,
a closed lane, input-adapter failure with a real child, a late valid frame while
expected retirement is blocked at SIGKILL, and quarantine cleanup after an idle
protocol deviation. Deferred barriers control the retirement and observation
points. Both child runtimes run all these cases. Successful late-frame retirement
is expected handover and returns the session to absent; protocol failure remains
poisoned. A quarantine lease remains held until retry confirms the actual child
is dead. Startup, preparation, dispatch, write, read, Sent, Running and retirement
interruption proofs remain in the same file.

The program tests run the isolated worker role with Stdio inputs and outputs,
following the existing v2 program-test style. They cover repeated real regex
jobs, a policy Failure, wrong sequence, stdout failure, the additional sequenced
result-header ceiling, and an unexpected Clock defect. The parent-facing process
proofs continue to execute real Bun and Node OS children and production bundles;
worker-role unit coverage is not substituted for those proofs.

Three redundant queue tag predicates became hoisted Schema decoders. Ready,
Started and Complete validation remains present at each consuming boundary;
the reader's sequence/phase wall and all typed refusals remain intact. The
capture-name count guard now runs before header construction, so mutation of a
previously valid name record receives a typed refusal rather than reaching a
schema constructor first. A regression exceeds the finite name count before
header encoding. The exact encoded-byte guard is shared by v2/v3 preflight and
payload encoding; its ceiling and refusal are unchanged. Startup argument size
checks likewise share one installed bounded encoder, with an oversized-variable-
argument regression. Strict decoding and post-encode exact-size checks remain.
No guard, coverage baseline or coverage-ignore directive was removed or weakened.

The legacy regex lane coverage file remains meaningful. Its v2-only window
closing Scope synchronously inside reservation is replaced by interruption after
reservation: v3 serialization prevents that old intervening handover window.
Its unconfirmed-retirement case now forces a running job deadline, since normal
success deliberately retains an idle process. Queue contention is arranged after
an actual cleaner yield, before evaluation, instead of overriding a reserve
method that the installed session never uses. V2 modules and their own protocol
and program tests remain in the tree for B3.

### Verification boundaries

`bun install --frozen-lockfile` and the server package check passed after merge.
The full Citation directory was run serially, including the formerly reserved
and mismatched fixtures and all seven B1 coverage/composition/reservation files.
The three Bun.version-dependent files use a Bun parent; the other directory
runs use the requested one-file `bunx vitest` command. FullSpan is held for the
last test run, after coverage and any corrective reruns.

The requested base branch was deleted remotely after the merge: the local ref
was absent and `git ls-remote --heads origin feat/citation-native-lane` returned
no match. Fallow therefore compares against the exact merged B1 head
`b9089f34c6b`, not a moving replacement branch. Its final JSON attribution has
zero introduced dead-code, complexity, duplication, styling and diff-risk
findings; 35 duplication findings are inherited.

An unsuccessful direct closed-stdin probe exposed a Bun-parent Node-compatible
sink that remained pending after the child closed the pipe. The Node-parent
probe had passed. The stuck owned child and its test worker were terminated,
and the unsuccessful probe is recorded here rather than counted as passing. The committed input
failure regression injects a typed adapter error while keeping an actual child,
then checks SIGKILL, confirmed death, exact capacity return and fail-closed reuse.
This distinction is recorded in research/OPPORTUNITIES.md. No production adapter
or deadline was weakened to accommodate the runner behavior.

V3 deliberately keeps a successful regex child alive until invocation closure
or an expected lane handover. Every interrupted evaluation poisons the session,
even if preparation has not spawned a child. Expected handover alone permits a
fresh child afterwards. Descriptor, engine and sequence bytes count against the
unchanged message ceiling, so a marginal payload may now receive a size refusal
earlier than with v2. These are the designed lifecycle and framing changes;
extraction values and configured limits are unchanged.

Implementation commits for this wave: `078eb202de8` (requested B1 merge),
`90713a80a86` (unused native ownership regression and import formatting), and
`98124b81fd6` (merged fixture counts, retained guards and coverage regressions).
The last commit also updates only the matching instrumentation/schema catalog
projections: two shared helper spans, the replaced startup span and its codec
entry. No coverage or schema-first regression baseline changed.

### Per-source coverage and floors

All four new B2 files reach **100/100/100/100**. Every changed existing file
meets its committed floor. Percentages below are lines / statements / branches /
functions, using the union of separately collected single-source reports.

| Source | Lines | Statements | Branches | Functions | Committed floor, L/S/B/F |
| --- | ---: | ---: | ---: | ---: | --- |
| ByteFrames.ts | 100 | 100 | 94.73 | 100 | 100/100/93.75/100 |
| Invocation.ts | 100 | 100 | 100 | 100 | No entry; measured 100/100/100/100 |
| NativeJson.ts | 100 | 100 | 96.87 | 100 | 100/100/96.66/100 |
| NativeLane.ts | 100 | 100 | 100 | 100 | No entry; measured 100/100/100/100 |
| NativeProcess.ts | 100 | 100 | 100 | 100 | 100/100/100/100 |
| NativeRpc.ts | 100 | 100 | 100 | 100 | 100/100/100/100 |
| RegexDescriptors.ts | 100 | 98.41 | 100 | 94.11 | 97.82/96.15/92.85/93.33 |
| RegexSession.ts | 100 | 100 | 100 | 100 | New B2: 100/100/100/100 |
| RegexSessionProgram.ts | 100 | 100 | 100 | 100 | New B2: 100/100/100/100 |
| RegexSessionProtocol.ts | 100 | 100 | 100 | 100 | New B2: 100/100/100/100 |
| RegexSessionRpc.ts | 100 | 100 | 100 | 100 | New B2: 100/100/100/100 |
| RegexWorker.entry.ts | 0 | 0 | 100 | 0 | 0/0/100/0 |
| RegexWorker.node.entry.ts | 0 | 0 | 100 | 0 | 0/0/100/0 |
| RegexWorker.ts | 100 | 100 | 100 | 100 | 96.55/93.93/80/90.9 |
| RegexWorkerProtocol.ts | 100 | 100 | 100 | 100 | 100/97.26/90/94.11 |
| RegexWorkerRpc.ts | 100 | 97.5 | 100 | 85.71 | 97.22/92.5/66.66/85.71 |

The existing entry shims execute in bundled child processes, outside the parent
coverage instrumenter. Their parent-report zero lines/statements/functions match
the existing zero floors; their real execution is covered by the Bun/Node child
proofs. They are existing files, not unqualified new B2 modules.

Remaining uncovered defensive code is retained:

- ByteFrames' indexed-byte nullish fallback is not reached for the validated
  Uint8Array index inside the bounded loop. Branch coverage 94.73 exceeds 93.75.
- NativeJson's analogous quoted-byte fallback is not reached for the bounded
  Uint8Array loop. Branch coverage 96.87 exceeds 96.66.
- RegexDescriptors' profile-decode error mapper follows a compiler that already
  returns schema-valid facts. No invalid compiler output was manufactured with a
  cast to hit it. Statements/functions 98.41/94.11 exceed 96.15/93.33.
- RegexWorkerRpc's v2 malformed-reply error factory is not hit by this focused
  union; the production session consumes the v3 codec. The v2 guard and tests
  remain. Its 97.5 statements and 85.71 functions meet 92.5 and 85.71 floors.

No new B2 source guard remains uncovered. The new lane-Scope quarantine test
covers finalizer refusal followed by confirmed retry, making NativeLane's union
100 in every category as well.

### Individual coverage runs

Each row below was a separate Vitest invocation with exactly one test file and
one `--coverage.include=src/internal/Citation/<source>` value. All use the Bun
parent/Istanbul provider. The latest run of each pair is listed; failed
exploratory attempts are not treated as passing coverage evidence.

| Included source | Test file | Passing tests | Result |
| --- | --- | ---: | --- |
| ByteFrames.ts | CitationDiffWorker.test.ts | 14 | Pass |
| ByteFrames.ts | CitationHtmlWorkerProtocol.test.ts | 6 | Pass |
| ByteFrames.ts | CitationRegexWorkerProtocol.test.ts | 14 | Pass |
| Invocation.ts | CitationExtractorControls.test.ts | 24 | Pass |
| Invocation.ts | CitationInvocation.test.ts | 4 | Pass |
| Invocation.ts | CitationRegexSession.test.ts | 60 | Pass |
| NativeJson.ts | CitationRegexSessionProtocol.test.ts | 5 | Pass |
| NativeJson.ts | CitationRegexSessionRpc.test.ts | 3 | Pass |
| NativeJson.ts | CitationRegexWorker.test.ts | 19 | Pass |
| NativeJson.ts | CitationRegexWorkerProtocol.test.ts | 14 | Pass |
| NativeLane.ts | CitationNativeLane.test.ts | 16 | Pass |
| NativeLane.ts | CitationNativeLaneComposition.test.ts | 4 | Pass |
| NativeLane.ts | CitationNativeLaneCoverage.test.ts | 9 | Pass |
| NativeLane.ts | CitationNativeLaneReservation.test.ts | 32 | Pass |
| NativeLane.ts | CitationNativeLaneTransfer.test.ts | 4 | Pass |
| NativeProcess.ts | CitationNativeLane.test.ts | 16 | Pass |
| NativeProcess.ts | CitationNativeLaneCoverage.test.ts | 8 | Pass |
| NativeProcess.ts | CitationNativeProcess.test.ts | 5 | Pass |
| NativeProcess.ts | CitationNativeProcessCoverage.test.ts | 3 | Pass |
| NativeProcess.ts | CitationRegexSession.test.ts | 60 | Pass |
| NativeRpc.ts | CitationDiffWorker.test.ts | 14 | Pass |
| NativeRpc.ts | CitationNativeRpc.test.ts | 6 | Pass |
| NativeRpc.ts | CitationRegexSession.test.ts | 60 | Pass |
| NativeRpc.ts | CitationRegexSessionProgram.test.ts | 3 | Pass |
| NativeRpc.ts | CitationRegexWorker.test.ts | 19 | Pass |
| RegexDescriptors.ts | CitationRegexDescriptors.test.ts | 9 | Pass |
| RegexDescriptors.ts | CitationRegexSession.test.ts | 60 | Pass |
| RegexSessionProgram.ts | CitationRegexSessionProgram.test.ts | 3 | Pass |
| RegexSessionProtocol.ts | CitationRegexSessionProtocol.test.ts | 5 | Pass |
| RegexSessionRpc.ts | CitationRegexSessionRpc.test.ts | 3 | Pass |
| RegexSession.ts | CitationRegexLaneCoverage.test.ts | 6 | Pass |
| RegexSession.ts | CitationRegexSession.test.ts | 60 | Pass |
| RegexWorker.entry.ts | CitationRegexSessionProgram.test.ts | 3 | Pass |
| RegexWorker.node.entry.ts | CitationRegexSessionProgram.test.ts | 3 | Pass |
| RegexWorkerProtocol.ts | CitationRegexSessionProtocol.test.ts | 5 | Pass |
| RegexWorkerProtocol.ts | CitationRegexWorkerProtocol.test.ts | 15 | Pass |
| RegexWorkerRpc.ts | CitationRegexSessionProgram.test.ts | 3 | Pass |
| RegexWorkerRpc.ts | CitationRegexSessionRpc.test.ts | 4 | Pass |
| RegexWorkerRpc.ts | CitationRegexWorker.test.ts | 19 | Pass |
| RegexWorkerRpc.ts | CitationRegexWorkerProtocol.test.ts | 15 | Pass |
| RegexWorker.ts | CitationRegexLaneCoverage.test.ts | 6 | Pass |
| RegexWorker.ts | CitationRegexSession.test.ts | 60 | Pass |
| RegexWorker.ts | CitationRegexWorker.test.ts | 19 | Pass |

### Final complete Citation directory run

**276/276 files pass; 1299 tests pass; zero failures, pending tests or skips.**
All files ran one at a time. The first 29 files were replayed after extracting the
shared frame-byte guard, and CaseMetadata, NativeLaneCoverage and RegexSession
received final corrective reruns. Coverage ran before the final count gate.
CaseMetadata initially exposed a second old 18-child tight-budget assertion;
it was rewritten to exactly 1 and the complete file passed on rerun. A package
lint replay found a blank line before a type import, fixed in `90713a80a86`;
quick package verification then passed and its P0 row was acknowledged with that
commit. These unsuccessful attempts are not hidden in the final totals.

`CitationCanonicalFullSpan.test.ts` was the last Vitest run, after every coverage
measurement and rerun. The three Bun.version files ran with a Bun parent;
all other directory rows below used the Node parent selected by `bunx vitest`.
The table gives the final full-file pass counts, not the sum of repeated runs.

| Test file | Passed | Failed | Parent |
| --- | ---: | ---: | --- |
| test/CitationAdmission.test.ts | 7 | 0 | Node |
| test/CitationAnnotationAssembly.test.ts | 5 | 0 | Node |
| test/CitationAnnotationCallback.test.ts | 2 | 0 | Node |
| test/CitationAnnotationCallbackBoundary.test.ts | 2 | 0 | Node |
| test/CitationAnnotationEntry.test.ts | 5 | 0 | Node |
| test/CitationAnnotationEntryCoverage.test.ts | 2 | 0 | Node |
| test/CitationAnnotationFailure.test.ts | 2 | 0 | Node |
| test/CitationAnnotationSkip.test.ts | 1 | 0 | Node |
| test/CitationAnnotationStyle.test.ts | 2 | 0 | Node |
| test/CitationAnnotationTemplate.test.ts | 2 | 0 | Node |
| test/CitationAnnotationWrap.test.ts | 3 | 0 | Node |
| test/CitationAssetCoverage.test.ts | 3 | 0 | Node |
| test/CitationAuthorityIdentity.test.ts | 7 | 0 | Node |
| test/CitationBuiltinCleaners.test.ts | 2 | 0 | Node |
| test/CitationBuiltinDiff.test.ts | 6 | 0 | Node |
| test/CitationCallbackMutations.test.ts | 2 | 0 | Node |
| test/CitationCallbackRuntimeIndex.test.ts | 5 | 0 | Node |
| test/CitationCallbackSession.test.ts | 16 | 0 | Node |
| test/CitationCallbackSessionCoverage.test.ts | 5 | 0 | Node |
| test/CitationCanonicalAnnotation.test.ts | 2 | 0 | Node |
| test/CitationCanonicalAnnotationWorkflow.test.ts | 1 | 0 | Node |
| test/CitationCanonicalCourts.test.ts | 1 | 0 | Node |
| test/CitationCanonicalDefaultFactory.test.ts | 2 | 0 | Node |
| test/CitationCanonicalDump.test.ts | 2 | 0 | Node |
| test/CitationCanonicalEditionYears.test.ts | 1 | 0 | Node |
| test/CitationCanonicalExtraction.test.ts | 7 | 0 | Node |
| test/CitationCanonicalExtractionRanges.test.ts | 6 | 0 | Node |
| test/CitationCanonicalFullRendering.test.ts | 2 | 0 | Node |
| test/CitationCanonicalFullSpan.test.ts | 12 | 0 | Node |
| test/CitationCanonicalLongDiff.test.ts | 2 | 0 | Node |
| test/CitationCanonicalMissingConversion.test.ts | 2 | 0 | Node |
| test/CitationCanonicalPageCorrection.test.ts | 2 | 0 | Node |
| test/CitationCanonicalParsedEquality.test.ts | 2 | 0 | Node |
| test/CitationCanonicalParserOperations.test.ts | 1 | 0 | Node |
| test/CitationCanonicalPinSpan.test.ts | 2 | 0 | Node |
| test/CitationCanonicalRanges.test.ts | 2 | 0 | Node |
| test/CitationCanonicalReferenceMarkup.test.ts | 2 | 0 | Node |
| test/CitationCanonicalRemainingExtraction.test.ts | 1 | 0 | Node |
| test/CitationCanonicalResourceComparison.test.ts | 1 | 0 | Node |
| test/CitationCanonicalSource.test.ts | 1 | 0 | Node |
| test/CitationCanonicalSourceCoverage.test.ts | 2 | 0 | Node |
| test/CitationCanonicalStyle.test.ts | 1 | 0 | Node |
| test/CitationCapturedCleanerPlan.test.ts | 2 | 0 | Node |
| test/CitationCaseMetadata.test.ts | 2 | 0 | Node |
| test/CitationCaseName.test.ts | 2 | 0 | Node |
| test/CitationCaseNameCoverage.test.ts | 2 | 0 | Node |
| test/CitationCaseNamePredicates.test.ts | 4 | 0 | Node |
| test/CitationCaseNameProcess.test.ts | 5 | 0 | Node |
| test/CitationCaseNameScan.test.ts | 4 | 0 | Node |
| test/CitationCaseNameSelection.test.ts | 1 | 0 | Node |
| test/CitationCaseResourceHash.test.ts | 4 | 0 | Node |
| test/CitationCleanerCustomCorpus.test.ts | 3 | 0 | Node |
| test/CitationCleanerNamedCorpus.test.ts | 1 | 0 | Node |
| test/CitationCleanerOwnedInput.test.ts | 4 | 0 | Node |
| test/CitationCleanerParentBudget.test.ts | 5 | 0 | Node |
| test/CitationCleanerPipeline.test.ts | 18 | 0 | Node |
| test/CitationCleanerPipelineCoverage.test.ts | 7 | 0 | Node |
| test/CitationCleanerRegistry.test.ts | 12 | 0 | Node |
| test/CitationCleanerUnicodeValues.test.ts | 7 | 0 | Node |
| test/CitationCleanerValues.test.ts | 8 | 0 | Node |
| test/CitationConfigurationOwnership.test.ts | 6 | 0 | Bun |
| test/CitationContextMatcher.test.ts | 2 | 0 | Node |
| test/CitationCourtLookup.test.ts | 8 | 0 | Node |
| test/CitationDefaultCallbacks.test.ts | 10 | 0 | Node |
| test/CitationDefaultConfiguration.test.ts | 3 | 0 | Node |
| test/CitationDictionaryReentrancy.test.ts | 2 | 0 | Node |
| test/CitationDiffKernel.test.ts | 13 | 0 | Node |
| test/CitationDiffKernelCoverage.test.ts | 1 | 0 | Node |
| test/CitationDiffLaneCoverage.test.ts | 9 | 0 | Node |
| test/CitationDiffStepsCoverage.test.ts | 3 | 0 | Node |
| test/CitationDiffWorker.input-admission.test.ts | 1 | 0 | Node |
| test/CitationDiffWorker.test.ts | 14 | 0 | Node |
| test/CitationDiffWorkerProtocol.test.ts | 4 | 0 | Node |
| test/CitationDocumentCleanerProtocols.test.ts | 10 | 0 | Node |
| test/CitationDocumentExtraction.test.ts | 1 | 0 | Node |
| test/CitationDocumentExtractionCoverage.test.ts | 1 | 0 | Node |
| test/CitationDocumentPersistence.test.ts | 18 | 0 | Node |
| test/CitationDocumentServices.test.ts | 1 | 0 | Node |
| test/CitationDump.test.ts | 9 | 0 | Node |
| test/CitationDumpCoverage.test.ts | 4 | 0 | Node |
| test/CitationEditionInference.test.ts | 3 | 0 | Node |
| test/CitationEngineArtifact.test.ts | 3 | 0 | Node |
| test/CitationEngineBoundaryRefusal.test.ts | 2 | 0 | Node |
| test/CitationEngineCorpus.test.ts | 1 | 0 | Node |
| test/CitationEngineFailure.test.ts | 2 | 0 | Node |
| test/CitationEngineLayer.test.ts | 15 | 0 | Node |
| test/CitationEngineResolution.test.ts | 2 | 0 | Node |
| test/CitationExtractionContext.test.ts | 2 | 0 | Node |
| test/CitationExtractionEntry.test.ts | 1 | 0 | Node |
| test/CitationExtractionEntryCoverage.test.ts | 2 | 0 | Node |
| test/CitationExtractionLoop.test.ts | 15 | 0 | Node |
| test/CitationExtractionReport.test.ts | 1 | 0 | Node |
| test/CitationExtractionSelection.test.ts | 1 | 0 | Node |
| test/CitationExtractionShortcut.test.ts | 1 | 0 | Node |
| test/CitationExtractorControls.test.ts | 24 | 0 | Bun |
| test/CitationExtractorOrdering.test.ts | 2 | 0 | Node |
| test/CitationExtractorRecipes.test.ts | 2 | 0 | Node |
| test/CitationExtractorSelection.test.ts | 5 | 0 | Node |
| test/CitationFrozenEditions.test.ts | 6 | 0 | Node |
| test/CitationFullExtraction.test.ts | 2 | 0 | Node |
| test/CitationFullExtractionCoverage.test.ts | 1 | 0 | Node |
| test/CitationFullLawMetadata.test.ts | 2 | 0 | Node |
| test/CitationGeneratedReferences.test.ts | 2 | 0 | Node |
| test/CitationHelperConfigurations.test.ts | 3 | 0 | Node |
| test/CitationHostResources.test.ts | 8 | 0 | Node |
| test/CitationHtmlBytes.test.ts | 2 | 0 | Node |
| test/CitationHtmlCaseName.test.ts | 3 | 0 | Node |
| test/CitationHtmlCleanerStage.test.ts | 3 | 0 | Node |
| test/CitationHtmlCompletion.test.ts | 3 | 0 | Node |
| test/CitationHtmlDiscovery.test.ts | 2 | 0 | Node |
| test/CitationHtmlDiscoveryCoverage.test.ts | 2 | 0 | Node |
| test/CitationHtmlGeometryPreparation.test.ts | 3 | 0 | Node |
| test/CitationHtmlInput.test.ts | 9 | 0 | Node |
| test/CitationHtmlKernel.test.ts | 18 | 0 | Node |
| test/CitationHtmlNativeInput.test.ts | 5 | 0 | Node |
| test/CitationHtmlWorker.test.ts | 13 | 0 | Node |
| test/CitationHtmlWorkerCorpus.test.ts | 3 | 0 | Node |
| test/CitationHtmlWorkerCoverage.test.ts | 2 | 0 | Node |
| test/CitationHtmlWorkerProgram.test.ts | 5 | 0 | Node |
| test/CitationHtmlWorkerProtocol.test.ts | 6 | 0 | Node |
| test/CitationHtmlWorkerRpc.test.ts | 3 | 0 | Node |
| test/CitationInputDocument.test.ts | 1 | 0 | Node |
| test/CitationInputDocumentCoverage.test.ts | 2 | 0 | Node |
| test/CitationInvocation.test.ts | 4 | 0 | Node |
| test/CitationJournalMetadata.test.ts | 4 | 0 | Node |
| test/CitationLawMetadata.test.ts | 6 | 0 | Node |
| test/CitationLiteralCleaners.test.ts | 8 | 0 | Node |
| test/CitationLiteralUnicodeComposition.test.ts | 4 | 0 | Node |
| test/CitationMarkupWorkerCoverage.test.ts | 8 | 0 | Node |
| test/CitationMention.test.ts | 13 | 0 | Node |
| test/CitationMentionIdentity.test.ts | 7 | 0 | Node |
| test/CitationMetadataStrings.test.ts | 3 | 0 | Node |
| test/CitationMetadataYear.test.ts | 5 | 0 | Node |
| test/CitationMixedResourceObjects.test.ts | 2 | 0 | Node |
| test/CitationModelMutation.test.ts | 2 | 0 | Node |
| test/CitationNativeAdmission.test.ts | 13 | 0 | Node |
| test/CitationNativeAdmissionCoverage.test.ts | 2 | 0 | Node |
| test/CitationNativeLane.test.ts | 16 | 0 | Node |
| test/CitationNativeLaneCleaner.test.ts | 2 | 0 | Node |
| test/CitationNativeLaneComposition.test.ts | 4 | 0 | Node |
| test/CitationNativeLaneCoverage.test.ts | 9 | 0 | Node |
| test/CitationNativeLaneReservation.test.ts | 32 | 0 | Node |
| test/CitationNativeLaneTransfer.test.ts | 4 | 0 | Node |
| test/CitationNativeProcess.test.ts | 5 | 0 | Node |
| test/CitationNativeProcessCoverage.test.ts | 3 | 0 | Node |
| test/CitationNativeRpc.test.ts | 6 | 0 | Node |
| test/CitationNativeSlices.test.ts | 3 | 0 | Node |
| test/CitationNativeSocket.test.ts | 12 | 0 | Node |
| test/CitationOccurrenceProjectionCoverage.test.ts | 4 | 0 | Node |
| test/CitationPairedSource.test.ts | 2 | 0 | Node |
| test/CitationParserCatalog.test.ts | 2 | 0 | Node |
| test/CitationPinExtraction.test.ts | 4 | 0 | Node |
| test/CitationPortFailure.test.ts | 2 | 0 | Node |
| test/CitationPostCaseMetadata.test.ts | 5 | 0 | Node |
| test/CitationPreCaseMetadata.test.ts | 4 | 0 | Node |
| test/CitationPriorFulls.test.ts | 2 | 0 | Node |
| test/CitationPublicationResourceHash.test.ts | 5 | 0 | Node |
| test/CitationPythonCase.test.ts | 4 | 0 | Node |
| test/CitationPythonCaseCoverage.test.ts | 2 | 0 | Node |
| test/CitationPythonHash.test.ts | 4 | 0 | Node |
| test/CitationPythonRepr.test.ts | 5 | 0 | Node |
| test/CitationPythonReprCoverage.test.ts | 2 | 0 | Node |
| test/CitationPythonUnicode.test.ts | 7 | 0 | Node |
| test/CitationPythonUnicodeCoverage.test.ts | 3 | 0 | Node |
| test/CitationRecognizerProgram.test.ts | 3 | 0 | Node |
| test/CitationRecognizerWorker.test.ts | 12 | 0 | Node |
| test/CitationReferenceNames.test.ts | 1 | 0 | Node |
| test/CitationReferencePatterns.test.ts | 1 | 0 | Node |
| test/CitationReferencePatternsCoverage.test.ts | 4 | 0 | Node |
| test/CitationReferenceToken.test.ts | 2 | 0 | Node |
| test/CitationReferenceTokenExtractionCoverage.test.ts | 3 | 0 | Node |
| test/CitationRegexAlphabet.test.ts | 8 | 0 | Node |
| test/CitationRegexBoundaries.test.ts | 2 | 0 | Node |
| test/CitationRegexCaptureReuse.test.ts | 2 | 0 | Node |
| test/CitationRegexCaseFlags.test.ts | 2 | 0 | Node |
| test/CitationRegexCharacters.test.ts | 2 | 0 | Node |
| test/CitationRegexDescriptors.test.ts | 9 | 0 | Node |
| test/CitationRegexEngine.test.ts | 4 | 0 | Node |
| test/CitationRegexInput.test.ts | 11 | 0 | Node |
| test/CitationRegexInputCoverage.test.ts | 2 | 0 | Node |
| test/CitationRegexLaneCoverage.test.ts | 6 | 0 | Node |
| test/CitationRegexLookahead.test.ts | 2 | 0 | Node |
| test/CitationRegexNullable.test.ts | 2 | 0 | Node |
| test/CitationRegexOperation.test.ts | 3 | 0 | Node |
| test/CitationRegexPolicyCoverage.test.ts | 2 | 0 | Node |
| test/CitationRegexProgram.test.ts | 14 | 0 | Node |
| test/CitationRegexResult.test.ts | 13 | 0 | Node |
| test/CitationRegexSession.test.ts | 60 | 0 | Node |
| test/CitationRegexSessionProgram.test.ts | 3 | 0 | Node |
| test/CitationRegexSessionProtocol.test.ts | 5 | 0 | Node |
| test/CitationRegexSessionRpc.test.ts | 4 | 0 | Node |
| test/CitationRegexTranslator.test.ts | 7 | 0 | Node |
| test/CitationRegexVerbose.test.ts | 3 | 0 | Node |
| test/CitationRegexWorker.test.ts | 19 | 0 | Node |
| test/CitationRegexWorkerProtocol.test.ts | 15 | 0 | Node |
| test/CitationRendering.test.ts | 5 | 0 | Node |
| test/CitationRenderingOperation.test.ts | 1 | 0 | Node |
| test/CitationReplayBudget.test.ts | 3 | 0 | Node |
| test/CitationResolutionLimit.test.ts | 2 | 0 | Node |
| test/CitationResolve.test.ts | 10 | 0 | Node |
| test/CitationResolverBoundary.test.ts | 6 | 0 | Node |
| test/CitationResolverText.test.ts | 4 | 0 | Node |
| test/CitationResourceCorrection.test.ts | 9 | 0 | Node |
| test/CitationResourceIdentity.test.ts | 5 | 0 | Node |
| test/CitationResourceObjects.test.ts | 3 | 0 | Node |
| test/CitationRuntimeDictionary.test.ts | 4 | 0 | Node |
| test/CitationRuntimeDictionaryCoverage.test.ts | 2 | 0 | Node |
| test/CitationRuntimeSet.test.ts | 6 | 0 | Node |
| test/CitationSemanticExtraction.test.ts | 1 | 0 | Node |
| test/CitationSemanticProjection.test.ts | 6 | 0 | Node |
| test/CitationSemanticProjectionCoverage.test.ts | 3 | 0 | Node |
| test/CitationSessionDescriptors.test.ts | 3 | 0 | Node |
| test/CitationShortMissingPage.test.ts | 3 | 0 | Node |
| test/CitationSixFormArtifact.test.ts | 4 | 0 | Node |
| test/CitationSixFormProjection.test.ts | 2 | 0 | Bun |
| test/CitationSixFormProjectionControls.test.ts | 7 | 0 | Node |
| test/CitationSixFormResolution.test.ts | 9 | 0 | Node |
| test/CitationSourceAnnotation.test.ts | 6 | 0 | Node |
| test/CitationSourceAnnotationTiming.test.ts | 2 | 0 | Node |
| test/CitationSourceCleaning.test.ts | 3 | 0 | Node |
| test/CitationSourceDocument.test.ts | 4 | 0 | Node |
| test/CitationSourceEvidence.test.ts | 3 | 0 | Node |
| test/CitationSourceRequest.test.ts | 10 | 0 | Node |
| test/CitationSpanOffsets.test.ts | 5 | 0 | Node |
| test/CitationStopWords.test.ts | 3 | 0 | Node |
| test/CitationTableCapacity.test.ts | 2 | 0 | Node |
| test/CitationTextBudget.test.ts | 6 | 0 | Node |
| test/CitationTextCapacity.test.ts | 4 | 0 | Node |
| test/CitationTextNativeOrder.test.ts | 1 | 0 | Node |
| test/CitationTokenAssembly.test.ts | 2 | 0 | Node |
| test/CitationTokenCapture.test.ts | 3 | 0 | Node |
| test/CitationTokenContext.test.ts | 3 | 0 | Node |
| test/CitationTokenDispatch.test.ts | 3 | 0 | Node |
| test/CitationTokenEditions.test.ts | 3 | 0 | Node |
| test/CitationTokenEquality.test.ts | 2 | 0 | Node |
| test/CitationTokenObjects.test.ts | 3 | 0 | Node |
| test/CitationTokenText.test.ts | 4 | 0 | Node |
| test/CitationTokenizedExtraction.test.ts | 1 | 0 | Node |
| test/CitationTokenizedExtractionCoverage.test.ts | 1 | 0 | Node |
| test/CitationTokenizer.test.ts | 11 | 0 | Node |
| test/CitationTokenizerCatalog.test.ts | 3 | 0 | Node |
| test/CitationUnicodeDictionary.test.ts | 4 | 0 | Node |
| test/CitationVerifiedExtraction.test.ts | 1 | 0 | Node |
| test/CitationXmlBalanceKernel.test.ts | 2 | 0 | Node |
| test/CitationXmlBalanceKernelCoverage.test.ts | 3 | 0 | Node |
| test/CitationXmlWorker.test.ts | 3 | 0 | Node |
| test/CitationXmlWorkerProtocol.test.ts | 2 | 0 | Node |
| test/integration/CitationCanonicalAnnotationWorkflow.test.ts | 4 | 0 | Node |
| test/integration/CitationCanonicalCourts.test.ts | 3 | 0 | Node |
| test/integration/CitationCanonicalExtraction.test.ts | 4 | 0 | Node |
| test/integration/CitationCanonicalExtractionRange2.test.ts | 4 | 0 | Node |
| test/integration/CitationCanonicalExtractionRange3.test.ts | 4 | 0 | Node |
| test/integration/CitationCanonicalExtractionRange4.test.ts | 4 | 0 | Node |
| test/integration/CitationCanonicalExtractionRange5.test.ts | 4 | 0 | Node |
| test/integration/CitationCanonicalExtractionRange6.test.ts | 2 | 0 | Node |
| test/integration/CitationCanonicalParserOperations.test.ts | 4 | 0 | Node |
| test/integration/CitationCanonicalParserOperationsRange2.test.ts | 4 | 0 | Node |
| test/integration/CitationCanonicalReferenceMarkup.test.ts | 2 | 0 | Node |
| test/integration/CitationCanonicalRemainingExtraction.test.ts | 4 | 0 | Node |
| test/integration/CitationCanonicalRemainingExtractionRange2.test.ts | 3 | 0 | Node |
| test/integration/CitationCanonicalTokenizer.test.ts | 2 | 0 | Node |
| test/integration/CitationCleanerNamedHtml.test.ts | 1 | 0 | Node |
| test/integration/CitationCleanerNativeCustom.test.ts | 1 | 0 | Node |
| test/integration/CitationDiffWorker.test.ts | 2 | 0 | Node |
| test/integration/CitationEditionInference.test.ts | 1 | 0 | Node |
| test/integration/CitationEngineCorpus.test.ts | 2 | 0 | Node |
| test/integration/CitationExtractorSelection.test.ts | 1 | 0 | Node |
| test/integration/CitationFullLawMetadata.test.ts | 1 | 0 | Node |
| test/integration/CitationHtmlUnicode.test.ts | 1 | 0 | Node |
| test/integration/CitationInputDocument.test.ts | 2 | 0 | Node |
| test/integration/CitationJournalMetadata.test.ts | 1 | 0 | Node |
| test/integration/CitationRegexBoundaries.test.ts | 16 | 0 | Node |
| test/integration/CitationRegexCaseFlags.test.ts | 16 | 0 | Node |
| test/integration/CitationRegexTranslator.test.ts | 2 | 0 | Node |
| test/integration/CitationRegexTranslatorNode.test.ts | 2 | 0 | Node |
| test/integration/CitationVerifiedExtraction.test.ts | 1 | 0 | Node |

### Final count gate, process proofs and checks

FullSpan passes **12/12**, including the first original call on Node. Every
construction/call column is asserted exactly by the existing fixture table.
Wall time is diagnostic only: **35.98 seconds**, with Vitest reporting 35.47
seconds. Launch load was 12.86 / 13.82 / 14.13; B1's recorded 58.86-second
receipt was collected at a different load and is not a matched latency claim.

| Per ten plain-text Bun calls | B1 | Merged B2 |
| --- | ---: | ---: |
| Regex child processes | 291 | 10 |
| Regex evaluations | 291 | 291 |
| Metadata-operation installs | 0 | 0 |
| Configuration detaches | 0 | 0 |
| Tokenizer builds | 0 | 0 |
| Regex evaluator constructions | 0 | 0 |
| Descriptor bindings | 4 | 4 |
| Physical native owners | 10 | 10 |
| Native lane acquisitions | 10 | 10 |
| Diff/Xml worker constructions | 0 | 0 |

| Engine construction | B1 | Merged B2 |
| --- | ---: | ---: |
| Metadata-operation installs | 16 | 16 |
| Configuration detaches | 1 | 1 |
| Tokenizer builds | 1 | 1 |
| Regex evaluator constructions | 26 | 26 |
| Regex evaluations | 0 | 0 |
| Regex child processes | 0 | 0 |
| Descriptor bindings | 0 | 0 |
| Physical native owners | 1 | 1 |
| Native lane acquisitions | 0 | 0 |
| Diff/Xml worker constructions | 0 | 0 |

The eight original process obligations all pass again in the 60-test session
file, on both actual child runtimes. Each asserts started equals confirmed:

| Obligation | Bun child | Node child |
| --- | --- | --- |
| Catastrophic deadline, responsive parent, death before evaluate returns | Pass | Pass |
| Job after killed job refuses without a new spawn | Pass | Pass |
| Wrong sequence kills and confirms | Pass | Pass |
| Early EOF kills and confirms | Pass | Pass |
| Oversize frame kills and confirms | Pass | Pass |
| Frame while idle kills and confirms | Pass | Pass |
| Sent interruption kills before acknowledgement | Pass | Pass |
| Running interruption kills before acknowledgement | Pass | Pass |
| Live child closes stdout; parent SIGKILLs and confirms | Pass | Pass |
| python-re then python-regex-v0 in one process | Pass | Pass |
| Schema-invalid engine kills | Pass | Pass |
| Preparation, startup, write, read, retirement and mutex interruption barriers | Pass | Pass |
| Diff start and cleaner yield during preparation | Pass | Pass |

The full test names and initial proof descriptions remain in the earlier
process-proof and Review round 1 tables. The complete file's final count is 60,
including the new retirement/quarantine/adapter regressions described above.

| Required check | Final result |
| --- | --- |
| bun install --frozen-lockfile | Pass |
| Server bun run check | Pass |
| quality package-verify @beep/law-practice-server --quick | Pass, lint and check |
| Server lint:laws | Pass; native-runtime/frozen-grant-set/effect-fn/import laws zero; three inherited advisory terse-effect findings |
| Fallow audit against exact B1 head b9089f34c6b | Pass, zero introduced; 35 inherited duplication findings |
| bun run docgen:local | Pass |
| bun run beep lint effect-vitest | Pass |
| bun run beep lint schema-first | Pass, zero introduced; baseline unchanged |
| Root Oxlint on all B2 touched TypeScript/MJS files | Pass |
| git diff --check and commit hooks | Pass |

No Citation file was skipped. Whole-package tests and whole-package coverage
were not run, as instructed. Optional property sweeps, optional full Node corpus
modes and hosted CI were not enabled; the actual Bun/Node process proofs and
Node FullSpan parity were run. All coverage here is bounded local measurement,
not a claim of a hosted result.

B2 remains **in review**. Both earlier design stops remain resolved by the
owner's depth-4 and per-job-engine rulings. The only new procedural interpretation
is using the exact merged base commit after the remote branch disappeared; all
other lifecycle/coverage interpretations are stated in this receipt. There was
no further design conflict. Commits remain local: no push, rebase or additional
merge, and no subagents.

## Review round 2

The owner merged main at `cc9e2741191` before this wave. All work remains local
on `feat/citation-regex-session`; this wave performs no push, merge or rebase.
The final comparison base is `origin/main` at
`18cf1f69f889a351468c77a25b82a312704811f7`.

### Findings, fixes and regressions

| Accepted finding | Cause and fix | Committed regression |
| --- | --- | --- |
| BLOCKER: escaped unlocked lane operations | `withUse` previously returned unrestricted unlocked operations. Every call now owns a revocation token and an admission semaphore. Every start, reserve and release checks the token after admission; callback completion revokes it, then drains admitted work before releasing handover. Callback invocation is suspended so a synchronous defect also follows revocation. | `revokes a returned unlocked start and a forked late user before releasing the lane`; `revokes capabilities even when the callback throws before returning an Effect`; `holds handover until a concurrently admitted bun operation finishes` and the Node variant. |
| MAJOR: pattern-sized fingerprint copy precedes exact frame refusal | Descriptor selection concatenated the width byte with the pattern. It now incrementally hashes the width and borrowed bytes with the existing catalog's `@noble/hashes` SHA-256. Selection retains only a fixed-size digest. Authoritative verification still uses the captured Effect Digest after exact frame preflight and preparation. | `preflights the installed bun evaluator before pattern maps or compilation` and the Node variant now observe both Uint32Array maps and Uint8Array pattern-byte copies, through the installed evaluator, with a registered pattern and 700-byte source exceeding the complete 1024-byte frame bound. |
| Proof gap: genuine closed stdin and blocked writes | The earlier injected typed I/O test did not prove a real pipe. Two new child modes exercise the actual stdin sink without replacing its error or delaying EPIPE. | `confirms bun death after a real large stdin write receives EPIPE`; `expires the job deadline while a large write to a real bun child is blocked`; both also run with actual Node children. |

The negative controls reproduce the findings: restoring the original unlocked
`withUse` makes the escaped-start regression fail; retaining revocation but
removing its drain makes both handover tests fail. Restoring selection's old
concatenating fingerprint makes both installed-evaluator allocation regressions
fail with an observed pattern-sized copy. All temporary production mutations
were restored before final verification.

The lifetime token remains mandatory at runtime. A Scope requirement on an
Effect cannot stop JavaScript callers from retaining a function or forked fiber;
changing the callback's generic result type would not establish non-escape.
The existing callback contract remains, with runtime revocation for every
operation and a drain inside the handover permit. No trusted-callback assumption
remains. The concurrent tests gate a real spawn with Deferred and prove another
`withUse` evaluation cannot interleave while the admitted operation is pending.

The Effect reference `packages/effect/src/crypto/Digest.ts` exposes a single
contiguous Uint8Array digest input, with no streaming/multi-part service API.
The repo already uses Noble incremental SHA-256; this package now declares that
existing catalog dependency. Its fixed-size state avoids a proportional input
allocation. The original post-preparation Digest verification and typed
fingerprint refusal remain. The existing snapshot regression now asserts
`owns the bun prepared pattern through authoritative fingerprint awaits`
(and Node): mutation of borrowed input during the later authoritative digest
cannot change the owned prepared job. This replaces the old expectation of
mutation during asynchronous descriptor selection, which is now synchronous.
No test was deleted, no guard was removed and no ceiling was changed.

### Paired real-pipe proofs

Both child runtimes receive an encoded frame larger than 1 MiB (one million
ASCII source bytes). A Deferred observes entry to the real sink; a separate
completion Deferred remains unset while the pipe is backpressured. In the
closed-stdin case the child then closes every duplicate of its actual stdin
read side and stays alive. The parent promptly returns `channel-failed` from
genuine EPIPE. In the open/nonreading case, the write remains pending until the
session's actual job sleep is triggered, returning `regexDeadline`.

Each test asserts one live parent SIGKILL, started = confirmed = 1, PID absent
before the joined evaluate result is inspected, capacity returned exactly once,
and a subsequent identical refusal with zero additional starts. Closing Scope
still leaves the return count at one. Both paths pass with Bun and Node child
runtimes, and with Bun and Node parent runners.

The earlier Bun-parent hang no longer reproduces. The earlier small-frame probe
left its manual job timer undriven and did not observe sink completion; it could
not distinguish waiting in write from waiting for a reply. The new proof uses
measured backpressure, an explicit child-close handshake and write-completion
observation, and drives the real job timer for the nonreading case. Effect's
current NodeShared sink has error callback handling and cancellable drain waits;
the Bun platform uses that shared child-process implementation. The relevant
installed Effect/platform versions did not change across the owner's main
merge. No production sink patch was necessary; this is a corrected probe, not
a claim that a package upgrade fixed the old hang. The owner's paired-proof
ruling is recorded in the corresponding decision file.

### Serial affected-file run

Each file ran separately with `nice -n 19 bunx vitest run test/<file>` from the
server package. These 21 files pass **261 tests**, zero failures or skips.
This includes every direct test importer of NativeLane, RegexDescriptors or
RegexSession, the session/protocol/descriptor/worker files, and lane composition,
transfer and cleaner callers. The four real-pipe cases also pass in the
single-file Bun-parent coverage runs.

| Test file | Passing tests |
| --- | ---: |
| CitationAnnotationFailure.test.ts | 2 |
| CitationCleanerPipelineCoverage.test.ts | 7 |
| CitationDiffLaneCoverage.test.ts | 9 |
| CitationHtmlWorker.test.ts | 13 |
| CitationMarkupWorkerCoverage.test.ts | 8 |
| CitationNativeLane.test.ts | 16 |
| CitationNativeLaneCoverage.test.ts | 13 |
| CitationNativeLaneReservation.test.ts | 32 |
| CitationRegexDescriptors.test.ts | 9 |
| CitationRegexEngine.test.ts | 4 |
| CitationRegexLaneCoverage.test.ts | 6 |
| CitationRegexSession.test.ts | 64 |
| CitationRegexSessionProgram.test.ts | 3 |
| CitationRegexSessionProtocol.test.ts | 5 |
| CitationRegexSessionRpc.test.ts | 4 |
| CitationRegexWorker.test.ts | 19 |
| CitationRegexWorkerProtocol.test.ts | 15 |
| CitationTextBudget.test.ts | 6 |
| CitationNativeLaneComposition.test.ts | 4 |
| CitationNativeLaneTransfer.test.ts | 4 |
| CitationCleanerPipeline.test.ts | 18 |

### Single-file coverage union

Each row below is the union of separate one-test-file, one-source-file
Bun-parent Istanbul runs; no package-wide coverage was run. The baseline was
not edited. NativeLane and all four new session files reach 100% in all four
metrics. The descriptor file exceeds every existing baseline floor.

| Source | Lines | Statements | Functions | Branches |
| --- | ---: | ---: | ---: | ---: |
| NativeLane.ts | 100% | 100% | 100% | 100% |
| RegexSession.ts | 100% | 100% | 100% | 100% |
| RegexSessionProtocol.ts | 100% | 100% | 100% | 100% |
| RegexSessionRpc.ts | 100% | 100% | 100% | 100% |
| RegexSessionProgram.ts | 100% | 100% | 100% | 100% |
| RegexDescriptors.ts | 100% | 96.96% | 94.73% | 94.44% |

RegexDescriptors' floors are 97.82/96.15/93.33/92.85 respectively. Its retained
uncovered defensive paths are the authoritative digest-mismatch refusal and
invalid compiled-profile decode mapping. Normal registered patterns produce a
valid owned snapshot and valid compiler profile; this bounded matrix does not
inject corruption into those two internal contracts. Those guards remain.
No guard is uncovered in NativeLane or the four new session files.

| Test file | Source measured | Result |
| --- | --- | --- |
| CitationNativeLaneCoverage.test.ts | NativeLane.ts | Pass |
| CitationNativeLane.test.ts | NativeLane.ts | Pass |
| CitationNativeLaneReservation.test.ts | NativeLane.ts | Pass |
| CitationNativeLaneComposition.test.ts | NativeLane.ts | Pass |
| CitationNativeLaneTransfer.test.ts | NativeLane.ts | Pass |
| CitationRegexSession.test.ts | NativeLane.ts | Pass |
| CitationRegexSession.test.ts | RegexSession.ts | Pass |
| CitationRegexLaneCoverage.test.ts | RegexSession.ts | Pass |
| CitationRegexSessionProtocol.test.ts | RegexSessionProtocol.ts | Pass |
| CitationRegexSessionRpc.test.ts | RegexSessionRpc.ts | Pass |
| CitationRegexSessionProgram.test.ts | RegexSessionProgram.ts | Pass |
| CitationRegexDescriptors.test.ts | RegexDescriptors.ts | Pass |
| CitationRegexSession.test.ts | RegexDescriptors.ts | Pass |

### Final count gate and required checks

`CitationCanonicalFullSpan.test.ts` ran last and passed **12/12** (ten Bun
calls, construction and Node parity). The 21-file affected run plus this gate
is **22 files and 273 passing tests**, zero failures or skips. Session was
rerun after its final assertion change: 64/64. The final file took **35.88 s
wall time**, Vitest 35.40 s, at load **11.60 / 11.72 / 15.39**. Timing gates
nothing. Every work-count assertion passes unchanged from the previous B2 head.

| Per ten plain-text Bun calls | B1 | Round 2 B2 |
| --- | ---: | ---: |
| Regex child processes | 291 | 10 |
| Regex evaluations | 291 | 291 |
| Metadata-operation installs | 0 | 0 |
| Configuration detaches | 0 | 0 |
| Tokenizer builds | 0 | 0 |
| Regex evaluator constructions | 0 | 0 |
| Descriptor bindings | 4 | 4 |
| Physical native owners | 10 | 10 |
| Native lane acquisitions | 10 | 10 |
| Diff/Xml worker constructions | 0 | 0 |

| Engine construction | B1 | Round 2 B2 |
| --- | ---: | ---: |
| Metadata-operation installs | 16 | 16 |
| Configuration detaches | 1 | 1 |
| Tokenizer builds | 1 | 1 |
| Regex evaluator constructions | 26 | 26 |
| Regex evaluations | 0 | 0 |
| Regex child processes | 0 | 0 |
| Descriptor bindings | 0 | 0 |
| Physical native owners | 1 | 1 |
| Native lane acquisitions | 0 | 0 |
| Diff/Xml worker constructions | 0 | 0 |

The session's original eight real-process obligations pass again on both Bun
and Node children: catastrophic deadline with responsive parent and confirmed
death before return; fail-closed job after kill; wrong sequence; early EOF;
oversize frame; unsolicited idle frame; Sent interruption; Running interruption.
Live stdout closure, mixed engines, invalid engine, preparation/startup/write/
read/retirement interruption barriers and both expected handovers also pass.
Their exact names remain in the earlier proof tables and the session test file.
The four new pipe proofs and capability/preflight regressions pass as detailed
above. No spawn-count assertion required rewriting in this round.

| Check | Result |
| --- | --- |
| bun install --frozen-lockfile | Pass |
| Server bun run check | Pass; repeated by quick package verification |
| quality package-verify @beep/law-practice-server --quick | Pass, lint and check |
| Server lint:laws | Pass; three inherited advisory terse-effect findings, strict laws zero |
| Fallow audit --base origin/main | Pass, zero introduced, 35 inherited findings excluded |
| bun run docgen:local --full | Pass, 188-package metadata check, generation and aggregate |
| bun run beep lint effect-vitest | Pass, zero introduced, one resolved |
| bun run beep lint schema-first | Pass, zero introduced, inventory unchanged |
| Root Oxlint on branch-touched TypeScript/MJS | Pass |
| git diff --check and commit hooks | Pass |

An unflagged docgen:local attempt correctly required full mode because the
workspace lockfile changed; the full local run passed. Early development
negative-control failures are intentional reproductions, not final reds.
No coverage baseline, schema-first inventory, limit or public engine shape was
changed. The only added dependency is the existing catalog's Noble hash package.

The whole Citation directory was not rerun in this focused review wave; its
previous 276-file green receipt is retained above. No package-wide tests or
package-wide coverage ran. Hosted CI is not claimed. No requested affected file
or required check was skipped. The three known Bun.version environment-only
files were outside this wave's affected set; they passed with a Bun parent in
the prior complete run. There is no further design conflict or new stop.

Implementation: `0aa05bf28c4` (`fix(citation): revoke lane capabilities and prove
real pipe retirement`). This evidence, the paired-pipe ruling and the generated
checkpoint ship in the subsequent documentation commit. B2 remains **in review**;
both earlier stops remain resolved. No push, merge, rebase or subagents.

## Review round 3

The review base is `c18acaa737d`. This wave fixes the accepted unbounded-drain
finding, nested-use deadlock and missing hash parity regression. Work remains
local on `feat/citation-regex-session`, with no push, merge, rebase or subagents.
The reviewer probes were read and run before implementation: `drain.ts`
reported an interrupted drain still pending and the next callback blocked until
an external Deferred release; `hash.ts` matched all 36 reference cases.

### Findings and fixes

| Finding | Cause and fix | Permanent regression |
| --- | --- | --- |
| MAJOR: unbounded masked drain | The admission semaphore drain waited forever for admitted work. Each admitted operation now runs as retained ownership work; revocation waits on its completion Deferred only within the applicable policy budget. Expiry poisons the lane, quarantines any claimed lease, and returns typed `cleanup-unconfirmed` while releasing handover. A private owner Scope retains unresolved resources beyond invocation closure and closes after late completion. Public retirement refuses to release a pending spawn's lease. | `quarantines an unresolved admission on drain deadline and closes Scope`; `quarantines an unresolved admission on drain interruption and closes Scope`; Bun and Node `retires a ... spawn resolving after its drain bound ... and returns capacity once`, including unconfirmed-first-retirement variants. |
| Nested withUse deadlock | A callback could acquire the same non-reentrant semaphore. Revocable callback context frames now follow child fibers and reject a live same-lane nested call with typed `invalid-runtime` before locking. This uses call lifetime, not fiber identity. | `refuses nested withUse in a callback and its child fiber without taking the lock`. |
| Hash parity/dependency rationale | Selection's Noble incremental hash needed permanent proof against the authoritative captured Digest implementation. A registry-level test installs a descriptor fingerprint computed by Digest, then selects it for each vector. | `selects the authoritative Digest fingerprint for 36 width and SHA-256 boundary cases`. |

### Retained ownership and policy budgets

The post-revocation drain budgets are **queueDeadline** for reserve and
**cleanupDeadline** for release. Start's conservative completion budget is
**queueDeadline + 2 × cleanupDeadline**, covering retirement of the preceding
occupant, admission, and physical spawn transfer. These use existing policy
fields; no limit field or configured limit value changed. Normal awaited
operations do not start an extra drain timer. The count fixture and session's
separate startup/job timers retain their existing meaning.

The caller's wait is bounded; unresolved ownership is retained. On expiry,
no subsequent withUse callback or public start is admitted. A late admission
returns its unspawned lease; a late successful spawn is assigned to the existing
physical owner and retired by its existing parent SIGKILL/confirmation path.
The invocation finalizer does not wait on an unresolved birth lock: it leaves
the private owner Scope with the retained work. Late settlement closes that
Scope. The unconfirmed-first-retirement variants keep quarantine and use the
owner's existing retry on Scope closure, then prove started = confirmed = 1 and
one capacity return. They do not weaken an isRunning or confirmation guard.

An interruption during the masked drain waits within the same finite budget;
it cannot cancel the ownership task or strand the handover permit. Tests drive
the captured policy Clock, including advancing it after requesting interruption.
They prove later use and invocation Scope closure complete while the admitted
operation remains unresolved. The gate is released only afterwards so tests do
not leave detached work behind. A failed drain returns `cleanup-unconfirmed`;
later open-lane use refuses `quarantined`, and use after Scope closure refuses
`closed`. The session translates the newly explicit lane boundary failure into
its existing worker failure domain.

Admission's live check and pending-work publication occur in the same synchronous
suspend callback, using the reference-supported Deferred.makeUnsafe constructor.
There is no Effect yield between checking revocation and publishing admitted
ownership. The already-completed serial-test prefix is replayed after that
final tightening, and all lane coverage receipts are refreshed.

The hash test covers widths 1, 2 and 4 with lengths
`0, 1, 15, 16, 31, 32, 63, 64, 65, 127, 128, 1024`: 36 cases, including empty
storage and byte lengths around SHA-256 blocks. Effect's Digest service has no
streaming/multi-part input API. Noble is the package's declared existing-catalog
dependency; it only selects a candidate. Captured Digest verification alone
admits the prepared pattern. The reason and reversal path are recorded in
`2026-11-14-use-incremental-noble-hashing-only-for-descriptor-candidate-selection.md`.
The drain budgets, quarantine and late ownership are recorded in the separate
bounded-drain decision. Both decision projections were regenerated.

### Full serial directory run and replay

All 275 Citation test files other than the final FullSpan gate ran one file at
a time: **1,303 passing tests, zero failures, zero pending/skipped tests**.
The three files that read Bun.version used a Bun parent: CitationExtractorControls,
CitationConfigurationOwnership and CitationSixFormProjection. All other files
used the prescribed `nice -n 19 bunx vitest run test/<file>` Node parent.
This includes every previously B1-reserved or fixture-mismatch file, every lane
and session importer, and all integration corpora. No corpus was sampled or
its timeout changed. The complete directory is the 276-file set including the
FullSpan file listed below as the final run.

After synchronous admission publication was tightened, the first 29 completed
files were replayed. CitationNativeLaneCoverage was also replayed after its
late-settlement assertion was strengthened: **30 replay files, all passing**.
The stronger assertion waits for the late unit acquisition and release before
checking zero active/quarantined capacity; it cannot pass merely by observing
the initial empty admission state. The final per-file table uses those latest
receipts. No spawn-count assertion was rewritten, and no test was deleted.

| Test file | Passing tests | Parent |
| --- | ---: | --- |
| CitationAdmission.test.ts | 7 | Node |
| CitationAnnotationAssembly.test.ts | 5 | Node |
| CitationAnnotationCallback.test.ts | 2 | Node |
| CitationAnnotationCallbackBoundary.test.ts | 2 | Node |
| CitationAnnotationEntry.test.ts | 5 | Node |
| CitationAnnotationEntryCoverage.test.ts | 2 | Node |
| CitationAnnotationFailure.test.ts | 2 | Node |
| CitationAnnotationSkip.test.ts | 1 | Node |
| CitationAnnotationStyle.test.ts | 2 | Node |
| CitationAnnotationTemplate.test.ts | 2 | Node |
| CitationAnnotationWrap.test.ts | 3 | Node |
| CitationAssetCoverage.test.ts | 3 | Node |
| CitationAuthorityIdentity.test.ts | 7 | Node |
| CitationBuiltinCleaners.test.ts | 2 | Node |
| CitationBuiltinDiff.test.ts | 6 | Node |
| CitationCallbackMutations.test.ts | 2 | Node |
| CitationCallbackRuntimeIndex.test.ts | 5 | Node |
| CitationCallbackSession.test.ts | 16 | Node |
| CitationCallbackSessionCoverage.test.ts | 5 | Node |
| CitationCanonicalAnnotation.test.ts | 2 | Node |
| CitationCanonicalAnnotationWorkflow.test.ts | 1 | Node |
| CitationCanonicalCourts.test.ts | 1 | Node |
| CitationCanonicalDefaultFactory.test.ts | 2 | Node |
| CitationCanonicalDump.test.ts | 2 | Node |
| CitationCanonicalEditionYears.test.ts | 1 | Node |
| CitationCanonicalExtraction.test.ts | 7 | Node |
| CitationCanonicalExtractionRanges.test.ts | 6 | Node |
| CitationCanonicalFullRendering.test.ts | 2 | Node |
| CitationCanonicalLongDiff.test.ts | 2 | Node |
| CitationCanonicalMissingConversion.test.ts | 2 | Node |
| CitationCanonicalPageCorrection.test.ts | 2 | Node |
| CitationCanonicalParsedEquality.test.ts | 2 | Node |
| CitationCanonicalParserOperations.test.ts | 1 | Node |
| CitationCanonicalPinSpan.test.ts | 2 | Node |
| CitationCanonicalRanges.test.ts | 2 | Node |
| CitationCanonicalReferenceMarkup.test.ts | 2 | Node |
| CitationCanonicalRemainingExtraction.test.ts | 1 | Node |
| CitationCanonicalResourceComparison.test.ts | 1 | Node |
| CitationCanonicalSource.test.ts | 1 | Node |
| CitationCanonicalSourceCoverage.test.ts | 2 | Node |
| CitationCanonicalStyle.test.ts | 1 | Node |
| CitationCapturedCleanerPlan.test.ts | 2 | Node |
| CitationCaseMetadata.test.ts | 2 | Node |
| CitationCaseName.test.ts | 2 | Node |
| CitationCaseNameCoverage.test.ts | 2 | Node |
| CitationCaseNamePredicates.test.ts | 4 | Node |
| CitationCaseNameProcess.test.ts | 5 | Node |
| CitationCaseNameScan.test.ts | 4 | Node |
| CitationCaseNameSelection.test.ts | 1 | Node |
| CitationCaseResourceHash.test.ts | 4 | Node |
| CitationCleanerCustomCorpus.test.ts | 3 | Node |
| CitationCleanerNamedCorpus.test.ts | 1 | Node |
| CitationCleanerOwnedInput.test.ts | 4 | Node |
| CitationCleanerParentBudget.test.ts | 5 | Node |
| CitationCleanerPipeline.test.ts | 18 | Node |
| CitationCleanerPipelineCoverage.test.ts | 7 | Node |
| CitationCleanerRegistry.test.ts | 12 | Node |
| CitationCleanerUnicodeValues.test.ts | 7 | Node |
| CitationCleanerValues.test.ts | 8 | Node |
| CitationConfigurationOwnership.test.ts | 6 | Bun |
| CitationContextMatcher.test.ts | 2 | Node |
| CitationCourtLookup.test.ts | 8 | Node |
| CitationDefaultCallbacks.test.ts | 10 | Node |
| CitationDefaultConfiguration.test.ts | 3 | Node |
| CitationDictionaryReentrancy.test.ts | 2 | Node |
| CitationDiffKernel.test.ts | 13 | Node |
| CitationDiffKernelCoverage.test.ts | 1 | Node |
| CitationDiffLaneCoverage.test.ts | 9 | Node |
| CitationDiffStepsCoverage.test.ts | 3 | Node |
| CitationDiffWorker.input-admission.test.ts | 1 | Node |
| CitationDiffWorker.test.ts | 14 | Node |
| CitationDiffWorkerProtocol.test.ts | 4 | Node |
| CitationDocumentCleanerProtocols.test.ts | 10 | Node |
| CitationDocumentExtraction.test.ts | 1 | Node |
| CitationDocumentExtractionCoverage.test.ts | 1 | Node |
| CitationDocumentPersistence.test.ts | 18 | Node |
| CitationDocumentServices.test.ts | 1 | Node |
| CitationDump.test.ts | 9 | Node |
| CitationDumpCoverage.test.ts | 4 | Node |
| CitationEditionInference.test.ts | 3 | Node |
| CitationEngineArtifact.test.ts | 3 | Node |
| CitationEngineBoundaryRefusal.test.ts | 2 | Node |
| CitationEngineCorpus.test.ts | 1 | Node |
| CitationEngineFailure.test.ts | 2 | Node |
| CitationEngineLayer.test.ts | 15 | Node |
| CitationEngineResolution.test.ts | 2 | Node |
| CitationExtractionContext.test.ts | 2 | Node |
| CitationExtractionEntry.test.ts | 1 | Node |
| CitationExtractionEntryCoverage.test.ts | 2 | Node |
| CitationExtractionLoop.test.ts | 15 | Node |
| CitationExtractionReport.test.ts | 1 | Node |
| CitationExtractionSelection.test.ts | 1 | Node |
| CitationExtractionShortcut.test.ts | 1 | Node |
| CitationExtractorControls.test.ts | 24 | Bun |
| CitationExtractorOrdering.test.ts | 2 | Node |
| CitationExtractorRecipes.test.ts | 2 | Node |
| CitationExtractorSelection.test.ts | 5 | Node |
| CitationFrozenEditions.test.ts | 6 | Node |
| CitationFullExtraction.test.ts | 2 | Node |
| CitationFullExtractionCoverage.test.ts | 1 | Node |
| CitationFullLawMetadata.test.ts | 2 | Node |
| CitationGeneratedReferences.test.ts | 2 | Node |
| CitationHelperConfigurations.test.ts | 3 | Node |
| CitationHostResources.test.ts | 8 | Node |
| CitationHtmlBytes.test.ts | 2 | Node |
| CitationHtmlCaseName.test.ts | 3 | Node |
| CitationHtmlCleanerStage.test.ts | 3 | Node |
| CitationHtmlCompletion.test.ts | 3 | Node |
| CitationHtmlDiscovery.test.ts | 2 | Node |
| CitationHtmlDiscoveryCoverage.test.ts | 2 | Node |
| CitationHtmlGeometryPreparation.test.ts | 3 | Node |
| CitationHtmlInput.test.ts | 9 | Node |
| CitationHtmlKernel.test.ts | 18 | Node |
| CitationHtmlNativeInput.test.ts | 5 | Node |
| CitationHtmlWorker.test.ts | 13 | Node |
| CitationHtmlWorkerCorpus.test.ts | 3 | Node |
| CitationHtmlWorkerCoverage.test.ts | 2 | Node |
| CitationHtmlWorkerProgram.test.ts | 5 | Node |
| CitationHtmlWorkerProtocol.test.ts | 6 | Node |
| CitationHtmlWorkerRpc.test.ts | 3 | Node |
| CitationInputDocument.test.ts | 1 | Node |
| CitationInputDocumentCoverage.test.ts | 2 | Node |
| CitationInvocation.test.ts | 4 | Node |
| CitationJournalMetadata.test.ts | 4 | Node |
| CitationLawMetadata.test.ts | 6 | Node |
| CitationLiteralCleaners.test.ts | 8 | Node |
| CitationLiteralUnicodeComposition.test.ts | 4 | Node |
| CitationMarkupWorkerCoverage.test.ts | 8 | Node |
| CitationMention.test.ts | 13 | Node |
| CitationMentionIdentity.test.ts | 7 | Node |
| CitationMetadataStrings.test.ts | 3 | Node |
| CitationMetadataYear.test.ts | 5 | Node |
| CitationMixedResourceObjects.test.ts | 2 | Node |
| CitationModelMutation.test.ts | 2 | Node |
| CitationNativeAdmission.test.ts | 13 | Node |
| CitationNativeAdmissionCoverage.test.ts | 2 | Node |
| CitationNativeLane.test.ts | 16 | Node |
| CitationNativeLaneCleaner.test.ts | 2 | Node |
| CitationNativeLaneComposition.test.ts | 4 | Node |
| CitationNativeLaneCoverage.test.ts | 20 | Node |
| CitationNativeLaneReservation.test.ts | 32 | Node |
| CitationNativeLaneTransfer.test.ts | 4 | Node |
| CitationNativeProcess.test.ts | 5 | Node |
| CitationNativeProcessCoverage.test.ts | 3 | Node |
| CitationNativeRpc.test.ts | 6 | Node |
| CitationNativeSlices.test.ts | 3 | Node |
| CitationNativeSocket.test.ts | 12 | Node |
| CitationOccurrenceProjectionCoverage.test.ts | 4 | Node |
| CitationPairedSource.test.ts | 2 | Node |
| CitationParserCatalog.test.ts | 2 | Node |
| CitationPinExtraction.test.ts | 4 | Node |
| CitationPortFailure.test.ts | 2 | Node |
| CitationPostCaseMetadata.test.ts | 5 | Node |
| CitationPreCaseMetadata.test.ts | 4 | Node |
| CitationPriorFulls.test.ts | 2 | Node |
| CitationPublicationResourceHash.test.ts | 5 | Node |
| CitationPythonCase.test.ts | 4 | Node |
| CitationPythonCaseCoverage.test.ts | 2 | Node |
| CitationPythonHash.test.ts | 4 | Node |
| CitationPythonRepr.test.ts | 5 | Node |
| CitationPythonReprCoverage.test.ts | 2 | Node |
| CitationPythonUnicode.test.ts | 7 | Node |
| CitationPythonUnicodeCoverage.test.ts | 3 | Node |
| CitationRecognizerProgram.test.ts | 3 | Node |
| CitationRecognizerWorker.test.ts | 12 | Node |
| CitationReferenceNames.test.ts | 1 | Node |
| CitationReferencePatterns.test.ts | 1 | Node |
| CitationReferencePatternsCoverage.test.ts | 4 | Node |
| CitationReferenceToken.test.ts | 2 | Node |
| CitationReferenceTokenExtractionCoverage.test.ts | 3 | Node |
| CitationRegexAlphabet.test.ts | 8 | Node |
| CitationRegexBoundaries.test.ts | 2 | Node |
| CitationRegexCaptureReuse.test.ts | 2 | Node |
| CitationRegexCaseFlags.test.ts | 2 | Node |
| CitationRegexCharacters.test.ts | 2 | Node |
| CitationRegexDescriptors.test.ts | 10 | Node |
| CitationRegexEngine.test.ts | 4 | Node |
| CitationRegexInput.test.ts | 11 | Node |
| CitationRegexInputCoverage.test.ts | 2 | Node |
| CitationRegexLaneCoverage.test.ts | 6 | Node |
| CitationRegexLookahead.test.ts | 2 | Node |
| CitationRegexNullable.test.ts | 2 | Node |
| CitationRegexOperation.test.ts | 3 | Node |
| CitationRegexPolicyCoverage.test.ts | 2 | Node |
| CitationRegexProgram.test.ts | 14 | Node |
| CitationRegexResult.test.ts | 13 | Node |
| CitationRegexSession.test.ts | 64 | Node |
| CitationRegexSessionProgram.test.ts | 3 | Node |
| CitationRegexSessionProtocol.test.ts | 5 | Node |
| CitationRegexSessionRpc.test.ts | 4 | Node |
| CitationRegexTranslator.test.ts | 7 | Node |
| CitationRegexVerbose.test.ts | 3 | Node |
| CitationRegexWorker.test.ts | 19 | Node |
| CitationRegexWorkerProtocol.test.ts | 15 | Node |
| CitationRendering.test.ts | 5 | Node |
| CitationRenderingOperation.test.ts | 1 | Node |
| CitationReplayBudget.test.ts | 3 | Node |
| CitationResolutionLimit.test.ts | 2 | Node |
| CitationResolve.test.ts | 10 | Node |
| CitationResolverBoundary.test.ts | 6 | Node |
| CitationResolverText.test.ts | 4 | Node |
| CitationResourceCorrection.test.ts | 9 | Node |
| CitationResourceIdentity.test.ts | 5 | Node |
| CitationResourceObjects.test.ts | 3 | Node |
| CitationRuntimeDictionary.test.ts | 4 | Node |
| CitationRuntimeDictionaryCoverage.test.ts | 2 | Node |
| CitationRuntimeSet.test.ts | 6 | Node |
| CitationSemanticExtraction.test.ts | 1 | Node |
| CitationSemanticProjection.test.ts | 6 | Node |
| CitationSemanticProjectionCoverage.test.ts | 3 | Node |
| CitationSessionDescriptors.test.ts | 3 | Node |
| CitationShortMissingPage.test.ts | 3 | Node |
| CitationSixFormArtifact.test.ts | 4 | Node |
| CitationSixFormProjection.test.ts | 2 | Bun |
| CitationSixFormProjectionControls.test.ts | 7 | Node |
| CitationSixFormResolution.test.ts | 9 | Node |
| CitationSourceAnnotation.test.ts | 6 | Node |
| CitationSourceAnnotationTiming.test.ts | 2 | Node |
| CitationSourceCleaning.test.ts | 3 | Node |
| CitationSourceDocument.test.ts | 4 | Node |
| CitationSourceEvidence.test.ts | 3 | Node |
| CitationSourceRequest.test.ts | 10 | Node |
| CitationSpanOffsets.test.ts | 5 | Node |
| CitationStopWords.test.ts | 3 | Node |
| CitationTableCapacity.test.ts | 2 | Node |
| CitationTextBudget.test.ts | 6 | Node |
| CitationTextCapacity.test.ts | 4 | Node |
| CitationTextNativeOrder.test.ts | 1 | Node |
| CitationTokenAssembly.test.ts | 2 | Node |
| CitationTokenCapture.test.ts | 3 | Node |
| CitationTokenContext.test.ts | 3 | Node |
| CitationTokenDispatch.test.ts | 3 | Node |
| CitationTokenEditions.test.ts | 3 | Node |
| CitationTokenEquality.test.ts | 2 | Node |
| CitationTokenObjects.test.ts | 3 | Node |
| CitationTokenText.test.ts | 4 | Node |
| CitationTokenizedExtraction.test.ts | 1 | Node |
| CitationTokenizedExtractionCoverage.test.ts | 1 | Node |
| CitationTokenizer.test.ts | 11 | Node |
| CitationTokenizerCatalog.test.ts | 3 | Node |
| CitationUnicodeDictionary.test.ts | 4 | Node |
| CitationVerifiedExtraction.test.ts | 1 | Node |
| CitationXmlBalanceKernel.test.ts | 2 | Node |
| CitationXmlBalanceKernelCoverage.test.ts | 3 | Node |
| CitationXmlWorker.test.ts | 3 | Node |
| CitationXmlWorkerProtocol.test.ts | 2 | Node |
| integration/CitationCanonicalAnnotationWorkflow.test.ts | 4 | Node |
| integration/CitationCanonicalCourts.test.ts | 3 | Node |
| integration/CitationCanonicalExtraction.test.ts | 4 | Node |
| integration/CitationCanonicalExtractionRange2.test.ts | 4 | Node |
| integration/CitationCanonicalExtractionRange3.test.ts | 4 | Node |
| integration/CitationCanonicalExtractionRange4.test.ts | 4 | Node |
| integration/CitationCanonicalExtractionRange5.test.ts | 4 | Node |
| integration/CitationCanonicalExtractionRange6.test.ts | 2 | Node |
| integration/CitationCanonicalParserOperations.test.ts | 4 | Node |
| integration/CitationCanonicalParserOperationsRange2.test.ts | 4 | Node |
| integration/CitationCanonicalReferenceMarkup.test.ts | 2 | Node |
| integration/CitationCanonicalRemainingExtraction.test.ts | 4 | Node |
| integration/CitationCanonicalRemainingExtractionRange2.test.ts | 3 | Node |
| integration/CitationCanonicalTokenizer.test.ts | 2 | Node |
| integration/CitationCleanerNamedHtml.test.ts | 1 | Node |
| integration/CitationCleanerNativeCustom.test.ts | 1 | Node |
| integration/CitationDiffWorker.test.ts | 2 | Node |
| integration/CitationEditionInference.test.ts | 1 | Node |
| integration/CitationEngineCorpus.test.ts | 2 | Node |
| integration/CitationExtractorSelection.test.ts | 1 | Node |
| integration/CitationFullLawMetadata.test.ts | 1 | Node |
| integration/CitationHtmlUnicode.test.ts | 1 | Node |
| integration/CitationInputDocument.test.ts | 2 | Node |
| integration/CitationJournalMetadata.test.ts | 1 | Node |
| integration/CitationRegexBoundaries.test.ts | 16 | Node |
| integration/CitationRegexCaseFlags.test.ts | 16 | Node |
| integration/CitationRegexTranslator.test.ts | 2 | Node |
| integration/CitationRegexTranslatorNode.test.ts | 2 | Node |
| integration/CitationVerifiedExtraction.test.ts | 1 | Node |

### Single-file coverage union

The final union merges 18 separate one-test-file, one-source-file Bun-parent
Istanbul runs. Every run passes. No package-wide coverage ran, and no baseline
or ignore comment was changed.

| Source | Lines | Statements | Functions | Branches |
| --- | ---: | ---: | ---: | ---: |
| NativeLane.ts | 100% | 100% | 100% | 100% |
| RegexSession.ts | 100% | 100% | 100% | 100% |
| RegexSessionProtocol.ts | 100% | 100% | 100% | 100% |
| RegexSessionRpc.ts | 100% | 100% | 100% | 100% |
| RegexSessionProgram.ts | 100% | 100% | 100% | 100% |
| RegexDescriptors.ts | 100% | 96.96% | 94.73% | 94.44% |

NativeLane's union includes all nine direct lane-importing test files plus
CitationNativeLaneComposition and CitationNativeLaneTransfer. In particular,
CitationRegexSession supplies the lifecycle and callback paths missing from a
lane-files-only measurement. NativeLane and the four session files have no
uncovered guard. RegexDescriptors is unchanged as source in this wave and stays
above all its existing floors; its retained uncovered authoritative-digest
mismatch and invalid compiled-profile decode guards are described in round 2.

| Test file | Source measured | Passing tests |
| --- | --- | ---: |
| CitationNativeLaneCoverage.test.ts | NativeLane.ts | 20 |
| CitationNativeLane.test.ts | NativeLane.ts | 16 |
| CitationNativeLaneReservation.test.ts | NativeLane.ts | 32 |
| CitationNativeLaneComposition.test.ts | NativeLane.ts | 4 |
| CitationNativeLaneTransfer.test.ts | NativeLane.ts | 4 |
| CitationRegexSession.test.ts | NativeLane.ts | 64 |
| CitationRegexSession.test.ts | RegexSession.ts | 64 |
| CitationRegexLaneCoverage.test.ts | RegexSession.ts | 6 |
| CitationRegexSessionProtocol.test.ts | RegexSessionProtocol.ts | 5 |
| CitationRegexSessionRpc.test.ts | RegexSessionRpc.ts | 4 |
| CitationRegexSessionProgram.test.ts | RegexSessionProgram.ts | 3 |
| CitationRegexDescriptors.test.ts | RegexDescriptors.ts | 10 |
| CitationRegexSession.test.ts | RegexDescriptors.ts | 64 |
| CitationCleanerPipelineCoverage.test.ts | NativeLane.ts | 7 |
| CitationDiffLaneCoverage.test.ts | NativeLane.ts | 9 |
| CitationHtmlWorker.test.ts | NativeLane.ts | 13 |
| CitationMarkupWorkerCoverage.test.ts | NativeLane.ts | 8 |
| CitationRegexLaneCoverage.test.ts | NativeLane.ts | 6 |

### Final count gate and process proofs

| Final test file | Passing tests | Parent |
| --- | ---: | --- |
| CitationCanonicalFullSpan.test.ts | 12 | Node, exercising ten Bun calls and Node parity |

FullSpan ran **last**, after all directory files, replays and coverage runs.
It passed **12/12**, for **276 unique files and 1,315 passing tests** overall,
zero failures or skips. Wall time was **31.66 seconds**, Vitest **31.22 seconds**,
at load **5.66 / 6.18 / 7.38**. Timing gates nothing.

| Per ten plain-text Bun calls | B1 | Review base c18acaa737d | Round 3 |
| --- | ---: | ---: | ---: |
| Regex child processes | 291 | 10 | 10 |
| Regex evaluations | 291 | 291 | 291 |
| Metadata-operation installs | 0 | 0 | 0 |
| Configuration detaches | 0 | 0 | 0 |
| Tokenizer builds | 0 | 0 | 0 |
| Regex evaluator constructions | 0 | 0 | 0 |
| Descriptor bindings | 4 | 4 | 4 |
| Physical native owners | 10 | 10 | 10 |
| Native lane acquisitions | 10 | 10 | 10 |
| Diff/Xml worker constructions | 0 | 0 | 0 |

| Engine construction | B1 | Review base / Round 3 |
| --- | ---: | ---: |
| Metadata-operation installs | 16 | 16 |
| Configuration detaches | 1 | 1 |
| Tokenizer builds | 1 | 1 |
| Regex evaluator constructions | 26 | 26 |
| Regex evaluations | 0 | 0 |
| Regex child processes | 0 | 0 |
| Descriptor bindings | 0 | 0 |
| Physical native owners | 1 | 1 |
| Native lane acquisitions | 0 | 0 |
| Diff/Xml worker constructions | 0 | 0 |

The 64-test session file passes in the full Node-parent run and the fresh
single-file Bun-parent coverage runs. Each original process proof again asserts
started equals confirmed on both actual child runtimes:

| Obligation | Bun child | Node child |
| --- | --- | --- |
| Catastrophic deadline, responsive parent, death before evaluate returns | Pass | Pass |
| Job after killed job refuses without spawn | Pass | Pass |
| Wrong sequence kills and confirms | Pass | Pass |
| Early EOF kills and confirms | Pass | Pass |
| Oversize frame kills and confirms | Pass | Pass |
| Frame while idle kills and confirms | Pass | Pass |
| Sent interruption confirms death before acknowledgement | Pass | Pass |
| Running interruption confirms death before acknowledgement | Pass | Pass |
| Live stdout closure kills and confirms | Pass | Pass |
| Mixed engines within one process / invalid engine deviation | Pass | Pass |
| Preparation/startup/write/read/retirement interruption barriers | Pass | Pass |
| Diff start and cleaner yield handovers | Pass | Pass |
| Genuine EPIPE and blocked-write deadline paired pipe proofs | Pass | Pass |
| Late spawn after drain bound, including unconfirmed first retirement | Pass | Pass |

The exact original proof names remain in the earlier process tables and session
file. New round-3 names are in this section's findings table. The nested-call,
never-completing admission, interrupted-drain and 36-vector hash tests also pass.
No prior safety proof was deleted or loosened.

### Required checks and scope

| Check | Final result |
| --- | --- |
| Server bun run check | Pass; final quick verification repeats source and test typechecks |
| quality package-verify @beep/law-practice-server --quick | Pass, lint and check |
| Package lint:laws | Pass, strict laws zero; three inherited advisory terse-effect findings |
| bun run beep lint | Pass, full root sweep including dependency/import and policy checks |
| bun run beep cache profile | Pass, identity lint candidate profile current |
| Fallow audit --base origin/main | Pass, zero introduced; 35 inherited findings excluded |
| bun run docgen:local --full | Pass, 188-package metadata check, generation and aggregation |
| bun run beep lint effect-vitest | Pass, zero introduced, inventory unchanged |
| bun run beep lint schema-first | Pass, zero introduced, inventory unchanged |
| Root Oxlint on branch-touched TypeScript/MJS | Pass |
| git diff --check and commit hooks | Pass |
| Goal decision projection | Pass, regenerated after every decision edit |

The final Fallow invocation resolved origin/main to `9a203bd42645c8947dc3d8c18a20ec11b9a2cbc2`.
The shared remote-tracking ref advanced during the long run; this wave did not
merge or rebase. The command compared the ref requested by the owner at
execution, and the exact hash is retained here.

Early local development failures were fixed before these final receipts:
the interruption test initially left its controlled clock undriven; a strict
Exit comparison included trace annotations and was replaced by an exact typed
failure assertion through Effect.flip; two introduced root lint findings
(generator helper form and hand-rolled Exit assertion) were corrected. Test
registration and hash-byte fixture construction were separated to keep Fallow
complexity within its gate. The final root sweep, focused checks, replay and
coverage runs are green; no inventory growth was accepted to silence a finding.

No Citation file was skipped. Whole-package/parallel suite runs and package-wide
coverage were not run. The three Bun.version-dependent files ran successfully
with a Bun parent, so there is no environment-only red in this receipt. Hosted
CI is not claimed. Frozen-lockfile installation was not repeated in round 3:
manifest/lockfile bytes are unchanged from the passing round-2 install; the
required dependency and cache-policy validation was rerun and passed.

B2 remains **in review**. Both original stops remain resolved; no further design
conflict occurred. The explicit interpretations are the conservative per-kind
post-revocation budgets, retained private owner Scope for unresolved cleanup,
and per-call context frames for nested-use detection, all recorded above and
in decision files. Regular awaited operations retain their original deadlines;
only revoked outstanding work uses the new bounded drain protocol. No configured
limit value, extraction output, public CitationEngine shape, guard or fingerprint
authority was changed. No spawn-count assertion required rewriting this round.

Implementation commits: `821b43d9537` (bounded retained drain and nesting/hash
regressions), `8f287426980` (synchronous admission publication), and
`4d6d410ba2c` (explicit late-admission settlement assertion). This receipt,
associated decisions and the generated checkpoint ship in the following docs
commit. The lane is preserved locally for independent review; no push, merge,
rebase or subagents.

## Review round 4

The review base is `fe714d0ecdb`. The accepted MAJOR was a retained start
continuing from a delayed healthy admission snapshot after its lane had already
been poisoned and its lease quarantined. The old continuation could still call
the physical spawner, then retire that unnecessary child.

### Reproduction, fence and permanent regression

The reviewer's `race.test.ts` and configuration were read first. Before changing
production code, the first four permanent cases in CitationNativeLaneFence ran
against the review base: delayed snapshot and paused owner continuation on each
Bun/Node runtime command. All four failed as expected, observing **spawned = 1,
confirmed = 1** where zero was required. These were real observed spawners and
real executable child commands, not fake process handles. The additional
owner-side probe measured the old hand-off after its internal Effect steps.

The fix has two layers:

1. Admission revalidates closed/poisoned lane state and the exact call's live
   authority before claiming, after acquisition, after its accounting span and
   after snapshot delivery. A stale healthy snapshot cannot authorize a birth.
2. The concrete physical owner's optional typed fence runs after the birth-lock
   wait, owner checks, Scope/Ref/semaphore creation and ownership registration.
   The last authority read and call to the captured spawner are in **one
   synchronous Effect.suspend callback**. There is no Effect yield between them.
   Real platform errors alone are mapped to spawn-failed; a fence's typed refusal
   remains the child's failure Exit. The lane retires that empty registered
   resource and returns capacity through the existing release path.

The default two-argument physical-owner behavior and generic starter contract
remain compatible. No limit value, public engine shape, extraction output,
confirmation guard, protocol frame or fingerprint authority changed.

The permanent file has **eight cases**:

| Case family | Bun command | Node command |
| --- | --- | --- |
| Drain expires while a healthy snapshot's delivery is paused | Pass | Pass |
| Drain expires at each measured pre-hand-off owner scheduler boundary | Pass | Pass |
| Call is revoked at snapshot delivery before the drain expires | Pass | Pass |
| Call is revoked at an owner continuation before the drain expires | Pass | Pass |

Each expiry case asserts zero spawner method hand-offs, **zero physical starts
and zero confirmations**, exactly one lease return, refusal of later start and
withUse calls, and no additional return on Scope closure. Token-only revocation
cases prove the specific call authority matters even without lane poisoning.

The owner sweep calibrates the pre-hand-off Effect boundaries with a synchronous
fence that refuses without calling the real spawner, asserts a positive boundary
count, then parks each measured boundary in turn using the public v4 Scheduler
and Tracer APIs plus a Deferred barrier. It therefore covers owner-side waits
without hard-coding an interpreter operation count or adding a production test
hook. Both parent runtimes exercise the same cases in the final serial and
single-file coverage runs.

### Explicit accepted limit

**Work that never resolves at all keeps its private Scope and quarantined
capacity indefinitely. The guarantee is a bounded caller wait, not eventual
settlement.** There is no claim that every retained operation will finish.
Returning capacity or discarding the ownership record while a spawn or process
is unresolved would permit an unaccounted child and violate confirmed retirement
and the one-occupant invariant. If already-authorized work later resolves, the
existing retirement path can confirm it and return capacity once. No subsequent
start is permitted on the poisoned lane. This is the owner's explicitly accepted
limit, recorded in the round-4 fence decision as well as this receipt.

Implementation: `8f848e9a2e9` (`fix(citation): fence physical spawn against revoked
lane authority`). Work remains local; no push, merge, rebase or subagents.

### Complete serial Citation run

All 276 files other than the final FullSpan gate pass: **1,311 tests**, zero
failures or skips. Each file ran individually with nice -n 19. The three files
that require Bun.version used a Bun parent; all other files used the prescribed
Node-parent bunx Vitest command. All integration corpora ran in full under their
existing timeouts. There was no sampling or parallel whole-suite invocation.

| Test file | Passing tests | Parent |
| --- | ---: | --- |
| CitationAdmission.test.ts | 7 | Node |
| CitationAnnotationAssembly.test.ts | 5 | Node |
| CitationAnnotationCallback.test.ts | 2 | Node |
| CitationAnnotationCallbackBoundary.test.ts | 2 | Node |
| CitationAnnotationEntry.test.ts | 5 | Node |
| CitationAnnotationEntryCoverage.test.ts | 2 | Node |
| CitationAnnotationFailure.test.ts | 2 | Node |
| CitationAnnotationSkip.test.ts | 1 | Node |
| CitationAnnotationStyle.test.ts | 2 | Node |
| CitationAnnotationTemplate.test.ts | 2 | Node |
| CitationAnnotationWrap.test.ts | 3 | Node |
| CitationAssetCoverage.test.ts | 3 | Node |
| CitationAuthorityIdentity.test.ts | 7 | Node |
| CitationBuiltinCleaners.test.ts | 2 | Node |
| CitationBuiltinDiff.test.ts | 6 | Node |
| CitationCallbackMutations.test.ts | 2 | Node |
| CitationCallbackRuntimeIndex.test.ts | 5 | Node |
| CitationCallbackSession.test.ts | 16 | Node |
| CitationCallbackSessionCoverage.test.ts | 5 | Node |
| CitationCanonicalAnnotation.test.ts | 2 | Node |
| CitationCanonicalAnnotationWorkflow.test.ts | 1 | Node |
| CitationCanonicalCourts.test.ts | 1 | Node |
| CitationCanonicalDefaultFactory.test.ts | 2 | Node |
| CitationCanonicalDump.test.ts | 2 | Node |
| CitationCanonicalEditionYears.test.ts | 1 | Node |
| CitationCanonicalExtraction.test.ts | 7 | Node |
| CitationCanonicalExtractionRanges.test.ts | 6 | Node |
| CitationCanonicalFullRendering.test.ts | 2 | Node |
| CitationCanonicalLongDiff.test.ts | 2 | Node |
| CitationCanonicalMissingConversion.test.ts | 2 | Node |
| CitationCanonicalPageCorrection.test.ts | 2 | Node |
| CitationCanonicalParsedEquality.test.ts | 2 | Node |
| CitationCanonicalParserOperations.test.ts | 1 | Node |
| CitationCanonicalPinSpan.test.ts | 2 | Node |
| CitationCanonicalRanges.test.ts | 2 | Node |
| CitationCanonicalReferenceMarkup.test.ts | 2 | Node |
| CitationCanonicalRemainingExtraction.test.ts | 1 | Node |
| CitationCanonicalResourceComparison.test.ts | 1 | Node |
| CitationCanonicalSource.test.ts | 1 | Node |
| CitationCanonicalSourceCoverage.test.ts | 2 | Node |
| CitationCanonicalStyle.test.ts | 1 | Node |
| CitationCapturedCleanerPlan.test.ts | 2 | Node |
| CitationCaseMetadata.test.ts | 2 | Node |
| CitationCaseName.test.ts | 2 | Node |
| CitationCaseNameCoverage.test.ts | 2 | Node |
| CitationCaseNamePredicates.test.ts | 4 | Node |
| CitationCaseNameProcess.test.ts | 5 | Node |
| CitationCaseNameScan.test.ts | 4 | Node |
| CitationCaseNameSelection.test.ts | 1 | Node |
| CitationCaseResourceHash.test.ts | 4 | Node |
| CitationCleanerCustomCorpus.test.ts | 3 | Node |
| CitationCleanerNamedCorpus.test.ts | 1 | Node |
| CitationCleanerOwnedInput.test.ts | 4 | Node |
| CitationCleanerParentBudget.test.ts | 5 | Node |
| CitationCleanerPipeline.test.ts | 18 | Node |
| CitationCleanerPipelineCoverage.test.ts | 7 | Node |
| CitationCleanerRegistry.test.ts | 12 | Node |
| CitationCleanerUnicodeValues.test.ts | 7 | Node |
| CitationCleanerValues.test.ts | 8 | Node |
| CitationConfigurationOwnership.test.ts | 6 | Bun |
| CitationContextMatcher.test.ts | 2 | Node |
| CitationCourtLookup.test.ts | 8 | Node |
| CitationDefaultCallbacks.test.ts | 10 | Node |
| CitationDefaultConfiguration.test.ts | 3 | Node |
| CitationDictionaryReentrancy.test.ts | 2 | Node |
| CitationDiffKernel.test.ts | 13 | Node |
| CitationDiffKernelCoverage.test.ts | 1 | Node |
| CitationDiffLaneCoverage.test.ts | 9 | Node |
| CitationDiffStepsCoverage.test.ts | 3 | Node |
| CitationDiffWorker.input-admission.test.ts | 1 | Node |
| CitationDiffWorker.test.ts | 14 | Node |
| CitationDiffWorkerProtocol.test.ts | 4 | Node |
| CitationDocumentCleanerProtocols.test.ts | 10 | Node |
| CitationDocumentExtraction.test.ts | 1 | Node |
| CitationDocumentExtractionCoverage.test.ts | 1 | Node |
| CitationDocumentPersistence.test.ts | 18 | Node |
| CitationDocumentServices.test.ts | 1 | Node |
| CitationDump.test.ts | 9 | Node |
| CitationDumpCoverage.test.ts | 4 | Node |
| CitationEditionInference.test.ts | 3 | Node |
| CitationEngineArtifact.test.ts | 3 | Node |
| CitationEngineBoundaryRefusal.test.ts | 2 | Node |
| CitationEngineCorpus.test.ts | 1 | Node |
| CitationEngineFailure.test.ts | 2 | Node |
| CitationEngineLayer.test.ts | 15 | Node |
| CitationEngineResolution.test.ts | 2 | Node |
| CitationExtractionContext.test.ts | 2 | Node |
| CitationExtractionEntry.test.ts | 1 | Node |
| CitationExtractionEntryCoverage.test.ts | 2 | Node |
| CitationExtractionLoop.test.ts | 15 | Node |
| CitationExtractionReport.test.ts | 1 | Node |
| CitationExtractionSelection.test.ts | 1 | Node |
| CitationExtractionShortcut.test.ts | 1 | Node |
| CitationExtractorControls.test.ts | 24 | Bun |
| CitationExtractorOrdering.test.ts | 2 | Node |
| CitationExtractorRecipes.test.ts | 2 | Node |
| CitationExtractorSelection.test.ts | 5 | Node |
| CitationFrozenEditions.test.ts | 6 | Node |
| CitationFullExtraction.test.ts | 2 | Node |
| CitationFullExtractionCoverage.test.ts | 1 | Node |
| CitationFullLawMetadata.test.ts | 2 | Node |
| CitationGeneratedReferences.test.ts | 2 | Node |
| CitationHelperConfigurations.test.ts | 3 | Node |
| CitationHostResources.test.ts | 8 | Node |
| CitationHtmlBytes.test.ts | 2 | Node |
| CitationHtmlCaseName.test.ts | 3 | Node |
| CitationHtmlCleanerStage.test.ts | 3 | Node |
| CitationHtmlCompletion.test.ts | 3 | Node |
| CitationHtmlDiscovery.test.ts | 2 | Node |
| CitationHtmlDiscoveryCoverage.test.ts | 2 | Node |
| CitationHtmlGeometryPreparation.test.ts | 3 | Node |
| CitationHtmlInput.test.ts | 9 | Node |
| CitationHtmlKernel.test.ts | 18 | Node |
| CitationHtmlNativeInput.test.ts | 5 | Node |
| CitationHtmlWorker.test.ts | 13 | Node |
| CitationHtmlWorkerCorpus.test.ts | 3 | Node |
| CitationHtmlWorkerCoverage.test.ts | 2 | Node |
| CitationHtmlWorkerProgram.test.ts | 5 | Node |
| CitationHtmlWorkerProtocol.test.ts | 6 | Node |
| CitationHtmlWorkerRpc.test.ts | 3 | Node |
| CitationInputDocument.test.ts | 1 | Node |
| CitationInputDocumentCoverage.test.ts | 2 | Node |
| CitationInvocation.test.ts | 4 | Node |
| CitationJournalMetadata.test.ts | 4 | Node |
| CitationLawMetadata.test.ts | 6 | Node |
| CitationLiteralCleaners.test.ts | 8 | Node |
| CitationLiteralUnicodeComposition.test.ts | 4 | Node |
| CitationMarkupWorkerCoverage.test.ts | 8 | Node |
| CitationMention.test.ts | 13 | Node |
| CitationMentionIdentity.test.ts | 7 | Node |
| CitationMetadataStrings.test.ts | 3 | Node |
| CitationMetadataYear.test.ts | 5 | Node |
| CitationMixedResourceObjects.test.ts | 2 | Node |
| CitationModelMutation.test.ts | 2 | Node |
| CitationNativeAdmission.test.ts | 13 | Node |
| CitationNativeAdmissionCoverage.test.ts | 2 | Node |
| CitationNativeLane.test.ts | 16 | Node |
| CitationNativeLaneCleaner.test.ts | 2 | Node |
| CitationNativeLaneComposition.test.ts | 4 | Node |
| CitationNativeLaneCoverage.test.ts | 20 | Node |
| CitationNativeLaneFence.test.ts | 8 | Node |
| CitationNativeLaneReservation.test.ts | 32 | Node |
| CitationNativeLaneTransfer.test.ts | 4 | Node |
| CitationNativeProcess.test.ts | 5 | Node |
| CitationNativeProcessCoverage.test.ts | 3 | Node |
| CitationNativeRpc.test.ts | 6 | Node |
| CitationNativeSlices.test.ts | 3 | Node |
| CitationNativeSocket.test.ts | 12 | Node |
| CitationOccurrenceProjectionCoverage.test.ts | 4 | Node |
| CitationPairedSource.test.ts | 2 | Node |
| CitationParserCatalog.test.ts | 2 | Node |
| CitationPinExtraction.test.ts | 4 | Node |
| CitationPortFailure.test.ts | 2 | Node |
| CitationPostCaseMetadata.test.ts | 5 | Node |
| CitationPreCaseMetadata.test.ts | 4 | Node |
| CitationPriorFulls.test.ts | 2 | Node |
| CitationPublicationResourceHash.test.ts | 5 | Node |
| CitationPythonCase.test.ts | 4 | Node |
| CitationPythonCaseCoverage.test.ts | 2 | Node |
| CitationPythonHash.test.ts | 4 | Node |
| CitationPythonRepr.test.ts | 5 | Node |
| CitationPythonReprCoverage.test.ts | 2 | Node |
| CitationPythonUnicode.test.ts | 7 | Node |
| CitationPythonUnicodeCoverage.test.ts | 3 | Node |
| CitationRecognizerProgram.test.ts | 3 | Node |
| CitationRecognizerWorker.test.ts | 12 | Node |
| CitationReferenceNames.test.ts | 1 | Node |
| CitationReferencePatterns.test.ts | 1 | Node |
| CitationReferencePatternsCoverage.test.ts | 4 | Node |
| CitationReferenceToken.test.ts | 2 | Node |
| CitationReferenceTokenExtractionCoverage.test.ts | 3 | Node |
| CitationRegexAlphabet.test.ts | 8 | Node |
| CitationRegexBoundaries.test.ts | 2 | Node |
| CitationRegexCaptureReuse.test.ts | 2 | Node |
| CitationRegexCaseFlags.test.ts | 2 | Node |
| CitationRegexCharacters.test.ts | 2 | Node |
| CitationRegexDescriptors.test.ts | 10 | Node |
| CitationRegexEngine.test.ts | 4 | Node |
| CitationRegexInput.test.ts | 11 | Node |
| CitationRegexInputCoverage.test.ts | 2 | Node |
| CitationRegexLaneCoverage.test.ts | 6 | Node |
| CitationRegexLookahead.test.ts | 2 | Node |
| CitationRegexNullable.test.ts | 2 | Node |
| CitationRegexOperation.test.ts | 3 | Node |
| CitationRegexPolicyCoverage.test.ts | 2 | Node |
| CitationRegexProgram.test.ts | 14 | Node |
| CitationRegexResult.test.ts | 13 | Node |
| CitationRegexSession.test.ts | 64 | Node |
| CitationRegexSessionProgram.test.ts | 3 | Node |
| CitationRegexSessionProtocol.test.ts | 5 | Node |
| CitationRegexSessionRpc.test.ts | 4 | Node |
| CitationRegexTranslator.test.ts | 7 | Node |
| CitationRegexVerbose.test.ts | 3 | Node |
| CitationRegexWorker.test.ts | 19 | Node |
| CitationRegexWorkerProtocol.test.ts | 15 | Node |
| CitationRendering.test.ts | 5 | Node |
| CitationRenderingOperation.test.ts | 1 | Node |
| CitationReplayBudget.test.ts | 3 | Node |
| CitationResolutionLimit.test.ts | 2 | Node |
| CitationResolve.test.ts | 10 | Node |
| CitationResolverBoundary.test.ts | 6 | Node |
| CitationResolverText.test.ts | 4 | Node |
| CitationResourceCorrection.test.ts | 9 | Node |
| CitationResourceIdentity.test.ts | 5 | Node |
| CitationResourceObjects.test.ts | 3 | Node |
| CitationRuntimeDictionary.test.ts | 4 | Node |
| CitationRuntimeDictionaryCoverage.test.ts | 2 | Node |
| CitationRuntimeSet.test.ts | 6 | Node |
| CitationSemanticExtraction.test.ts | 1 | Node |
| CitationSemanticProjection.test.ts | 6 | Node |
| CitationSemanticProjectionCoverage.test.ts | 3 | Node |
| CitationSessionDescriptors.test.ts | 3 | Node |
| CitationShortMissingPage.test.ts | 3 | Node |
| CitationSixFormArtifact.test.ts | 4 | Node |
| CitationSixFormProjection.test.ts | 2 | Bun |
| CitationSixFormProjectionControls.test.ts | 7 | Node |
| CitationSixFormResolution.test.ts | 9 | Node |
| CitationSourceAnnotation.test.ts | 6 | Node |
| CitationSourceAnnotationTiming.test.ts | 2 | Node |
| CitationSourceCleaning.test.ts | 3 | Node |
| CitationSourceDocument.test.ts | 4 | Node |
| CitationSourceEvidence.test.ts | 3 | Node |
| CitationSourceRequest.test.ts | 10 | Node |
| CitationSpanOffsets.test.ts | 5 | Node |
| CitationStopWords.test.ts | 3 | Node |
| CitationTableCapacity.test.ts | 2 | Node |
| CitationTextBudget.test.ts | 6 | Node |
| CitationTextCapacity.test.ts | 4 | Node |
| CitationTextNativeOrder.test.ts | 1 | Node |
| CitationTokenAssembly.test.ts | 2 | Node |
| CitationTokenCapture.test.ts | 3 | Node |
| CitationTokenContext.test.ts | 3 | Node |
| CitationTokenDispatch.test.ts | 3 | Node |
| CitationTokenEditions.test.ts | 3 | Node |
| CitationTokenEquality.test.ts | 2 | Node |
| CitationTokenObjects.test.ts | 3 | Node |
| CitationTokenText.test.ts | 4 | Node |
| CitationTokenizedExtraction.test.ts | 1 | Node |
| CitationTokenizedExtractionCoverage.test.ts | 1 | Node |
| CitationTokenizer.test.ts | 11 | Node |
| CitationTokenizerCatalog.test.ts | 3 | Node |
| CitationUnicodeDictionary.test.ts | 4 | Node |
| CitationVerifiedExtraction.test.ts | 1 | Node |
| CitationXmlBalanceKernel.test.ts | 2 | Node |
| CitationXmlBalanceKernelCoverage.test.ts | 3 | Node |
| CitationXmlWorker.test.ts | 3 | Node |
| CitationXmlWorkerProtocol.test.ts | 2 | Node |
| integration/CitationCanonicalAnnotationWorkflow.test.ts | 4 | Node |
| integration/CitationCanonicalCourts.test.ts | 3 | Node |
| integration/CitationCanonicalExtraction.test.ts | 4 | Node |
| integration/CitationCanonicalExtractionRange2.test.ts | 4 | Node |
| integration/CitationCanonicalExtractionRange3.test.ts | 4 | Node |
| integration/CitationCanonicalExtractionRange4.test.ts | 4 | Node |
| integration/CitationCanonicalExtractionRange5.test.ts | 4 | Node |
| integration/CitationCanonicalExtractionRange6.test.ts | 2 | Node |
| integration/CitationCanonicalParserOperations.test.ts | 4 | Node |
| integration/CitationCanonicalParserOperationsRange2.test.ts | 4 | Node |
| integration/CitationCanonicalReferenceMarkup.test.ts | 2 | Node |
| integration/CitationCanonicalRemainingExtraction.test.ts | 4 | Node |
| integration/CitationCanonicalRemainingExtractionRange2.test.ts | 3 | Node |
| integration/CitationCanonicalTokenizer.test.ts | 2 | Node |
| integration/CitationCleanerNamedHtml.test.ts | 1 | Node |
| integration/CitationCleanerNativeCustom.test.ts | 1 | Node |
| integration/CitationDiffWorker.test.ts | 2 | Node |
| integration/CitationEditionInference.test.ts | 1 | Node |
| integration/CitationEngineCorpus.test.ts | 2 | Node |
| integration/CitationExtractorSelection.test.ts | 1 | Node |
| integration/CitationFullLawMetadata.test.ts | 1 | Node |
| integration/CitationHtmlUnicode.test.ts | 1 | Node |
| integration/CitationInputDocument.test.ts | 2 | Node |
| integration/CitationJournalMetadata.test.ts | 1 | Node |
| integration/CitationRegexBoundaries.test.ts | 16 | Node |
| integration/CitationRegexCaseFlags.test.ts | 16 | Node |
| integration/CitationRegexTranslator.test.ts | 2 | Node |
| integration/CitationRegexTranslatorNode.test.ts | 2 | Node |
| integration/CitationVerifiedExtraction.test.ts | 1 | Node |

### Single-file coverage and floors

The union uses 25 distinct one-test-file/one-source-file measurements, with
additional replay of the fence file after fixture typing/assertion cleanup.
Each test run passed. NativeLane, NativeProcess and all four session source
files reach **100% on every metric**, including all new fence branches.
The unchanged descriptor file remains above its existing floors. No baseline,
ignore comment or safety guard was changed to obtain coverage.

| Source | Lines | Statements | Functions | Branches |
| --- | ---: | ---: | ---: | ---: |
| NativeLane.ts | 100% | 100% | 100% | 100% |
| RegexSession.ts | 100% | 100% | 100% | 100% |
| RegexSessionProtocol.ts | 100% | 100% | 100% | 100% |
| RegexSessionRpc.ts | 100% | 100% | 100% | 100% |
| RegexSessionProgram.ts | 100% | 100% | 100% | 100% |
| RegexDescriptors.ts | 100% | 96.96% | 94.73% | 94.44% |
| NativeProcess.ts | 100% | 100% | 100% | 100% |

No guard is uncovered in either changed source file or the four session files.
The two unchanged descriptor defensive paths and their floors are described in
round 2. The NativeLane union includes every direct lane-importing file plus
composition and transfer; NativeProcess adds its direct coverage file and the
cleanup-deadline paths in CitationNativeLane. The full contributor matrix is:

| Test file | Source measured | Passing tests |
| --- | --- | ---: |
| CitationNativeLaneCoverage.test.ts | NativeLane.ts | 20 |
| CitationNativeLane.test.ts | NativeLane.ts | 16 |
| CitationNativeLaneReservation.test.ts | NativeLane.ts | 32 |
| CitationNativeLaneComposition.test.ts | NativeLane.ts | 4 |
| CitationNativeLaneTransfer.test.ts | NativeLane.ts | 4 |
| CitationRegexSession.test.ts | NativeLane.ts | 64 |
| CitationRegexSession.test.ts | RegexSession.ts | 64 |
| CitationRegexLaneCoverage.test.ts | RegexSession.ts | 6 |
| CitationRegexSessionProtocol.test.ts | RegexSessionProtocol.ts | 5 |
| CitationRegexSessionRpc.test.ts | RegexSessionRpc.ts | 4 |
| CitationRegexSessionProgram.test.ts | RegexSessionProgram.ts | 3 |
| CitationRegexDescriptors.test.ts | RegexDescriptors.ts | 10 |
| CitationRegexSession.test.ts | RegexDescriptors.ts | 64 |
| CitationCleanerPipelineCoverage.test.ts | NativeLane.ts | 7 |
| CitationDiffLaneCoverage.test.ts | NativeLane.ts | 9 |
| CitationHtmlWorker.test.ts | NativeLane.ts | 13 |
| CitationMarkupWorkerCoverage.test.ts | NativeLane.ts | 8 |
| CitationRegexLaneCoverage.test.ts | NativeLane.ts | 6 |
| CitationNativeLaneFence.test.ts | NativeLane.ts | 8 |
| CitationNativeLaneFence.test.ts | NativeProcess.ts | 8 |
| CitationNativeProcess.test.ts | NativeProcess.ts | 5 |
| CitationNativeProcessCoverage.test.ts | NativeProcess.ts | 3 |
| CitationNativeLaneCoverage.test.ts | NativeProcess.ts | 20 |
| CitationRegexSession.test.ts | NativeProcess.ts | 64 |
| CitationNativeLane.test.ts | NativeProcess.ts | 16 |

### Final count gate and process obligations

| Final test file | Passing tests | Parent |
| --- | ---: | --- |
| CitationCanonicalFullSpan.test.ts | 12 | Node, exercising ten Bun calls plus Node parity |

FullSpan ran **last**, after all other files and coverage measurements, and
passed **12/12**. Combined with the directory loop, the final receipt is
**277 files, 1,323 passing tests, zero failures or skips**. Wall time was
**30.59 seconds**, Vitest **30.17 seconds**, at load **1.86 / 2.98 / 3.94**.
Timing gates nothing. All work-count assertions pass unchanged from the review
base; no asserted count was rewritten.

| Per ten plain-text Bun calls | B1 | fe714d0ecdb | Round 4 |
| --- | ---: | ---: | ---: |
| Regex child processes | 291 | 10 | 10 |
| Regex evaluations | 291 | 291 | 291 |
| Metadata-operation installs | 0 | 0 | 0 |
| Configuration detaches | 0 | 0 | 0 |
| Tokenizer builds | 0 | 0 | 0 |
| Regex evaluator constructions | 0 | 0 | 0 |
| Descriptor bindings | 4 | 4 | 4 |
| Physical native owners | 10 | 10 | 10 |
| Native lane acquisitions | 10 | 10 | 10 |
| Diff/Xml worker constructions | 0 | 0 | 0 |

| Engine construction | B1 | Review base / Round 4 |
| --- | ---: | ---: |
| Metadata-operation installs | 16 | 16 |
| Configuration detaches | 1 | 1 |
| Tokenizer builds | 1 | 1 |
| Regex evaluator constructions | 26 | 26 |
| Regex evaluations | 0 | 0 |
| Regex child processes | 0 | 0 |
| Descriptor bindings | 0 | 0 |
| Physical native owners | 1 | 1 |
| Native lane acquisitions | 0 | 0 |
| Diff/Xml worker constructions | 0 | 0 |

The 64-case session file passes again. Its original eight real-process
obligations each assert started equals confirmed on both actual child runtimes:

| Obligation | Bun child | Node child |
| --- | --- | --- |
| Catastrophic deadline, responsive parent, confirmed death before return | Pass | Pass |
| Job after kill fails closed without spawn | Pass | Pass |
| Wrong sequence kills and confirms | Pass | Pass |
| Early EOF kills and confirms | Pass | Pass |
| Oversize frame kills and confirms | Pass | Pass |
| Frame while idle kills and confirms | Pass | Pass |
| Sent interruption confirms death before acknowledgement | Pass | Pass |
| Running interruption confirms death before acknowledgement | Pass | Pass |
| Live stdout closure and paired real stdin proofs | Pass | Pass |
| Mixed engines and schema-invalid engine | Pass | Pass |
| Preparation/startup/write/read/retirement interruption barriers | Pass | Pass |
| Diff start and cleaner yield handovers | Pass | Pass |
| Late spawn settlement and unconfirmed-first-retirement retry | Pass | Pass |

The exact original names remain in the earlier tables and session file. Round-4
fence cases add a distinct assertion: after a pre-hand-off refusal, no child is
started at all, rather than starting one and subsequently confirming its death.
Already-authorized hand-offs retain the existing late-resolution cleanup path.

### Required checks, development corrections and scope

| Check | Final result |
| --- | --- |
| Server bun run check | Pass, source and test typechecks |
| quality package-verify @beep/law-practice-server --quick | Pass, lint and check |
| Package lint:laws | Pass, strict laws zero; three inherited advisory findings |
| Full bun run beep lint | Pass |
| Fallow audit --base origin/main | Pass, zero introduced; 35 inherited findings excluded |
| bun run docgen:local --full | Pass, 188-package metadata check, generation and aggregate |
| bun run beep lint effect-vitest | Pass, zero introduced, inventory unchanged |
| bun run beep lint schema-first | Pass, zero introduced, inventory unchanged |
| Root Oxlint on branch-touched TypeScript/MJS | Pass |
| git diff --check and commit hooks | Pass |
| Goal decision projection | Pass, regenerated after every decision edit |

The final Fallow invocation resolved origin/main to `3d9b0df312e90b3fef5a0bce69f208e6ec7ec29e`.
No merge or rebase was performed while the shared tracking ref advanced.

The initial directory-launch attempt had a missing output directory: shell
redirection failed before any Vitest process started. That orchestration attempt
is not counted as a test run or 276 test failures. The report directory was
created and the entire serial loop restarted; the table above is the completed
real run. Early fixture typing and resource-wrapper lint issues were corrected
without inventory growth; the final fixture uses the existing runtime-kind
model and explicit required control parameters.

Every requested Citation file ran, including all lane files and full integration
qualification. The three Bun.version-dependent files ran under Bun, so there is
no environment-only red. No parallel/package-wide suite invocation or
package-wide coverage was run. Hosted CI is not claimed. Frozen-lockfile install
was not repeated: manifests and lockfile are unchanged from the passing round-2
install. No dependency or policy limit changed this round.

B2 remains **in review**. Both original design stops remain resolved; no further
conflict occurred. The implementation interprets physical authorization as the
synchronous hand-off to the captured spawner after all owner waits. A hand-off
already authorized before revocation can still resolve late and must retain
ownership until existing retirement confirms it. A hand-off refused by the
fence never invokes the spawner. The accepted indefinite-retention limit is
stated plainly above. No safety guard, typed refusal or extraction assertion was
removed or loosened.

Implementation commit: `8f848e9a2e9`. This evidence, the fence decision and the
generated in-review checkpoint ship in the following documentation commit.
Commits remain local and the lane is preserved for independent review; no push,
merge, rebase or subagents.
