# Colors migration checkpoint

Implementation: `94f19c393b9333bb411b9e10bf59434322c2b847`. Scope: one existing test file, all 15 registrations.

- No resource findings; no new layers, filesystem or timers.
- Replace Option-tag expectations with canonical helpers; preserve the original
  full-value round-trip equality and both disabling-override assertions.
- Replace two runSync/checkEffect wrappers with native it.prop and fcRuns(100).
- Import instrumented it from @beep/test-runner.
- Add only development dependencies, regenerate config/boundaries, and review
  nine colors cache nodes whose dependency edges changed; other nodes preserved.
- Package audit 8.0 s and docgen 2.8 s pass; Node/Bun each pass 15 tests, including
  explicit BEEP_FC_NUM_RUNS=400 and BEEP_FC_SEED=20260708.
- Nine actionable ledger rows fixed, three coverage-only rows retained.
- Detector ratchet: introduced 0, unrelated resolved 4 retained in baseline.

The earlier presence-helper rewrite exposed a strict-equality prototype mismatch;
the correction preserves original toEqual semantics without restricting inputs.
Timing remains observational across different runtime cohorts. This is package
proof, not repository-wide or hosted proof.
