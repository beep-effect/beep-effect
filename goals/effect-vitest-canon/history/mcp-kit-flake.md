# MCP kit interruption synchronization

The approved-dispatch interruption test now waits on a Deferred completed by
the entered handler before interrupting the fiber. This replaces the scheduler
yield with an explicit causal handshake. The handler still waits forever after
entry; interruption still must settle as interrupted in the existing recording
Ref. No sleeps, retries, skips, or timeout extensions were introduced.

Full package verification passed: audit 6.6 seconds and docgen 3.2 seconds.
The complete Bun run passed all 95 tests.
