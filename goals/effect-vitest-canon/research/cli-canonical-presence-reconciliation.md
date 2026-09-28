# Historical canonical presence reconciliation

Eleven historical open EV006 rows in the contract, detector, primitives and
store suites already use public `assertTrue(Option.isSome(value), message)`.
Commit `52f6a9bdff8031655cc5b08e0ae885b8eccd8616` repaired the detector to
accept the exact canonical Boolean helper while retaining stronger None
routes. Its positive and negative regression cases remain in the detector
suite, whose 212 tests passed on Node and Bun during the pipe repair.

A syntax-only reconciliation locates each exact historical assertion in the
live AST, proves both helper and predicate import provenance, and consumes
each occurrence only once. This preserves the two identical resource-lifetime
messages as distinct assertions. A fresh detector audit of the existing
open-row files confirms these assertions no longer emit EV006. Absence from
the detector alone was not accepted as evidence.

The eleven records now reference that detector repair as their fix. Their
identities, assertions, custom messages and test registrations are unchanged.
No exceptions or source rewrites were needed. CLI inventory now has 996 fixed,
7 exception and 2,451 open records; 48 open EV006 rows remain. The live root
ratchet count is unaffected by this historical reconciliation.

Private receipts: `cli-canonical-presence-reconciliation.json` and the refreshed
`cli-remaining-assertion-audit.json`. Full CLI package verification from the
preceding source change is still running and is not credited here.
