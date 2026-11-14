# Citation Engine Install Once Spec

## Objective

Each `engine.extract` call reinstalls 14 metadata operations, the tokenizer
and the extraction loop, constructs regex worker objects per token, and runs 8
configuration detach round trips. None of that depends on the request. This
goal moves it to engine construction.

The per-request install is how a request's text budget, Scope and admission
reach a stage today (each stage captures them when installed), so the goal
first replaces that mechanism with one request-scoped service,
`CitationInvocation`, then hoists the installs, then removes the nested
configuration copies behind an owned-configuration brand.

The contracts are in
[`explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md`](../../explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md) sections 1, 2.1, 2.2, 3.1, 3.4, 3.5, 5 and 6.
The shaped pitch is [`explorations/citation-engine-install-and-worker-reuse/BRIEF.md`](../../explorations/citation-engine-install-and-worker-reuse/BRIEF.md).
Protocol v3, the native lane and the regex session belong to
`goals/citation-regex-worker-v3`; in this goal `invocation.regex.evaluate`
runs on protocol v2, one process per job.

## Non-Goals

- Any change to extraction output, to the public `CitationEngine` service shape, or to a limit value.
- Regex worker protocol v3, the native lane, or any change to process ownership (`goals/citation-regex-worker-v3`).
- An identity-keyed memo, `WeakMap`, `WeakSet`, native `Map` or `Set`, or any module-level cache.
- Removing the four per-request report-limit snapshots (`captureCitationOperationPolicy`); they are a bug fix.
- A new regex engine or a change to the pattern translator.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, and the design in
   the source exploration.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/law-practice/server/src/internal/Citation/` (new `Invocation.ts`, `ConfigurationOwnership.ts`; reworked `MetadataComposition.ts`, `TextBudget.ts`, `Tokenizer.ts` and the stage modules)
- `packages/law-practice/server/src/CitationEngine/CitationEngine.layer.ts` and `CitationExtractor.layer.ts`
- `packages/law-practice/server/test/` (a span-recorder fixture, an invocation fixture helper, updated stage fixtures)
- One Biome GritQL rule forbidding optional budget and admission lookups under the Citation directory
- This packet's evidence under `history/`

## Constraints

- Effect v4 only. Check every API against the Effect reference checkout before writing it; the design cites file and line for each.
- Design order is schema, then `Context.Service` contract, then implementation. `CitationInvocationPolicy`, `CitationInvocationReceipt` and the `CitationOwned` brand land before the code that uses them.
- Slice A2 is behavior-neutral and lands alone: children are still installed per request, regex is still v2. If request values cannot be read at call time without changing results, stop and reshape.
- `Effect.serviceOption` adds nothing to the requirement channel, so a hoisted install-time budget lookup silently stops charging. Delete `captureCitationTextReservation` and every `serviceOption(CitationTextBudget)` listed in the design (eleven sites) in A2, not A3.
- Fourteen sites capture `CitationOperationAdmission` and call `run`. Remove each nested `run` in A2 and install the stage tree in a Context without the admission, so a missed capture fails at engine construction.
- Installs stay under the existing operation-label providers (`SourceDocument.ts:148`, `SourceAnnotation.ts:197`, `AnnotationEntry.ts:271`).
- `ownCitationConfiguration` detaches through the JSON codec. A type-side round trip keeps the caller's `Uint8Array` buffers.
- Counts gate each slice; wall time is recorded beside them. Take the wall-time record on a remote worker (`beep-worker` or `dankserver`, `remote-development-agents` skill). Do not run the large citation replays on the shared workstation above the load cap.
- At most three PRs of this packet open at once; the slices are serial.
- The repo is public: no secrets, no absolute home paths, no client documents in fixtures or evidence.

## Acceptance Criteria

- [ ] A1: a fixture runs the ten-call bun cohort of `CitationCanonicalFullSpan` under a span recorder and the observed spawner and reports child processes started, metadata-operation installs, configuration detaches, tokenizer builds and regex worker constructions, plus wall time and host load. The baseline is recorded in `history/evidence/` from two runs whose counts agree.
- [ ] A2: `CitationInvocation` and `openCitationInvocation` exist; no `serviceOption(CitationTextBudget)` or `serviceOption(CitationOperationAdmission)` remains under the Citation directory and the lint rule proves it; `captureCitationTextReservation` and `captureCitationOperationChildren` are deleted; all four engine methods and the extractor boundary keep `R = never`; the canonical replays produce identical results.
- [ ] A3: per-request metadata-operation installs are 0 and tokenizer builds are 1 per engine on the fixture; regex evaluators are constructed at engine construction only.
- [ ] A4: configuration detaches are 1 per engine on the fixture (report snapshots excluded); no installer below the boundary decodes or detaches configuration; the 2026-11-07 report-deadline mutation test still passes.
- [ ] Each slice's PR body carries the before and after count table from the same fixture.
- [ ] `bun run beep quality package-verify @beep/law-practice-server` passes for each slice.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Package verify | `bun run beep quality package-verify @beep/law-practice-server` | Passes |
| Count fixture | the A1 fixture's table, before and after, in each PR body | Counts match the acceptance criteria |
| Optional lookups | the Biome GritQL rule (from A2) | No finding |
| Citation replays | hosted CI, and a remote-worker run recorded in `history/evidence/` | Identical results |
| Model pins | `bun run beep models check` | Passes |
| Packet launcher size | `test "$(wc -m < goals/citation-engine-install-once/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/citation-engine-install-once/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/citation-engine-install-once` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add citation-engine-install-once --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug citation-engine-install-once`; add a `kind: decision` file there, never edit this block._

### Bind request values through one CitationInvocation service, 2026-11-12

Installed stages keep `CitationInvocation` in their requirement channel and the public entry provides it once per request. Holding one proves admission, so the pass-through nested admission is removed. Operator answer, exploration align round 1. Rejected: an explicit parameter (about 36 factory sites and every helper, with no compiler help finding a missed capture) and a memoized tree re-bound through a mutable holder (shared mutable state across concurrent requests). Source: `explorations/citation-engine-install-and-worker-reuse/DECISIONS.md`, run-time binding.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Thread the invocation as an explicit parameter on every installed run and helper.

### Keep the per-request report-limit snapshots, 2026-11-12

They stop a caller mutating a returned report from altering the installed policy (the 2026-11-07 fix in `goals/citation-extraction-engine`). Owned values never leave the engine; what leaves is a fresh copy. They are excluded from the detach count. Source: `explorations/citation-engine-install-and-worker-reuse/research/design-review-2026-11-12.md`, finding 7.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Remove the four captureCitationOperationPolicy calls.

### Own configuration once at the engine boundary and carry ownership in the type, 2026-11-12

One detach through the JSON codec where configuration enters the engine mints `CitationOwned<Config>`; installers below accept it and never copy. Schema has no freeze or structural sharing, and an identity memo is ruled out by the repo's laws. Operator answer, exploration align round 1. Source: `explorations/citation-engine-install-and-worker-reuse/DECISIONS.md`, detach strategy.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Restore the nested detach calls in each installer.

### Read budget and admission at call time and delete the optional lookups, 2026-11-12

`Effect.serviceOption` adds no requirement, so hoisting an install-time lookup would silently disable text accounting or take a second permit. The design review listed eleven budget sites and fourteen admission sites; all change in slice A2 with a lint rule. Source: `explorations/citation-engine-install-and-worker-reuse/research/design-review-2026-11-12.md`, findings 3 and 4.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Reintroduce captureCitationTextReservation and the nested admission view.

### Bind direct-stage fixtures to installed constants and observe the real invocation budget, 2026-11-13

Direct-stage tests use one shared fixture helper that opens an invocation per standalone method call with that fixture policy and installed Clock. The enclosing test scaffold is untimed; method invocations retain their real configured deadlines. A test-only observation service points legacy diagnostic snapshots and callback reservations at the actual budget constructed by openCitationInvocation, rather than the discarded install-time budget. Obsolete EnclosingRefusal assertions and install guards are removed. No production deadline or limit value changes.

Reverse: Restore the standalone stage fixtures and their captured-budget assertions.

### Keep worker-v3 invocation fields out of A2, 2026-11-13

Slice A2 models only the invocation policy, parent text budget and Scope. Native lane, regex session and receipt fields remain with citation-regex-worker-v3, as required by the implementation brief. No process, lease or protocol changes are authorized in A2.

Reverse: Add lane, regex session and receipt when the worker-v3 goal owns their implementation.

### Text reservation is an explicit argument across the process boundary, 2026-11-13

Operator ruling, 2026-11-13: constructors shared with isolated worker entrypoints take text reservation as an explicit generic Effect callback and propagate its requirements. Parent callers pass reserveCitationInvocationText, which reads CitationInvocation at call time. Worker callers and pattern preparation pass an explicit named no-op. Reservation ordering before allocation is unchanged. Worker entrypoints, wire protocols, processes, leases and limits stay unchanged. This resolves the historical stop in history/evidence/2026-11-13-a2-binding-stop.md; the stop rule remains active for any second incompatible site.

Reverse: Restore the optional budget lookup in RegexInput.

### Advance virtual time to prove the two admission deadline contracts, 2026-11-13

The new public engine and extractor controls deliberately advance virtual time across an 800 ms queue and 9500 ms resolver subject. The resolver sleep is test-subject work under TestClock, not a wall-clock wait, and the separate advances distinguish the exact deadline boundary. Reviewed EV008 and EV015 judgments receive explicit test-owned exceptions with exit conditions. Both native runtime configurations are exercised for the engine; all these boundary controls assert zero spawned children.

Reverse: Replace the manual-clock controls when a harness can assert queue-plus-work deadline placement without advancing virtual time.

### Bind generated reference descriptors per call and keep the pattern builder per request, 2026-11-13

GeneratedReferences builds its regex pattern from each citation's metadata, so the descriptors are request data. The evaluator is installed once per generator with an empty static registry, and bindDescriptors builds a registry for the generated descriptors at the point the worker used to be constructed, sharing every other constant. makeCitationReferencePatterns stays per request (stop rule): constructing it reserves its fixed fragments on the request text budget and checks the enclosing budget against the policy, so hoisting it would change producedTextUtf16 in the report and drop a refusal. It constructs no regex evaluator.

Lane perf/citation-hoist-installs

Reverse: Construct the generated-reference regex worker inside each prepare again.

### Count descriptor bindings, process owners and Diff/Xml workers in the probe, 2026-11-13

Review round 1: bindDescriptors builds a descriptor registry (regex input, program, point sets, timing) on each generated-reference call under a span the probe ignored. Rather than hoist part of the registry, the probe counts it as regexDescriptorBindings, so the per-call table is honest. nativeProcessOwners counts physical process owners and diffXmlWorkerConstructions counts Diff and Xml worker constructions; the construction row asserts zero for both, which fails if an engine-time install ever starts a process owner (and so binds a Scope) or builds a Diff or Xml worker.

Lane perf/citation-hoist-installs · PR #3282

Reverse: Drop the three columns from CitationEngineWorkCounts and the full-span tables.

### Delete the unused cleaner operation adapter, 2026-11-13

A repository-wide live source and test search found makeCitationCleanerOperation only in its defining module and CitationCleanerOperation.test.ts. No src caller, public engine boundary, or package composition uses it; SourceCleaning uses CleanerPipeline directly. The similarly named replay fixture independently wraps CleanerPipeline and does not call this adapter. Delete the test-only dead production adapter and its test rather than count fixture admission as a production proof. Public engine admission is now proved by the manual-clock engine test. Regenerate the instrumentation catalog and prune the generated shard plan with repository writers.

Reverse: Restore CleanerOperation.ts and its test from head 99bb436ca0fc if a real production caller is introduced.

### Hold one regex process owner per invocation, created on its first evaluation, 2026-11-13

Review round 1: an owner per evaluation decoded limits, built a semaphore and refs and added a finalizer to the invocation Scope about 29 times per call. CitationInvocation gains a regexOwner field, a SynchronizedRef holding an optional native process owner, set up empty by openCitationInvocation (service contract first, then the evaluator). The first regex evaluation of a request creates the owner in the invocation Scope with the evaluator's captured Clock and spawner; later evaluations reuse it. Each evaluation still claims, starts and retires its own child through withCitationNativeProcess (one child per job, lease released only on confirmed retirement), and the owner's open and quarantine check again runs before job preparation, as main's per-helper owner did. No session, lane or process reuse: those stay with citation-regex-worker-v3. The probe's nativeProcessOwners column shows 1 per call on the full-span cohort. The owner is created with the first evaluator's Clock, spawner and limits; every evaluator of one engine shares those, so a request is always served by one spawner. CitationAnnotationAssembly.test.ts ran its Bun and Node runtimes, each with its own observed spawner, inside one test invocation; it now opens one invocation per runtime, which is what one request is. Review round 2: the slot now stores the spawner and Clock beside the owner, and an evaluator whose spawner or Clock is not the same object fails closed with invalid-runtime before preparing a job, instead of spawning through the first evaluator's spawner. CitationRegexWorker.test.ts proves the refusal: two evaluators with separate observed spawners share one invocation, the second is refused, and neither spawner starts a child.

Lane perf/citation-hoist-installs · PR #3282

Reverse: Start a physical regex owner per evaluation inside the invocation Scope again.

### Judge MetadataComposition coverage against the same focused group on clean HEAD, 2026-11-13

With twenty focused metadata test files MetadataComposition measures 98.46 lines, 97.88 statements, 91.42 branches and 100 functions, below the whole-suite floor (99.22, 98.58, 92.68, 100). The two uncovered lines, 64 (substitution invalid-match refusal) and 178 (fallback native admission when none is supplied), are unchanged by A3. The same twenty files on clean HEAD measure 98.38, 97.79, 91.42 and 100 with the same two lines uncovered, so the slice regresses nothing and the floor depends on tests outside the focused group. Hosted CI measures the whole suite. No floor was lowered.

Lane perf/citation-hoist-installs

Reverse: Add focused tests for the substitution invalid-match refusal and the fallback native admission.

### Keep coverage controls in independent request invocations, 2026-11-13

Review the new coverage fixture calls under the existing direct-invocation decision. Each control owns or deliberately shares one production CitationInvocation; sharing their owner through it.layer would change the cumulative-budget and closed-owner behavior being asserted. Keep the EV003 request-lifetime exceptions with the existing owner and exit rationale. Refresh the inventory with its writer, retaining only Citation rows changed by this wave and restoring unrelated positional churn. Replace the new Option payload assertion with assertSome rather than accepting EV006.

Lane feat/citation-invocation-binding · PR #3265

Reverse: Replace these invocation fixture calls with a Layer only if it preserves each call admission, ledger, timer and cleanup lifetime.

### Keep direct invocation fixtures scoped to each request, 2026-11-13

Effect/Vitest EV003 reports 108 unresolved-resource-wrapper judgments at the shared invocation fixture calls (95 withCitationTestInvocation and 13 withCitationTestTextBudget). Each opens request-scoped admission, a fresh budget and cleanup; it.layer sharing would turn independent method calls into one request and change queue, deadline and ledger assertions. These two reviewed wrapper families receive explicit owned inventory exceptions, without changing detector policy. The existing it.layer platform services remain shared.

Reverse: Replace the fixture wrappers with a test Layer when the harness can preserve per-call admission, budget, deadline and cleanup semantics.

### Keep direct-stage lifetime and clock fixtures aligned with their owners, 2026-11-13

The round-1 hosted logs exposed more dependent-fixture gaps. XmlWorker and HtmlCaseName budget controls now reserve the actual invocation ledger. The HtmlCaseName lifetime control uses a valid prepared request after closing the installed native owner, preserving the closed refusal and proving that no further child starts; a malformed null input previously tested admission-before-decode on the removed nested operation. No output identity or state expectation is relaxed. The untimed enclosing scaffold clock is defined beside the existing clock constructors in CitationNativeSpawner.fixtures.ts; bound methods still restore their real captured Clock. This keeps the unchanged shard classifier from mistaking scaffold infrastructure for a native-work clock substitution. The new engine deadline cases live in the existing CitationEngineLayer.test.ts, and the shard plan is pruned by the repository writer after deleting the dead cleaner test.

Reverse: Restore the previous fixture installation captures if stages again own operation admission.

### Keep fixture admission refusals typed and replacement explicit, 2026-11-13

Direct-stage bindings now retain a supplied closed operation admission and expose CitationAdmissionFailure in their typed error channel. Tests may opt into replacing a known scaffold admission through the explicit binding flag. Legacy fixture adapters explicitly select makeCitationTestScaffoldBinding, which wraps that flag and retains every real supplied owner. This mechanical opt-in restores the independent calls that previously relied on the implicit scaffold replacement; their primary test files are replayed individually. The HtmlCaseName lifetime control again checks extract(null) reaches the closed admission before input decoding; an additional fresh invocation isolates the closed native-owner refusal. Internal annotation composition receives the raw XML stage inside its existing invocation rather than an independently admitted direct-call adapter.

The tokenizer closed-install-view control installs the raw stage under its intentionally refusing owner, then opens a fresh invocation at call time. This tests the production stage rather than the fixture fallback and retains its original empty-token and zero-child assertions.

Reverse: Restore automatic scaffold and closed-owner replacement and defect conversion

### Keep stage finalizers in the request Scope, 2026-11-13

Review round 1 confirms a deliberate Scope lifetime difference from main: metadata stages use the invocation Scope instead of opening a fresh Scope around each prepare call. Per-call native owners therefore register owner finalizers until request end. Physical processes still retire and acknowledge exit per job before returning results; leases, quarantine and limits remain unchanged. The invocation Scope closes before admission releases its permit, retaining the final safety cleanup. This follows design section 3.4; it is an ownership-finalizer timing change, not strict Scope neutrality.

Reverse: Restore per-stage Effect.scoped around prepare(request).

### Keep the Diff, Xml and annotation template owners per request, 2026-11-13

Stop rule. The Diff and Xml workers wrap MarkupWorker, whose private semaphores would become engine-wide and whose native owner captures a Scope; sharing them would change process ownership and queueing between concurrent requests. They are not regex evaluator call sites, and goals/citation-regex-worker-v3 replaces them with the lane's one-occupant rule. makeCitationAnnotationTemplates captures the request reservation at construction, so AnnotationWrap installs its evaluator once and exposes the template constructor; makeCitationWrapAnnotationSpans builds the templates per request, where it built the whole wrapper before. The HTML discovery evaluator around the Diff worker is installed once (installCitationHtmlGeometry).

Lane perf/citation-hoist-installs

Reverse: Hoist makeCitationDiffWorker, makeCitationXmlWorker and makeCitationAnnotationTemplates once the worker-v3 lane replaces their per-owner state.

### Keep the full law-practice audit on hosted CI, 2026-11-13

The operator clarified on 2026-11-13 that file-by-file local tests govern because the full law-practice package audit runs the whole suite. Run package-verify --quick and docgen:local locally, and leave the full audit to hosted CI. The smaller lint-rules package receives its full package-verify.

Reverse: Run full package-verify locally when the operator permits a whole-package suite.

### Keep unrelated inventory positions at the clean main baseline, 2026-11-13

The syntax-only effect-vitest check passes with zero introduced and resolved findings on a clean detached origin/main worktree at 8b405079b69466e27babc5dff27c06292a8cc4e2. Both named source files are byte-identical to the lane. The writer updates positional metadata even though check accepts the existing occurrence identities; restore all six changed rows in those two files to main, including the additional row beyond the review count. No inherited red needs routing. The check was repeated successfully on clean main at 49a2d768f64803883bcc9b64c9a54c97b1f26c40 after #3251: 3838 files, 516 findings, zero introduced/resolved. The writer also shifted fourteen other unrelated positional rows, all restored to main as well. A third clean audit at e7852920d2e975fa909b0574831ff30d828af35f also passes with the same counts. The throwaway sibling-root worktree was removed after every audit.

Reverse: Regenerate and adopt the unrelated line-position rows

### Let configuration detaches move to engine construction with the installs, 2026-11-13

Hoisting the stage tree moves the eight per-call detaches to engine construction: the probe measures 0 per call and 10 at construction (the 8, plus the 2 the design counts at construction; A1 did not measure construction). Nothing was added or removed on purpose: no CitationOwned brand, no nested detach deleted. Slice A4 owns reducing the construction count to 1.

Lane perf/citation-hoist-installs

Reverse: Reinstall the child stages per request.

### Log extraction and annotation refusal once at the public engine, 2026-11-13

The engine normalizes and logs every typed extract or annotate refusal after the invocation timer and admission boundary, so deadlines, admission refusals and stage refusals each emit exactly one fixed boundary-refused debug message. Inner normalizers remain silent and idempotent. Manual-clock tests on both runtime configurations count one deadline log and one subsequent source-stage refusal log, with zero native children.

Reverse: Restore logging to the inner boundary normalizers

### Measure engine construction by building one more identical engine in the probe, 2026-11-13

The probe needs the replay's observed spawner, which exists only after the first engine is built. makeCitationCanonicalExtractionReplay therefore exposes construct, which builds a second identical default engine in the same layer scope, and prepareCitationCanonicalFullSpanReplay measures it. The row is asserted by its own Bun test (citationCanonicalFullSpanConstruction): 16 metadata-operation installs, 10 detaches, 1 tokenizer build, 26 regex evaluator installs, 0 evaluations and 0 child processes. The design estimated 12 evaluators; each parent installs its own helper chain (for example both CaseMetadata and ReferenceTokenExtraction install a case-name selection), which is once per call site and operation.

Lane perf/citation-hoist-installs

Reverse: Drop the construction row and the construct effect from the replay fixture.

### Preserve boundary-specific deadline placement around admission, 2026-11-13

Review round 1 identified that engine queue wait must count against each stage deadline, while the public six-form extractor historically starts that deadline after admission. CitationInvocationPolicy now has a schema-backed deadlineStarts literal with explicit values at both public boundaries. There remains one invocation constructor: engine timing wraps admission.run; extractor timing wraps its body inside admission.run. The request Scope remains inside admission in both cases, so cleanup precedes permit release. Manual-clock public boundary tests cover queue plus work and refusal labels without native children.

Reverse: Remove deadlineStarts and restore the previous invocation ordering only with an explicit behavior change.

### Preserve tokenizer refusals independently of ordering counters, 2026-11-13

Restore the selected-count patternEvaluations safety refusal and typed missing-ID invalid-configuration mapping. A2 preserves these refusals independently of the ordering implementation; no coverage floor changes. Reuse one invalidConfiguration factory at the existing policy, configuration and missing-ID boundaries rather than repeating equivalent error callbacks. The real control has two unfiltered members, a limit of three and four loose-policy selections. Both bounded ordering alone and the tokenizer refuse with extract/patternEvaluations before any worker starts. In this checkout RuntimeSet copies charge the new counter for each source bucket at line 147, or through copyBuckets at lines 137-141 when capacity changes; the control therefore refuses in ordering before the restored tokenizer guard. Leave that guard alternative and the missing-ID path unforced and uncovered.

Lane feat/citation-invocation-binding · PR #3265

Reverse: Restore the tokenizer guard deletion and missing-ID defect conversion from 76b441e82d4.

### Prove at compile time that engine stage installs read no request value, 2026-11-13

The engine already installs its four stage trees in a Context without CitationOperationAdmission, and CitationInvocation exists only inside openCitationInvocation. A hoisted install that still yields CitationInvocation or CitationTextBudget would otherwise surface only as an extra Layer requirement at a use site. installedWithoutRequestValues makes each of the four engine installs pass true for a parameter typed false when the install's requirements contain either service, so such an install fails to typecheck at engine construction. Checked by adding a yield of CitationInvocation to the tokenized-extraction install: TS2345 at CitationEngine.layer.ts. The hoist also surfaced three factories that capture CitationTextBudget at construction (ReferencePatterns, ReferenceNames, AnnotationTemplate); none of them was hoisted.

Lane perf/citation-hoist-installs

Reverse: Remove installedWithoutRequestValues from CitationEngine.layer.ts.

### Provide one native admission to each stage install, 2026-11-13

Review round 1: helpers and child stages installed in a stage's own body ran before makeCitationMetadataOperation captured its fallback native admission, so a standalone stage (tests, direct callers) got one admission per evaluator instead of the stage's one. provideCitationStageAdmission captures the host admission, or creates one fallback, right after the stage decodes its limits, and provides it to the whole install: makeCitationMetadataStage, the publication metadata operation, post-case, law, journal, case metadata, reference tokens and the extraction loop. makeCitationMetadataOperation now requires the admission and no longer has its own fallback, which only that path could reach. The engine is unaffected; it always supplies the host admission.

Lane perf/citation-hoist-installs · PR #3282

Reverse: Let each nested install capture its own fallback native admission.

### Reject captured-context lookups of citation request authority, 2026-11-13

Review round 1: the rule covered optional lookups but not Context.get, Context.getUnsafe or Context.getOrElse on a captured context for CitationTextBudget, CitationOperationAdmission and CitationInvocation. Both data-first and data-last forms are added, with fixtures for all three names plain and namespaced (36 new invalid cases), and the Citation directory passes the extended rule.

Lane perf/citation-hoist-installs · PR #3282

Reverse: Remove the get, getUnsafe and getOrElse forms from no-citation-optional-invocation.

### Remove only the deleted cleaner adapter coverage row, 2026-11-13

Remove the orphan CleanerOperation.ts file row by hand. The baseline writer exists as coverage:baseline:write, but it consumes complete measured package snapshots and has no file-row deletion command. Regenerating law-practice-server would run its whole suite, which the task explicitly forbids locally. Keep every other coverage floor unchanged and leave frozen proof references under goals/citation-extraction-engine and the eyecite fixture untouched.

Reverse: Restore CleanerOperation.ts and its coverage baseline row

### Remove unreachable cleaner parent-budget fallback paths, 2026-11-13

The invocation always supplies a parent budget, so CleanerPipeline no longer wraps it in Some or retains parentless fallbacks. Its charge loop now iterates typed charge values directly; the issued-ledger check still refuses forged, reused and absent entries. Behavioral tests cover live local ceilings, cumulative request capacity, unchanged empty text and unknown steps. No coverage floor changes.

Lane feat/citation-invocation-binding · PR #3265

Reverse: Restore the cleaner parent Option wrappers and parentless fallbacks.

### Start the physical regex owner per evaluation inside the invocation Scope, 2026-11-13

installCitationRegexEvaluator holds only engine constants: limits, runtime, timing, the shared native admission, Clock, spawner, Digest, descriptor registry, job preparation and the control-frame preflight. The process owner captures a Scope, a birth lock and a process list, so it is not shared: each evaluate reads CitationInvocation and starts one owner in the invocation Scope, then runs the unchanged withCitationNativeProcess sequence (one child per job, protocol v2, lease released only on confirmed retirement). Before A3 one owner served each helper call; now one serves each evaluation. The owner-level snapshot and reap had no production reader and are removed; the quarantine refusal a later evaluation sees now comes from the shared native admission with the same reason, quarantined. CitationRegexWorker.test.ts asserts the admission snapshot where it asserted the owner snapshot.

Superseded in review round 1 by "Hold one regex process owner per invocation, created on its first evaluation".

Lane perf/citation-hoist-installs

Reverse: Restore per-helper-call makeCitationRegexWorker construction with its owner snapshot and reap.

### Surface each hoisted install outcome where main ran the install, 2026-11-13

CitationSemanticExtraction.test.ts installs the semantic stage under a deliberately tiny producedTextUtf16 and expects the eyecite shortcut to succeed; hoisted, the tokenizer install refused at construction. Review round 1 then showed the first fix was incomplete: only the eight stage-tree sites replayed their install Exit, while helpers that main built lazily inside a helper call (context matchers, metadata strings and years, the court lookup, the pin-cite cleaner, stop words, the case-name chain, generated-reference inputs and evaluators, HTML discovery and geometry, the annotation wrap worker) were built in the parent install, so their refusals replayed for every request at the stage point, ahead of refusals main reported first.

Mechanism now: every install keeps its work at engine construction and captures its outcome with Effect.exit. Installs that were eager on main (a child stage installed by its parent's prepare) replay their Exit at the stage install point, as before. Installs that were lazy on main replay their Exit at main's call point: the helper call, inside markupBranch through the HTML geometry's forward map, inside the year and court branches of the post-case helper, inside the single-element HTML case name, and before bindDescriptors. Helper installs therefore cannot fail at construction. The annotation processor builds its templates per request before yielding the installed wrap worker, in main's order. The evidence file classifies every moved install. Tests: a plain request through an input document whose HTML geometry install refuses still initializes and only markup refuses; a patternUtf16 policy one unit above the pin pattern extracts a section reference and refuses an Id reference with patternUtf16; the wrap processor reports the template refusal when both refuse.

Lane perf/citation-hoist-installs

Reverse: Let hoisted installs fail engine construction directly.

### Update the existing draft without starting a readiness monitor, 2026-11-13

Publish this review wave through Yeet publish --staged-only --no-pr. PR #3265 already exists, so the push still raises its normal synchronize event and keeps its draft state. The no-pr option skips the PR tail (creation, label changes, provenance restamping and the automatic readiness monitor); cheap gates and the head-install preflight remain mandatory. The existing provenance footer describes the same branch, workspace and agent and has no head-SHA field. Replace the existing body separately through Yeet gh pr body, preserving its provenance footer. This honors the task's explicit no-watch instruction without launching and then interrupting a monitor.

Reverse: Use the default Yeet PR tail to submit a readiness monitor

### Assemble owned child configuration with ownedStruct and derive it with ownedDerive, 2026-11-14

The design sketch has ownedField and ownedItems. VerifiedExtraction builds OccurrenceProjection's configuration ({ engineArtifact }) from its own owned configuration, so ConfigurationOwnership also exports ownedStruct(schema, fields): every field must already be CitationOwned and the schema's constructor builds a fresh container around them, so the result is owned without a detach. Review round 4: the first version took a free `make` function and accepted an empty field record, so it could mint from anything. It now takes the `S.Struct` or `S.Opaque` class itself (an object with `fields` and `make`, called as a method) and rejects an empty field record at the type level. It cannot mint a value from non-owned parts, which is why it does not resolve the default engine stop.

Owner ruling, round 3: `ownedDerive(owned, derive)` is the second projection of this kind. Its result is owned because the engine computes it from an already owned input and from values the engine itself creates or reads (sealed asset files, the clock); its soundness rests entirely on `derive` not closing over a caller-held value, which the types cannot check. It needs an owned witness, so it cannot mint from caller input, and the brand constructor stays private. It has exactly one production site: the default engine's installed configuration (decision "Own the default engine configuration by derivation from the owned caller configuration").

Lane perf/citation-owned-configuration

Reverse: Remove ownedStruct and give OccurrenceProjection its own owned field instead.

### Assert configuration refusals at the boundary in direct-stage tests, 2026-11-14

Direct-stage tests install a stage below the boundary, so they need owned configuration. One fixture helper, ownCitationTestConfiguration, mints it through the real ownCitationConfiguration (the brand constructor stays private), and installCitationOwnedTestStage adapts a stage installer so existing fixtures keep passing fixture configuration. Correction (review round 4): this decision said tests that asserted a stage refusing a malformed configuration "now hold the same assertion at the boundary". They did not. The adapter's `invalid` thunk and `refuseCitationTestConfiguration(s)` returned the failure the test itself supplied, so each such assertion only proved that a bare schema rejects the value. The thunks and the refuse helpers are removed, and the adapter now dies on a fixture that does not decode. The real boundary refusals are asserted where callers meet them: CitationEngineLive, the default engine and the extractor (decision "Delete the tautological configuration refusal tests and test the real boundaries"). Refusals that remain stage guards (fixed-pattern authentication, duplicate edition ids, bindings mismatch) are still asserted against the installed stage with owned configuration. Pure schema-decode refusal tests were deleted in round 4.

Lane perf/citation-owned-configuration

Reverse: Restore the stage-level configuration decode and the old direct-stage assertions together.

### Delete the tautological configuration refusal tests and test the real boundaries, 2026-11-14

Review round 4 found that about 45 direct-stage refusal tests were tautologies. `refuseCitationTestConfiguration(s)` and the stage adapters' `invalid` thunks decoded a malformed value against a bare schema and returned the closed failure the test itself passed in. Each such assertion proved only that the schema rejects the value. It never reached a production refusal, and the stage below the boundary no longer decodes, so no stage-level refusal exists to test.

Deleted: the refuse helpers, the adapter `invalid` thunks (`installCitationOwnedTestStage` now takes only `schema` and `install` and dies on a fixture that does not decode), and the `schema`/`invalid` parameters of the metadata installers. Removed refusal blocks, by file:

- Whole tests deleted (14): CitationAnnotationEntryCoverage (boundary policy), CitationCleanerRegistry (malformed registry policy, including the strict excess-key decode the round-2 note kept), CitationCleanerValues, CitationExtractionEntryCoverage, CitationExtractionReport, CitationExtractorRecipes, CitationExtractorSelection, CitationLiteralCleaners, CitationOccurrenceProjectionCoverage, CitationRegexDescriptors (incoherent names), CitationRegexInput (malformed policy) and three in CitationTokenizedExtractionCoverage. Each fed `null`, `{}` or a wrong-typed field to a schema and asserted the failure it supplied.
- Refusal blocks removed from tests that keep their other assertions: policy, runtime or payload refusals in CleanerPipeline, CourtLookup (policy and a `null` payload against `S.String`), EditionInference, ExtractorOrdering, HtmlWorker, MetadataStrings, MetadataYear, NativeProcess, PythonRepr, PythonReprCoverage, RecognizerWorker, ReferencePatternsCoverage, RegexAlphabet, RegexDescriptors, RegexEngine, RegexInput (role), RegexProgram, RegexWorker, RegexWorkerProtocol, Rendering, ResourceCorrection, SpanOffsets, TextBudget, TokenAssembly, TokenCapture, TokenDispatch, Tokenizer, the Journal, Law, Pin, Pre/PostCaseMetadata, StopWords and RegexWorker fixtures, HtmlDiscoveryCoverage, RegexResult, DiffWorker (malformed runtime), the CaseName, CaseNameProcess and CaseNameScan `null` cases, the ExtractionEntry fixture's `{}` and `{invalid: true}` cases, FullExtractionCoverage, ReferenceTokenExtractionCoverage (`editions: "none"`) and SemanticProjectionCoverage.

Kept, because a stage guard refuses an owned value: court-table and exclusion-list SHA-256 authentication (the same-length table mutation test), fixed-pattern authentication (the tampered CaseName pattern), duplicate edition ids and pattern ids, the pattern-count ceiling, the selection string budgets, the patternUtf16 context refusal and the digest-output refusal.

Added real boundary tests. CitationEngineBoundaryRefusal builds CitationEngineLive and the default engine from a valid configuration with one field replaced (limits `sourceUtf16: -1`, runtime kind `"unsupported"`, a non-digest `engineArtifact`, an empty `parserCatalog`) and asserts `CitationInputError` for `extract` with the spawner snapshot unchanged. CitationExtractorControls does the same for the extractor (limits, runtime, a numeric `vocabularyVersion`; no process spawned). CitationConfigurationOwnership checks that owning a valid CitationEngineConfiguration, CitationEngineDefaultConfiguration and CitationExtractorConfiguration shares no object or buffer with the caller's value, and that a pass-through `S.Unknown` leaf is kept by reference, which is the precondition `ownCitationConfiguration` documents.

Test count across the touched files: 278 before, 270 after (14 deleted, 6 added).

Lane perf/citation-owned-configuration

Reverse: Restore the refuse helpers and adapter invalid thunks from the round-3 commit; the boundary tests can stay.

### Keep fixed-pattern authentication at the installed call site, once per engine, 2026-11-14

Owner ruling, round 2: a reshape of design section 2.1's fingerprint rule. Ownership is carried by the type (`CitationOwned`); authentication stays with the stage that knows its expected constant and runs at that installed call site, once per engine. Authenticating a stage's patterns against its own constant is a safety guard, and moving it into the generic boundary or changing the exported configuration schemas' decoded types to carry fingerprints would weaken that for no gain. This covers the fixed-pattern fingerprints (`copyCitationMetadataPatterns`, `prepareCitationPublicationMetadata`), the court-table authentication in CaseMetadata and PostCaseMetadata, and the vocabulary that SemanticProjection rebuilds at install.

The one per-request repeat is fixed in this slice: the reference-pattern builder re-checked its fixed-pattern fingerprints and recomputed the rejection pattern's fingerprint on every request. `installCitationReferencePatterns` now runs both once per installed call site, captures each outcome with `Effect.exit`, and each request's `make` replays the authentication outcome right after the budget-ceiling check, where the check ran before, and the rejection fingerprint where the rejection descriptor is built. The builder itself stays per request because it reserves its fixed fragments on the request budget (the A3 decision on generated references). The authentication used an unaccounted pattern input, so `producedTextUtf16` and refusal order are unchanged. Because the authentication prepares patterns under the limits, the builder now takes its limits at install; production already passed the installed limits on every request.

Review round 4: the engine still authenticated the reference patterns three times (verify, then install's own authentication and fingerprint). `verifyCitationReferencePatterns` already authenticates the same patterns under the same limits and is the only producer of the value `installCitationReferencePatterns` takes, so install now takes the verified configuration and keeps only the rejection fingerprint, captured with `Effect.exit` and replayed where the rejection descriptor is built. The per-request authentication replay is removed: it replayed a success that verify had already established, so request behaviour and refusal order are unchanged. The install-time `CitationRegexOperation` and Clock match the request-time ones in the annotate path: reference patterns exist only in the extraction tree, installed under SourceDocument's `"extract"` operation, and the base's per-request check ran with the same install-captured dependency context.

Lane perf/citation-owned-configuration

Reverse: Carry fingerprints on the owned value through a fingerprinted pattern codec and compare them at each stage, if a later design wants it.

### Own the default engine configuration by derivation from the owned caller configuration, 2026-11-14

Owner ruling, round 3, replacing the round-1 and round-2 stop on the default engine. The installed default configuration is owned by derivation: `makeDefault` owns the caller's raw `CitationEngineDefaultConfiguration` once with `ownCitationConfiguration` (the engine's only configuration detach), then derives the installed configuration from that owned value with `ownedDerive`. The derivation runs `makeCitationDefaultEngineConfiguration` (sealed asset reads, the tokenizer catalog and helper derivations, the clock-computed year) and assembles `CitationEngineConfiguration`, validated by its `make`, from the derived assets and the limits and runtimes of the owned default configuration. `makeDefault` then calls the internal `install`, which takes `CitationOwned<CitationEngineConfiguration>`. `make` (CitationEngineLive, the raw boundary) keeps its one own and calls the same `install`. Result: one configuration detach per engine; the full-span construction row shows 1.

Aliasing check, by reading: `makeDefault` reads `raw` only in its first `ownCitationConfiguration`. Everything below reads the owned copy or values the engine reads itself, so nothing in the derived configuration can alias an object the caller still holds. The default-boundary mutation test already exists: `CitationEngineLayer.test.ts` › "four-operation engine Layer" › "captures default owners and executes all four operations on bun" and "… on node" mutate the caller's `limits.cleanDeadline` and `runtime.workerFile` after the default Layer is built and assert that the reported deadline is unchanged and all four operations still run.

Outside the detach count, unchanged: `makeCitationDefaultEngineConfiguration`, `makeCitationEngineArtifact` and `makeCitationSixFormArtifact` keep their own raw-input snapshots, because each is a separately callable entry point with tests of raw input.

The round-2 stop recorded what the loaders do: `loadCitationJsonAsset` decodes sealed text through each asset's JSON codec, and the tokenizer catalog and helper configurations are then derived from those assets by engine computation. That is why derivation, not a second detach or a string-storage route, is the owned path.

Lane perf/citation-owned-configuration

Reverse: Have makeDefault call make with the assembled configuration again, so make's boundary detach owns it (two detaches per default engine).

### Type the leaf helpers and drop their configuration decodes, 2026-11-14

Owner ruling, round 2: acceptance criterion A4's "no installer below the boundary decodes configuration" covers the leaf helpers too, and leaving them for a later slice is not available. This replaces the earlier decision to keep them.

Every helper whose policy comes from engine-held limits now takes typed `CitationEngineLimits` instead of `unknown` and no longer re-decodes it (32 modules, from `ContextMatcher`, `MetadataStrings`, `MetadataYear`, `RegexInput`, `TokenDispatch`, `EditionInference`, `ExtractorOrdering` and `ExtractorRecipes` to the token, regex, rendering, span-offset and resource-correction helpers). The same holds for the parent-side installers: `installCitationRegexEvaluator`, the Diff, Xml, Html and Recognizer worker clients, `makeCitationNativeProcessOwner`, both admissions, the text budget, the cleaner pipeline, registry, values and literal cleaners, the document cleaner protocols and document services. `prepareCitationNativeRuntime`, which decoded the limits and runtime and round-tripped the limits through their codec on every evaluator install and every Diff or Xml worker, is deleted. Configuration arguments are typed as well: runtimes, patterns, flags, descriptor bindings, dispatch, ordering, selection, recipe and edition bindings, the regex engine and input role, the court table text and the reference exclusions. The install-time copies that went with the decodes (descriptor copies in the registry, the selection-binding byte copies, edition-row copies, the exclusion-list copy) are dropped because the values are owned.

Kept, because they are guards rather than decodes: the pattern-count ceiling, duplicate-id and duplicate-descriptor refusals, the selection string budgets, the court-table and exclusion-list SHA-256 authentication, the year-bound range check for the clock-computed ceiling (computed data, decoded where it is computed), and the HTML worker's millisecond normalization of deadlines. Per-request data arguments keep their decodes (token seeds, positions, raw source, regex result inputs). Worker programs decode their startup and job frames across the process boundary and keep those decodes. Separately callable raw entry points keep their own decode at entry: `makeCitationDump` and `makeCitationBuiltinDump` (and the `PythonRepr` table they pass), the default-engine asset assembly (`makeCitationDefaultEngineConfiguration`, `makeCitationHelperConfigurations`, `makeCitationParserCatalog`, `makeCitationCanonicalTokenizerCatalog`, see the default-engine stop), and the report snapshot `captureCitationOperationPolicy`.

The per-request reference-pattern builder takes its configuration and limits at install (`installCitationReferencePatterns`, ruling 2) and decodes nothing per request.

Tests that pass plain fixture objects own them through `ownCitationTestConfiguration` in a small per-file adapter. Correction (review round 4): round 2 said the malformed-argument tests "now assert the same refusal at the boundary". They did not. `refuseCitationTestConfiguration` decoded a value against a bare schema and returned whatever failure the test passed in, so it proved only that the schema rejects the value, never which production error a caller sees. Those tests are deleted, and real boundary tests replace them (decision "Delete the tautological configuration refusal tests and test the real boundaries").

Behaviour note: the descriptor registry decoded raw bindings with `onExcessProperty: "error"`, refusing unknown capture-name keys. That strictness now sits at the boundary decode, which drops excess keys as the old engine snapshot did. In the engine, descriptors already passed the engine's default decode before reaching the registry, so engine behaviour is unchanged. The direct registry test that kept the strict decode in its adapter was one of the deleted tautologies.

Lane perf/citation-owned-configuration

Reverse: Restore the unknown-typed helper signatures and their decodes; the boundary refusals in the direct tests would move back to the helpers.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
