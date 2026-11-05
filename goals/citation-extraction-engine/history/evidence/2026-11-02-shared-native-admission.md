# Shared native ownership across composed citation workers

The private `CitationNativeProcessAdmission` captures validated policy, Clock and
Scope. Its total reservation ceiling is `concurrentOperations`; regex execution
still needs the additional `concurrentRegexProcesses` bound when implemented.
Its bounded waiting queue uses `queuedOperations` and `queueDeadline`. The
enclosing operation/stage retains responsibility for its total/stage deadline.
Returned methods have no environment requirements.

Every HTML worker captures this injected owner during construction. Standalone
private workers create a local owner; full engine composition must provide one
shared native owner alongside the shared operation admission service. The
two-lane hosted Unicode replay now injects the same native owner into both
independent value/registry workers and asserts its final counters are empty.

An acquired lease transfers to the exact worker's retirement owner before spawn.
Cancellation or a returned cleanup failure cannot release it. Confirmed exit and
successful process-scope finalization release it exactly once. An unconfirmed
retirement quarantines the shared owner, fails queued workers and rejects new
reservations, including from a different worker instance. Every quarantined
lease must acknowledge retirement before admission recovers. Scope closure
rejects waiting/new acquisitions while preserving outstanding lease authority;
it does not manufacture an exit acknowledgement or wait forever for a child.

Both native and local HTML queue handoffs mask the ownership transfer after an
interruptible wait. Failure/cancellation releases any acquired reservation before
propagating, including a race between cancellation and a slot becoming free.

Focused tests cover bounded shared admission, overflow, queue cancellation,
captured policy/Clock, deadline exhaustion, repeated quarantine/recovery, closure,
idempotent release, and 32 cancellation/handoff races. A real-process worker test
constructs two supervisors sharing one owner. It delays the first child's kill
acknowledgement after the real kill, observes the second queued supervisor fail
with quarantine, proves that no second process spawned, then acknowledges
retirement and verifies all reservations and process records are empty. This is
a controlled delayed-acknowledgement test, not evidence of an unkillable child.

All seven focused suites passed (36 tests, 16.40 seconds), including all ten HTML
supervisor tests. The five native-admission tests passed again after extending
the repeated quarantine/recovery control (5.66 seconds). Test typecheck, focused
lint and the native-runtime law check passed (two files, zero errors/warnings).
Full Unicode, named HTML and
native callback corpus replays remain hosted checks of the newly pushed head.
Historical hosted results in `2026-11-02-hosted-native-qualification.md` prove
their recorded heads only. No oracle fixture, producer, expected behavior or
semantic waiver changes. This establishes a shared ownership mechanism; full
engine Layer composition, regex execution, extraction, mapping, annotation,
Bluebook transforms and exhaustive goal closure remain incomplete.
