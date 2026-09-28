# CLI typed-failure assertion closeout

Implementation commit `d0e74047a466692f26cbc8ecc37e3afae97e6f4d` closes ten existing EV005 rows across
six files and the final historical CLI EV006 row in quality-tasks. Historical
rows match the actual pre-change detector occurrences; the collect-all row's
upstream custom failure branch is reconciled through its recorded lineage.
No finding is closed merely because it disappeared from detection.

The typed-failure tests yield Effect.flip directly. Expected typed failure
continues the test; unexpected success, defects and interruption fail it.
Existing error-message comparisons inspect the yielded error and retain their
exact operands. Watchdog process diagnostics, path safety, branch/worktree
preservation and restoration assertions remain. The cheap-gates test uses
public assertTrue on Exit.isFailure, preserving its custom message and every
following Cause, collected-failure and continued-lane assertion.

The reference Effect implementation of flip uses matchEffect with failure to
succeed and success to fail; matchEffect re-fails non-typed Causes. This matches
the original Effect.result plus failure-predicate boundary. No complete expected
error or Cause was invented from a partial-field or Boolean assertion.

| Runtime | Tests before / after | Before | After |
| --- | ---: | ---: | ---: |
| Node | 371 / 371 | 72.725 s | 55.264 s |
| Bun | 371 / 371 | 45.047 s | 38.435 s |

All four runs preserve identical file/fullName registration multiplicities,
with zero failures or skips and stable source hashes within each run. Recorded
workstation load varies; these durations do not establish a performance gain.
Structural AST comparison permits only the planned assertion changes, imports
and redundant parentheses. Generated package test diagnostics report exit zero
and empty output after unused-import cleanup.

Actual detector comparison removes exactly ten EV005 findings and preserves
all other rule/class/symbol group multiplicities. Thirteen enclosing anchors
are reconciled narrowly, modifying only occurrence/evidence in the baseline.
The root ratchet passes: 1,217 files, 3,721 findings, zero introduced and 1,296
resolved. Existing CLI ledger totals are 1,057 fixed, 7 exception and 2,393 open;
its existing EV005 and EV006 inventories have no open rows. This is not an
exhaustive fresh-main census or goal completion.

Full CLI package verification for this source commit is pending. The preceding
source batch passed audit in 778.7 seconds and docgen in 21.4 seconds; that proof
does not cover this batch. Private receipts use the cli-typed-failure prefix.
