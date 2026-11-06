# Shared exclusive text-capacity primitive

Whole-engine accounting needs the parent text authority to lend remaining output
capacity before a bounded producer allocates. CitationTextBudget now exposes a
withCapacity method under its existing schema-owned maximum and Ref counter.
This is a prerequisite for joining cleaner charges to the enclosing Document
budget; that final connection is still unfinished.

## Effect reuse and contract

TextCapacity shares one exclusion implementation between the parent authority
and the existing cleaner work ledger. Effect Semaphore.withPermit owns waiting
and release. A private Context.Reference containing an immutable Effect HashSet
marks borrowed authorities in the producer's inherited context. Reentry by the
producer or a child is refused immediately; unrelated callers wait through
producer cleanup. Different authorities can be nested. No fiber-id bookkeeping,
notification loop, scheduler or timer is introduced. This replaces the cleaner
ledger's manual borrowing-fiber field and cleanup bookkeeping.

The installed Effect 4.1.2 Context.Reference and Semaphore APIs were read before
implementation. The same owned Ref counter still handles permanent reservations;
rejected charges do not modify it and caller transaction rollback cannot undo
successful reservations. Snapshot remains available without joining the queue.

A bounded producer must enforce its allowance before allocating output and
complete cleanup before returning. Successful exact-unit settlement runs in an
uninterruptible continuation after the interruptible producer, closing the gap
between receiving a result and charging it. Empty output is valid at zero
remaining capacity. Invalid settlement fails without publishing a value or
charging an invalid amount. Failure/interruption releases the allowance after
cleanup without issuing successful-output charges, preserving the existing
cleaner capacity contract. Producers cannot retain/detach output on such paths.
Ordinary already-issued reservations are never refunded.

The parent method has R=never and preserves the producer's typed error channel
alongside CitationSafetyLimitExceeded. Cleaner reentry retains its existing
invalid-reservation error. No resource ceiling, policy default, suppression or
baseline is changed.

## Passed and pending proof

Twenty-two tests pass across new capacity controls, existing cleaner work and
existing composed parent-budget tests in 2.95 seconds. They prove queued
reservation exclusion through cleanup, exact settlement and refusal, inherited
child reentry refusal, cancellation/finalizer ordering, malformed settlement,
empty output at zero and the earlier cleaner/rollback behavior. Package lint,
source and test type checks pass.

The first new tests used an unavailable Fiber.poll API. Their failed assertion
also left a deliberately blocked cleanup gate unreleased, causing a timeout.
The tests now use Effect Deferred completion signals and make assertions after
releasing the controlled cleanup gate. The initial receipt remains in
.beep/text-capacity-tests.log; passing proof is
.beep/text-capacity-qualified-tests.log. No deadline or test timeout was raised.

Hosted exact-head verification remains pending. The Document cleaner and native
phases still need to consume one shared invocation authority, including bounded
producer allowance settlement and default protocol adaptation. This primitive
does not establish whole-engine cumulative allocation proof. Full constructor
replay, Node constructor qualification, HTML names, remaining parity/accounting,
public service/Layer and reflection/lifecycle closeout remain required.
