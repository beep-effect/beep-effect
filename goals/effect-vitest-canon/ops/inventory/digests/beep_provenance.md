# @beep/provenance — four-lens P1 source digest

| Lens | Rows |
|---|---:|
| resource | 3 |
| flake | 3 |
| property | 3 |
| observability | 3 |

3 files; 0 review items and 12 coverage rows. Severity counts: info 12.


## Highest-count files and full-read coverage

- `packages/foundation/modeling/provenance/test/TaggedError.equivalence.test.ts`: 4 rows; test; fully read 1–15; 695 bytes; SHA256 `af47ac561ad2c0ec87bc9bb5e7568dc162e5754b3c57958174646d223f5a9973`. All four lenses covered.
- `packages/foundation/modeling/provenance/test/TextAnchor.test.ts`: 4 rows; test; fully read 1–108; 4361 bytes; SHA256 `eacb90e09b05c681280e2422b282332f9c9b2be7f93f13970494e8a914eed2fe`. All four lenses covered.
- `packages/foundation/modeling/provenance/test/VerifiedTextAnchor.test.ts`: 4 rows; test; fully read 1–423; 17141 bytes; SHA256 `49daa6ddd8c8338ed8ed869b5eb55a104482df887a7b2c5a773c81c0ed624ec3`. All four lenses covered.

## Layer topology and native boundaries

TextAnchor and error-equivalence cases are pure. VerifiedTextAnchor tests provide BunCrypto per body, but installed BunCrypto is an alias of shared NodeCrypto.layer, a pure Layer.succeed. This explains successful Node execution without implying every Bun module is Node-compatible. No filesystem, process or database dependency exists in the assigned cohort.

The mutation test provides a local Crypto stub whose digest mutates the caller identity before its WebCrypto promise resolves (VerifiedTextAnchor.test.ts:80–116). Production snapshots identities before hashing (VerifiedTextAnchor.ts:576–602), and proof getters return fresh copies from WeakMap-backed authority (1–70, 180–216). The causal mutation ordering is intentional; do not replace it with sleeps or share that stub state across tests. Recovered-constructor and setter tests exercise the public proof boundary, not private map access.

Other digest failures use pure failing stubs and assert sanitized messages. Keep the fixed real SHA digest cases, UTF-16/surrogate distinctions, receipt-not-proof assertions, exact cross-scope/stale ordering, fcRuns(50) anchor laws and fcRuns(25) source-identity law. No resource rebuild savings or additional actionable judgment is established beyond the mechanical provider/assertion/property candidates.

## Detailed judgment findings

No additional actionable judgment beyond the retained mechanical candidates. File-specific coverage explanations are in each lens JSONL.

## Retained timing and failure evidence

Node JSON reporter total: 4744.132568359375 ms; whole command: 5.417264298000191 seconds; registrations: 22; reported statuses: {"passed": 22}. All 3 census files are represented. These are frozen first-attempt measurements at main 662823dd960367046ba7d73dd8fd25d15782865a, Node 22.22.3/Bun 1.4.2/Vitest 4.1.11. No tests were rerun. File representation does not establish execution of skipped cases, property floors, coverage or full package acceptance.

Hosted history maps 0 observations across 0 jobs; categories {}. These observations are not unique flakes. Zero mapped observations does not prove no failures.

## P2 ordering and uncertainty

Scope first: preserve the native subjects and resolve provider candidates using constructor evidence. Then migrate assertion families without losing payload, polarity or diagnostics; retain plain-value expectations. Next preserve all property operands, minima and seeds while addressing this digest's property residue. Then address the concrete environment assumptions without retries or timeout changes. Last adopt the accepted instrumented public runner while retaining names, modes, TestEnv and sanitized error policy. Foundation/modeling work ships separately under D13. No P2 execution is authorized here.

The frozen corpus has 139 terminal attempts: 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d's excluded browser file was neither executed nor reported skipped. The effect-drizzle Bun.sqlite Node collection boundary is unchanged and not repaired by a different driver here. Hosted scope covers 527 failed runs, with 21 unavailable logs and one unresolved downloaded cause; older attempts, deleted and cancelled runs remain outside that scope. No flakyTest proposal is made. Installed rc113 retains the Vitest 5 peer declaration while this evidence uses Vitest 4.1.11; acceptance remains Root's decision.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
