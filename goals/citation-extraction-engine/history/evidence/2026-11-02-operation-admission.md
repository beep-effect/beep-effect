# Shared citation operation admission

Implemented after merging origin/main through e462bc12e9 (merge 789c7a009f).
The operator clarified that the Claude orchestrator owns repository-wide green
checks; this branch should merge main regularly and continue engine work.

Admission.ts captures explicitly decoded limits, Clock and Scope once. Its
R-never capability shares active and queued operation bounds across clean,
extract, resolve and annotate callers. Overload fails before evaluating the
body. Queue expiry and total expiry use the existing closed safety error;
queue time counts toward the total deadline. Private construction/closed-owner
failures carry no source content. Scope shutdown rejects new calls, interrupts
active/queued calls and drains their permits. Interrupted or failed callers
return their capacity only after their finalizers finish. Queue acquisition
is interruptible while permit accounting and handoff remain masked.

CleanerOperation.ts captures the shared admission owner and production cleaner
pipeline. Two independently constructed cleaner operation adapters therefore
share the same admission. Nested cleaner plans continue through work.nested,
reusing the enclosing permit, timer and output ledger instead of re-enqueuing.
No new callable request field, ambient policy default or public barrel appears.

Fifteen focused tests across admission, production cleaner integration and the
existing live registry pass. They cover cross-kind overload, queue cancellation,
queue/total deadlines, captured Clock/policy, failure cleanup, delayed
cancellation cleanup, owner shutdown and nested cleaning. The integration
uses actual owned values, native hashing and literal builtins with a forbidden
native spawner. It starts no child processes. Server source/test type checking,
focused lint and native-runtime checks pass; canonical schema catalog and
identity profile writers ran.

This is private operation composition, not final engine parity. The final
public Layer must provide one admission owner to every operation adapter.
Global native-process ownership, full source-event replay, mappings, extraction,
annotation, public boundary translation and remaining parity obligations stay
open. Hosted and repository-wide acceptance remains with the coordinated CI
workflow; it is not a reason to stop independent implementation.

The existing hosted CitationHtmlUnicode qualification now uses the admitted
cleaner operation too. Both independent replay lanes share one admission owner
with an explicit two-operation qualification policy within the frozen ceiling.
Its 2,016 histories, 6,412 snapshots, 482 expected parser failures and 1,025 child
exit confirmations are unchanged, with a final zero-active/zero-queued assertion.
Source/test type checking and focused lint pass for this wiring. The full native
replay remains hosted and has not been run locally or claimed successful.
