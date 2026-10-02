# Inbox porcelain fixture qualification

This privately qualified candidate is not yet applied. Thirteen manual live
provider registrations move to public instrumented layers with explicit hook
budgets, preserving live clocks and per-case TestConsole state. Four crypto
layer registrations also use the instrumented runner. The separate actual
waiver-expiry test remains live pending an explicit clock-semantics review.

Temporary-root cleanup exposes failures. The cwd-getter fixture acquires root
ownership before writing its bun.lock marker; its release restores the original
process.cwd getter and removes the root. An injected seed failure passes its
root-absence and getter-identity controls on Node (3.57 seconds) and Bun (1.60
seconds). Restoring the original helper makes the same control fail (Node,
2.85 seconds); the control separately removes any retained fixture root.

All 26 test names and 59 assertion expressions are preserved. Three read-only
rejection cases pass with MemoryFileSystem; append and cwd command fixtures
remain native. The mixed suite passes 26 tests on Node (5.76 seconds) and Bun
(4.29 seconds), and private types pass. These concurrent timings are proof
receipts, not performance claims. Applied package verification and a source
commit remain necessary before ledger reconciliation.

CI=true qualification caught runner lifecycle logs entering the list command's
shared TestConsole. Three console-reading callbacks now acquire a fresh console
inside the runner boundary. Node and Bun each pass all 26 tests with tracing;
all 59 assertions and registration names remain unchanged.

## Applied eight-file batch, 2026-10-01

This candidate is now applied in the authoritative inventory-next worktree. Full `bun run beep quality package-verify @beep/repo-cli` completed exit 0: audit 676.6 seconds, docgen 24.4 seconds. Applied CI=true eight-suite proof passes 218/218 tests on Node 22.22.3 (31.01 seconds) and Bun 1.4.2 (16.57 seconds). These are focused correctness timings, not controlled package performance comparisons or hosted proof. Formatting preserves the seven prepared candidate body ASTs. Source commit and ledger reconciliation follow this proof checkpoint; historical private-only statements above describe their original qualification stage.
