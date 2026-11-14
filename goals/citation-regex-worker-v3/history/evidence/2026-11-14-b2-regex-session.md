# B2 regex session evidence

The initial receipt below is retained as history. [Review round 1](#review-round-1)
records the accepted findings, fixes and latest verification.

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
