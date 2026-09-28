# Observability native property registrations

Nine synchronous manual Arbitrary.checkEffect wrappers now use native it.prop:
two redaction laws, two error-reporter option laws, two logging option laws,
one HTTP status law, one duration option law and one phase-profile law.
The two existing upstream Observed native effect properties remain byte-identical.

Token comparison verifies the exact callback bodies, arbitrary inputs and
fcRuns(50) options survived each conversion. No predicate, return value, schema,
filter, expected value or domain was changed. Native registration now reports
counterexamples directly instead of asserting the manual result tag. All eighty
case names remain, and all three compile-only fixtures are unchanged.

Full package verification passed audit in 9.2 seconds and docgen in 3.4 seconds.
The configured Node and Bun suites each passed eighty tests with zero failures
or skips in 6.176 and 3.420 whole-command seconds. Source hashes were stable;
the receipt retains load, pressure and limits so these observations are not
misrepresented as controlled performance comparisons.

The focused property run executed all eleven existing laws with
BEEP_FC_NUM_RUNS=400 and BEEP_FC_SEED=20260708. All eleven passed; the receipt
lists their executed names. The remaining cases were intentionally filtered
only for this additional property proof, not the full configured suite runs.

Independent finite witnesses, generated codec coverage, flake review and the
logger/test-runner pilot remain separate subsequent checkpoints.
