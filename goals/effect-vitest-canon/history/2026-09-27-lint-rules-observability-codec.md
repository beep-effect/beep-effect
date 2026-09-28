# Lint-rules report decoding observability

Both native linter harnesses now propagate malformed JSON and invalid report
shapes as `JsonReportError`, retaining the original stdout and decoding cause.
The historical fallback to an empty successful report was removed. The existing
Biome and oxlint report schemas and their property domains are unchanged;
valid empty reports remain accepted.

Six boundary cases were added in the existing schema-parity suite. All 72 tests
passed on the configured Bun runner. Full `quality package-verify
@beep/lint-rules` passed audit (12.7 seconds) and docgen (2.0 seconds), after
correcting three introduced Effect style diagnostics.

A controlled restoration of the old empty-success fallback caused exactly four
malformed-output cases to fail while both valid-empty-report cases passed. The
helper was restored byte for byte afterward. This demonstrates the new tests
reject the historical loss of diagnostic evidence.

This is a partial observability repair. Unexpected subprocess exit status and
stderr propagation remain open, followed by the instrumented runner migration,
final Node/Bun timings, detector reconciliation, and hosted proof.
