# Historical outcome assertion reconciliation

Nine historical open EV006 records now have verified migration provenance.
This changes only inventory state; current assertions are retained.

- Five JSDoc response-validation cases retain their original operation and
  operands. `b1aa7e320cde926e7e80a98073ba8b0d517d7c8c` moved the
  `runSyncExit` calls into yielded `Effect.exit` calls during the Effect
  diagnostic migration. `8140304195f59af07c5ab19db3378ae7e21e3d71` then
  replaced the same failure predicates with public `assertTrue` assertions.
- Three goals index commands were directly replaced by public
  `assertExitSuccess(..., undefined)` in
  `c574e2a45f102b6a810f339ce23dc8e3a7cc22c8`. The diff preserves the
  check/write/check order and adds explicit stale-projection behavior checks.
- The coverage-baseline `scopedExit` predicate was replaced by a proven
  `Exit.isFailure`/public `assertTrue` pipe in
  `7dee42b8d9c02137b47d0855d61ac251a76ecb8c`, retaining the subsequent
  Cause rendering assertion.

Each historical row maps to an exact current AST call with unique occurrence
consumption and proven public helper imports. The repeated goals check
commands remain distinct occurrences. Git diffs and blame substantiate each
transition; absence from detector output is not the sole evidence.

The CLI ledger now contains 1,005 fixed, 7 exception and 2,442 open records,
including 39 open EV006 records. Private receipt:
`cli-historical-outcome-reconciliation.json`. Full CLI verification for the
preceding source repair remains in progress.
