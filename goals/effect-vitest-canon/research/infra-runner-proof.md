# Infrastructure native registration and runner proof

Sixteen tests now use native Effect registration in place of30 synchronous
runtime calls. Expected schema failures use Effect.flip and check SchemaError;
the missing hash-salt reference retains its exact message-content witness.
Synchronous public APIs still have their original throwing-contract assertions.
Two Crypto cases use native NodeServices groups. The static default generation
remains a module fixture computed once through real Node Crypto, while test
execution itself uses native Effect boundaries.

The boundary conservation audit covers eight files and all536 resulting
assertion expressions. It maps runtime-to-yield and expected-failure conversions
explicitly, preserving every other predicate, operand and polarity. Static
property decoders and guards are compiled once at module scope, with unchanged
schemas and equivalence. A final Result-success predicate uses the public
assertTrue helper with the original decoded policy operand.

All eight configured Vitest files now register through @beep/test-runner. The
development dependency, lockfile, generated TypeScript reference and Fallow
boundaries agree. The cache review records seven runner dependency edges across
12 reviewed nodes, without qualification or unrelated configuration changes.
Full package verification passes audit in8.0 seconds and docgen in5.8 seconds.
Root Oxlint, Sherif, cache policy and Fallow health/audit pass. The independent
SDK node:test suite also passes all three cases with zero skips; package audit
retains the31 Lambda Bun tests and bundle/zip checks.

These tests use real local Crypto and the rendered missing-mode Bash usage path.
They do not execute live provider, deployment, privileged or secret operations.
Final Node/Bun measurements and owned inventory reconciliation follow this proof.
