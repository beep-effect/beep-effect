# Viewer serialization must not repeat for the same state

The test now matches stringify arguments against the encoded editor-state schema
and its derived equivalence, using the actual fixture's encoded value. It requires
a positive initial subject count and exactly the same count after the original
three same-state rerenders. The original aggregate stringify-count assertion is
retained. The normal viewer encodes both wire and decorated forms; this test does
not incorrectly require a single stringify call.

The state is constructed inside `it.effect` through the original document codec,
so every test execution owns a fresh state identity. The stringify spy has a scope
finalizer as well as its original explicit restore, preventing a failed assertion
from leaking the spy. No production behavior changed.

Two temporary production mutations were exercised and removed:

- Bypassing the entire cache caused six repeated serializations; both the old and
  strengthened tests rejected it. This was not evidence of an old-test gap.
- Serializing the same state once on the first cache hit, then returning the real
  cached result, passed the old test. The strengthened assertion rejected the
  subject count increasing from two to three. This proves detection of even one
  redundant subject encode, independently of the aggregate initial count.

The subject, all three rerenders, original assertion, and timeout remain intact.

Validation: the focused Node test passed after restoring both mutation controls.
Full `bun run beep quality package-verify @beep/professional-desktop` passed
(audit and docgen). Its first attempt stopped at an upstream `@beep/ui` build
with no-location TS2589; the unchanged UI build and complete package retry passed.
The root inventory and all 15,248 ledger rows passed strict decoding and unique-ID
checks; this does not close the remaining Desktop findings.
