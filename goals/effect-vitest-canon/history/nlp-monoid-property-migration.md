# NLP monoid property registration migration

Eleven native checkEffect registration sites now use public it.prop with
fcRuns(100): three generic monoid laws, three NLP monoid laws, two
SentenceConcat identity laws, and three schema round-trip laws. The generic
harnesses still instantiate every original domain and comparator. SentenceConcat
remains identity-only; no associativity claim was added.

An AST comparison against the saved pre-edit sources confirmed unchanged
arbitrary expressions, predicate bodies, comparator setup, and surrounding
code. The only structural changes are the registration wrappers, explicit
run floors, the fcRuns import, removal of one unused Effect import, and
hoisting two pure schema equivalence builders into their existing describe
scopes. Round-trip predicate bodies retain their existing runtime boundaries;
the later observability phase still needs to address those boundaries.

Full package verification passed: audit 9.0 seconds and docgen 3.9 seconds.
This is partial NLP property-phase progress. Graph laws, remaining property
registrations, flake review, instrumented runner, ledger reconciliation, and
fresh final timings remain outstanding. No detector baseline was removed.
