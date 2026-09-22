# @beep/editor — P1 source audit

Root-reviewed P1 source inventory; P2 remains gated.

19 complete files; 76 rows: 13 review proposals and 63 coverage rows.

| Lens | Rows |
| --- | ---: |
| resource | 19 |
| flake | 19 |
| property | 19 |
| observability | 19 |

Severity: 63 info, 13 minor.

 All rows are open judgments.

Top ten files by review count:

- `packages/foundation/ui-system/editor/test/capability-runtime.test.tsx`: 2 review rows; full lines 1–166.
- `packages/foundation/ui-system/editor/test/capability-schemas.test.ts`: 2 review rows; full lines 1–174.
- `packages/foundation/ui-system/editor/test/chat-schema-parity.test.ts`: 2 review rows; full lines 1–184.
- `packages/foundation/ui-system/editor/test/editor-nodes.test.ts`: 2 review rows; full lines 1–363.
- `packages/foundation/ui-system/editor/test/capability-errors.test.ts`: 1 review rows; full lines 1–70.
- `packages/foundation/ui-system/editor/test/capability-projection.test.ts`: 1 review rows; full lines 1–44.
- `packages/foundation/ui-system/editor/test/code-fence.test.ts`: 1 review rows; full lines 1–164.
- `packages/foundation/ui-system/editor/test/mermaid-race.test.tsx`: 1 review rows; full lines 1–849.
- `packages/foundation/ui-system/editor/test/typeahead-ids.test.ts`: 1 review rows; full lines 1–43.
- `packages/foundation/ui-system/editor/test/TaggedErrors.equivalence.test.ts`: 0 review rows; full lines 1–74.

Most files exercise pure schemas, codecs, capability resolution or fresh headless Lexical editors. The mounted CapabilityComposer uses React cleanup and serial suites; the code-fence helper owns AtomRegistry mount and command registration whose cleanup currently follows assertions. Production sendKeyBindingAtom registers a finalizer. Mermaid production uses Atom.runtime(Layer.empty) and an atom family keyed by render ID/source; tests replace the renderer with controlled promises while retaining DOM sanitizer behavior. There is no measured layer-rebuild speedup to claim. Bun.file reads the authored capability atlas as the actual catalog subject. MemoryFS cannot replace that artifact boundary, Lexical selection, DOM sanitization or real command binding evidence. Detached YouTube sandbox/import checks do not establish outbound YouTube execution. The style matrix preserves 11 contexts times 32 masks (352 cases), full wire fixed points and exact formatting masks.

Review proposals:

- **L-PROP-04** `capability-errors.test.ts:46` (minor, confidence 0.95): The every-error-names-identifiers test checks message length for all eight errors but identifier content only for a subset. A long generic DependencyCycle/CapabilityConflict/DevelopmentOnly message can pass. Add case-specific required profile/capability/cycle/conflict identifiers while preserving all eight cases and existing targeted messages. This strengthens the test claim without inventing new public error fields.
- **L-PROP-04** `capability-projection.test.ts:28` (minor, confidence 0.95): Toolbar and slash assertions only prove every returned ID belongs to resolved commands; empty arrays pass. Assert exact surface-filtered IDs/order and relevant labels, and exercise a slash callback against a local recorder for its command ID. Preserve the help count and platform chord strings. Production projectCommands filters command.surfaces and projectSlashItems maps the slash-menu subset; do not require every command on every surface.
- **L-PROP-04** `capability-runtime.test.tsx:149` (minor, confidence 0.95): The guards-underline/allows-bold case only asserts O.exists(latest, underlineBit) is false; it passes when latest is None and never proves bold was applied. Establish a real selection and committed observed state, assert its presence, verify bold is set and underline absent, retaining both defaultPrevented checks. Likewise toolbar click currently only proves an editor remains mounted. Preserve the original content, modifier operands and disallowed format; do not replace them with a mere callback count.
- **L-OBS-03** `capability-runtime.test.tsx:155` (minor, confidence 0.95): The test named remount transaction only converts Document to state and back twice; no CapabilityComposer unmount/remount occurs. Either accurately label it codec round-trip coverage or add a separately authorized real remount assertion preserving canonical content. Retain the existing round-trip law and do not report it as mounted lifecycle proof.
- **L-PROP-03** `capability-schemas.test.ts:162` (minor, confidence 0.95): The two generated schema laws pass raw { runs: 25 } and omit the shared environment floor/replay seed. Preserve at least 25 trials and full Equal encode/decode law while using fcRuns options. Keep duplicate IDs/commands/registrations and malformed-chord negatives unchanged.
- **L-OBS-01** `capability-schemas.test.ts:159` (minor, confidence 0.95): The helper reduces native checkEffect output to Passed, losing structured counterexample/replay context; synchronous codecs can throw inside the callback. Use pinned adapter diagnostics with identifiable schema cases while retaining both generated laws and 25-run floor. This is failure-context evidence beyond EV007 syntax.
- **L-PROP-03** `chat-schema-parity.test.ts:86` (minor, confidence 0.95): All four native chat schema checks omit CheckOptions entirely. Preserve the pinned native default run floor (100) and apply shared fcRuns floor/seed options rather than silently adopting a lower budget. Preserve schema-declared equivalence, all four schemas and exact duplicate-field-path negatives.
- **L-OBS-01** `chat-schema-parity.test.ts:86` (minor, confidence 0.95): Direct native checks throw expect/codec failures and then assert only Passed. Register the four laws through pinned adapter formatting so counterexample/replay and schema identity survive. Preserve the existing declared equivalence rather than raw Equal, the full encoded wire cases and current run floors.
- **L-RES-02** `code-fence.test.ts:39` (minor, confidence 0.95): pressEnter creates an AtomRegistry, mounts a production binding and registers a command, but unregister/unmount run only after a successful update. Use guaranteed teardown on every exit and dispose the owned registry through its actual public API. Preserve the real sendKeyBindingAtom and discrete Lexical update; production get.addFinalizer owns the key binding, so teardown is behaviorally meaningful. Do not replace the subject with a fake command handler.
- **L-PROP-03** `editor-nodes.test.ts:98` (minor, confidence 0.95): The schema-derived real Lexical admission property uses raw runs:25 without shared floor/seed handling. Retain at least 25 generated states, actual parse/set/export operations and strict decoded success, then apply fcRuns. Preserve hostile NodeState, inert malformed decorators, DOM import and sandbox/fallback assertions; validity is the stated admission law, not automatically full semantic equality.
- **L-OBS-01** `editor-nodes.test.ts:88` (minor, confidence 0.95): Native admission checks throw editor/codec/assertion failures inside checkEffect and inspect only Passed. Use pinned property failure formatting while keeping the actual Lexical runtime and 25-run floor. The separate fixture conversion runSync is not independently a lost-property-diagnostic finding.
- **L-FLAKE-02** `mermaid-race.test.tsx:96` (minor, confidence 0.95): After resolving the obsolete render, waitFor checks that the second diagram is still present, a condition already true before that resolution. It may succeed before the obsolete asynchronous continuation has been processed. Await an explicit completion/settlement boundary (using the actual React/Atom promise lifecycle) before the negative overwrite check, and similarly strengthen post-unmount settlement beyond a generic yield. Preserve current-before-obsolete order, same-prefix/length inputs and every DOM assertion; no sleeps, retries or wider timeouts. The historical timeout/assertion observations do not establish this as their cause.
- **L-PROP-04** `typeahead-ids.test.ts:32` (minor, confidence 0.95): Option IDs are tested only for inequality across editors/indexes; a function issuing a fresh ID on every call would pass. Add same-editor/same-index stability and curried/data-first parity while preserving all existing collision negatives and menu-ID stability. Production derives the ID from editor.getKey and index; do not pin the actual generated editor key.

Retained Root baseline: 447 registered, zero failed, exit 0, 11.972097264 whole-command seconds. All 19 assigned files are represented. Reporter SHA256 0f8579540bb29821219c7e8d94bb632162deeb93333777e08f14f102ad7ba501. This lane performed source review and finding-data decoding only; it did not execute those tests. Runtime Node22.22.3/Bun1.4.2/Vitest4.1.11. Recorded Vitest version is not a supported-peer claim.

Editor has 11 historical observations in six jobs: nine coverage-ratchet observations, one timeout and one assertion failure. The two named failures concern “Mermaid async ownership > keeps same-page diagrams with identical internal IDs isolated”: August 24, Test timed out in 30000ms ([job](https://github.com/beep-effect/beep-effect/actions/runs/32676697075/job/97286043943)); August 26, expected false to be true ([job](https://github.com/beep-effect/beep-effect/actions/runs/32961202470/job/98153758021)). These historical heads differ from current source. Neither current reproduction nor a causal connection to the stale-render settlement proposal is established. The nine coverage observations concern package/Version/CodeBlock/Mermaid coverage floors, not nine test failures.

Timing collection is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failures. CIops, Effect Drizzle and QA Capture remain failed. Hosted evidence includes 527 failed runs, 21 unavailable logs and one unresolved cause. Observations are not unique flakes; production coverage paths are not named test failures. No collection was rerun. A passing attempt does not prove browser execution, production coverage, full package proof or absence of rare races.

Proposed P2 order remains scope → assertions → property → flake → observability. First guarantee test-owned registry teardown; then preserve original operands while strengthening presence, exact projection and stable-ID oracles. Preserve all fixed negative cases, 25/100 property floors and the 352-case style matrix. Review async settlement before interpreting negative DOM checks; retain controlled render ordering. Improve replay/schema diagnostics without inventing payloads, adding sleeps/retries, lowering floors or changing native subjects. P2 remains unauthorized.

Exact Effect/adapter rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198, 100-entry graph. Remaining uncertainty: runtime reproduction of proposed gaps, real-browser and external-renderer behavior, and historical causal attribution. Root owns canonical assembly and acceptance; the 90 inherited-main ratchet additions remain untouched.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. The pre-reboot validation was interrupted; fresh post-reboot validation passed. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
