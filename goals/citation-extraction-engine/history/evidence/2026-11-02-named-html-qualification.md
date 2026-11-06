# Complete named-cleaner partition and builtin observations

The real builtin dispatcher now has a test observation capability that preserves
its result/error while recording exact input/return values and closed failure
categories. It never supplies expected results to production. Exception messages
and backend diagnostics are not exposed. The unit named replay now checks all
600 non-HTML outcomes, 3,200 builtin boundary events and final ordered registry
snapshots. The controlled unit replay retains all 40 scenes and now checks 114
selected events, adding actual builtin enter/return/failure boundaries.

The hosted named HTML test covers the remaining 504 named/official source cases:
304 successes, 142 parser failures, 58 Unicode-declaration failures and 2,416
builtin boundary observations. It checks result text, input identity, failure
category, traversal order, final registry state and returned admission capacity.
The original 565 HTML entries include 58 declaration rejections before spawn;
507 actual children and 507 independent exit confirmations are required.
The default unit fixtures still forbid spawning. Native execution remains
hosted and this new 504-case test is not yet claimed passed.

The two native qualification files share an observed-spawner capability. It
counts a PID exit only after the supervisor's stopped observation and an actual
OS ESRCH result; EPERM, other errors or a live PID cannot count as confirmation.
The native controlled test now requires 79 events, adding builtin boundaries.
Its resource case compares the actual builtin entry/resource failure, requires
no later callback, and retains the already approved no-partial-result behavior.

The focused unit corpus and registry tests pass. Source/test type checking and
focused lint pass. The production-source data, source fixture, oracle producer,
policy ceilings and canonical parity rows are unchanged. Full parser diagnostics,
callback exception-message equivalence and other remaining engine obligations
are not claimed by these closed-category boundary assertions.

Separate exact-head hosted receipts for the preceding Unicode and native custom
replays are retained in 2026-11-02-hosted-native-qualification.md. Those results
prove their earlier assertions and are not substituted for the strengthened
checks or new named HTML test in this wave.
