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

### Delete the unused cleaner operation adapter, 2026-11-13

A repository-wide live source and test search found makeCitationCleanerOperation only in its defining module and CitationCleanerOperation.test.ts. No src caller, public engine boundary, or package composition uses it; SourceCleaning uses CleanerPipeline directly. The similarly named replay fixture independently wraps CleanerPipeline and does not call this adapter. Delete the test-only dead production adapter and its test rather than count fixture admission as a production proof. Public engine admission is now proved by the manual-clock engine test. Regenerate the instrumentation catalog and prune the generated shard plan with repository writers.

Reverse: Restore CleanerOperation.ts and its test from head 99bb436ca0fc if a real production caller is introduced.

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

### Keep the full law-practice audit on hosted CI, 2026-11-13

The operator clarified on 2026-11-13 that file-by-file local tests govern because the full law-practice package audit runs the whole suite. Run package-verify --quick and docgen:local locally, and leave the full audit to hosted CI. The smaller lint-rules package receives its full package-verify.

Reverse: Run full package-verify locally when the operator permits a whole-package suite.

### Keep unrelated inventory positions at the clean main baseline, 2026-11-13

The syntax-only effect-vitest check passes with zero introduced and resolved findings on a clean detached origin/main worktree at 8b405079b69466e27babc5dff27c06292a8cc4e2. Both named source files are byte-identical to the lane. The writer updates positional metadata even though check accepts the existing occurrence identities; restore all six changed rows in those two files to main, including the additional row beyond the review count. No inherited red needs routing. The check was repeated successfully on clean main at 49a2d768f64803883bcc9b64c9a54c97b1f26c40 after #3251: 3838 files, 516 findings, zero introduced/resolved. The writer also shifted fourteen other unrelated positional rows, all restored to main as well. A third clean audit at e7852920d2e975fa909b0574831ff30d828af35f also passes with the same counts. The throwaway sibling-root worktree was removed after every audit.

Reverse: Regenerate and adopt the unrelated line-position rows

### Log extraction and annotation refusal once at the public engine, 2026-11-13

The engine normalizes and logs every typed extract or annotate refusal after the invocation timer and admission boundary, so deadlines, admission refusals and stage refusals each emit exactly one fixed boundary-refused debug message. Inner normalizers remain silent and idempotent. Manual-clock tests on both runtime configurations count one deadline log and one subsequent source-stage refusal log, with zero native children.

Reverse: Restore logging to the inner boundary normalizers

### Preserve boundary-specific deadline placement around admission, 2026-11-13

Review round 1 identified that engine queue wait must count against each stage deadline, while the public six-form extractor historically starts that deadline after admission. CitationInvocationPolicy now has a schema-backed deadlineStarts literal with explicit values at both public boundaries. There remains one invocation constructor: engine timing wraps admission.run; extractor timing wraps its body inside admission.run. The request Scope remains inside admission in both cases, so cleanup precedes permit release. Manual-clock public boundary tests cover queue plus work and refusal labels without native children.

Reverse: Remove deadlineStarts and restore the previous invocation ordering only with an explicit behavior change.

### Preserve tokenizer refusals independently of ordering counters, 2026-11-13

Restore the selected-count patternEvaluations safety refusal and typed missing-ID invalid-configuration mapping. A2 preserves these refusals independently of the ordering implementation; no coverage floor changes. Reuse one invalidConfiguration factory at the existing policy, configuration and missing-ID boundaries rather than repeating equivalent error callbacks. The real control has two unfiltered members, a limit of three and four loose-policy selections. Both bounded ordering alone and the tokenizer refuse with extract/patternEvaluations before any worker starts. In this checkout RuntimeSet copies charge the new counter for each source bucket at line 147, or through copyBuckets at lines 137-141 when capacity changes; the control therefore refuses in ordering before the restored tokenizer guard. Leave that guard alternative and the missing-ID path unforced and uncovered.

Lane feat/citation-invocation-binding · PR #3265

Reverse: Restore the tokenizer guard deletion and missing-ID defect conversion from 76b441e82d4.

### Remove only the deleted cleaner adapter coverage row, 2026-11-13

Remove the orphan CleanerOperation.ts file row by hand. The baseline writer exists as coverage:baseline:write, but it consumes complete measured package snapshots and has no file-row deletion command. Regenerating law-practice-server would run its whole suite, which the task explicitly forbids locally. Keep every other coverage floor unchanged and leave frozen proof references under goals/citation-extraction-engine and the eyecite fixture untouched.

Reverse: Restore CleanerOperation.ts and its coverage baseline row

### Remove unreachable cleaner parent-budget fallback paths, 2026-11-13

The invocation always supplies a parent budget, so CleanerPipeline no longer wraps it in Some or retains parentless fallbacks. Its charge loop now iterates typed charge values directly; the issued-ledger check still refuses forged, reused and absent entries. Behavioral tests cover live local ceilings, cumulative request capacity, unchanged empty text and unknown steps. No coverage floor changes.

Lane feat/citation-invocation-binding · PR #3265

Reverse: Restore the cleaner parent Option wrappers and parentless fallbacks.

### Update the existing draft without starting a readiness monitor, 2026-11-13

Publish this review wave through Yeet publish --staged-only --no-pr. PR #3265 already exists, so the push still raises its normal synchronize event and keeps its draft state. The no-pr option skips the PR tail (creation, label changes, provenance restamping and the automatic readiness monitor); cheap gates and the head-install preflight remain mandatory. The existing provenance footer describes the same branch, workspace and agent and has no head-SHA field. Replace the existing body separately through Yeet gh pr body, preserving its provenance footer. This honors the task's explicit no-watch instruction without launching and then interrupting a monitor.

Reverse: Use the default Yeet PR tail to submit a readiness monitor

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
