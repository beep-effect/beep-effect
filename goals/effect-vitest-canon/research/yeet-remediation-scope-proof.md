# Yeet remediation fixture qualification

This privately qualified candidate is not applied and closes no campaign rows.
The acknowledgement/resume package verification keeps its source inputs.

Eleven current live registrations use public instrumented layers with explicit
ten-second setup budgets. Registrations that previously provided TestConsole
retain it per test, and live clock semantics remain unchanged. The crypto-only
registration also uses the instrumented runner and an explicit hook budget.
Temporary-root ownership remains per invocation; removal failures become
visible through orDie instead of ignore.

Three wave-state fixtures pass with MemoryFileSystem. Dispatch append paths
retain native filesystem support for flock, and symlink rejection retains its
native subject and destination sentinels. All 23 names and 64 existing complete
assertion expressions retain AST parity. Two presence assertions are added
before existing persisted-state branches, fixing L-PROP-04 without discarding
the original head/update predicates.

The native candidate passes 23 tests on Node (5.71 seconds) and Bun (3.85
seconds). The mixed Memory/native candidate passes 23 on Node (5.57 seconds)
and Bun (4.02 seconds), and private types pass. Concurrent timings are receipts,
not performance comparisons.

Injecting absent persisted state into the two affected cases fails both with
the new presence assertions (Node, 2.88 seconds). Removing those assertions
while retaining the injection makes both cases pass (3.27 seconds), proving
the original checks could pass without checking the claimed state. A native
cleanup-error control passes on Node (3.27 seconds) and Bun (1.98 seconds);
restoring ignore makes it fail on Node (3.40 seconds). Candidate hashes and
logs are retained privately. Applied package verification and a source commit
remain required before ledger reconciliation.

## Applied eight-file batch, 2026-10-01

This candidate is now applied in the authoritative inventory-next worktree. Full `bun run beep quality package-verify @beep/repo-cli` completed exit 0: audit 676.6 seconds, docgen 24.4 seconds. Applied CI=true eight-suite proof passes 218/218 tests on Node 22.22.3 (31.01 seconds) and Bun 1.4.2 (16.57 seconds). These are focused correctness timings, not controlled package performance comparisons or hosted proof. Formatting preserves the seven prepared candidate body ASTs. Source commit and ledger reconciliation follow this proof checkpoint; historical private-only statements above describe their original qualification stage.
