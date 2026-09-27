# Consolidated batch flake phase

M365 MCP now exercises the actual in-memory stdio server under a parent that
completes normally, fails, or interrupts itself. Every case awaits the full
framed conversation, then checks that server finalization ran exactly once
before the parent fiber settles. Expected success, the exact planned failure,
and interruption are distinguished. No sleep, retry or deadline increase is
introduced. Existing protocol assertions remain intact.

All 23 package tests, package audit and docgen pass. A controlled replacement
of the server child fork with a detached fork makes all three teardown cases
fail their release-count assertion. The original source is restored exactly.
OnePassword CLI and Shared Tables retain deterministic fixtures and require no
additional clock, synchronization or teardown change.
