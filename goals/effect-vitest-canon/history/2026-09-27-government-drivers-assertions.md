# Government drivers assertion phase

Two GovInfo Option predicates now use public canonical helpers. None uses
assertNone; the existing presence-only Some predicate flows to assertTrue without
inventing an expected payload. All three rate-limit field assertions, original
guards and every plain-value oracle remain unchanged. An exact inverse-edit
check proves only the helper import and two assertions changed. eCFR has no
admitted assertion change in this phase.

All eight configured GovInfo cases pass on Node and Bun with stable source hashes
and load/pressure receipts. Node took 3.570122 seconds and Bun 1.817225 seconds;
these are single observations without a speedup claim. Full package audit
(10.3 seconds) and docgen (3.5 seconds) pass.
