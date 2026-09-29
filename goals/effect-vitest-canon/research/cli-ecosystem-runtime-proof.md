# Ecosystem polarity resource and runtime proof

Four tests now use the instrumented Effect tester and a shared NodeTestLayer
with an explicit ten-second hook budget. Each test acquires the existing scoped
temporaryWorkingDirectory resource before creating its .git directory. The local
withFixtureRepo wrapper, four nested runtime calls and four per-test layer builds
are removed. Each callback receives a fresh TestConsole service.

The suite explicitly remains sequential because it changes process.cwd. The
shared helper registers cwd restoration and directory removal before later
interruptible setup. This preserves ownership through setup failure and body
interruption. The native filesystem is retained for this migration; this receipt
does not close a separate memory-filesystem or platform-provenance judgment.
The checked command source contains no timer or retry path.

## Verification

- Node and Bun each pass all four ordinary tests with CI enabled. Baseline
  durations are 3.80 and 1.89 seconds; migrated durations are 4.07 and 1.52
  seconds. These shared-workstation observations do not establish a speed gain.
- AST checks preserve all four test names and test-body options, plus all ten
  assertion trees. No test was removed and no assertion was weakened.
- The package test-type artifact reports exitCode zero with empty diagnostics.
- Six temporary probes cover success, setup failure and interruption on both
  runtimes. Each observes four distinct directories, four distinct consoles,
  four successful after-test restoration checks, the original cwd and no
  remaining directories. Failure phases produce exactly four expected failed
  cases; setup failures carry the injected marker. Probe source is restored
  byte-for-byte in a finally block and verified afterward.
- The root ratchet scans 1,217 files: 2,863 findings, zero introduced and
  2,168 resolved against the existing baseline.
- Targeted detection drops from four findings to zero. Four historical runtime
  records match exactly by rule and occurrence. Ledger status remains open
  pending full package proof; other lens judgments are untouched.

Full CLI package verification is running on the restored migration source. Its
terminal result remains required. The source is saved in commit
`f18ae4a35e19ba67e8a510625962746abe484c8e`. Signing recovered without changing
configuration. The commit hook sorted imports; test bodies are unchanged and
the committed revision passes all four cases on Node (3.84 seconds) and Bun
(1.76 seconds).
This is local migration evidence, not hosted readiness or goal completion.
