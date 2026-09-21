# @beep/qa-capture — P1 source-only digest

Root-reviewed P1 source inventory; P2 remains gated.

9 complete files, 36 rows: 10 review / 26 coverage.

| Lens | Rows |
| --- | ---: |
| resource | 9 |
| flake | 9 |
| property | 9 |
| observability | 9 |

Severity: 26 info, 10 minor.

 Mechanical candidates remain separate open evidence.

Top files (all files, at most ten; descending review count):

- `packages/tooling/library/qa-capture/test/Collector.test.ts`: 2 reviews; full lines 1–243.
- `packages/tooling/library/qa-capture/test/ExtractionPlanner.test.ts`: 2 reviews; full lines 1–393.
- `packages/tooling/library/qa-capture/test/integration/ClockCorrelator.integration.test.ts`: 2 reviews; full lines 1–132.
- `packages/tooling/library/qa-capture/test/ClockCorrelator.test.ts`: 1 reviews; full lines 1–233.
- `packages/tooling/library/qa-capture/test/QaCapture.models.test.ts`: 1 reviews; full lines 1–135.
- `packages/tooling/library/qa-capture/test/SessionStore.test.ts`: 1 reviews; full lines 1–160.
- `packages/tooling/library/qa-capture/test/Witness.service.test.ts`: 1 reviews; full lines 1–37.
- `packages/tooling/library/qa-capture/test/ActionEvent.pointer-cancel.test.ts`: 0 reviews; full lines 1–36.
- `packages/tooling/library/qa-capture/test/QaCapture.equivalence.test.ts`: 0 reviews; full lines 1–39.

ClockCorrelator unit suites inject pure FFmpeg layers and fixed luminance samples; actual decoding is separately exercised by the live ffmpeg integration. Collector builds native Bun HTTP over loopback with FetchHttpClient and real files, with per-serve Queue/Ref/Deferred and joined drain finalizers. Its inner scopes deliberately close before disk/successor assertions. SessionStore manipulates native disk layout and protects collector-owned events/legacy manifests. Their temporary test roots lack failure-path cleanup. Witness.layer caches native Bun.build output once per layer via Effect.cached; layerScript is a pure substitute for consumer tests, not proof of compilation. Repeated layer builds exist, but no isolated rebuild-cost measurement supports a speedup claim. Native HTTP/process/files/compiler subjects must survive P2; MemoryFS alone cannot prove them.

Review proposals:

- `L-PROP-04` `ClockCorrelator.test.ts:87`: The luminance stub returns fixed samples regardless of the requested clip path or region, and all flip fixtures use zero paint jitter. A wrong probe source/region or lost delayed-start offset could still satisfy these cases. Add captured request expectations and a delayed first-paint fixture with samples relative to the requested clip, preserving the eight flips and existing fit/fallback tolerances. Production derives the clip from first/last paint times and probes clip.outPath at the configured top-left region.
- `L-RES-02` `Collector.test.ts:46`: All three temporary roots use makeTempDirectory and are removed only at the successful end of the body (lines 125,174,239). Any HTTP, PID-fixture or assertion failure bypasses cleanup. Give each root test-owned scoped cleanup while keeping the inner collector close before post-close disk assertions. Preserve actual Bun HTTP, ephemeral ports, native PID ownership and real file-drain/handle behavior; MemoryFS alone is not equivalent to this integration subject.
- `L-PROP-04` `Collector.test.ts:67`: The canonical sequencing test submits already-monotone page seqs 1 and 2, then expects 1,2,3. An implementation preserving submitted seqs would satisfy it. Add a second page-like batch with repeated/out-of-order source seqs and assert exact server-owned disk seqs while preserving payload order, rejected-count semantics and the server mark. Production canonicalSeqRef rewrites every accepted event; retain the current three-event test as well.
- `L-PROP-04` `ExtractionPlanner.test.ts:330`: GIF constraints are inside forEach over filtered requests with no nonempty/count assertion. Returning zero GIF requests would satisfy these checks even for the retained drag fixture. Assert the expected eligible GIF request count/identity before iterating, including the past-end guard case where applicable, then keep every duration/start/end bound and contact-sheet/frame assertion. Do not loosen the endpoint guard or invent requests for windows without GIFs.
- `L-OBS-01` `ExtractionPlanner.test.ts:211`: Four generated merge/budget laws run direct checkEffect with throwing assertions and only inspect Passed. Use adapter property diagnostics while retaining all four laws, exact merge-gap/conservation/budget operands and each fcRuns(50). Add the law name to failure context; do not replace substantive conservation checks with schema acceptance.
- `L-OBS-01` `QaCapture.models.test.ts:53`: The common helper collapses native property output to Passed for many schemas and throws codec/assertion failures inside the callback. Preserve full Equal comparisons and fcRuns(25), but register identifiable schema cases through the pinned property adapter so counterexamples/replay and the failed schema remain visible. Do not weaken the printable-key rejection or omit union variants.
- `L-RES-02` `SessionStore.test.ts:41`: All five tests allocate temporary roots without scoped release (lines 41,59,77,111,127), then remove them only after successful assertions. Use test-owned scoped temporary cleanup on every exit, retaining real disk layout, round discovery and post-operation reads. Keep collector-owned events and legacy manifests untouched when reusing a round; do not turn this native storage regression into an unrelated fake-only assertion.
- `L-PROP-04` `Witness.service.test.ts:26`: Equal text from two script requests does not establish that compilation was cached: two deterministic builds can return identical bytes. Add a scoped build-call observation at an appropriate injectable seam to prove one build per owning layer, while retaining the real IIFE compile and pointercancel/events string assertions. Do not monkeypatch a global compiler across concurrent tests or replace this native compile test solely with the fixed-script double.
- `L-RES-02` `ClockCorrelator.integration.test.ts:105`: The real ffmpeg test removes its temporary video directory only after all encoding/correlation assertions pass. Use a test-owned scoped directory so failed encoding or fit assertions also release it. Preserve the real process, binary-generated h264 video and live clock boundary; do not replace this with MemoryFS or synthetic samples. runTool already scopes child handles and waits for exit.
- `L-OBS-03` `ClockCorrelator.integration.test.ts:99`: When ffmpeg is unavailable, the test logs and returns without assertions, yielding a passing registration rather than an explicit skipped/unexecuted integration result. Make that gate visible in the accepted runner outcome while preserving the real keyed-by-binary path and all correlation assertions. An aggregate pass cannot establish ffmpeg ran. Do not install a binary, convert native failures into skips or widen the gate to silence regressions.

Retained first-attempt Node cohort FAILED: exit1, 41 registered, 37 passed, four failed; 4.621820840 whole-command seconds. No accepted baseline/context exists for this package. Reporter SHA256 85dab95989718af7e7cf5f48d37cba4e8c4a20d4cd1e7201168411902e117222; log SHA256 2929f108dc86db64fdea0d054a1e9b037f470eca7555db9120edc5764bfb8ef3. Root attributes unchanged-source inherited shim gaps:

- Two collector tests: the Node Bun.serve shim omits hostname required by the native Bun HTTP adapter; reload is also absent.
- Stale-owner test fixture: the Node Bun.spawnSync shim omits the completed child PID, violating the existing required integer field before collector startup.
- Witness compilation: the Node shim omits fileURLToPath and build; entrypoint preparation fails before a native compiler failure is established.

All nine assigned sources were audited, but this does not convert failed test bodies into executed proof. The live ffmpeg case can log and return without assertions, so aggregate registration alone does not establish binary execution. Actual native build/server behavior is not proven by the failed Node attempt. No rerun, shim repair, exclusion or runtime substitution was performed.

Hosted evidence: 0 mapped observations in 0 jobs. Zero mapped observations does not establish absence of failures. Runtime Node22.22.3/Bun1.4.2/Vitest4.1.11. Campaign timing is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets, three failures. Hosted evidence has 527 failed runs, 21 unavailable logs and one unresolved cause. Observations are not unique flakes; production coverage paths are not named test failures. A passing attempt does not prove full package proof, coverage or absence of rare failures. No collection was rerun.

After separate P2 authorization: Scope test-owned temporary roots on every exit while preserving Collector close/drain before disk assertions. Strengthen exact probe/sequence/GIF/cache witnesses without removing originals; retain property budgets and report the optional ffmpeg gate accurately. Preserve actual native subjects and the failed Node baseline. Do not lower run floors, widen optional gates or rewrite inherited failure evidence.

Exact Effect/adapter rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198; graph100. Vitest4.1.11 is recorded runtime, not a supported-peer claim. Strict public decoding passed every row. Remaining uncertainty: native-runtime compatibility proof, actual optional integration execution, runtime reproduction of risks and historical causal attribution. Root alone accepts and assembles canonical inventory.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
