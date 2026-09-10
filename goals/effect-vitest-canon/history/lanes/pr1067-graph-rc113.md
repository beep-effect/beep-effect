# PR #1067 rc113 upstream-contract audit

Status: in progress.

Active contract: Effect / @effect/vitest 4.0.0-rc.113. Prior rc112 and historical reconciliation evidence remain historical. Root owns canonical graph, documentation, publication and acceptance. This lane writes only this report and private `~/.cache/beep/effect-vitest-canon/pr1067-resume/graph-rc113/` artifacts.

## Completed audit — 2026-09-10

**Private candidate ready for Root review; installed Vitest peer compatibility is a blocker to runtime acceptance.** The complete candidate is `~/.cache/beep/effect-vitest-canon/pr1067-resume/graph-rc113/effect-vitest.primitives.rc113.json`. It pins `@effect/vitest@4.0.0-rc.113` at `d3b837aee836f35d625d55205f7d6e61305fc198`. No canonical graph, source, baseline, inventory or census was written.

The candidate contains **100 entries**, covering **39 direct export surfaces** (including public namespace members and 21 utils functions), **15 README headings**, tester/options surfaces, retained Effect support primitives, native Arbitrary options and two explicitly internal lifecycle evidence anchors. The `export * from "vitest"` boundary is represented once; it is not expanded into fabricated @effect/vitest declarations. Every candidate entry has a verified immutable file hash and source range. No current export or README section is uncovered.

**Validation:** the current `EffectVitestPrimitiveGraphDocument` schema successfully decoded all 100 entries; EV001–EV015 retain replacement coverage. Existing schema string IDs/source paths accept the new candidate without a schema change. This is schema validation, not execution or semantic compilation of examples. CLI coverage fixtures and source-derived count assertions still require updating.

### Installed parity and compatibility

Installed Effect and @effect/vitest are **4.0.0-rc.113**. All three installed @effect/vitest source files—index, utils, internal runner—and its README exactly match the immutable reference hashes. There are no mismatches in those four comparisons.

Installed **Vitest remains 4.1.11**. Both the rc113 package metadata and README require **Vitest >=5.0.0 <6.0.0**. The README specifies Node `^22.12.0 || ^24.0.0 || >=26.0.0` and Vite 6.4+ within majors 6–8. A frozen install passing does not establish satisfaction of that peer contract. Root must coordinate the supported peer/runtime cohort before accepting runner behavior; this lane did not alter dependencies or execute tests.

### Precise upstream contract changes

| Surface | rc113 contract and adoption consequence |
| --- | --- |
| `prop` / `it.prop` | Synchronous callback; accepts tuple/record Schema or **native** Arbitrary inputs. The old synchronous Schema rejection is gone. Do not return Promise or Effect. |
| `effect.prop` / `it.effect.prop` / `live.prop` | Same input domain; callback receives generated values and TestContext and returns Effect. Effectful variants scope/provide each evaluation according to their tester environment. |
| Property options | Fourth argument remains numeric timeout or Vitest TestOptions; native options are nested under `arbitrary`, not `fastCheck`. Fields: `runs`, `size`, `maxDiscards`, `maxShrinks`, `seed`, `replay`. |
| Native generation | `Arbitrary.schema(S)` compiles the production schema; native Arbitraries are not fast-check Arbitraries. Custom shrink candidates are schema-checked. `size` is local complexity; recursion shares an allowance. `maxShrinks` counts inspected candidates, including rejected candidates. |
| Replay/floors | Native replay is an opaque token overriding runs/size/discard/shrink/seed options. Old fast-check seed/path replay is not equivalent. Current `@beep/fc-runs` already returns native options: `runs = max(inline/default, BEEP_FC_NUM_RUNS)`, optional integer `BEEP_FC_SEED`. Use `{ arbitrary: fcRuns(n) }`; do not nest the object inside `runs` or assume an omitted option inherits fast-check global configuration. |
| Falsification | `false`, throws, assertions, defects and typed non-interruption failures shrink. Other normal results, including void, pass. Interruption stays interruption rather than becoming a counterexample. |
| Property timeout | Vitest's TestContext signal interrupts generation, evaluation and shrinking. Finalizers run; synchronous non-returning JavaScript cannot be preempted. Do not assume the old callback-only adapter proves aggregate deadline behavior for this engine. |
| Layer suites | Named root/nested suites accept `concurrent`; omitted values inherit concurrency. Anonymous blocks always inherit enclosing concurrency. Nested MethodsNonLive now exposes `concurrent` and `timeout`, not timeout alone. Shared services/TestClock remain shared; use `ctx.expect` for concurrent snapshot/assertion accounting. |
| Fixture hooks | Named layer: beforeAll acquisition, afterAll release. Anonymous layer: selected-task collection, filtered beforeEach acquisition, onTestFinished last-task cleanup, afterAll fallback. Hook timeout is independent from body timeout. Layer cleanup deliberately avoids the last test's aborted signal. |
| Test teardown | `runTest` forwards `ctx.signal`; on abort it adds an onTestFinished promise join for finalizers, including retries with an already-aborted signal. Normal successful tests do not receive that extra join hook. |
| `flakyTest` / `it.flakyTest` | Scoped, sandboxed attempts; up to ten recurrences plus the initial attempt. Default 30-second duration is checked at retry boundaries, **not a hard interrupting deadline for a hung attempt**. Remaining failure dies. D6 root-cause/reason/follow-up requirements remain. |
| Tester modifiers | skip/skipIf/runIf/only/each/fails remain. `each` delegates to `it.for(cases)` and passes one selected case, without TestContext; preserve actual behavior rather than interpreting Array<T> as tuple spreading. |

All 21 utils exports remain represented with their actual signatures and source ranges. `assertTrue` has a message argument; helpers such as assertSome/assertNone/assertSuccess/assertFailure/assertExitSuccess/assertExitFailure use their existing `...Array<never>` guard rather than an extra message parameter. `assertExitFailure` expects a Cause. `addEqualityTesters` still exists but currently calls `expect.addEqualityTesters([])`; do not describe it as installing Effect equality predicates. `utils.assertEquals` explicitly uses Equal.equals.

The README's logging section claims default suppression; internal TestEnv only merges TestClock and TestConsole and contains no Logger override. The candidate flags this discrepancy rather than promoting that prose into a source-level guarantee.

### IDs and CLI adoption

Stable semantically valid IDs are retained. Exactly two old option IDs are removed/replaced:

- `it.effect.prop.option.fastCheck` → `it.effect.prop.option.arbitrary`
- `it.prop.option.fastCheck` → `it.prop.option.arbitrary`

This is an engine/options migration, not a compatibility alias. No root @effect/vitest declaration was removed. Vitest 5's inherited API removes sequential helpers/options, top-level bench and old benchmark types, and ExpectPollOptions; it changes Assertion generics and reporter/environment import boundaries. The new README migration entry records these changes without inventing local exports. Bench is now a test-context fixture; shared mutable suites should use `{ concurrent: false }`.

Bounded exact-ID search found only the two canonical graph definitions. Indirect users are the property prompt's “both fastCheck option entries” and CLI source-anchor derivation tests. `id-users.json` records them. The current primitive test still names the rc112 fixture, expects 85 entries/anchors and rc112 mismatch text. Root/CLI lane must adopt the rc113 fixture, public-export coverage and supplemental anchor handling. The new private namespace helper `ArbitraryValue` is not a public export; do not fabricate a public graph declaration merely because a test visits every type alias.

### Active-contract changes for Root

1. **SPEC and DECISIONS:** update active pin/header and D11 to rc113/verified SHA, retaining installed-version mismatch enforcement. Rewrite SPEC §1.3, §6.3, EV007 guidance and example-version assumptions for native Schema/Arbitrary semantics. Preserve floors and production-domain coverage; explicitly distinguish replay from a full floor-bearing check.
2. **`standards/architecture/08-testing.md`:** replace the active S.toArbitrary/FastCheck recipe with native Schema/Arbitrary and the existing native fcRuns helper. Audit annotation migration against actual native support; do not mechanically relabel old generator annotations.
3. **`.patterns/testing-patterns.md`:** refresh the active pin qualifier and relevant property/layer/timeout recipes. The no-extra-message utils restriction still holds for the listed helpers; do not “fix” it by removing that rule.
4. **Active prompts:** update lane-contract, property-tester and all-seeing-eye to the new pin, anchors, native options/floors/replay, failure distinctions and Vitest 5 lifecycle. Keep valid each-case behavior; replace the property's obsolete sync-Schema rejection and worked fastCheck example.
5. **Runner/CLI assumptions:** re-prove registration identity, deadline charging across setup/evaluation/shrinking, timeout interruption/finalizer joins, retry signal reuse, named/anonymous layer isolation/concurrency, and reporter output consumption under supported Vitest 5. Existing runtime assertions for `Counterexample: [1]` / `[false]` require native formatter evidence. Native format labels Input/Initial input/Replay differ; do not weaken failure assertions to make them pass.

Historical reconciliation reports, sealed rc112 source/corpus/fixtures, dated P0d/P0e/P0.5 prompts and recorded acceptance decisions must **not** receive global version/string replacement. Preserve their provenance and append superseding active instructions where reuse is intended. No 7417-to7580 work was repeated.

### Receipts and limitations

Private receipts include installed parity, original/candidate graphs, export/README coverage, exact source anchors, ID users/migrations, active-contract hits and successful schema validation. Terminal input/output manifests identify the exact audited files and any concurrent source drift. Root must refresh proof against final lane edits and the supported peer set before adoption.

Graft's skill was read for routing, but its documented automatic refresh conflicts with this lane's write-only boundaries; direct targeted source inspection was used. The pending repo-cli audit inbox row has no verified cause/fix in this lane; no fix SHA, environment attribution or waiver was fabricated. Publication and acceptance remain Root's work.


## Terminal continuation — 2026-09-10

**Bounded audit complete; candidate and prior schema-decode evidence preserved.** Root reports that the prior process and supervisor disappeared without a terminal exit and recorded `interrupted-supervisor-absent` after verifying owned processes absent. This continuation supplies terminal artifact accounting; it does not reinterpret the interrupted supervisor as a successful exit. No source audit, graph generation, dependency change or test was repeated.

The retained candidate remains 100 entries / 39 direct export surfaces / 15 README headings. The prior schema decode passed against schema hash `8d1485c1ccaf5d325880a7c3ad5202c258dfd9298175e627dd6dc7461ecab824`, which still matches the terminal schema input. This receipt proves that bounded decode only, not runtime/package proof.

Ten changes from the original input inventory are recorded without overwriting it: seven Root-owned documents/prompts (SPEC, DECISIONS, 08-testing, testing-patterns, lane-contract, property-tester, all-seeing-eye), the CLI schema, and the runner's Vitest source/runtime test. Root explicitly reports the active rc113 document refresh; those earlier checklist items now describe the audit-time state and are not a claim that Root left them untouched. The new document and runner content was not re-audited. The schema drift is separately tied to the retained successful decode. No immutable-reference, installed-parity-input or canonical-graph drift was observed.

The Vitest compatibility gap remains: installed Vitest 4.1.11 does not satisfy rc113's declared >=5 <6 peer. Root reports that Storybook addon 10.6.0 declares Vitest 4 and that Benjamin is deciding between an explicitly evidenced compatibility arrangement and expanding the dependency upgrade. This lane did not independently query that registry claim or choose either path. Candidate adoption and runtime acceptance remain separate decisions.

Correction to the earlier runtime-format checklist: the inspected rc113 formatter uses `Property falsified`, `Shrunk input`, `Failure` and `Replay`; exhaustion uses `Property exhausted` and `Seed`. The earlier “Input/Initial input” wording was inaccurate. Preserve meaningful failure/replay assertions rather than mechanically substituting old FastCheck counterexample strings.

New terminal receipts use `*-continuation-v1` filenames. `inputs-after-continuation-v1.json` and `input-drift-continuation-v1.json` preserve every original before/after identity and attribute the ten concurrent changes; none is hidden as a zero-drift result. The candidate and all pre-existing private receipts are checked unchanged against the continuation inventory. `outputs-manifest-continuation-v1.json` hashes all private artifacts and this terminal report; its detached SHA-256 closes the manifest chain. No unexpected input drift remains. Root must review final concurrent edits and resolve the peer decision before claiming complete active-contract acceptance.
