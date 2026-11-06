# Yeet inbox unchanged-state writes, 2026-11-06

The inbox hook rewrote its session file on every invocation without a live P0,
even when `incidentId` was already null. The change skips that write when the
serialized state is unchanged. It still reads the inbox, acknowledgements,
waiver expiries and dispatch state on every invocation, and keeps the existing
mutex and tool matching.

A real incident reset still writes immediately. P1 delivery still records its
seen IDs and first-seen stamps through the existing `mark_seen` operation. P0
handling is unchanged. An empty session may now have no state file until it has
bookkeeping to persist; the hook's existing default state and the CLI's
first-seen reader already support absent session files.

## Controlled measurements

The baseline came from main commit `1d21c0e0071acc0fa3693208b77ec9b8587b0854`.
Its hook SHA-256 was
`24859fd17bdcccf27ea0dc2c69b89cfed619d9b63d781afd8d4adcc084db15b0`.
A private candidate changed only the unchanged-state write condition.

Each row below contains 200 real Bash hook invocations per version. The order
alternated between baseline-first and candidate-first. Fixtures lived under a
private cache directory and used `BEEP_YEET_HOOK_ROOT`; no live inbox or hook
configuration changed. Samples include process launch, parsing, state handling
and captured output, after one warm-up call per fixture.
They exclude agent dispatch overhead, the separate hook-pulse command and
cross-checkout Git root discovery.

| State | Baseline median | Candidate median | Baseline p95 | Candidate p95 |
| --- | ---: | ---: | ---: | ---: |
| No failure files | 20.87 ms | 17.95 ms | 24.43 ms | 21.83 ms |
| Empty failure file | 22.26 ms | 19.28 ms | 24.06 ms | 21.50 ms |
| Empty active file with version marker and dispatch | 25.42 ms | 22.46 ms | 28.42 ms | 24.68 ms |
| Live P0 | 26.90 ms | 26.82 ms | 29.74 ms | 30.15 ms |
| Already-seen P1 | 23.06 ms | 21.51 ms | 27.25 ms | 25.51 ms |

No invocation exceeded the two-second budget in these 2,000 timing samples.
The candidate saved about three milliseconds on the measured clear paths.
These are controlled local measurements, not a production timeout-rate estimate
or a net CI saving. Historical timeout counts from the earlier review were not
independently verified and are not evidence for this change.

A separate controlled mutex-holder test took about 1.03 seconds per call in
both versions. Both delivered P0 context at PreToolUse and blocked Stop despite
the busy bookkeeping mutex. The change does not remove that bounded lock wait.

## Behavior proof and limits

The existing adapter suite passed 13 tests on the baseline. The changed hook's
suite passes 14 tests, including a regression that clears a real incident,
delivers P1 context, and verifies that later clear PreToolUse and Stop events
preserve the session file's inode, modification time and contents. A P0 appended
afterward appears on the next read-only tool call, retains previous first-seen
stamps and seen IDs, and re-arms the first mutating-tool reminder.

Private lifecycle controls passed for both versions. They covered immediate P1
delivery and deduplication, P0 arrival after a clear result, repeated P0 context,
Stop blocking, acknowledgement cleanup, new-P0 re-arming, and waiver expiry
without any input-file modification. That last control is a reason to avoid an
input fingerprint cache: unchanged files do not imply unchanged acknowledgement
liveness. Narrowing the tool matcher would also delay P1 context currently
available on read-only tool calls.

Only the unchanged write is removed. Input caching, absent-input shortcuts,
mutex changes and matcher changes remain outside this patch. Reversal restores
the unconditional `write_state` call after clearing `incidentId`.

## Owning-package validation

The focused adapter suite passed all 14 tests. Quick package verification passed
lint in 1.6 seconds and type checks in 11.0 seconds. Scoped Fallow audit of the
adapter test reported a passing verdict with zero dead-code, complexity or
duplication findings. The scoped Effect-Vitest detector produced exactly the
same single informational EV010 finding as the HEAD version of the file, with
no introduced finding. Its platform-service provenance note applies to the
existing real-subprocess fixture; the hook reads native fixture files.

The parent owns the combined full package audit for this shared lane. These
scoped results do not substitute for that audit or hosted verification.
