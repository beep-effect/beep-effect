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
