# Dock persistence observes the completed storage write

The live debounced-binding test previously slept for 600 ms and then sampled
localStorage once. It now proves the snapshot key is initially absent and waits
for that exact key to contain a value, with an explicit 600 ms bound. The
original final non-null assertion, panel operation, registry operation result,
mounted binding, release, and graph disposal remain.

The production 400 ms debounce and external Atom registry run in real time. No
virtual clock, longer deadline, alternate storage implementation, or production
behavior was introduced. The bounded wait ends on the observed write rather
than treating an elapsed delay as a completion signal.

A temporary control suppressed only the binding's SaveDockSnapshot dispatch.
The test failed waiting for storage to become non-null; the control was removed.
This confirms that missing persistence cannot satisfy the new wait. It does not
claim that the original test permitted missing persistence or that a naturally
occurring slow-write failure was reproduced.

Final verification passed all eight Node cases, full Desktop audit/docgen, the
Effect/Vitest ratchet with zero introduced findings, schema-first checks, and
strict inventory/census/ledger validation. The single existing EV009 live-clock
row was re-anchored to the new precondition excerpt and kept open; no live-clock
judgment was waived. Reversing only the initial-storage assertion and bounded
wait exactly reproduced the original file.
