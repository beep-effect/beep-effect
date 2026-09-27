# Observability instrumented runner adoption

Sixteen registered suites now use @beep/test-runner. The package adds only its
workspace development dependency and matching lock entry. Three compiler-only
fixtures remain unchanged. All 216 prior assertion expressions, thirteen
property registrations and eighty-six case names are preserved.

Five logger-subject cases retain native @effect/vitest layer ownership: two in
CauseRedaction, two in Logging and one in PhaseProfiler. A trace-on pilot proved
that runner lifecycle events change their exact subject captures. Moving the
layers inside the body preserved runtime output but violated strictEffectProvide;
that attempt was reverted. The exceptions preserve original assertions and hook
budgets without filtering logs, clearing captures or suppressing compiler rules.
Ordinary cases in those suites still use the instrumented runner.

Full package verification passed (audit 9.1 seconds; docgen 3.3 seconds). Configured
Node and Bun runs each passed all eighty-six tests with stable source hashes.
The receipt records workload/pressure and wall times; these are contextual
observations, not normalized performance claims. A full CI trace-on run passed
all eighty-six tests. A separate CI-unset, BEEP_TEST_TRACE=0 run passed all
twenty-six cases in the logger suites. Earlier CI=true/trace-zero runs do not
count as trace-off: CI enables tracing independently of the explicit flag.

A temporary assertion failure verified start and failure-end diagnostics,
including the test name and duration. The native TestConsole captures lifecycle
output, so a temporary finalizer read its log lines for this probe. The expected
nonzero exit was recorded and the file restored byte-for-byte. Reporter-only
output did not expose those captured events and is not credited as diagnostic
proof. No probe mutation remains in the package.

The nineteen-path preservation receipt records the five instrumentation
exceptions explicitly. Compiler output diagnostics and final inventory
reconciliation remain separate work. This checkpoint is not full Yeet proof,
hosted readiness or goal completion.
