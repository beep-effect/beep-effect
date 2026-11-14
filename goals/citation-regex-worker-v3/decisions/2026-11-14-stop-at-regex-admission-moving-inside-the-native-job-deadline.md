---
title: "Reserve native lanes at the base admission points"
date: 2026-11-14
reversal: "Revert the reservation wiring only with an owner-approved replacement that preserves preflight, queue, timer and quarantine precedence."
---

Owner ruling 3 resolves this stop and authorizes CitationNativeLane.reserve,
including Diff. Reservation is the first native need: it claims the invocation's
unit without spawning. The request finalizer is already installed. It uses the
same short Semaphore and masked acquisition as start, and the same closed,
quarantined and yielding guards. A held unit is reused; reserve followed by start
counts one successful claim. Unused reservations return on Scope closure.

Regex reserves through the existing preparation acquisition callback, before
regexDeadline. Diff takes an explicit reservation effect alongside its explicit
starter and reserves at the existing preflight acquisition point, before payload
copying. Xml reserves after RPC preparation, at the old Markup acquisition point
inside annotateDeadline. Markup and Diff perform no request-authority lookup.
Standalone HTML keeps its own admission inside cleanDeadline at the existing
point after preparation. No public CitationCleaner contract changes.

The old no-op preparation acquisition is removed. The shared job supervisor's
adapter now executes actual lane.reserve there. Its per-job bookkeeping ticket
has non-releasing hooks because request Scope/yield owns the real native unit;
it neither claims another unit nor impersonates a standalone native lease.

Handover retirement remains inside start and its caller's job/stage timer. Under
built-in protocol v2 each job confirms retirement before returning, so the next
start can call retire on the retained previous record, but that call observes its
already successful retirement task. There is no live-child handover retirement
on the serial built-in v2 path. Direct lane clients can start with a live occupant;
that guarded handover remains required and proved with real children. An
unconfirmed job retirement fails the call and poisons the lane; it never becomes
a built-in path to another spawn.

Real Bun/Node child proofs cover queue-full and queue expiry for regex, Diff,
Xml and standalone HTML; global quarantine before reservation starts no job
child; a successful reservation followed by the captured job timer confirms
physical death and retains/returns capacity according to the boundary. The regex
queue proof observes that regexDeadline has not even started while admission is
queued. The direct-stage deadline fixture suppresses only the enclosing invocation
timer of equal duration to isolate the worker's captured timer, leaving production
timer placement unchanged. Source references, exact refusals and runtime receipts
are in history/evidence/2026-11-14-b1-reservation.md.
