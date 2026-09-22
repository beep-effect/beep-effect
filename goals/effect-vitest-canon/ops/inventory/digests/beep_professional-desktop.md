# @beep/professional-desktop — four-lens source audit

All 59 census files are reviewed: 57 tests and two support files. Three disjoint batches cover all 236 file/lens pairs. The inventory contains 25 open review proposals (4 major, 21 minor) and 211 file-specific no-findings rows. Existing 178 detector candidates remain open and separate from human judgments. No P2 remediation is authorized.

## Topology and native boundaries

React providers own their mounted registries, while several manually created registries need failure-safe cleanup. Preserve intentional early disposal, captured-handler lifetimes, per-case mutable state, Deferred coordination and exact teardown assertions. Shared DOM cleanup and toast mocks require concurrency-aware ownership. The chat metric assertions need a registry attributable to the tested program rather than a shared accumulated count.

Detached confirmation, atom idle and dock debounce timers use real host time. TestClock does not automatically control those runtimes. Conversely, native sidecar boot and RPC deadlines currently run under TestClock without advancement; preserve the existing 20-second and 30-second bounds while giving those external waits an appropriate live clock. Child cleanup must join termination and own stderr draining before native directories are removed.

Legacy PGlite data directories, native extension files, SQL migrations and close-before-reopen checks remain actual subjects. Register database release before waiting for readiness. MCP support combines in-process and optional socket transports with distinct workspace, client, handler and ledger lifetimes; explicit outer ownership must preserve fresh mutable state and nested disposal. Source/configuration tests retain the actual manifest, CSS, Rust and C artifacts. MemoryFileSystem is not a blanket replacement for these subjects.

Pure schema, RPC, picker and provider stubs remain distinct from native execution. jsdom geometry, ResizeObserver, media and animation controls do not establish browser rendering or OS behavior. Source-visible layer construction does not quantify rebuild cost or justify a speedup estimate.

## Open review proposals

- **L-RES-02 (minor)**, [test/browser-failure-atoms.test.ts](../../../../../apps/professional-desktop/test/browser-failure-atoms.test.ts), lines 44–79. Both registry instances are disposed only after asynchronous waits/assertions; the second registers real window error/rejection listeners (BrowserFailure.atoms.ts190–214). Register guaranteed per-test cleanup immediately at acquisition, preserving delayed build, annotation assertions and any explicit early dispose.

- **L-OBS-04 (major)**, [test/chat-contract.test.ts](../../../../../apps/professional-desktop/test/chat-contract.test.ts), lines 116–129. Metric.snapshot checks global named completed/time-to-first-block metrics only for nonzero state. Metric.MetricRegistry default is shared across unoverridden contexts (installed Metric.ts1632–1650, Context.ts1613–1619); adapter TestEnv provides clock/console only. Other successful chat cases can satisfy these checks. Bind a fresh registry to this program and its children, preserving the exact metric IDs/attributes and positive counts; do not reset a registry shared with concurrent cases or substitute fake telemetry.

- **L-FLAKE-05 (major)**, [test/chat-ui.test.tsx](../../../../../apps/professional-desktop/test/chat-ui.test.tsx), lines 43–53. Shared sequence.concurrent=true is inherited without a local serial override. afterEach cleanup/clearAllMocks can run while either asynchronous toast case215–247 awaits the same toast.error spy, removing sibling DOM or erasing calls. Give these cases independent ownership or an explicit local serial suite; retain both exact toast operands and state-clearing assertions. This is a source-supported interference risk, not a reproduced flake.

- **L-RES-02 (minor)**, [test/composer-atom-lifetime.test.ts](../../../../../apps/professional-desktop/test/composer-atom-lifetime.test.ts), lines 36–51. The raw registry and mounted draft/handler nodes are disposed only after the awaited draft assertion. A failed wait leaves detached runtime ownership unclosed. Add guaranteed cleanup at creation, retaining idleTTL0, delayed layer build and exact draft equality.

- **L-FLAKE-02 (minor)**, [test/composer-dispatch-confirm.test.ts](../../../../../apps/professional-desktop/test/composer-dispatch-confirm.test.ts), lines 35–109. A detached Effect.runFork in Composer.atoms.ts245–257 owns the confirmation timer. Sleeping200ms after a50ms timeout assumes its restoration/cleanup effect completed; the negative restoration case may pass before that branch runs. Observe a completion/subscription-release witness for this exact dispatch, preserve both positive/negative draft and revision assertions and native timing; do not raise waits or pretend TestClock controls this detached timer.

- **L-RES-02 (minor)**, [test/composer-dispatch-confirm.test.ts](../../../../../apps/professional-desktop/test/composer-dispatch-confirm.test.ts), lines 69–148. All raw registries are tail-disposed after assertions, including a never-ending stream. Register failure-safe disposal immediately; preserve explicit surface unmount and join/observe the subject confirmation lifetime rather than assuming disposal owns the detached runFork timer.

- **L-PROP-04 (minor)**, [test/composer-send-lifetime.test.tsx](../../../../../apps/professional-desktop/test/composer-send-lifetime.test.tsx), lines 20–58. The send-after-idle regression waits200ms with RegistryProvider idleTTL40 but does not witness handler eviction. If eviction were disabled the click/count assertion could still pass. Add a public lifecycle/controlled-scheduler witness that the relevant handler became idle/disposed before using the captured closure, while retaining actual editor interaction, exact send count and existing waits/contracts until a justified lifecycle control replaces them.

- **L-RES-02 (minor)**, [test/dock-shell.test.tsx](../../../../../apps/professional-desktop/test/dock-shell.test.tsx), lines 71–148. Direct graph/registry instances and mounted persistence binding are released only on the success path. Guarantee release/dispose on failed awaitIdle, storage assertion or reset callback. Preserve first-graph disposal before restoring the second and existing reset-before-reload order.

- **L-FLAKE-02 (minor)**, [test/dock-shell.test.tsx](../../../../../apps/professional-desktop/test/dock-shell.test.tsx), lines 107–123. The operation result precedes the detached 400ms debounce and its later save operation (dock.atoms.ts534–545). A600ms sleep does not acknowledge persistence completion. Observe the exact save/storage state with a bounded named wait, preserving actual debounce, mounted binding and snapshot assertions; do not enlarge timeout or substitute virtual time for the external registry.

- **L-RES-02 (minor)**, [test/editor-contract-hardening.test.tsx](../../../../../apps/professional-desktop/test/editor-contract-hardening.test.tsx), lines 278–550. Raw registries in pending-unmount/remount/safety-refusal tests and manually appended root/notice nodes have success-tail cleanup. Add per-test guaranteed cleanup without moving intentional early unmount/dispose/revoke assertions to the end; preserve captured-batch disposal and same-editor remount boundaries. React cleanup alone does not dispose an externally supplied registry or remove manually appended sibling nodes.

- **L-PROP-03 (minor)**, [test/editor-contract-hardening.test.tsx](../../../../../apps/professional-desktop/test/editor-contract-hardening.test.tsx), lines 1081–1093. Arbitrary.checkEffect receives no CheckOptions, so CI BEEP_FC_NUM_RUNS/SEED are not forwarded by this native call. EV007 already covers direct-runner syntax; this row records independent floor/seed loss. Preserve ComposerFeatures schema, exact codec equality, sendOn alternatives and Passed assertion/failure semantics while using a schema property with explicit arbitrary:fcRuns(existing floor), not a smaller budget or weaker schema.

- **L-RES-02 (minor)**, [test/fps-atoms.test.ts](../../../../../apps/professional-desktop/test/fps-atoms.test.ts), lines 26–44. If any sampling assertion throws before line43 the raw registry is never disposed; unstubAllGlobals only restores functions. Register idempotent guaranteed registry cleanup at acquisition while keeping line43 explicit early disposal and the exact latest-frame cancellation assertion.

- **L-RES-02 (minor)**, [test/intake-atoms.test.ts](../../../../../apps/professional-desktop/test/intake-atoms.test.ts), lines 132–140. Raw registries returned by helpers52–65 are disposed only after waits/assertions throughout this file; afterEach restores mocks/globals but does not own them. Register guaranteed idempotent cleanup immediately on creation, including mounted idle-case nodes, while retaining explicit early release, Deferred coordination, exact calls and all state/error assertions.

- **L-RES-02 (minor)**, [test/integration/PgliteDataDirCompatibility.test.ts](../../../../../apps/professional-desktop/test/integration/PgliteDataDirCompatibility.test.ts), lines 66–87. LegacyPglite046 construction and waitReady are both inside acquireUseRelease acquisition. If readiness rejects after construction, acquisition never returns the instance and its close release is not registered. Acquire the constructed instance first and wait for readiness in the protected use scope. Preserve the actual legacy driver, SQL fixtures, original failure and close-before-reopen lifetime; do not substitute a stub or weaken errors.

- **L-PROP-04 (minor)**, [test/integration/contradiction-qa-seed.pglite.test.ts](../../../../../apps/professional-desktop/test/integration/contradiction-qa-seed.pglite.test.ts), lines 290–299. The source-conflict case asserts only Result.isFailure before conditionally asserting reason when ContradictionQaSeedError.is also succeeds. A different failure type with unchanged file and zero rows can pass without the required reason assertion. Require the specific error family before inspecting source-conflict, preserving all original polarity, file contents and database counts; do not invent a Cause or broaden the accepted failure.

- **L-RES-02 (major)**, [test/integration/sidecar-ipc-stdio.test.ts](../../../../../apps/professional-desktop/test/integration/sidecar-ipc-stdio.test.ts), lines 57–128. Child release only signals kill and does not await proc.exited before the earlier temp-directory finalizers run. The callback stderr reader has no cancellation/release finalizer and keeps accumulating buffer after readiness. Own and join child termination plus the stderr drain before removing native directories, bound retained marker state after readiness, and preserve streaming stderr, boot errors, actual binary/stdio and every assertion. Killing is not evidence the child has exited.

- **L-FLAKE-01 (major)**, [test/integration/sidecar-ipc-stdio.test.ts](../../../../../apps/professional-desktop/test/integration/sidecar-ipc-stdio.test.ts), lines 128–172. This it.effect installs TestClock, but real child boot and RPC waits use Effect.timeout20s/30s without advancing that clock. A silent or stalled child can outlive these intended internal deadlines until Vitest interruption. Use pinned bounded TestClock.withLive around the relevant external waits, or an explicitly justified live registration, preserving20s/30s and native transport. Do not advance virtual time to simulate child progress or increase a timeout.

- **L-RES-05 (minor)**, [test/integration/support/ontology-mcp-harness.ts](../../../../../apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts), lines 206–264. withHttpServer rebuilds NodeServices, a native workspace and real handler/client scopes for each invocation; the socket variant additionally binds a real port. D14 requires explicit layer-block ownership for effectful wrappers. Extract only genuinely shareable outer setup into it.layer with appropriate hook bound, keep fresh workspace/config/session/ledger state and client/handler disposal per case, and retain in-process versus socket variants. Do not delete the wrapper or share mutable Refs before accounting for these lifetimes; no measured rebuild saving is claimed.

- **L-PROP-04 (minor)**, [test/optimistic-user-turn.test.tsx](../../../../../apps/professional-desktop/test/optimistic-user-turn.test.tsx), lines 414–440. The timeline starts at AsyncResult.success(retryTimeline); after clicking retry, findByText waits for text already present in that same initial timeline. It can pass before GetTimeline refresh completes, so retained receipt feedback across successful refresh is unproved. Observe this refresh invocation and completion/state revision before checking retained user feedback, preserving existing positive text, receipt state, operands and failure controls; do not add a sleep or weaken the assertion.

- **L-RES-02 (minor)**, [test/sidebar-layout.test.ts](../../../../../apps/professional-desktop/test/sidebar-layout.test.ts), lines 60–78. The raw registry and two mounts are disposed only after both awaited actions and assertions. A failed getResult/assertion bypasses dispose. Register guaranteed registry cleanup immediately at creation, retaining both non-user/user interaction31 assertions and storage subject; do not move or weaken the action sequence.

- **L-PROP-04 (minor)**, [test/surface-boundary.test.tsx](../../../../../apps/professional-desktop/test/surface-boundary.test.tsx), lines 63–74. After clicking Reload, only the still-visible Reload button and render-count delta<=8 are asserted. A no-op click handler leaves the old card visible with delta0 and passes. Add a positive new-attempt witness before retaining the upper bound and failure-card checks; preserve the first self-heal case and exact sanitized log assertions. Do not lower the retry contract or increase its budget.

- **L-RES-02 (minor)**, [test/sync-atoms.test.ts](../../../../../apps/professional-desktop/test/sync-atoms.test.ts), lines 62–83. Both raw registry instances (62/101) are tail-disposed after state waits and assertions (83/121). A failed wait can leave mounted command fibers blocked on unreleased Deferred values. Guarantee registry disposal from acquisition, preserving real detached clock context, workspace isolation, exact call ordering and typed failure assertions; cleanup must also run on interruption.

- **L-FLAKE-04 (minor)**, [test/sync-retry.test.tsx](../../../../../apps/professional-desktop/test/sync-retry.test.tsx), lines 15–32. The test supplies no failing client/protocol and assumes the default sidecar request fails. DesktopSyncClient resolves chatProtocolLayerAtom to HttpChatProtocolLive with FetchHttpClient and an origin-dependent URL; a reachable successful responder or slow request changes retry visibility within4s. Supply a controlled failing public client/protocol for this UI failure-state case, retaining Retry text and existing bound. Keep real transport subjects in their dedicated integrations. No flakyTest or reproduced external outage is claimed.

- **L-RES-02 (minor)**, [test/tauri-ipc-socket.test.ts](../../../../../apps/professional-desktop/test/tauri-ipc-socket.test.ts), lines 133–141. Scope.make creates an independently closeable reader scope; no parent finalizer closes it if socket.reader acquisition or the line135 assertion fails before explicit close138. Attach guaranteed close immediately or use an existing parent-owned child scope, while retaining the intentional early close, suspended pull join, SocketCloseError reason and exactly2 unlisten assertions. This is not permission to remove the shorter scope.

- **L-PROP-04 (minor)**, [test/viewer-encoding.test.tsx](../../../../../apps/professional-desktop/test/viewer-encoding.test.tsx), lines 26–41. Comparing all stringify calls after rerenders with the first-render total does not prove the state was encoded only once: unrelated initial Lexical calls can make three repeat encodes smaller than afterFirst. Observe encoding attributable to this document/state with a positive initial witness and zero additional subject encodes across the three same-state rerenders, preserving the current count assertion and actual EditorViewer. No timing assertion or private-helper export is needed.

## Timing and historical limits

The retained default Node cohort passed 238 registrations across 46 reporter files. Whole-command duration was 15.619104318 seconds; reporter interval was 15097.419921875 milliseconds. These intervals overlap and must not be added. Eleven integration test files are excluded from that default cohort; they are neither execution-proven nor reported skipped. The two support files have no independent registration timing. No tests, benchmarks, native integrations or providers were run by the source audit.

Runtime controls remain Node 22.22.3, Bun 1.4.2 and Vitest 4.1.11 with Effect and its adapter pinned to rc.113. The adapter declares a Vitest 5 peer range; the existing compatibility qualification remains. Host load context is retained without numerical adjustment. Passing registrations do not prove race freedom, full coverage, native Tauri/stdio/SQL execution or real provider availability.

Hosted history contains 23 coverage-ratchet observations across eight jobs for this package. These are not 23 failed tests or unique flakes. The campaign retains all 139 timing attempts, including four configured subsets and three failures, and all 527 frozen failed-run records with their unavailable-log and unresolved-cause qualifications.

## Counts and highest-review files

| Lens | Review proposals | Coverage-only | Total |
| --- | ---: | ---: | ---: |
| resource | 13 | 46 | 59 |
| flake | 5 | 54 | 59 |
| property | 6 | 53 | 59 |
| observability | 1 | 58 | 59 |

| File | Review proposals |
| --- | ---: |
| `apps/professional-desktop/test/composer-dispatch-confirm.test.ts` | 2 |
| `apps/professional-desktop/test/dock-shell.test.tsx` | 2 |
| `apps/professional-desktop/test/editor-contract-hardening.test.tsx` | 2 |
| `apps/professional-desktop/test/integration/sidecar-ipc-stdio.test.ts` | 2 |
| `apps/professional-desktop/test/browser-failure-atoms.test.ts` | 1 |
| `apps/professional-desktop/test/chat-contract.test.ts` | 1 |
| `apps/professional-desktop/test/chat-ui.test.tsx` | 1 |
| `apps/professional-desktop/test/composer-atom-lifetime.test.ts` | 1 |
| `apps/professional-desktop/test/composer-send-lifetime.test.tsx` | 1 |
| `apps/professional-desktop/test/fps-atoms.test.ts` | 1 |

## P2 order and acceptance

After Benjamin acknowledges the complete P1 inventory and Grok review: scope, assertions, property, flake, then observability. Preserve all current assertions, operands, polarity, property floors, seeds, timeout contracts and native subjects. Strengthen positive witnesses for eviction, refresh, reload and document encoding; control only the UI retry test's failure input. Source-derived risks remain open proposals, not reproduced failures or approved exceptions.

Root fully reviewed all three reports and digests, verified their artifact/source hashes and complete read receipts, and validated the exact whole-package union through the public strict decoder. All 59 files have all four lenses and no package pairs are missing. This accepts the P1 source inventory only. Full campaign completeness, independent Grok review and Benjamin's acknowledgement remain required before P2.

Evidence: [resource rows](../resource/beep_professional-desktop.jsonl), [flake rows](../flake/beep_professional-desktop.jsonl), [property rows](../property/beep_professional-desktop.jsonl), [observability rows](../observability/beep_professional-desktop.jsonl), [timing index](../timings/baseline-index.json), [configured subsets](../timings/configured-subsets.json), and [hosted history](../hosted-history-summary.json).
