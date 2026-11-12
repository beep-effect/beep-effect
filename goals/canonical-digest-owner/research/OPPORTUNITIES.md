# Canonical digest owner: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-12: a saturated workstation makes `bun` look hung

- **Doing:** slice A, sampling an arbitrary with a one-file Bun script.
- **Evidence:** with the load average above 200 (another session's fan-out of
  about 96 shell workers), `bun -e 'console.log(1)'` took between 8 seconds
  and a 20-second timeout while using 0.01 s of CPU, and a single Vitest file
  with 8 s of CPU took 7.5 minutes of wall time. Nothing in the output says
  the host is the cause; it reads as a hang in the script.
- **Would have prevented it:** the session-start `host-pressure` parcel was
  an hour old and reported 1.6% CPU pressure. A fresh reading printed by the
  `beep` entry point when CPU pressure is high would have named the cause
  before any debugging.

## 2026-11-12: `Arbitrary.sampleEffect` option names

- **Doing:** the same sampling script.
- **Evidence:** `Arbitrary.sampleEffect(arbitrary, { numSamples: 5000 })`
  type-checks only through a cast and the option is ignored; the field is
  `count`. Effect 4.1 ships its own `effect/Arbitrary`, not fast-check, so
  fast-check names such as `numRuns`, `fc.letrec` and `fc.jsonValue` do not
  apply.
- **Would have prevented it:** a line in
  `.patterns/effect-module-paths.md` or the effect-vitest checklist saying
  property tests use `effect/Arbitrary` (`schema`, `map`, `filter`, `all`,
  `array`) and listing `SampleOptions` and `CheckOptions` fields.

## 2026-11-12: `S.String` admits text that cannot be canonicalized

- **Doing:** the execution-record seal replay.
- **Evidence:** `Arbitrary.schema(DraftGrantSet)` produced a grant whose
  destination held an unpaired surrogate; `freezeGrantSet` sealed it and
  `JsoncFingerprint.canonicalizeResult` refused it with `LoneSurrogate at
  "/grants/0/sink/destination"`. The same holds for every free-text field
  that reaches a digest (about 1,070 probe calls across existing property
  tests).
- **Would have prevented it:** a well-formed-string schema in `@beep/schema`
  for fields that feed a digest, so the refusal happens at decode instead of
  at seal time. Slice B or C can decide whether to add it.

## 2026-11-12: three temporary edits to source files during a read-only sweep

- **Doing:** the coercion probe, which wraps the three encoders locally.
- **Evidence:** a census agent reading the same checkout reported the
  temporary wrapper as if another session had edited the files, and had to
  cite line numbers from `HEAD` instead of the working tree.
- **Would have prevented it:** running the probe in a second worktree, or
  after the read-only sweeps finished.
