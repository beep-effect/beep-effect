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

## Main integration after the repair

The next merge incorporates main through `1dd46faec6`. It preserves the new
scanned-file reporting test, lane-timing ruleset tests and per-job failed-log
monitor tests. The scanned-file case uses the branch's scoped fixture and fresh
console. Existing canonical Option assertions remain intact.

Inventory integration retains all 5,020 branch rows and their dispositions,
applies 127 upstream metadata/rekey updates and adds 39 incoming occurrences.
Twenty-four rows absent from the newer main snapshot remain as historical
campaign work; this merge does not silently retire them. The resulting inventory
has 5,059 rows. The existing ratified-context test's provider occurrence is
reconciled to its merged assertion body after verifying the same test and layer.

The first integrated CLI quick check used stale generated ai-metrics declarations
and reported missing HarnessHash exports. Building the updated dependency
restored the exports; the subsequent CLI lint and check passed. No source repair
was needed for those diagnostics.

The expanded scanner contract crossed the schema-first codec assertion threshold.
A schema-derived property now verifies that arrays of census rows retain all
fields and ordering through the persisted JSON codec, with stable re-encoding.
The focused persistence regression remains in place. Concurrent full-package
verification also exposed a transient lint-worker source fixture to Knip; the
quality rerun must occur after that fixture's scoped cleanup.
