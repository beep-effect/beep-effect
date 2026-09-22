# @beep/agents-client P1 four-lens digest

6 complete census files, 24 rows: 9 review proposals and 15 coverage-only NONE rows. All remain open judgments. This is a source-only audit, not remediation.

| Lens | Reviews | NONE | Major | Minor | Info |
|---|---:|---:|---:|---:|---:|
| resource | 4 | 2 | 3 | 1 | 2 |
| flake | 3 | 3 | 2 | 1 | 3 |
| property | 2 | 4 | 0 | 2 | 4 |
| observability | 0 | 6 | 0 | 0 | 6 |

## Findings

### L-RES-02 ProviderInstance.atoms.test.ts:64–75 (major)

AtomRegistry.make is manually owned; cases unmount only after assertions and never dispose registries. Assertion failure bypasses unmounts, and leftover registry runtimes can retain RPC subscriptions. Register per-case finalization immediately, keep unmount-before-dispose order and fresh initialValues. Pinned AtomRegistry.layerOptions registers dispose at scope exit (156-170); dispose resets nodes/timers (674-688). Do not share one mutable registry across cases.

Evidence: `      const registry = makeRegistry();       const unmount = registry.mount(providerInstancesAtom); `

### L-FLAKE-02 ProviderInstance.atoms.test.ts:28–28 (major)

Four yieldNow repetitions do not establish that a list/probe or its invalidated refresh completed. Await public AtomRegistry.getResult with correct waiting semantics or explicit request/refresh acknowledgements before exact reads 1/2 and guidance assertions. Preserve real RpcTest/atoms, serial module-state ownership and negative guidance. Do not add sleeps, retries or assume TestClock controls detached registry scheduling.

Evidence: `const settle = Effect.repeat(Effect.yieldNow, { times: 4 });`

### L-RES-02 run-turn-defect.test.ts:47–78 (major)

The scripted defect is intentionally inspected, but mount releases and registry.dispose occur only after all assertions. A failing assertion skips them. Register finalizers immediately for each helper invocation, preserve unmount-before-dispose and receipt/status/draft identity, and keep persisted/not_persisted outcomes distinct. No changed failure channel or shared registry.

Evidence: `        const registry = registryWithClient(client);         const draftAtom = draftAtoms(threadId);         const draftRevisionAtom = draftRevisionAtoms(threadId);`

### L-FLAKE-05 run-turn-defect.test.ts:81–84 (minor)

The comment requires persisted before not_persisted because the latter writes localStorage. Chat.atoms.ts322-365 uses persistent draft:1 outside registry state; disposing a registry does not restore storage. Isolate or save/restore the exact draft key for each scenario with guaranteed teardown, retaining actual persistence behavior and original assertions. No global storage clear that affects other tests, no production key change, and no fabricated current failure.

Evidence: `      // the not_persisted case writes the restored draft into localStorage, so       // the durable case must run first to see an empty draft baseline       yield* verifyDefectedTurn("persisted");`

### L-RES-02 run-turn-reconciliation.test.ts:143–175 (major)

Registries, mounts and Stream.never lifetimes are manually cleaned after assertions throughout this file. Failure/interruption can bypass cleanup (also helper238-274 and other cases). Register per-scenario finalizers immediately; retain exact interruption, waitForAtom cancellation, per-case initialValues and persisted storage identity. Do not flatten shorter helper lifetimes or replace actual atom runtime with a stub. Coordinate draft-key isolation without globally clearing storage.

Evidence: `      const registry = registryWithClient(client);       const timelineAtom = threadTimelineAtoms(threadId);       const draftAtom = draftAtoms(threadId);`

### L-FLAKE-02 run-turn-reconciliation.test.ts:534–544 (major)

timelineRefreshAttempted is completed before the scripted refresh failure; sleeping 25ms then inspecting fallback does not witness terminal reconciliation. Use the existing waitForAtom on the expected fallback/state or public getResult with appropriate waiting/failed outcome handling. Preserve streamStarted acknowledgement, Atom.Interrupt, stopped block and unchanged draft. Do not extend sleep/timeout or introduce flaky retries; detached registry timing is not automatically TestClock time.

Evidence: `      yield* AtomRegistry.getResult(registry, timelineAtom);       registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));       yield* Deferred.await(streamStarted);`

### L-PROP-04 run-turn-reconciliation.test.ts:116–124 (minor)

The 20ms retention case checks only a keepAlive atom, so disabled eviction also passes. Add a removable control atom under the same 1ms TTL/resolution, verify eviction while the exact fallback persists, and keep native timer ownership. Preserve all other receipt/revision/error controls in this file, eight-attempt semantics and interval 2ms; no private timer access or weakened fallback arrays.

Evidence: `      const registry = AtomRegistry.make({ defaultIdleTTL: 1, timeoutResolution: 1 });       const unmount = registry.mount(atom);       const fallback = StreamingTurn.make({ threadId, userContent: co`

### L-RES-02 selected-thread-lifetime.test.ts:27–37 (minor)

The selected atom is intentionally kept alive after unmount, but the owning registry is never disposed. Register scope cleanup at creation and retain unmount-before-idle-observation; dispose only after the retained-selection assertion. Keep native timer semantics and fresh registry, without making registry teardown itself the selection mechanism.

Evidence: `      const registry = AtomRegistry.make({ defaultIdleTTL: IDLE_TTL_MS });        const unmount = registry.mount(selectedThreadAtom);`

### L-PROP-04 selected-thread-lifetime.test.ts:29–37 (minor)

The assertion proves selection remains but would also pass if registry idle eviction stopped working entirely. Add a separate removable control atom in the same 40ms-TTL registry, mount/set/unmount it, and witness its default/reset after the idle interval while selection remains olderThread. Preserve native timer subject, exact selection and current duration; no private registry hook or forced disposal of the subject.

Evidence: `      const unmount = registry.mount(selectedThreadAtom);       registry.set(selectedThreadAtom, O.some(olderThread)); `

## Layer topology, rebuild costs and native boundaries

Pure URL/schema tests acquire nothing. Atom tests create manual registries containing local RPC/runtime layers and persistent draft storage. Registry initialValues are per scenario; one registry must remain across each mutation/reconciliation assertion. Pinned scoped registry/mount APIs provide cleanup seams, but blindly sharing one outer mutable registry would change IDs, drafts and caches. Native idle timers are part of the lifetime subject; no filesystem acquisition is present and MemoryFS is irrelevant. Source proves repeated registry construction, not its measured setup cost. The existing public wait helpers can replace guessed scheduling only while retaining exact completion states.

## Retained timing and hosted limits

The accepted Node command baseline records 23 passed tests, 6.821605846000239 seconds whole command and 5858.363525390625 ms reporter duration. All assigned files appear in the retained report. These timings are not rerun or adjusted for host load. Runtimes: Node22.22.3/Bun1.4.2/Vitest4.1.11; the rc113 Vitest5 peer-range qualification remains. Raw reporter SHA256: `fa0fe46a079dcee37ddb458ee03a1706e9558929d3b772fc7b8e8955b0d4b9a3`.

| File | Retained ms | Registered tests |
|---|---:|---:|
| packages/agents/client/test/Chat.layer.test.ts | 1.172607421875 | 2 |
| packages/agents/client/test/Chat.schema-parity.test.ts | 87.334716796875 | 2 |
| packages/agents/client/test/ProviderInstance.atoms.test.ts | 12.337890625 | 3 |
| packages/agents/client/test/run-turn-defect.test.ts | 364.363525390625 | 1 |
| packages/agents/client/test/run-turn-reconciliation.test.ts | 276.838623046875 | 14 |
| packages/agents/client/test/selected-thread-lifetime.test.ts | 202.6962890625 | 1 |

Hosted summary: 5 observations in 2 jobs; categories {"assertion-or-property-failure": 1, "coverage-ratchet": 4}. These are not unique flakes or evidence of a current-source cause. Detailed cause is not inferred from this aggregate. Production coverage-ratchet observations are not failing test cases. Passing registrations do not prove browser/provider/native integration execution beyond the source-defined test subject.

Globally, all 139 first attempts comprise 132 full-file baselines, 4 configured subsets and 3 failures: CIops, Effect Drizzle and QA Capture. Keep those failed/subset boundaries unchanged. Hosted scope covers 527 failed runs and includes 21 unavailable logs and one unresolved cause. Graph-3d browser file is outside its Node cohort, not executed or reported skipped.

## Top ten files by review count

| File | Review rows |
|---|---:|
| packages/agents/client/test/run-turn-reconciliation.test.ts | 3 |
| packages/agents/client/test/ProviderInstance.atoms.test.ts | 2 |
| packages/agents/client/test/run-turn-defect.test.ts | 2 |
| packages/agents/client/test/selected-thread-lifetime.test.ts | 2 |
| packages/agents/client/test/Chat.layer.test.ts | 0 |
| packages/agents/client/test/Chat.schema-parity.test.ts | 0 |

## Complete per-file coverage

### packages/agents/client/test/Chat.layer.test.ts

Kind test; full read 1–19; 1112 bytes; SHA256 `a12984dd984331994b78097eb698711e433b97cddf7e9798fc0f19fcfa5efdca`.

- **resource:** No additional change required by this lens: Pure endpoint resolution receives a supplied origin or omitted runtime. No HTTP client, browser, sidecar, layer or filesystem is acquired.
- **flake:** No additional change required by this lens: Fixed HTTP/HTTPS/custom/malformed origin strings are synchronous; no scheduling or shared mutable state.
- **property:** No additional change required by this lens: Exact same-origin URLs and sidecar fallbacks cover valid, missing and malformed origins. Plain string expectations are appropriate; no fabricated generator requirement.
- **observability:** No additional change required by this lens: Named endpoint groups and exact expected URLs expose routing failures. They do not establish live sidecar or browser execution.

### packages/agents/client/test/Chat.schema-parity.test.ts

Kind test; full read 1–138; 5131 bytes; SHA256 `d33f564b283ec7717e9107205c05b92a72394d4c3cc35b66c6388eac06a34c0c`.

- **resource:** No additional change required by this lens: Schema encoding, decoding and equality use immutable fixtures without acquired resources.
- **flake:** No additional change required by this lens: Schema-derived generation passes explicit fcRuns(10); no wall time, external port or shared mutation.
- **property:** No additional change required by this lens: Encoded defaults, tagged send/edit shapes and thread-bearing edit target have explicit witnesses. Six real schemas round-trip through assertions inside the property before returning true; not vacuous. Preserve fcRuns(10), Equal-or-schema equivalence and exact Option operands. EV001/EV007 cover registration migration.
- **observability:** No additional change required by this lens: Named shape and round-trip cases identify contracts, although failure detail from the manual Passed tag should follow existing detector migration. No independent logger or watchdog defect.

### packages/agents/client/test/ProviderInstance.atoms.test.ts

Kind test; full read 1–126; 4768 bytes; SHA256 `3d21af30c58dadfa97f5c60dea70fa77e51c10fbaf40e57e29f84929fe59f81a`.

- **resource:** AtomRegistry.make is manually owned; cases unmount only after assertions and never dispose registries. Assertion failure bypasses unmounts, and leftover registry runtimes can retain RPC subscriptions. Register per-case finalization immediately, keep unmount-before-dispose order and fresh initialValues. Pinned AtomRegistry.layerOptions registers dispose at scope exit (156-170); dispose resets nodes/timers (674-688). Do not share one mutable registry across cases.
- **flake:** Four yieldNow repetitions do not establish that a list/probe or its invalidated refresh completed. Await public AtomRegistry.getResult with correct waiting semantics or explicit request/refresh acknowledgements before exact reads 1/2 and guidance assertions. Preserve real RpcTest/atoms, serial module-state ownership and negative guidance. Do not add sleeps, retries or assume TestClock controls detached registry scheduling.
- **property:** No additional change required by this lens: List contents, invalidation reads 1 then 2 and typed unauthenticated guidance are explicitly checked. Guarded payload assertions are preceded by failure-producing guard assertions, so they are not vacuous. Preserve the actual atoms and in-process RpcTest transport.
- **observability:** No additional change required by this lens: Guidance and exact list values/counters localize failures. Login text is fixture data; no CLI command or real authentication runs. Shared counters are explicitly serial, but cleanup and synchronization need the separate resource/flake proposals.

### packages/agents/client/test/run-turn-defect.test.ts

Kind test; full read 1–87; 3886 bytes; SHA256 `5e0d4510c039f9c0fc563e60c38aaa4348b749860cb762c26fc03455d360ab7c`.

- **resource:** The scripted defect is intentionally inspected, but mount releases and registry.dispose occur only after all assertions. A failing assertion skips them. Register finalizers immediately for each helper invocation, preserve unmount-before-dispose and receipt/status/draft identity, and keep persisted/not_persisted outcomes distinct. No changed failure channel or shared registry.
- **flake:** The comment requires persisted before not_persisted because the latter writes localStorage. Chat.atoms.ts322-365 uses persistent draft:1 outside registry state; disposing a registry does not restore storage. Isolate or save/restore the exact draft key for each scenario with guaranteed teardown, retaining actual persistence behavior and original assertions. No global storage clear that affects other tests, no production key change, and no fabricated current failure.
- **property:** No additional change required by this lens: Both persisted and not_persisted receipts assert failed Exit, one status read, cleared streaming, exact error message and distinct restored draft/revision outcomes. Preserve the defect and Boolean failure polarity without inventing an expected Cause.
- **observability:** No additional change required by this lens: The case explicitly asserts defect visibility and the exact user-facing failure message. It is a scripted transport crash, not a real network outage; cleanup failures must not obscure that primary evidence.

### packages/agents/client/test/run-turn-reconciliation.test.ts

Kind test; full read 1–762; 32335 bytes; SHA256 `d8e2aa5f7ecff76be42fbfae531e0be62ca039dbe0b0ac3f7bb969da57123e2e`.

- **resource:** Registries, mounts and Stream.never lifetimes are manually cleaned after assertions throughout this file. Failure/interruption can bypass cleanup (also helper238-274 and other cases). Register per-scenario finalizers immediately; retain exact interruption, waitForAtom cancellation, per-case initialValues and persisted storage identity. Do not flatten shorter helper lifetimes or replace actual atom runtime with a stub. Coordinate draft-key isolation without globally clearing storage.
- **flake:** timelineRefreshAttempted is completed before the scripted refresh failure; sleeping 25ms then inspecting fallback does not witness terminal reconciliation. Use the existing waitForAtom on the expected fallback/state or public getResult with appropriate waiting/failed outcome handling. Preserve streamStarted acknowledgement, Atom.Interrupt, stopped block and unchanged draft. Do not extend sleep/timeout or introduce flaky retries; detached registry timing is not automatically TestClock time.
- **property:** The 20ms retention case checks only a keepAlive atom, so disabled eviction also passes. Add a removable control atom under the same 1ms TTL/resolution, verify eviction while the exact fallback persists, and keep native timer ownership. Preserve all other receipt/revision/error controls in this file, eight-attempt semantics and interval 2ms; no private timer access or weakened fallback arrays.
- **observability:** No additional change required by this lens: Status-specific timeout text and event acknowledgements provide useful context. Public getResult and waitForAtom already exist; preserve cancellation cleanup and no lost fallback diagnostics during instrumentation. No logging-only reason to change TestEnv.

### packages/agents/client/test/selected-thread-lifetime.test.ts

Kind test; full read 1–40; 1854 bytes; SHA256 `6a6f0b3b185541e859b916f22f79d46314fb5a9986fb24fc6894c7ef3383e506`.

- **resource:** The selected atom is intentionally kept alive after unmount, but the owning registry is never disposed. Register scope cleanup at creation and retain unmount-before-idle-observation; dispose only after the retained-selection assertion. Keep native timer semantics and fresh registry, without making registry teardown itself the selection mechanism.
- **flake:** No additional change required by this lens: Idle expiry uses AtomRegistry native Date.now/setTimeout (rc113 AtomRegistry.ts613-640), so live time has an actual subject. Preserve the 40ms TTL and 200ms observation while evaluating a controlled native-timer witness; TestClock alone cannot drive it. EV009 remains open for Root semantic adjudication, not an automatic rewrite.
- **property:** The assertion proves selection remains but would also pass if registry idle eviction stopped working entirely. Add a separate removable control atom in the same 40ms-TTL registry, mount/set/unmount it, and witness its default/reset after the idle interval while selection remains olderThread. Preserve native timer subject, exact selection and current duration; no private registry hook or forced disposal of the subject.
- **observability:** No additional change required by this lens: The named regression and exact selected ThreadId expose lost selection. This is registry lifetime behavior, not a rendered desktop-navigation test or actual browser proof.

## Proposed P2 order and uncertainty

After Benjamin authorizes P2: scope and guaranteed cleanup first; then preserve every assertion family, operand and polarity; migrate meaningful schema properties without lowering fcRuns or CI floors; address scheduling/shared state with completion witnesses; finally adopt instrumented runner without changing TestEnv, timeout, logs or finalizers. No source mutation is authorized by these rows. No skipped tests, flakyTest, global timeout/concurrency changes or new suppressions proposed.

Mechanical candidates remain open and separate. Human resource coverage comes from actual construction/teardown reads, not EV judgments. No old exception is transferred. Source review does not establish absence of races or package/coverage success. Root-reviewed P1 inventory; P2 remains gated.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

Root accepted these P1 rows after source, artifact and combined strict-schema validation. Full P1 completeness, Grok review and Benjamin’s acknowledgement remain required before P2.
