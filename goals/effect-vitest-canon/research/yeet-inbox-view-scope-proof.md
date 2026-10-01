# Yeet inbox-view fixture qualification

Private candidate only. Applied root types, package proof and campaign closure
remain pending. Memory promotion has not been evaluated for this candidate.

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
(2.39 seconds), and private types pass. This is still unapplied evidence.
