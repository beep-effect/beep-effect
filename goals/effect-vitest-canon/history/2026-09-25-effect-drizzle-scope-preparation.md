# Effect-drizzle scope preparation

The existing fifteen-file census is unchanged from the reviewed source pin
`d9f74d230a949e37f108a9ad52c0bc16a829d98f`. This wave uses that inventory;
no fresh census or P1 completion is claimed.

The SQLite harness now acquires its concrete Bun Database with acquireRelease.
Close is registered atomically before the foreign-key PRAGMA executes. The
original native handle, PRAGMA, and close-before-directory-removal order remain.
This addresses the observed registration gap; no actual leaked handle was
reproduced and no production code changed.

Untouched baseline evidence:

- Configured Node JSON-reporter run: 101 passed, one pending; suite collection
  fails on the Bun-only SQLite import. Whole command 5.549 seconds, stable source
  hashes, runtime/load/pressure/process limits saved with the private report.
- Configured Bun run: all 113 tests passed, including the native SQLite suite.

After the acquisition repair, full package verification passed: audit 17.6
seconds and docgen 3.6 seconds. This is scoped preparation, not complete wave
proof or a causal performance comparison. Subprocess ownership, oracle/property
findings, instrumentation, final timings, ledger attribution and hosted gates
remain outstanding.
