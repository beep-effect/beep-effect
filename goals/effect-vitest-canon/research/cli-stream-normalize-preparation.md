# Stream-status and Codex normalization preparation

Private drafts cover two existing-inventory files while the preceding full
CLI package proof runs. Package source is unchanged and no rows are closed.

Stream-status has 12 runtime boundaries and 11 terminal cwd wrappers/providers.
The draft uses the existing scoped cwd constructor, a serial public testLayer
fixture with a 30-second hook timeout, fresh consoles for all 12 callbacks,
and unchanged 30-second case options. The pure request-decoding case retains
the test clock. The other 11 callbacks reach PacketEventStore's native journal
locks; AdmissionJournal retries acquisition and ownership loss using
Effect.sleep. Those callbacks draft TestClock.withLive to preserve native
lock progress and real timestamps. Verify all 11 overrides after application.

Codex normalization has 11 runtime boundaries, including six assertion-only
Promise.then continuations and one callback with setup declarations followed
by a terminal return. The draft maps each continuation into the Effect without
changing its assertions or setup, retains existing Effect cases and plain
synchronous cases, and routes the tester through @beep/test-runner. It needs
no filesystem fixture or console provider.

The unchanged 36-case baseline passes under Node and Bun with stable source
and zero temporary residue. Observed whole-command times are Node 6.826 seconds
and Bun 3.170 seconds. Dedicated temporary roots, runtime versions, load and
pressure are retained; a concurrent package proof prevents a controlled
performance comparison.

Parsed assertion trees preserve 65 stream and 43 normalization assertions,
108 total with zero exclusions. Preview detection removes 23 runtime findings,
introduces none, and leaves the stream's native-platform judgment. Historical
line/evidence/title matching identifies all 23 runtime rows uniquely, with
none already absent. Re-run those mappings against final applied source.

After the active proof ends: apply hash-guarded drafts, format, run the same
36-case Node/Bun cohort, inspect actual type diagnostics, run root ratchet,
and exercise actual-suite failure/interruption cleanup, console isolation and
11 live-clock controls. The six Promise continuations must still fail their
cases if their assertions throw. Commit only after applied verification, then
run one grouped full package proof and reconcile historical lineage.

## Verification harness preparation

While scheduler package verification runs, private probe builders now produce
failure and interruption injections after all 11 cwd acquisitions, 12 distinct
console identity checks, and live-clock advancement probes for the 11 native
callbacks. A normalization assertion probe selects the six original Promise
continuations by their original test titles, avoiding five pre-existing Effect
assertion callbacks. All builder cardinality checks pass against the drafts.
The execution harness requires applied source and restores source bytes in a
finally block; each runtime gets an isolated temporary root checked for residue.
Applied-source assertion, detector and timing scripts are prepared as well.
These are harness preparation receipts, not executed migration proof.

## Current cwd constructor controls

The current `temporaryWorkingDirectory` initializer was extracted directly
from CommandTest.ts into a private control harness, without changing package
source. Node and Bun each pass success, body failure, interruption, and
injected cleanup failure. Every exit restores the original process cwd;
ordinary success/failure/interruption remove the temporary tree. Injecting a
removal defect makes the exit fail visibly, and the harness removes the
expected residue afterward. These eight controls establish the current helper's
behavior; actual migrated-suite scope ownership remains to be verified after
application with the prepared 11-callback probes.

## Applied follow-up

The prepared drafts are now applied and verified in source commit bd22fc4a50,
with five normalization pipe chains flattened. The synthetic scheduler's
remaining runtime boundary was migrated in the same batch to resolve the
schema-hoist fingerprint interaction without changing the baseline. See
cli-stream-normalize-runtime-proof.md for actual evidence and package-proof
status; this preparation record alone is not completion evidence.
