# @beep/pretext — four-lens P1 source digest

| Lens | Rows |
|---|---:|
| resource | 4 |
| flake | 4 |
| property | 4 |
| observability | 4 |

4 files; 2 review items and 14 coverage rows. Severity counts: info 14, minor 2.


## Highest-count files and full-read coverage

- `packages/drivers/pretext/test/Pretext.equivalence.test.ts`: 4 rows; test; fully read 1–25; 992 bytes; SHA256 `a5a7595981ac899de5b2c9a895c1c883e8fa0339cf006ca0a1c4a5465707921e`. All four lenses covered.
- `packages/drivers/pretext/test/Pretext.models.test.ts`: 4 rows; test; fully read 1–232; 7609 bytes; SHA256 `69bcc0a2b08248ba147dc3ab0ec12bd0729614bc9a9ce699c5f3d2a86ee38d5c`. All four lenses covered.
- `packages/drivers/pretext/test/PretextCapture.test-layer.test.ts`: 4 rows; test; fully read 1–83; 2782 bytes; SHA256 `eac94514a22599ed5511c13abc31464c1df871e665e0906d2202c0d795f5bf4e`. All four lenses covered.
- `packages/drivers/pretext/test/browser.test.ts`: 4 rows; test; fully read 1–77; 2615 bytes; SHA256 `0e389b2ab26255f99a88235b92be74dc09b8621d5cf4d261715ef2d25938d02a`. All four lenses covered.

## Layer topology and native boundaries

Pretext.models.test.ts repeatedly decodes the in-memory Chrome/Arial snapshot; it never measures live text. PretextCaptureFixture is Layer.effect over that decode (PretextCapture.test-layer.ts:180–185), while makePretextCaptureFixture returns a pure Layer.succeed (151–157). The four default-fixture provider calls are already EV002 candidates; preserve the canned fixture and typed font/word errors during D14 restructuring. The decoded snapshot and method own no external cleanup; any speed benefit from sharing remains unmeasured.

PretextCaptureLive is a pure Layer.succeed (browser.ts:188–191), so acquisition must not be conflated with the impure capture method. Calls probe Intl.Segmenter/canvas, measure sequentially and read DateTime.now (138–172). Native DOM/canvas behavior is the actual subject of the live branch, so neither MemoryFileSystem nor a canned metric replacement proves it. Node baseline represents all four files, but one live capture registration was skipped. The unguarded non-browser profile expectation would disagree with Chromium/Safari profile detection; this is a source-derived runtime portability issue, not a reproduced timing flake.

The fixture provenance test promises more than sentence presence establishes. Compare exact returned captured provenance to the existing canned fixture while retaining the original presence assertion. Layout oracle checks and the independent lineCount versus lineRanges-based lineStats implementation remain intact; no generic generated replacement is proposed for the measured DOM oracle.

## Detailed judgment findings

- **L-FLAKE-04 / minor / runtime-engine-fence**, `packages/drivers/pretext/test/browser.test.ts:7–20`: The unguarded non-browser profile assertion expects carryCJKAfterClosingQuote=false; detectEngineProfile returns true for Chromium. Keep all five non-browser expected values in an explicitly controlled non-browser profile case, and retain the real browser capture scenario with runtime-appropriate profile expectations. Production browser.ts:64-86 returns Chromium/Safari-specific values. Do not delete assertions or add skips as a repair. Current Node timing is green; browser mismatch is source-derived and not executed here.
- **L-PROP-04 / minor / presence-is-not-provenance**, `packages/drivers/pretext/test/PretextCapture.test-layer.test.ts:68–81`: The fixture provenance case only asserts O.isSome(snapshot.metrics.sentence), so unrelated sentence or provenance values can pass. Retain sentence presence, then compare exact sentence and captured provenance fields against the decoded canned fixture. Production fixtureCaptureFontMetrics copies snapshot.metrics; assert that public contract without deriving the expected result from the returned snapshot. This strengthens a stated invariant without changing existing operands or fixtures.

## Retained timing and failure evidence

Node JSON reporter total: 4877.369140625 ms; whole command: 5.215973980999934 seconds; registrations: 25; reported statuses: {"passed": 24, "skipped": 1}. All 4 census files are represented. These are frozen first-attempt measurements at main 662823dd960367046ba7d73dd8fd25d15782865a, Node 22.22.3/Bun 1.4.2/Vitest 4.1.11. No tests were rerun. File representation does not establish execution of skipped cases, property floors, coverage or full package acceptance.

Hosted history maps 3 observations across 1 jobs; categories {"coverage-ratchet": 3}. These observations are not unique flakes. Zero mapped observations does not prove no failures.
- https://github.com/beep-effect/beep-effect/actions/runs/32719153529/job/97406665477 — 2026-08-24T10:54:45Z, head `87d3479f21f440c32582ce2e67093bdad4fb9569`.

Every mapped observation here is a coverage-ratchet report about production paths, not a failed test assertion. Exact historical excerpts, source paths and line references are retained in the hosted history summary; no comparison proves those historical sources equal current source.

## P2 ordering and uncertainty

Scope first: preserve the native subjects and resolve provider candidates using constructor evidence. Then migrate assertion families without losing payload, polarity or diagnostics; retain plain-value expectations. Next preserve all property operands, minima and seeds while addressing this digest's property residue. Then address the concrete environment assumptions without retries or timeout changes. Last adopt the accepted instrumented public runner while retaining names, modes, TestEnv and sanitized error policy. Foundation/modeling work ships separately under D13. No P2 execution is authorized here.

The frozen corpus has 139 terminal attempts: 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d's excluded browser file was neither executed nor reported skipped. The effect-drizzle Bun.sqlite Node collection boundary is unchanged and not repaired by a different driver here. Hosted scope covers 527 failed runs, with 21 unavailable logs and one unresolved downloaded cause; older attempts, deleted and cancelled runs remain outside that scope. No flakyTest proposal is made. Installed rc113 retains the Vitest 5 peer declaration while this evidence uses Vitest 4.1.11; acceptance remains Root's decision.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
