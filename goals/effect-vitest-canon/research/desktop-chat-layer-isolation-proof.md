# Chat contract layers retain isolated mutable state

Sixteen remaining body-level scoped providers now use public it.layer fixtures.
Each fixture is a separate one-test suite with its own memoization map and
lifetime. Fifteen cases require a fresh in-memory ThreadStore; the last uses a
fresh UsageRecordSink layer. The previously migrated metric case remains intact.

The installed peer implementation creates a new memoization map for independent
layer registrations. A temporary runtime probe additionally tracked the actual
ThreadStore service identities in all fifteen migrated store-backed cases and
required all fifteen to be distinct. All nineteen original cases passed with
that probe, which was then removed. This preserves isolation without sharing
mutable stores across the suite.

The history-capture case still creates its Ref inside the test. Only its
effectful ThreadStore moved to the layer fixture; the local capture kernel is a
pure service stub supplied with Effect.provideService. This also satisfies the
compiler rule against body-level Layer provision without hoisting the Ref.
The original generator body and history assertions remain intact.

Each new layer fixture uses the existing ten-second hook budget, or five minutes
under coverage/deep-sweep policy. Original test deadlines, TestClock receipt
expiry, cancellation barriers, input domains, expected records, and assertions
remain unchanged. AST comparison preserved all nineteen test titles and 136
assertion call expressions (including nested expect calls).

The migration exposed EV015 for the existing five-minute TestClock advance in
the receipt-expiry case. A second temporary probe observed all fifteen actual
TestClock objects through TestClock.testClockWith, required distinct identities
and initial time zero, and passed all nineteen original cases. The clocks are
isolated, not merely assumed isolated from the suite shape. This new judgment
row is ledgered as an exception with its evidence; the advance remains unchanged.

The full Desktop package audit/docgen and all nineteen normal Node tests passed
after switching the capture stub to provideService. Schema-first and strict
inventory validation also passed. The ratchet accepted the reasoned clock row
with zero introduced findings; no prior open rows were silently closed.
Before publication, main's refs preflight and coverage-baseline updates were
merged cleanly, with the chat batch preserved and restored.
The combined branch passed all 36 tests in the three affected refs suites and
the post-merge ratchet (zero introduced findings). These focused merge checks
are recorded separately from the pre-merge full Desktop package proof.
