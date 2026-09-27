# Workspace assertion phase

Replace five direct Option checks with native assertNone/assertSome helpers,
retaining their exact operands, absence polarity and expected numeric parent 12.
The branded parent ID safely widens to number for the existing literal oracle.
Keep the complete strict encoded append-input equality, including its Option
field, unchanged. All three package audits and docgen pass after this change.

Reconciliation also found seven existing root-inventory Exit predicate rows
absent from the older per-package ledger. Preserve each complete isFailure
predicate and true polarity with pipe/assertTrue; no expected Cause is invented.
These are existing admitted-file findings, not a new global inventory. The
additional assertion pass does not change schema properties or resource scope.
