# Cleaner iteration, hashing and reflected dispatch replay

This continues the 24-scene controlled replay without changing source fixtures
or the oracle producer. Main was refreshed again through 5200ca9f35 in merge
38a154bfc2. Both upstream changes merged without engine source conflicts.

The live admitted cleaner now matches 40 controlled scenes, 42 runs and 104
exact observable events. The comparison includes callback-enter/return,
iterator-enter/yield/raise/complete, step-hash and exact raw hash return,
reflected equality, equality truth conversion and callable step dispatch.
Final result values and input identity, explicit closed failure reasons,
closed work ownership and returned admission capacity remain checked.

New cases exercise unhashable values and callables, integer and byte steps,
invalid step containers, iterator failure before/after a yielded callback,
and a live iterator whose callback appends another step. The captured cursor
reads the live step list at each next call; no eager copy supplies the result.

Captured dispatch protocols independently implement the source Step class:
production Python primitive hashing supplies exact hash integers, membership
and lookup call hashing separately, equality may delete the stored key, a hash
may change between calls, truth conversion is observed, and the second hash
may delete a key before lookup. The resulting missing-key failure and the
next run's fallback callback both match. Expected event values do not drive
the adapter; they are decoded only by the outer verifier.

The five focused suites (admission, admitted cleaner, registry, named corpus
and controlled corpus) pass 17 tests. Server source/test type checking and
focused lint pass. No native children run in this proof. Eleven controlled
scenes involving native HTML or builtin-function identity, 504 named/official
HTML cases, complete builtin/parser diagnostics and final-registry snapshots
remain separate obligations. The ledger remains an audit with unfinished
canonical proof, not a parity verdict or semantic waiver.
