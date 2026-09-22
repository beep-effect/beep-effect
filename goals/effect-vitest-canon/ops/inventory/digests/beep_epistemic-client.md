# @beep/epistemic-client four-lens digest

2 files, 8 rows: 2 review and 6 coverage-only.

Pure protocol routing plus fresh AtomRegistry instances over in-process RpcTest/Reactivity layers. ReviewFailure/Success client construction belongs to each registry runtime; per-case captured Clock matters. Registry disposal currently follows assertions and two sync registries lack disposal. No browser, sidecar, HTTP or MemoryFS subject. Baseline atoms25.0916ms/12 cases and Protocol1.0486ms/5 cases are file spans, not isolated layer rebuild costs.

Retained command: 5.065645205000237s whole command; 4591.091552734375ms reporter span; 17 registered tests. All17 passed across2 files.

Hosted attribution: no mapped observations for this client package; this does not prove absence of failures.

## Review items

- `packages/epistemic/client/test/ContradictionTriage.atoms.test.ts:148–176` — major, L-RES-02: AtomRegistry.make creates a disposable runtime cache; installed rc113 AtomRegistry.ts156-170 registers dispose as a scope finalizer and686-688 resets nodes. This file disposes after assertions (and two sync cases never dispose). An assertion failure/interrupt can bypass registry and mount cleanup. In P2 register per-case cleanup immediately, preserve unmount-before-dispose and captured runtime/Clock, and retain fresh registry identity. Do not share one mutable registry across concurrent tests.

- `packages/epistemic/client/test/ContradictionTriage.atoms.test.ts:46–46` — major, L-FLAKE-02: settle repeats yieldNow four times; it does not witness a particular atom/request completion. Use public getResult with appropriate waiting semantics or exact request/state subscriptions, as sibling tests already do. Installed AtomRegistry.ts323-375 documents Initial/waiting handling. Preserve three temporal request pairs, expected failures, mounts and captured Clock; do not add sleeps or assume TestClock alone drives detached registry scheduling.

## Highest review-count files (at most ten)

- `packages/epistemic/client/test/ContradictionTriage.atoms.test.ts`: 2 review / 4 total rows.
- `packages/epistemic/client/test/Protocol.test.ts`: 0 review / 4 total rows.

## Full file/lens coverage

### packages/epistemic/client/test/ContradictionTriage.atoms.test.ts

- **resource** (L-RES-02): AtomRegistry.make creates a disposable runtime cache; installed rc113 AtomRegistry.ts156-170 registers dispose as a scope finalizer and686-688 resets nodes. This file disposes after assertions (and two sync cases never dispose). An assertion failure/interrupt can bypass registry and mount cleanup. In P2 register per-case cleanup immediately, preserve unmount-before-dispose and captured runtime/Clock, and retain fresh registry identity. Do not share one mutable registry across concurrent tests.
- **flake** (L-FLAKE-02): settle repeats yieldNow four times; it does not witness a particular atom/request completion. Use public getResult with appropriate waiting semantics or exact request/state subscriptions, as sibling tests already do. Installed AtomRegistry.ts323-375 documents Initial/waiting handling. Preserve three temporal request pairs, expected failures, mounts and captured Clock; do not add sleeps or assume TestClock alone drives detached registry scheduling.
- **property** (L-PROP-NONE): No additional change required by this lens: The real detail/source schemas are generated with fcRuns(25) and schema equivalence, alongside temporal-axis, selection and success/failure mutation examples. Preserve that floor, all request operands and the three distinct temporal queries. The final typed-failure case only proves AsyncResult failure, not every error field; no new full-Cause expectation is invented. EV001/EV007 already record runner syntax.
- **observability** (L-OBS-NONE): No additional change required by this lens: Named RPC mutation and temporal-axis cases capture actual in-process RpcTest requests. Preserve supplied TestClock capture and local registry identity during instrumentation; these are not browser or HTTP execution receipts. Existing failure-only assertions do not prove the precise transport error payload.

### packages/epistemic/client/test/Protocol.test.ts

- **resource** (L-RES-NONE): No additional change required by this lens: Protocol derivation takes a supplied location object or undefined. No browser, sidecar, HTTP client, filesystem or service layer is acquired.
- **flake** (L-FLAKE-NONE): No additional change required by this lens: Table-driven origin cases use fixed strings and synchronous calls; no clock, polling or shared mutable fixture.
- **property** (L-PROP-NONE): No additional change required by this lens: HTTPS same-origin, three Tauri-origin encodings and undefined runtime have exact URL expectations. This finite protocol routing table does not need a fabricated property or native sidecar test.
- **observability** (L-OBS-NONE): No additional change required by this lens: Each origin group has an explicit expected RPC URL. Plain string expectations remain legal; no Effect logging wrapper is needed for this pure routing test.

## P2 order and limits

After separate P2 authorization: Register registry cleanup immediately and preserve unmount-before-dispose, captured Clock and per-case identity. Replace repeated yields with observed atom/request completion. Preserve all temporal request pairs, failure assertions and fcRuns(25) schema laws. Retain original operands, polarity and diagnostics; do not lower floors or extend timeouts.

Source inventory only. No tests, databases, providers, credentials, benchmarks, Git or canonical writers ran. Passing retained timing is not coverage, compiler, package or race proof. Node22.22.3/Bun1.4.2/Vitest4.1.11 retained; rc113 declares Vitest5 peer range, with prior compatibility proof separate. Global139 attempts:132 full-file baselines,4 configured subsets,3 failures (CIops, Effect Drizzle, QA Capture). Hosted527 failed observations include21 unavailable logs and1 unresolved cause; observations are not unique flakes. All90 inherited-main detector additions untouched. P2 remains gated.

Root-reviewed P1 inventory; all findings remain open judgments.

Root accepted these P1 rows after full report/digest and source/artifact review, actual terminal validation and combined strict validation without input drift. Full P1 completeness, Grok review and Benjamin acknowledgement remain required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
