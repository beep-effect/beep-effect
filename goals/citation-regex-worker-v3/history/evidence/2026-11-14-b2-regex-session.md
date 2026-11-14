# B2 regex session evidence

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
