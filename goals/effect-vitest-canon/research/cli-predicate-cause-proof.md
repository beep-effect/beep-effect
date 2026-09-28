# CLI boolean predicates and Exit cause assertions

## Preserved assertions

This batch migrates 53 assertions in four files selected from the existing open
EV006 inventory. Eleven Chai `assert.isTrue` calls over Option or Exit predicates
use the identical predicate and subject with public `assertTrue` in pipe form.
Plain-value Chai assertions remain legal and are not part of this rewrite.

Forty-two conditional Exit cause assertions previously tested a nonempty literal
substring against either `exit.cause.toString()` or an empty string on success.
They now name the failure predicate, assert it with public `assertTrue`, then
perform the identical cause-string substring check. The named condition lets
TypeScript narrow the original Exit without casts; an isolated installed compiler
probe verified that behavior before preparation. The rewrite requires
an identifier subject, the exact original cause-string expression, an empty
success fallback and a nonempty literal expected substring. An empty expected
substring would allow success in the original test and is deliberately excluded.
Typed failures, defects, interruption, cause rendering and expected messages
remain unchanged. No fixtures, resources, registrations or timeouts change.

Preparation checks public import provenance and shadowing. Structural statement
comparison proves only the planned changes outside imports. The actual generated
Effect diagnostic artifact reports exit zero with empty output.

## Inventory and proof

Actual detector output removes exactly 53 EV006 findings and preserves the
multiplicity and traversal order of all other groups. Only eight enclosing-
statement occurrence/evidence pairs are updated in the baseline. The ratchet
passes with 3,766 findings, zero introduced and 1,251 resolved baseline findings,
scanning 1,217 files in 9.72 seconds. No exception or new baseline debt is added.

The ledger plan matches 42 historical rows by exact occurrence and one by the
unique remaining identical file/rule/class/symbol/evidence pair after assigning
all other duplicates. Ten captured assertions have no unassigned historical
equivalent and will receive separate fixed rows after the source commit.

All 440 tests pass before and after on Node and Bun, with identical file/title
registration multiplicities, zero failures/skips and stable source hashes.
Before durations are 30.717790334 seconds on Node and 21.752445131 seconds on
Bun; after durations are 29.764159380 and 20.549630623 seconds respectively.
Runtime versions, process limits, workstation load and pressure are captured.
These samples do not establish a causal performance improvement.

Full CLI package audit/docgen is running; its result is not yet claimed.
Private receipts use `cli-predicate-cause-batch-*`, with inputs from
`cli-chai-predicate-*`, `cli-exit-cause-*` and `exit-cause-alias-proof.mts`.
The complete inventory, empty baseline and hosted gates still block closeout.
