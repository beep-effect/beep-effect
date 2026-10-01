# Yeet inbox-view fixture qualification

The candidate is now applied with the restricted Memory promotion described
below. Full package verification passes; campaign closure awaits the source
commit.

Thirteen live tests move to the public layer runner with excludeTestServices,
retaining their original live clock semantics and native filesystem. Existing
crypto-only layer registrations use the instrumented runner. Temporary roots
retain per-invocation ownership, but removal errors now remain visible rather
than being ignored. Symlink receipt rejection, unreadable directory evidence,
partial NDJSON, acknowledgement state and codec assertions are preserved.

All 19 names and 40 complete assertion expressions retain structural parity.
Private Node passes 19 cases in 7.55 seconds; Bun passes in 5.34 seconds; private
types pass. A cleanup control performs the real removal and then provokes a
typed NotFound from a second native removal. It verifies root absence and that
the error is visible: Node passes in 4.01 seconds and Bun in 2.23 seconds.
Restoring the original ignore behavior in a private negative-control fixture
must make that visibility assertion fail; logs are retained separately.

The final private candidate promotes only three read-only fixtures to Memory:
missing inbox, unreadable directory and an unterminated-only file. Append
operations and symlink rejection stay native. The broader trial failed eight
Bun cases because native flock needs a physical cwd, despite passing Node.
The restricted mixed suite passes 19 tests on Node (3.62 seconds) and Bun
(2.39 seconds), and private types pass. The restricted candidate is now applied.

Applied combined restoration/inbox tests pass 31 cases on Node (10.53 seconds)
and Bun (6.00 seconds). All 19 test names and 40 assertion expressions remain
unchanged. Both crypto-only registrations now have explicit 10-second setup
hook budgets. The public runner retains live clock behavior for the migrated
view cases. Full package verification passes.

Final root test types and detector ratchet pass with zero introduced findings.
Full package audit passes in 734.7 seconds and docgen in 28.4 seconds.
