# Docgen native fixture scope checkpoint

The compiler integration uses a unique native copy of the retained fixture at
the same directory depth, preserving its real compiler wrapper and module
resolution. FileSystem owns the temporary directory and ChildProcess owns the
actual Bun docgen process. Output streams and exit are awaited; the compiler
exit/stderr assertion precedes marker reads. Original harvested-member, marker
and exit assertions remain. Post-scope checks require the directory removed
and the child stopped. No production code changed.

Full package audit and docgen pass. Both runtime suites pass all 107 tests.
The scope-complete timing phase runs after the audit and verifies stable source
hashes; an earlier overlapping Node observation is excluded because its hash
snapshot included another test invocation's temporary copied source.
This checkpoint does not claim failure/interruption controls or the remaining
assertion, property, runner and ledger stages complete.
