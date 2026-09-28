# Composer confirmation lifetime and completion

The production dispatch helper returns its already-created confirmation fiber.
Its existing synchronous subscription-before-dispatch ordering is preserved, as
are draft restoration and the default timeout. Subscription release now finalizes
the sleep, so interruption releases both subscriptions without restoring a draft.
Existing callers can ignore the additive return value; owning callers can await
or interrupt it before disposing their registry.

The first two tests own that fiber and join it within their existing 200 ms
settling budget instead of sleeping blindly. Their 50 ms confirmation interval,
draft assertions and revision expectations are unchanged. All three original
registries now have test-scope cleanup. The real handler-closure test still
unmounts its surface before using the closure; it additionally observes the unique
turn subscription release, with a bounded wait also registered as a finalizer.
The existing 25 ms handler-idle delay remains a separate witness limitation.

A new cancellation test uses the public Effect tester, mounts the submit atom,
verifies the two added subscriptions, interrupts the confirmation and checks both
listener counts return to baseline without restoring or revising the draft.
A control retained the additive fiber handle but restored completion-only cleanup:
the regression failed with an extra listener. Restoring finalization passes.
The temporary mutation was removed. Four Node tests pass, including the three
original behavior cases and the new cancellation case.

The final full Desktop package audit, including Bun unit tests, and Docgen pass
(14.7 and 12.4 seconds respectively). Structural validation preserves the three
original titles and ten assertion call expressions in order. Three enclosing
EV009 fingerprints were matched to their original titles with open statuses
retained. Strict inventory/census validation and diff checks pass.
