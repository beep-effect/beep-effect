# Lint rules assertion phase

Two registry Option presence checks now use canonical helpers: None uses
assertNone and the presence-only Some predicate flows to assertTrue without
inventing a payload. An exact inverse-edit check proves only those assertions
and the helper import changed; all metadata and encoded registry oracles remain.

All 66 configured tests pass on Node and Bun with stable source hashes. Single
whole-command observations are 14.590898 and 8.429528 seconds, with load/pressure
retained and no speedup claim. Full package audit (12.7 seconds) and docgen
(2.2 seconds) pass.
