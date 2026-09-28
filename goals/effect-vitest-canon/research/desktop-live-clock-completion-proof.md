# Completion-driven atom tests use the test clock

Eleven intake cases and the handled browser-failure case now use it.effect.
Their bodies await AtomRegistry.getResult rather than sleeping or polling on the
test fiber. They do not require a live clock in the test context, even though
the independently constructed registry runtime can perform asynchronous work.
The delayed browser logger still executes its original delay in that runtime;
the test awaits its result rather than removing or bypassing the delay.

The intake conversions cover picker cancellation and safe failure, manual-path
fallback/submission/validation/cancellation, public vault errors, drag-state
boundaries, and refused-file drop handling. Every body and assertion is byte-for-
byte unchanged: reverting only the twelve wrapper names reproduces the original
two source files exactly. All seventeen cases in the two files pass under Node
and Bun, including the five cases whose live wrappers remain under review.

This batch does not claim that the remaining polling or idle-expiry tests can
use a simulated clock unchanged. Those candidates retain their current behavior
pending separate judgments. No polling deadline, idle TTL, input domain, or
assertion was changed here.

A temporary probe required Clock.currentTimeMillis to equal zero at the start of
each of the twelve migrated cases. All seventeen cases passed with that probe,
without TestClock.adjust or other test-clock advancement; it was then removed.
The conversion exposed an EV008 candidate for the unchanged 25 ms delay inside
the independent browser registry's logger layer. That intentional delayed-layer
scenario is retained as a narrowly documented exception in baseline and ledger.
It is not a delay in the test fiber, whose clock remains controlled.

Full Desktop package verification passed audit and docgen. Schema-first and the
strict packet validator passed. The final ratchet reports zero introduced
findings, 226 resolved against the retained baseline, and 4,776 live findings.
The additional reviewed EV008 exception brings the baseline to 5,002 identities
and the ledger to 15,250; all remain schema-valid and unique. Final ledger
reconciliation and goal-wide completion are not claimed by this batch.
