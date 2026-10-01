# PR #1365 coverage repair

The full proof on `3b9e2b20b4` passed unit and type checks but failed the
coverage ratchet in `EffectVitestScan.ts`, `EffectVitestStore.ts` and
`AdmissionJournal.ts`. Those production files were unchanged from the integrated
base. The coverage baseline is unchanged by this repair.

## Restored behavior

The migrated journal test returned from inside its three-case ownership-loss
loop. Only the first case ran, although the test passed. Removing that return
restores the cases for reads 1, 2 and 4. An AST audit of changed test files found
no other successful return within a loop before its enclosing function boundary;
the remaining two loop returns explicitly fail invalid corpus fixtures.

A scanner contract test now discovers two temporary inputs in reverse order,
writes the inventory and census beneath an isolated artifact root, schema-decodes
the persisted documents and verifies their contents and canonical ordering.
Only the two artifact destinations are redirected through the Path service;
the repository's committed inventory and census are not written.

## Proof and limits

- The affected scheduler and contract suites pass 166 tests under Node and Bun.
- After strengthening the scanner fixture to two inputs, its 33 Node tests pass.
- The final focused Istanbul run passes 394 tests across five suites.
- Focused scanner coverage is 100% for lines, statements, branches and functions.
- Focused store coverage is 83.63% lines, 84.37% statements, 100% branches and
  61.53% functions, exceeding the floors implicated in the full failure.
- Focused journal coverage is 100% lines/statements/functions and 98.09% branches.
  The previously uncovered ownership-loss paths now run. The remaining focused
  omissions are default-argument branches exercised outside this selected suite;
  this focused result is not a substitute for the full coverage gate.
- CLI package lint and check pass; the actual test-type artifact has exit code 0
  and empty diagnostics. The Effect Vitest ratchet reports zero introduced rows.

Full package verification, full coverage and hosted checks must still pass on
the integrated commit before the PR is called mergeable. Private drafts for
later inventory work are not included in this repair.
