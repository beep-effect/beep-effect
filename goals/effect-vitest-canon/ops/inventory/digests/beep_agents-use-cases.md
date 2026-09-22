# @beep/agents-use-cases P1 digest

### @beep/agents-use-cases

5 complete assigned census files; 20 rows, 3 minor review items and 17 info coverage rows. Every lens has 5 file rows.

Pure fixture kernel Layer.succeed; SDK and provider repository closures are recreated locally. Promotion Ref counter is test-local. No network, native provider or database execution. No isolated rebuild duration or speedup is established.

**packages/agents/use-cases/test/AssistantTurn.test.ts**

- resource: **L-RES-NONE**, lines 1–172, info. FixtureTurnKernel is a pure Layer.succeed with a Stream.fromIterable implementation; EV014 does not establish resource acquisition.
- flake: **L-FLAKE-NONE**, lines 1–172, info. Scripted blocks depend on explicit history, not timers or providers; fixture stream collection has no external scheduling dependency.
- property: **L-PROP-NONE**, lines 1–172, info. Four schema round trips use fcRuns(10); encoded shapes, null stopReason, exact block order and finalization usage are explicitly checked.
- observability: **L-OBS-01**, lines 77–98, minor. Four schemas share one round-trip registration and only assert the terminal Passed tag, losing schema identity and native failure context. Preserve all 4 schemas, encode/decode equivalence operands (including the existing Equal-or-schema-equivalence condition) and fcRuns(10). Give each schema identifiable native property registration/context so failures retain schema identity, replay and exhaustion information instead of only Passed. Preserve the existing total deadline and inherited timeout/concurrency contract; do not split work to grant extra budgets or reduce floors. Coordinate with EV001/EV007; no current failure is claimed.

**packages/agents/use-cases/test/Chat.test.ts**

- resource: **L-RES-NONE**, lines 1–71, info. RPC descriptors and hostile Markdown documents are schema values; no HTTP server or content renderer is started.
- flake: **L-FLAKE-NONE**, lines 1–71, info. Finite tag and stream-flag comparisons are synchronous and independent of suite order.
- property: **L-PROP-NONE**, lines 1–71, info. Six tags and both streaming polarities plus three hostile content classes are covered; preserve fail-fast missing-RPC guard and every rejected payload.
- observability: **L-OBS-NONE**, lines 1–71, info. Messages identify missing RPC tags and stream flags; unsafe content cases fail assertions rather than swallowing errors.

**packages/agents/use-cases/test/ProfessionalRuntime.test.ts**

- resource: **L-RES-NONE**, lines 1–356, info. Fixtures and SDK use deterministic in-memory generation and injected PromotionGate operations; no model, storage or provider is acquired.
- flake: **L-FLAKE-NONE**, lines 1–356, info. Sequential suite and 600000 ms property timeout are inherited and frozen; comments alone do not prove a current scheduler failure.
- property: **L-PROP-NONE**, lines 1–356, info. Promotion gates cover clear, blocked, revision advance and later trusted subjects, with exact two evaluations; fcRuns(10) remains explicit.
- observability: **L-OBS-01**, lines 328–349, minor. Five runtime schemas share one registration and Passed-only result assertions, so schema and native check diagnostics are not retained explicitly. Preserve all 5 schemas, encode/decode equivalence operands (including the existing Equal-or-schema-equivalence condition) and fcRuns(10). Give each schema identifiable native property registration/context so failures retain schema identity, replay and exhaustion information instead of only Passed. Preserve the existing total deadline and inherited timeout/concurrency contract; do not split work to grant extra budgets or reduce floors. Coordinate with EV001/EV007; no current failure is claimed.

**packages/agents/use-cases/test/ProviderInstance.test.ts**

- resource: **L-RES-NONE**, lines 1–165, info. Each case creates a private mutable repository closure and a pure probe stub; binary paths are data, not executed provider programs.
- flake: **L-FLAKE-NONE**, lines 1–165, info. Probe timestamps are fixed and stores are recreated per test; no authentication service or wall-clock race is involved.
- property: **L-PROP-04**, lines 66–101, minor. The add stub ignores its input and returns an already-present instance; the asserted id cannot detect incorrect command forwarding. Keep every CRUD assertion and current private repository state. Have the add stub observe the exact supplied command and assert it equals the intended command, including binaryPath, envVars, homePath, kind and label. The current id assertion passes even when the forwarded command is wrong. This is a test oracle gap, not proof of a production bug; never execute the provider paths or request authentication.
- observability: **L-OBS-NONE**, lines 1–165, info. Not-found probes die if invoked, logged-out paths retain guidance and saved snapshots; guard failure remains explicit.

**packages/agents/use-cases/test/TaggedError.equivalence.test.ts**

- resource: **L-RES-NONE**, lines 1–112, info. Eight error families are local schema values with no acquired resources.
- flake: **L-FLAKE-NONE**, lines 1–112, info. Independent equal and unequal values do not share mutable state or clocks.
- property: **L-PROP-NONE**, lines 1–112, info. Every error family retains positive and negative declared equivalence; differing guidance/reason/message fields are meaningful controls.
- observability: **L-OBS-NONE**, lines 1–112, info. Named error families and both assertion polarities provide direct diagnostic attribution; no additional tracing judgment is justified.

Retained timing: 33 passed registrations, reporter total 4493.1220703125 ms; whole command 4.872072327999831 seconds. This is the accepted configured Node baseline, not a new execution or package/coverage proof. Hosted history maps zero observations to this package; that is not proof of no failures.

P2 order: scope and subject boundaries, assertion oracles, property registration with all floors/deadlines preserved, cause-supported flake work, then observability. No flakyTest proposal is supported. Root has accepted these P1 inventory rows; P2 remains gated.


Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
