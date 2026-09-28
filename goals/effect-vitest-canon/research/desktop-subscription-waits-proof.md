# Atom state waits subscribe instead of polling

The intake state, workspace sync state, composer draft, and composer turn-start
helpers now use AtomRegistry.toStream, filter the original predicate, and stop
after its first matching value. The public stream emits the current value and
future changes and releases its registry subscription when it closes. Each
helper retains its original failure message and an explicit three-second
Effect.timeoutOrElse bound; no wait deadline was increased.

The tests using these waits retain it.live because their watchdog must measure
real time while the independently constructed registry runtime executes. This
matches the packet's detached-registry rule in SPEC section 6.2. The registry's
scheduler is not driven by the test clock. Existing idle-TTL sleeps and the sync
serialization observation window remain separate review obligations.

Node and Bun each passed all 22 cases across the four touched files. AST
comparison preserved all 22 titles and 86 assertion call expressions, including
nested expressions. Predicates, inputs, releases, error expectations, and the
three-second wait budget were retained.

A temporary negative probe supplied an always-false state predicate. It failed
with the original named error at the three-second timeout and left the atom's
listener count unchanged. A second probe waited until the predicate was invoked,
confirmed one added subscription, interrupted the waiter, and confirmed return
to the original listener count. Both probes passed alongside the original sync
cases and were removed afterward.

Seven existing EV009 rows are now reasoned exceptions in baseline and ledger:
the three intake state-transition waits, both sync cases, the delayed composer
draft case, and the composer closure-dispatch case. Their live watchdogs are
required around the detached registry runtime. This does not classify the other
five remaining live-clock candidates or close unrelated filesystem judgments.

Full Desktop package verification passed audit and docgen. Schema-first and
strict inventory/ledger/census validation passed. The final ratchet reported
zero introduced findings, 226 resolved against the retained baseline, and 4,776
live findings. These are focused migration receipts, not full PR readiness.
