# Semantica canonical test migration

Source commit: `cb3008d0fcc2545d99592b9f215ab3a2b5d6344e`, published in PR #1307.
Inventory reconciliation and final full-scan acceptance are pending.

## Preserved subjects and resources

The 15 test files retain 416 original subject assertions, all 116 original static
registration titles, and all original body deadlines. The seven aggregate
`Passed` assertions become native property registrations. The remaining original
polling assertion is replaced by completion, retry-budget, and live-watchdog
checks. Fixed Unicode heading and sentence cases remain separate from generated
trials. The resulting normal suite contains 133 tests, with no skips.

Public per-case layers expose resource ownership and acquisition deadlines.
Input and configuration tests acquire their actual minimal service sets; a
separate construction case retains full-runtime conformance. Evaluator and
extractor fixtures retain real Crypto while omitting unused platform services.
The reasoner has per-call local computation state, so public test layers safely
provide its service. Native EYE children and post-close ledger recovery keep
real subprocesses, live timeout cancellation, and scoped platform services.
Remaining fixture-dependent service combinations use the existing scoped helper.

Real F1 and PDF bytes, native PGlite/DuckDB/Oxigraph, cache lock/PID/mTime/rename
behavior, independent projection expectations, injected provider boundaries and
poison replay providers remain the subjects. These tests do not establish actual
hosted-provider operation or interactive browser behavior.

## Laws and regression oracles

Seven native properties retain their exact arbitraries and predicates: runtime
mode (100 trials), joint canary stage/options (25), fixture media type (12), gold
paper ID (20), gold-source paper ID (20), joint schema representatives (25), and
filtered Unicode slice-back (30). Each uses shared floor/seed handling. Seven
independent predicate inversions failed with seed `20260708`, native replay
information and shrinking, followed by restoration and passing positive runs.

The repeated-endpoint extraction oracle now requires relation, subject and
object presence before the original count/equality checks. The conflicting
ledger append now rereads the original committed snapshot. Test-local negative
controls demonstrate that the old oracles accept missing endpoints or omit a
corrupted readback, while the strengthened oracles reject those conditions.
These controls do not claim a production corruption defect.

The two cache wait scenarios observe actual retry-timer registration before
advancing TestClock, retaining fresh clocks and real filesystem I/O. The healthy
winner has an explicit publication completion barrier; both winner and contender
are joined. The timeout case checks all seven delays exactly:
200, 400, 800, 1600, 3200, 6400 and 12800 milliseconds. A live watchdog reports the
scenario, last completed phase and retry delays without response data. Injecting
a 1100-millisecond native-I/O delay still passes both cases; an intentionally
stalled retry triggers the watchdog with the registered retry count and delay.
No historical hosted timeout is claimed to have been causally reproduced.

The recovery child closes scoped ledger services before its commit marker and
SIGKILL. Its retained assertions prove recovery of post-close committed state,
not interruption of an open transaction or recovery of an unflushed database.

## Verification

- Full `beep quality package-verify @beep/semantica` passes with
  `BEEP_FC_NUM_RUNS=400 BEEP_FC_SEED=20260708`; audit 13.5 seconds, lab docgen skipped.
- Root oxlint, Sherif, Fallow health/audit, cache policy and schema-first pass.
- Normal Node and Bun runs each pass 133 tests across 15 files with zero skips.
- Before/after whole-command seconds: Node 12.584197 → 12.386092;
  Bun 10.080896 → 8.979453. Source hashes were stable during each observation.
  Workstation load and CPU/memory/I/O pressure are captured with the timings.
  These single observations do not establish a causal performance improvement.
- The runner and existing test utility dependencies are explicit. Generated
  TypeScript references and Fallow boundaries are refreshed. The cache review
  changes only the 14 expected dependency edges across seven owned computations;
  commands, configuration, qualification state and unrelated nodes are preserved.

The complete PR still requires remaining inventory remediation, final root proof,
hosted checks and review closure. This package proof is not merge readiness.
