# Observability compiler failure diagnostics

The boundary test still executes the same real compiler against the same three
fixtures in order, with unchanged arguments, working directory and deadlines.
Each invocation retains its own child scope. It now drains stdout and stderr
concurrently with exit, retaining at most 4,096 characters from each stream.
A failure includes the repository-relative fixture label, exit code and redacted
stream excerpts. Successful compilers remain quiet. No environment is dumped.

A temporary real fixture type error produced TS2322 with the expected label and
stream context. A second probe generated 1,500 real compiler errors: the process
completed, both streams were drained and the displayed error remained bounded
(4,240 characters including labels). Both probes intentionally failed and restored
the fixture byte-for-byte; neither counts as a passing package run.

Final package verification passed after the first probe was restored (audit
8.8 seconds; docgen 3.4 seconds). Configured Node and Bun each passed all
eighty-six tests, with stable source hashes and contextual load/pressure receipts.
The subsequent high-output probe restored the same fixture hash. All 216 original
assertion expressions, thirteen property registrations and eighty-six case names
remain unchanged. The first package attempt failed formatting, which was repaired;
only the final package run receives validation credit.

This completes the admitted boundary diagnostic change. Final inventory
reconciliation, dependency-cache qualification and full Yeet/hosted proof remain.
