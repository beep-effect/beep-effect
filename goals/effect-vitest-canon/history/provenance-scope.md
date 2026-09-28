# Provenance scope phase

The installed BunCrypto layer aliases the shared NodeCrypto Layer.succeed
provider. Eleven ordinary test providers now belong to one it.layer suite.
The two custom Crypto values remain case-local, provided with
Effect.provideService; their service bodies are unchanged. The mutable source
closure still mutates before the asynchronous digest starts, and the separate
failing digest retains its exact sanitized-error assertions.

Package verification passed: audit 6.4 seconds, docgen 3.0 seconds. The Bun
run passed all 22 tests. No production code changed. Assertion/property/runner
phases and final inventory reconciliation remain outstanding.
