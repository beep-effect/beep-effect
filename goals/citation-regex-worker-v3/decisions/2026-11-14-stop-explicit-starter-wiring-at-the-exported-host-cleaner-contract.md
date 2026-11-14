---
title: "Yield lane capacity across closed cleaner port calls"
date: 2026-11-14
reversal: "Restore request-long lane ownership only after replacing the cleaner boundary with an owner-approved explicit authority contract."
---

Owner ruling 2 supersedes the second stop. CitationCleaner and CitationCleanerWork
remain unchanged. The cleaner port is a separate boundary, like Recognizer: its
native children use a named standalone starter and their own per-process leases.
The default HTML cleaner passes that starter explicitly to MarkupWorker. Diff,
regex and invocation-owned Xml use the invocation lane. Neither Diff nor Markup
looks up an invocation, a lane or native admission.

Lane rule 1 is amended: one unit is held from the first native need until the
invocation Scope closes, except while calling through the closed cleaner port.
The pipeline wraps each invoke with lane.yieldTo, including nested cleaner plans.
Yield confirms retirement of the current occupant, returns the unit, runs the
port effect, and leaves the lane un-acquired. The next start acquires lazily.
An unconfirmed retirement quarantines and prevents the port effect from running.
There is no alternate spawn or graceful-exit path. A lane whose retirement was
unconfirmed remains terminal even after late confirmation returns the unit; both
start and yieldTo refuse further work in that invocation. The real-process proof
checks this after acknowledgement as well as before it.

NativeAdmission.ts uses concurrentOperations for the total active ceiling; the
regex subset additionally checks concurrentRegexProcesses. Policy v2 requires
that subset ceiling to be at least concurrentOperations (default 2/2; test 1/1).
For admitted operations following this serial native-call contract, each holds
at most one unit, in its lane or its cleaner call. Other admitted operations
therefore cannot fill the final unit needed by this operation. The shared native
admission still enforces its hard total ceiling across separate external callers;
quarantine refuses native work rather than admitting a replacement.

Normal built-in HTML cleaning precedes geometry/regex native work. Yield there
has no held unit to return and performs no new admission or owner-open check.
It preserves the port call's order and refusal. The reversed regex-then-HTML
proof deliberately uses a direct-stage invocation because the built-in order
does not exercise that transition. The snapshot and probe count cumulative
successful unit acquisitions, so a later reacquisition is observable.

Cleaner yields serialize reentrantly within one invocation using Effect's
TxReentrantLock. This allows nested plans while preventing concurrent cleaner
callbacks from taking two units. A start attempted during a cleaner yield fails
closed. Lock acquisition/release reuse the native admission's transaction
isolation combinator; the caller's port effect retains its original transaction
Context. Real-process tests cover concurrent yields inside caller transactions,
nested yields, and the rejected overlapping start.

The four original lane proofs and the cleaner additions run against real Bun and
Node children. New proof files also pass under a Node-parent Vitest runner using
explicit Node platform services. Kill/retirement remains the existing physical
owner's SIGKILL, isRunning re-check and child-Scope close before acknowledgement.
