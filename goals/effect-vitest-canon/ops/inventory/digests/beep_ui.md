# @beep/ui — P1 four-lens source audit

Root-reviewed P1 inventory; P2 remains gated.

Ten complete census test files, 609 lines, 25122 bytes: 40 open judgment rows, four review items and 36 coverage-only rows. Resource/flake/property/observability each have 10 rows; actions are three property and one observability. Severity: 36 info, three minor, one major. No exceptions or fabricated fixSha.

Top files (all tie at four rows; source order):

- `packages/foundation/ui-system/ui/test/AdapterEffectDateTime.test.ts`: four rows, 1 review items; read lines 1–83.
- `packages/foundation/ui-system/ui/test/FormWidgets.test.ts`: four rows, 0 review items; read lines 1–24.
- `packages/foundation/ui-system/ui/test/ReactInvariant.equivalence.test.ts`: four rows, 0 review items; read lines 1–16.
- `packages/foundation/ui-system/ui/test/VerifiedSourceTextViewer.test.tsx`: four rows, 1 review items; read lines 1–50.
- `packages/foundation/ui-system/ui/test/hooks.test.ts`: four rows, 0 review items; read lines 1–65.
- `packages/foundation/ui-system/ui/test/schema-parity.test.ts`: four rows, 2 review items; read lines 1–146.
- `packages/foundation/ui-system/ui/test/theme-components.test.ts`: four rows, 0 review items; read lines 1–60.
- `packages/foundation/ui-system/ui/test/theme-provider.test.ts`: four rows, 0 review items; read lines 1–21.
- `packages/foundation/ui-system/ui/test/ui.test.ts`: four rows, 0 review items; read lines 1–105.
- `packages/foundation/ui-system/ui/test/url.test.ts`: four rows, 0 review items; read lines 1–39.

Topology and subjects: there are no acquired Effect Layers or native resource fixtures in these files. DateTime adapter and theme fixtures are shared read-only values; helpers are called directly. SSR uses renderToStaticMarkup and does not mount hooks, execute callback refs or demonstrate scrollIntoView, media-query, keyboard/wheel or animation behavior. Browser/DOM subjects must not be replaced by TestClock or MemoryFS. No layer rebuild cost or possible speedup was measured. Literal URLs are sanitizer input, not requests.

Review items: (1) timezone-token tests do not assert epoch preservation across seasonal instants; (2) UTF-16 interval rendering needs exact-touching/empty-boundary generated controls alongside the existing emoji and spanning-page cases; (3) SpinParams accepts precision 101 but numberToString/blur formatting pass it to toFixed, so codec round-trip success is insufficient for the consumer boundary; (4) schema-parity throws assertions inside direct native checkEffect and then discards all result data except _tag, bypassing the adapter normalization/formatter. Precision 101 is a source-derived counterexample, not an executed reproduction. Root must decide the production contract; do not filter generated values or weaken assertions. Preserve seven schema laws, ToastData normalization, encoded invariant-error equality and fcRuns(50).

No generic runner or scope migration is added as a human finding: six mechanical candidates remain open (EV001, EV006, EV007 and three EV011). Plain Option projections in helper assertions must retain their actual payloads. Theme conditional branches are preceded by throwing defined/function assertions; they are not silent skips. URL over-nested decoding and invalid numeric-reference pass-through are deliberate current controls, not waived vulnerabilities or universal browser-safety proof.

Completed Root baseline: accepted-node-command-baseline, 47 passed registered tests, zero failed in that attempt, 4.922307827 seconds whole command; reporter span 4546.906982 ms. Command from package cwd: `bunx vitest run --reporter=json --outputFile=<absolute private report>`. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. All ten assigned test files appear in the retained baseline. No rerun, new browser evidence, coverage or package proof is claimed. The campaign completed 139 first attempts: 132 accepted full-file-representation baselines, four configured subsets and three failures.

Hosted evidence: 4 coverage-ratchet observations in 2 historical jobs; production paths and metrics are retained in the hosted history evidence. These are not four failing tests or unique flakes. Global 527 failed-run evidence retains 21 unavailable relevant logs and one unresolved cause. No current-source causal attribution or absence-of-rare-failure claim follows from the passing baseline or missing logs.

Proposed P2 sequence: scope → assertions → property → flake → observability. Keep current pure/SSR boundaries during scope review; preserve every original operand/polarity and native subject in assertion work; then address the concrete precision and property-domain gaps with explicit floors; review only evidenced nondeterminism; adopt the accepted instrumentation/normalization seam last. P2 remains gated on Benjamin acknowledgement and Root acceptance. The 90 inherited-main ratchet additions remain untouched.

Pin: Effect/adapter rc113 d3b837aee836f35d625d55205f7d6e61305fc198. Vitest 4.1.11 provenance does not claim to satisfy rc113's Vitest 5 peer declaration. Exact source, schema, decoder, graph and current PLAN hashes accompany strict decoder receipts. Root has accepted these package rows.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
