# Direct dictionary comparison reentrancy

Date: 2026-10-31. Scope: the private combined/general-key table, before cleaner
registry integration or complete dictionary/engine parity.

The cleaner source corpus requires equality callbacks that can edit the live
registry during lookup. The existing private dictionary held a non-reentrant
semaphore across equality, which would deadlock a direct callback calling the
same table. Simply admitting recursion would also be wrong: lookup must discard
a comparison result when the compared key or underlying key table changed.

## Source binding and observations

The producer uses the exact eyecite checkout, CPython 3.11.15 and a zero hash
seed. It checks the retained dictobject.c and PSF license hashes used by the
original general-key proof. The relevant source is dictkeys_generic_lookup:
identity is tested before stored hash/equality; after rich comparison, the key
table pointer and compared key pointer must still match. Otherwise it reports
DKIX_KEY_CHANGED, and the caller restarts with the original lookup hash. An
exception returns immediately and does not roll back callback side effects.
The existing CPython adaptation notice continues to cover this implementation.

Thirteen histories retain 26 operation outcomes and 49 ordered comparison/action
events. They exercise clearing, deleting the compared key, removing/reinserting
that same object, updating only its value, inserting without resize, resizing
while lookup or assignment is active, false equality after resize, removal after
clear, mutation followed by equality failure, five successive restarts, nested
read/get calls, and clear followed by refill. A following lookup records retained
state after each first operation. Complete ordered entries and values are kept.

The original eight histories and 62 source events remain unchanged. The new
corpus is separate and retains source/license/runtime/producer identity. Its
maintainer verifier checks the complete canonical report, case order, counts and
key references, rejects ten altered reports and optionally reproduces the source
observations from the pinned interpreter. Target tests bind the committed fixture
bytes before decoding and compare every new result, event and ordered snapshot.

## Owned execution and restart rules

The semaphore now records its owning Effect fiber. Direct calls from equality
in that same fiber reuse the owner; other fibers still acquire the semaphore.
Resource ownership clears on success, failure and interruption. No work fiber
or mutation task is detached. Returned methods still have R = never and retain
the captured comparison/work capability.

Lookup remembers the key-table epoch and compared insertion entry. Clear,
resize and compaction change the epoch; removing/reinserting the compared key
invalidates its old insertion entry. Either change restarts lookup, regardless
of whether equality returned true or false. Value replacement alone preserves
the entry/key identity, so the result reads its current value without an extra
equality call. Insertion without table rebuild also avoids a spurious restart.
The original caller-supplied hash remains unchanged during retry.

Every probe and nested dictionary operation retains the existing shared work
charges. A separate target test repeatedly removes/reinserts the compared key
without letting lookup settle: the work ceiling fails explicitly and clear/read
remain usable for cleanup. Another test interrupts a suspended comparison while
another fiber waits for clear; the waiter proceeds and subsequent insertion
succeeds. The two new focused tests and two retained tests pass together, and
server source/test type checks pass.

## Phase checks

The two retained and two new focused tests passed in 3.38 s. Both package gates
passed: server audit 410.9 s/documentation 22.2 s, and use-cases audit 20.1 s/
documentation 15.4 s. The eleven-component source audit passed and still reports
missing target completion. All 37 divergence controls rejected altered evidence
and premature proof; the new source verifier passed ten corruption controls and
fresh replay. Goal doctor reported no new blocking findings and the goal index
passed. Authored spelling, README/evidence Markdown and Git whitespace checks
passed. These are local phase checks, not final Yeet or hosted PR evidence.

## Retained integration obligations

This implements direct same-fiber comparison mutation in the existing operation-
owned combined/general backend. It does not qualify forked mutation inside a
callback, mutation from accounting/before-set hooks, Unicode-specialized/split
key tables, production hash generation or a retained cleaner registry spanning
multiple operations. A registry that survives operations must bind work charges
to the current operation rather than silently exhaust a lifetime counter.

The cleaner still needs its runtime host-value/identity, lazy-step and live
registry ports, plus composed original-source/intermediate-text bounds and
shared global admission/deadlines. No composed cleaner, public Layer, canonical
completion row, normalization law or semantic waiver is promoted by this fix.
